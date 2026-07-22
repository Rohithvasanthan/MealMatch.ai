import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { LoaderCircle, LocateFixed, MapPin, Search, Sparkles, TriangleAlert } from "lucide-react"
import { resolveLocation, searchLocations } from "@/lib/api"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { StoredLocation } from "@/lib/locationStore"
import type { LocationSuggestion } from "@/types/api"

const EXAMPLE_CITIES = ["Coimbatore", "Chennai", "Bangalore", "Mumbai", "Hyderabad", "Delhi"]

function labelFor(suggestion: LocationSuggestion): string {
  return suggestion.city ? `${suggestion.city}${suggestion.state ? `, ${suggestion.state}` : ""}` : suggestion.displayName
}

export function LocationOnboarding({ onSelect }: { onSelect: (location: StoredLocation) => void }) {
  const [mode, setMode] = useState<"choose" | "manual">("choose")
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 350)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setSearching(true)
    setSearchError(null)
    searchLocations(debouncedQuery.trim())
      .then((results) => {
        if (!cancelled) setSuggestions(results)
      })
      .catch(() => {
        if (!cancelled) setSearchError("Couldn't search locations right now. Try again.")
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setDetectError("Geolocation isn't supported on this device.")
      return
    }
    setDetecting(true)
    setDetectError(null)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        let label = "Current location"
        try {
          const resolved = await resolveLocation(lat, lng)
          label = resolved.city ?? resolved.displayName
        } catch {
          // Reverse geocoding is a label nicety — fall back to a generic label if it fails.
        }
        setDetecting(false)
        onSelect({ lat, lng, label })
      },
      (err) => {
        setDetecting(false)
        setDetectError(err.message || "Couldn't detect your location.")
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  function pickSuggestion(s: LocationSuggestion) {
    onSelect({ lat: s.lat, lng: s.lng, label: labelFor(s) })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-950/60 px-4 py-10 backdrop-blur-md">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#ffffff22_1px,transparent_1px)] [background-size:20px_20px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-white/10 bg-white p-8 shadow-2xl md:p-10 dark:border-white/10 dark:bg-gray-900"
      >
        <div className="animate-pulse-slow absolute -top-24 -right-24 -z-10 h-64 w-64 rounded-full bg-gradient-to-tr from-orange-200/40 to-amber-200/30 blur-3xl dark:from-orange-500/10 dark:to-amber-500/10" />

        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 text-white shadow-lg shadow-brand-orange/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-950 md:text-3xl dark:text-white">
            Where should we compare prices?
          </h1>
          <p className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
            MealMatch AI runs a live search on real delivery platforms near you — we need your location to fetch
            accurate prices and ETAs.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === "choose" ? (
            <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <button
                onClick={useCurrentLocation}
                disabled={detecting}
                className="active:scale-98 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition-all hover:from-brand-orange-hover hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {detecting ? (
                  <LoaderCircle className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <LocateFixed className="h-4.5 w-4.5" />
                )}
                <span>{detecting ? "Detecting your location…" : "Use Current Location"}</span>
              </button>

              {detectError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-left text-xs font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{detectError}</span>
                </div>
              )}

              <button
                onClick={() => setMode("manual")}
                className="active:scale-98 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-6 py-4 text-sm font-bold text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                <MapPin className="h-4.5 w-4.5 text-gray-400" />
                <span>Enter Location Manually</span>
              </button>
            </motion.div>
          ) : (
            <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your city — e.g. Coimbatore, Chennai, Bangalore"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 py-3.5 pr-4 pl-11 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-orange/40 focus:bg-white focus:ring-4 focus:ring-brand-orange/5 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900"
                />
                {searching && (
                  <LoaderCircle className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {searchError && <p className="text-xs font-semibold text-rose-600">{searchError}</p>}

              {query.trim().length < 2 && (
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_CITIES.map((city) => (
                    <button
                      key={city}
                      onClick={() => setQuery(city)}
                      className="cursor-pointer rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600 transition-all hover:border-brand-orange/30 hover:text-brand-orange dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-gray-100 p-1.5 dark:border-white/10">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => pickSuggestion(s)}
                      className="flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-orange" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">{labelFor(s)}</span>
                        <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{s.displayName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!searching && debouncedQuery.trim().length >= 2 && suggestions.length === 0 && !searchError && (
                <p className="px-1 text-xs font-semibold text-gray-400 dark:text-gray-500">No matching locations found.</p>
              )}

              <button
                onClick={() => setMode("choose")}
                className="cursor-pointer text-xs font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
