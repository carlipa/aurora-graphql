'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MixedType = exports.ObjectIDType = undefined;

var _graphql = require('graphql');

var _language = require('graphql/language');

var _graphql2 = require('../utils/graphql');

var ObjectIDType = exports.ObjectIDType = new _graphql.GraphQLScalarType({
  name: 'ObjectIDType',
  description: 'A mongo ObjectID',
  serialize: function serialize(value) {
    return value;
  },
  parseValue: function parseValue(value) {
    return value;
  },
  parseLiteral: function parseLiteral(ast) {
    // istanbul ignore if
    if (ast.kind !== _language.Kind.STRING) {
      throw new _graphql.GraphQLError('Query error: Can only parse String but got a: ' + ast.kind, [ast]);
    }

    return (0, _graphql2.objectIdFromData)(ast.value);
  }
});

var MixedType = exports.MixedType = new _graphql.GraphQLScalarType({
  name: 'MixedType',
  description: 'A plain javascript object',
  serialize: function serialize(value) {
    return value;
  },
  parseValue: function parseValue(value) {
    return value;
  },
  parseLiteral: function parseLiteral(ast) {
    // istanbul ignore if
    if (ast.kind !== _language.Kind.STRING) {
      throw new _graphql.GraphQLError('Query error: Can only parse String but got a: ' + ast.kind, [ast]);
    }
    return JSON.parse(ast.value);
  }
});
//# sourceMappingURL=common.js.map