const MAX_TAP_GAP_MS = 2000
const MAX_TAPS_REMEMBERED = 8

export interface TapResult {
  history: number[]
  bpm: number | null
}

/**
 * Feeds a new tap timestamp (ms) into a rolling tap-tempo history and returns the
 * estimated BPM from the average interval. A gap longer than MAX_TAP_GAP_MS since the
 * last tap starts a fresh attempt instead of blending with a stale rhythm.
 */
export function registerTap(history: number[], now: number): TapResult {
  const last = history[history.length - 1]
  const next = last !== undefined && now - last > MAX_TAP_GAP_MS ? [now] : [...history, now].slice(-MAX_TAPS_REMEMBERED)

  if (next.length < 2) return { history: next, bpm: null }

  const intervals = next.slice(1).map((time, i) => time - next[i])
  const avgInterval = intervals.reduce((sum, gap) => sum + gap, 0) / intervals.length
  const bpm = avgInterval > 0 ? Math.round(60000 / avgInterval) : null
  return { history: next, bpm }
}
