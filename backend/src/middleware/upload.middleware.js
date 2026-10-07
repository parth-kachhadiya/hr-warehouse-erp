// Receives photo/video files in memory before sending them to Cloudinary.
// Exact size limits (MaxPhotoMB / MaxVideoMB) are checked from Settings in media.service.
const multer = require('multer');
const AppError = require('../utils/AppError');

const storage = multer.memoryStorage();
const HARD_LIMIT = 100 * 1024 * 1024;

const onlyType = (prefix, label) => (req, file, cb) => {
  if (file.mimetype.startsWith(prefix)) return cb(null, true);
  return cb(new AppError(400, `${file.originalname} is not ${label}`));
};

const photoUpload = multer({ storage, limits: { fileSize: HARD_LIMIT, files: 20 }, fileFilter: onlyType('image/', 'an image') }).array('photos', 20);
const videoUpload = multer({ storage, limits: { fileSize: HARD_LIMIT, files: 1 }, fileFilter: onlyType('video/', 'a video') }).single('video');

module.exports = { photoUpload, videoUpload };
