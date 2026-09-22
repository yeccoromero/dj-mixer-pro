import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVideoEmbeddable } from './youtubeEmbedCheck'

vi.mock('./youtube', () => ({
  loadYouTubeApi: vi.fn(),
  describeYouTubeError: (code: number) => `error-${code}`,
}))

import { loadYouTubeApi } from './youtube'

let capturedEvents: {
  onReady?: () => void
  onError?: (event: { data: number }) => void
}
const destroyMock = vi.fn()

function mockApiReady() {
  class FakePlayer {
    constructor(_el: unknown, options: { events: typeof capturedEvents }) {
      capturedEvents = options.events
      return { destroy: destroyMock } as unknown as FakePlayer
    }
  }
  vi.mocked(loadYouTubeApi).mockResolvedValue({
    Player: FakePlayer,
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
  } as unknown as Awaited<ReturnType<typeof loadYouTubeApi>>)
}

describe('checkVideoEmbeddable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    destroyMock.mockClear()
    mockApiReady()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves playable once the grace window passes with no onError', async () => {
    const promise = checkVideoEmbeddable('abc')
    await vi.advanceTimersByTimeAsync(0)
    capturedEvents.onReady?.()
    await vi.advanceTimersByTimeAsync(2500)
    await expect(promise).resolves.toEqual({ playable: true })
  })

  it('resolves blocked when onError arrives shortly after onReady (the real UMPG-style case)', async () => {
    const promise = checkVideoEmbeddable('abc')
    await vi.advanceTimersByTimeAsync(0)
    // onReady fires first (the player shell is up)...
    capturedEvents.onReady?.()
    // ...then onError arrives a moment later, once YouTube evaluates this specific video.
    await vi.advanceTimersByTimeAsync(500)
    capturedEvents.onError?.({ data: 101 })
    await expect(promise).resolves.toEqual({ playable: false, reason: 'error-101' })
  })

  it('resolves blocked immediately on onError even without a prior onReady', async () => {
    const promise = checkVideoEmbeddable('abc')
    await vi.advanceTimersByTimeAsync(0)
    capturedEvents.onError?.({ data: 150 })
    await expect(promise).resolves.toEqual({ playable: false, reason: 'error-150' })
  })

  it('fails open (playable) if neither event ever fires', async () => {
    const promise = checkVideoEmbeddable('abc')
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10000)
    await expect(promise).resolves.toEqual({ playable: true })
  })

  it('destroys the hidden player once it settles', async () => {
    const promise = checkVideoEmbeddable('abc')
    await vi.advanceTimersByTimeAsync(0)
    capturedEvents.onError?.({ data: 101 })
    await promise
    expect(destroyMock).toHaveBeenCalledTimes(1)
  })
})
