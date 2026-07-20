import { useEffect, useId, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { LoaderCircleIcon, MapPinIcon, MapPinOffIcon, PencilLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Coords } from "@/hooks/useGeolocation"
import { useGeolocation } from "@/hooks/useGeolocation"
import { useResolvedLocation } from "@/hooks/useMealMatchQueries"
import { cn } from "@/lib/utils"

interface LocationBarProps {
  onCoordsChange: (coords: Coords) => void
}

export function LocationBar({ onCoordsChange }: LocationBarProps) {
  const { coords, status, error, detect, setManualCoords } = useGeolocation()
  const [showManual, setShowManual] = useState(false)
  const [manualLat, setManualLat] = useState("")
  const [manualLng, setManualLng] = useState("")
  const latId = useId()
  const lngId = useId()

  const resolved = useResolvedLocation(coords)

  useEffect(() => {
    if (coords) onCoordsChange(coords)
  }, [coords, onCoordsChange])

  function applyManual() {
    const lat = Number(manualLat)
    const lng = Number(manualLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return
    setManualCoords(lat, lng)
    setShowManual(false)
  }

  const statusLabel =
    status === "loading"
      ? "Detecting your location…"
      : status === "success" && coords
        ? (resolved.data?.city ?? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`)
        : status === "unsupported"
          ? "Geolocation isn't supported in this browser"
          : (error ?? "Couldn't get your location")

  const isProblem = status === "error" || status === "unsupported"

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm transition-colors",
          isProblem && "border-destructive/30 bg-destructive/5",
        )}
      >
        <span role="status" aria-live="polite" className="flex items-center gap-1.5">
          {status === "loading" && (
            <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          {status === "success" && <MapPinIcon className="size-3.5 text-primary" aria-hidden="true" />}
          {isProblem && <MapPinOffIcon className="size-3.5 text-destructive" aria-hidden="true" />}
          <span className={cn(isProblem ? "text-destructive" : "text-foreground")}>{statusLabel}</span>
        </span>

        <span className="h-4 w-px bg-border" aria-hidden="true" />

        <Button variant="ghost" size="xs" onClick={detect}>
          Use current location
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowManual((v) => !v)}
          aria-expanded={showManual}
        >
          <PencilLineIcon aria-hidden="true" />
          Enter manually
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showManual && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full overflow-hidden"
          >
            <div className="flex flex-wrap items-end justify-center gap-2 pt-1">
              <div className="space-y-1 text-left">
                <label htmlFor={latId} className="text-xs text-muted-foreground">
                  Latitude
                </label>
                <Input
                  id={latId}
                  className="w-32"
                  inputMode="decimal"
                  placeholder="12.9716"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div className="space-y-1 text-left">
                <label htmlFor={lngId} className="text-xs text-muted-foreground">
                  Longitude
                </label>
                <Input
                  id={lngId}
                  className="w-32"
                  inputMode="decimal"
                  placeholder="77.5946"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={applyManual}>
                Set location
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
