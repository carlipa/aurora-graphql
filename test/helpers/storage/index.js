/**
 * This is a example of a storage middleware to be used with Aurora GraphQL.
 * The file creation/download/removal part is not implemented, since it is not required for the tests.
 */

import Promise from 'bluebird';
import url from 'url';
import mongoose from 'mongoose';
import gridfs from 'gridfs-stream';
import { find } from 'lodash';

import { parseFileData } from './utils/file';

Promise.promisifyAll(mongoose);
mongoose.Promise = Promise;

export default class AuroraStorage {
  _mongooseConnections = [];

  constructor(options = {}) {
    this._options = options;
  }

  static _getFilesMethods(gfs) {
    function getOneFileMetadataById(id) {
      return gfs
        .findOneAsync({ _id: id })
        .then(parseFileData);
    }

    function getManyFileMetadataByIds(fileIds) {
      return Promise
        .fromNode((callback) => {
          gfs.files.find({ _id: { $in: fileIds } }).toArray(callback);
        })
        .map(parseFileData);
    }

    return { getOneFileMetadataById, getManyFileMetadataByIds };
  }

  /**
   * Method that handle the lazy creation of a storage object, which use mongoose to store the project data
   * @param project the project
   * @returns {Promise} a promise of the db object
   */
  getStorage(project) {
    return Promise.resolve()
      .then(() => {
        if (!project) {
          throw new Error('"project" must be set');
        }
      })
      // Lazy connection
      .then(() => {
        let connection = find(this._mongooseConnections, (mConn) => {
          return mConn.projectId === project._id;
        });
        // If the connection already exists
        if (connection) {
          return connection;
        }
        // If the connection does not exists, create it first
        let databaseName = `project_${project.uniqueName}`;
        // If test
        if (process.env.NODE_ENV === 'test') {
          databaseName += '_test';
        }
        // If not, create a new one
        const mongodbUri = url.format({
          protocol: 'mongodb',
          slashes: true,
          hostname: this._options.mongoHost || process.env.MONGO_HOST || 'localhost',
          port: this._options.mongoPort || process.env.MONGO_PORT || '27017',
          pathname: databaseName,
        });

        const mongoConnection = mongoose.createConnection(mongodbUri);

        connection = {
          mongoConnection,
          databaseName,
          projectId: project._id,
        };
        // Add to connections array
        this._mongooseConnections.push(connection);

        return new Promise((resolve, reject) => {
          // GridFS needs a connected mongo
          mongoConnection.once('connected', () => {
            // Gridfs
            const gfs = gridfs(mongoConnection.db, mongoose.mongo);
            Promise.promisifyAll(gfs);
            Promise.promisifyAll(gfs.files);
            connection.gfs = gfs;
            // Next
            resolve(connection);
          });
          mongoConnection.once('err', reject);
        });
      })
      .then((connection) => {
        return {
          gfs: connection.gfs,
          getModel: (modelName, schema) => connection.mongoConnection.model(modelName, schema),
          files: AuroraStorage._getFilesMethods(connection.gfs),
        };
      });
  }

  /**
   * Returns an express middleware that bind `storage` to `req.aurora`
   */
  getMiddleware() {
    return (req, res, next) => {
      return this.getStorage(req.aurora ? req.aurora.project : null)
        .then((storage) => {
          // eslint-disable-next-line no-param-reassign
          req.aurora = { ...req.aurora, storage };
          next();
        })
        .catch(next);
    };
  }
}
