// Rounds to ~110m precision so nearby requests within the same
// neighborhood share a cache entry instead of each missing on tiny GPS jitter.
const COORD_PRECISION = 3

function roundCoord(value: number): number {
  return Number(value.toFixed(COORD_PRECISION))
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function buildLocationKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`
}

export function buildComparisonCacheKey(query: string, lat: number, lng: number): string {
  return `${normalizeQuery(query)}@${buildLocationKey(lat, lng)}`
}

export function buildSuggestedCacheKey(lat: number, lng: number): string {
  return buildLocationKey(lat, lng)
}

export function buildPlatformAvailabilityCacheKey(lat: number, lng: number): string {
  return buildLocationKey(lat, lng)
}
