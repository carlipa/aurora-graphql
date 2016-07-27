import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
} from 'graphql';

import {
  connectionDefinitions,
  fromGlobalId,
  globalIdField,
  nodeDefinitions,
} from 'graphql-relay';

import { ClassesFieldsHelper } from './';

/**
 * Populate the "factory._types" and "factory._connections" object
 * @private
 */
export default function generateTypesAndConnections(classesFieldsHelper) {
  if (!classesFieldsHelper instanceof ClassesFieldsHelper) {
    throw new Error('`classesFieldsHelper` must be an instance `ClassesFieldsHelper`');
  }

  // Create the nodeInterface and nodeField
  const { nodeInterface } = nodeDefinitions(
    (globalId) => {
      const { type, id } = fromGlobalId(globalId);
      return classesFieldsHelper._getClassDataById(type, id);
    },
    (obj) => classesFieldsHelper._types[obj._className.toLowerCase()]
  );

  // For each classes, create its type, and add its connection to the connections list
  classesFieldsHelper._classesHelpers.forEach(({ name: className, getFields }) => {
    const lcClassName = className.toLowerCase();

    classesFieldsHelper.setType(lcClassName, new GraphQLObjectType({
      name: className,
      description: `A ${className}`,
      fields: () => ({
        ...getFields({ disableNonNull: true }),
        id: globalIdField(className),
        mongoId: {
          type: GraphQLString,
        },
        createdAt: {
          type: GraphQLString,
        },
        updatedAt: {
          type: GraphQLString,
        },
        _className: {
          type: new GraphQLNonNull(GraphQLString),
        },
        _classVersion: {
          type: new GraphQLNonNull(GraphQLInt),
        },
      }),
      interfaces: [nodeInterface],
    }));

    /**
     * The connection definition for this class
     * @prop connectionType the graphQl type for the connection
     */
    const definitions = connectionDefinitions({
      name: className,
      nodeType: classesFieldsHelper._types[lcClassName],
      connectionFields: () => ({
        totalCount: {
          type: GraphQLInt,
          resolve: (connection) => connection.totalCount || 0,
          description: 'A count of the total number of objects in this connection, ignoring pagination.',
        },
      }),
    });
    classesFieldsHelper.setConnection(lcClassName, definitions.connectionType);
  });
}
