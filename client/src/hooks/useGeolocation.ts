import { useCallback, useEffect, useState } from "react"

export interface Coords {
  lat: number
  lng: number
}

type Status = "idle" | "loading" | "success" | "error" | "unsupported"

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const detect = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported")
      return
    }

    setStatus("loading")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setStatus("success")
        setError(null)
      },
      (err) => {
        setStatus("error")
        setError(err.message)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  useEffect(() => {
    detect()
  }, [detect])

  const setManualCoords = useCallback((lat: number, lng: number) => {
    setCoords({ lat, lng })
    setStatus("success")
    setError(null)
  }, [])

  return { coords, status, error, detect, setManualCoords }
}
