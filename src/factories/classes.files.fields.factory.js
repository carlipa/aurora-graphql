import fs from 'fs';
import Promise from 'bluebird';

import {
  GraphQLID,
  GraphQLNonNull,
} from 'graphql';

import { FileType } from '../types/file';
import { objectIdFromData } from '../utils/graphql';

Promise.promisifyAll(fs);

export class FileFields {
  /**
   * @param storage
   */
  constructor({ storage }) {
    if (!storage) {
      throw new Error('Storage is missing !');
    }

    this._storage = storage;
  }

  getMutationFields() {
    return {};
  }

  getQueryFields() {
    const getOneFile = {
      name: 'file',
      type: FileType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_, args) => this._storage.files.getOneFileMetadataById(objectIdFromData(args.id)),
    };

    return {
      file: getOneFile,
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
 * @param storage
 * @returns {GraphQLFieldsGetters}
 */
export default function classesFilesFieldsGettersFactory({ storage }) {
  const classFilesFieldsFactory = new FileFields({ storage });
  return classFilesFieldsFactory.getFieldsGetters();
}
