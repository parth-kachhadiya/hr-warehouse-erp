// Product photos and video (same as uploadAssetMediaForAsset in the old script).
// Cloudinary folders copy the old Drive layout:
// "HR Warehouse Media / SEL-0001 - Seller Name / Images|Video", files named Product_Name_001, 002...
const { Asset, Seller } = require('../models');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const { nextIds } = require('../utils/idGenerator');
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
    const seller = await Seller.findOne({ SellerID: asset.SellerID }, { Name: 1, MediaFolderId: 1 }).lean();
    if (seller) {
      const folder = `${root}/${safeName(`${asset.SellerID} - ${seller.Name || asset.SellerName || 'Seller'}`)}`;
      if (seller.MediaFolderId !== folder) {
        await Seller.updateOne({ SellerID: asset.SellerID }, { $set: { MediaFolderId: folder } });
      }
      return folder;
    }
  }
  return `${root}/NO-SELLER - Unassigned`;
}

// Takes the next photo number for a product in one atomic step, so several photos
// uploading at the same time never get the same name. Older products continue
// from the number of photos they already have.
async function nextPhotoNumber(assetID) {
  const updated = await Asset.findOneAndUpdate(
    { AssetID: assetID },
    [{ $set: { PhotoSeq: { $add: [{ $ifNull: ['$PhotoSeq', { $size: { $ifNull: ['$PhotoFileIds', []] } }] }, 1] } } }],
    { new: true, projection: { PhotoSeq: 1 } }
  ).lean();
  return updated ? updated.PhotoSeq : 1;
}

// Speed: the product and settings are read at the same time, the photo number and seller
// folder are fetched at the same time, and the product is updated with a single write.
async function uploadAssetMedia(assetID, file) {
  if (!file) throw new AppError(400, 'Invalid media upload.');
  if (!isConfigured) throw new AppError(503, 'Media storage is not set up. Add the CLOUDINARY_* values to backend/.env');
  const [asset, settings] = await Promise.all([Asset.findOne({ AssetID: assetID }).lean(), getSettings()]);
  if (!asset) throw new AppError(404, 'Asset not found.');
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  if (!isImage && !isVideo) throw new AppError(400, 'Only image/video files are allowed.');
  const maxMB = isImage ? settings.MaxPhotoMB || 8 : settings.MaxVideoMB || 25;
  if (file.size > maxMB * 1024 * 1024) throw new AppError(400, `${isImage ? 'Photo' : 'Video'} exceeds ${maxMB} MB limit.`);
  if (isVideo && asset.VideoFileId) throw new AppError(400, 'This product already has a video.');

  const [rootFolder, number] = await Promise.all([
    sellerFolder(asset, settings.MediaRootFolderId || 'HR Warehouse Media'),
    isImage ? nextPhotoNumber(assetID) : 1,
  ]);
  const folder = `${rootFolder}/${isImage ? 'Images' : 'Video'}`;
  const fileName = `${safeName(asset.ItemName).replace(/\s+/g, '_')}_${String(number).padStart(3, '0')}`;
  const result = await uploadBuffer(file.buffer, {
    folder, public_id: fileName, resource_type: isImage ? 'image' : 'video', overwrite: false, unique_filename: false,
  });

  const change = isImage
    ? { $push: { PhotoLinks: result.secure_url, PhotoFileIds: result.public_id } }
    : { $set: { VideoLink: result.secure_url, VideoFileId: result.public_id } };
  const [, [auditID]] = await Promise.all([Asset.updateOne({ AssetID: assetID }, change), nextIds('AUD')]);
  await audit.log('MEDIA_UPLOAD', 'Asset', assetID, { fileId: result.public_id, fileName, type: isImage ? 'image' : 'video' }, null, auditID);
  return { url: result.secure_url, fileId: result.public_id, fileName };
}

module.exports = { uploadAssetMedia };
