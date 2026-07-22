import { describe, expect, it } from "vitest"
import { computeBestDeal, sortByPriority } from "../scoringService.js"
import type { MenuItem, PlatformSearchResult } from "../../types/domain.js"

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "1",
    name: "Chicken Biryani",
    restaurantName: "Test Kitchen",
    restaurantId: "r1",
    price: 200,
    ...overrides,
  }
}

function result(overrides: Partial<PlatformSearchResult>): PlatformSearchResult {
  return { platform: "swiggy", availability: "available", items: [], ...overrides }
}

describe("computeBestDeal", () => {
  it("returns null when a platform's result is missing entirely", () => {
    const onlySwiggy = [result({ platform: "swiggy", items: [item()] })]
    expect(computeBestDeal(onlySwiggy)).toBeNull()
  })

  it("returns null when both platforms have no items", () => {
    const both = [
      result({ platform: "swiggy", availability: "error", items: [] }),
      result({ platform: "zomato", availability: "error", items: [] }),
    ]
    expect(computeBestDeal(both)).toBeNull()
  })

  it("picks the only platform with items when the other failed", () => {
    const both = [
      result({ platform: "swiggy", items: [item({ price: 200 })] }),
      result({ platform: "zomato", availability: "error", items: [] }),
    ]
    expect(computeBestDeal(both)).toEqual({
      winner: "swiggy",
      reasoning: "Only Swiggy has this item available",
    })
  })

  it("picks the cheaper effective cost (price + delivery fee)", () => {
    const both = [
      result({ platform: "swiggy", items: [item({ price: 200, deliveryFee: 40 })] }), // 240
      result({ platform: "zomato", items: [item({ price: 210, deliveryFee: 10 })] }), // 220
    ]
    const deal = computeBestDeal(both)
    expect(deal?.winner).toBe("zomato")
    expect(deal?.reasoning).toContain("₹20 cheaper")
  })

  it("uses the cheapest item per platform, not the first one", () => {
    const both = [
      result({
        platform: "swiggy",
        items: [item({ id: "a", price: 300 }), item({ id: "b", price: 150 })],
      }),
      result({ platform: "zomato", items: [item({ price: 200 })] }),
    ]
    expect(computeBestDeal(both)?.winner).toBe("swiggy")
  })

  it("breaks equal-cost ties using ETA", () => {
    const both = [
      result({ platform: "swiggy", items: [item({ price: 200, etaMinutes: 30 })] }),
      result({ platform: "zomato", items: [item({ price: 200, etaMinutes: 20 })] }),
    ]
    const deal = computeBestDeal(both)
    expect(deal?.winner).toBe("zomato")
    expect(deal?.reasoning).toContain("faster")
  })

  it("falls back to swiggy when price and ETA are identical", () => {
    const both = [
      result({ platform: "swiggy", items: [item({ price: 200, etaMinutes: 25 })] }),
      result({ platform: "zomato", items: [item({ price: 200, etaMinutes: 25 })] }),
    ]
    expect(computeBestDeal(both)).toEqual({
      winner: "swiggy",
      reasoning: "Same price and delivery time on both platforms",
    })
  })

  it("considers a third platform (blinkit) when picking the cheapest option", () => {
    const three = [
      result({ platform: "swiggy", items: [item({ price: 200, deliveryFee: 40 })] }), // 240
      result({ platform: "zomato", items: [item({ price: 210, deliveryFee: 10 })] }), // 220
      result({ platform: "blinkit", items: [item({ price: 150, deliveryFee: 20 })] }), // 170
    ]
    const deal = computeBestDeal(three)
    expect(deal?.winner).toBe("blinkit")
    expect(deal?.reasoning).toContain("Blinkit")
  })

  it("picks the only surviving platform when the other two failed", () => {
    const three = [
      result({ platform: "swiggy", availability: "error", items: [] }),
      result({ platform: "zomato", availability: "error", items: [] }),
      result({ platform: "blinkit", items: [item({ price: 100 })] }),
    ]
    expect(computeBestDeal(three)).toEqual({
      winner: "blinkit",
      reasoning: "Only Blinkit has this item available",
    })
  })
})

describe("sortByPriority", () => {
  it("puts working providers before unavailable ones, regardless of input order", () => {
    const input = [
      result({ platform: "zomato", availability: "error", items: [] }),
      result({ platform: "swiggy", items: [item({ price: 200 })] }),
      result({ platform: "blinkit", availability: "not_serviceable", items: [] }),
    ]
    const sorted = sortByPriority(input)
    expect(sorted.map((r) => r.platform)).toEqual(["swiggy", "blinkit", "zomato"])
  })

  it("orders available providers by cheapest final cost first", () => {
    const input = [
      result({ platform: "swiggy", items: [item({ price: 200, deliveryFee: 40 })] }), // 240
      result({ platform: "zomato", items: [item({ price: 150, deliveryFee: 10 })] }), // 160
      result({ platform: "blinkit", items: [item({ price: 100, deliveryFee: 20 })] }), // 120
    ]
    const sorted = sortByPriority(input)
    expect(sorted.map((r) => r.platform)).toEqual(["blinkit", "zomato", "swiggy"])
  })

  it("does not mutate the input array", () => {
    const input = [
      result({ platform: "zomato", availability: "error", items: [] }),
      result({ platform: "swiggy", items: [item({ price: 200 })] }),
    ]
    const original = [...input]
    sortByPriority(input)
    expect(input).toEqual(original)
  })
})
