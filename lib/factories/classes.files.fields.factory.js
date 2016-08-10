'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileFields = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = classesFilesFieldsGettersFactory;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _graphql = require('graphql');

var _file = require('../types/file');

var _graphql2 = require('../utils/graphql');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

_bluebird2.default.promisifyAll(_fs2.default);

var FileFields = exports.FileFields = function () {
  /**
   * @param storage
   */
  function FileFields(_ref) {
    var storage = _ref.storage;

    _classCallCheck(this, FileFields);

    if (!storage) {
      throw new Error('Storage is missing !');
    }

    this._storage = storage;
  }

  _createClass(FileFields, [{
    key: 'getMutationFields',
    value: function getMutationFields() {
      return {};
    }
  }, {
    key: 'getQueryFields',
    value: function getQueryFields() {
      var _this = this;

      var getOneFile = {
        name: 'file',
        type: _file.FileType,
        args: {
          id: {
            type: new _graphql.GraphQLNonNull(_graphql.GraphQLID)
          }
        },
        resolve: function resolve(_, args) {
          return _this._storage.files.getOneFileMetadataById((0, _graphql2.objectIdFromData)(args.id));
        }
      };

      return {
        file: getOneFile
      };
    }
  }, {
    key: 'getFieldsGetters',
    value: function getFieldsGetters() {
      var _this2 = this;

      return {
        getQueryFields: function getQueryFields() {
          return _this2.getQueryFields();
        },
        getMutationFields: function getMutationFields() {
          return _this2.getMutationFields();
        }
      };
    }
  }]);

  return FileFields;
}();
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


function classesFilesFieldsGettersFactory(_ref2) {
  var storage = _ref2.storage;

  var classFilesFieldsFactory = new FileFields({ storage: storage });
  return classFilesFieldsFactory.getFieldsGetters();
}
//# sourceMappingURL=classes.files.fields.factory.js.map