# Deploying DMM Platform live

This app is **three pieces** that must be deployed separately:

| Piece | What it is | Where it goes |
|-------|-----------|---------------|
| `DMM_backend` | Node/Express API + MongoDB | **Render** (web service) |
| `DMM_frontend` | Product app (CEO/User) | **Vercel** (static site) |
| `DMM_Admin` | Admin console | **Vercel** (static site) |
| Database | MongoDB | **MongoDB Atlas** (free cluster) |
| Uploads | Images/files | **Cloudinary** (free) |

> GitHub stores the code and triggers these hosts to rebuild on every push. GitHub
> itself cannot run the backend or database.

Do the steps **in order** — each one produces a value the next step needs.

---

## 0. Push the code to GitHub

A repo is already initialized and committed locally. Create the GitHub repo and push:

```bash
# authenticate once (opens a browser)
gh auth login

# create the public repo and push this folder
gh repo create dmm-platform --public --source=. --remote=origin --push
```

(Or create an empty repo on github.com and `git remote add origin <url>` then `git push -u origin main`.)

---

## 1. MongoDB Atlas (database)

1. Create a free account at https://www.mongodb.com/atlas → create a **free M0 cluster**.
2. **Database Access** → add a user (username + password). Save the password.
3. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).
4. **Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/dmm_platform?retryWrites=true&w=majority
   ```
   Replace `USER`/`PASSWORD` and keep `/dmm_platform` as the database name. **Save this as `MONGO_URI`.**

## 2. Cloudinary (file uploads)

On Render the disk is temporary, so uploads must go to Cloudinary (the backend already supports it).

1. Create a free account at https://cloudinary.com.
2. From the dashboard copy: **Cloud name**, **API Key**, **API Secret**.

## 3. Backend on Render

1. Go to https://render.com → **New + → Blueprint** → connect your GitHub repo.
   Render reads [`render.yaml`](render.yaml) and creates the `dmm-backend` service.
2. When prompted, fill the env vars marked "sync: false":
   - `MONGO_URI` → from step 1
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` → from step 2
   - `CLIENT_URL` → **leave a placeholder for now** (e.g. `https://example.com`); you'll set the real Vercel URLs in step 5.
3. Deploy. When it's live, note the URL, e.g. `https://dmm-backend.onrender.com`.
4. Verify: open `https://dmm-backend.onrender.com/api/health` → should return `{"success":true,...}`.
5. **Create the first admin**: in Render → your service → **Shell**, run:
   ```bash
   npm run create-admin
   ```
   Login becomes `Admin@DMM` / `Admin@DMM` (change it after first login).

> Free Render services sleep after ~15 min idle; the first request then takes ~50s to wake.

## 4. Frontends on Vercel (two projects)

Do this **twice** — once per app.

**Product app:**
1. https://vercel.com → **Add New → Project** → import your GitHub repo.
2. **Root Directory** → `DMM_frontend`. Framework auto-detects as Vite.
3. **Environment Variables** → add:
   `VITE_API_URL = https://dmm-backend.onrender.com/api`  (your Render URL + `/api`)
4. Deploy. Note the URL, e.g. `https://dmm-product.vercel.app`.

**Admin console:**
5. Add another project from the **same repo**, **Root Directory** → `DMM_Admin`.
6. Same env var: `VITE_API_URL = https://dmm-backend.onrender.com/api`.
7. Deploy. Note the URL, e.g. `https://dmm-admin.vercel.app`.

## 5. Connect them (CORS)

1. Back in Render → `dmm-backend` → **Environment** → set:
   ```
   CLIENT_URL = https://dmm-product.vercel.app,https://dmm-admin.vercel.app
   ```
   (both Vercel URLs, comma-separated, no trailing slash). Save → it redeploys.

## 6. Done

- Admin console → `https://dmm-admin.vercel.app` (login `Admin@DMM` / `Admin@DMM`)
- Product app → `https://dmm-product.vercel.app`

As admin: create an Organization, add CEO/User accounts → they sign in to the product app.

---

### Auto-deploys
Every `git push` to `main` makes Render and Vercel rebuild automatically.

### Local development is unaffected
With `VITE_API_URL` unset locally, the frontends still proxy `/api` to `localhost:5000` (see each `vite.config.js`), so `npm run dev` works exactly as before.
