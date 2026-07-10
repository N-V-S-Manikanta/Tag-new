import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import competitorRoutes from './routes/competitorRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import brandAssetRoutes from './routes/brandAssetRoutes.js';
import socialAccountRoutes from './routes/socialAccountRoutes.js';
import websiteRoutes from './routes/websiteRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import metaRoutes from './routes/metaRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import signageRoutes from './routes/signageRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';
import linkRoutes from './routes/linkRoutes.js';
import goalRoutes from './routes/goalRoutes.js';
import planRoutes from './routes/planRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import linkedinRoutes from './routes/linkedinRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS allowlist is evaluated per-request (not at import time) so it always
// reflects the current CLIENT_URL, and echoes the specific allowed origin
// (required when credentials are enabled). If CLIENT_URL is unset, allow all.
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CLIENT_URL || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Serve locally-stored uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/api/health', (req, res) =>
  res.json({ success: true, status: 'ok', service: 'dmm-backend', time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/signage', signageRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/link-preview', linkRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/brand', brandAssetRoutes);
app.use('/api/social-accounts', socialAccountRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/calendar', calendarRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
