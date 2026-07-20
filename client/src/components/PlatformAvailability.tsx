import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Coords } from "@/hooks/useGeolocation"
import { usePlatformAvailability } from "@/hooks/useMealMatchQueries"
import { staggerContainer } from "@/lib/motion"
import type { Platform } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }

const popIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
}

export function PlatformAvailability({ coords }: { coords: Coords | null }) {
  const { data, isLoading, isError } = usePlatformAvailability(coords)

  if (!coords) return null

  if (isLoading) {
    return (
      <div className="flex gap-2" aria-label="Checking platform availability">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    )
  }

  if (isError || !data) {
    return <Badge variant="destructive">Couldn't check platform availability</Badge>
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-wrap justify-center gap-2"
      role="status"
    >
      {data.availability.map((platform) => {
        const label = platform.available
          ? "available"
          : platform.errorCode === "NOT_SERVICEABLE"
            ? "not serviceable"
            : "unavailable"
        return (
          <motion.div key={platform.platform} variants={popIn}>
            <Badge variant={platform.available ? "success" : "warning"} className="gap-1.5">
              <span
                className={"size-1.5 rounded-full " + (platform.available ? "bg-success" : "bg-warning")}
                aria-hidden="true"
              />
              {PLATFORM_LABEL[platform.platform]} · {label}
            </Badge>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
