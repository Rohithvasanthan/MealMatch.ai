import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CompareSearch } from "@/components/CompareSearch"
import { LocationBar } from "@/components/LocationBar"
import { PlatformAvailability } from "@/components/PlatformAvailability"
import { SuggestedFoods } from "@/components/SuggestedFoods"
import type { Coords } from "@/hooks/useGeolocation"

function App() {
  const [coords, setCoords] = useState<Coords | null>(null)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">MealMatch AI</h1>
          <Badge variant="secondary">Prototype</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <LocationBar onCoordsChange={setCoords} />
        <PlatformAvailability coords={coords} />

        <Separator />

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Compare a search</h2>
          <CompareSearch coords={coords} />
        </section>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Popular near you</h2>
          <SuggestedFoods coords={coords} />
        </section>
      </main>
    </div>
  )
}

export default App
