import axios from "axios"
import { env } from "../config/env.js"
import { AppError } from "../lib/AppError.js"
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
  try {
    const { data } = await scraperHttp.post<{
      platform: Platform
      available: boolean
      error_code?: PlatformAvailability["errorCode"]
      error_message?: string
    }>(`/scrape/${platform}/availability`, { lat, lng })
    return {
      platform: data.platform,
      available: data.available,
      errorCode: data.error_code,
      errorMessage: data.error_message,
    }
  } catch (err) {
    toUpstreamError(platform, err)
  }
}

export async function searchPlatform(
  platform: Platform,
  lat: number,
  lng: number,
  query: string,
): Promise<PlatformSearchResult> {
  try {
    const { data } = await scraperHttp.post<{
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
        image_url?: string
      }>
      error_code?: PlatformSearchResult["errorCode"]
      error_message?: string
    }>(`/scrape/${platform}/search`, { lat, lng, query })

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
        imageUrl: item.image_url,
      })),
    }
  } catch (err) {
    toUpstreamError(platform, err)
  }
}

export async function getSuggested(
  platform: Platform,
  lat: number,
  lng: number,
): Promise<PlatformSuggestedResult> {
  try {
    const { data } = await scraperHttp.post<{
      platform: Platform
      availability: PlatformSuggestedResult["availability"]
      items: Array<{
        id: string
        name: string
        restaurant_name: string
        price: number
        image_url?: string
      }>
      error_code?: PlatformSuggestedResult["errorCode"]
      error_message?: string
    }>(`/scrape/${platform}/suggested`, { lat, lng })

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
      })),
    }
  } catch (err) {
    toUpstreamError(platform, err)
  }
}
