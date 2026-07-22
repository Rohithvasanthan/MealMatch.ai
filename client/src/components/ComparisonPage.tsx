import { memo, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  ChevronDown,
  Clock,
  ImageOff,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  WifiOff,
} from "lucide-react"
import { platformMeta, ROADMAP_PLATFORMS } from "@/lib/platforms"
import { useTheme } from "@/lib/themeStore"
import type { ComparisonResult, MenuItem, PlatformSearchResult } from "@/types/api"

const LOADING_STEPS = [
  "Checking your location on every platform...",
  "Searching for matching items...",
  "Comparing live prices and delivery fees...",
  "Determining the cheaper option...",
]

const VISIBLE_ITEMS = 5

// Provider failures are never shown to the user verbatim (raw scraper/network
// errors like "net::ERR_HTTP2_PROTOCOL_ERROR" or Playwright stack traces are
// an implementation detail) — every errorCode maps to one of these two clean,
// generic phrases instead.
function unavailableMessage(result: PlatformSearchResult): string {
  if (result.availability === "not_serviceable") return "Not serviceable at this location"
  if (result.errorCode === "ITEM_NOT_FOUND") return "No Results Available"
  return "Currently Unavailable"
}

function finalCost(item: MenuItem): number {
  return item.price + (item.deliveryFee ?? 0) + (item.platformFee ?? 0) + (item.packingFee ?? 0)
}

function cheapestCost(result: PlatformSearchResult): number | null {
  if (result.availability !== "available" || result.items.length === 0) return null
  return Math.min(...result.items.map(finalCost))
}

