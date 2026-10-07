// Express setup: security headers, CORS, cookies, JSON, routes and errors.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.set('trust proxy', 1); // Render/Vercel sit in front of the app; needed for HTTPS cookies and rate limiting
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requests with no origin (same-site proxy, curl, health checks) are allowed.
      if (!origin || env.FRONTEND_URL.includes(origin)) return callback(null, true);
      return callback(new AppError(403, `Origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
