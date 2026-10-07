const { Schema, model } = require('mongoose');

const categorySchema = new Schema(
  {
    CategoryID: { type: String, required: true, unique: true },
    Name: { type: String, required: true, trim: true },
    Active: { type: Boolean, default: true },
  },
  { versionKey: false }
);

module.exports = model('Category', categorySchema);
