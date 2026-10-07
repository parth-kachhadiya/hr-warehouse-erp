// Starts the backend: check settings, connect to MongoDB, then listen.
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { seedDefaults } = require('./scripts/seed');

async function start() {
  env.validate();
  await connectDB(env.MONGODB_URI);
  await seedDefaults(); // adds any missing default settings/categories; never overwrites
  app.listen(env.PORT, () => {
    console.log(`HR Warehouse ERP API running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
