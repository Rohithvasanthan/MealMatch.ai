import axios from "axios"
import { env } from "../config/env.js"
import { AppError } from "../lib/AppError.js"
import { isCircuitOpen, recordFailure, recordSuccess } from "./providerHealth.js"
import type {
  Platform,
  PlatformAvailability,
  PlatformSearchResult,
  PlatformSuggestedResult,
} from "../types/domain.js"

const scraperHttp = axios.create({
  baseURL: env.scraperServiceUrl,
  timeout: env.scraperTimeoutMs,
})

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// One retry with a short backoff absorbs transient blips between this server
// and the scraper service (e.g. a brief connection reset) without doubling
// the user-facing wait on every request.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) throw err // a real HTTP error response — retrying won't help
    await sleep(300 + Math.random() * 200)
    return fn()
  }
}

function toUpstreamError(platform: Platform, err: unknown): never {
  const message = axios.isAxiosError(err)
    ? (err.response?.data?.error_message ?? err.message)
    : "Unknown scraper error"
  throw new AppError(502, "SCRAPER_UNAVAILABLE", `${platform} scraper request failed: ${message}`)
}

export async function checkAvailability(
  platform: Platform,
  lat: number,
  lng: number,
): Promise<PlatformAvailability> {
  if (isCircuitOpen(platform)) {
    return { platform, available: false, errorCode: "UPSTREAM_ERROR", errorMessage: "Provider temporarily disabled after repeated failures" }
  }
  try {
    const { data } = await withRetry(() =>
      scraperHttp.post<{
        platform: Platform
        available: boolean
        error_code?: PlatformAvailability["errorCode"]
        error_message?: string
      }>(`/scrape/${platform}/availability`, { lat, lng }),
    )
    if (data.available) recordSuccess(platform)
    else recordFailure(platform)
    return {
      platform: data.platform,
      available: data.available,
      errorCode: data.error_code,
      errorMessage: data.error_message,
    }
  } catch (err) {
    recordFailure(platform)
    toUpstreamError(platform, err)
  }
}

export async function searchPlatform(
  platform: Platform,
  lat: number,
  lng: number,
  query: string,
): Promise<PlatformSearchResult> {
  if (isCircuitOpen(platform)) {
    return {
      platform,
      availability: "error",
      items: [],
      errorCode: "UPSTREAM_ERROR",
      errorMessage: "Provider temporarily disabled after repeated failures",
    }
  }
  try {
    const { data } = await withRetry(() =>
      scraperHttp.post<{
        platform: Platform
        availability: PlatformSearchResult["availability"]
        items: Array<{
          id: string
          name: string
          restaurant_name: string
          restaurant_id: string
          price: number
          rating?: number
          eta_minutes?: number
          delivery_fee?: number
          platform_fee?: number
          packing_fee?: number
          original_price?: number
          offer_text?: string
          distance_km?: number
          image_url?: string
          item_url?: string
        }>
        error_code?: PlatformSearchResult["errorCode"]
        error_message?: string
      }>(`/scrape/${platform}/search`, { lat, lng, query }),
    )

    if (data.availability === "error") recordFailure(platform)
    else recordSuccess(platform)

    return {
      platform: data.platform,
      availability: data.availability,
      errorCode: data.error_code,
      errorMessage: data.error_message,
      items: data.items.map((item) => ({
        id: item.id,
        name: item.name,
        restaurantName: item.restaurant_name,
        restaurantId: item.restaurant_id,
        price: item.price,
        rating: item.rating,
        etaMinutes: item.eta_minutes,
        deliveryFee: item.delivery_fee,
        platformFee: item.platform_fee,
        packingFee: item.packing_fee,
        originalPrice: item.original_price,
        offerText: item.offer_text,
        distanceKm: item.distance_km,
        imageUrl: item.image_url,
        itemUrl: item.item_url,
      })),
    }
  } catch (err) {
    recordFailure(platform)
    toUpstreamError(platform, err)
  }
}

export async function getSuggested(
  platform: Platform,
  lat: number,
  lng: number,
): Promise<PlatformSuggestedResult> {
  if (isCircuitOpen(platform)) {
    return {
      platform,
      availability: "error",
      items: [],
      errorCode: "UPSTREAM_ERROR",
      errorMessage: "Provider temporarily disabled after repeated failures",
    }
  }
  try {
    const { data } = await withRetry(() =>
      scraperHttp.post<{
        platform: Platform
        availability: PlatformSuggestedResult["availability"]
        items: Array<{
          id: string
          name: string
          restaurant_name: string
          price: number
          image_url?: string
          item_url?: string
        }>
        error_code?: PlatformSuggestedResult["errorCode"]
        error_message?: string
      }>(`/scrape/${platform}/suggested`, { lat, lng }),
    )

    if (data.availability === "error") recordFailure(platform)
    else recordSuccess(platform)

    return {
      platform: data.platform,
      availability: data.availability,
      errorCode: data.error_code,
      errorMessage: data.error_message,
      items: data.items.map((item) => ({
        id: item.id,
        name: item.name,
        restaurantName: item.restaurant_name,
        price: item.price,
        imageUrl: item.image_url,
        itemUrl: item.item_url,
      })),
    }
  } catch (err) {
    recordFailure(platform)
    toUpstreamError(platform, err)
  }
}
