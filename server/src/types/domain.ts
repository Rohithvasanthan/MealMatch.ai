export type Platform = "swiggy" | "zomato" | "eatsure" | "blinkit" | "zepto" | "instamart" | "bigbasket"
export type Availability = "available" | "not_serviceable" | "error"
export type ErrorCode =
  | "TIMEOUT"
  | "BLOCKED"
  | "NOT_SERVICEABLE"
  | "ITEM_NOT_FOUND"
  | "PARSE_ERROR"
  | "UPSTREAM_ERROR"

export interface MenuItem {
  id: string
  name: string
  restaurantName: string
  restaurantId: string
  price: number
  rating?: number
  etaMinutes?: number
  deliveryFee?: number
  platformFee?: number
  packingFee?: number
  originalPrice?: number
  offerText?: string
  distanceKm?: number
  imageUrl?: string
  itemUrl?: string
}

export interface PlatformSearchResult {
  platform: Platform
  availability: Availability
  items: MenuItem[]
  errorCode?: ErrorCode
  errorMessage?: string
}

export interface SuggestedItem {
  id: string
  name: string
  restaurantName: string
  price: number
  imageUrl?: string
  itemUrl?: string
}

export interface PlatformSuggestedResult {
  platform: Platform
  availability: Availability
  items: SuggestedItem[]
  errorCode?: ErrorCode
  errorMessage?: string
}

export interface PlatformAvailability {
  platform: Platform
  available: boolean
  errorCode?: ErrorCode
  errorMessage?: string
}

export interface BestDeal {
  winner: Platform
  reasoning: string
}

export interface ComparisonResult {
  query: string
  lat: number
  lng: number
  results: PlatformSearchResult[]
  bestDeal: BestDeal | null
  cached: boolean
  timestamp: string
}

export interface SuggestedFoodsResult {
  lat: number
  lng: number
  results: PlatformSuggestedResult[]
  cached: boolean
  timestamp: string
}

export interface ResolvedLocation {
  displayName: string
  city?: string
  state?: string
  lat: number
  lng: number
}

export interface LocationSuggestion {
  displayName: string
  city?: string
  state?: string
  lat: number
  lng: number
}
