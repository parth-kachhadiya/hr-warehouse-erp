// Key/value settings, same as the Settings sheet. Values are stored as text.
const { Schema, model } = require('mongoose');

const settingSchema = new Schema(
  {
    Key: { type: String, required: true, unique: true },
    Value: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Setting', settingSchema);
