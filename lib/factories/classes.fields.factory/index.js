'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ClassesFieldsHelper = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = classesFieldsGettersFactory;

var _mongoose = require('mongoose');

var _graphql = require('graphql');

var _lodash = require('lodash');

var _class = require('../../schemas/class.schema');

var _class2 = _interopRequireDefault(_class);

var _file = require('../../types/file');

var _common = require('../../types/common');

var _graphql2 = require('../../utils/graphql');

var _generateClassesHelpers = require('./generateClassesHelpers');

var _generateClassesHelpers2 = _interopRequireDefault(_generateClassesHelpers);

var _generateTypesAndConnections = require('./generateTypesAndConnections');

var _generateTypesAndConnections2 = _interopRequireDefault(_generateTypesAndConnections);

var _getQueryFields = require('./getQueryFields');

var _getQueryFields2 = _interopRequireDefault(_getQueryFields);

var _getMutationFields = require('./getMutationFields');

var _getMutationFields2 = _interopRequireDefault(_getMutationFields);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ClassesFieldsHelper = exports.ClassesFieldsHelper = function () {

  /**
   * @param storage
   * @param classes
   */

  /** @private */

  /** @private */
  function ClassesFieldsHelper(_ref) {
    var storage = _ref.storage;
    var classes = _ref.classes;

    _classCallCheck(this, ClassesFieldsHelper);

    this._models = {};
    this._connections = {
      file: _file.FileConnection
    };
    this._types = {
      file: _file.FileType
    };
    this._classesHelpers = [];

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

  /** @private */

  /** @private */


  _createClass(ClassesFieldsHelper, [{
    key: 'setType',


    /**
     * Type setter
     */
    value: function setType(typeName, type) {
      this._types[typeName] = type;
    }

    /**
     * Connection setter
     */

  }, {
    key: 'setConnection',
    value: function setConnection(connectionName, connection) {
      this._connections[connectionName] = connection;
    }

    /**
     * Class Helper adder
     */

  }, {
    key: 'addClassHelper',
    value: function addClassHelper(classHelper) {
      this._classesHelpers.push(classHelper);
    }

    /**
     * Parse a class data from mongoose, into an object for relay
     * @param result the mongodb result
     * @param className the class name
     * @returns {Object}
     * @private
     */

  }, {
    key: '_parseClassData',
    value: function _parseClassData(result, className) {
      // Get the real className (Capitalized)
      var _className = this._types[className.toLowerCase()].name;

      if (!result) {
        throw new Error('Object "' + _className + '" not found');
      }
      if (result._deleted) {
        throw new Error('Object "' + _className + '" marked as removed');
      }

      var data = (0, _lodash.cloneDeep)(result.data);

      var resultWithoutData = (0, _lodash.omit)(result, 'data');

      resultWithoutData.id = result._id;
      resultWithoutData.mongoId = result._id.toString();

      resultWithoutData.createdAt = result.createdAt.toISOString();
      resultWithoutData.updatedAt = result.updatedAt.toISOString();

      resultWithoutData._className = _className;

      return (0, _lodash.assign)(data, resultWithoutData);
    }

    /**
     * Returns the mongoose schema of a class, for this "className"
     * @private
     */

  }, {
    key: '_getModel',
    value: function _getModel(className) {
      if (!this._models[className]) {
        this._models[className] = this._storage.getModel(className, _class2.default);
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

  }, {
    key: '_getAllClassData',
    value: function _getAllClassData(className, _ref2) {
      var query = _ref2.query;
      var sort = _ref2.sort;

      return this._getModel(className).find(_extends({}, query, { _deleted: false }), { _id: 1 }, { lean: true, sort: sort });
    }

    /**
     * Get an element of a class (or a file), by its ID
     * @param className
     * @param id
     * @param raw if true, will only returns class data (no id, timestamps, etc)
     * @private
     */

  }, {
    key: '_getClassDataById',
    value: function _getClassDataById(className, id) {
      var _this = this;

      var _ref3 = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var _ref3$raw = _ref3.raw;
      var raw = _ref3$raw === undefined ? false : _ref3$raw;

      switch (className) {
        case 'file':
          return this._storage.files.getOneFileMetadataById(id);

        default:
          return this._getModel(className).findOne({ _id: new _mongoose.Types.ObjectId(id.toString()) }, {}, { lean: true }).then(function (classData) {
            if (raw) {
              // We parse even if we want raw data, for error handling (we clone since we don't want it to mutate)
              _this._parseClassData((0, _lodash.cloneDeep)(classData), className);
              return _extends({}, classData.data, { mongoId: classData._id });
            }
            return _this._parseClassData(classData, className);
          });
      }
    }

    /**
     * Get multiple elements of a class by their IDs
     * @param className
     * @param ids
     * @private
     */

  }, {
    key: '_getManyClassDataByIds',
    value: function _getManyClassDataByIds(className, ids) {
      var _this2 = this;

      var _ids = (0, _lodash.map)(ids, function (id) {
        return new _mongoose.Types.ObjectId(id.toString());
      });

      return this._getModel(className).findAsync({ _id: { $in: _ids } }, {}, { lean: true }).map(function (classData) {
        return _this2._parseClassData(classData, className);
      });
    }

    /**
     * Get an element of a class, using "query"
     * @param className
     * @param query the mongo query
     * @private
     */

  }, {
    key: '_getClassData',
    value: function _getClassData(className, query) {
      var _this3 = this;

      return this._getModel(className).findOne(_extends({}, query), {}, { lean: true }).exec().then(function (data) {
        return _this3._parseClassData(data, className);
      });
    }

    /**
     * Convert the `data` into a mongo ObjectId, and check if the object of the `fieldClassName` exits
     * @param fieldClassName
     * @param data
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_getMongoIdFromData',
    value: function _getMongoIdFromData(fieldClassName, data) {
      var id = (0, _graphql2.objectIdFromData)(data);

      return this._getClassDataById(fieldClassName, id).then(function (result) {
        if (!result) {
          throw new Error('There is no "' + fieldClassName + '" with id "' + id + '" !');
        }
        return id;
      });
    }
  }], [{
    key: '_graphQLTypeFromString',
    value: function _graphQLTypeFromString(type) {
      switch (type.toLowerCase()) {
        case 'string':
          return _graphql.GraphQLString;
        case 'relation':
          return _common.ObjectIDType;
        case 'boolean':
          return _graphql.GraphQLBoolean;
        case 'int':
        case 'integer':
          return _graphql.GraphQLInt;
        case 'float':
        case 'number':
          return _graphql.GraphQLFloat;
        case 'object':
        case 'mixed':
          return _common.MixedType;
        default:
          return null;
      }
    }
  }]);

  return ClassesFieldsHelper;
}();

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


ClassesFieldsHelper.RESERVED_CLASS_NAMES = ['File'];
ClassesFieldsHelper.RESERVED_CLASS_PREFIX = ['_'];
ClassesFieldsHelper.RESERVED_FIELDS = ['id', '_id', 'mongoId', 'createdAt', 'updatedAt', 'clientMutationId', 'options', 'fields'];
ClassesFieldsHelper.RESERVED_FIELDS_PREFIX = ['_'];
function classesFieldsGettersFactory(_ref4) {
  var storage = _ref4.storage;
  var classes = _ref4.classes;

  var classesFieldsHelper = new ClassesFieldsHelper({ storage: storage, classes: classes });

  (0, _generateClassesHelpers2.default)(classesFieldsHelper);
  (0, _generateTypesAndConnections2.default)(classesFieldsHelper);

  var queryFields = (0, _getQueryFields2.default)(classesFieldsHelper);
  var mutationFields = (0, _getMutationFields2.default)(classesFieldsHelper, queryFields);

  return {
    getQueryFields: function getQueryFields() {
      return queryFields;
    },
    getMutationFields: function getMutationFields() {
      return mutationFields;
    }
  };
}
//# sourceMappingURL=index.js.map