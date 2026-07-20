import { buildComparisonCacheKey, normalizeQuery } from "../utils/cacheKey.js"
import { getCachedComparison, saveComparisonCache } from "./cacheService.js"
import { recordSearch } from "./historyService.js"
import { searchPlatform } from "./scraperClient.js"
import { computeBestDeal } from "./scoringService.js"
import type { ComparisonResult, Platform, PlatformSearchResult } from "../types/domain.js"

const PLATFORMS: Platform[] = ["swiggy", "zomato"]

export async function compare(rawQuery: string, lat: number, lng: number): Promise<ComparisonResult> {
  const query = normalizeQuery(rawQuery)
  const cacheKey = buildComparisonCacheKey(query, lat, lng)

  const cached = await getCachedComparison(cacheKey)
  if (cached) return cached

  const settled = await Promise.allSettled(
    PLATFORMS.map((platform) => searchPlatform(platform, lat, lng, query)),
  )

  const results: PlatformSearchResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value
    return {
      platform: PLATFORMS[i],
      availability: "error",
      items: [],
      errorCode: "UPSTREAM_ERROR",
      errorMessage: outcome.reason instanceof Error ? outcome.reason.message : "Scraper request failed",
    }
  })

  const bestDeal = computeBestDeal(results)
  const result: Omit<ComparisonResult, "cached" | "timestamp"> = { query, lat, lng, results, bestDeal }

  await saveComparisonCache(cacheKey, result)
  await recordSearch(query, lat, lng)

  return { ...result, cached: false, timestamp: new Date().toISOString() }
}
