'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProjectFields = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = classesFilesFieldsGettersFactory;

var _project = require('../types/project');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ProjectFields = exports.ProjectFields = function () {

  /**
   * @param project
   */
  function ProjectFields(_ref) {
    var project = _ref.project;

    _classCallCheck(this, ProjectFields);

    if (!project) {
      throw new Error('Project data are missing !');
    }

    this._project = project;
  }

  _createClass(ProjectFields, [{
    key: 'getMutationFields',
    value: function getMutationFields() {
      return {};
    }
  }, {
    key: 'getQueryFields',
    value: function getQueryFields() {
      var _this = this;

      var getProject = {
        name: 'Project',
        type: _project.ProjectType,
        resolve: function resolve() {
          return _extends({}, _this._project, {
            mongoId: _this._project._id
          });
        }
      };

      return {
        _project: getProject
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

  return ProjectFields;
}();
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


function classesFilesFieldsGettersFactory(_ref2) {
  var project = _ref2.project;

  var classFilesFieldsFactory = new ProjectFields({ project: project });
  return classFilesFieldsFactory.getFieldsGetters();
}
//# sourceMappingURL=project.fields.factory.js.map