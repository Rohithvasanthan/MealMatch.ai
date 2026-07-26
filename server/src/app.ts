import express from "express"
import cors from "cors"
import morgan from "morgan"
import { env } from "./config/env.js"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js"
import { apiRateLimiter } from "./middleware/rateLimiter.js"
import { apiRouter } from "./routes/index.js"

export function createApp() {
  const app = express()

  // Every /api response reflects live scraper/circuit-breaker state that can
  // change second to second. Express's default weak ETags would otherwise
  // let a browser silently keep reusing an old response (e.g. a transient
  // "all unavailable" snapshot) via 304s long after the underlying data has
  // changed, since ETag revalidation has no awareness of that staleness.
  app.set("etag", false)

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"))

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use("/api", apiRateLimiter, (_req, res, next) => {
    res.set("Cache-Control", "no-store")
    next()
  })
  app.use("/api", apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
