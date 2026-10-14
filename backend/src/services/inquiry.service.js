// Buyer and seller inquiries. The person is either picked from Buyers/Sellers (PersonID)
// or typed in by name; a typed-in person stays only in the inquiry list.
const { Buyer, Inquiry, Seller } = require('../models');
const { nextIds } = require('../utils/idGenerator');
const { text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const TYPES = { Buyer: { Model: Buyer, idField: 'BuyerID' }, Seller: { Model: Seller, idField: 'SellerID' } };

function checkType(typeInput) {
  const type = text(typeInput);
  if (!TYPES[type]) throw new AppError(400, 'Inquiry type must be Buyer or Seller.');
  return type;
}

async function getInquiries(typeInput) {
  const type = checkType(typeInput);
  return Inquiry.find({ Type: type, Status: { $ne: 'Void' } }).sort({ Date: -1, InquiryID: -1 }).lean();
}

async function addInquiry(q = {}) {
  const type = checkType(q.type);
  const personID = text(q.personID);
  let name = text(q.name);
  if (personID) {
    const { Model, idField } = TYPES[type];
    const person = await Model.findOne({ [idField]: personID, Active: true }).lean();
    if (!person) throw new AppError(400, `Selected ${type.toLowerCase()} not found.`);
    name = person.Name;
  }
  if (!name) throw new AppError(400, 'Name required.');
  const area = text(q.area);
  if (!area) throw new AppError(400, 'Area required.');
  const category = text(q.category);
  if (!category) throw new AppError(400, 'Product category required.');
  const mobile = text(q.mobile);
  if (mobile && !/^[+\d][\d\s-]{5,19}$/.test(mobile)) throw new AppError(400, 'Mobile number is not valid.');
  const date = q.date ? new Date(q.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'Inquiry date is not valid.');

  const [id, auditID] = await nextIds('INQ', 'AUD');
  await Inquiry.create({
    InquiryID: id, Type: type, Date: date, PersonID: personID, Name: name, Area: area, Category: category, Mobile: mobile, Status: 'Active',
  });
  await audit.log('INQUIRY_ADD', 'Inquiry', id, { type, name, category }, undefined, auditID);
  return id;
}

async function deleteInquiry(id) {
  const res = await Inquiry.updateOne({ InquiryID: id, Status: { $ne: 'Void' } }, { $set: { Status: 'Void', VoidDate: new Date() } });
  if (!res.matchedCount) throw new AppError(404, 'Inquiry not found.');
  await audit.log('INQUIRY_DELETE', 'Inquiry', id, {});
  return true;
}

module.exports = { getInquiries, addInquiry, deleteInquiry };
