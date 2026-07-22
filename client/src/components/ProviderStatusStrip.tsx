import { motion } from "framer-motion"
import { LoaderCircle } from "lucide-react"
import { usePlatformAvailability } from "@/hooks/useMealMatchQueries"
import { platformMeta } from "@/lib/platforms"
import type { Coords } from "@/hooks/useGeolocation"

export function ProviderStatusStrip({ coords }: { coords: Coords | null }) {
  const { data, isLoading } = usePlatformAvailability(coords)

  if (!coords) return null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-2 px-6 pt-5">
      <span className="font-mono text-[9px] font-extrabold tracking-widest text-gray-400 uppercase dark:text-gray-500">
        Live provider status
      </span>
      {isLoading ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-gray-300 dark:text-gray-600" />
      ) : (
        data?.availability.map((p, i) => {
          const meta = platformMeta(p.platform)
          return (
            <motion.span
              key={p.platform}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                p.available
                  ? "border-gray-100 bg-white text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                  : "border-gray-100 bg-gray-50 text-gray-400 dark:border-white/5 dark:bg-white/[0.02] dark:text-gray-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${p.available ? "" : "bg-gray-300 dark:bg-gray-600"}`}
                style={p.available ? { backgroundColor: meta.color } : undefined}
              />
              {meta.name}
              {!p.available && <span className="text-gray-300 dark:text-gray-600">· unavailable</span>}
            </motion.span>
          )
        })
      )}
    </div>
  )
}
