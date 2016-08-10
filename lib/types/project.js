'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProjectType = undefined;

var _graphql = require('graphql');

var _common = require('./common');

// eslint-disable-next-line
var ProjectType = exports.ProjectType = new _graphql.GraphQLObjectType({
  name: 'Project',
  fields: function fields() {
    return {
      name: { type: _graphql.GraphQLString },
      hash: { type: _graphql.GraphQLString },
      classes: {
        type: new _graphql.GraphQLObjectType({
          name: 'Classes',
          fields: function fields() {
            return {
              version: { type: _graphql.GraphQLInt },
              definitions: { type: _common.MixedType }
            };
          }
        })
      }
    };
  }
});
//# sourceMappingURL=project.js.map