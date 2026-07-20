import axios from "axios"
import { env } from "../config/env.js"
import { AppError } from "../lib/AppError.js"
import type { ResolvedLocation } from "../types/domain.js"

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
