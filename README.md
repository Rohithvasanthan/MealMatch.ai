<div align="center">

# 🍽️ MealMatch AI

**Live, real-time price comparison for food delivery and grocery quick-commerce — no mock data, ever.**

[![Client](https://img.shields.io/badge/client-React%20%2B%20Vite-61DAFB)](client)
[![Server](https://img.shields.io/badge/server-Node%20%2B%20Express-339933)](server)
[![Scraper](https://img.shields.io/badge/scraper-FastAPI%20%2B%20Playwright-009688)](scraper)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Live Demo](#) · [Documentation](docs/DOCUMENTATION.md) · [Deployment Guide](docs/DEPLOYMENT.md) · [Project Report](docs/PROJECT_REPORT.md)

</div>

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Solution](#solution)
4. [Features](#features)
5. [Architecture](#architecture)
6. [Folder Structure](#folder-structure)
7. [Tech Stack](#tech-stack)
8. [Getting Started](#getting-started)
9. [Environment Variables](#environment-variables)
10. [API Documentation](#api-documentation)
11. [Database](#database)
12. [Testing](#testing)
13. [Screenshots](#screenshots)
14. [Deployment](#deployment)
15. [Limitations](#limitations)
16. [Future Scope](#future-scope)
17. [License](#license)
18. [Contributors](#contributors)
19. [Acknowledgements](#acknowledgements)

---

## Project Overview

MealMatch AI is a full-stack web application that searches for a food or grocery
item across multiple delivery platforms **at the same time, live**, and tells you
which one is actually cheaper once delivery fees are factored in. There is no
product catalog, no cached price list, and no simulated data anywhere in this
codebase — every price shown was scraped from the provider's own website in the
last few seconds, using a real, headless browser.

## Problem Statement

Anyone ordering food or groceries online today has to manually open Swiggy,
then Zomato, then Blinkit, search the same item three times, and mentally
compare price + delivery fee + ETA across three different apps before deciding
where to order from. This is slow, easy to get wrong, and nobody actually does
it consistently — so people habitually overpay or wait longer than they need
to, simply because comparison-shopping across delivery apps is tedious enough
that most people skip it.

## Solution

MealMatch AI removes that friction with a single search box: type what you
want, and the backend queries every supported provider **in parallel**,
normalizes the results into one schema, computes the actual cheapest option
(price + delivery fee + platform/packing fee where available), and presents
all of it side-by-side with a clear winner call-out — while gracefully
degrading (never crashing, never showing a raw error) if any individual
provider is unreachable.

## Features

- 🔎 **Live parallel search** across Swiggy (food), Zomato (food), and Blinkit
  (grocery) — one search, all providers queried concurrently, not sequentially.
- 🏆 **Automatic winner calculation** — cheapest effective cost wins, with ETA
  as an explicit, visible tiebreaker; an animated winner banner shows the
  exact savings.
- 📍 **Location onboarding** — "Use Current Location" (Geolocation API +
  reverse geocoding) or "Enter Location Manually" (live city search), stored
  globally and persisted across visits.
- 🌗 **Dark mode** — system-preference-aware on first visit, persisted,
  smooth-transitioning, applied to every screen.
- 🔗 **Deep links to the exact product** — clicking a result opens that exact
  item on the provider's site (verified live for Blinkit's PDP and scoped for
  Swiggy's search), never the homepage. When no reliable deep link can be
  constructed, the Open action is visibly disabled with a
  "Exact product page unavailable." tooltip instead of guessing.
- 🧭 **Provider sorting & graceful failover** — working providers are shown
  first (cheapest first), failed/unavailable providers are grouped at the
  bottom with a clean "Currently Unavailable" state — **never** a raw
  `net::ERR_*` message or stack trace.
- ⚡ **Resilient scraping** — retry with exponential backoff, UA rotation,
  randomized request pacing, short-lived session/cookie reuse, and a circuit
  breaker that stops hammering a provider that's currently down (falls back
  to an instant "unavailable" instead of waiting out a timeout on every
  request).
- 🩶 **Skeleton loading, code-split routes, memoized list rendering, lazy
  images** — see [Performance](docs/DOCUMENTATION.md#14-performance-optimizations).

## Architecture

```
┌────────────┐        REST/JSON        ┌────────────┐       REST/JSON       ┌──────────────────┐
│   Client   │ ───────────────────────►│   Server   │──────────────────────►│      Scraper       │
│ React+Vite │◄─────────────────────── │ Node+Express│◄────────────────────  │ FastAPI+Playwright │
└────────────┘                         └──────┬─────┘                       └─────────┬─────────┘
                                               │                                       │
                                               │ Mongoose                    real HTTPS requests,
                                               ▼                             one headless browser
                                        ┌─────────────┐                      per provider request
                                        │ MongoDB     │                                │
                                        │ Atlas       │                    ┌───────────┼───────────┐
                                        └─────────────┘                    ▼           ▼           ▼
                                                                        Swiggy      Zomato      Blinkit
```

The client never talks to the scraper or the database directly — it only ever
calls the server's REST API. The server owns all business logic (caching,
scoring, sorting, error translation) and is the only thing that knows the
scraper exists. The scraper is a stateless automation microservice: given a
location and a query, it returns normalized data or a structured error — no
database access, no business logic. This isolation is what lets each service
be redeployed or swapped independently (see `docs/architecture.md` for the
original design log, and `docs/DOCUMENTATION.md` for the full breakdown).

## Folder Structure

```
MealMatchAI/
├── client/                  # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components (Hero, Navigation, ComparisonPage, ...)
│   │   ├── hooks/           # useGeolocation, useDebouncedValue, useMealMatchQueries
│   │   ├── lib/             # api client, platform registry, theme/location contexts
│   │   ├── types/           # API response TypeScript types
│   │   └── App.tsx
│   └── .env.example
├── server/                  # Node + Express + TypeScript backend
│   ├── src/
│   │   ├── routes/          # /location /platforms /foods /compare
│   │   ├── services/        # compareService, scoringService, scraperClient, ...
│   │   ├── models/           # Mongoose schemas (cache, history)
│   │   ├── middleware/       # validation, rate limiting, error handling
│   │   └── config/           # env, db connection
│   └── .env.example
├── scraper/                  # Python + FastAPI + Playwright microservice
│   ├── app/
│   │   ├── scrapers/         # swiggy.py, zomato.py, blinkit.py, resilience.py
│   │   ├── schemas/          # Pydantic models
│   │   └── core/config.py
│   ├── Dockerfile
│   └── .env.example
├── docs/
│   ├── architecture.md       # original design log / phase plan
│   ├── DOCUMENTATION.md      # complete technical documentation
│   ├── PROJECT_REPORT.md     # academic-style project report
│   └── DEPLOYMENT.md         # step-by-step deployment guide
├── render.yaml                # Render Blueprint (backend + scraper)
└── LICENSE
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, TanStack Query |
| Backend | Node.js, Express 5, TypeScript, Zod, Mongoose |
| Scraper | Python 3.11, FastAPI, Playwright (Chromium), Pydantic |
| Database | MongoDB (Atlas in production, `mongodb-memory-server` fallback in local dev) |
| Testing | Vitest + Testing Library (client & server), pytest + pytest-asyncio (scraper) |
| Hosting | Vercel (client), Render (server + scraper), MongoDB Atlas (database) |

## Getting Started

Prerequisites: Node.js 20+, Python 3.11+, and Chromium's OS-level dependencies
(installed automatically by `playwright install`).

```bash
# 1. Client
cd client
cp .env.example .env
npm install
npm run dev          # http://localhost:5173

# 2. Server (separate terminal)
cd server
cp .env.example .env
npm install
npm run dev           # http://localhost:4000

# 3. Scraper (separate terminal)
cd scraper
cp .env.example .env
python -m venv venv
./venv/Scripts/activate      # Windows — use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python -m playwright install chromium
python -m uvicorn app.main:app --port 8000   # http://localhost:8000
```

All three must be running simultaneously for the app to function end to end.
Without a real `MONGODB_URI`, the server falls back to an in-memory MongoDB
instance automatically — fine for trying the app locally, but data won't
persist across restarts.

## Environment Variables

Each service ships a `.env.example` documenting exactly what it needs:

- [`client/.env.example`](client/.env.example) — just the backend's base URL
- [`server/.env.example`](server/.env.example) — Mongo URI, scraper URL, CORS origin, rate limits, Nominatim contact info
- [`scraper/.env.example`](scraper/.env.example) — port, headless mode, navigation timeout

Never commit a real `.env` — it's excluded project-wide via `.gitignore`.

## API Documentation

Full request/response contracts (including error shapes) are in
[`docs/DOCUMENTATION.md` → API Documentation](docs/DOCUMENTATION.md#8-api-documentation).
Quick reference:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`  | `/api/location/resolve?lat&lng` | Reverse-geocode coordinates to a place name |
| `GET`  | `/api/location/search?q=` | Forward-geocode a city name to coordinates |
| `GET`  | `/api/platforms/availability?lat&lng` | Live per-provider availability, sorted working-first |
| `GET`  | `/api/foods/suggested?lat&lng` | "Popular near you" per provider |
| `POST` | `/api/compare` | The core comparison — `{ lat, lng, query }` → normalized, sorted, scored results |

## Database

MongoDB collections: `ComparisonCache` (10-minute TTL — prices are volatile),
`SuggestedFoodsCache` (45-minute TTL), `SearchHistory` (unbounded, used for
future analytics). Full schema definitions, indexing, and caching/expiry
behavior are documented in
[`docs/DOCUMENTATION.md` → Database Design](docs/DOCUMENTATION.md#7-database-design).

## Testing

```bash
cd client  && npm test    # Vitest + Testing Library
cd server  && npm test    # Vitest
cd scraper && pytest      # pytest + pytest-asyncio
```

77 automated tests across all three services as of this release (client
component tests, server unit/integration tests with the scraper mocked,
scraper fixture-based parser tests + resilience-helper unit tests).

## Screenshots

> Screenshots aren't checked into this repository yet — run the app locally
> (see [Getting Started](#getting-started)) or deploy it
> ([Deployment](#deployment)) to see it live. Add your own screenshots to
> `docs/screenshots/` and link them here before publishing, rather than
> relying on this placeholder.

## Deployment

Frontend → **Vercel**, Backend → **Render**, Scraper → **Render (Docker)**,
Database → **MongoDB Atlas**. Full step-by-step instructions, exact
environment variables per platform, and the reasoning behind each choice are
in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Limitations

Documented in full, honestly, in
[`docs/DOCUMENTATION.md` → Limitations](docs/DOCUMENTATION.md#17-limitations) —
the short version: only 3 of the ~11 providers commonly requested for this
kind of app are actually live-scraped (Swiggy, Zomato, Blinkit); the rest are
shown as visible "Coming Soon" cards rather than faked. Live scraping is
inherently fragile to upstream DOM/API changes.

## Future Scope

AI-powered recommendations, coupon/offer aggregation, additional live
providers (Zepto, Instamart, BigBasket, JioMart, Magicpin), native mobile
apps, usage analytics, and personalization — detailed in
[`docs/DOCUMENTATION.md` → Future Roadmap](docs/DOCUMENTATION.md#18-future-roadmap).

## License

[MIT](LICENSE) — see the LICENSE file. If this project is intended to stay
proprietary (e.g. for a funded startup rather than a portfolio/academic
piece), replace this license before making the repository public.

## Contributors

- **Rohithvasanthan** — Founding engineer / sole contributor to date.

## Acknowledgements

- [OpenStreetMap Nominatim](https://nominatim.org/) for free, no-API-key geocoding.
- [Playwright](https://playwright.dev/) for making reliable browser automation possible.
- The design language of [Linear](https://linear.app) and [Vercel](https://vercel.com) as the visual reference for this project's UI.
