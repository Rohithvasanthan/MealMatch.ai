import { beforeEach, describe, expect, it, vi } from "vitest"

const { getCachedComparison, saveComparisonCache } = vi.hoisted(() => ({
  getCachedComparison: vi.fn(),
  saveComparisonCache: vi.fn(),
}))
const { recordSearch } = vi.hoisted(() => ({ recordSearch: vi.fn() }))
const { searchPlatform } = vi.hoisted(() => ({ searchPlatform: vi.fn() }))

vi.mock("../cacheService.js", () => ({ getCachedComparison, saveComparisonCache }))
vi.mock("../historyService.js", () => ({ recordSearch }))
vi.mock("../scraperClient.js", () => ({ searchPlatform }))

const { compare } = await import("../compareService.js")

const LAT = 12.9352
const LNG = 77.6146

beforeEach(() => {
  vi.clearAllMocks()
  getCachedComparison.mockResolvedValue(null)
  saveComparisonCache.mockResolvedValue(undefined)
  recordSearch.mockResolvedValue(undefined)
})

describe("compare", () => {
  it("returns the cached result without calling the scraper when present", async () => {
    const cached = {
      query: "biryani",
      lat: LAT,
      lng: LNG,
      results: [],
      bestDeal: null,
      cached: true,
      timestamp: "2026-01-01T00:00:00.000Z",
    }
    getCachedComparison.mockResolvedValue(cached)

    const result = await compare("biryani", LAT, LNG)

    expect(result).toBe(cached)
    expect(searchPlatform).not.toHaveBeenCalled()
    expect(saveComparisonCache).not.toHaveBeenCalled()
  })

  it("queries only food platforms in parallel for a food query and caches the result", async () => {
    searchPlatform.mockImplementation((platform: string) =>
      Promise.resolve({
        platform,
        availability: "available",
        items: [{ id: "1", name: "Biryani", restaurantName: "R", restaurantId: "r1", price: 200 }],
      }),
    )

    const result = await compare("  Biryani  ", LAT, LNG)

    expect(searchPlatform).toHaveBeenCalledWith("swiggy", LAT, LNG, "biryani")
    expect(searchPlatform).toHaveBeenCalledWith("zomato", LAT, LNG, "biryani")
    expect(searchPlatform).not.toHaveBeenCalledWith("blinkit", LAT, LNG, "biryani")
    expect(result.cached).toBe(false)
    expect(result.results).toHaveLength(2)
    expect(saveComparisonCache).toHaveBeenCalledTimes(1)
    expect(recordSearch).toHaveBeenCalledWith("biryani", LAT, LNG)
  })

  it("queries only grocery platforms for a grocery query", async () => {
    searchPlatform.mockImplementation((platform: string) =>
      Promise.resolve({
        platform,
        availability: "available",
        items: [{ id: "1", name: "Toned Milk 500ml", restaurantName: "Blinkit", restaurantId: "r1", price: 28 }],
      }),
    )

    const result = await compare("milk", LAT, LNG)

    expect(searchPlatform).toHaveBeenCalledWith("blinkit", LAT, LNG, "milk")
    expect(searchPlatform).toHaveBeenCalledWith("zepto", LAT, LNG, "milk")
    expect(searchPlatform).toHaveBeenCalledWith("instamart", LAT, LNG, "milk")
    expect(searchPlatform).toHaveBeenCalledWith("bigbasket", LAT, LNG, "milk")
    expect(searchPlatform).not.toHaveBeenCalledWith("swiggy", LAT, LNG, "milk")
    expect(searchPlatform).not.toHaveBeenCalledWith("zomato", LAT, LNG, "milk")
    expect(result.results).toHaveLength(4)
    expect(result.results.every((r) => ["blinkit", "zepto", "instamart", "bigbasket"].includes(r.platform))).toBe(
      true,
    )
  })

  it("filters out items unrelated to the query", async () => {
    searchPlatform.mockImplementation((platform: string) =>
      Promise.resolve({
        platform,
        availability: "available",
        items: [
          { id: "1", name: "Chicken Biryani", restaurantName: "Meghana", restaurantId: "r1", price: 250 },
          { id: "2", name: "Paneer Tikka", restaurantName: "Meghana", restaurantId: "r1", price: 180 },
        ],
      }),
    )

    const result = await compare("biryani", LAT, LNG)

    const swiggy = result.results.find((r) => r.platform === "swiggy")
    expect(swiggy?.items).toHaveLength(1)
    expect(swiggy?.items[0].name).toBe("Chicken Biryani")
  })

  it("turns a rejected platform call into a structured per-platform error instead of failing the whole request", async () => {
    searchPlatform.mockImplementation((platform: string) => {
      if (platform === "zomato") return Promise.reject(new Error("net::ERR_HTTP2_PROTOCOL_ERROR"))
      return Promise.resolve({ platform, availability: "available", items: [] })
    })

    const result = await compare("pizza", LAT, LNG)

    const zomato = result.results.find((r) => r.platform === "zomato")
    expect(zomato).toMatchObject({
      availability: "error",
      errorCode: "UPSTREAM_ERROR",
      errorMessage: "net::ERR_HTTP2_PROTOCOL_ERROR",
    })
    const swiggy = result.results.find((r) => r.platform === "swiggy")
    expect(swiggy?.availability).toBe("available")
  })
})
