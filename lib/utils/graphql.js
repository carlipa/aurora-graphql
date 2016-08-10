'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.objectIdFromData = objectIdFromData;
exports.generateSchema = generateSchema;
exports.getSchemaJson = getSchemaJson;

var _mongoose = require('mongoose');

var _graphqlRelay = require('graphql-relay');

var _graphql = require('graphql');

var _utilities = require('graphql/utilities');

var _lodash = require('lodash');

/**
 * Extract an ObjectId from a data which can either be a Mongo id or a GraphQL global id
 * @returns {Types.ObjectId}
 */
function objectIdFromData(data) {
  if (_mongoose.Types.ObjectId.isValid(data.toString())) {
    return new _mongoose.Types.ObjectId(data.toString());
  }

  return new _mongoose.Types.ObjectId((0, _graphqlRelay.fromGlobalId)(data).id.toString());
}

/**
 * Merge multiple query and mutation fields getters and create a GraphQL schema
 * @param queryFieldsGetters
 * @param mutationFieldsGetters
 * @returns {{GraphQLSchema}}
 */
function generateSchema() {
  var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var _ref$queryFieldsGette = _ref.queryFieldsGetters;
  var queryFieldsGetters = _ref$queryFieldsGette === undefined ? [] : _ref$queryFieldsGette;
  var _ref$mutationFieldsGe = _ref.mutationFieldsGetters;
  var mutationFieldsGetters = _ref$mutationFieldsGe === undefined ? [] : _ref$mutationFieldsGe;

  var getFields = function getFields(getters) {
    var _getters = (0, _lodash.isArray)(getters) ? getters : [getters];
    var fields = {};
    _getters.forEach(function (fn) {
      return (0, _lodash.assignIn)(fields, fn());
    });
    return fields;
  };

  var queryFields = getFields(queryFieldsGetters);
  var mutationFields = getFields(mutationFieldsGetters);

  var queryType = new _graphql.GraphQLObjectType({
    name: 'Query',
    fields: queryFields
  });
  var mutationType = new _graphql.GraphQLObjectType({
    name: 'Mutation',
    fields: mutationFields
  });

  return new _graphql.GraphQLSchema({
    query: (0, _lodash.keys)(queryFields).length ? queryType : null,
    mutation: (0, _lodash.keys)(mutationFields).length ? mutationType : null
  });
}

function getSchemaJson(schema) {
  return (0, _graphql.graphql)(schema, _utilities.introspectionQuery);
}
//# sourceMappingURL=graphql.js.map