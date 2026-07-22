# MealMatch AI — Project Report

*A Real-Time Multi-Platform Food and Grocery Price Comparison System*

---

## Abstract

MealMatch AI is a full-stack web application that performs live, concurrent
price comparison across multiple food-delivery and grocery quick-commerce
platforms — Swiggy, Zomato, and Blinkit — for a single user-provided search
query and location. Unlike a conventional aggregator that relies on a
pre-built, periodically-refreshed product catalog, this system queries each
provider's live website at request time using headless browser automation
(Playwright), normalizes the heterogeneous results into a common schema, and
computes the actual cheapest option by combining item price with whatever
delivery/platform fees are available. The system is implemented as three
independently deployable services — a React/TypeScript client, a
Node.js/Express API server, and a Python/FastAPI scraping microservice —
backed by MongoDB for short-lived result caching. This report documents the
problem motivating the system, the design and implementation decisions made,
the testing performed, and an honest account of the system's current
limitations and future scope.

## 1. Introduction

Online food and grocery delivery is now served by several competing
platforms, each with independently varying prices, delivery fees, and
delivery times for the same item at the same location. A price-conscious
user who wants the best deal must manually repeat the same search on every
platform and mentally compare the results — a task that is simple in
principle but tedious enough in practice that most users simply pick one app
out of habit rather than genuinely comparison-shopping. MealMatch AI
automates this comparison end-to-end: a single search triggers parallel,
live queries to every supported platform, and the system itself determines
and explains the cheapest option.

## 2. Literature Survey

Price-comparison and aggregation is a well-established category of consumer
web application (e.g., travel-fare aggregators, e-commerce price trackers).
Two dominant technical approaches exist in this space:

1. **Catalog-based aggregation** — a background process periodically scrapes
   or ingests provider catalogs into a central database, and user searches
   query that pre-built index. This is fast at query time but the data is
   only as fresh as the last ingestion run, and building/maintaining a
   catalog ingestion pipeline for delivery platforms (which do not offer
   public product-catalog APIs) is a substantial undertaking.
2. **Live/on-demand aggregation** — the query itself triggers real-time
   retrieval from each source. This guarantees freshness (no staleness
   window) at the cost of query-time latency and fragility to the source
   changing its page structure.

MealMatch AI deliberately adopts the second approach — explicitly a "no mock
data, no cached catalog" design decision recorded from the project's
earliest planning (`docs/architecture.md`) — because delivery-platform prices
(especially surge/demand-based delivery fees) are volatile enough that a
catalog-based system would frequently show stale, wrong numbers. The
trade-off accepted in exchange is query latency (a live search takes
seconds, not milliseconds) and vulnerability to upstream DOM/API changes,
both of which are addressed architecturally (parallelism, caching, resilient
retry) rather than by abandoning the live-data principle.

Browser automation via Playwright (rather than plain HTTP scraping) was
selected because modern delivery platforms rely on client-side rendering,
JS-based bot-detection challenges (observed directly against Swiggy's WAF
during development), and in at least one case (Blinkit) require actual
in-page interaction to trigger the API call that returns product data at
all — a plain `requests`/`httpx`-style scraper could not have retrieved this
data.

## 3. System Analysis

### 3.1 Existing System

