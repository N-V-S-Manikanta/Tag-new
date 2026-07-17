// Load environment variables before any other module is evaluated, so config
// read at import time (e.g. CORS allowlist) sees the correct values.
import 'dotenv/config';

import app from './app.js';
import connectDB from './config/db.js';
import { seedSuperAdmin } from './config/seedSuperAdmin.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await seedSuperAdmin();
  app.listen(PORT, () => {
    console.log(`🚀 DMM backend running on http://localhost:${PORT} (${process.env.NODE_ENV})`);
    console.log(`   Storage driver: ${process.env.STORAGE_DRIVER || 'local'}`);
  });
};

start();
