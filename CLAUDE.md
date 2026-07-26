# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MealMatch AI compares live prices for a food/grocery item across multiple
delivery platforms and surfaces the actual cheapest option (price + delivery
+ packing fees). There is no product catalog and no mock data — every result
comes from a real Playwright scrape run at request time. This constraint
drives most of the architecture: aggressive caching to keep it usable, and a
"never crash, never show a raw error" contract for when a provider blocks or
times out the scraper.

Three independently deployable services, each with its own `.env` (copy from
`.env.example`) and its own dependency install step — all three must be
running simultaneously for an end-to-end local run:

- `client/` — React 19 + TypeScript + Vite + Tailwind v4, port 5173
- `server/` — Node + Express 5 + TypeScript + Mongoose, port 4000
- `scraper/` — Python + FastAPI + Playwright, port 8000

`client` only ever calls `server`'s REST API. `server` owns caching, scoring,
and error translation, and is the only service that knows `scraper` exists.
`scraper` is stateless: given a location + query it returns normalized data
or a structured error, no DB access, no business logic. See
`docs/architecture.md` (design log) and `docs/DOCUMENTATION.md` (full
technical reference) for more detail than is repeated here.

## Commands

### client (`cd client`)
- `npm run dev` — Vite dev server on :5173
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — oxlint
- `npm run format` — prettier --write
- `npm run test` — vitest run (all tests)
- `npx vitest run src/components/__tests__/ComparisonPage.test.tsx` — single file
- `npx vitest` — watch mode

### server (`cd server`)
- `npm run dev` — `tsx watch src/index.ts`
- `npm run build` — `tsc -p tsconfig.json`
- `npm start` — run compiled `dist/index.js`
- `npm run lint` — eslint src
- `npm run format` — prettier --write
- `npm run test` — vitest run (all tests)
- `npx vitest run src/services/__tests__/scoringService.test.ts` — single file
- Without a real `MONGODB_URI` set, the server auto-falls-back to an
  in-memory Mongo instance (`mongodb-memory-server`) — fine for local dev,
  data does not persist across restarts.

### scraper (`cd scraper`)
- `python -m venv venv && ./venv/Scripts/activate` (Windows) then
  `pip install -r requirements.txt && python -m playwright install chromium`
- `python -m uvicorn app.main:app --port 8000 --reload` — dev server
- `pytest` — all tests (`testpaths = ["tests"]`, `asyncio_mode = "auto"`,
  configured in `pyproject.toml`)
- `pytest tests/test_zepto_scraper.py -k some_case` — single file/case
- `ruff check .` — lint
- `black .` — format

## Architecture notes

### Provider set and live status
`platformsService.ts` / `compareService.ts` hard-code the platform list:
`swiggy, zomato, blinkit, zepto, instamart, bigbasket`. Each has a scraper
module under `scraper/app/scrapers/`. Not all are equally "live" — this
matters when debugging a platform that always reports unavailable:
- Swiggy, Zomato, Blinkit, Zepto: working, warm-up navigation clears their
  bot challenge.
- Instamart (`swiggy.com/instamart`): hard-blocked by AWS WAF at the
  `/instamart` path specifically (the shared `swiggy.com` session doesn't
  help). Wired in with the standard contract but expected to fail.
- BigBasket: hard-blocked by Akamai Bot Manager headless-browser
  fingerprinting, a harder wall than the WAF JS-challenge on the others.

Per the project's explicit "legal and technically supported methods only"
policy (documented in `scraper/app/scrapers/resilience.py`), no
stealth/fingerprint-evasion (masking `navigator.webdriver`, spoofing
canvas/plugins, proxies/VPNs to route around a block) is used anywhere,
even where it would unblock Instamart/BigBasket. Don't add it. A blocked
provider is expected to legitimately exhaust its retries and report
"unavailable" — that is correct behavior, not a bug to route around with
evasion.

### Request flow (`compareService.ts`)
1. Normalize the query, build a cache key from `(query, lat, lng)`, check
   `cacheService` — cache hit short-circuits everything below.
2. `relevanceService.classifyQuery` buckets the query as food vs grocery;
   only platforms in that category (`PLATFORM_CATEGORY` in
   `scoringService.ts`) are queried — a grocery search never invokes
   Swiggy/Zomato. This is a latency/load optimization, not just filtering.
3. Query all matching platforms concurrently via `Promise.allSettled` —
   one slow/blocked provider never blocks the others.
4. `relevanceService.filterRelevantItems` trims loosely-matched items per
   platform (e.g. a "biryani" search surfacing unrelated dishes) before
   scoring; a platform that has zero relevant items after filtering is
   reported as `ITEM_NOT_FOUND`, not silently empty.
5. `scoringService.computeBestDeal` picks the winner by effective cost
   (price + delivery/packing fees), ETA as an explicit tiebreaker;
   `sortByPriority` puts working platforms first, failed ones last.
6. Result is cached and the search recorded to history, then returned.

### Error handling contract
Every layer degrades instead of throwing raw errors to the client:
- Scraper: any failure becomes a `ScraperError` with a `code` and a
  `_sanitize`d single-line message (see `scraper/app/scrapers/errors.py`) —
  multi-line Playwright call logs never leak to the response, though the
  full message is still logged server-side.
- Server: `Promise.allSettled` rejections are turned into a
  `PlatformSearchResult` with `availability: "error"` and an
  `errorCode`/`errorMessage`, not an exception — a failed platform is just
  another row in the comparison, sorted to the bottom.
- Client: never renders a raw `net::ERR_*` or stack trace; unavailable
  platforms get a "Currently Unavailable" state.

When adding a new platform or touching an existing scraper, preserve this:
failures must surface as data (a `ScraperError` / `PlatformSearchResult`
with an error code), never as an unhandled exception that could crash a
request for platforms that did succeed.

### Resilience (`scraper/app/scrapers/resilience.py`)
Shared helpers used by every scraper module: retry with exponential
backoff, UA rotation across a small pool of real Chrome/Edge strings,
randomized viewport, randomized request pacing, short-lived cookie/session
reuse. All of it operates on the client's own request behavior only — see
the "legal and technically supported methods only" note above before
changing anything here.
