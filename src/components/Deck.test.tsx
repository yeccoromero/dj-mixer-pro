import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Deck } from './Deck'
import type { DeckState, Track } from './DJMixer'

let capturedWavePanelProps: { onSeek?: (ratio: number) => void; cueProgress?: number } | null = null
vi.mock('./WavePanel', () => ({
  WavePanel: (props: { onSeek?: (ratio: number) => void; cueProgress?: number }) => {
    capturedWavePanelProps = props
    return null
  },
}))

vi.mock('@/lib/youtube', async () => {
  const actual = await vi.importActual<typeof import('@/lib/youtube')>('@/lib/youtube')
  return {
    ...actual,
    loadYouTubeApi: vi.fn(),
  }
})

import { loadYouTubeApi } from '@/lib/youtube'

const mockPlayer = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  setVolume: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 0),
  loadVideoById: vi.fn(),
  destroy: vi.fn(),
}

let capturedEvents: {
  onReady?: (e: { target: typeof mockPlayer }) => void
  onStateChange?: (e: { data: number; target: typeof mockPlayer }) => void
  onError?: (e: { data: number; target: typeof mockPlayer }) => void
}

const PlayerState = { PLAYING: 1, PAUSED: 2, ENDED: 0 }

class FakePlayer {
  constructor(_el: unknown, options: { events: typeof capturedEvents }) {
    capturedEvents = options.events
    return mockPlayer as unknown as FakePlayer
  }
}

function mockYouTubeApiReady() {
  window.YT = { Player: vi.fn(), PlayerState } as unknown as Window['YT']
  ;(loadYouTubeApi as ReturnType<typeof vi.fn>).mockResolvedValue({
    Player: FakePlayer,
    PlayerState,
  })
}

const track: Track = {
  id: 't1',
  title: 'Test Track',
  artist: 'Test Artist',
  youtubeId: 'dQw4w9WgXcQ',
  duration: 200,
  thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
}

function baseState(overrides: Partial<DeckState> = {}): DeckState {
  return {
    isPlaying: false,
    currentTime: 0,
    volume: 100,
    gain: 100,
    filter: 50,
    cue: 25,
    track,
    ...overrides,
  }
}

async function renderReadyDeck(state = baseState()) {
  const onStateChange = vi.fn()
  render(<Deck id="A" state={state} onStateChange={onStateChange} isActive onActivate={vi.fn()} />)
  await act(async () => {
    await Promise.resolve()
  })
  act(() => {
    capturedEvents.onReady?.({ target: mockPlayer })
  })
  return { onStateChange }
}

