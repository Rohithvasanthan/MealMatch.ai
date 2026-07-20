import { buildSuggestedCacheKey } from "../utils/cacheKey.js"
import { getCachedSuggested, saveSuggestedCache } from "./cacheService.js"
import { getSuggested } from "./scraperClient.js"
import type { Platform, PlatformSuggestedResult, SuggestedFoodsResult } from "../types/domain.js"

const PLATFORMS: Platform[] = ["swiggy", "zomato"]

export async function getSuggestedFoods(lat: number, lng: number): Promise<SuggestedFoodsResult> {
  const cacheKey = buildSuggestedCacheKey(lat, lng)

  const cached = await getCachedSuggested(cacheKey)
  if (cached) return cached

  const settled = await Promise.allSettled(PLATFORMS.map((platform) => getSuggested(platform, lat, lng)))

  const results: PlatformSuggestedResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value
    return {
      platform: PLATFORMS[i],
      availability: "error",
      items: [],
      errorCode: "UPSTREAM_ERROR",
      errorMessage: outcome.reason instanceof Error ? outcome.reason.message : "Scraper request failed",
    }
  })

  const result: Omit<SuggestedFoodsResult, "cached" | "timestamp"> = { lat, lng, results }
  await saveSuggestedCache(cacheKey, result)

  return { ...result, cached: false, timestamp: new Date().toISOString() }
}
