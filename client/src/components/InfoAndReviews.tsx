import { useState } from "react"
import { Calculator, ChevronDown, HelpCircle, MessageSquare, Smartphone, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { FAQS } from "@/lib/content"

const STEPS = [
  {
    icon: <MessageSquare className="h-6 w-6 text-brand-orange" />,
    title: "Type your craving",
    desc: "Type what you want in plain words — a dish name or a natural phrase. That text is sent as-is to both platforms' search.",
  },
  {
    icon: <Calculator className="h-6 w-6 text-amber-500" />,
    title: "Live parallel scrape",
    desc: "We search Swiggy, Zomato and Blinkit at your exact location in parallel, in real time, using a headless browser — never a cached catalog.",
  },
  {
    icon: <Smartphone className="h-6 w-6 text-emerald-500" />,
    title: "See the cheaper option",
    desc: "We show both platforms' real results side by side and highlight whichever is cheaper, with the reasoning. You complete the order in that platform's own app.",
  },
]

export function InfoAndReviews() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index)
  }

  return (
    <div className="w-full space-y-24 py-16">
      <div>
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-brand-orange uppercase">
            <Sparkles className="h-4 w-4 text-brand-orange" />
            <span>Arbitrage algorithm</span>
          </div>
          <h3 className="font-display text-3xl font-black tracking-tight text-gray-900 md:text-4xl dark:text-white">
            How MealMatch AI Operates
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed font-medium text-gray-500 dark:text-gray-400">
            A three-step micro-second financial audit of your gourmet cravings across major food giants.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group flex flex-col items-start rounded-3xl border border-gray-100 bg-white p-8 transition-all hover:shadow-lg dark:border-white/10 dark:bg-gray-900 dark:hover:border-white/20"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 transition-transform group-hover:scale-110 dark:bg-white/5">
                {step.icon}
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-gray-50 px-2 py-0.5 font-mono text-xs font-bold text-gray-400 dark:bg-white/5 dark:text-gray-500">
                  0{idx + 1}
                </span>
                <h4 className="font-display text-lg font-extrabold text-gray-900 dark:text-white">{step.title}</h4>
              </div>
              <p className="mt-4 text-xs leading-relaxed font-normal text-gray-500 dark:text-gray-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest text-brand-orange uppercase">
            <HelpCircle className="h-4 w-4 text-brand-orange" />
            <span>Have questions?</span>
          </div>
          <h3 className="font-display text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h3>
          <p className="mt-2 max-w-lg text-sm font-medium text-gray-500 dark:text-gray-400">
            Clear, transparent answers about MealMatch AI scraping algorithms and calculations.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = activeFaq === idx
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 dark:border-white/10 dark:bg-gray-900"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="font-display flex w-full cursor-pointer items-center justify-between p-5 text-left text-sm font-extrabold text-gray-800 transition-colors hover:text-brand-orange md:text-base dark:text-gray-200"
                >
                  <span>{faq.question}</span>
                  <div
                    className={`rounded-xl bg-gray-50 p-1.5 transition-transform duration-200 dark:bg-white/5 ${isOpen ? "rotate-180 bg-orange-50 text-brand-orange dark:bg-brand-orange/10" : "text-gray-400 dark:text-gray-500"}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="border-t border-gray-50 p-5 pt-0 text-xs leading-relaxed font-normal text-gray-500 dark:border-white/5 dark:text-gray-400">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
