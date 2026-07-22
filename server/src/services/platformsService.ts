import { checkAvailability } from "./scraperClient.js"
import type { PlatformAvailability } from "../types/domain.js"

export async function getPlatformAvailability(lat: number, lng: number): Promise<PlatformAvailability[]> {
  const platforms: Array<"swiggy" | "zomato" | "blinkit"> = ["swiggy", "zomato", "blinkit"]
  const results = await Promise.allSettled(
    platforms.map((platform) => checkAvailability(platform, lat, lng)),
  )

  const settled: PlatformAvailability[] = results.map((result, i) => {
    const platform = platforms[i]
    if (result.status === "fulfilled") return result.value
    return { platform, available: false, errorCode: "UPSTREAM_ERROR", errorMessage: result.reason?.message }
  })

  // Working providers first, unavailable ones last — stable within each group.
  return [...settled].sort((a, b) => Number(b.available) - Number(a.available))
}
