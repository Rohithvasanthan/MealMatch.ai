import "@testing-library/jest-dom/vitest"
import React from "react"
import { vi } from "vitest"

// jsdom has no real matchMedia implementation — needed by useTheme's
// system-color-scheme detection and any prefers-color-scheme / responsive checks.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

// jsdom has no real animation frames, so framer-motion's AnimatePresence exit
// transitions (mode="wait") never resolve and stale content sticks around
// forever. Tests only care about final DOM state, so strip animation and
// render children directly.
vi.mock("framer-motion", () => {
  const MOTION_ONLY_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileInView",
    "whileFocus",
    "whileDrag",
    "layout",
    "layoutId",
    "custom",
    "viewport",
    "onAnimationStart",
    "onAnimationComplete",
  ])

  function stripMotionProps(props: Record<string, unknown>) {
    const rest: Record<string, unknown> = {}
    for (const key in props) {
      if (!MOTION_ONLY_PROPS.has(key)) rest[key] = props[key]
    }
    return rest
  }

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        React.forwardRef((props: Record<string, unknown>, ref) =>
          React.createElement(tag, { ...stripMotionProps(props), ref }),
        ),
    },
  )

  const AnimatePresence = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)

  const MotionConfig = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)

  return { motion, AnimatePresence, MotionConfig }
})
