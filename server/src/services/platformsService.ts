import { getCachedPlatformAvailability, savePlatformAvailabilityCache } from "./cacheService.js"
import { checkAvailability } from "./scraperClient.js"
import { buildPlatformAvailabilityCacheKey } from "../utils/cacheKey.js"
import { mapWithConcurrency } from "../utils/concurrency.js"
import type { Platform, PlatformAvailability } from "../types/domain.js"

// The scraper runs every request through one shared browser instance — an
// unthrottled sweep across all 7 platforms at once can starve each other
// for resources on a memory-constrained deploy and time out (verified live:
// Swiggy, the one platform that doesn't need a full page render, succeeded
// while every DOM-driven platform hit the scraper request timeout). Capping
// how many run at once trades a little latency for actually completing.
const AVAILABILITY_CONCURRENCY = 3

export async function getPlatformAvailability(lat: number, lng: number): Promise<PlatformAvailability[]> {
  const cacheKey = buildPlatformAvailabilityCacheKey(lat, lng)

  const cached = await getCachedPlatformAvailability(cacheKey)
  if (cached) return cached

  const platforms: Platform[] = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]
  const results = await mapWithConcurrency(platforms, AVAILABILITY_CONCURRENCY, (platform) =>
    checkAvailability(platform, lat, lng),
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
