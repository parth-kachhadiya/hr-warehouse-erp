// Photos and video for products, stored in Cloudinary with the same folder layout
// as the old Google Drive: "HR Warehouse Media / SEL-0001 - Seller Name / Images|Video".
const { Asset, Seller } = require('../models');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const { getSettings } = require('./settings.service');

const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
const fileBase = (itemName) => safe(itemName).replace(/\s+/g, '_') || 'Item';

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)));
    stream.end(buffer);
  });
}

async function sellerFolder(asset, root) {
  if (!asset.SellerID) return `${root}/Unassigned`;
  const seller = await Seller.findOne({ SellerID: asset.SellerID });
  const folder = `${root}/${asset.SellerID} - ${safe(seller ? seller.Name : asset.SellerName)}`;
  if (seller && seller.MediaFolderId !== folder) {
    seller.MediaFolderId = folder;
    await seller.save();
  }
  return folder;
}

async function loadAsset(assetId) {
  if (!isConfigured) throw new AppError(503, 'Media storage is not set up. Add the CLOUDINARY_* values to backend/.env');
  const asset = await Asset.findOne({ AssetID: assetId });
  if (!asset) throw new AppError(404, 'Product not found');
  if (asset.Status === 'Sold') throw new AppError(400, 'Sold products cannot be changed');
  return asset;
}

async function uploadPhotos(assetId, files = []) {
  if (!files.length) throw new AppError(400, 'Choose at least one photo');
  const settings = await getSettings();
  const maxBytes = settings.MaxPhotoMB * 1024 * 1024;
  const tooBig = files.find((f) => f.size > maxBytes);
  if (tooBig) throw new AppError(400, `${tooBig.originalname} is larger than ${settings.MaxPhotoMB} MB`);

  const asset = await loadAsset(assetId);
  const folder = `${await sellerFolder(asset, settings.MediaRootFolderId)}/Images`;
  let n = asset.PhotoFileIds.length;
  const uploaded = [];
  for (const file of files) {
    n += 1;
    const name = `${fileBase(asset.ItemName)}_${String(n).padStart(3, '0')}`;
    const result = await uploadBuffer(file.buffer, { folder, public_id: name, resource_type: 'image', overwrite: false, unique_filename: true });
    uploaded.push({ link: result.secure_url, id: result.public_id });
  }
  asset.PhotoLinks.push(...uploaded.map((u) => u.link));
  asset.PhotoFileIds.push(...uploaded.map((u) => u.id));
  await asset.save();
  await audit.log('UPLOAD_PHOTOS', 'Asset', assetId, { count: uploaded.length });
  return asset.toObject();
}

// One video per product: a new upload replaces the old one.
async function uploadVideo(assetId, file) {
  if (!file) throw new AppError(400, 'Choose a video');
  const settings = await getSettings();
  if (file.size > settings.MaxVideoMB * 1024 * 1024) throw new AppError(400, `Video is larger than ${settings.MaxVideoMB} MB`);

  const asset = await loadAsset(assetId);
  const folder = `${await sellerFolder(asset, settings.MediaRootFolderId)}/Video`;
  const result = await uploadBuffer(file.buffer, { folder, public_id: `${fileBase(asset.ItemName)}_video`, resource_type: 'video', overwrite: false, unique_filename: true });
  const oldId = asset.VideoFileId;
  asset.VideoLink = result.secure_url;
  asset.VideoFileId = result.public_id;
  await asset.save();
  if (oldId) await cloudinary.uploader.destroy(oldId, { resource_type: 'video' }).catch(() => {});
  await audit.log('UPLOAD_VIDEO', 'Asset', assetId, { replaced: Boolean(oldId) });
  return asset.toObject();
}

module.exports = { uploadPhotos, uploadVideo };