Prior to this project, a user's only option is manual, sequential
comparison: open each provider's app/site individually, search the same
item, and remember or write down the price/fee/ETA from each before
deciding. No unified tool performs this automatically for Indian food and
grocery delivery platforms at the individual-item, live-price level (as
opposed to restaurant-discovery aggregators, which are a different problem —
they answer "which restaurants are near me," not "which platform is
cheapest for this exact item right now").

### 3.2 Proposed System

MealMatch AI: a single search interface that fans a query out to every
supported provider concurrently, normalizes and scores the results
server-side, and presents a ranked, explained comparison — with graceful,
non-technical degradation when any individual provider is unavailable.

## 4. Requirement Analysis

### 4.1 Functional Requirements

- FR1: The system shall accept a user location via device geolocation or manual city search.
- FR2: The system shall accept a free-text search query for a food or grocery item.
- FR3: The system shall query all live-supported providers concurrently for the given query and location.
- FR4: The system shall normalize each provider's response into a common item schema (name, restaurant/store, price, image, and available metadata such as rating/ETA/distance/offer).
- FR5: The system shall compute and clearly display the cheapest effective option (price + available fees), with a documented tiebreaker (ETA) when prices are equal.
- FR6: The system shall sort providers with working results first and unavailable/failed providers last.
- FR7: The system shall never display a raw technical error (network exception text, stack trace, HTTP status detail) to the end user.
- FR8: The system shall provide a working, exact-item deep link to the provider's site where one can be reliably constructed, and shall visibly disable that action (with an explanatory tooltip) where it cannot.
- FR9: The system shall cache comparison results for a short, configurable duration to reduce redundant scraping load.
- FR10: The system shall support both light and dark visual themes, persisted across sessions.

### 4.2 Non-Functional Requirements

- NFR1 (Performance): Provider queries must execute in parallel, not sequentially; the UI must show progressive loading feedback (skeleton states) rather than a blank screen during the multi-second live-scrape window.
- NFR2 (Reliability): A single provider's failure (timeout, block, parse error) must not cause the overall request to fail; the system must degrade to showing whichever providers succeeded.
- NFR3 (Resilience): The system should reduce redundant/wasteful load against a provider that is currently failing (circuit breaker) rather than retrying it at full cost indefinitely.
- NFR4 (Security): No secrets/credentials in source control; all inter-service configuration via environment variables; input validation on every API boundary.
- NFR5 (Maintainability): Each of the three services (client, server, scraper) must be independently deployable and testable, communicating only over documented HTTP contracts.
- NFR6 (Usability): The interface must be responsive across desktop, tablet, and mobile viewports, and accessible in both light and dark modes.
- NFR7 (Honesty/Data Integrity): No provider's data may be fabricated, mocked, or substituted — a provider that cannot be reached must be shown as unavailable, never silently backfilled with placeholder values.

## 5. Architecture

Three-tier service architecture: presentation (React client) → application
(Express API server, owns business logic and the database connection) →
integration (FastAPI/Playwright scraper, a stateless automation layer with
no business logic or persistence of its own). See
[`docs/DOCUMENTATION.md` §13](DOCUMENTATION.md#13-system-architecture) for
the full diagram. This separation was chosen specifically so the
resource-heavy, fragile component (browser automation) is isolated behind a
clean HTTP contract and can be scaled, redeployed, or even replaced
independently of the business-logic layer.

## 6. Modules

1. **Location Module** — geolocation capture, reverse/forward geocoding, global location state.
2. **Search Module** — the query input, popular-search shortcuts, category shortcuts, recent-search history.
3. **Orchestration Module** (server) — parallel provider fan-out, caching, scoring, sorting.
4. **Scraping Module** (scraper) — per-provider browser automation adapters behind a common interface.
5. **Resilience Module** — circuit breaker (server), retry/backoff + session reuse + UA rotation (scraper).
6. **Presentation Module** — the comparison UI itself: winner banner, provider columns, unavailable-provider handling, dark mode, animations.
7. **Persistence Module** — MongoDB-backed caching and search-history logging.

## 7. Workflow

See [`docs/DOCUMENTATION.md` §12](DOCUMENTATION.md#12-application-workflow)
for the complete step-by-step trace from page load to opening a product on
the provider's site. In summary: location → search → one API call → parallel
scrape → normalize → score → sort → cache → render → (optional) deep-link
click-through.

## 8. Implementation

Implemented incrementally across the phases recorded in
`docs/architecture.md` (repo/environment scaffolding → scraper service →
MongoDB data layer → Express API → frontend foundation → core features →
UI/animation polish → integration & resilience → testing → deployment
preparation), followed by two further hardening passes covering dark mode,
provider-failover error sanitization, deep-link correctness, and scraping
resilience (retry/backoff, circuit breaker, session reuse). Key
implementation decisions, each made deliberately rather than defaulted into:

- **Playwright over HTTP-only scraping** — required for JS-rendered pages and, for Blinkit specifically, an API that only responds to a request triggered by real in-page interaction.
- **Server-authoritative business logic** — the scraper returns raw normalized data and structured error codes only; scoring, sorting, and caching all happen in the Express layer, keeping the scraper stateless and swappable.
- **Error taxonomy over generic failure** — every scraper failure is classified into one of six specific codes (`TIMEOUT`, `BLOCKED`, `NOT_SERVICEABLE`, `ITEM_NOT_FOUND`, `PARSE_ERROR`, `UPSTREAM_ERROR`) at the source, even though the frontend ultimately collapses all of them to one of two generic user-facing messages — the specificity is preserved for logs/debugging without leaking to the UI.
- **In-memory circuit breaker over an external one** — given the project's scale, a lightweight per-process `Map`-based breaker (`server/src/services/providerHealth.ts`) was sufficient and avoided adding an external dependency (e.g. Redis) purely for this purpose.

## 9. Testing

Three independent automated test suites, run in CI-equivalent fashion locally:

- **Client** (Vitest + Testing Library): component-level tests covering loading/error/success states of the comparison page, error-message sanitization (explicitly asserting a raw technical error string never appears in the DOM), the disabled-Open-button tooltip behavior, and category-grid interaction.
- **Server** (Vitest): unit tests for the best-deal scoring algorithm (tie-breaking, third-platform handling), provider-priority sorting, cache-key normalization, the orchestration flow with the scraper mocked (parallel calls, per-platform error translation), and the circuit breaker's state transitions (opens after threshold, closes on success, per-platform independence, cooldown expiry).
- **Scraper** (pytest + pytest-asyncio): fixture-based tests pinning down the Swiggy response parser's exact expected behavior (in-stock filtering, price conversion, image URL construction), plus unit tests for the resilience helpers (retry-with-backoff success/exhaustion, session cache TTL/invalidation/key-independence).

At the time of this report: **77 automated tests**, all passing, across the
three suites, alongside clean TypeScript builds (`tsc`) for client and
server, clean lint (oxlint/eslint) for both, and a clean Python compile
check for the scraper. Manual end-to-end verification was additionally
performed against the live provider sites during development (see Results).

## 10. Results

- Live, successful multi-item comparisons were observed against real Swiggy
  and Blinkit data during development and testing (e.g., a live "milk" search
  returning dozens of real Swiggy dish results and a dozen real Blinkit
  grocery products, with a computed winner and a live-verified deep link to
  the exact Blinkit product page).
- Zomato could not be verified live from the development network due to a
  network-level block by Zomato's edge (independently confirmed via `curl`
  and a real browser) — this is disclosed as a limitation, not hidden.
- The circuit breaker + session-reuse resilience work produced a measured
  ~15x latency improvement on repeat requests to the same location during
  manual testing (a cold multi-provider search including a blocked provider
  took ~57 seconds; a subsequent request with the circuit open and sessions
  warm took ~3-4 seconds).
- A real bug was found and fixed during the final polish pass: the MongoDB
  cache schemas predated the addition of Blinkit and several newer item
  fields, causing Mongoose's default strict-mode field-stripping to silently
  drop deep-link URLs, offer text, and distance data specifically on cached
  (repeat) responses. This is documented as a case study in why the
  domain-shape duplication noted in Limitations is a real, not theoretical,
  risk.

## 11. Limitations

See [`docs/DOCUMENTATION.md` §17](DOCUMENTATION.md#17-limitations) for the
complete, unabridged list. Headline items: only 3 of the ~11 commonly
requested delivery/grocery providers are live-scraped (the rest are visibly
marked "Coming Soon," never faked); Zomato is unverified against this
project's development network; live scraping is inherently fragile to
upstream changes; per-item platform/packing fees are usually unavailable
from providers' public endpoints; there is no user authentication, order
placement, or production monitoring.

## 12. Future Enhancements

See [`docs/DOCUMENTATION.md` §18](DOCUMENTATION.md#18-future-roadmap):
additional live providers (Zepto, Instamart), AI-driven recommendations,
coupon/offer aggregation, shareable search URLs, native mobile clients,
analytics built on the already-logged search history, personalization, and
CI/CD automation.

## 13. Conclusion

MealMatch AI demonstrates a complete, working, three-tier live-data
aggregation system: real browser automation feeding a resilient orchestration
layer feeding a polished, accessible frontend, with deliberate engineering
choices at every layer to prioritize data honesty (no mock fallbacks),
graceful degradation (one provider's failure never breaks the experience),
and maintainability (clean service boundaries, comprehensive automated
tests). The project's own documentation of its limitations — rather than
overstating its completeness — is treated as a deliverable in itself,
consistent with the engineering standard the project was built to.

## 14. References

- Playwright documentation — https://playwright.dev/python/
- FastAPI documentation — https://fastapi.tiangolo.com/
- React documentation — https://react.dev/
- MongoDB / Mongoose documentation — https://mongoosejs.com/
- OpenStreetMap Nominatim usage policy — https://operations.osmfoundation.org/policies/nominatim/
- Tailwind CSS v4 documentation — https://tailwindcss.com/

## 15. Appendix

### A. Repository layout
See [`docs/DOCUMENTATION.md` §6](DOCUMENTATION.md#6-complete-folder-structure).

### B. API contract summary
See [`docs/DOCUMENTATION.md` §8](DOCUMENTATION.md#8-api-documentation).

### C. Environment variables
See `client/.env.example`, `server/.env.example`, `scraper/.env.example`.

### D. Test execution commands
```bash
cd client  && npm test
cd server  && npm test
cd scraper && pytest
```
