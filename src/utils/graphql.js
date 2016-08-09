import { Types } from 'mongoose';
import { fromGlobalId } from 'graphql-relay';
import {
  graphql,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import { introspectionQuery } from 'graphql/utilities';

import {
  assignIn,
  keys,
  isArray,
} from 'lodash';

/**
 * Extract an ObjectId from a data which can either be a Mongo id or a GraphQL global id
 * @returns {Types.ObjectId}
 */
export function objectIdFromData(data) {
  if (Types.ObjectId.isValid(data.toString())) {
    return new Types.ObjectId(data.toString());
  }

  return new Types.ObjectId(fromGlobalId(data).id.toString());
}

/**
 * Merge multiple query and mutation fields getters and create a GraphQL schema
 * @param queryFieldsGetters
 * @param mutationFieldsGetters
 * @returns {{GraphQLSchema}}
 */
export function generateSchema({ queryFieldsGetters = [], mutationFieldsGetters = [] } = {}) {
  const getFields = (getters) => {
    const _getters = isArray(getters) ? getters : [getters];
    const fields = {};
    _getters.forEach((fn) => assignIn(fields, fn()));
    return fields;
  };

  const queryFields = getFields(queryFieldsGetters);
  const mutationFields = getFields(mutationFieldsGetters);

  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: queryFields,
  });
  const mutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: mutationFields,
  });

  return new GraphQLSchema({
    query: keys(queryFields).length ? queryType : null,
    mutation: keys(mutationFields).length ? mutationType : null,
  });
}

export function getSchemaJson(schema) {
  return graphql(schema, introspectionQuery);
}
