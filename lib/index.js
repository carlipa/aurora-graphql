'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _expressGraphql = require('express-graphql');

var _expressGraphql2 = _interopRequireDefault(_expressGraphql);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _lodash = require('lodash');

var _express = require('express');

var _classesFields = require('./factories/classes.fields.factory');

var _classesFields2 = _interopRequireDefault(_classesFields);

var _classesFilesFields = require('./factories/classes.files.fields.factory');

var _classesFilesFields2 = _interopRequireDefault(_classesFilesFields);

var _projectFields = require('./factories/project.fields.factory');

var _projectFields2 = _interopRequireDefault(_projectFields);

var _graphql = require('./utils/graphql');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GraphQLApi = function () {
  function GraphQLApi() {
    _classCallCheck(this, GraphQLApi);

    this._projectsClasses = {};
  }

  _createClass(GraphQLApi, [{
    key: '_getClassesForProject',


    /**
     * Return the classes GraphQL schema for a specific project, will be generated if needed
     * @param project
     * @param storage
     * @private
     */
    value: function _getClassesForProject(_ref) {
      var _this = this;

      var project = _ref.project;
      var storage = _ref.storage;

      var projectHash = project.hash || _crypto2.default.createHash('sha256').update(JSON.stringify(project.classes.definitions)).digest('hex');

      if (!this._projectsClasses[project._id] || this._projectsClasses[project._id].projectHash !== projectHash) {
        (function () {
          var graphQLSchema = GraphQLApi._getSchema({ storage: storage, project: project });

          var schemaJSONPromise = (0, _graphql.getSchemaJson)(graphQLSchema);

          _this._projectsClasses[project._id] = {
            schema: graphQLSchema,
            getSchemaJSON: function getSchemaJSON() {
              return schemaJSONPromise;
            },
            projectHash: projectHash
          };
        })();
      }

      return this._projectsClasses[project._id];
    }

    /**
     * Returns an express middleware of the GraphQL schema
     */

  }, {
    key: 'getMiddleware',
    value: function getMiddleware() {
      var _this2 = this;

      var router = new _express.Router();

      var schemaMiddleware = new _express.Router();
      schemaMiddleware.use(function (req, res) {
        // Will throw if `req` is invalid
        GraphQLApi.validateReq(req);

        _this2._getClassesForProject({ project: req.aurora.project, storage: req.aurora.storage }).getSchemaJSON().then(function (result) {
          res.json(result);
        });
      });

      var graphQLMiddleware = (0, _expressGraphql2.default)(function (req) {
        // Will throw if `req` is invalid
        GraphQLApi.validateReq(req);

        return {
          schema: _this2._getClassesForProject({ project: req.aurora.project, storage: req.aurora.storage }).schema,
          rootValue: {
            allowMutation: req.aurora.allowMutation
          },
          graphiql: true
        };
      });

      router.use('/schema.json', schemaMiddleware);
      router.use(graphQLMiddleware);
      return router;
    }
  }], [{
    key: '_getSchema',


    /**
     * Generate the GraphQl schema
     * @param storage
     * @param project
     * @private
     */
    value: function _getSchema(_ref2) {
      var storage = _ref2.storage;
      var project = _ref2.project;

      var _ref3 = project.classes ? (0, _classesFields2.default)({ storage: storage, classes: project.classes }) : {};

      var getClassesQueryFields = _ref3.getQueryFields;
      var getClassesMutationFields = _ref3.getMutationFields;

      var _classFileFieldsGette = (0, _classesFilesFields2.default)({ storage: storage });

      var getFilesQueryFields = _classFileFieldsGette.getQueryFields;
      var getFilesMutationFields = _classFileFieldsGette.getMutationFields;

      var _projectFieldsGetters = (0, _projectFields2.default)({ project: project });

      var getProjectQueryFields = _projectFieldsGetters.getQueryFields;
      var getProjectMutationFields = _projectFieldsGetters.getMutationFields;


      return (0, _graphql.generateSchema)({
        queryFieldsGetters: (0, _lodash.compact)([getClassesQueryFields, getFilesQueryFields, getProjectQueryFields]),
        mutationFieldsGetters: (0, _lodash.compact)([getClassesMutationFields, getFilesMutationFields, getProjectMutationFields])
      });
    }
  }, {
    key: 'validateReq',
    value: function validateReq(req) {
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
  }]);

  return GraphQLApi;
}();

exports.default = GraphQLApi;
//# sourceMappingURL=index.js.map