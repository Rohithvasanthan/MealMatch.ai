import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Coords } from "@/hooks/useGeolocation"
import { useGeolocation } from "@/hooks/useGeolocation"
import { useResolvedLocation } from "@/hooks/useMealMatchQueries"

interface LocationBarProps {
  onCoordsChange: (coords: Coords) => void
}

export function LocationBar({ onCoordsChange }: LocationBarProps) {
  const { coords, status, error, detect, setManualCoords } = useGeolocation()
  const [showManual, setShowManual] = useState(false)
  const [manualLat, setManualLat] = useState("")
  const [manualLng, setManualLng] = useState("")

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "loading" && <Badge variant="secondary">Detecting your location…</Badge>}
        {status === "success" && coords && (
          <Badge variant="outline">{resolved.data?.city ?? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}</Badge>
        )}
        {(status === "error" || status === "unsupported") && (
          <Badge variant="destructive">
            {status === "unsupported" ? "Geolocation not supported" : (error ?? "Couldn't get your location")}
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={detect}>
          Use current location
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowManual((v) => !v)}>
          Enter manually
        </Button>
      </div>

      {showManual && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-32"
            placeholder="Latitude"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
          />
          <Input
            className="w-32"
            placeholder="Longitude"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
          />
          <Button size="sm" onClick={applyManual}>
            Set location
          </Button>
        </div>
      )}
    </div>
  )
}
