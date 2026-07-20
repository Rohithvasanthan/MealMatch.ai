import { useQuery } from "@tanstack/react-query"
import { compareFood, getPlatformAvailability, getSuggestedFoods, resolveLocation } from "@/lib/api"
import type { Coords } from "@/hooks/useGeolocation"

export function useResolvedLocation(coords: Coords | null) {
  return useQuery({
    queryKey: ["location", coords],
    queryFn: () => resolveLocation(coords!.lat, coords!.lng),
    enabled: coords !== null,
  })
}

export function usePlatformAvailability(coords: Coords | null) {
  return useQuery({
    queryKey: ["platform-availability", coords],
    queryFn: () => getPlatformAvailability(coords!.lat, coords!.lng),
    enabled: coords !== null,
  })
}

export function useSuggestedFoods(coords: Coords | null) {
  return useQuery({
    queryKey: ["suggested-foods", coords],
    queryFn: () => getSuggestedFoods(coords!.lat, coords!.lng),
    enabled: coords !== null,
  })
}

export function useCompare(coords: Coords | null, query: string) {
  return useQuery({
    queryKey: ["compare", coords, query],
    queryFn: () => compareFood(coords!.lat, coords!.lng, query),
    enabled: coords !== null && query.trim().length > 0,
  })
}
