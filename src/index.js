import graphqlHttp from 'express-graphql';
import crypto from 'crypto';
import { compact } from 'lodash';

import classFieldsGettersFactory from './factories/classes.fields.factory';
import classFileFieldsGettersFactory from './factories/classes.files.fields.factory';
import projectFieldsGettersFactory from './factories/project.fields.factory';
import { generateSchema } from './utils/graphql';

export default class GraphQLApi {
  _projectsClasses = {};

  /**
   * Generate the GraphQl schema
   * @param storage
   * @param project
   * @private
   */
  static _getSchema({ storage, project }) {
    const {
      getQueryFields: getClassesQueryFields,
      getMutationFields: getClassesMutationFields,
    } = project.classes ? classFieldsGettersFactory({ storage, classes: project.classes }) : {};

    const {
      getQueryFields: getFilesQueryFields,
      getMutationFields: getFilesMutationFields,
    } = classFileFieldsGettersFactory({ storage });

    const {
      getQueryFields: getProjectQueryFields,
      getMutationFields: getProjectMutationFields,
    } = projectFieldsGettersFactory({ project });

    return generateSchema({
      queryFieldsGetters: compact([
        getClassesQueryFields,
        getFilesQueryFields,
        getProjectQueryFields,
      ]),
      mutationFieldsGetters: compact([
        getClassesMutationFields,
        getFilesMutationFields,
        getProjectMutationFields,
      ]),
    });
  }

  /**
   * Return the schema for a specific project, will be generated if needed
   * @param project
   * @param storage
   * @private
   */
  _getSchemaForProject({ project, storage }) {
    const projectHash = project.hash ||
      crypto.createHash('sha256').update(JSON.stringify(project.classes.definitions)).digest('hex');

    if (!this._projectsClasses[project._id] || this._projectsClasses[project._id].projectHash !== projectHash) {
      this._projectsClasses[project._id] = {
        schema: GraphQLApi._getSchema({ storage, project }),
        projectHash,
      };
    }

    return this._projectsClasses[project._id].schema;
  }

  /**
   * Returns an express middleware of the GraphQL schema
   */
  getMiddleware() {
    return graphqlHttp((req) => {
      if (!req.aurora) {
        throw new Error('Missing Aurora object !');
      }
      if (!req.aurora.project) {
        throw new Error('Missing project data !');
      }
      if (!req.aurora.storage) {
        throw new Error('No storage database connection !');
      }

      return {
        schema: this._getSchemaForProject({ project: req.aurora.project, storage: req.aurora.storage }),
        rootValue: {
          allowMutation: req.aurora.allowMutation,
        },
        graphiql: true,
      };
    });
  }
}
