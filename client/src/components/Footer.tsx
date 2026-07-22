import { Heart, Sparkles } from "lucide-react"

export function Footer() {
  return (
    <footer className="w-full border-t border-gray-100 bg-white px-6 py-12 dark:border-white/10 dark:bg-gray-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-orange to-amber-500 text-sm font-bold text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-display text-sm leading-none font-extrabold tracking-tight text-gray-900 dark:text-white">
              MealMatch<span className="text-brand-orange">.ai</span>
            </span>
            <span className="mt-0.5 font-mono text-[9px] font-semibold tracking-widest text-gray-400 uppercase dark:text-gray-500">
              The Food Pricing Arbitrage Engine
            </span>
          </div>
        </div>

        <p className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
          Made with <Heart className="h-3.5 w-3.5 animate-pulse fill-rose-500 text-rose-500" /> for smart spenders. ©
          2026 MealMatch AI. All rights reserved.
        </p>

        <div className="flex items-center gap-6 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <a href="#" className="transition-colors hover:text-brand-orange">
            Privacy Policy
          </a>
          <a href="#" className="transition-colors hover:text-brand-orange">
            Terms of Service
          </a>
          <a href="#" className="transition-colors hover:text-brand-orange">
            Contact Support
          </a>
        </div>
      </div>
    </footer>
  )
}
