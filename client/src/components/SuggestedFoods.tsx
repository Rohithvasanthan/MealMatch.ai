import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Coords } from "@/hooks/useGeolocation"
import { useSuggestedFoods } from "@/hooks/useMealMatchQueries"
import type { Platform } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }

export function SuggestedFoods({ coords }: { coords: Coords | null }) {
  const { data, isLoading, isError } = useSuggestedFoods(coords)

  if (!coords) return null

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">Couldn't load suggestions right now.</p>
  }

  const allUnavailable = data.results.every((r) => r.availability !== "available")
  if (allUnavailable) {
    return <p className="text-sm text-muted-foreground">No suggestions available near you right now.</p>
  }

  return (
    <div className="space-y-4">
      {data.results.map((platform) => (
        <div key={platform.platform} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{PLATFORM_LABEL[platform.platform]}</h3>
          {platform.availability !== "available" ? (
            <p className="text-sm text-muted-foreground">
              {platform.availability === "not_serviceable"
                ? "Not serviceable at this location."
                : (platform.errorMessage ?? "Unavailable right now.")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {platform.items.map((item) => (
                <Card key={item.id} size="sm">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="h-24 w-full object-cover" />
                  )}
                  <CardHeader>
                    <CardTitle>{item.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {item.restaurantName} · ₹{item.price}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
