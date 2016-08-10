'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = generateClassesHelpers;

var _graphql = require('graphql');

var _graphqlRelay = require('graphql-relay');

var _lodash = require('lodash');

var _ = require('./');

/**
 * For each class, generate an object that contains information and methods for GraphQL
 * @private
 */
function generateClassesHelpers(classesFieldsHelper) {
  if (!(classesFieldsHelper instanceof _.ClassesFieldsHelper)) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  var classesNames = (0, _lodash.keys)(classesFieldsHelper._classes.definitions).map(function (x) {
    return x.toLowerCase();
  });

  (0, _lodash.each)(classesNames, function (className) {
    (0, _lodash.each)(_.ClassesFieldsHelper.RESERVED_CLASS_PREFIX, function (prefix) {
      if ((0, _lodash.startsWith)(className.toLowerCase(), prefix.toLowerCase())) {
        throw new Error('Parse error: Cannot use reserved prefix "' + prefix + '" in "' + className + '"');
      }
    });

    if (_.ClassesFieldsHelper.RESERVED_CLASS_NAMES.map(function (x) {
      return x.toLowerCase();
    }).indexOf(className.toLowerCase()) !== -1) {
      throw new Error('Parse error: Cannot use reserved class name "' + className + '"');
    }
  });

  // Add the special "file" className
  classesNames.push('file');

  (0, _lodash.each)(classesFieldsHelper._classes.definitions, function (classDefinition, className) {
    var fieldsDefinitions = classDefinition.fields;
    var options = classDefinition.options;

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
    var getFields = function getFields() {
      var _ref2 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var _ref2$resolveRelation = _ref2.resolveRelations;
      var resolveRelations = _ref2$resolveRelation === undefined ? true : _ref2$resolveRelation;
      var _ref2$disableNonNull = _ref2.disableNonNull;
      var disableNonNull = _ref2$disableNonNull === undefined ? false : _ref2$disableNonNull;

      var fields = {};

      (0, _lodash.each)(fieldsDefinitions, function (field, fieldName) {
        var _fieldName = (0, _lodash.camelCase)(fieldName);
        if (_.ClassesFieldsHelper.RESERVED_FIELDS.indexOf(_fieldName) !== -1) {
          throw new Error('Parse error: Cannot use reserved field "' + fieldName + '"');
        }
        (0, _lodash.each)(_.ClassesFieldsHelper.RESERVED_FIELDS_PREFIX, function (prefix) {
          if ((0, _lodash.startsWith)(_fieldName.toLowerCase(), prefix.toLowerCase())) {
            throw new Error('Parse error: Cannot use reserved prefix "' + prefix + '" in field "' + _fieldName + '"');
          }
        });

        // Fields
        if ((0, _lodash.isArray)(field)) {
          // If array
          if (field.length !== 1) {
            throw new Error('Parse error: Array must have a length of 1');
          }
          // You can use the object form, or directly enter the type
          var fieldArrayData = typeof field[0] === 'string' ? { type: field[0] } : field[0];
          // If array of relation
          if (fieldArrayData.type.toLowerCase() === 'relation') {
            (function () {
              if (!fieldArrayData.ref) {
                throw new Error('Parse error: "relation" needs a "ref"');
              }

              var _ref = fieldArrayData.ref.toLowerCase();
              if (classesNames.indexOf(_ref) === -1) {
                throw new Error('Parse error: Found a reference to missing class "' + _ref + '"');
              }

              if (resolveRelations) {
                fields[_fieldName] = {
                  type: classesFieldsHelper._connections[_ref],
                  args: _graphqlRelay.connectionArgs,
                  resolve: function resolve(fieldsList, args) {
                    return (0, _graphqlRelay.connectionFromArray)((0, _lodash.map)(fieldsList[_fieldName], function (id) {
                      return classesFieldsHelper._getClassDataById(_ref, id);
                    }), args);
                  }
                };
              } else {
                fields[_fieldName] = {
                  type: new _graphql.GraphQLList(_graphql.GraphQLID)
                };
              }
            })();
          } else if (fieldArrayData.type) {
            fields[_fieldName] = {
              type: new _graphql.GraphQLList(_.ClassesFieldsHelper._graphQLTypeFromString(fieldArrayData.type))
            };
          } else {
            throw new Error('Parse error: cannot parse field ' + fieldName + ' in ' + className);
          }
        } else {
          // You can use the object form, or directly enter the type
          var _field = typeof field === 'string' ? { type: field } : field;

          // If leaf
          if (_field.type.toLowerCase() === 'relation') {
            (function () {
              // If relation
              if (!field.ref) {
                throw new Error('Parse error: "relation" needs a "ref"');
              }

              var _ref = _field.ref.toLowerCase();
              if (classesNames.indexOf(_ref) === -1) {
                throw new Error('Parse error: Found a reference to missing class "' + _ref + '"');
              }

              if (resolveRelations) {
                fields[_fieldName] = {
                  type: _field.required && !disableNonNull ? new _graphql.GraphQLNonNull(classesFieldsHelper._types[_ref]) : classesFieldsHelper._types[_ref],
                  resolve: function resolve(fieldsList) {
                    return classesFieldsHelper._getClassDataById(_ref, fieldsList[_fieldName]);
                  }
                };
              } else {
                fields[_fieldName] = {
                  type: _field.required && !disableNonNull ? new _graphql.GraphQLNonNull(_graphql.GraphQLID) : _graphql.GraphQLID
                };
              }
            })();
          } else if (_field.type) {
            fields[_fieldName] = {
              type: _field.required && !disableNonNull ? new _graphql.GraphQLNonNull(_.ClassesFieldsHelper._graphQLTypeFromString(_field.type)) : _.ClassesFieldsHelper._graphQLTypeFromString(_field.type)
            };
          } else {
            throw new Error('Parse error: cannot parse field ' + fieldName + ' in ' + className);
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
    var getFieldsWithRelations = function getFieldsWithRelations() {
      return (0, _lodash.compact)((0, _lodash.map)(fieldsDefinitions, function (field, fieldName) {
        if ((0, _lodash.isArray)(field) && field.length) {
          // You can use the object form, or directly enter the type
          var fieldArrayData = typeof field[0] === 'string' ? { type: field[0] } : field[0];

          if (fieldArrayData.type.toLowerCase() === 'relation') {
            return {
              fieldName: (0, _lodash.camelCase)(fieldName),
              className: fieldArrayData.ref
            };
          }
        } else if (field.type && field.type.toLowerCase() === 'relation') {
          return {
            fieldName: (0, _lodash.camelCase)(fieldName),
            className: field.ref
          };
        }
        return null;
      }));
    };

    /**
     * Returns an array which contains the name of the field that are not arrays nor relation
     */
    var getSortableFieldsName = function getSortableFieldsName() {
      return (0, _lodash.compact)((0, _lodash.map)(fieldsDefinitions, function (field, fieldName) {
        if ((0, _lodash.isArray)(field) || field.type && field.type.toLowerCase() === 'relation') {
          return null;
        }
        return (0, _lodash.camelCase)(fieldName);
      }));
    };

    /**
     * Returns a collection which contains the field that are not arrays
     */
    var getFilterableFields = function getFilterableFields() {
      return (0, _lodash.pickBy)(fieldsDefinitions, function (field) {
        return !(0, _lodash.isArray)(field);
      });
    };

    classesFieldsHelper.addClassHelper({
      name: (0, _lodash.upperFirst)(className),
      plural: options && options.plural,
      getFields: getFields,
      getFieldsWithRelations: getFieldsWithRelations,
      getSortableFieldsName: getSortableFieldsName,
      getFilterableFields: getFilterableFields
    });
  });
}
//# sourceMappingURL=generateClassesHelpers.js.map