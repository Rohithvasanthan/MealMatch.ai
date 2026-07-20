import express from "express"
import cors from "cors"
import morgan from "morgan"
import { env } from "./config/env.js"

export function createApp() {
  const app = express()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"))

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  return app
}
