import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DJMixer } from './DJMixer'
import type { DeckState, Track } from './DJMixer'

// Real Deck/CrossFader own a live YouTube player / a GSAP Draggable respectively — neither is
// meaningful to drive from a unit test of DJMixer's own orchestration logic (Auto DJ). Mocked
// the same way Deck.test.tsx mocks WavePanel: capture the props each instance receives so the
// test can call them directly, standing in for what the real child would normally trigger.
type CapturedDeckProps = { state: DeckState; onStateChange: (updater: (s: DeckState) => DeckState) => void }
let capturedDeckProps: Record<'A' | 'B', CapturedDeckProps | null> = { A: null, B: null }
const cueAndPlaySpies = { A: vi.fn(), B: vi.fn() }

vi.mock('./Deck', () => ({
  Deck: React.forwardRef((props: { id: 'A' | 'B'; state: DeckState; onStateChange: (u: (s: DeckState) => DeckState) => void }, ref) => {
    // Updated in an effect, not during render itself — oxlint's `react(globals)` rule (rightly)
    // objects to reassigning an outer variable as a render side effect. render()/act() from
    // testing-library flush effects synchronously, so this is captured before any assertion runs.
    React.useEffect(() => {
      capturedDeckProps = { ...capturedDeckProps, [props.id]: props }
    })
    React.useImperativeHandle(ref, () => ({
      cueAndPlay: () => cueAndPlaySpies[props.id](),
    }))
    return <div data-testid={`deck-${props.id}`} />
  }),
}))

let capturedCrossFaderProps: {
  value: number
  onChange: (v: number) => void
  instant?: boolean
  onDragStart?: () => void
  autoDj?: boolean
  onAutoDjChange?: (enabled: boolean) => void
  autoDjTransitioning?: boolean
} | null = null

vi.mock('./CrossFader', () => ({
  CrossFader: (props: NonNullable<typeof capturedCrossFaderProps>) => {
    capturedCrossFaderProps = props
    return (
      <div>
        <span data-testid="crossfader-value">{props.value}</span>
        <button onClick={() => props.onAutoDjChange?.(!props.autoDj)}>toggle-autodj</button>
        <button onClick={() => props.onDragStart?.()}>drag-start</button>
      </div>
    )
  },
}))

vi.mock('./CoverFlow', () => ({ CoverFlow: () => null }))
vi.mock('./EffectsPanel', () => ({ EffectsPanel: () => null }))

const trackA: Track = { id: 't1', title: 'A', artist: 'Artist A', youtubeId: 'aaaaaaaaaaa', duration: 200, thumbnail: 'a.jpg' }
const trackB: Track = { id: 't2', title: 'B', artist: 'Artist B', youtubeId: 'bbbbbbbbbbb', duration: 200, thumbnail: 'b.jpg' }

function setDeckState(id: 'A' | 'B', updates: Partial<DeckState>) {
  act(() => {
    capturedDeckProps[id]?.onStateChange((prev) => ({ ...prev, ...updates }))
  })
}

function enableAutoDj() {
  fireEvent.click(screen.getByText('toggle-autodj'))
}

describe('DJMixer — Auto DJ', () => {
  beforeEach(() => {
    localStorage.clear()
    // Seeds the library with two known tracks instead of relying on the 3 built-in samples,
    // so each test's math (durations, trigger timing) is exact and self-documenting.
    localStorage.setItem('dj-mixer-tracks', JSON.stringify([trackA, trackB]))
    cueAndPlaySpies.A.mockClear()
    cueAndPlaySpies.B.mockClear()
    capturedDeckProps = { A: null, B: null }
    capturedCrossFaderProps = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing while Auto DJ is off, even with 5s or less left on the playing deck', () => {
    render(<DJMixer />)
    setDeckState('A', { isPlaying: true, currentTime: 196 }) // 4s left of 200s
    act(() => vi.advanceTimersByTime(500))

    expect(cueAndPlaySpies.B).not.toHaveBeenCalled()
    expect(capturedCrossFaderProps?.value).toBe(50)
  })

  it('starts the other deck and begins crossfading once the playing deck has 5s or less left', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('A', { isPlaying: true, currentTime: 196 }) // exactly 4s left

    act(() => vi.advanceTimersByTime(0)) // let the effect from the state update run
    expect(cueAndPlaySpies.B).toHaveBeenCalledTimes(1)
    expect(capturedCrossFaderProps?.autoDjTransitioning).toBe(true)
  })

  it('does not re-cue the incoming deck if it is already playing on its own', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('B', { isPlaying: true, currentTime: 10 })
    setDeckState('A', { isPlaying: true, currentTime: 196 })

    expect(cueAndPlaySpies.B).not.toHaveBeenCalled()
  })

  it('does not trigger a transition when the other deck has no track loaded', () => {
    render(<DJMixer />)
    enableAutoDj()
    // Clear deck B's track by driving it through onStateChange directly.
    setDeckState('B', { track: null })
    setDeckState('A', { isPlaying: true, currentTime: 196 })

    expect(cueAndPlaySpies.B).not.toHaveBeenCalled()
    expect(capturedCrossFaderProps?.autoDjTransitioning).toBeFalsy()
  })

  it('the crossfade reaches full B and stops on its own once the transition window elapses', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('A', { isPlaying: true, currentTime: 196 }) // 4s left, starts at value=50

    act(() => vi.advanceTimersByTime(2000)) // AUTO_DJ_TRANSITION_SECONDS

    expect(capturedCrossFaderProps?.value).toBe(100)
    expect(capturedCrossFaderProps?.autoDjTransitioning).toBe(false)
  })

  it('grabbing the fader mid-transition cedes control back — the value stops advancing on its own', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('A', { isPlaying: true, currentTime: 196 })

    act(() => vi.advanceTimersByTime(1000)) // partway through the 2s transition
    const valueMidway = capturedCrossFaderProps?.value
    expect(valueMidway).toBeGreaterThan(50)
    expect(valueMidway).toBeLessThan(100)

    fireEvent.click(screen.getByText('drag-start'))
    act(() => vi.advanceTimersByTime(2000)) // the rest of what would've been the transition

    expect(capturedCrossFaderProps?.value).toBe(valueMidway)
    expect(capturedCrossFaderProps?.autoDjTransitioning).toBe(false)
  })

  it('turning Auto DJ off mid-transition also stops it in place', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('A', { isPlaying: true, currentTime: 196 })

    act(() => vi.advanceTimersByTime(1000))
    const valueMidway = capturedCrossFaderProps?.value

    fireEvent.click(screen.getByText('toggle-autodj')) // turn Auto DJ off
    act(() => vi.advanceTimersByTime(2000))

    expect(capturedCrossFaderProps?.value).toBe(valueMidway)
  })

  it('a track playing with plenty of time left does not trigger anything', () => {
    render(<DJMixer />)
    enableAutoDj()
    setDeckState('A', { isPlaying: true, currentTime: 50 }) // 150s left of 200s

    act(() => vi.advanceTimersByTime(1000))
    expect(cueAndPlaySpies.B).not.toHaveBeenCalled()
    expect(capturedCrossFaderProps?.autoDjTransitioning).toBeFalsy()
  })
})
