// One document per ID prefix (SEL, AST, ...) holding the last number used.
const { Schema, model } = require('mongoose');

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

module.exports = model('Counter', counterSchema);
