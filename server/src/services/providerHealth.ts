import type { Platform } from "../types/domain.js"

// Lightweight in-memory circuit breaker: after a provider fails repeatedly we
// stop sending it requests for a cooldown window (doubling on each further
// trip, capped) instead of burning a full scraper timeout on every single
// search. A single success clears it immediately.
const FAILURE_THRESHOLD = 3
const BASE_COOLDOWN_MS = 60_000
const MAX_COOLDOWN_MS = 5 * 60_000

interface HealthState {
  consecutiveFailures: number
  unhealthyUntil: number
  cooldownMs: number
}

const state = new Map<Platform, HealthState>()

function getState(platform: Platform): HealthState {
  let s = state.get(platform)
  if (!s) {
    s = { consecutiveFailures: 0, unhealthyUntil: 0, cooldownMs: BASE_COOLDOWN_MS }
    state.set(platform, s)
  }
  return s
}

export function isCircuitOpen(platform: Platform): boolean {
  return getState(platform).unhealthyUntil > Date.now()
}

export function recordSuccess(platform: Platform): void {
  const s = getState(platform)
  s.consecutiveFailures = 0
  s.unhealthyUntil = 0
  s.cooldownMs = BASE_COOLDOWN_MS
}

export function recordFailure(platform: Platform): void {
  const s = getState(platform)
  s.consecutiveFailures += 1
  if (s.consecutiveFailures >= FAILURE_THRESHOLD) {
    s.unhealthyUntil = Date.now() + s.cooldownMs
    s.cooldownMs = Math.min(s.cooldownMs * 2, MAX_COOLDOWN_MS)
  }
}
