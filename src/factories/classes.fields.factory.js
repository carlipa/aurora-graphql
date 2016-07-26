import Promise from 'bluebird';
import { Types } from 'mongoose';

import {
  GraphQLID,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
  GraphQLInputObjectType,
} from 'graphql';

import {
  connectionArgs,
  connectionDefinitions,
  connectionFromArray,
  connectionFromPromisedArray,
  fromGlobalId,
  globalIdField,
  mutationWithClientMutationId,
  nodeDefinitions,
} from 'graphql-relay';

import {
  assign,
  camelCase,
  cloneDeep,
  compact,
  each,
  find,
  fromPairs,
  isArray,
  keys,
  map,
  mapKeys,
  omit,
  pickBy,
  reduce,
  snakeCase,
  startsWith,
  toPairs,
  toUpper,
  upperFirst,
} from 'lodash';

import ClassSchema from '../schemas/class.schema';

import { FileType, FileConnection } from '../types/file';
import { MixedType, ObjectIDType } from '../types/common';
import { objectIdFromData } from '../utils/graphql';

export class ClassFields {
  /** @private */
  _models = {};
  /** @private */
  _connections = {
    file: FileConnection,
  };
  /** @private */
  _types = {
    file: FileType,
  };

  static RESERVED_CLASS_NAMES = [
    'File',
  ];

  static RESERVED_CLASS_PREFIX = [
    '_',
  ];

  static RESERVED_FIELDS = [
    'id',
    '_id',
    'mongoId',
    'createdAt',
    'updatedAt',
    'clientMutationId',
    'options',
    'fields',
  ];

  static RESERVED_FIELDS_PREFIX = [
    '_',
  ];

  /**
   * @param storage
   * @param classes
   */
  constructor({ storage, classes }) {
    if (!storage) {
      throw new Error('Storage is missing !');
    }
    if (!classes) {
      throw new Error('Classes are missing !');
    }
    if (!classes.definitions) {
      throw new Error('Classes definition are missing !');
    }

    this._storage = storage;
    this._classes = classes;
  }

  /**
   * Convert stringed type to GraphQL type
   * @private
   */
  static _graphQLTypeFromString(type) {
    switch (type.toLowerCase()) {
      case 'string':
        return GraphQLString;
      case 'relation':
        return ObjectIDType;
      case 'boolean':
        return GraphQLBoolean;
      case 'int':
      case 'integer':
        return GraphQLInt;
      case 'float':
      case 'number':
        return GraphQLFloat;
      case 'object':
      case 'mixed':
        return MixedType;
      default:
        return null;
    }
  }

  /**
   * Parse a class data from mongoose, into an object for relay
   * @param result the mongodb result
   * @param className the class name
   * @returns {Object}
   * @private
   */
  _parseClassData(result, className) {
    // Get the real className (Capitalized)
    const _className = this._types[className.toLowerCase()].name;

    if (!result) {
      throw new Error(`Object "${_className}" not found`);
    }
    if (result._deleted) {
      throw new Error(`Object "${_className}" marked as removed`);
    }

    const data = cloneDeep(result.data);

    const resultWithoutData = omit(result, 'data');

    resultWithoutData.id = result._id;
    resultWithoutData.mongoId = result._id.toString();

    resultWithoutData.createdAt = result.createdAt.toISOString();
    resultWithoutData.updatedAt = result.updatedAt.toISOString();

    resultWithoutData._className = _className;

    return assign(data, resultWithoutData);
  }

  /**
   * Returns the mongoose schema of a class, for this "className"
   * @private
   */
  _getModel(className) {
    if (!this._models[className]) {
      this._models[className] = this._storage.getModel(className, ClassSchema);
    }

    return this._models[className];
  }

  /**
   * Get all the non-deleted elements of a class, but only their IDs
   * @param className
   * @param sort an optional sort object
   * @param query an optional query object
   * @private
   */
  _getAllClassData(className, { query, sort }) {
    return this._getModel(className).find({ ...query, _deleted: false }, { _id: 1 }, { lean: true, sort });
  }

  /**
   * Get an element of a class (or a file), by its ID
   * @param className
   * @param id
   * @param raw if true, will only returns class data (no id, timestamps, etc)
   * @private
   */
  _getClassDataById(className, id, { raw = false } = {}) {
    switch (className) {
      case 'file':
        return this._storage.files.getOneFileMetadataById(id);

      default:
        return this._getModel(className).findOne({ _id: new Types.ObjectId(id.toString()) }, {}, { lean: true })
          .then((classData) => {
            if (raw) {
              // We parse even if we want raw data, for error handling (we clone since we don't want it to mutate)
              this._parseClassData(cloneDeep(classData), className);
              return { ...classData.data, mongoId: classData._id };
            }
            return this._parseClassData(classData, className);
          });
    }
  }

