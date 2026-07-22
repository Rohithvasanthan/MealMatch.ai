import { motion } from "framer-motion"
import { POPULAR_CATEGORIES } from "@/lib/content"

export function CategoryGrid({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: string | null
  onSelectCategory: (id: string, name: string) => void
}) {
  return (
    <div className="w-full py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="font-display text-2xl font-black tracking-tight text-gray-950 md:text-3xl dark:text-white">
            Popular Food Categories
          </h3>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm dark:text-gray-400">
            Tap a category to search live prices for it instantly
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {POPULAR_CATEGORIES.map((cat, i) => {
          const isActive = selectedCategory === cat.id
          return (
            <motion.button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id, cat.name)}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 120, delay: i * 0.03 }}
              className={`group flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-3xl border p-5 text-center transition-all ${
                isActive
                  ? "border-brand-orange bg-gradient-to-tr from-brand-orange/15 to-amber-500/10 shadow-lg shadow-brand-orange/10 ring-1 ring-brand-orange/20"
                  : "border-gray-100/80 bg-white shadow-sm hover:border-gray-200 hover:shadow-md dark:border-white/10 dark:bg-gray-900 dark:hover:border-white/20"
              }`}
            >
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-inner transition-transform duration-300 group-hover:scale-110 ${
                  isActive ? "bg-white dark:bg-gray-950" : "bg-gray-50 dark:bg-white/5"
                }`}
              >
                {cat.icon}
              </div>
              <span
                className={`text-xs leading-tight font-bold tracking-tight transition-colors ${
                  isActive ? "font-black text-brand-orange" : "text-gray-900 dark:text-gray-200"
                }`}
              >
                {cat.name}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
