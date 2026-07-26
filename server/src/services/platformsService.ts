import { getCachedPlatformAvailability, savePlatformAvailabilityCache } from "./cacheService.js"
import { checkAvailability } from "./scraperClient.js"
import { buildPlatformAvailabilityCacheKey } from "../utils/cacheKey.js"
import type { Platform, PlatformAvailability } from "../types/domain.js"

export async function getPlatformAvailability(lat: number, lng: number): Promise<PlatformAvailability[]> {
  const cacheKey = buildPlatformAvailabilityCacheKey(lat, lng)

  const cached = await getCachedPlatformAvailability(cacheKey)
  if (cached) return cached

  const platforms: Platform[] = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]
  const results = await Promise.allSettled(
    platforms.map((platform) => checkAvailability(platform, lat, lng)),
  )

  const settled: PlatformAvailability[] = results.map((result, i) => {
    const platform = platforms[i]
    if (result.status === "fulfilled") return result.value
    return { platform, available: false, errorCode: "UPSTREAM_ERROR", errorMessage: result.reason?.message }
  })

  // Working providers first, unavailable ones last — stable within each group.
  const sorted = [...settled].sort((a, b) => Number(b.available) - Number(a.available))
  await savePlatformAvailabilityCache(cacheKey, lat, lng, sorted)
  return sorted
}
