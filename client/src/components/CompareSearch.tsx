import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronDownIcon,
  ClockIcon,
  SearchIcon,
  SearchXIcon,
  TrophyIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { Coords } from "@/hooks/useGeolocation"
import { useCompare } from "@/hooks/useMealMatchQueries"
import { fadeUp, staggerContainer } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { MenuItem, Platform, PlatformSearchResult } from "@/types/api"

const PLATFORM_LABEL: Record<Platform, string> = { swiggy: "Swiggy", zomato: "Zomato" }
const VISIBLE_ITEMS = 5

function EmptyState({ icon: Icon, message }: { icon: typeof SearchXIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ItemRow({ item }: { item: MenuItem }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{item.restaurantName}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-semibold">₹{item.price}</span>
        {item.etaMinutes != null && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3" aria-hidden="true" />
            {item.etaMinutes} min
          </span>
        )}
      </div>
    </li>
  )
}

function PlatformResultCard({ result, isWinner }: { result: PlatformSearchResult; isWinner: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? result.items : result.items.slice(0, VISIBLE_ITEMS)
  const remaining = result.items.length - visible.length

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={cn(
          "relative h-full transition-shadow",
          isWinner && "ring-2 ring-primary shadow-lg shadow-primary/10",
        )}
      >
        {isWinner && (
          <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-medium text-primary-foreground shadow">
            <TrophyIcon className="size-3" aria-hidden="true" />
            Best deal
          </span>
        )}
        <CardHeader>
          <CardTitle>{PLATFORM_LABEL[result.platform]}</CardTitle>
        </CardHeader>
        <CardContent>
          {result.availability === "not_serviceable" && (
            <p className="text-sm text-muted-foreground">Not serviceable at this location.</p>
          )}
          {result.availability === "error" && (
            <p className="text-sm text-muted-foreground">
              {result.errorMessage ?? "Unavailable right now."}
            </p>
          )}
          {result.availability === "available" && result.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No matching items found.</p>
          )}
          {result.availability === "available" && result.items.length > 0 && (
            <>
              <ul className="divide-y divide-border/60">
                {visible.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
              {remaining > 0 && (
                <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setExpanded(true)}>
                  Show {remaining} more <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function CompareSearch({ coords }: { coords: Coords | null }) {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 500)
  const { data, isLoading, isFetching, isError, refetch } = useCompare(coords, debouncedQuery)

  const searching = debouncedQuery.trim().length > 0
  const bothFailed = data?.results.every((r) => r.availability === "error") ?? false

  return (
    <div className="space-y-5">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Search for a dish to compare"
          placeholder="Search for a dish, e.g. biryani"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!coords}
          className="h-11 rounded-2xl pr-9 pl-10 text-base shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!coords && (
          <motion.div key="no-location" {...fadeInOut}>
            <EmptyState icon={SearchXIcon} message="Set your location above to start comparing." />
          </motion.div>
        )}

        {coords && !searching && (
          <motion.div key="idle" {...fadeInOut}>
            <EmptyState icon={SearchIcon} message="Start typing to compare live prices from Swiggy and Zomato." />
          </motion.div>
        )}

        {coords && searching && (isLoading || isFetching) && (
          <motion.div key="loading" {...fadeInOut} className="space-y-4">
            <p
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                className="size-3.5 rounded-full border-2 border-primary border-t-transparent"
                aria-hidden="true"
              />
              Fetching live prices from Swiggy &amp; Zomato — this can take up to 30 seconds
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-52 w-full rounded-2xl" />
              <Skeleton className="h-52 w-full rounded-2xl" />
            </div>
          </motion.div>
        )}

        {coords && searching && !isLoading && isError && (
          <motion.div key="error" {...fadeInOut} className="space-y-3">
            <EmptyState icon={WifiOffIcon} message="Couldn't reach the comparison service." />
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          </motion.div>
        )}

        {coords && searching && !isLoading && data && bothFailed && (
          <motion.div key="both-failed" {...fadeInOut} className="space-y-3">
            <EmptyState
              icon={WifiOffIcon}
              message="Both Swiggy and Zomato failed to respond right now. Please try again shortly."
            />
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          </motion.div>
        )}

        {coords && searching && !isLoading && data && !bothFailed && (
          <motion.div key="results" {...fadeInOut} className="space-y-4">
            {data.bestDeal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                role="status"
                className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-center text-sm"
              >
                <TrophyIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{PLATFORM_LABEL[data.bestDeal.winner]}</span> is the best
                  deal — {data.bestDeal.reasoning}
                </span>
              </motion.div>
            )}

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2"
            >
              {data.results.map((result) => (
                <PlatformResultCard
                  key={result.platform}
                  result={result}
                  isWinner={data.bestDeal?.winner === result.platform}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const fadeInOut = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
}
