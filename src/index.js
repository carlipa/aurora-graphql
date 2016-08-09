import graphqlHttp from 'express-graphql';
import crypto from 'crypto';
import { compact } from 'lodash';
import { Router } from 'express';

import classFieldsGettersFactory from './factories/classes.fields.factory';
import classFileFieldsGettersFactory from './factories/classes.files.fields.factory';
import projectFieldsGettersFactory from './factories/project.fields.factory';
import { generateSchema, getSchemaJson } from './utils/graphql';

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

  static validateReq(req) {
    if (!req.aurora) {
      throw new Error('Missing Aurora object !');
    }
    if (!req.aurora.project) {
      throw new Error('Missing project data !');
    }
    if (!req.aurora.storage) {
      throw new Error('No storage database connection !');
    }
  }

  /**
   * Return the classes GraphQL schema for a specific project, will be generated if needed
   * @param project
   * @param storage
   * @private
   */
  _getClassesForProject({ project, storage }) {
    const projectHash = project.hash ||
      crypto.createHash('sha256').update(JSON.stringify(project.classes.definitions)).digest('hex');

    if (!this._projectsClasses[project._id] || this._projectsClasses[project._id].projectHash !== projectHash) {
      const graphQLSchema = GraphQLApi._getSchema({ storage, project });

      const schemaJSONPromise = getSchemaJson(graphQLSchema);

      this._projectsClasses[project._id] = {
        schema: graphQLSchema,
        getSchemaJSON: () => schemaJSONPromise,
        projectHash,
      };
    }

    return this._projectsClasses[project._id];
  }

  /**
   * Returns an express middleware of the GraphQL schema
   */
  getMiddleware() {
    const router = new Router();

    const schemaMiddleware = new Router();
    schemaMiddleware.use((req, res) => {
      // Will throw if `req` is invalid
      GraphQLApi.validateReq(req);

      this._getClassesForProject({ project: req.aurora.project, storage: req.aurora.storage })
        .getSchemaJSON()
        .then((result) => {
          res.json(result);
        });
    });

    const graphQLMiddleware = graphqlHttp((req) => {
      // Will throw if `req` is invalid
      GraphQLApi.validateReq(req);

      return {
        schema: this._getClassesForProject({ project: req.aurora.project, storage: req.aurora.storage }).schema,
        rootValue: {
          allowMutation: req.aurora.allowMutation,
        },
        graphiql: true,
      };
    });

    router.use('/schema.json', schemaMiddleware);
    router.use(graphQLMiddleware);
    return router;
  }
}
