import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, MapPin, Moon, Sparkles, Sun } from "lucide-react"
import type { StoredLocation } from "@/lib/locationStore"
import { useTheme } from "@/lib/themeStore"

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-100/80 bg-gray-50/70 text-gray-500 shadow-sm transition-all hover:border-orange-100 hover:text-brand-orange dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-brand-orange/30 dark:hover:text-brand-orange"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export function Navigation({ location, onChangeLocation }: { location: StoredLocation; onChangeLocation: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100/80 bg-white/75 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="group relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 text-white shadow-lg shadow-brand-orange/15 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
            <Sparkles className="h-5 w-5 animate-pulse-slow" />
          </div>
          <div className="flex flex-col">
            <span className="font-display leading-none text-xl font-black tracking-tight text-gray-950 dark:text-white">
              MealMatch
              <span className="bg-gradient-to-r from-brand-orange to-amber-500 bg-clip-text text-transparent">
                .ai
              </span>
            </span>
            <span className="mt-1 font-mono text-[9px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">
              Live food & grocery comparison
            </span>
          </div>
        </a>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onChangeLocation}
            className="flex cursor-pointer items-center gap-2 rounded-2xl border border-gray-100/80 bg-gray-50/70 px-4 py-2 text-xs font-semibold text-gray-800 shadow-sm transition-all hover:border-orange-100 hover:bg-orange-50/60 hover:text-brand-orange dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-brand-orange/30 dark:hover:bg-brand-orange/10 dark:hover:text-brand-orange"
          >
            <MapPin className="h-3.5 w-3.5 text-brand-orange" />
            <span className="max-w-[140px] truncate md:max-w-[220px]">{location.label}</span>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
