import { ComparisonCache } from "../models/ComparisonCache.js"
import { PlatformAvailabilityCache } from "../models/PlatformAvailabilityCache.js"
import { SuggestedFoodsCache } from "../models/SuggestedFoodsCache.js"
import type { ComparisonResult, PlatformAvailability, SuggestedFoodsResult } from "../types/domain.js"

export async function getCachedComparison(cacheKey: string): Promise<ComparisonResult | null> {
  const doc = await ComparisonCache.findOne({ cacheKey }).lean()
  if (!doc) return null

  return {
    query: doc.query,
    lat: doc.lat,
    lng: doc.lng,
    results: doc.results as unknown as ComparisonResult["results"],
    bestDeal: (doc.bestDeal as unknown as ComparisonResult["bestDeal"]) ?? null,
    cached: true,
    timestamp: doc.createdAt.toISOString(),
  }
}

export async function saveComparisonCache(
  cacheKey: string,
  result: Omit<ComparisonResult, "cached" | "timestamp">,
): Promise<void> {
  await ComparisonCache.findOneAndUpdate(
    { cacheKey },
    {
      cacheKey,
      query: result.query,
      lat: result.lat,
      lng: result.lng,
      results: result.results,
      bestDeal: result.bestDeal,
      createdAt: new Date(),
    },
    { upsert: true },
  )
}

export async function getCachedSuggested(cacheKey: string): Promise<SuggestedFoodsResult | null> {
  const doc = await SuggestedFoodsCache.findOne({ cacheKey }).lean()
  if (!doc) return null

  return {
    lat: doc.lat,
    lng: doc.lng,
    results: doc.results as unknown as SuggestedFoodsResult["results"],
    cached: true,
    timestamp: doc.createdAt.toISOString(),
  }
}

export async function saveSuggestedCache(
  cacheKey: string,
  result: Omit<SuggestedFoodsResult, "cached" | "timestamp">,
): Promise<void> {
  await SuggestedFoodsCache.findOneAndUpdate(
    { cacheKey },
    {
      cacheKey,
      lat: result.lat,
      lng: result.lng,
      results: result.results,
      createdAt: new Date(),
    },
    { upsert: true },
  )
}

export async function getCachedPlatformAvailability(cacheKey: string): Promise<PlatformAvailability[] | null> {
  const doc = await PlatformAvailabilityCache.findOne({ cacheKey }).lean()
  if (!doc) return null
  return doc.availability as unknown as PlatformAvailability[]
}

export async function savePlatformAvailabilityCache(
  cacheKey: string,
  lat: number,
  lng: number,
  availability: PlatformAvailability[],
): Promise<void> {
  await PlatformAvailabilityCache.findOneAndUpdate(
    { cacheKey },
    { cacheKey, lat, lng, availability, createdAt: new Date() },
    { upsert: true },
  )
}
