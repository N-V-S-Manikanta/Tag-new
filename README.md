# DMM Platform — Digital Marketing Management Platform

An enterprise-grade, full-stack **multi-organization** MERN platform for managing
all digital marketing operations: social media analytics, a structured content
approval workflow, a posting calendar, template & asset repositories, reporting,
notifications and activity logging — with role-based access for **Admin**, **CEO**
and **User**.

**Multi-tenant by design:** the Admin creates organizations (e.g. NCT, NCMS), and
every CEO/User belongs to exactly one. All data — approvals, templates, assets,
analytics, calendar, reports — is fully isolated per organization. Creating an
organization instantly provisions the entire platform for it; there is no code to
duplicate per org.

> Design inspired by HubSpot, Buffer, Hootsuite, ClickUp, Monday.com and Meta Business Suite.

The platform is split into **three apps** that share one backend:

| App | Port | For | Purpose |
|-----|------|-----|---------|
| **DMM_backend** | 5000 | — | REST API + MongoDB (shared by both frontends) |
| **DMM_frontend** | 5173 | CEO & User | The marketing product: dashboard, approvals, templates, assets, reports |
| **DMM_Admin** | 5174 | Admin only | Administration console: user management, social analytics, activity logs |

---

## 📁 Project Structure

```
DMM_Platform/
├── DMM_backend/        # Node.js + Express + MongoDB REST API (shared)
│   ├── src/
│   │   ├── config/     # db, constants, storage driver (local/cloudinary)
│   │   ├── models/     # Mongoose schemas
│   │   ├── controllers/# route handlers (auth/setup, users, analytics, …)
│   │   ├── routes/     # express routers
│   │   ├── middleware/ # auth (JWT), RBAC, upload (multer), error handling
│   │   ├── utils/      # token, activity logger, notifier, email (SMTP)
│   │   ├── app.js      # express app
│   │   └── server.js   # entry point
│   └── uploads/        # locally-stored files (served at /uploads)
│
├── DMM_frontend/       # Product app (CEO + User) — React (Vite) + Tailwind
│   └── src/            # api, store, components, pages, lib
│
└── DMM_Admin/          # Admin console (Admin only) — React (Vite) + Tailwind
    └── src/
        ├── api/        # axios client (separate token key) + endpoints
        ├── store/      # auth (admin-only guard) + theme stores
        ├── components/ # ui primitives + layout
        ├── pages/      # Setup, Login, Overview, Users, Analytics, ActivityLogs, Settings
        ├── App.jsx     # router
        └── main.jsx    # entry point
```

The admin console is a **separate, independently-deployable app**. It uses its own
localStorage session key, so an admin session never collides with a product session.

---

## 🧱 Tech Stack

**Frontend:** React, JavaScript, Tailwind CSS, ShadCN-style UI primitives, Framer Motion, React Query, Zustand, Axios, React Router DOM, Recharts
**Backend:** Node.js, Express.js, JWT Auth, Role-Based Access Control, Multer, Cloudinary-ready storage abstraction
**Database:** MongoDB + Mongoose
**Exports:** ExcelJS (xlsx), PDFKit (pdf)

---

## ✅ Prerequisites

- **Node.js** ≥ 18 (tested on v22)
- **MongoDB** running locally at `mongodb://localhost:27017` (Community Server or `mongod` service)
- npm

---

## 🚀 Quick Start

Open **three terminals** — backend, admin console, and product app.

### 1) Backend

```bash
cd DMM_backend
npm install
cp .env.example .env        # a working .env is already included for local dev
npm run dev                 # API on http://localhost:5000
```

### 2) Admin console

```bash
cd DMM_Admin
npm install
npm run dev                 # admin on http://localhost:5174
```

### 3) Product app

```bash
cd DMM_frontend
npm install
npm run dev                 # product on http://localhost:5173
```

### 🔐 First admin & setup

The platform ships with **zero demo content**. You get into the Admin console one
of two ways:

**Option A — bootstrap script (default admin):**

```bash
cd DMM_backend
npm run create-admin     # creates or resets the admin account
```

This creates an administrator with:

| | |
|---|---|
| **Email** | `Admin@DMM` _(case-insensitive)_ |
| **Password** | `Admin@DMM` |

Sign in at the **Admin console → http://localhost:5174** with those credentials.
The script is idempotent — re-run it anytime to reset admin access. Override the
defaults with `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` env vars, and change
the password from **Settings → Password** after first login.

**Option B — first-run setup screen:**

If the database has **no users at all**, the Admin console shows a one-time
**"Set up the platform"** screen to create the first admin interactively.

**Then, as admin:**
1. **Organizations** → create an organization (e.g. NCT, NCMS) — name, logo, brand color.
2. **User Management** → add CEO/User accounts and assign each to an organization.
3. **Social Analytics** → pick an organization and enter its platform metrics.
4. **Posting Calendar** → pick an organization to see its posts day-by-day.

