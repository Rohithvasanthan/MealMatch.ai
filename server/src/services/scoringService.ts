import type { BestDeal, PlatformSearchResult } from "../types/domain.js"

function cheapestEffectiveCost(result: PlatformSearchResult): number | null {
  if (result.availability !== "available" || result.items.length === 0) return null
  const costs = result.items.map((item) => item.price + (item.deliveryFee ?? 0))
  return Math.min(...costs)
}

function cheapestItem(result: PlatformSearchResult) {
  return result.items.reduce((cheapest, item) => {
    const cost = item.price + (item.deliveryFee ?? 0)
    const cheapestCost = cheapest.price + (cheapest.deliveryFee ?? 0)
    return cost < cheapestCost ? item : cheapest
  }, result.items[0])
}

export function computeBestDeal(results: PlatformSearchResult[]): BestDeal | null {
  const swiggy = results.find((r) => r.platform === "swiggy")
  const zomato = results.find((r) => r.platform === "zomato")
  if (!swiggy || !zomato) return null

  const swiggyCost = cheapestEffectiveCost(swiggy)
  const zomatoCost = cheapestEffectiveCost(zomato)

  if (swiggyCost === null && zomatoCost === null) return null
  if (swiggyCost === null) return { winner: "zomato", reasoning: "Only Zomato has this item available" }
  if (zomatoCost === null) return { winner: "swiggy", reasoning: "Only Swiggy has this item available" }

  const diff = Math.abs(swiggyCost - zomatoCost)
  if (diff > 0.01) {
    const winner = swiggyCost < zomatoCost ? "swiggy" : "zomato"
    const loserName = winner === "swiggy" ? "Zomato" : "Swiggy"
    return { winner, reasoning: `${winner === "swiggy" ? "Swiggy" : "Zomato"} is ₹${diff.toFixed(0)} cheaper than ${loserName}` }
  }

  // Same effective cost — use ETA as the tiebreaker.
  const swiggyEta = cheapestItem(swiggy).etaMinutes
  const zomatoEta = cheapestItem(zomato).etaMinutes
  if (swiggyEta != null && zomatoEta != null && swiggyEta !== zomatoEta) {
    const winner = swiggyEta < zomatoEta ? "swiggy" : "zomato"
    const etaDiff = Math.abs(swiggyEta - zomatoEta)
    return {
      winner,
      reasoning: `Same price on both — ${winner === "swiggy" ? "Swiggy" : "Zomato"} is ${etaDiff} min faster`,
    }
  }

  return { winner: "swiggy", reasoning: "Same price and delivery time on both platforms" }
}
