import Promise from 'bluebird';

import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';

import {
  mutationWithClientMutationId,
} from 'graphql-relay';

import {
  find,
  fromPairs,
  isArray,
  mapKeys,
  omit,
  toPairs,
} from 'lodash';

import { objectIdFromData } from '../../utils/graphql';

import { ClassesFieldsHelper } from './';

/**
 * Generate a function to be used as "getMutationFields" in the schema
 * @private
 */
export default function getMutationFields(classesFieldsHelper) {
  if (!(classesFieldsHelper instanceof ClassesFieldsHelper)) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // return () => {
  const mutations = {};

  classesFieldsHelper._classesHelpers.forEach(({ name: className, getFields, getFieldsWithRelations }) => {
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
                .map(data, (x) => classesFieldsHelper._getMongoIdFromData(fieldWithRelation.className, x))
                .then((ids) => ([fieldName, ids]));
            }
            return classesFieldsHelper
              ._getMongoIdFromData(fieldWithRelation.className, data)
              .then((id) => ([fieldName, id]));
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
          type: classesFieldsHelper._types[lcName],
          resolve: (payload) => classesFieldsHelper._getClassDataById(className, payload.mongoId),
        },
      },
      mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
        if (!allowMutation) {
          throw new Error(`Usage of "${createFieldName}" mutation is not allowed`);
        }

        return parseInputRelations(input)
          .then((fields) => classesFieldsHelper._getModel(className).create({
            className: [className],
            data: fields,
            _classVersion: classesFieldsHelper._classes.version,
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
          type: classesFieldsHelper._types[lcName],
          resolve: (payload) => classesFieldsHelper._getClassDataById(className, payload.mongoId),
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

            return classesFieldsHelper._getModel(className)
              .update({ _id }, {
                $set: {
                  ...fields,
                  _classVersion: classesFieldsHelper._classes.version,
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
          type: GraphQLID,
        },
      },
      outputFields: {
        [replacedFieldName]: {
          type: classesFieldsHelper._types[lcName],
          resolve: (payload) => classesFieldsHelper._getClassDataById(className, payload.mongoId),
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
            // If an id is provided, use it, if not, a new object will be created (upsert)
            const query = {};
            if (input.id) {
              query._id = objectIdFromData(input.id);
            }

            return classesFieldsHelper._getModel(className)
              .findOneAndUpdate(query, {
                $set: {
                  data: fields,
                  _classVersion: classesFieldsHelper._classes.version,
                },
              }, {
                new: true,
                upsert: true,
              })
              .then((replaced) => ({ mongoId: replaced.id }));
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

        return classesFieldsHelper._getModel(className)
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
          type: classesFieldsHelper._types[lcName],
          resolve: (payload) => classesFieldsHelper._getClassDataById(className, payload.mongoId),
        },
      },
      mutateAndGetPayload: (input, context, { rootValue: { allowMutation } }) => {
        if (!allowMutation) {
          throw new Error(`Usage of "${recoverFieldName}" mutation is not allowed`);
        }

        const _id = objectIdFromData(input.id);

        // TypeModel.update({ _id }, { $set: { _deleted: false } });
        return classesFieldsHelper._getModel(className)
          .update({ _id }, { $set: { _deleted: false } })
          .then(() => ({ mongoId: _id }));
      },
    });
  });

  return mutations;
  // };
}
