export interface PopularCategory {
  id: string
  name: string
  icon: string
}

export const POPULAR_CATEGORIES: PopularCategory[] = [
  { id: "biryani", name: "Biryani", icon: "🍗" },
  { id: "pizza", name: "Pizza", icon: "🍕" },
  { id: "burger", name: "Burgers", icon: "🍔" },
  { id: "healthy", name: "Healthy & Bowls", icon: "🥗" },
  { id: "dessert", name: "Desserts", icon: "🍰" },
  { id: "south-indian", name: "South Indian", icon: "🥞" },
  { id: "chinese", name: "Chinese", icon: "🍜" },
]

export interface FAQItem {
  question: string
  answer: string
}

export const FAQS: FAQItem[] = [
  {
    question: "How does MealMatch AI compare prices?",
    answer:
      "MealMatch AI classifies your search as a food or grocery query, then runs a live Playwright-driven scrape of every matching live platform — Swiggy and Zomato for food, Blinkit and Zepto for grocery — in parallel, every time you search. There is no cached catalog and no simulated data — every price shown was fetched from the platform moments ago. More providers (Instamart, BigBasket, Magicpin and others) are on the roadmap and shown as 'Coming Soon' until they're verified live.",
  },
  {
    question: "Why do some searches only show one platform?",
    answer:
      "If a platform fails to respond (bot detection, timeout, or the item isn't listed there), we show that platform's specific error instead of guessing or substituting a number. The comparison still completes with whichever platform succeeded.",
  },
  {
    question: "Can I directly order from MealMatch AI?",
    answer:
      "Not yet — MealMatch AI is a comparison layer. Once you see the cheaper option, you'd complete the order directly in the Swiggy or Zomato app.",
  },
  {
    question: "How accurate is the estimated delivery time (ETA)?",
    answer:
      "The ETA shown is whatever the platform itself reports for that restaurant at the moment of the search — not a computed estimate.",
  },
  {
    question: "Can I type a custom craving instead of a menu item?",
    answer:
      'Yes — your search text is sent as-is to both platforms\' search, so natural phrases like "chicken biryani" work the same way they would inside the Swiggy or Zomato app.',
  },
]
