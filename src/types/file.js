import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
} from 'graphql';

import {
  connectionDefinitions,
  globalIdField,
} from 'graphql-relay';

export const FileType = new GraphQLObjectType({
  name: 'File',
  fields: () => ({
    id: globalIdField(),
    mongoId: { type: new GraphQLNonNull(GraphQLString) },
    filename: { type: GraphQLString },
    contentType: { type: GraphQLString },
    length: { type: GraphQLInt },
    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString },
  }),
});

const definitions = connectionDefinitions({
  name: 'File',
  nodeType: FileType,
  connectionFields: () => ({
    totalCount: {
      type: GraphQLInt,
      resolve: (connection) => connection.totalCount,
      description: 'The total number of files, ignoring pagination.',
    },
  }),
});

export const FileConnection = definitions.connectionType;
