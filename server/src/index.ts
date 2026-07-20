import { createApp } from "./app.js"
import { env } from "./config/env.js"
import { connectDb } from "./config/db.js"

async function main() {
  await connectDb()
  const app = createApp()
  app.listen(env.port, () => {
    console.log(`MealMatch AI backend listening on port ${env.port}`)
  })
}

main().catch((err) => {
  console.error("Failed to start server:", err)
  process.exit(1)
})
