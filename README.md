# MealMatch AI

Prototype that compares Swiggy vs Zomato food prices, delivery fees, and delivery
times for a given search at the user's live location.

See `docs/architecture.md` for the system design and phase-by-phase build plan.

## Services

| Service   | Stack                                      | Path        | Default port |
|-----------|---------------------------------------------|-------------|---------------|
| client    | React + Vite + TS + Tailwind v4 + shadcn/ui + Framer Motion | `client/`   | 5173 |
| server    | Node + Express + TypeScript                | `server/`   | 4000 |
| scraper   | Python + FastAPI + Playwright              | `scraper/`  | 8000 |

Data: MongoDB Atlas. Connection string configured via `server/.env` (`MONGODB_URI`).
If `MONGODB_URI` is unset (or left as the `.env.example` placeholder), the
server falls back to an in-memory MongoDB instance so it's runnable before an
Atlas cluster is provisioned — data won't persist across restarts in that mode.

## Running locally

Each service is run independently; copy `.env.example` to `.env` in `client/`,
`server/`, and `scraper/` first (see each file for required values).

```bash
# client
cd client && npm install && npm run dev

# server
cd server && npm install && npm run dev

# scraper
cd scraper
python -m venv venv
./venv/Scripts/activate   # Windows
pip install -r requirements.txt
python -m playwright install chromium
uvicorn app.main:app --reload --port 8000
```

The server talks to the scraper via `SCRAPER_SERVICE_URL` (defaults to
`http://localhost:8000`) — this is the only integration point, so the scraper
can later move to its own deployment without any frontend changes.
