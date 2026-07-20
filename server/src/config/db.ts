import mongoose from "mongoose"
import { env } from "./env.js"

const isPlaceholderUri = !env.mongoUri || env.mongoUri.includes("<cluster>")

export async function connectDb() {
  mongoose.set("strictQuery", true)

  if (isPlaceholderUri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server")
    const memoryServer = await MongoMemoryServer.create()
    await mongoose.connect(memoryServer.getUri())
    console.log(
      "MONGODB_URI not configured — using an in-memory MongoDB instance for local development. " +
        "Data will not persist across restarts; set MONGODB_URI in server/.env to use a real Atlas cluster.",
    )
    return
  }

  await mongoose.connect(env.mongoUri)
  console.log("Connected to MongoDB")
}
