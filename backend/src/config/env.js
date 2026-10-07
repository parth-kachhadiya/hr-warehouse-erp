// Reads backend/.env once and exposes the values the app needs.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  // One or more allowed frontend addresses, separated by commas.
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

env.isProduction = env.NODE_ENV === 'production';

// Stops the server early with a clear message if something important is missing.
env.validate = () => {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Add them to backend/.env (or the host's settings).`);
  }
  if (!env.ADMIN_PASSWORD_HASH.startsWith('$2')) {
    throw new Error('ADMIN_PASSWORD_HASH must be a bcrypt hash. Run: npm run hash-password -- "your-password"');
  }
  if (env.JWT_SECRET.length < 32) {
    console.warn('Warning: JWT_SECRET is short. Use at least 32 random characters.');
  }
};

module.exports = env;