const ItemRow = memo(function ItemRow({ item }: { item: MenuItem }) {
  const Wrapper = item.itemUrl ? "a" : "div"
  return (
    <Wrapper
      {...(item.itemUrl ? { href: item.itemUrl, target: "_blank", rel: "noreferrer noopener" } : {})}
      className={`group/item flex items-start gap-3 rounded-2xl border-b border-gray-50 px-2 py-3 -mx-2 transition-colors last:border-0 dark:border-white/5 ${
        item.itemUrl ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" : ""
      }`}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-white/5">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ImageOff className="h-4 w-4 text-gray-300 dark:text-gray-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{item.name}</p>
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">{item.restaurantName}</p>
        {item.offerText && (
          <span className="mt-1 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-600 uppercase dark:bg-emerald-500/10 dark:text-emerald-400">
            {item.offerText}
          </span>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
        <span className="flex items-baseline gap-1.5">
          {item.originalPrice != null && item.originalPrice > item.price && (
            <span className="text-[10px] text-gray-300 line-through dark:text-gray-600">₹{item.originalPrice}</span>
          )}
          <span className="text-sm font-black text-gray-900 dark:text-gray-100">₹{item.price}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          {item.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.etaMinutes != null && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {item.etaMinutes}m
            </span>
          )}
          {item.distanceKm != null && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {item.distanceKm.toFixed(1)}km
            </span>
          )}
        </span>
        {item.deliveryFee != null && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-400 dark:text-gray-500">
            <ReceiptText className="h-2.5 w-2.5" />₹{item.deliveryFee} delivery
          </span>
        )}
        {item.itemUrl ? (
          <span className="mt-1 flex items-center gap-0.5 rounded-full border border-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-500 transition-colors group-hover/item:border-brand-orange/30 group-hover/item:text-brand-orange dark:border-white/10 dark:text-gray-400">
            Open <ArrowUpRight className="h-2.5 w-2.5" />
          </span>
        ) : (
          <span
            aria-disabled="true"
            title="Exact product page unavailable."
            className="mt-1 flex cursor-not-allowed items-center gap-0.5 rounded-full border border-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-300 dark:border-white/5 dark:text-gray-600"
          >
            Open <ArrowUpRight className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    </Wrapper>
  )
})

const PlatformColumn = memo(function PlatformColumn({
  result,
  isWinner,
}: {
  result: PlatformSearchResult
  isWinner: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = platformMeta(result.platform)
  const visible = expanded ? result.items : result.items.slice(0, VISIBLE_ITEMS)
  const remaining = result.items.length - visible.length
  const failed = result.availability !== "available" || result.items.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={failed ? undefined : { y: -3 }}
      className={`relative overflow-hidden rounded-[32px] border bg-white transition-all dark:bg-gray-900 ${
        isWinner
          ? "border-emerald-500 shadow-xl ring-2 ring-emerald-500/10 dark:border-emerald-400 dark:ring-emerald-400/10"
          : "border-gray-100 shadow-sm hover:shadow-md dark:border-white/10 dark:hover:border-white/20"
      }`}
    >
      <div
        className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-tr to-transparent px-6 py-5 dark:border-white/10"
        style={{ backgroundImage: `linear-gradient(to top right, ${meta.color}1a, transparent)` }}
      >
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full" style={{ backgroundColor: meta.color }} />
          <p className="font-display text-lg leading-none font-black text-gray-900 dark:text-white">{meta.name}</p>
        </div>
        {isWinner && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-md">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Cheapest deal</span>
          </div>
        )}
      </div>

      <div className="p-6 md:p-8">
        {(result.availability === "not_serviceable" || result.availability === "error") && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 dark:bg-white/5 dark:text-gray-600">
              <Ban className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{unavailableMessage(result)}</p>
          </div>
        )}
        {result.availability === "available" && result.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 dark:bg-white/5 dark:text-gray-600">
              <Ban className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{unavailableMessage(result)}</p>
          </div>
        )}
        {result.availability === "available" && result.items.length > 0 && (
          <>
            <div>
              {visible.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
            {remaining > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Show {remaining} more <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
})

const RoadmapCard = memo(function RoadmapCard({ id }: { id: (typeof ROADMAP_PLATFORMS)[number] }) {
  const meta = platformMeta(id)
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[32px] border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center opacity-70 dark:border-white/10 dark:bg-white/[0.02]">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white"
        style={{ backgroundColor: meta.color }}
      >
        {meta.short}
      </div>
      <p className="font-display text-sm font-bold text-gray-500 dark:text-gray-400">{meta.name}</p>
      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[9px] font-extrabold tracking-widest text-gray-400 uppercase dark:bg-white/5 dark:text-gray-500">
        Coming soon
      </span>
    </div>
  )
})

const CONFETTI_COLORS = ["#ff6b00", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"]

function WinnerBanner({ result }: { result: ComparisonResult }) {
  const { bestDeal, results } = result
  const { theme } = useTheme()
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: `${bestDeal?.winner}-${i}`,
        angle: (i / 22) * 360 + Math.random() * 12,
        distance: 60 + Math.random() * 90,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.15,
        size: 5 + Math.random() * 5,
      })),
    [bestDeal?.winner],
  )

  if (!bestDeal) return null
  const meta = platformMeta(bestDeal.winner)

  const winnerCost = cheapestCost(results.find((r) => r.platform === bestDeal.winner)!)
  const runnerUpCost = results
    .filter((r) => r.platform !== bestDeal.winner)
    .map(cheapestCost)
    .filter((c): c is number => c != null)
    .sort((a, b) => a - b)[0]
  const savings = winnerCost != null && runnerUpCost != null ? runnerUpCost - winnerCost : null
  const baseSurface = theme === "dark" ? "#131316" : "#ffffff"

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
      className="relative mb-8 overflow-hidden rounded-[28px] border px-6 py-6 md:px-8"
      style={{
        borderColor: `${meta.color}33`,
        background: `linear-gradient(135deg, ${meta.color}12, transparent 60%), ${baseSurface}`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180
          return (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(rad) * p.distance,
                y: Math.sin(rad) * p.distance * 0.6 - 10,
                opacity: 0,
                scale: 0.4,
              }}
              transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
              className="absolute top-10 left-1/2 rounded-full"
              style={{ width: p.size, height: p.size, backgroundColor: p.color }}
            />
          )
        })}
      </div>

      <div className="relative flex flex-col items-center gap-3 text-center md:flex-row md:items-center md:justify-center md:gap-4">
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ backgroundColor: meta.color }}
        >
          <Trophy className="h-6 w-6" />
        </motion.span>
        <div>
          <p className="font-display text-lg font-black text-gray-950 md:text-xl dark:text-white">
            <Sparkles className="mr-1 inline h-4 w-4 text-brand-orange" />
            Best Deal Found! {meta.name}
            {savings != null && savings > 0.5 ? ` saves ₹${savings.toFixed(0)}` : ""}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500 md:text-sm dark:text-gray-400">{bestDeal.reasoning}</p>
        </div>
      </div>
    </motion.div>
  )
}

