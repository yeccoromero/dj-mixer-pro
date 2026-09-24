import { afterEach, describe, expect, it, vi } from 'vitest'

// Real Tone.js talks to the Web Audio API, which jsdom doesn't implement — this stands in a
// minimal fake covering exactly what effectSounds.ts calls on each node type, so `startEffect`
// exercises its real logic (the lazy `import('tone')`, the hold/release lifecycle, one live
// instance per effect id) without needing actual audio.
function fakeNode() {
  const node = {
    connect: vi.fn(() => node),
    toDestination: vi.fn(() => node),
    dispose: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    volume: { value: 0, rampTo: vi.fn() },
    frequency: {
      value: 0,
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      rampTo: vi.fn(),
    },
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
  }
  return node
}

vi.mock('tone', () => {
  const start = vi.fn().mockResolvedValue(undefined)
  const now = vi.fn(() => 0)
  class Fake {
    constructor() {
      return fakeNode()
    }
  }
  return {
    start,
    now,
    Vibrato: Fake,
    Synth: Fake,
    PolySynth: Fake,
    Distortion: Fake,
    Chorus: Fake,
    PingPongDelay: Fake,
    Filter: Fake,
    BitCrusher: Fake,
    Noise: Fake,
  }
})

describe('effectSounds', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // startEffect's chain runs through a real dynamic `import('tone')` (see loadTone in
  // effectSounds.ts) — even mocked via vi.mock, Vitest resolves that through its own module
  // loader, which isn't purely microtask-based the way a plain `Promise.resolve()` chain is.
  // A couple of real macrotask turns (setTimeout(0)) reliably drains it; pure microtask
  // flushing did not.
  async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  it('does not start a second instance of the same effect while one is already held', async () => {
    const { startEffect } = await import('./effectSounds')
    startEffect('siren')
    await flushMicrotasks()
    startEffect('siren')
    await flushMicrotasks()

    const Tone = await import('tone')
    // Only the first call should have gone through Tone.start(); a second press of the same
    // still-held pad is a no-op in startEffect before it ever reaches the module loader.
    expect(Tone.start).toHaveBeenCalledTimes(1)
  })

  it('stopping an effect that was never started does nothing', async () => {
    const { stopEffect } = await import('./effectSounds')
    expect(() => stopEffect('radio')).not.toThrow()
  })

  it('starting and stopping different effects tracks each independently', async () => {
    const { startEffect, stopEffect } = await import('./effectSounds')
    startEffect('laser')
    await flushMicrotasks()
    startEffect('radio')
    await flushMicrotasks()

    // Stopping one doesn't throw or affect the other still being tracked as live.
    expect(() => stopEffect('laser')).not.toThrow()
    expect(() => stopEffect('radio')).not.toThrow()
  })
})
