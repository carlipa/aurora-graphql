import {
  GraphQLInt,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';

import { MixedType } from './common';

// eslint-disable-next-line
export const ProjectType = new GraphQLObjectType({
  name: 'Project',
  fields: () => ({
    name: { type: GraphQLString },
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
