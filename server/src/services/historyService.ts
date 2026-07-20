import { SearchHistory } from "../models/SearchHistory.js"

export async function recordSearch(query: string, lat: number, lng: number): Promise<void> {
  try {
    await SearchHistory.create({ query, lat, lng })
  } catch (err) {
    console.error("Failed to record search history:", err)
  }
}
