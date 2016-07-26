/**
 * Module dependencies.
 */
import { Schema } from 'mongoose';

/**
 * Class Schema
 */
export default new Schema({
  data: {
    type: Schema.Types.Mixed,
  },
  _classVersion: {
    type: Number,
    required: true,
    default: 0,
  },
  _deleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // Adds createdAt & updatedAt
});