  /**
   * Get multiple elements of a class by their IDs
   * @param className
   * @param ids
   * @private
   */
  _getManyClassDataByIds(className, ids) {
    const _ids = map(ids, (id) => new Types.ObjectId(id.toString()));

    return this._getModel(className)
      .findAsync({ _id: { $in: _ids } }, {}, { lean: true })
      .map((classData) => this._parseClassData(classData, className));
  }

  /**
   * Get an element of a class, using "query"
   * @param className
   * @param query the mongo query
   * @private
   */
  _getClassData(className, query) {
    return this._getModel(className).findOne({ ...query }, {}, { lean: true }).exec()
      .then((data) => this._parseClassData(data, className));
  }

  /**
   * Convert the `data` into a mongo ObjectId, and check if the object of the `fieldClassName` exits
   * @param fieldClassName
   * @param data
   * @returns {Promise}
   * @private
   */
  _getMongoIdFromData(fieldClassName, data) {
    const id = objectIdFromData(data);

    return this._getClassDataById(fieldClassName, id)
      .then((result) => {
        if (!result) {
          throw new Error(`There is no "${fieldClassName}" with id "${id}" !`);
        }
        return id;
      });
  }

  /**
   * For each class, generate an object that contains information and methods for GraphQL
   * @private
   */
  _generateClassesHelpers() {
    this._classesHelpers = [];

    const classesNames = keys(this._classes.definitions).map((x) => x.toLowerCase());

    each(classesNames, (className) => {
      each(ClassFields.RESERVED_CLASS_PREFIX, (prefix) => {
        if (startsWith(className.toLowerCase(), prefix.toLowerCase())) {
          throw new Error(`Parse error: Cannot use reserved prefix "${prefix}" in "${className}"`);
        }
      });

      if (ClassFields.RESERVED_CLASS_NAMES.map((x) => x.toLowerCase()).indexOf(className.toLowerCase()) !== -1) {
        throw new Error(`Parse error: Cannot use reserved class name "${className}"`);
      }
    });

    // Add the special "file" className
    classesNames.push('file');

    each(this._classes.definitions, (classDefinition, className) => {
      let { fields: fieldsDefinitions, options } = classDefinition;

      // If no options are needed, one can only use fieldDefs
      if (!fieldsDefinitions && !options) {
        fieldsDefinitions = classDefinition;
        options = {};
      }

      /**
       * Return the GraphQL fields of the class
       * @param resolveRelations if false, the relations fields will be string or list of strings
       * if false, they will be GraphQL type (default: true)
       * @param disableNonNull if true, required field won't be GraphQLNonNull (default: false)
       */
      const getFields = ({ resolveRelations = true, disableNonNull = false } = {}) => {
        const fields = {};

        // There's a bug with babel here, the arrow function is not correctly binding `this`
        const self = this;

        each(fieldsDefinitions, (field, fieldName) => {
          const _fieldName = camelCase(fieldName);
          if (ClassFields.RESERVED_FIELDS.indexOf(_fieldName) !== -1) {
            throw new Error(`Parse error: Cannot use reserved field "${fieldName}"`);
          }
          each(ClassFields.RESERVED_FIELDS_PREFIX, (prefix) => {
            if (startsWith(_fieldName.toLowerCase(), prefix.toLowerCase())) {
              throw new Error(`Parse error: Cannot use reserved prefix "${prefix}" in field "${_fieldName}"`);
            }
          });

          // Fields
          if (isArray(field)) {
            // If array
            if (field.length !== 1) {
              throw new Error('Parse error: Array must have a length of 1');
            }
            // You can use the object form, or directly enter the type
            const fieldArrayData = (typeof field[0] === 'string') ? { type: field[0] } : field[0];
            // If array of relation
            if (fieldArrayData.type.toLowerCase() === 'relation') {
              if (!fieldArrayData.ref) {
                throw new Error('Parse error: "relation" needs a "ref"');
              }

              const _ref = fieldArrayData.ref.toLowerCase();
              if (classesNames.indexOf(_ref) === -1) {
                throw new Error(`Parse error: Found a reference to missing class "${_ref}"`);
              }

              if (resolveRelations) {
                fields[_fieldName] = {
                  type: self._connections[_ref],
                  args: connectionArgs,
                  resolve: (fieldsList, args) => connectionFromArray(
                    map(fieldsList[_fieldName], (id) => self._getClassDataById(_ref, id)),
                    args
                  ),
                };
              } else {
                fields[_fieldName] = {
                  type: new GraphQLList(GraphQLID),
                };
              }
            } else if (fieldArrayData.type) {
              fields[_fieldName] = {
                type: new GraphQLList(ClassFields._graphQLTypeFromString(fieldArrayData.type)),
              };
            } else {
              throw new Error(`Parse error: cannot parse field ${fieldName} in ${className}`);
            }
          } else {
            // You can use the object form, or directly enter the type
            const _field = (typeof field === 'string') ? { type: field } : field;

            // If leaf
            if (_field.type.toLowerCase() === 'relation') {
              // If relation
              if (!field.ref) {
                throw new Error('Parse error: "relation" needs a "ref"');
              }

              const _ref = _field.ref.toLowerCase();
              if (classesNames.indexOf(_ref) === -1) {
                throw new Error(`Parse error: Found a reference to missing class "${_ref}"`);
              }

              if (resolveRelations) {
                fields[_fieldName] = {
                  type: _field.required && !disableNonNull ? new GraphQLNonNull(self._types[_ref]) : self._types[_ref],
                  resolve: (fieldsList) => self._getClassDataById(_ref, fieldsList[_fieldName]),
                };
              } else {
                fields[_fieldName] = {
                  type: _field.required && !disableNonNull ? new GraphQLNonNull(GraphQLID) : GraphQLID,
                };
              }
            } else if (_field.type) {
              fields[_fieldName] = {
                type: _field.required && !disableNonNull
                  ? new GraphQLNonNull(ClassFields._graphQLTypeFromString(_field.type))
                  : ClassFields._graphQLTypeFromString(_field.type),
              };
            } else {
              throw new Error(`Parse error: cannot parse field ${fieldName} in ${className}`);
            }
          }

          // Add the field description
          fields[_fieldName].description = field.description;
        });

        return fields;
      };

      /**
       * Returns an array that contains all the fields that are relation (one-to-one and one-to-many)
       */
      const getFieldsWithRelations = () => compact(map(fieldsDefinitions, (field, fieldName) => {
        if (isArray(field) && field.length) {
          // You can use the object form, or directly enter the type
          const fieldArrayData = (typeof field[0] === 'string') ? { type: field[0] } : field[0];

          if (fieldArrayData.type.toLowerCase() === 'relation') {
            return {
              fieldName: camelCase(fieldName),
              className: fieldArrayData.ref,
            };
          }
        } else if (field.type && field.type.toLowerCase() === 'relation') {
          return {
            fieldName: camelCase(fieldName),
            className: field.ref,
          };
        }
        return null;
      }));

      /**
       * Returns an array which contains the name of the field that are not arrays nor relation
       */
      const getSortableFieldsName = () => compact(map(fieldsDefinitions, (field, fieldName) => {
        if (isArray(field) || (field.type && field.type.toLowerCase() === 'relation')) {
          return null;
        }
        return camelCase(fieldName);
      }));

      /**
       * Returns a collection which contains the field that are not arrays
       */
      const getFilterableFields = () => pickBy(fieldsDefinitions, (field) => !(isArray(field)));

      this._classesHelpers.push({
        name: upperFirst(className),
        plural: options && options.plural,
        getFields,
        getFieldsWithRelations,
        getSortableFieldsName,
        getFilterableFields,
      });
    });
  }

