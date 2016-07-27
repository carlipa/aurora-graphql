import Promise from 'bluebird';

import {
  GraphQLID,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
  GraphQLInputObjectType,
} from 'graphql';

import {
  connectionArgs,
  connectionFromPromisedArray,
} from 'graphql-relay';

import {
  camelCase,
  cloneDeep,
  each,
  find,
  fromPairs,
  isArray,
  keys,
  map,
  mapKeys,
  reduce,
  snakeCase,
  toPairs,
  toUpper,
  upperFirst,
} from 'lodash';

import { MixedType, ObjectIDType } from '../../types/common';
import { objectIdFromData } from '../../utils/graphql';

import { ClassesFieldsHelper } from './';

/**
 * Generate a function to be used as "getQueryFields" in the schema
 * @private
 */
export default function getQueryFields(classesFieldsHelper) {
  if (!classesFieldsHelper instanceof ClassesFieldsHelper) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // return () => {
  const queries = {};

  classesFieldsHelper._classesHelpers.forEach(({
    name: className,
    plural,
    getFields,
    getSortableFieldsName,
    getFilterableFields,
  }) => {
    // Pluralize the field name
    const pluralName = camelCase(plural || `${className}s`);

    if (pluralName === camelCase(className)) {
      throw new Error(`Cannot create fields for ${className}, queries for one and multiple have the same name !`);
    }

    /**
     * Given a field name, return an object for the orderBy argument
     * @param fieldName the field name
     * @param inData if true, will add "data." to the field name (default: false)
     * @returns {{}}
     */
    const getOrderByEntries = (fieldName, inData = false) => {
      const asc = toUpper(snakeCase(`${fieldName}Asc`));
      const desc = toUpper(snakeCase(`${fieldName}Desc`));

      const _fieldName = inData ? `data.${fieldName}` : fieldName;

      return {
        [asc]: { value: { [_fieldName]: 1 } },
        [desc]: { value: { [_fieldName]: -1 } },
      };
    };

    // Create the orderBy values, using "createdAt", "updatedAt" and the class sortable fields
    let orderByEnumValues = { ...getOrderByEntries('createdAt'), ...getOrderByEntries('updatedAt') };
    map(getSortableFieldsName(), (fieldName) => getOrderByEntries(fieldName, true)).forEach((idxValues) => {
      orderByEnumValues = { ...orderByEnumValues, ...idxValues };
    });
    const orderByType = new GraphQLEnumType({
      name: `order${upperFirst(pluralName)}By`,
      values: orderByEnumValues,
    });

    // Create the filters type
    const filtersFields = {};
    const namePrefix = `filter${upperFirst(pluralName)}With`;

    map(getFilterableFields(), (field, fieldName) => {
      const fieldType = ClassesFieldsHelper._graphQLTypeFromString(field.type ? field.type : field);

      const nameWithFieldName = `${namePrefix}${upperFirst(fieldName)}`;

      switch (fieldType) {
        case GraphQLBoolean:
          filtersFields[fieldName] = {
            type: new GraphQLInputObjectType({
              name: `${nameWithFieldName}Boolean`,
              fields: {
                eq: { type: GraphQLBoolean },
              },
            }),
          };
          break;

        case ObjectIDType:
          filtersFields[fieldName] = {
            type: new GraphQLInputObjectType({
              name: `${nameWithFieldName}ObjectID`,
              fields: {
                in: { type: new GraphQLList(ObjectIDType) },
                eq: { type: ObjectIDType },
              },
            }),
          };
          break;

        case GraphQLString:
          filtersFields[fieldName] = {
            type: new GraphQLInputObjectType({
              name: `${nameWithFieldName}String`,
              fields: {
                in: { type: new GraphQLList(GraphQLString) },
                eq: { type: GraphQLString },
                regexp: { type: GraphQLString },
              },
            }),
          };
          break;

        case GraphQLInt:
        case GraphQLFloat:
          filtersFields[fieldName] = {
            type: new GraphQLInputObjectType({
              name: `${nameWithFieldName}Number`,
              fields: {
                in: { type: new GraphQLList(GraphQLFloat) },
                eq: { type: GraphQLFloat },
                gt: { type: GraphQLFloat },
                gte: { type: GraphQLFloat },
                lt: { type: GraphQLFloat },
                lte: { type: GraphQLFloat },
              },
            }),
          };
          break;

        default:
          // Nothing
          break;
      }
    });

    const filtersType = new GraphQLInputObjectType({
      name: `${namePrefix}`,
      fields: filtersFields,
    });

    // If the class doesn't have any filter, using `{}` as `filters` field would throw an error
    // This little hack prevents it
    const filtersHolder = !keys(filtersFields).length ? {} : {
      filters: {
        type: filtersType,
      },
    };

    // lowerCaseName
    const lcName = className.toLowerCase();

    // All
    queries[pluralName] = {
      type: classesFieldsHelper._connections[lcName],
      args: {
        ...connectionArgs,
        ...filtersHolder, // Here we destructure our potentially empty object
        orderBy: {
          type: new GraphQLList(orderByType),
        },
      },
      resolve: (_, args) => {
        // Create query
        const query = {};
        each(args.filters, (filter, fieldName) => {
          const safeFilter = cloneDeep(filter);

          // RegExp process
          if (safeFilter.regexp) {
            const matchedRegexp = safeFilter.regexp.match(/\/(.*)\/(\w*)/);

            if (!matchedRegexp) {
              throw new Error(`Invalid RegExp at ${className}/${fieldName}`);
            }

            const motif = matchedRegexp[1];
            const flags = matchedRegexp[2];

            delete safeFilter.regexp;
            safeFilter.eq = new RegExp(motif, flags);
          }

          // If we explicitly demand a field, the `in` property is ignored
          // We use `in` on an array[1], since mongoose doesn't use `$eq` queries
          // TODO better implementation
          if (safeFilter.eq) {
            safeFilter.in = [safeFilter.eq];
            delete safeFilter.eq;
          }

          query[`data.${fieldName}`] = mapKeys(safeFilter, (value, key) => `$${key}`);
        });

        // Merge orderBy's
        const sort = reduce(args.orderBy, (soFar, value) => Object.assign(soFar, value), {});

        // Get all the data (ids only), using the optional sort
        const getDataPromise = classesFieldsHelper._getAllClassData(className, { query, sort });
        // Apply "connectionFromPromisedArray" to the result, which will filter the results
        return connectionFromPromisedArray(getDataPromise, args)
          .then((result) => {
            // Then, we query the real data
            const classesIds = map(result.edges, (edge) => edge.node._id);
            const edgesPromise = classesFieldsHelper._getManyClassDataByIds(className, classesIds)
              .then((results) => map(result.edges, (edge) => ({
                ...edge,
                node: find(results, { mongoId: edge.node._id.toString() }),
              })));

            // Total count
            const countPromise = getDataPromise.then((results) => results.length);

            return Promise.props({ edges: edgesPromise, totalCount: countPromise })
              .then(({ edges, totalCount }) => ({
                ...result,
                edges,
                totalCount,
              }));
          });
      },
    };

    // One
    queries[camelCase(className)] = {
      type: classesFieldsHelper._types[lcName],
      args: {
        ...getFields({ resolveRelations: false, disableNonNull: true }),
        id: {
          type: GraphQLID,
        },
      },
      resolve: (_, args) => {
        const mongoId = args.id ? objectIdFromData(args.id) : null;

        function parseValue(value) {
          try {
            return objectIdFromData(value);
          } catch (err) {
            return value;
          }
        }

        if (mongoId) {
          return classesFieldsHelper._getClassDataById(className, mongoId);
        }
        // Map both keys and values
        const query = fromPairs(map(toPairs(args), ([key, value]) => {
          if (isArray(value)) {
            return [
              `data.${key}`,
              map(value, parseValue),
            ];
          }

          return [
            `data.${key}`,
            parseValue(value),
          ];
        }));

        return classesFieldsHelper._getClassData(className, query);
      },
    };

    // One Raw
    queries[`${camelCase(className)}Raw`] = {
      type: MixedType,
      description: `Returns a pure javascript object of "${className}", as it is stored in the database,
          without any GraphQL parsing. Useful for version upgrade`,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_, args) => {
        const mongoId = args.id ? objectIdFromData(args.id) : null;
        return classesFieldsHelper._getClassDataById(className, mongoId, { raw: true });
      },
    };
  });

  return queries;
  // };
}