describe('Deck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockYouTubeApiReady()
  })

  it('disables Play and Cue until the player fires onReady', async () => {
    render(<Deck id="A" state={baseState()} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />)
    expect(screen.getByText('Cue')).toBeDisabled()
    expect(screen.getByText('Cargando reproductor…')).toBeInTheDocument()

    await act(async () => {
      await Promise.resolve()
    })
    act(() => capturedEvents.onReady?.({ target: mockPlayer }))

    expect(screen.getByText('Cue')).toBeEnabled()
    expect(screen.queryByText('Cargando reproductor…')).not.toBeInTheDocument()
  })

  it('Play button calls playVideo() when paused', async () => {
    await renderReadyDeck(baseState({ isPlaying: false }))
    // The icon-only play/pause button is the first button rendered (Play, then Cue below it).
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockPlayer.playVideo).toHaveBeenCalled()
  })

  it('Play/Pause button calls pauseVideo() when playing', async () => {
    await renderReadyDeck(baseState({ isPlaying: true }))
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockPlayer.pauseVideo).toHaveBeenCalled()
  })

  it('a quick tap on Cue jumps to the marked point and pauses there', async () => {
    await renderReadyDeck(baseState({ cue: 25, isPlaying: true })) // track.duration = 200 -> 50s
    const cueButton = screen.getByText('Cue')
    fireEvent.pointerDown(cueButton)
    fireEvent.pointerUp(cueButton)
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(50, true)
    expect(mockPlayer.pauseVideo).toHaveBeenCalled()
  })

  it('does nothing when Play/Cue are used before the player is ready', () => {
    render(<Deck id="A" state={baseState()} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />)
    fireEvent.pointerDown(screen.getByText('Cue'))
    fireEvent.pointerUp(screen.getByText('Cue'))
    expect(mockPlayer.seekTo).not.toHaveBeenCalled()
  })

  it('holding Cue past the threshold previews playback from the cue point', async () => {
    vi.useFakeTimers()
    await renderReadyDeck(baseState({ cue: 25 })) // 200 * 0.25 = 50s
    const cueButton = screen.getByText('Cue')

    fireEvent.pointerDown(cueButton)
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(50, true)
    expect(mockPlayer.pauseVideo).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(250)
    expect(mockPlayer.playVideo).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('releasing after a hold-preview jumps back to the cue point and pauses again', async () => {
    vi.useFakeTimers()
    await renderReadyDeck(baseState({ cue: 25 }))
    const cueButton = screen.getByText('Cue')

    fireEvent.pointerDown(cueButton)
    vi.advanceTimersByTime(250) // crosses the hold threshold, preview starts

    mockPlayer.seekTo.mockClear()
    mockPlayer.pauseVideo.mockClear()
    fireEvent.pointerUp(cueButton)

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(50, true)
    expect(mockPlayer.pauseVideo).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('a quick tap does not trigger the hold-preview', async () => {
    vi.useFakeTimers()
    await renderReadyDeck(baseState({ cue: 25 }))
    const cueButton = screen.getByText('Cue')

    fireEvent.pointerDown(cueButton)
    fireEvent.pointerUp(cueButton)
    mockPlayer.playVideo.mockClear()
    vi.advanceTimersByTime(250)

    expect(mockPlayer.playVideo).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('Marcar captures the current playhead position as the new cue percentage', async () => {
    mockPlayer.getCurrentTime.mockReturnValue(100) // half of the 200s track
    const { onStateChange } = await renderReadyDeck(baseState({ cue: 25 }))
    fireEvent.click(screen.getByText('Marcar'))

    expect(onStateChange).toHaveBeenCalled()
    const updater = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0] as (s: DeckState) => DeckState
    expect(updater(baseState({ cue: 25 })).cue).toBe(50)
  })

  it('seeking via the waveform moves the real player and updates currentTime immediately', async () => {
    const { onStateChange } = await renderReadyDeck(baseState())
    act(() => capturedWavePanelProps?.onSeek?.(0.25))

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(50, true) // 0.25 * 200s
    const updater = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0] as (s: DeckState) => DeckState
    expect(updater(baseState()).currentTime).toBe(50)
  })

  it('sets effective volume (crossfader volume x gain) once ready', async () => {
    await renderReadyDeck(baseState({ volume: 80, gain: 50 }))
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(40) // 80 * 50 / 100
  })

  it('re-applies the effective volume when the gain knob changes', async () => {
    const { rerender } = render(
      <Deck id="A" state={baseState({ volume: 80, gain: 50 })} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    act(() => capturedEvents.onReady?.({ target: mockPlayer }))
    mockPlayer.setVolume.mockClear()

    rerender(
      <Deck id="A" state={baseState({ volume: 80, gain: 100 })} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />,
    )
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(80) // 80 * 100 / 100
  })

  it('shows a clear error message and stops "playing" when the player reports an embedding restriction', async () => {
    await renderReadyDeck()
    act(() => capturedEvents.onError?.({ data: 101, target: mockPlayer }))
    expect(screen.getByText('El dueño del video bloqueó su reproducción fuera de YouTube')).toBeInTheDocument()
  })

  it('loads a new video via loadVideoById when the assigned track changes', async () => {
    const { rerender } = render(
      <Deck id="A" state={baseState()} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    act(() => capturedEvents.onReady?.({ target: mockPlayer }))

    const newTrack: Track = { ...track, id: 't2', youtubeId: 'abcdefghijk' }
    rerender(<Deck id="A" state={baseState({ track: newTrack })} onStateChange={vi.fn()} isActive onActivate={vi.fn()} />)

    expect(mockPlayer.loadVideoById).toHaveBeenCalledWith('abcdefghijk')
  })

  it('Gain knob updates deck state via keyboard interaction', async () => {
    const onStateChange = vi.fn()
    render(<Deck id="A" state={baseState({ gain: 50 })} onStateChange={onStateChange} isActive onActivate={vi.fn()} />)
    const gainSlider = screen.getByRole('slider', { name: 'Gain' })
    gainSlider.focus()
    fireEvent.keyDown(gainSlider, { key: 'ArrowUp' })
    expect(onStateChange).toHaveBeenCalled()
    const updater = onStateChange.mock.calls[0][0] as (s: DeckState) => DeckState
    expect(updater(baseState({ gain: 50 })).gain).toBe(51)
  })

  it('clicking the deck body activates it, without triggering playback controls', () => {
    const onActivate = vi.fn()
    render(<Deck id="B" state={baseState()} onStateChange={vi.fn()} isActive={false} onActivate={onActivate} />)
    fireEvent.click(screen.getByText('DECK B'))
    expect(onActivate).toHaveBeenCalled()
  })

  it('reports the real video duration once the player is ready, replacing the placeholder', async () => {
    mockPlayer.getDuration.mockReturnValue(243)
    const onDurationResolved = vi.fn()
    render(
      <Deck
        id="A"
        state={baseState({ track: { ...track, duration: 180 } })}
        onStateChange={vi.fn()}
        isActive
        onActivate={vi.fn()}
        onDurationResolved={onDurationResolved}
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    act(() => capturedEvents.onReady?.({ target: mockPlayer }))

    expect(onDurationResolved).toHaveBeenCalledWith('t1', 243)
  })

  it('does not report a duration that already matches the track', async () => {
    mockPlayer.getDuration.mockReturnValue(200) // same as track.duration in baseState()
    const onDurationResolved = vi.fn()
    render(
      <Deck id="A" state={baseState()} onStateChange={vi.fn()} isActive onActivate={vi.fn()} onDurationResolved={onDurationResolved} />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    act(() => capturedEvents.onReady?.({ target: mockPlayer }))
    expect(onDurationResolved).not.toHaveBeenCalled()
  })
})
