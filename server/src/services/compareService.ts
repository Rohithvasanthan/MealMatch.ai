import { buildComparisonCacheKey, normalizeQuery } from "../utils/cacheKey.js"
import { mapWithConcurrency } from "../utils/concurrency.js"
import { getCachedComparison, saveComparisonCache } from "./cacheService.js"
import { recordSearch } from "./historyService.js"
import { classifyQuery, filterRelevantItems } from "./relevanceService.js"
import { searchPlatform } from "./scraperClient.js"
import { computeBestDeal, PLATFORM_CATEGORY, PLATFORM_NAMES, sortByPriority } from "./scoringService.js"
import type { ComparisonResult, Platform, PlatformSearchResult } from "../types/domain.js"

const PLATFORMS: Platform[] = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]
// See platformsService.ts for why this is throttled rather than fully parallel.
const SEARCH_CONCURRENCY = 2

export async function compare(rawQuery: string, lat: number, lng: number): Promise<ComparisonResult> {
  const query = normalizeQuery(rawQuery)
  const cacheKey = buildComparisonCacheKey(query, lat, lng)

  const cached = await getCachedComparison(cacheKey)
  if (cached) return cached

  // Route to only the platforms matching the query's category (food vs
  // grocery) — a grocery search never invokes Swiggy/Zomato's scrapers and
  // vice versa, cutting latency and avoidable load on irrelevant platforms.
  const category = classifyQuery(query)
  const platforms = PLATFORMS.filter((platform) => PLATFORM_CATEGORY[platform] === category)

  const settled = await mapWithConcurrency(platforms, SEARCH_CONCURRENCY, (platform) =>
    searchPlatform(platform, lat, lng, query),
  )

  const settledResults: PlatformSearchResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value
    return {
      platform: platforms[i],
      availability: "error",
      items: [],
      errorCode: "UPSTREAM_ERROR",
      errorMessage: outcome.reason instanceof Error ? outcome.reason.message : "Scraper request failed",
    }
  })

  // Platforms often return loosely-related results alongside exact matches
  // (e.g. a "biryani" search surfacing unrelated dishes); trim those out
  // before scoring so only genuinely relevant items are compared.
  const relevantResults: PlatformSearchResult[] = settledResults.map((result) => {
    if (result.availability !== "available" || result.items.length === 0) return result
    const items = filterRelevantItems(result.items, query)
    if (items.length === 0) {
      return {
        ...result,
        items: [],
        errorCode: "ITEM_NOT_FOUND",
        errorMessage: `No results for "${query}" near this location on ${PLATFORM_NAMES[result.platform]}`,
      }
    }
    return { ...result, items }
  })

  const bestDeal = computeBestDeal(relevantResults)
  const results = sortByPriority(relevantResults)
  const result: Omit<ComparisonResult, "cached" | "timestamp"> = { query, lat, lng, results, bestDeal }

  await saveComparisonCache(cacheKey, result)
  await recordSearch(query, lat, lng)

  return { ...result, cached: false, timestamp: new Date().toISOString() }
}