  /**
   * Populate the "this._types" and "this._connections" object
   * @private
   */
  _generateTypesAndConnections() {
    // Create the nodeInterface and nodeField
    const { nodeInterface } = nodeDefinitions(
      (globalId) => {
        const { type, id } = fromGlobalId(globalId);
        return this._getClassDataById(type, id);
      },
      (obj) => this._types[obj._className.toLowerCase()]
    );

    // For each classes, create its type, and add its connection to the connections list
    this._classesHelpers.forEach(({ name: className, getFields }) => {
      const lcClassName = className.toLowerCase();

      this._types[lcClassName] = new GraphQLObjectType({
        name: className,
        description: `A ${className}`,
        fields: () => ({
          ...getFields({ disableNonNull: true }),
          id: globalIdField(className),
          mongoId: {
            type: GraphQLString,
          },
          createdAt: {
            type: GraphQLString,
          },
          updatedAt: {
            type: GraphQLString,
          },
          _className: {
            type: new GraphQLNonNull(GraphQLString),
          },
          _classVersion: {
            type: new GraphQLNonNull(GraphQLInt),
          },
        }),
        interfaces: [nodeInterface],
      });

      /**
       * The connection definition for this class
       * @prop connectionType the graphQl type for the connection
       */
      const definitions = connectionDefinitions({
        name: className,
        nodeType: this._types[lcClassName],
        connectionFields: () => ({
          totalCount: {
            type: GraphQLInt,
            resolve: (connection) => connection.totalCount || 0,
            description: 'A count of the total number of objects in this connection, ignoring pagination.',
          },
        }),
      });
      this._connections[lcClassName] = definitions.connectionType;
    });
  }

