# MealMatch AI — Architecture & Development Plan

## Context

MealMatch AI is a prototype that compares Swiggy vs Zomato prices, delivery fees, and delivery times for a given food search at the user's live location, using a Python/Playwright scraper behind a Node/Express API, with a React frontend and MongoDB Atlas for caching/history.

Decisions locked in:
- **No mock-data fallback.** Live Playwright scraping is the only data source. If a platform fails to scrape (bot detection, timeout, site change), the UI shows a clear per-platform error message rather than substituting fake data.
- **Full dynamic geolocation**, not a fixed list of test cities — Browser Geolocation API + reverse geocoding to any address in India.
- **Deployment target:** Dev = all 3 services local + MongoDB Atlas. Prototype hosting = Frontend on Vercel, Backend on Render, DB on Atlas, Scraper stays local for now. The architecture lets the scraper be swapped to a hosted URL later via env var alone, with no frontend changes.

## System Architecture

```
[React/Vite/TS Client] --REST--> [Node/Express/TS Backend] --HTTP--> [Python FastAPI/Playwright Scraper]
                                          |
                                     [MongoDB Atlas]
```

- **Client** talks only to the Node backend. It never calls the scraper or Mongo directly.
- **Backend** owns all business logic: caching, comparison scoring, error translation, and orchestrating parallel calls to the scraper for Swiggy + Zomato. It owns the Mongo connection.
- **Scraper** is a stateless microservice: given a location + query, it returns normalized results or a structured error code. No DB access, no business logic — just automation + extraction. This isolation is what lets it be redeployed independently later without touching the frontend (`SCRAPER_SERVICE_URL` is just an env var on the backend).

### Data flow for a comparison search
1. Client gets geolocation → reverse-geocodes to an address → sends `{lat, lng, query}` to backend.
2. Backend checks Mongo for a fresh cached result for that (normalized location, query) pair.
3. On cache miss, backend calls the scraper for Swiggy and Zomato **in parallel**, each with its own timeout.
4. Scraper sets the delivery location on the platform (this also determines **platform availability** — "not serviceable" is a distinct outcome from "error"), searches the item, and extracts price/delivery fee/ETA/restaurant per matching result.
5. Backend normalizes both platform responses into one schema, computes total cost (price + delivery fee), computes a **best-deal** comparison, caches the merged result (short TTL — prices are volatile), and returns it.
6. If one platform fails, the other's data still renders with a per-platform "unavailable right now" note. If both fail, the client shows a single friendly error and lets the user retry.

### Key schemas
- `PlatformResult`: platform, availability status (`available` / `not_serviceable` / `error`), matched items (name, restaurant, price, image), delivery fee, ETA minutes, error code if applicable.
- `ComparisonResult`: query, location, `PlatformResult[]`, computed best-deal winner + reasoning, timestamp.
- `SuggestedFood`: platform, item name, restaurant, thumbnail — sourced from a live scrape of each platform's location-based "popular near you" listing, cached longer than price data (~30–60 min) since it's less volatile.

### Scraper error taxonomy
`TIMEOUT`, `BLOCKED` (bot detection/CAPTCHA), `NOT_SERVICEABLE`, `ITEM_NOT_FOUND`, `PARSE_ERROR` (selectors broke — Swiggy/Zomato change their DOM often, this is the main long-term maintenance risk for this project). The backend maps each to a specific, honest user-facing message instead of a generic failure.

### Best-deal scoring
Effective cost = item price + delivery fee. Primary sort on effective cost; ETA used as an explicit tiebreaker/secondary signal shown alongside the winner (e.g., "Zomato is ₹15 cheaper" vs "same price, Swiggy is 10 min faster"), not folded into a single opaque score.

## Phases

**Phase 0 — Architecture & Contracts** — done (this document). Reverse-geocoding provider: **OpenStreetMap Nominatim** (free, no API key), called from the backend so no key is exposed to the client.

**Phase 1 — Repo & Environment Scaffolding** — monorepo layout (`/client`, `/server`, `/scraper`), TS configs + lint/format tooling for client & server, Python venv + requirements + ruff/black for scraper, `.env.example` per service, root README, git init.

**Phase 2 — Scraper Service (FastAPI + Playwright)** — FastAPI app with managed browser lifecycle, Swiggy and Zomato scraper modules behind a common interface (set-location/search/extract), timeouts + retry, structured error codes, `/compare` `/suggested` `/health` endpoints, logging geared toward diagnosing selector breakage.

**Phase 3 — MongoDB Data Layer** — Atlas cluster + network access, `comparison_cache` (TTL, short expiry), `suggested_foods_cache` (TTL, longer expiry), `search_history` collections, Mongoose schemas + connection module.

**Phase 4 — Node/Express Backend API** — routes/controllers/services structure, `/api/location/resolve` `/api/platforms/availability` `/api/foods/suggested` `/api/compare` endpoints, orchestration service (cache-check → parallel scraper calls → normalize → score → cache → respond), error-translation layer, CORS, validation (zod), rate limiting.

**Phase 5 — Frontend Foundation** — Vite + React + TS scaffold, Tailwind + shadcn/ui theme, Framer Motion, typed API client, React Query for server-state.

**Phase 6 — Core Frontend Features** — geolocation detection with manual override, platform availability badges, suggested nearby foods grid, debounced search, comparison cards, best-deal highlight, per-platform/full-failure error states.

**Phase 7 — Animations & UI Polish** — section/page transitions, staggered lists, animated comparison reveal, "fetching live prices…" loading experience (scraping can take 10–30s), responsive/mobile pass.

**Phase 8 — Integration & Resilience Pass** — wire all three services locally, real searches across several locations/queries, timeout tuning, partial/full failure UX verification, rate-limit checks.

**Phase 9 — Testing & QA** — scraper fixture-based extraction tests + manual live smoke tests, backend unit/integration tests (scraper mocked), frontend component tests, manual end-to-end QA.

**Phase 10 — Prototype Deployment** — Frontend → Vercel, Backend → Render (env: Atlas URI, `SCRAPER_SERVICE_URL`), DB → Atlas. Scraper stays local for now; Render can't reach `localhost`, so a live public demo of the compare feature needs the local scraper exposed via a tunnel (e.g. ngrok) during the session, or the full stack run locally.

**Phase 11 — Explicitly Future / Out of Scope** — deploying the scraper to the cloud (Dockerized Playwright), proxy rotation/anti-bot hardening, user accounts, deep-link-to-order, scheduled/background scraping, analytics dashboard.