function LoadingSkeletonGrid() {
  return (
    <div className="mt-10 grid w-full grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((col) => (
        <div key={col} className="overflow-hidden rounded-[32px] border border-gray-100 bg-white p-6 md:p-8 dark:border-white/10 dark:bg-gray-900">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-24 animate-pulse rounded-md bg-gray-100 dark:bg-white/5" />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0 dark:border-white/5">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
                <div className="h-full w-full animate-shimmer bg-[linear-gradient(110deg,#f3f4f6,45%,#fafafa,55%,#f3f4f6)] bg-[length:200%_100%] dark:bg-[linear-gradient(110deg,#1f1f23,45%,#27272a,55%,#1f1f23)]" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-shimmer rounded bg-[linear-gradient(110deg,#f3f4f6,45%,#fafafa,55%,#f3f4f6)] bg-[length:200%_100%] dark:bg-[linear-gradient(110deg,#1f1f23,45%,#27272a,55%,#1f1f23)]" />
                <div className="h-2.5 w-1/2 animate-shimmer rounded bg-[linear-gradient(110deg,#f3f4f6,45%,#fafafa,55%,#f3f4f6)] bg-[length:200%_100%] dark:bg-[linear-gradient(110deg,#1f1f23,45%,#27272a,55%,#1f1f23)]" />
              </div>
              <div className="h-4 w-10 flex-shrink-0 animate-shimmer rounded bg-[linear-gradient(110deg,#f3f4f6,45%,#fafafa,55%,#f3f4f6)] bg-[length:200%_100%] dark:bg-[linear-gradient(110deg,#1f1f23,45%,#27272a,55%,#1f1f23)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ComparisonPage({
  result,
  loading,
  isError,
  onBack,
  onRetry,
}: {
  result: ComparisonResult | null
  loading: boolean
  isError: boolean
  onBack: () => void
  onRetry: () => void
}) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!loading) {
      setCurrentStep(0)
      return
    }
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev))
    }, 900)
    return () => clearInterval(interval)
  }, [loading])

  if (isError) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <button
          onClick={onBack}
          className="mb-8 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-xl border border-gray-100 bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm transition-all hover:border-orange-100 hover:text-brand-orange dark:border-white/10 dark:bg-gray-900 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to search</span>
        </button>
        <WifiOff className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Couldn't reach the comparison service.</p>
        <button
          onClick={onRetry}
          className="mt-4 cursor-pointer rounded-xl bg-gray-950 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-brand-orange dark:bg-white dark:text-gray-950 dark:hover:bg-brand-orange dark:hover:text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (loading || !result) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-10 text-center">
        <div className="relative mb-8 h-24 w-24">
          <div className="absolute inset-0 animate-pulse rounded-full border-4 border-orange-500/10" />
          <div className="border-t-brand-orange absolute inset-0 animate-spin rounded-full border-4 border-r-transparent" />
          <div className="absolute inset-0 flex items-center justify-center text-brand-orange">
            <Sparkles className="h-8 w-8 animate-pulse" />
          </div>
        </div>
        <div className="flex h-14 flex-col justify-center">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="font-display text-base font-extrabold text-gray-800 md:text-lg dark:text-gray-100"
          >
            {LOADING_STEPS[currentStep]}
          </motion.p>
          <p className="mt-2 font-mono text-xs text-gray-400 dark:text-gray-500">
            All providers are queried concurrently — real browsers, real pages, no shortcuts.
          </p>
        </div>
        <LoadingSkeletonGrid />
      </div>
    )
  }

  const bothFailed = result.results.every((r) => r.availability === "error")
  const workingResults = result.results.filter((r) => r.availability === "available" && r.items.length > 0)
  const unavailableResults = result.results.filter((r) => !(r.availability === "available" && r.items.length > 0))

  return (
    <div className="w-full py-6">
      <button
        onClick={onBack}
        className="mb-8 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-100 bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm transition-all hover:border-orange-100 hover:text-brand-orange dark:border-white/10 dark:bg-gray-900 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to search</span>
      </button>

      <h2 className="font-display mb-6 text-2xl font-black tracking-tight text-gray-900 md:text-3xl dark:text-white">
        Results for &ldquo;{result.query}&rdquo;
      </h2>

      {bothFailed ? (
        <div className="rounded-[32px] border border-gray-100 bg-white p-10 text-center dark:border-white/10 dark:bg-gray-900">
          <Ban className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-600 dark:text-gray-300">All platforms failed to respond right now.</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Please try again shortly.</p>
        </div>
      ) : (
        <>
          {result.bestDeal && <WinnerBanner result={result} />}

          {workingResults.length > 0 && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {workingResults.map((r) => (
                <PlatformColumn key={r.platform} result={r} isWinner={result.bestDeal?.winner === r.platform} />
              ))}
            </div>
          )}

          {(unavailableResults.length > 0 || ROADMAP_PLATFORMS.length > 0) && (
            <div className="mt-10">
              <div className="mb-5 flex items-center gap-3">
                <span className="font-mono text-[10px] font-extrabold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                  Unavailable
                </span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-white/10" />
              </div>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {unavailableResults.map((r) => (
                  <PlatformColumn key={r.platform} result={r} isWinner={false} />
                ))}
                {ROADMAP_PLATFORMS.map((id) => (
                  <RoadmapCard key={id} id={id} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
