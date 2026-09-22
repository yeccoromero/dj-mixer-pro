import { describe, expect, it } from 'vitest'
import { registerTap } from './bpm'

describe('registerTap', () => {
  it('returns no BPM after a single tap', () => {
    const result = registerTap([], 0)
    expect(result.bpm).toBeNull()
    expect(result.history).toEqual([0])
  })

  it('estimates BPM from two taps a fixed interval apart', () => {
    // 500ms between taps = 120 taps/min
    const first = registerTap([], 0)
    const second = registerTap(first.history, 500)
    expect(second.bpm).toBe(120)
  })

  it('averages the interval across several taps', () => {
    let history: number[] = []
    let bpm: number | null = null
    for (const t of [0, 500, 1000, 1500]) {
      ;({ history, bpm } = registerTap(history, t))
    }
    expect(bpm).toBe(120)
  })

  it('starts a fresh reading after a long gap between taps', () => {
    const first = registerTap([], 0)
    const second = registerTap(first.history, 500)
    expect(second.bpm).toBe(120)

    // A 3s gap is treated as the start of a new tap-tempo attempt, not a slow beat.
    const third = registerTap(second.history, 3500)
    expect(third.history).toEqual([3500])
    expect(third.bpm).toBeNull()
  })

  it('keeps only the most recent taps', () => {
    let history: number[] = []
    for (let i = 0; i < 20; i++) {
      ;({ history } = registerTap(history, i * 500))
    }
    expect(history.length).toBeLessThanOrEqual(8)
  })
})
