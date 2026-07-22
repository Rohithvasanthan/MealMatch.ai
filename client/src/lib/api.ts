import type {
  ComparisonResult,
  LocationSuggestion,
  PlatformAvailability,
  ResolvedLocation,
  SuggestedFoodsResult,
} from "@/types/api"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText,
    )
  }

  return res.json() as Promise<T>
}

export function resolveLocation(lat: number, lng: number) {
  return request<ResolvedLocation>(`/location/resolve?lat=${lat}&lng=${lng}`)
}

export async function searchLocations(query: string) {
  const { suggestions } = await request<{ suggestions: LocationSuggestion[] }>(
    `/location/search?q=${encodeURIComponent(query)}`,
  )
  return suggestions
}

export function getPlatformAvailability(lat: number, lng: number) {
  return request<{ availability: PlatformAvailability[] }>(
    `/platforms/availability?lat=${lat}&lng=${lng}`,
  )
}

export function getSuggestedFoods(lat: number, lng: number) {
  return request<SuggestedFoodsResult>(`/foods/suggested?lat=${lat}&lng=${lng}`)
}

export function compareFood(lat: number, lng: number, query: string) {
  return request<ComparisonResult>("/compare", {
    method: "POST",
    body: JSON.stringify({ lat, lng, query }),
  })
}
