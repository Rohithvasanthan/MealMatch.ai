import type { MenuItem } from "../types/domain.js"

export type QueryCategory = "food" | "grocery"

// Keyword list of raw ingredients / packaged household goods — a query
// matching any of these routes to grocery platforms. Everything else
// defaults to "food" since dish/restaurant-style queries are the common
// case. This is a simple heuristic (no ML, no external service) in the
// same spirit as the rest of the scraping/scoring logic in this project.
const GROCERY_KEYWORDS = [
  "milk", "bread", "egg", "eggs", "fruit", "fruits", "vegetable", "vegetables",
  "rice", "atta", "flour", "oil", "dal", "lentil", "lentils", "sugar", "salt",
  "spice", "spices", "masala", "tea", "coffee", "biscuit", "biscuits",
  "chips", "soap", "shampoo", "detergent", "toothpaste", "diaper", "diapers",
  "grocery", "groceries", "paneer", "curd", "yogurt", "butter", "cheese", "ghee",
  "onion", "onions", "potato", "potatoes", "tomato", "tomatoes", "garlic", "ginger",
  "cereal", "pulses", "besan", "poha", "sooji", "suji", "namkeen", "pickle",
  "cleaning", "toiletries", "sanitizer", "napkins",
]

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "with", "for", "of", "in", "near", "me"])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

export function classifyQuery(query: string): QueryCategory {
  const tokens = tokenize(query)
  const isGrocery = tokens.some((token) => GROCERY_KEYWORDS.some((kw) => token === kw || token.includes(kw)))
  return isGrocery ? "grocery" : "food"
}

function tokensOverlap(a: string, b: string): boolean {
  return a === b || a.includes(b) || b.includes(a)
}

// Keeps only items whose name (or restaurant name, as a fallback signal)
// actually shares a token with the query — a platform's own fuzzy search
// often returns loosely-related results alongside exact matches, and this
// trims those out before scoring/display.
export function filterRelevantItems<T extends MenuItem>(items: T[], query: string): T[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return items
  return items.filter((item) => {
    const itemTokens = tokenize(`${item.name} ${item.restaurantName}`)
    return queryTokens.some((qt) => itemTokens.some((it) => tokensOverlap(qt, it)))
  })
}
