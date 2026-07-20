import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Coords } from "@/hooks/useGeolocation"
import { usePlatformAvailability } from "@/hooks/useMealMatchQueries"
import type { Platform } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }

export function PlatformAvailability({ coords }: { coords: Coords | null }) {
  const { data, isLoading, isError } = usePlatformAvailability(coords)

  if (!coords) return null

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
    )
  }

  if (isError || !data) {
    return <Badge variant="destructive">Couldn't check platform availability</Badge>
  }

  return (
    <div className="flex gap-2">
      {data.availability.map((platform) => (
        <Badge key={platform.platform} variant={platform.available ? "secondary" : "outline"}>
          {PLATFORM_LABEL[platform.platform]}: {platform.available ? "available" : "not serviceable"}
        </Badge>
      ))}
    </div>
  )
}
