import { describe, expect, it } from "vitest"
import { buildFallbackQueries, singularize } from "../geocodingService.js"

describe("singularize", () => {
  it("strips a trailing s from a plausibly-plural word", () => {
    expect(singularize("Hopes")).toBe("Hope")
    expect(singularize("Colleges")).toBe("College")
  })

  it("leaves short words unchanged to avoid mangling them", () => {
    expect(singularize("as")).toBe("as")
    expect(singularize("is")).toBe("is")
  })

  it("leaves words ending in a double s unchanged", () => {
    expect(singularize("Express")).toBe("Express")
  })

  it("leaves words with no trailing s unchanged", () => {
    expect(singularize("College")).toBe("College")
  })
})

describe("buildFallbackQueries", () => {
  it("includes a singularized variant when the query differs from it", () => {
    const variants = buildFallbackQueries("Hopes College Coimbatore")
    expect(variants).toContain("Hope College Coimbatore")
  })

  it("does not add a singularized variant identical to the original query", () => {
    const variants = buildFallbackQueries("Hope College Coimbatore")
    expect(variants).not.toContain("Hope College Coimbatore")
  })

  it("progressively drops trailing words", () => {
    const variants = buildFallbackQueries("Hope College Coimbatore")
    expect(variants).toContain("Hope College")
    expect(variants).toContain("Hope")
  })

  it("returns no variants for a single-word query with nothing to singularize or drop", () => {
    const variants = buildFallbackQueries("PSG")
    expect(variants).toEqual([])
  })
})
