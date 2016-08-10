'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = generateTypesAndConnections;

var _graphql = require('graphql');

var _graphqlRelay = require('graphql-relay');

var _ = require('./');

/**
 * Populate the "factory._types" and "factory._connections" object
 * @private
 */
function generateTypesAndConnections(classesFieldsHelper) {
  if (!(classesFieldsHelper instanceof _.ClassesFieldsHelper)) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // Create the nodeInterface and nodeField

  var _nodeDefinitions = (0, _graphqlRelay.nodeDefinitions)(function (globalId) {
    var _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(globalId);

    var type = _fromGlobalId.type;
    var id = _fromGlobalId.id;

    return classesFieldsHelper._getClassDataById(type, id);
  }, function (obj) {
    return classesFieldsHelper._types[obj._className.toLowerCase()];
  });

  var nodeInterface = _nodeDefinitions.nodeInterface;

  // For each classes, create its type, and add its connection to the connections list

  classesFieldsHelper._classesHelpers.forEach(function (_ref) {
    var className = _ref.name;
    var getFields = _ref.getFields;

    var lcClassName = className.toLowerCase();

    classesFieldsHelper.setType(lcClassName, new _graphql.GraphQLObjectType({
      name: className,
      description: 'A ' + className,
      fields: function fields() {
        return _extends({}, getFields({ disableNonNull: true }), {
          id: (0, _graphqlRelay.globalIdField)(className),
          mongoId: {
            type: _graphql.GraphQLString
          },
          createdAt: {
            type: _graphql.GraphQLString
          },
          updatedAt: {
            type: _graphql.GraphQLString
          },
          _className: {
            type: new _graphql.GraphQLNonNull(_graphql.GraphQLString)
          },
          _classVersion: {
            type: new _graphql.GraphQLNonNull(_graphql.GraphQLInt)
          }
        });
      },
      interfaces: [nodeInterface]
    }));

    /**
     * The connection definition for this class
     * @prop connectionType the graphQl type for the connection
     */
    var definitions = (0, _graphqlRelay.connectionDefinitions)({
      name: className,
      nodeType: classesFieldsHelper._types[lcClassName],
      connectionFields: function connectionFields() {
        return {
          totalCount: {
            type: _graphql.GraphQLInt,
            resolve: function resolve(connection) {
              return connection.totalCount || 0;
            },
            description: 'A count of the total number of objects in this connection, ignoring pagination.'
          }
        };
      }
    });
    classesFieldsHelper.setConnection(lcClassName, definitions.connectionType);
  });
}
//# sourceMappingURL=generateTypesAndConnections.js.map