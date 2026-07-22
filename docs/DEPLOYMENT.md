# Deployment Guide

This guide deploys MealMatch AI's three services plus its database to production:

| Service  | Platform          | Why |
|----------|-------------------|-----|
| Client (React/Vite) | **Vercel**  | Vercel's edge network is built specifically for static/SPA frontends — zero-config Vite detection, automatic preview deployments per PR, free SSL, and a global CDN. There's no server-side rendering or long-running process here, so a serverless/static host is strictly the right shape (and cheaper) rather than a full VM. |
| Backend (Node/Express) | **Render** | The backend is a long-running stateful-ish process (Express + an in-process rate limiter) that needs to stay warm and hold a persistent outbound connection to MongoDB — that's a "web service," not a serverless function. Render gives native Node buildpacks, automatic HTTPS, zero-downtime deploys, and a free/starter tier that's simple to reason about, without needing to manage a VM (EC2/DigitalOcean) by hand. |
| Scraper (FastAPI/Playwright) | **Render (Docker)** | Playwright needs a real Chromium binary plus its OS-level dependencies (fonts, codecs, `libnss3`, etc.) — that rules out most serverless platforms outright (cold-start size limits, no persistent browser process, read-only filesystems). Render's Docker runtime supports Playwright's own official base image directly, and — critically — keeps one long-lived process alive to reuse the browser instance across requests (see `app/main.py`'s lifespan hook), which a serverless model would force you to re-pay for on every single request. |
| Database | **MongoDB Atlas** | The app already speaks Mongoose/MongoDB natively (see `server/src/config/db.ts`), and Atlas's free M0 tier is sufficient for this workload (short-TTL price cache + search history). Managed backups, network-access rules, and zero ops burden beat self-hosting Mongo for a project at this stage. |

All three services communicate over plain HTTPS using environment-variable-configured
URLs — there is no hardcoded coupling between them, so each can be redeployed or
swapped independently (this was a deliberate architecture decision from Phase 0,
see `docs/architecture.md`).

```
┌─────────────┐      HTTPS       ┌──────────────┐      HTTPS       ┌───────────────────┐
│   Vercel    │ ───────────────► │    Render    │ ───────────────► │      Render        │
│  (client)   │  VITE_API_BASE   │  (server)    │ SCRAPER_SERVICE  │  (scraper, Docker)  │
└─────────────┘      _URL        └──────┬───────┘      _URL       └───────────────────┘
                                          │
                                          │ MONGODB_URI
                                          ▼
                                  ┌───────────────┐
                                  │ MongoDB Atlas │
                                  └───────────────┘
```

---

## 0. Prerequisites

- GitHub account with this repository pushed (see the main README's Git section)
- Vercel account (free tier is enough) — sign up at vercel.com, connect your GitHub account
- Render account (free tier is enough to start; the scraper needs a paid plan — see below) — sign up at render.com, connect your GitHub account
- MongoDB Atlas account (free M0 cluster is enough) — sign up at mongodb.com/cloud/atlas

**Stop-and-provide-credentials point:** all four of the sign-ups/connections above
require your own accounts and cannot be done on your behalf — this is the exact
kind of step this project is instructed to pause at rather than fabricate.

---

## 1. MongoDB Atlas (deploy this first — the backend needs the connection string)

1. Create a free **M0** cluster (any region close to where you'll deploy the backend, e.g. same AWS region Render uses).
2. **Database Access** → add a database user with a strong password (username/password auth, read/write on any database).
3. **Network Access** → add an IP allowlist entry. For Render (which uses dynamic egress IPs on shared plans), use `0.0.0.0/0` (allow from anywhere) and rely on the username/password + a non-guessable database name for protection — this is the standard approach for PaaS-hosted backends without a static IP. If you upgrade Render to a plan with a static outbound IP later, restrict this to that IP instead.
4. **Connect → Drivers** → copy the connection string, e.g.:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/mealmatch?retryWrites=true&w=majority
   ```
   Fill in your real username/password and keep the `/mealmatch` database name (or change it — it's created automatically on first write, Mongo doesn't require pre-creating databases).
5. Keep this string — it's `MONGODB_URI` for the backend in step 3.

*(If you skip this step entirely, the backend still runs — `server/src/config/db.ts` detects a missing/placeholder `MONGODB_URI` and falls back to an in-memory MongoDB instance. That's fine for a demo, but data — cached comparisons, search history — won't persist across restarts, and Render restarts your service on every deploy. Use a real Atlas cluster for anything you want to keep.)*

---

## 2. Scraper → Render (Docker)

1. Render dashboard → **New → Web Service** → connect this GitHub repo.
2. **Root Directory:** `scraper`
3. **Runtime:** Docker (Render auto-detects the `Dockerfile` at `scraper/Dockerfile`)
4. **Instance Type:** at minimum the **Starter** plan. Playwright's Chromium process needs more than the free tier's 512MB RAM to run reliably under concurrent requests — this is an honest limitation, not a formality; expect intermittent crashes/timeouts on the free tier under real traffic.
5. **Health Check Path:** `/health`
6. **Environment variables:**
   | Key | Value |
   |---|---|
   | `HEADLESS` | `true` |
   | `NAV_TIMEOUT_MS` | `20000` |

   (`PORT` is injected automatically by Render — the Dockerfile's `CMD` already reads `$PORT`.)
7. Deploy. Once live, copy the service URL, e.g. `https://mealmatch-scraper.onrender.com` — this is `SCRAPER_SERVICE_URL` for the backend in the next step.
8. Sanity check: `curl https://mealmatch-scraper.onrender.com/health` should return `{"status":"ok","browser_ready":true}`.

---

## 3. Backend → Render (Node)

1. Render dashboard → **New → Web Service** → same GitHub repo.
2. **Root Directory:** `server`
3. **Runtime:** Node
4. **Build Command:** `npm install && npm run build`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/health`
7. **Environment variables:**
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | the Atlas connection string from step 1 |
   | `SCRAPER_SERVICE_URL` | the scraper's Render URL from step 2 |
   | `SCRAPER_TIMEOUT_MS` | `30000` |
   | `CORS_ORIGIN` | your Vercel frontend URL (step 4) — you'll need to circle back and set this **after** step 4, since Vercel assigns the URL first deploy |
   | `NOMINATIM_USER_AGENT` | `MealMatchAI/1.0 (your-real-contact-email)` — OpenStreetMap's usage policy requires a descriptive, contactable User-Agent; don't leave this as the placeholder in production |
   | `RATE_LIMIT_WINDOW_MS` | `60000` |
   | `RATE_LIMIT_MAX` | `30` |
8. Deploy. Copy the service URL, e.g. `https://mealmatch-server.onrender.com` — this is `VITE_API_BASE_URL` (plus `/api`) for the frontend.
9. Sanity check: `curl https://mealmatch-server.onrender.com/health` should return `{"status":"ok"}`.

**Note on `CORS_ORIGIN`:** the current implementation (`server/src/app.ts`) accepts a
single origin string. If you need both a production and a preview Vercel URL
allowed, that's a small follow-up change to accept a comma-separated list —
intentionally left out here to avoid "redesigning" beyond what's asked.

---

## 4. Client → Vercel

1. Vercel dashboard → **Add New → Project** → import this GitHub repo.
2. **Root Directory:** `client`
3. Framework Preset: Vercel auto-detects **Vite** — leave build/output settings as detected (`npm run build`, output `dist`).
4. **Environment Variables:**
   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://mealmatch-server.onrender.com/api` (your backend URL from step 3, with `/api` appended) |
5. Deploy. Copy the assigned URL, e.g. `https://mealmatch-ai.vercel.app`.
6. **Go back to the Render backend (step 3) and set `CORS_ORIGIN` to this exact URL**, then redeploy the backend — until this is set, the browser will block API requests from the deployed frontend with a CORS error.

---

## 5. Post-deploy verification checklist

- [ ] `GET {scraper-url}/health` → `browser_ready: true`
- [ ] `GET {server-url}/health` → `{"status":"ok"}`
- [ ] `GET {server-url}/api/platforms/availability?lat=12.9716&lng=77.5946` → returns all 3 platforms, sorted available-first
- [ ] Open the Vercel URL, pick a location, search "milk" or "biryani" — live results should render within ~10-30s (first request is slowest; see `docs/DOCUMENTATION.md` → Performance for why)
- [ ] Toggle dark mode, confirm it persists on reload
- [ ] Open a product's "Open" link, confirm it lands on the actual item, not the provider's homepage

---

## 6. Environment variable reference

See each service's `.env.example` for the authoritative, minimal list:
- `client/.env.example`
- `server/.env.example`
- `scraper/.env.example`

Never commit a real `.env` file — `.gitignore` already excludes them project-wide.

---

## 7. Ongoing operational notes

- **Cold starts:** Render's free/starter tiers spin services down after a period of inactivity; the first request after idle can take 30-60s while the instance (and, for the scraper, the Chromium browser) boots back up. This is a platform characteristic, not an application bug.
- **Scraper fragility:** Swiggy/Zomato/Blinkit can change their DOM/API shape at any time without notice — see `docs/DOCUMENTATION.md` → Limitations. Monitor the scraper's logs (Render dashboard → Logs) for a spike in `PARSE_ERROR`s as the leading indicator a selector broke.
- **Zomato:** as documented throughout this repo, Zomato blocked this project's development network at the TLS/network level; verify independently once deployed, since Render's network may not be affected the same way — this could self-resolve or need Zomato's DOM selectors re-verified on a real network that can reach it.
