// Load environment variables before any other module is evaluated, so config
// read at import time (e.g. CORS allowlist) sees the correct values.
import 'dotenv/config';

import app from './app.js';
import connectDB from './config/db.js';
import { seedSuperAdmin } from './config/seedSuperAdmin.js';
import { ensureStorageReady } from './config/storage.js';
import { startDailyAnalyticsScheduler } from './services/dailyAnalyticsRefresh.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await seedSuperAdmin();
  const storage = ensureStorageReady();
  app.listen(PORT, () => {
    console.log(`🚀 DMM backend running on http://localhost:${PORT} (${process.env.NODE_ENV})`);
    console.log(`   Storage driver: ${process.env.STORAGE_DRIVER || 'local'}${storage.root ? ` · root: ${storage.root}` : ''}`);
  });
  if (process.env.DISABLE_DAILY_ANALYTICS_REFRESH !== 'true') {
    startDailyAnalyticsScheduler();
    console.log(`   Daily analytics refresh scheduled at ${process.env.DAILY_ANALYTICS_REFRESH_TIME || '02:00'} UTC`);
  }
};

start();