  /**
   * Generate a function to be used as "getQueryFields" in the schema
   * @private
   */
  _generateQueryFieldsGetter() {
    return () => {
      const queries = {};

      this._classesHelpers.forEach(({
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
          const fieldType = ClassFields._graphQLTypeFromString(field.type ? field.type : field);

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
          type: this._connections[lcName],
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
            const getDataPromise = this._getAllClassData(className, { query, sort });
            // Apply "connectionFromPromisedArray" to the result, which will filter the results
            return connectionFromPromisedArray(getDataPromise, args)
              .then((result) => {
                // Then, we query the real data
                const classesIds = map(result.edges, (edge) => edge.node._id);
                const edgesPromise = this._getManyClassDataByIds(className, classesIds)
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
          type: this._types[lcName],
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
              return this._getClassDataById(className, mongoId);
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

            return this._getClassData(className, query);
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
            return this._getClassDataById(className, mongoId, { raw: true });
          },
        };
      });

      return queries;
    };
  }

  /**
   * Generate a function to be used as "getMutationFields" in the schema
   * @private
   */
  _generateMutationFieldsGetter() {
    return () => {
      const mutations = {};

      this._classesHelpers.forEach(({ name: className, getFields, getFieldsWithRelations }) => {
        const lcName = className.toLowerCase();

        const createFieldName = `create${className}`;
        const createdFieldName = `created${className}`;
        const updateFieldName = `update${className}`;
        const updatedFieldName = `updated${className}`;
        const replaceFieldName = `replace${className}`;
        const replacedFieldName = `replaced${className}`;
        const removeFieldName = `remove${className}`;
        const removedFieldIdName = `removed${className}Id`;
        const recoverFieldName = `recover${className}`;
        const recoveredFieldName = `recovered${className}`;

        /**
         * Given an input, parse the potential relations in it
         * (ie: replace them with the Mongo Id, and raise an error if the reference is missing)
         * @param input the GraphQL input
         * @returns {Promise}
         */
        const parseInputRelations = (input) => {
          const fieldsWithRelations = getFieldsWithRelations();

          // Convert the object { key: value } to an array [key, value] (for bluebird#map)
          // We don't want the "clientMutationId", which is GraphQL specific
          const fieldsData = toPairs(omit(input, 'clientMutationId'));

          return Promise
            .map(fieldsData, ([fieldName, data]) => {
              const fieldWithRelation = find(fieldsWithRelations, (field) => field.fieldName === fieldName);

              if (fieldWithRelation) {
                if (isArray(data)) {
                  return Promise
                    .map(data, (x) => this._getMongoIdFromData(fieldWithRelation.className, x))
                    .then((ids) => ([fieldName, ids]));
                }
                return this._getMongoIdFromData(fieldWithRelation.className, data).then((id) => ([fieldName, id]));
              }

              return [fieldName, data];
            })
            // Convert back the array [key, value] to an object { key: value }
            .then(fromPairs);
        };

        // Create
        mutations[createFieldName] = mutationWithClientMutationId({
          name: createFieldName,
          inputFields: {
            ...getFields({ resolveRelations: false }),
          },
          outputFields: {
            [createdFieldName]: {
              type: this._types[lcName],
              resolve: (payload) => this._getClassDataById(className, payload.mongoId),
            },
          },
          mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
            if (!allowMutation) {
              throw new Error(`Usage of "${createFieldName}" mutation is not allowed`);
            }

            return parseInputRelations(input)
              .then((fields) => this._getModel(className).create({
                className: [className],
                data: fields,
                _classVersion: this._classes.version,
              }))
              .then((created) => ({ mongoId: created.id }));
          },
        });

        // Update
        mutations[updateFieldName] = mutationWithClientMutationId({
          name: updateFieldName,
          inputFields: {
            ...getFields({ resolveRelations: false, disableNonNull: true }),
            id: {
              type: new GraphQLNonNull(GraphQLID),
            },
          },
          outputFields: {
            [updatedFieldName]: {
              type: this._types[lcName],
              resolve: (payload) => this._getClassDataById(className, payload.mongoId),
            },
          },
          mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
            if (!allowMutation) {
              throw new Error(`Usage of "${updateFieldName}" mutation is not allowed`);
            }

            return parseInputRelations(input)
            // Remove the id field
              .then((fields) => omit(fields, 'id'))
              // Map all data keys to add a "data" suffix
              .then((fields) => mapKeys(fields, (_, key) => `data.${key}`))
              .then((fields) => {
                const _id = objectIdFromData(input.id);

                return this._getModel(className)
                  .update({ _id }, {
                    $set: {
                      ...fields,
                      _classVersion: this._classes.version,
                    },
                  })
                  .then(() => ({ mongoId: _id }));
              });
          },
        });

        // Replace
        mutations[replaceFieldName] = mutationWithClientMutationId({
          name: replaceFieldName,
          inputFields: {
            ...getFields({ resolveRelations: false, disableNonNull: false }),
            id: {
              type: new GraphQLNonNull(GraphQLID),
            },
          },
          outputFields: {
            [replacedFieldName]: {
              type: this._types[lcName],
              resolve: (payload) => this._getClassDataById(className, payload.mongoId),
            },
          },
          mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
            if (!allowMutation) {
              throw new Error(`Usage of "${replaceFieldName}" mutation is not allowed`);
            }

            return parseInputRelations(input)
            // Remove the id field
              .then((fields) => omit(fields, 'id'))
              .then((fields) => {
                const _id = objectIdFromData(input.id);

                return this._getModel(className)
                  .update({ _id }, {
                    $set: {
                      data: fields,
                      _classVersion: this._classes.version,
                    },
                  })
                  .then(() => ({ mongoId: _id }));
              });
          },
        });

        // Remove
        mutations[removeFieldName] = mutationWithClientMutationId({
          name: removeFieldName,
          inputFields: {
            id: {
              type: new GraphQLNonNull(GraphQLID),
            },
          },
          outputFields: {
            [removedFieldIdName]: {
              type: GraphQLString,
              resolve: (payload) => payload.mongoId,
            },
          },
          mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
            if (!allowMutation) {
              throw new Error(`Usage of "${removeFieldName}" mutation is not allowed`);
            }

            const _id = objectIdFromData(input.id);

            return this._getModel(className)
              .update({ _id }, { $set: { _deleted: true } })
              .then(() => ({ mongoId: _id }));
          },
        });

        // Recover
        mutations[recoverFieldName] = mutationWithClientMutationId({
          name: recoverFieldName,
          inputFields: {
            id: {
              type: new GraphQLNonNull(GraphQLID),
            },
          },
          outputFields: {
            [recoveredFieldName]: {
              type: this._types[lcName],
              resolve: (payload) => this._getClassDataById(className, payload.mongoId),
            },
          },
          mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
            if (!allowMutation) {
              throw new Error(`Usage of "${recoverFieldName}" mutation is not allowed`);
            }

            const _id = objectIdFromData(input.id);

            // TypeModel.update({ _id }, { $set: { _deleted: false } });
            return this._getModel(className)
              .update({ _id }, { $set: { _deleted: false } })
              .then(() => ({ mongoId: _id }));
          },
        });
      });

      return mutations;
    };
  }

  /**
   * @returns {*}
   */
  getFieldsGetters() {
    this._generateClassesHelpers();
    this._generateTypesAndConnections();

    return {
      getQueryFields: this._generateQueryFieldsGetter(),
      getMutationFields: this._generateMutationFieldsGetter(),
    };
  }
}

/**
 * @name GraphQLFieldsGetters
 * @type Object
 * @property {function} getQueryFields
 * @property {function} getMutationFields
 *
 * Using the "classesDefinition", create two functions, one for "query", the other for "mutation"
 * @param storage
 * @param classes
 * @returns {GraphQLFieldsGetters}
 */
export default function classesFieldsGettersFactory({ storage, classes }) {
  const classFieldsFactory = new ClassFields({ storage, classes });
  return classFieldsFactory.getFieldsGetters();
}
