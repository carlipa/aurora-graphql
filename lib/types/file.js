'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileConnection = exports.FileType = undefined;

var _graphql = require('graphql');

var _graphqlRelay = require('graphql-relay');

var FileType = exports.FileType = new _graphql.GraphQLObjectType({
  name: 'File',
  fields: function fields() {
    return {
      id: (0, _graphqlRelay.globalIdField)(),
      mongoId: { type: new _graphql.GraphQLNonNull(_graphql.GraphQLString) },
      filename: { type: _graphql.GraphQLString },
      contentType: { type: _graphql.GraphQLString },
      length: { type: _graphql.GraphQLInt },
      createdAt: { type: _graphql.GraphQLString },
      updatedAt: { type: _graphql.GraphQLString }
    };
  }
});

var definitions = (0, _graphqlRelay.connectionDefinitions)({
  name: 'File',
  nodeType: FileType,
  connectionFields: function connectionFields() {
    return {
      totalCount: {
        type: _graphql.GraphQLInt,
        resolve: function resolve(connection) {
          return connection.totalCount;
        },
        description: 'The total number of files, ignoring pagination.'
      }
    };
  }
});

var FileConnection = exports.FileConnection = definitions.connectionType;
//# sourceMappingURL=file.js.map