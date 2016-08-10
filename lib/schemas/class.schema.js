'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mongoose = require('mongoose');

/**
 * Class Schema
 */
exports.default = new _mongoose.Schema({
  data: {
    type: _mongoose.Schema.Types.Mixed
  },
  _classVersion: {
    type: Number,
    required: true,
    default: 0
  },
  _deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true }); /**
                        * Module dependencies.
                        */
//# sourceMappingURL=class.schema.js.map