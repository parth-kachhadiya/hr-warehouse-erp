// Receives one photo or video in memory before it is sent to Cloudinary
// (one file per request, like uploadAssetMediaForAsset). Size limits are checked in media.service.
const multer = require('multer');
const AppError = require('../utils/AppError');

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
    return cb(new AppError(400, 'Only image/video files are allowed.'));
  },
}).single('file');

module.exports = { mediaUpload };
