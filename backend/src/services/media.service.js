// Product photos and video (same as uploadAssetMediaForAsset in the old script).
// Cloudinary folders copy the old Drive layout:
// "HR Warehouse Media / SEL-0001 - Seller Name / Images|Video", files named Product_Name_001, 002...
const { Asset, Seller } = require('../models');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const { getSettings } = require('./settings.service');

const safeName = (s) => (String(s || '').replace(/[\\/:*?"<>|#%{}~&]/g, ' ').replace(/\s+/g, ' ').trim() || 'Unnamed').substring(0, 120);

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)));
    stream.end(buffer);
  });
}

async function sellerFolder(asset, root) {
  if (asset.SellerID) {
    const seller = await Seller.findOne({ SellerID: asset.SellerID });
    if (seller) {
      const folder = `${root}/${safeName(`${asset.SellerID} - ${seller.Name || asset.SellerName || 'Seller'}`)}`;
      if (seller.MediaFolderId !== folder) {
        seller.MediaFolderId = folder;
        await seller.save();
      }
      return folder;
    }
  }
  return `${root}/NO-SELLER - Unassigned`;
}

async function uploadAssetMedia(assetID, file) {
  if (!file) throw new AppError(400, 'Invalid media upload.');
  if (!isConfigured) throw new AppError(503, 'Media storage is not set up. Add the CLOUDINARY_* values to backend/.env');
  const asset = await Asset.findOne({ AssetID: assetID });
  if (!asset) throw new AppError(404, 'Asset not found.');
  const settings = await getSettings();
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  if (!isImage && !isVideo) throw new AppError(400, 'Only image/video files are allowed.');
  const maxMB = isImage ? settings.MaxPhotoMB || 8 : settings.MaxVideoMB || 25;
  if (file.size > maxMB * 1024 * 1024) throw new AppError(400, `${isImage ? 'Photo' : 'Video'} exceeds ${maxMB} MB limit.`);
  if (isVideo && asset.VideoFileId) throw new AppError(400, 'This product already has a video.');

  const folder = `${await sellerFolder(asset, settings.MediaRootFolderId || 'HR Warehouse Media')}/${isImage ? 'Images' : 'Video'}`;
  const count = isImage ? asset.PhotoFileIds.length : 0;
  const fileName = `${safeName(asset.ItemName).replace(/\s+/g, '_')}_${String(count + 1).padStart(3, '0')}`;
  const result = await uploadBuffer(file.buffer, {
    folder, public_id: fileName, resource_type: isImage ? 'image' : 'video', overwrite: false, unique_filename: false,
  });

  if (isImage) {
    asset.PhotoLinks.push(result.secure_url);
    asset.PhotoFileIds.push(result.public_id);
  } else {
    asset.VideoLink = result.secure_url;
    asset.VideoFileId = result.public_id;
  }
  await asset.save();
  await audit.log('MEDIA_UPLOAD', 'Asset', assetID, { fileId: result.public_id, fileName, type: isImage ? 'image' : 'video' });
  return { url: result.secure_url, fileId: result.public_id, fileName };
}

module.exports = { uploadAssetMedia };
