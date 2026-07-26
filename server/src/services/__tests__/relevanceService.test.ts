import { describe, expect, it } from "vitest"
import { classifyQuery, filterRelevantItems } from "../relevanceService.js"
import type { MenuItem } from "../../types/domain.js"

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

describe("classifyQuery", () => {
  it("classifies dish-style queries as food", () => {
    expect(classifyQuery("biryani")).toBe("food")
    expect(classifyQuery("Chicken Biryani")).toBe("food")
    expect(classifyQuery("pizza near me")).toBe("food")
  })

  it("classifies ingredient/household queries as grocery", () => {
    expect(classifyQuery("milk")).toBe("grocery")
    expect(classifyQuery("Toned Milk 500ml")).toBe("grocery")
    expect(classifyQuery("onions")).toBe("grocery")
    expect(classifyQuery("shampoo")).toBe("grocery")
  })

  it("defaults ambiguous/unknown queries to food", () => {
    expect(classifyQuery("xyz123")).toBe("food")
  })

  it("does not misclassify a food word that merely contains a grocery keyword as a substring", () => {
    expect(classifyQuery("veggie burger")).toBe("food")
    expect(classifyQuery("steak")).toBe("food")
  })
})

describe("filterRelevantItems", () => {
  it("keeps items matching the query and drops unrelated ones", () => {
    const items = [
      item({ id: "1", name: "Chicken Biryani" }),
      item({ id: "2", name: "Paneer Tikka" }),
      item({ id: "3", name: "Biryani Rice Bowl" }),
    ]

    const result = filterRelevantItems(items, "biryani")

    expect(result.map((i) => i.id)).toEqual(["1", "3"])
  })

  it("matches on restaurant name as a fallback signal", () => {
    const items = [item({ id: "1", name: "Combo Meal", restaurantName: "Biryani House" })]
    expect(filterRelevantItems(items, "biryani")).toHaveLength(1)
  })

  it("returns all items unchanged when the query has no meaningful tokens", () => {
    const items = [item()]
    expect(filterRelevantItems(items, "  ")).toEqual(items)
  })
})
