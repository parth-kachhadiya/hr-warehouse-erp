// Extra fields shown on the Add Product form.
const { Schema, model } = require('mongoose');

const customFieldSchema = new Schema(
  {
    FieldID: { type: String, required: true, unique: true },
    Module: { type: String, default: 'Assets' },
    FieldName: { type: String, required: true, trim: true },
    Active: { type: Boolean, default: true },
  },
  { versionKey: false }
);

module.exports = model('CustomField', customFieldSchema);
