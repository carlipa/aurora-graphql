import {
  GraphQLScalarType,
  GraphQLError,
} from 'graphql';

import {
  Kind,
} from 'graphql/language';

import { objectIdFromData } from '../utils/graphql';

export const ObjectIDType = new GraphQLScalarType({
  name: 'ObjectIDType',
  description: 'A mongo ObjectID',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    // istanbul ignore if
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(`Query error: Can only parse String but got a: ${ast.kind}`, [ast]);
    }

    return objectIdFromData(ast.value);
  },
});

export const MixedType = new GraphQLScalarType({
  name: 'MixedType',
  description: 'A plain javascript object',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    // istanbul ignore if
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(`Query error: Can only parse String but got a: ${ast.kind}`, [ast]);
    }
    return JSON.parse(ast.value);
  },
});
