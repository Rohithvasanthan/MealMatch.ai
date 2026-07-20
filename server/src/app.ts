import express from "express"
import cors from "cors"
import morgan from "morgan"
import { env } from "./config/env.js"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js"
import { apiRateLimiter } from "./middleware/rateLimiter.js"
import { apiRouter } from "./routes/index.js"

export function createApp() {
  const app = express()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"))

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.use("/api", apiRateLimiter, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
