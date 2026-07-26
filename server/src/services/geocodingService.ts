import axios from "axios"
import { env } from "../config/env.js"
import { AppError } from "../lib/AppError.js"
import type { LocationSuggestion, ResolvedLocation } from "../types/domain.js"

const nominatimHttp = axios.create({
  baseURL: env.nominatimBaseUrl,
  timeout: 10_000,
  headers: { "User-Agent": env.nominatimUserAgent },
})

interface NominatimReverseResponse {
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
  }
}

interface NominatimSearchResult {
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedLocation> {
  try {
    const { data } = await nominatimHttp.get<NominatimReverseResponse>("/reverse", {
      params: { lat, lon: lng, format: "jsonv2" },
    })

    return {
      displayName: data.display_name,
      city: data.address?.city ?? data.address?.town ?? data.address?.village,
      state: data.address?.state,
      lat,
      lng,
    }
  } catch (err) {
    const message = axios.isAxiosError(err) ? err.message : "Unknown geocoding error"
    throw new AppError(502, "GEOCODING_FAILED", `Reverse geocoding failed: ${message}`)
  }
}

// Nominatim's name matching is fairly literal — a plural/singular mismatch
// (e.g. "Hopes College" vs. the OSM-indexed "Hope College") or one
// unrecognized trailing word is enough to return zero results, even though
// the place is actually indexed. There's no true fuzzy/typo-tolerant search
// available on the free public API, so on an empty result we retry with a
// small set of looser variants of the same query before giving up — same
// spirit as Google Maps quietly correcting near-misses, without a paid API.
export function singularize(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1)
  }
  return token
}

export function buildFallbackQueries(query: string): string[] {
  const tokens = query.trim().split(/\s+/)
  const variants = new Set<string>()

  const singularized = tokens.map(singularize).join(" ")
  if (singularized.toLowerCase() !== query.trim().toLowerCase()) variants.add(singularized)

  // Progressively drop trailing words — handles a query that's overly
  // specific (e.g. a city/area suffix Nominatim doesn't recognize attached
  // to an otherwise-indexed place name).
  for (let i = tokens.length - 1; i > 0; i--) {
    variants.add(tokens.slice(0, i).join(" "))
  }

  return [...variants]
}

async function rawSearch(query: string): Promise<NominatimSearchResult[]> {
  const { data } = await nominatimHttp.get<NominatimSearchResult[]>("/search", {
    params: { q: query, format: "jsonv2", addressdetails: 1, countrycodes: "in", limit: 6 },
  })
  return data
}

export async function searchLocation(query: string): Promise<LocationSuggestion[]> {
  try {
    let data = await rawSearch(query)

    if (data.length === 0) {
      for (const variant of buildFallbackQueries(query)) {
        data = await rawSearch(variant)
        if (data.length > 0) break
      }
    }

    return data.map((r) => ({
      displayName: r.display_name,
      city: r.address?.city ?? r.address?.town ?? r.address?.village,
      state: r.address?.state,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
  } catch (err) {
    const message = axios.isAxiosError(err) ? err.message : "Unknown geocoding error"
    throw new AppError(502, "GEOCODING_FAILED", `Location search failed: ${message}`)
  }
}