Those CEO/User accounts then sign in to the **product app → http://localhost:5173**,
where everything is automatically scoped to their organization (its name, logo and
color brand the app). The product app shows a "platform not configured" screen
until the first admin exists.

### 🏢 Multi-organization model

| Concept | Behaviour |
|---------|-----------|
| **Organization** | An isolated workspace. Created/managed by the Admin. |
| **Data isolation** | Approvals, templates, assets, analytics, calendar, reports, notifications and activity are all scoped to one org. A CEO of NCT never sees NCMS data. |
| **Admin** | Global — not tied to an org. Creates orgs, assigns users, enters per-org analytics, views the per-org calendar. |
| **Calendar** | A month grid of posted content. Click a day to see exactly what was posted, by platform. Available in the product app (the user's org) and the admin console (per selected org). |

### 📈 Social analytics (LinkedIn-style)

Metrics are entered **weekly** per organization & platform (admin console → Social
Analytics → *Enter metrics*). Each save is a dated snapshot, so the platform tracks
**week-over-week change** automatically. The report view shows:

- **Highlight cards** with up/down deltas vs the previous entry (e.g. *+180 followers, +18%*)
- **Charts** — audience growth (area) and a selectable weekly metric (bar)
- **Sectioned metrics** grouped LinkedIn-style: **Followers** (total / new / last-30-days),
  **Discovery** (impressions, search appearances, engagement rate), **Content**
  (reactions, comments, reposts), **Visitors** (page views, unique visitors)
- **Compare organizations** — rank all orgs on any metric for a platform (admin only)

CEOs/Users see their own organization's report (read-only) at **Social Analytics**
in the product app; the admin enters the numbers and can compare across orgs.

### 👥 Roles

| Role | Signs in to | Scope | Capabilities |
|------|-------------|-------|--------------|
| **ADMIN** | Admin console (5174) | Global | Manage organizations; manage all users (create/edit/deactivate/delete, assign roles + orgs, reset passwords); enter per-org analytics; per-org posting calendar; system activity logs & overview |
| **CEO** | Product app (5173) | One org | Approve/reject content with feedback; org dashboards, calendar & reports |
| **USER** | Product app (5173) | One org | Create approval requests, upload templates/assets, mark content posted, manage own content |

> The admin console only accepts ADMIN accounts — a CEO/User who tries to sign in
> there is rejected. The product app is for day-to-day marketing work.

---

## ⚙️ Configuration (`DMM_backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/dmm_platform` |
| `JWT_SECRET` | Secret used to sign JWTs | _(set in .env)_ |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_URL` | Allowed CORS origin(s), comma-separated | `http://localhost:5173` |
| `STORAGE_DRIVER` | `local` or `cloudinary` | `local` |
| `CLOUDINARY_*` | Credentials (only if driver = cloudinary) | _(empty)_ |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | SMTP for password-reset & welcome emails (optional) | _(empty)_ |

### Password reset & email

If SMTP is configured, "Forgot password" emails a reset link and new users get a
welcome email. **If SMTP is left blank**, self-service reset is disabled and the
app tells the user to ask an admin — admins can reset any user's password from
**User Management**. No tokens or credentials are ever exposed in the UI.

### Switching to Cloudinary later

The storage layer is abstracted in `src/config/storage.js`. To move uploads to
Cloudinary, set in `.env`:

```
STORAGE_DRIVER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

No controller changes are needed — they call `uploadBuffer()` / `deleteFile()`.

---

## 🧩 Features

- **Auth** — login, logout, forgot/reset password, JWT, protected routes, RBAC
- **Dashboard** — social analytics (LinkedIn/Instagram/YouTube/Facebook), overall
  stats, line/area/bar/pie charts, activity timeline, role-specific widgets
- **Templates & Assets** — upload, search, filter, preview, download, edit, delete
- **Approval Workflow** — create request → CEO approve/reject with unlimited
  feedback points → resubmit → mark as posted. Statuses: `PENDING`, `APPROVED`,
  `REJECTED`, `RESUBMITTED`, `POSTED`. Images support **drag-to-reorder** on
  create and resubmit. Images and feedback live in their own collections
  (`approvalImages`, `approvalComments`).
- **Global Search** — debounced topbar search across approvals, templates, assets
  and (for CEO) users, with a grouped results dropdown
- **Approval Analytics** — KPI cards, success rate, user performance, recent tables
- **Reports** — export Approval/Posting/Template/Asset/Activity reports as Excel or PDF
- **Notifications** — in-app notifications for both roles with unread badge
- **Activity Logs** — every key action recorded with user + timestamp
- **Settings** — profile + avatar, change password, light/dark theme, notification prefs

---

## 🔌 Key API Endpoints

```
GET    /api/auth/setup-status          # is the first-run setup still needed?
POST   /api/auth/setup                 # create the first ADMIN (only while DB empty)
POST   /api/auth/login                 # authenticate
POST   /api/auth/forgot-password       # email a reset link (if SMTP configured)
POST   /api/auth/reset-password/:token # set a new password

GET    /api/organizations             # ADMIN: list orgs (with member/post counts)
POST   /api/organizations             # ADMIN: create org (name, logo, color)
PUT    /api/organizations/:id         # ADMIN: update org
DELETE /api/organizations/:id         # ADMIN: delete org (only if no members)

GET    /api/users                      # ADMIN: list users (search, role, organization filter)
POST   /api/users                      # ADMIN: create user (+organization for CEO/USER)
PUT    /api/users/:id                  # ADMIN: update role/status/organization/details
PUT    /api/users/:id/reset-password   # ADMIN: reset a user's password
DELETE /api/users/:id                  # ADMIN: delete user

GET    /api/analytics?organizationId=  # latest social metrics per platform (org-scoped)
POST   /api/analytics                  # ADMIN/CEO: record a weekly metrics snapshot
GET    /api/analytics/:platform/report # rich report: latest + previous + WoW deltas + time series
GET    /api/analytics/compare?platform=&metric=   # ADMIN: compare a metric across organizations

GET    /api/calendar?month=YYYY-MM     # posted-content counts per day (org-scoped)
GET    /api/calendar/day?date=…        # the posts published on a specific day

GET    /api/dashboard/stats            # overall + social stats (org-wide for ADMIN/CEO)
GET    /api/dashboard/charts           # chart series
GET    /api/dashboard/my-uploads       # current user's recent templates & assets
GET    /api/templates                  # list (search, category, page)
POST   /api/templates                  # upload (multipart)
GET    /api/assets                     # list
POST   /api/approvals                  # create request (multipart images)
PUT    /api/approvals/:id/approve      # CEO approve
PUT    /api/approvals/:id/reject       # CEO reject + feedbackPoints[]
PUT    /api/approvals/:id/resubmit     # owner resubmit (supports image reorder via order[])
PUT    /api/approvals/:id/posted       # owner mark posted
GET    /api/reports/:type?format=excel|pdf
GET    /api/notifications              # current user's notifications
GET    /api/search?q=...               # global search (approvals, templates, assets, users)
```

All routes except `/api/auth/*` and `/api/health` require a `Bearer <token>` header.

---

## 📦 Production Build & Deployment

### Frontends (product + admin)

```bash
cd DMM_frontend && npm run build     # → DMM_frontend/dist
cd DMM_Admin    && npm run build     # → DMM_Admin/dist
```

Deploy each `dist/` to any static host (Vercel, Netlify, Nginx, S3+CloudFront),
typically on **separate domains/subdomains** — e.g. `app.yourdomain.com` (product)
and `admin.yourdomain.com` (admin). Each must reach the backend at `/api` and
`/uploads` (via reverse proxy, or change `baseURL` in `src/api/client.js`).

### Backend

```bash
cd DMM_backend
NODE_ENV=production node src/server.js
```

Recommended for production:
- Use a process manager (`pm2 start src/server.js --name dmm-api`)
- Use **MongoDB Atlas** — set `MONGO_URI` to the Atlas connection string
- Set a strong `JWT_SECRET`
- Set `STORAGE_DRIVER=cloudinary` so uploads persist across deploys
- Set `CLIENT_URL` to **both** frontend origins, comma-separated
  (e.g. `https://app.yourdomain.com,https://admin.yourdomain.com`) — this is the
  CORS allowlist
- Configure SMTP for password-reset & welcome emails

#### Example Nginx (subdomains)

```nginx
# Product app
server {
  listen 80; server_name app.yourdomain.com;
  location /api     { proxy_pass http://localhost:5000; }
  location /uploads { proxy_pass http://localhost:5000; }
  location /        { root /var/www/dmm-frontend/dist; try_files $uri /index.html; }
}

# Admin console
server {
  listen 80; server_name admin.yourdomain.com;
  location /api     { proxy_pass http://localhost:5000; }
  location /uploads { proxy_pass http://localhost:5000; }
  location /        { root /var/www/dmm-admin/dist; try_files $uri /index.html; }
}
```

---

## 🛠️ Useful Scripts

**Backend**
- `npm run dev` — start with nodemon
- `npm start` — start production server

**Frontend (product, port 5173) & Admin (console, port 5174)** — same scripts
- `npm run dev` — Vite dev server (proxies `/api` & `/uploads` → `:5000`)
- `npm run build` — production build
- `npm run preview` — preview build

---

## 📝 Notes

- File uploads are stored on disk under `DMM_backend/uploads/` in local mode and
  served at `/uploads/...`. Switch to Cloudinary anytime via `.env`.
- The platform contains **no seed, demo, or placeholder data**. All content —
  users, templates, assets, approvals and social metrics — is created in-app.
- The first admin is created via the one-time setup screen; thereafter admins
  create and manage all accounts from the User Management panel.
