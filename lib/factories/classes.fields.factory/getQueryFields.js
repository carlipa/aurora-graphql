'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = getQueryFields;

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _graphql = require('graphql');

var _graphqlRelay = require('graphql-relay');

var _lodash = require('lodash');

var _common = require('../../types/common');

var _graphql2 = require('../../utils/graphql');

var _2 = require('./');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Generate a function to be used as "getQueryFields" in the schema
 * @private
 */
function getQueryFields(classesFieldsHelper) {
  if (!(classesFieldsHelper instanceof _2.ClassesFieldsHelper)) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // return () => {
  var queries = {};

  classesFieldsHelper._classesHelpers.forEach(function (_ref) {
    var className = _ref.name;
    var plural = _ref.plural;
    var getFields = _ref.getFields;
    var getSortableFieldsName = _ref.getSortableFieldsName;
    var getFilterableFields = _ref.getFilterableFields;

    // Pluralize the field name
    var pluralName = (0, _lodash.camelCase)(plural || className + 's');

    if (pluralName === (0, _lodash.camelCase)(className)) {
      throw new Error('Cannot create fields for ' + className + ', queries for one and multiple have the same name !');
    }

    /**
     * Given a field name, return an object for the orderBy argument
     * @param fieldName the field name
     * @param inData if true, will add "data." to the field name (default: false)
     * @returns {{}}
     */
    var getOrderByEntries = function getOrderByEntries(fieldName) {
      var _ref2;

      var inData = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      var asc = (0, _lodash.toUpper)((0, _lodash.snakeCase)(fieldName + 'Asc'));
      var desc = (0, _lodash.toUpper)((0, _lodash.snakeCase)(fieldName + 'Desc'));

      var _fieldName = inData ? 'data.' + fieldName : fieldName;

      return _ref2 = {}, _defineProperty(_ref2, asc, { value: _defineProperty({}, _fieldName, 1) }), _defineProperty(_ref2, desc, { value: _defineProperty({}, _fieldName, -1) }), _ref2;
    };

    // Create the orderBy values, using "createdAt", "updatedAt" and the class sortable fields
    var orderByEnumValues = _extends({}, getOrderByEntries('createdAt'), getOrderByEntries('updatedAt'));
    (0, _lodash.map)(getSortableFieldsName(), function (fieldName) {
      return getOrderByEntries(fieldName, true);
    }).forEach(function (idxValues) {
      orderByEnumValues = _extends({}, orderByEnumValues, idxValues);
    });
    var orderByType = new _graphql.GraphQLEnumType({
      name: 'order' + (0, _lodash.upperFirst)(pluralName) + 'By',
      values: orderByEnumValues
    });

    // Create the filters type
    var filtersFields = {};
    var namePrefix = 'filter' + (0, _lodash.upperFirst)(pluralName) + 'With';

    (0, _lodash.map)(getFilterableFields(), function (field, fieldName) {
      var fieldType = _2.ClassesFieldsHelper._graphQLTypeFromString(field.type ? field.type : field);

      var nameWithFieldName = '' + namePrefix + (0, _lodash.upperFirst)(fieldName);

      switch (fieldType) {
        case _graphql.GraphQLBoolean:
          filtersFields[fieldName] = {
            type: new _graphql.GraphQLInputObjectType({
              name: nameWithFieldName + 'Boolean',
              fields: {
                eq: { type: _graphql.GraphQLBoolean }
              }
            })
          };
          break;

        case _common.ObjectIDType:
          filtersFields[fieldName] = {
            type: new _graphql.GraphQLInputObjectType({
              name: nameWithFieldName + 'ObjectID',
              fields: {
                in: { type: new _graphql.GraphQLList(_common.ObjectIDType) },
                eq: { type: _common.ObjectIDType }
              }
            })
          };
          break;

        case _graphql.GraphQLString:
          filtersFields[fieldName] = {
            type: new _graphql.GraphQLInputObjectType({
              name: nameWithFieldName + 'String',
              fields: {
                in: { type: new _graphql.GraphQLList(_graphql.GraphQLString) },
                eq: { type: _graphql.GraphQLString },
                regexp: { type: _graphql.GraphQLString }
              }
            })
          };
          break;

        case _graphql.GraphQLInt:
        case _graphql.GraphQLFloat:
          filtersFields[fieldName] = {
            type: new _graphql.GraphQLInputObjectType({
              name: nameWithFieldName + 'Number',
              fields: {
                in: { type: new _graphql.GraphQLList(_graphql.GraphQLFloat) },
                eq: { type: _graphql.GraphQLFloat },
                gt: { type: _graphql.GraphQLFloat },
                gte: { type: _graphql.GraphQLFloat },
                lt: { type: _graphql.GraphQLFloat },
                lte: { type: _graphql.GraphQLFloat }
              }
            })
          };
          break;

        default:
          // Nothing
          break;
      }
    });

    var filtersType = new _graphql.GraphQLInputObjectType({
      name: '' + namePrefix,
      fields: filtersFields
    });

    // If the class doesn't have any filter, using `{}` as `filters` field would throw an error
    // This little hack prevents it
    var filtersHolder = !(0, _lodash.keys)(filtersFields).length ? {} : {
      filters: {
        type: filtersType
      }
    };

    // lowerCaseName
    var lcName = className.toLowerCase();

    // All
    queries[pluralName] = {
      type: classesFieldsHelper._connections[lcName],
      args: _extends({}, _graphqlRelay.connectionArgs, filtersHolder, { // Here we destructure our potentially empty object
        orderBy: {
          type: new _graphql.GraphQLList(orderByType)
        }
      }),
      resolve: function resolve(_, args) {
        // Create query
        var query = {};
        (0, _lodash.each)(args.filters, function (filter, fieldName) {
          var safeFilter = (0, _lodash.cloneDeep)(filter);

          // RegExp process
          if (safeFilter.regexp) {
            var matchedRegexp = safeFilter.regexp.match(/\/(.*)\/(\w*)/);

            if (!matchedRegexp) {
              throw new Error('Invalid RegExp at ' + className + '/' + fieldName);
            }

            var motif = matchedRegexp[1];
            var flags = matchedRegexp[2];

            delete safeFilter.regexp;
            safeFilter.eq = new RegExp(motif, flags);
          }

          // If we explicitly demand a field, the `in` property is ignored
          // We use `in` on an array[1], since mongoose doesn't use `$eq` queries
          if (!(0, _lodash.isUndefined)(safeFilter.eq)) {
            safeFilter.in = [safeFilter.eq];

            // If the filter is a boolean one, "false" is the same as "undefined"
            // (since default boolean value is undefined)
            if (safeFilter.eq === false) {
              safeFilter.in.push(undefined);
            }

            delete safeFilter.eq;
          }

          query['data.' + fieldName] = (0, _lodash.mapKeys)(safeFilter, function (value, key) {
            return '$' + key;
          });
        });

        // Merge orderBy's
        var sort = (0, _lodash.reduce)(args.orderBy, function (soFar, value) {
          return Object.assign(soFar, value);
        }, {});

        // Get all the data (ids only), using the optional sort
        var getDataPromise = classesFieldsHelper._getAllClassData(className, { query: query, sort: sort });
        // Apply "connectionFromPromisedArray" to the result, which will filter the results
        return (0, _graphqlRelay.connectionFromPromisedArray)(getDataPromise, args).then(function (result) {
          // Then, we query the real data
          var classesIds = (0, _lodash.map)(result.edges, function (edge) {
            return edge.node._id;
          });
          var edgesPromise = classesFieldsHelper._getManyClassDataByIds(className, classesIds).then(function (results) {
            return (0, _lodash.map)(result.edges, function (edge) {
              return _extends({}, edge, {
                node: (0, _lodash.find)(results, { mongoId: edge.node._id.toString() })
              });
            });
          });

          // Total count
          var countPromise = getDataPromise.then(function (results) {
            return results.length;
          });

          return _bluebird2.default.props({ edges: edgesPromise, totalCount: countPromise }).then(function (_ref3) {
            var edges = _ref3.edges;
            var totalCount = _ref3.totalCount;
            return _extends({}, result, {
              edges: edges,
              totalCount: totalCount
            });
          });
        });
      }
    };

    // One
    queries[(0, _lodash.camelCase)(className)] = {
      type: classesFieldsHelper._types[lcName],
      args: _extends({}, getFields({ resolveRelations: false, disableNonNull: true }), {
        id: {
          type: _graphql.GraphQLID
        }
      }),
      resolve: function resolve(_, args) {
        var mongoId = args.id ? (0, _graphql2.objectIdFromData)(args.id) : null;

        function parseValue(value) {
          try {
            return (0, _graphql2.objectIdFromData)(value);
          } catch (err) {
            return value;
          }
        }

        if (mongoId) {
          return classesFieldsHelper._getClassDataById(className, mongoId);
        }
        // Map both keys and values
        var query = (0, _lodash.fromPairs)((0, _lodash.map)((0, _lodash.toPairs)(args), function (_ref4) {
          var _ref5 = _slicedToArray(_ref4, 2);

          var key = _ref5[0];
          var value = _ref5[1];

          if ((0, _lodash.isArray)(value)) {
            return ['data.' + key, (0, _lodash.map)(value, parseValue)];
          }

          return ['data.' + key, parseValue(value)];
        }));

        return classesFieldsHelper._getClassData(className, query);
      }
    };

    // One Raw
    queries[(0, _lodash.camelCase)(className) + 'Raw'] = {
      type: _common.MixedType,
      description: 'Returns a pure javascript object of "' + className + '", as it is stored in the database,\n          without any GraphQL parsing. Useful for version upgrade',
      args: {
        id: {
          type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
        }
      },
      resolve: function resolve(_, args) {
        var mongoId = args.id ? (0, _graphql2.objectIdFromData)(args.id) : null;
        return classesFieldsHelper._getClassDataById(className, mongoId, { raw: true });
      }
    };
  });

  return queries;
  // };
}
//# sourceMappingURL=getQueryFields.js.map