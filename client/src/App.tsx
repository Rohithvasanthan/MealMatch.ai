import { useState } from "react"
import { motion } from "framer-motion"
import { FloatingNav } from "@/components/FloatingNav"
import { LocationBar } from "@/components/LocationBar"
import { PlatformAvailability } from "@/components/PlatformAvailability"
import { CompareSearch } from "@/components/CompareSearch"
import { SuggestedFoods } from "@/components/SuggestedFoods"
import { fadeUp, staggerContainer } from "@/lib/motion"
import type { Coords } from "@/hooks/useGeolocation"

function BackgroundGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[110px] dark:bg-primary/15" />
      <div className="absolute top-72 -right-20 h-72 w-72 rounded-full bg-success/15 blur-[100px] dark:bg-success/10" />
    </div>
  )
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="font-heading text-xl font-semibold tracking-tight text-balance sm:text-2xl">
        {title}
      </h2>
    </div>
  )
}

function App() {
  const [coords, setCoords] = useState<Coords | null>(null)

  return (
    <div className="min-h-svh bg-background text-foreground">
      <BackgroundGlow />
      <FloatingNav />

      <main className="mx-auto max-w-5xl px-4 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 py-12 text-center sm:py-16"
        >
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Never overpay for delivery again
          </h1>
          <p className="mx-auto max-w-xl text-balance text-muted-foreground sm:text-lg">
            MealMatch AI checks Swiggy and Zomato live, side by side, so you always know which one's the
            better deal before you order.
          </p>
          <div className="flex justify-center">
            <LocationBar onCoordsChange={setCoords} />
          </div>
          <div className="flex justify-center">
            <PlatformAvailability coords={coords} />
          </div>
        </motion.section>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-16"
        >
          <motion.section variants={fadeUp} className="space-y-4" aria-labelledby="compare-heading">
            <SectionHeading id="compare-heading" eyebrow="Live comparison" title="Compare a dish across platforms" />
            <CompareSearch coords={coords} />
          </motion.section>

          <motion.section variants={fadeUp} className="space-y-4" aria-labelledby="suggested-heading">
            <SectionHeading id="suggested-heading" eyebrow="Discover" title="Popular near you" />
            <SuggestedFoods coords={coords} />
          </motion.section>
        </motion.div>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        MealMatch AI · Prices are fetched live and can change between visits.
      </footer>
    </div>
  )
}

export default App
