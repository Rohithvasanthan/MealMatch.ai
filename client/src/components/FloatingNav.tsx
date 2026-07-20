import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { UtensilsCrossedIcon } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"

export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        aria-label="Primary"
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-2.5 backdrop-blur-lg transition-shadow duration-300",
          scrolled && "shadow-lg shadow-black/[0.04] dark:shadow-black/20",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UtensilsCrossedIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">MealMatch AI</span>
        </div>
        <ThemeToggle />
      </nav>
    </motion.header>
  )
}
