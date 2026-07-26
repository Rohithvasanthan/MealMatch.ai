import { describe, expect, it } from "vitest"
import { mapWithConcurrency } from "../concurrency.js"

describe("mapWithConcurrency", () => {
  it("resolves every item and preserves input order in the output", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10)
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([10, 20, 30, 40])
  })

  it("never runs more than `limit` callbacks concurrently", async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 8 }, (_, i) => i)

    await mapWithConcurrency(items, 3, async (n) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return n
    })

    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it("turns a rejection into a rejected result at the right index instead of failing the whole batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("boom")
      return n
    })

    expect(results[0]).toMatchObject({ status: "fulfilled", value: 1 })
    expect(results[1].status).toBe("rejected")
    expect(results[2]).toMatchObject({ status: "fulfilled", value: 3 })
  })

  it("handles an empty input list", async () => {
    const results = await mapWithConcurrency([], 3, async (n: number) => n)
    expect(results).toEqual([])
  })

  it("caps the worker count at the item count when limit exceeds it", async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (n) => n)
    expect(results).toHaveLength(2)
  })
})
