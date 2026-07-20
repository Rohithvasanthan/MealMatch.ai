import "dotenv/config"

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI ?? "",
  scraperServiceUrl: process.env.SCRAPER_SERVICE_URL ?? "http://localhost:8000",
  scraperTimeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS ?? 30000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org",
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT ?? "MealMatchAI/1.0 (dev@localhost)",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 30),
}
