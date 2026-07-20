import { motion } from "framer-motion"
import { ImageOffIcon, SearchXIcon, WifiOffIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { Coords } from "@/hooks/useGeolocation"
import { useSuggestedFoods } from "@/hooks/useMealMatchQueries"
import { fadeUp, staggerContainer } from "@/lib/motion"
import type { Platform, SuggestedItem } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }

function EmptyState({ icon: Icon, message }: { icon: typeof SearchXIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function SuggestedCard({ item }: { item: SuggestedItem }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-video w-full overflow-hidden bg-muted">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOffIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.restaurantName} · <span className="font-medium text-foreground">₹{item.price}</span>
        </p>
      </div>
    </motion.div>
  )
}

export function SuggestedFoods({ coords }: { coords: Coords | null }) {
  const { data, isLoading, isError } = useSuggestedFoods(coords)

  if (!coords) {
    return <EmptyState icon={SearchXIcon} message="Set your location to see what's popular nearby." />
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Loading suggestions">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <EmptyState icon={WifiOffIcon} message="Couldn't load suggestions right now." />
  }

  const allUnavailable = data.results.every((r) => r.availability !== "available")
  if (allUnavailable) {
    return <EmptyState icon={SearchXIcon} message="No suggestions available near you right now." />
  }

  return (
    <div className="space-y-6">
      {data.results.map((platform) => (
        <div key={platform.platform} className="space-y-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {PLATFORM_LABEL[platform.platform]}
          </h3>
          {platform.availability !== "available" ? (
            <p className="text-sm text-muted-foreground">
              {platform.availability === "not_serviceable"
                ? "Not serviceable at this location."
                : (platform.errorMessage ?? "Unavailable right now.")}
            </p>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {platform.items.map((item) => (
                <SuggestedCard key={item.id} item={item} />
              ))}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}
