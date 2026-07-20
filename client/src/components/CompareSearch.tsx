import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { Coords } from "@/hooks/useGeolocation"
import { useCompare } from "@/hooks/useMealMatchQueries"
import type { Platform } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }

export function CompareSearch({ coords }: { coords: Coords | null }) {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 500)
  const { data, isLoading, isFetching, isError } = useCompare(coords, debouncedQuery)

  const searching = debouncedQuery.trim().length > 0
  const bothFailed = data?.results.every((r) => r.availability === "error") ?? false

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search for a dish, e.g. biryani"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={!coords}
      />

      {!coords && <p className="text-sm text-muted-foreground">Set your location to start comparing.</p>}

      {searching && coords && (isLoading || isFetching) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {searching && !isLoading && isError && (
        <p className="text-sm text-destructive">Couldn't reach the comparison service. Please try again.</p>
      )}

      {searching && !isLoading && data && bothFailed && (
        <p className="text-sm text-destructive">
          Both Swiggy and Zomato failed to respond right now. Please try again shortly.
        </p>
      )}

      {searching && !isLoading && data && !bothFailed && (
        <div className="space-y-4">
          {data.bestDeal && (
            <Badge variant="secondary" className="h-auto whitespace-normal px-3 py-1.5 text-sm">
              Best deal: {PLATFORM_LABEL[data.bestDeal.winner]} — {data.bestDeal.reasoning}
            </Badge>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {data.results.map((platform) => (
              <Card
                key={platform.platform}
                className={
                  data.bestDeal?.winner === platform.platform ? "ring-2 ring-primary" : undefined
                }
              >
                <CardHeader>
                  <CardTitle>{PLATFORM_LABEL[platform.platform]}</CardTitle>
                </CardHeader>
                <CardContent>
                  {platform.availability === "not_serviceable" && (
                    <p className="text-sm text-muted-foreground">Not serviceable at this location.</p>
                  )}
                  {platform.availability === "error" && (
                    <p className="text-sm text-muted-foreground">
                      {platform.errorMessage ?? "Unavailable right now."}
                    </p>
                  )}
                  {platform.availability === "available" && platform.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">No matching items found.</p>
                  )}
                  {platform.availability === "available" && platform.items.length > 0 && (
                    <ul className="space-y-2">
                      {platform.items.map((item) => (
                        <li key={item.id} className="text-sm">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-muted-foreground">
                            {item.restaurantName} · ₹{item.price}
                            {item.deliveryFee != null && ` + ₹${item.deliveryFee} delivery`}
                            {item.etaMinutes != null && ` · ${item.etaMinutes} min`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
