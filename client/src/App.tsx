import { lazy, Suspense, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Compass, LoaderCircle, Sparkles } from "lucide-react"
import { Navigation } from "@/components/Navigation"
import { ProviderStatusStrip } from "@/components/ProviderStatusStrip"
import { HeroSection } from "@/components/HeroSection"
import { CategoryGrid } from "@/components/CategoryGrid"
import { BestSavings } from "@/components/BestSavings"
import { InfoAndReviews } from "@/components/InfoAndReviews"
import { Footer } from "@/components/Footer"
import { LocationOnboarding } from "@/components/LocationOnboarding"
import { useLocation } from "@/lib/locationStore"
import { useCompare } from "@/hooks/useMealMatchQueries"

const ComparisonPage = lazy(() =>
  import("@/components/ComparisonPage").then((m) => ({ default: m.ComparisonPage })),
)

function ComparisonPageFallback() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-brand-orange" />
    </div>
  )
}

function App() {
  const { location, setLocation } = useLocation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeQuery, setActiveQuery] = useState("")
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const coords = location ? { lat: location.lat, lng: location.lng } : null
  const { data: comparisonResult, isLoading, isFetching, isError, refetch } = useCompare(coords, activeQuery)
  const isSearching = activeQuery.trim().length > 0

  const handleSearchSubmit = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    setActiveQuery(trimmed)
    setRecentSearches((prev) => (prev.includes(trimmed) ? prev : [trimmed, ...prev.slice(0, 4)]))
  }

  const handleCategorySelect = (id: string, name: string) => {
    setSelectedCategory(id)
    handleSearchSubmit(name)
  }

  const handleClearRecent = () => setRecentSearches([])

  const handleBack = () => {
    setActiveQuery("")
    setSelectedCategory(null)
  }

  if (!location) {
    return <LocationOnboarding onSelect={setLocation} />
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#FAFAFA] pb-20 md:pb-0 dark:bg-gray-950">
      <Navigation location={location} onChangeLocation={() => setPickerOpen(true)} />
      {!isSearching && <ProviderStatusStrip coords={coords} />}

      <AnimatePresence>
        {pickerOpen && (
          <LocationOnboarding
            onSelect={(next) => {
              setLocation(next)
              setPickerOpen(false)
            }}
          />
        )}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-7xl flex-grow px-6 py-6">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="comparison-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <Suspense fallback={<ComparisonPageFallback />}>
                <ComparisonPage
                  result={comparisonResult ?? null}
                  loading={isLoading || isFetching}
                  isError={isError}
                  onBack={handleBack}
                  onRetry={refetch}
                />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="home-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-12"
            >
              <HeroSection
                onSearchSubmit={handleSearchSubmit}
                recentSearches={recentSearches}
                onClearRecent={handleClearRecent}
              />

              <CategoryGrid selectedCategory={selectedCategory} onSelectCategory={handleCategorySelect} />

              <BestSavings coords={coords} />

              <InfoAndReviews />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-gray-100 bg-white/80 px-6 py-2.5 backdrop-blur-lg md:hidden dark:border-white/10 dark:bg-gray-950/80">
        <button
          onClick={handleBack}
          className={`flex cursor-pointer flex-col items-center gap-1 ${!isSearching ? "text-brand-orange" : "text-gray-400 dark:text-gray-500"}`}
        >
          <Compass className="h-5.5 w-5.5" />
          <span className="text-[10px] font-bold">Discover</span>
        </button>

        <button
          onClick={() => handleSearchSubmit("biryani")}
          className="group flex cursor-pointer flex-col items-center gap-1 text-gray-400"
        >
          <div className="-mt-6 rounded-full bg-brand-orange p-2 text-white shadow-md shadow-brand-orange/25 transition-all group-hover:scale-105">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold text-brand-orange">Quick Search</span>
        </button>
      </div>
    </div>
  )
}

export default App
