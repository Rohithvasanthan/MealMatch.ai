import { beforeEach, describe, expect, it, vi } from "vitest"

const { getCachedPlatformAvailability, savePlatformAvailabilityCache } = vi.hoisted(() => ({
  getCachedPlatformAvailability: vi.fn(),
  savePlatformAvailabilityCache: vi.fn(),
}))
const { checkAvailability } = vi.hoisted(() => ({ checkAvailability: vi.fn() }))

vi.mock("../cacheService.js", () => ({ getCachedPlatformAvailability, savePlatformAvailabilityCache }))
vi.mock("../scraperClient.js", () => ({ checkAvailability }))

const { getPlatformAvailability } = await import("../platformsService.js")

const LAT = 12.9352
const LNG = 77.6146
const PLATFORMS = ["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]

beforeEach(() => {
  vi.clearAllMocks()
  getCachedPlatformAvailability.mockResolvedValue(null)
  savePlatformAvailabilityCache.mockResolvedValue(undefined)
})

describe("getPlatformAvailability", () => {
  it("returns the cached result without calling any scraper when present", async () => {
    const cached = [{ platform: "swiggy", available: true }]
    getCachedPlatformAvailability.mockResolvedValue(cached)

    const result = await getPlatformAvailability(LAT, LNG)

    expect(result).toBe(cached)
    expect(checkAvailability).not.toHaveBeenCalled()
    expect(savePlatformAvailabilityCache).not.toHaveBeenCalled()
  })

  it("checks every platform, sorts available-first, and caches the result on a cache miss", async () => {
    checkAvailability.mockImplementation((platform: string) =>
      Promise.resolve({ platform, available: platform === "blinkit" }),
    )

    const result = await getPlatformAvailability(LAT, LNG)

    expect(checkAvailability).toHaveBeenCalledTimes(PLATFORMS.length)
    for (const platform of PLATFORMS) {
      expect(checkAvailability).toHaveBeenCalledWith(platform, LAT, LNG)
    }
    expect(result[0]).toMatchObject({ platform: "blinkit", available: true })
    expect(result.slice(1).every((r) => !r.available)).toBe(true)
    expect(savePlatformAvailabilityCache).toHaveBeenCalledWith(
      expect.any(String),
      LAT,
      LNG,
      result,
    )
  })

  it("turns a rejected platform check into a structured unavailable entry instead of failing the whole request", async () => {
    checkAvailability.mockImplementation((platform: string) => {
      if (platform === "zomato") return Promise.reject(new Error("net::ERR_HTTP2_PROTOCOL_ERROR"))
      return Promise.resolve({ platform, available: true })
    })

    const result = await getPlatformAvailability(LAT, LNG)

    const zomato = result.find((r) => r.platform === "zomato")
    expect(zomato).toMatchObject({
      available: false,
      errorCode: "UPSTREAM_ERROR",
      errorMessage: "net::ERR_HTTP2_PROTOCOL_ERROR",
    })
  })
})
