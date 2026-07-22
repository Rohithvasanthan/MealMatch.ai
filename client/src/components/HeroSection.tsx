import { useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowRight, Clock, CornerDownLeft, Flame, History, Search, Sparkles, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

const POPULAR_CRAVING_SUGGESTIONS = [
  { text: "Spicy chicken biryani under ₹300", icon: "🍗" },
  { text: "Thin crust pesto pizza with coke", icon: "🍕" },
  { text: "Double patty cheese burger with crispy fries", icon: "🍔" },
  { text: "High protein vegetarian keto bowl", icon: "🥗" },
]

const POPULAR_SEARCHES = [
  { text: "Pizza", icon: "🍕" },
  { text: "Burger", icon: "🍔" },
  { text: "Chicken Biryani", icon: "🍗" },
  { text: "Milk", icon: "🥛" },
  { text: "Eggs", icon: "🥚" },
  { text: "Noodles", icon: "🍜" },
  { text: "Coffee", icon: "☕" },
  { text: "Coke", icon: "🥤" },
]

export function HeroSection({
  onSearchSubmit,
  recentSearches,
  onClearRecent,
}: {
  onSearchSubmit: (query: string) => void
  recentSearches: string[]
  onClearRecent: () => void
}) {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearchSubmit(query.trim())
      setFocused(false)
    }
  }

  const handleSuggestionClick = (text: string) => {
    setQuery(text)
    onSearchSubmit(text)
    setFocused(false)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] opacity-[0.4] [background-size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] dark:opacity-[0.5]" />
      <div className="animate-pulse-slow absolute top-0 left-1/2 -z-10 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-orange-200/20 to-amber-200/25 blur-3xl dark:from-orange-500/10 dark:to-amber-500/10" />
      <div className="absolute -bottom-10 right-1/4 -z-10 h-[380px] w-[380px] rounded-full bg-orange-100/10 blur-3xl dark:bg-orange-500/5" />

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, delay: 0.05 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-500/10 bg-gradient-to-r from-orange-500/5 to-amber-500/5 px-4 py-1.5 shadow-sm dark:border-orange-500/20"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-orange" />
          </span>
          <span className="font-mono text-[10px] font-extrabold tracking-widest text-brand-orange uppercase">
            Live discovery & arbitrage system
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display max-w-4xl text-4xl leading-[1.08] font-black tracking-tight text-gray-950 md:text-7xl dark:text-white"
        >
          Optimized Food & Grocery Search <br />
          <span className="bg-gradient-to-r from-brand-orange via-amber-500 to-amber-600 bg-clip-text text-transparent">
            Across Every Live Platform
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6 max-w-2xl text-sm leading-relaxed font-medium text-gray-500 md:text-base dark:text-gray-400"
        >
          No more hopping apps. Type any craving or grocery item and we run a live parallel search on Swiggy, Zomato
          and Blinkit at your location, so you can see real prices, ETAs and availability before you order.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, delay: 0.2 }}
          ref={containerRef}
          className="relative z-30 mt-12 w-full max-w-2xl"
        >
          <form
            onSubmit={handleSubmit}
            className={`group relative flex items-center rounded-3xl border bg-white p-2 pr-2.5 transition-all duration-300 dark:bg-gray-900 ${
              focused
                ? "border-brand-orange/40 shadow-2xl shadow-brand-orange/5 ring-4 ring-brand-orange/5"
                : "border-gray-200/70 shadow-xl shadow-gray-200/30 hover:border-gray-300/80 hover:shadow-2xl dark:border-white/10 dark:shadow-none dark:hover:border-white/20"
            }`}
          >
            <div className="pl-4 text-gray-400">
              <Search className={`h-5 w-5 transition-colors duration-300 ${focused ? "text-brand-orange" : "text-gray-400"}`} />
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="What are you craving? (e.g. spicy chicken biryani under 300)..."
              className="w-full bg-transparent px-3 py-3.5 text-sm font-semibold text-gray-900 placeholder-gray-400 outline-none md:text-base dark:text-gray-100 dark:placeholder-gray-500"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mr-2 cursor-pointer rounded-full p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="submit"
              className="active:scale-98 flex cursor-pointer items-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-500 px-6 py-3 text-xs font-bold text-white shadow-md shadow-brand-orange/15 transition-all hover:from-brand-orange-hover hover:to-amber-600 hover:shadow-lg hover:shadow-brand-orange/20 md:text-sm"
            >
              <Sparkles className="animate-spin-slow h-4 w-4" />
              <span>Optimize</span>
            </button>
          </form>

          <AnimatePresence>
            {focused && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 120, damping: 15 }}
                className="absolute inset-x-0 top-full z-40 mt-3 overflow-hidden rounded-3xl border border-gray-100 bg-white p-3.5 text-left shadow-2xl dark:border-white/10 dark:bg-gray-900 dark:shadow-black/40"
              >
                {query.trim().length > 0 && (
                  <button
                    onClick={() => handleSuggestionClick(query)}
                    className="group mb-3 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-brand-orange/10 bg-orange-500/5 p-3 text-brand-orange transition-all hover:bg-orange-500/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-orange text-white shadow-md shadow-brand-orange/10">
                        <Sparkles className="animate-pulse-slow h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 transition-colors group-hover:text-brand-orange md:text-sm dark:text-gray-100">
                          Compare live prices
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 md:text-xs dark:text-gray-400">
                          Search Swiggy, Zomato & Blinkit right now for: &ldquo;{query}&rdquo;
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden items-center gap-0.5 rounded-md border border-gray-100 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-gray-400 md:flex dark:border-white/10 dark:bg-white/5">
                        <span>Enter</span>
                        <CornerDownLeft className="h-2.5 w-2.5" />
                      </span>
                      <ArrowRight className="h-4 w-4 -translate-x-1 transform opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-1 gap-5 p-1 md:grid-cols-2">
                  <div className="space-y-3">
                    {query.trim() === "" ? (
                      <div>
                        {recentSearches.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-1 pb-1">
                              <span className="flex items-center gap-1 font-mono text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                                <History className="h-3.5 w-3.5" /> Recent optimizations
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onClearRecent()
                                }}
                                className="cursor-pointer font-mono text-[9px] font-bold text-gray-400 hover:text-rose-500"
                              >
                                CLEAR ALL
                              </button>
                            </div>
                            {recentSearches.map((term, i) => (
                              <button
                                key={i}
                                onClick={() => handleSuggestionClick(term)}
                                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-all hover:border-gray-100/50 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:border-white/5 dark:hover:bg-white/5 dark:hover:text-gray-100"
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <Clock className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                                  <span className="truncate">{term}</span>
                                </div>
                                <ArrowRight className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Search className="h-10 w-10 text-gray-200 dark:text-gray-700" />
                            <p className="mt-2.5 text-xs font-bold text-gray-400 dark:text-gray-500">No recent optimization history</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CornerDownLeft className="h-8 w-8 text-gray-200 dark:text-gray-700" />
                        <p className="mt-2.5 text-xs font-bold text-gray-400 dark:text-gray-500">
                          Press Enter to search live prices for &ldquo;{query}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3.5 md:border-t-0 md:border-l md:pt-0 md:pl-5 dark:border-white/10">
                    <span className="flex items-center gap-1.5 px-1 font-mono text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">
                      <Flame className="h-3.5 w-3.5 animate-pulse text-brand-orange" /> Suggested AI prompts
                    </span>
                    <div className="mt-3 space-y-2">
                      {POPULAR_CRAVING_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(sug.text)}
                          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent p-2.5 text-left text-xs font-semibold text-gray-600 transition-all hover:border-orange-500/10 hover:bg-orange-500/5 hover:text-brand-orange dark:text-gray-400"
                        >
                          <span className="rounded-lg border border-gray-100 bg-white p-1 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                            {sug.icon}
                          </span>
                          <span className="truncate font-bold text-gray-800 hover:text-brand-orange dark:text-gray-200">{sug.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 flex w-full max-w-2xl flex-col items-center gap-3"
        >
          <span className="font-mono text-[10px] font-extrabold tracking-widest text-gray-400 uppercase dark:text-gray-500">
            Popular Searches
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {POPULAR_SEARCHES.map((item) => (
              <motion.button
                key={item.text}
                onClick={() => handleSuggestionClick(item.text)}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200/70 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:border-brand-orange/30 hover:text-brand-orange dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-brand-orange/30 dark:hover:text-brand-orange"
              >
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
