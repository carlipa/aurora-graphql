import { ProjectType } from '../types/project';

export class ProjectFields {
  _project;

  /**
   * @param project
   */
  constructor({ project }) {
    if (!project) {
      throw new Error('Project data are missing !');
    }

    this._project = project;
  }

  getMutationFields() {
    return {};
  }

  getQueryFields() {
    const getProject = {
      name: 'Project',
      type: ProjectType,
      resolve: () => ({
        ...this._project,
        mongoId: this._project._id,
      }),
    };

    return {
      _project: getProject,
    };
  }

  getFieldsGetters() {
    return {
      getQueryFields: () => this.getQueryFields(),
      getMutationFields: () => this.getMutationFields(),
    };
  }
}
/**
 * @name GraphQLFieldsGetters
 * @type Object
 * @property {function} getQueryFields
 * @property {function} getMutationFields
 *
 * Create two functions, one for "query", the other for "mutation"
 * @param project
 * @returns {GraphQLFieldsGetters}
 */
export default function classesFilesFieldsGettersFactory({ project }) {
  const classFilesFieldsFactory = new ProjectFields({ project });
  return classFilesFieldsFactory.getFieldsGetters();
}
