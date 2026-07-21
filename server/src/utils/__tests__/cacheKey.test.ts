import { describe, expect, it } from "vitest"
import { buildComparisonCacheKey, buildLocationKey, buildSuggestedCacheKey, normalizeQuery } from "../cacheKey.js"

describe("normalizeQuery", () => {
  it("lowercases and trims", () => {
    expect(normalizeQuery("  Chicken Biryani  ")).toBe("chicken biryani")
  })

  it("collapses internal whitespace", () => {
    expect(normalizeQuery("chicken    biryani")).toBe("chicken biryani")
  })
})

describe("buildLocationKey", () => {
  it("rounds coordinates to ~110m precision", () => {
    expect(buildLocationKey(12.93521234, 77.61464321)).toBe("12.935,77.615")
  })

  it("treats GPS jitter within precision as the same key", () => {
    const a = buildLocationKey(12.93521, 77.61463)
    const b = buildLocationKey(12.93524, 77.61461)
    expect(a).toBe(b)
  })

  it("treats meaningfully different locations as different keys", () => {
    const koramangala = buildLocationKey(12.9352, 77.6146)
    const mumbai = buildLocationKey(19.076, 72.8777)
    expect(koramangala).not.toBe(mumbai)
  })
})

describe("buildComparisonCacheKey", () => {
  it("combines normalized query and location key", () => {
    expect(buildComparisonCacheKey(" Biryani ", 12.9352, 77.6146)).toBe("biryani@12.935,77.615")
  })

  it("produces different keys for different queries at the same location", () => {
    const biryani = buildComparisonCacheKey("biryani", 12.9352, 77.6146)
    const pizza = buildComparisonCacheKey("pizza", 12.9352, 77.6146)
    expect(biryani).not.toBe(pizza)
  })
})

describe("buildSuggestedCacheKey", () => {
  it("matches the location key alone", () => {
    expect(buildSuggestedCacheKey(12.9352, 77.6146)).toBe(buildLocationKey(12.9352, 77.6146))
  })
})
