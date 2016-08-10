'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.default = getMutationFields;

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _graphql = require('graphql');

var _graphqlRelay = require('graphql-relay');

var _lodash = require('lodash');

var _graphql2 = require('../../utils/graphql');

var _2 = require('./');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Generate a function to be used as "getMutationFields" in the schema
 * @private
 */
function getMutationFields(classesFieldsHelper, queryFields) {
  if (!(classesFieldsHelper instanceof _2.ClassesFieldsHelper)) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // return () => {
  var mutations = {};

  classesFieldsHelper._classesHelpers.forEach(function (_ref) {
    var _outputFields, _outputFields2, _outputFields3, _outputFields4, _outputFields5;

    var className = _ref.name;
    var plural = _ref.plural;
    var getFields = _ref.getFields;
    var getFieldsWithRelations = _ref.getFieldsWithRelations;

    // Pluralize the field name
    var pluralName = (0, _lodash.camelCase)(plural || className + 's');

    var lcName = className.toLowerCase();

    var createFieldName = 'create' + className;
    var createdFieldName = 'created' + className;
    var updateFieldName = 'update' + className;
    var updatedFieldName = 'updated' + className;
    var replaceFieldName = 'replace' + className;
    var replacedFieldName = 'replaced' + className;
    var removeFieldName = 'remove' + className;
    var removedFieldIdName = 'removed' + className + 'Id';
    var recoverFieldName = 'recover' + className;
    var recoveredFieldName = 'recovered' + className;

    /**
     * Given an input, parse the potential relations in it
     * (ie: replace them with the Mongo Id, and raise an error if the reference is missing)
     * @param input the GraphQL input
     * @returns {Promise}
     */
    var parseInputRelations = function parseInputRelations(input) {
      var fieldsWithRelations = getFieldsWithRelations();

      // Convert the object { key: value } to an array [key, value] (for bluebird#map)
      // We don't want the "clientMutationId", which is GraphQL specific
      var fieldsData = (0, _lodash.toPairs)((0, _lodash.omit)(input, 'clientMutationId'));

      return _bluebird2.default.map(fieldsData, function (_ref2) {
        var _ref3 = _slicedToArray(_ref2, 2);

        var fieldName = _ref3[0];
        var data = _ref3[1];

        var fieldWithRelation = (0, _lodash.find)(fieldsWithRelations, function (field) {
          return field.fieldName === fieldName;
        });

        if (fieldWithRelation) {
          if ((0, _lodash.isArray)(data)) {
            return _bluebird2.default.map(data, function (x) {
              return classesFieldsHelper._getMongoIdFromData(fieldWithRelation.className, x);
            }).then(function (ids) {
              return [fieldName, ids];
            });
          }
          return classesFieldsHelper._getMongoIdFromData(fieldWithRelation.className, data).then(function (id) {
            return [fieldName, id];
          });
        }

        return [fieldName, data];
      })
      // Convert back the array [key, value] to an object { key: value }
      .then(_lodash.fromPairs);
    };

    // Create
    mutations[createFieldName] = (0, _graphqlRelay.mutationWithClientMutationId)({
      name: createFieldName,
      inputFields: _extends({}, getFields({ resolveRelations: false })),
      outputFields: (_outputFields = {}, _defineProperty(_outputFields, createdFieldName, {
        type: classesFieldsHelper._types[lcName],
        resolve: function resolve(payload) {
          return classesFieldsHelper._getClassDataById(className, payload.mongoId);
        }
      }), _defineProperty(_outputFields, pluralName, queryFields[pluralName]), _outputFields),
      mutateAndGetPayload: function mutateAndGetPayload(input, context, _ref4) {
        var allowMutation = _ref4.rootValue.allowMutation;

        if (!allowMutation) {
          throw new Error('Usage of "' + createFieldName + '" mutation is not allowed');
        }

        return parseInputRelations(input).then(function (fields) {
          return classesFieldsHelper._getModel(className).create({
            className: [className],
            data: fields,
            _classVersion: classesFieldsHelper._classes.version
          });
        }).then(function (created) {
          return { mongoId: created.id };
        });
      }
    });

    // Update
    mutations[updateFieldName] = (0, _graphqlRelay.mutationWithClientMutationId)({
      name: updateFieldName,
      inputFields: _extends({}, getFields({ resolveRelations: false, disableNonNull: true }), {
        id: {
          type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
        }
      }),
      outputFields: (_outputFields2 = {}, _defineProperty(_outputFields2, updatedFieldName, {
        type: classesFieldsHelper._types[lcName],
        resolve: function resolve(payload) {
          return classesFieldsHelper._getClassDataById(className, payload.mongoId);
        }
      }), _defineProperty(_outputFields2, pluralName, queryFields[pluralName]), _outputFields2),
      mutateAndGetPayload: function mutateAndGetPayload(input, context, _ref5) {
        var allowMutation = _ref5.rootValue.allowMutation;

        if (!allowMutation) {
          throw new Error('Usage of "' + updateFieldName + '" mutation is not allowed');
        }

        return parseInputRelations(input)
        // Remove the id field
        .then(function (fields) {
          return (0, _lodash.omit)(fields, 'id');
        })
        // Map all data keys to add a "data" suffix
        .then(function (fields) {
          return (0, _lodash.mapKeys)(fields, function (_, key) {
            return 'data.' + key;
          });
        }).then(function (fields) {
          var _id = (0, _graphql2.objectIdFromData)(input.id);

          return classesFieldsHelper._getModel(className).update({ _id: _id }, {
            $set: _extends({}, fields, {
              _classVersion: classesFieldsHelper._classes.version
            })
          }).then(function () {
            return { mongoId: _id };
          });
        });
      }
    });

    // Replace
    mutations[replaceFieldName] = (0, _graphqlRelay.mutationWithClientMutationId)({
      name: replaceFieldName,
      inputFields: _extends({}, getFields({ resolveRelations: false, disableNonNull: false }), {
        id: {
          type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
        }
      }),
      outputFields: (_outputFields3 = {}, _defineProperty(_outputFields3, replacedFieldName, {
        type: classesFieldsHelper._types[lcName],
        resolve: function resolve(payload) {
          return classesFieldsHelper._getClassDataById(className, payload.mongoId);
        }
      }), _defineProperty(_outputFields3, pluralName, queryFields[pluralName]), _outputFields3),
      mutateAndGetPayload: function mutateAndGetPayload(input, context, _ref6) {
        var allowMutation = _ref6.rootValue.allowMutation;

        if (!allowMutation) {
          throw new Error('Usage of "' + replaceFieldName + '" mutation is not allowed');
        }

        return parseInputRelations(input)
        // Remove the id field
        .then(function (fields) {
          return (0, _lodash.omit)(fields, 'id');
        }).then(function (fields) {
          var _id = (0, _graphql2.objectIdFromData)(input.id);

          return classesFieldsHelper._getModel(className).update({ _id: _id }, {
            $set: {
              data: fields,
              _classVersion: classesFieldsHelper._classes.version
            }
          }).then(function () {
            return { mongoId: _id };
          });
        });
      }
    });

    // Remove
    mutations[removeFieldName] = (0, _graphqlRelay.mutationWithClientMutationId)({
      name: removeFieldName,
      inputFields: {
        id: {
          type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
        }
      },
      outputFields: (_outputFields4 = {}, _defineProperty(_outputFields4, removedFieldIdName, {
        type: _graphql.GraphQLString,
        resolve: function resolve(payload) {
          return payload.mongoId;
        }
      }), _defineProperty(_outputFields4, pluralName, queryFields[pluralName]), _outputFields4),
      mutateAndGetPayload: function mutateAndGetPayload(input, context, _ref7) {
        var allowMutation = _ref7.rootValue.allowMutation;

        if (!allowMutation) {
          throw new Error('Usage of "' + removeFieldName + '" mutation is not allowed');
        }

        var _id = (0, _graphql2.objectIdFromData)(input.id);

        return classesFieldsHelper._getModel(className).update({ _id: _id }, { $set: { _deleted: true } }).then(function () {
          return { mongoId: _id };
        });
      }
    });

    // Recover
    mutations[recoverFieldName] = (0, _graphqlRelay.mutationWithClientMutationId)({
      name: recoverFieldName,
      inputFields: {
        id: {
          type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
        }
      },
      outputFields: (_outputFields5 = {}, _defineProperty(_outputFields5, recoveredFieldName, {
        type: classesFieldsHelper._types[lcName],
        resolve: function resolve(payload) {
          return classesFieldsHelper._getClassDataById(className, payload.mongoId);
        }
      }), _defineProperty(_outputFields5, pluralName, queryFields[pluralName]), _outputFields5),
      mutateAndGetPayload: function mutateAndGetPayload(input, context, _ref8) {
        var allowMutation = _ref8.rootValue.allowMutation;

        if (!allowMutation) {
          throw new Error('Usage of "' + recoverFieldName + '" mutation is not allowed');
        }

        var _id = (0, _graphql2.objectIdFromData)(input.id);

        // TypeModel.update({ _id }, { $set: { _deleted: false } });
        return classesFieldsHelper._getModel(className).update({ _id: _id }, { $set: { _deleted: false } }).then(function () {
          return { mongoId: _id };
        });
      }
    });
  });

  return mutations;
  // };
}
//# sourceMappingURL=getMutationFields.js.map