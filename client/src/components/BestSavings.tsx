import { CheckCircle2, ImageOff } from "lucide-react"
import { motion } from "framer-motion"
import type { Coords } from "@/hooks/useGeolocation"
import { useSuggestedFoods } from "@/hooks/useMealMatchQueries"
import { platformMeta } from "@/lib/platforms"
import type { SuggestedItem } from "@/types/api"

function ItemCard({ item, platform, index }: { item: SuggestedItem; platform: string; index: number }) {
  const meta = platformMeta(platform)
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 90, damping: 14, delay: index * 0.05 }}
      className="premium-card group flex h-full flex-col overflow-hidden border-gray-100/70"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gray-50">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-6 w-6 text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/40 via-transparent to-transparent opacity-60" />
        <div
          className="absolute top-4 left-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase shadow-md"
          style={{ backgroundColor: meta.color }}
        >
          {meta.name}
        </div>
      </div>

      <div className="flex flex-grow flex-col p-6">
        <h4 className="font-display truncate text-lg font-black text-gray-950 transition-colors duration-300 group-hover:text-brand-orange dark:text-white">
          {item.name}
        </h4>
        <p className="mt-2 truncate text-xs leading-relaxed font-medium text-gray-500 dark:text-gray-400">{item.restaurantName}</p>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100/80 pt-4 dark:border-white/10">
          <span className="font-mono text-[9px] font-extrabold tracking-widest text-gray-400 uppercase dark:text-gray-500">
            Live price
          </span>
          <span className="font-display text-xl font-black text-gray-900 dark:text-white">₹{item.price}</span>
        </div>
      </div>
    </motion.div>
  )
}

export function BestSavings({ coords }: { coords: Coords | null }) {
  const { data, isLoading, isError } = useSuggestedFoods(coords)

  if (!coords || isLoading || isError || !data) return null

  const cards = data.results
    .filter((r) => r.availability === "available")
    .flatMap((r) => r.items.slice(0, 3).map((item) => ({ item, platform: r.platform })))

  if (cards.length === 0) return null

  return (
    <div className="w-full py-12">
      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-extrabold tracking-widest text-emerald-600 uppercase">
            <CheckCircle2 className="animate-pulse-slow h-4 w-4 text-emerald-500" />
            <span>Live right now</span>
          </div>
          <h3 className="font-display text-2xl font-black tracking-tight text-gray-950 md:text-4xl dark:text-white">
            Popular Near You
          </h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed font-medium text-gray-500 md:text-sm dark:text-gray-400">
            Pulled live from each platform's own "popular near you" listing for your location.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ item, platform }, index) => (
          <ItemCard key={`${platform}-${item.id}`} item={item} platform={platform} index={index} />
        ))}
      </div>
    </div>
  )
}
