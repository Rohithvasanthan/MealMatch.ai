import type { BestDeal, MenuItem, Platform, PlatformSearchResult } from "../types/domain.js"

const PLATFORM_NAMES: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato", blinkit: "Blinkit" }

const TIE_EPSILON = 0.01

// Final cost = food price + delivery fee + platform fee + packing fee.
// The scrapers only expose delivery/platform/packing fees where the
// provider's public search response actually carries them (none currently
// do — they're computed at checkout) so these terms are 0 until populated;
// nothing here is guessed.
function finalCost(item: MenuItem): number {
  return item.price + (item.deliveryFee ?? 0) + (item.platformFee ?? 0) + (item.packingFee ?? 0)
}

function cheapestEffectiveCost(result: PlatformSearchResult): number | null {
  if (result.availability !== "available" || result.items.length === 0) return null
  const costs = result.items.map(finalCost)
  return Math.min(...costs)
}

function cheapestItem(result: PlatformSearchResult) {
  return result.items.reduce((cheapest, item) => (finalCost(item) < finalCost(cheapest) ? item : cheapest), result.items[0])
}

// Working providers first, unavailable ones pushed to the bottom. Within
// "available", cheapest-final-cost first. Sort is stable so platforms tied
// on rank keep their original relative order.
const AVAILABILITY_RANK: Record<PlatformSearchResult["availability"], number> = {
  available: 0,
  not_serviceable: 1,
  error: 2,
}

export function sortByPriority<T extends PlatformSearchResult>(results: T[]): T[] {
  return [...results].sort((a, b) => {
    const rankDiff = AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability]
    if (rankDiff !== 0) return rankDiff
    if (a.availability !== "available") return 0
    const costA = cheapestEffectiveCost(a)
    const costB = cheapestEffectiveCost(b)
    if (costA == null || costB == null) return 0
    return costA - costB
  })
}

export function computeBestDeal(results: PlatformSearchResult[]): BestDeal | null {
  if (results.length < 2) return null

  const contenders = results
    .map((result) => ({ result, cost: cheapestEffectiveCost(result) }))
    .filter((c): c is { result: PlatformSearchResult; cost: number } => c.cost !== null)

  if (contenders.length === 0) return null

  if (contenders.length === 1) {
    const only = contenders[0].result.platform
    return { winner: only, reasoning: `Only ${PLATFORM_NAMES[only]} has this item available` }
  }

  // Stable sort keeps original platform order (swiggy, zomato, blinkit, ...) as the tiebreak order.
  const sorted = [...contenders].sort((a, b) => a.cost - b.cost)
  const cheapest = sorted[0]
  const runnerUp = sorted[1]
  const diff = runnerUp.cost - cheapest.cost

  if (diff > TIE_EPSILON) {
    const winner = cheapest.result.platform
    return {
      winner,
      reasoning: `${PLATFORM_NAMES[winner]} is ₹${diff.toFixed(0)} cheaper than ${PLATFORM_NAMES[runnerUp.result.platform]}`,
    }
  }

  // Everyone within TIE_EPSILON of the minimum cost goes to an ETA tiebreaker.
  const tied = sorted.filter((c) => c.cost - cheapest.cost <= TIE_EPSILON)
  const tiedByEta = [...tied].sort((a, b) => {
    const etaA = cheapestItem(a.result).etaMinutes
    const etaB = cheapestItem(b.result).etaMinutes
    if (etaA == null || etaB == null) return 0
    return etaA - etaB
  })
  const fastest = tiedByEta[0]
  const fastestEta = cheapestItem(fastest.result).etaMinutes
  const nextEta = tiedByEta[1] ? cheapestItem(tiedByEta[1].result).etaMinutes : null

  if (fastestEta != null && nextEta != null && fastestEta !== nextEta) {
    const winner = fastest.result.platform
    const etaDiff = nextEta - fastestEta
    if (tied.length === 2) {
      return {
        winner,
        reasoning: `Same price on both — ${PLATFORM_NAMES[winner]} is ${etaDiff} min faster`,
      }
    }
    return {
      winner,
      reasoning: `Same price across platforms — ${PLATFORM_NAMES[winner]} is ${etaDiff} min faster than the next-fastest option`,
    }
  }

  const winner = cheapest.result.platform
  return {
    winner,
    reasoning:
      tied.length === 2
        ? "Same price and delivery time on both platforms"
        : "Same price and delivery time across all matching platforms",
  }
}
