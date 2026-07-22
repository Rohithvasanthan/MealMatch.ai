import { beforeEach, describe, expect, it, vi } from "vitest"
import { isCircuitOpen, recordFailure, recordSuccess } from "../providerHealth.js"

describe("providerHealth", () => {
  beforeEach(() => {
    // Each platform's state is independent and module-level, so drain it back
    // to healthy before every test to avoid cross-test leakage.
    recordSuccess("swiggy")
    recordSuccess("zomato")
    recordSuccess("blinkit")
    vi.useRealTimers()
  })

  it("stays closed below the failure threshold", () => {
    recordFailure("zomato")
    recordFailure("zomato")
    expect(isCircuitOpen("zomato")).toBe(false)
  })

  it("opens the circuit after enough consecutive failures", () => {
    recordFailure("zomato")
    recordFailure("zomato")
    recordFailure("zomato")
    expect(isCircuitOpen("zomato")).toBe(true)
  })

  it("closes again immediately on a single success", () => {
    recordFailure("zomato")
    recordFailure("zomato")
    recordFailure("zomato")
    expect(isCircuitOpen("zomato")).toBe(true)

    recordSuccess("zomato")
    expect(isCircuitOpen("zomato")).toBe(false)
  })

  it("tracks each platform independently", () => {
    recordFailure("blinkit")
    recordFailure("blinkit")
    recordFailure("blinkit")
    expect(isCircuitOpen("blinkit")).toBe(true)
    expect(isCircuitOpen("swiggy")).toBe(false)
  })

  it("expires the cooldown after enough time passes", () => {
    vi.useFakeTimers()
    recordFailure("zomato")
    recordFailure("zomato")
    recordFailure("zomato")
    expect(isCircuitOpen("zomato")).toBe(true)

    vi.advanceTimersByTime(61_000)
    expect(isCircuitOpen("zomato")).toBe(false)
    vi.useRealTimers()
  })
})
