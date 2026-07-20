import { checkAvailability } from "./scraperClient.js"
import type { PlatformAvailability } from "../types/domain.js"

export async function getPlatformAvailability(lat: number, lng: number): Promise<PlatformAvailability[]> {
  const results = await Promise.allSettled([
    checkAvailability("swiggy", lat, lng),
    checkAvailability("zomato", lat, lng),
  ])

  return results.map((result, i) => {
    const platform = i === 0 ? "swiggy" : "zomato"
    if (result.status === "fulfilled") return result.value
    return { platform, available: false, errorCode: "UPSTREAM_ERROR", errorMessage: result.reason?.message }
  })
}
