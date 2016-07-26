import {
  GraphQLInt,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';

import {
  globalIdField,
} from 'graphql-relay';

import { MixedType } from './common';

// eslint-disable-next-line
export const ProjectType = new GraphQLObjectType({
  name: 'Project',
  fields: () => ({
    id: globalIdField(),
    mongoId: { type: GraphQLString },
    name: { type: GraphQLString },
    shortName: { type: GraphQLString },
    uniqueName: { type: GraphQLString },
    hash: { type: GraphQLString },
    classes: {
      type: new GraphQLObjectType({
        name: 'Classes',
        fields: () => ({
          version: { type: GraphQLInt },
          definitions: { type: MixedType },
        }),
      }),
    },
  }),
});
