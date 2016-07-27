import { Types } from 'mongoose';

import {
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLFloat,
} from 'graphql';

import {
  assign,
  cloneDeep,
  map,
  omit,
} from 'lodash';

import ClassSchema from '../../schemas/class.schema';

import { FileType, FileConnection } from '../../types/file';
import { MixedType, ObjectIDType } from '../../types/common';
import { objectIdFromData } from '../../utils/graphql';

import generateClassesHelpers from './generateClassesHelpers';
import generateTypesAndConnections from './generateTypesAndConnections';
import getQueryFields from './getQueryFields';
import getMutationFields from './getMutationFields';

export class ClassesFieldsHelper {
  /** @private */
  _models = {};
  /** @private */
  _connections = {
    file: FileConnection,
  };
  /** @private */
  _types = {
    file: FileType,
  };
  /** @private */
  _classesHelpers = [];

  static RESERVED_CLASS_NAMES = [
    'File',
  ];

  static RESERVED_CLASS_PREFIX = [
    '_',
  ];

  static RESERVED_FIELDS = [
    'id',
    '_id',
    'mongoId',
    'createdAt',
    'updatedAt',
    'clientMutationId',
    'options',
    'fields',
  ];

  static RESERVED_FIELDS_PREFIX = [
    '_',
  ];

  /**
   * @param storage
   * @param classes
   */
  constructor({ storage, classes }) {
    if (!storage) {
      throw new Error('Storage is missing !');
    }
    if (!classes) {
      throw new Error('Classes are missing !');
    }
    if (!classes.definitions) {
      throw new Error('Classes definition are missing !');
    }

    this._storage = storage;
    this._classes = classes;
  }

  /**
   * Convert stringed type to GraphQL type
   * @private
   */
  static _graphQLTypeFromString(type) {
    switch (type.toLowerCase()) {
      case 'string':
        return GraphQLString;
      case 'relation':
        return ObjectIDType;
      case 'boolean':
        return GraphQLBoolean;
      case 'int':
      case 'integer':
        return GraphQLInt;
      case 'float':
      case 'number':
        return GraphQLFloat;
      case 'object':
      case 'mixed':
        return MixedType;
      default:
        return null;
    }
  }

  /**
   * Type setter
   */
  setType(typeName, type) {
    this._types[typeName] = type;
  }

  /**
   * Connection setter
   */
  setConnection(connectionName, connection) {
    this._connections[connectionName] = connection;
  }

  /**
   * Class Helper adder
   */
  addClassHelper(classHelper) {
    this._classesHelpers.push(classHelper);
  }

  /**
   * Parse a class data from mongoose, into an object for relay
   * @param result the mongodb result
   * @param className the class name
   * @returns {Object}
   * @private
   */
  _parseClassData(result, className) {
    // Get the real className (Capitalized)
    const _className = this._types[className.toLowerCase()].name;

    if (!result) {
      throw new Error(`Object "${_className}" not found`);
    }
    if (result._deleted) {
      throw new Error(`Object "${_className}" marked as removed`);
    }

    const data = cloneDeep(result.data);

    const resultWithoutData = omit(result, 'data');

    resultWithoutData.id = result._id;
    resultWithoutData.mongoId = result._id.toString();

    resultWithoutData.createdAt = result.createdAt.toISOString();
    resultWithoutData.updatedAt = result.updatedAt.toISOString();

    resultWithoutData._className = _className;

    return assign(data, resultWithoutData);
  }

  /**
   * Returns the mongoose schema of a class, for this "className"
   * @private
   */
  _getModel(className) {
    if (!this._models[className]) {
      this._models[className] = this._storage.getModel(className, ClassSchema);
    }

    return this._models[className];
  }

  /**
   * Get all the non-deleted elements of a class, but only their IDs
   * @param className
   * @param sort an optional sort object
   * @param query an optional query object
   * @private
   */
  _getAllClassData(className, { query, sort }) {
    return this._getModel(className).find({ ...query, _deleted: false }, { _id: 1 }, { lean: true, sort });
  }

  /**
   * Get an element of a class (or a file), by its ID
   * @param className
   * @param id
   * @param raw if true, will only returns class data (no id, timestamps, etc)
   * @private
   */
  _getClassDataById(className, id, { raw = false } = {}) {
    switch (className) {
      case 'file':
        return this._storage.files.getOneFileMetadataById(id);

      default:
        return this._getModel(className).findOne({ _id: new Types.ObjectId(id.toString()) }, {}, { lean: true })
          .then((classData) => {
            if (raw) {
              // We parse even if we want raw data, for error handling (we clone since we don't want it to mutate)
              this._parseClassData(cloneDeep(classData), className);
              return { ...classData.data, mongoId: classData._id };
            }
            return this._parseClassData(classData, className);
          });
    }
  }

  /**
   * Get multiple elements of a class by their IDs
   * @param className
   * @param ids
   * @private
   */
  _getManyClassDataByIds(className, ids) {
    const _ids = map(ids, (id) => new Types.ObjectId(id.toString()));

    return this._getModel(className)
      .findAsync({ _id: { $in: _ids } }, {}, { lean: true })
      .map((classData) => this._parseClassData(classData, className));
  }

  /**
   * Get an element of a class, using "query"
   * @param className
   * @param query the mongo query
   * @private
   */
  _getClassData(className, query) {
    return this._getModel(className).findOne({ ...query }, {}, { lean: true }).exec()
      .then((data) => this._parseClassData(data, className));
  }

  /**
   * Convert the `data` into a mongo ObjectId, and check if the object of the `fieldClassName` exits
   * @param fieldClassName
   * @param data
   * @returns {Promise}
   * @private
   */
  _getMongoIdFromData(fieldClassName, data) {
    const id = objectIdFromData(data);

    return this._getClassDataById(fieldClassName, id)
      .then((result) => {
        if (!result) {
          throw new Error(`There is no "${fieldClassName}" with id "${id}" !`);
        }
        return id;
      });
  }
}

/**
 * @name GraphQLFieldsGetters
 * @type Object
 * @property {function} getQueryFields
 * @property {function} getMutationFields
 *
 * Using the "classesDefinition", create two functions, one for "query", the other for "mutation"
 * @param storage
 * @param classes
 * @returns {GraphQLFieldsGetters}
 */
export default function classesFieldsGettersFactory({ storage, classes }) {
  const classesFieldsHelper = new ClassesFieldsHelper({ storage, classes });

  generateClassesHelpers(classesFieldsHelper);
  generateTypesAndConnections(classesFieldsHelper);

  return {
    getQueryFields: () => getQueryFields(classesFieldsHelper),
    getMutationFields: () => getMutationFields(classesFieldsHelper),
  };
}
