import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Coords } from "@/hooks/useGeolocation"

export interface StoredLocation extends Coords {
  label: string
}

const STORAGE_KEY = "mealmatch:location"

function readStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") return parsed as StoredLocation
    return null
  } catch {
    return null
  }
}

interface LocationContextValue {
  location: StoredLocation | null
  setLocation: (location: StoredLocation) => void
  clearLocation: () => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<StoredLocation | null>(() => readStoredLocation())

  useEffect(() => {
    if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location))
  }, [location])

  const setLocation = useCallback((next: StoredLocation) => {
    setLocationState(next)
  }, [])

  const clearLocation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setLocationState(null)
  }, [])

  const value = useMemo(() => ({ location, setLocation, clearLocation }), [location, setLocation, clearLocation])

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error("useLocation must be used within a LocationProvider")
  return ctx
}
