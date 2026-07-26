import type { Platform } from "@/types/api"

export type PlatformId =
  | Platform
  | "magicpin"
  | "eatsure"
  | "ondc"
  | "rapido"
  | "zepto"
  | "instamart"
  | "bigbasket"
  | "jiomart"

export type PlatformCategory = "food" | "grocery"

export interface PlatformMeta {
  id: PlatformId
  name: string
  short: string
  color: string
  bg: string
  live: boolean
  category: PlatformCategory
}

const REGISTRY: Record<PlatformId, PlatformMeta> = {
  swiggy: { id: "swiggy", name: "Swiggy", short: "SW", color: "oklch(0.64 0.19 40)", bg: "oklch(0.64 0.19 40 / 0.12)", live: true, category: "food" },
  zomato: { id: "zomato", name: "Zomato", short: "ZO", color: "oklch(0.58 0.22 25)", bg: "oklch(0.58 0.22 25 / 0.12)", live: true, category: "food" },
  blinkit: { id: "blinkit", name: "Blinkit", short: "BL", color: "oklch(0.78 0.18 115)", bg: "oklch(0.78 0.18 115 / 0.12)", live: true, category: "grocery" },
  magicpin: { id: "magicpin", name: "Magicpin", short: "MP", color: "oklch(0.62 0.19 340)", bg: "oklch(0.62 0.19 340 / 0.12)", live: false, category: "food" },
  eatsure: { id: "eatsure", name: "EatSure", short: "ES", color: "oklch(0.6 0.17 150)", bg: "oklch(0.6 0.17 150 / 0.12)", live: true, category: "food" },
  ondc: { id: "ondc", name: "ONDC", short: "ON", color: "oklch(0.55 0.18 264)", bg: "oklch(0.55 0.18 264 / 0.12)", live: false, category: "food" },
  rapido: { id: "rapido", name: "Rapido Food", short: "RF", color: "oklch(0.7 0.19 95)", bg: "oklch(0.7 0.19 95 / 0.12)", live: false, category: "food" },
  zepto: { id: "zepto", name: "Zepto", short: "ZP", color: "oklch(0.6 0.21 305)", bg: "oklch(0.6 0.21 305 / 0.12)", live: true, category: "grocery" },
  instamart: { id: "instamart", name: "Instamart", short: "IM", color: "oklch(0.64 0.19 40)", bg: "oklch(0.64 0.19 40 / 0.12)", live: true, category: "grocery" },
  bigbasket: { id: "bigbasket", name: "BigBasket", short: "BB", color: "oklch(0.58 0.16 155)", bg: "oklch(0.58 0.16 155 / 0.12)", live: true, category: "grocery" },
  jiomart: { id: "jiomart", name: "JioMart", short: "JM", color: "oklch(0.5 0.18 260)", bg: "oklch(0.5 0.18 260 / 0.12)", live: false, category: "grocery" },
}

export const LIVE_PLATFORMS: PlatformId[] = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]
export const ROADMAP_PLATFORMS: PlatformId[] = ["magicpin", "ondc", "rapido", "jiomart"]

const FALLBACK = (id: string): PlatformMeta => ({
  id: id as PlatformId,
  name: id,
  short: id.slice(0, 2).toUpperCase(),
  color: "oklch(0.55 0 0)",
  bg: "oklch(0.55 0 0 / 0.12)",
  live: false,
  category: "food",
})

export function platformMeta(id: string): PlatformMeta {
  return REGISTRY[id as PlatformId] ?? FALLBACK(id)
}
