import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WavePanel } from './WavePanel'

function mockTrackRect(width = 200, left = 0) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 24,
    left,
    right: left + width,
    top: 0,
    bottom: 24,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('WavePanel', () => {
  beforeEach(() => {
    mockTrackRect(200, 0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clicking the track calls onSeek once with the clicked ratio', () => {
    const onSeek = vi.fn()
    const { container } = render(<WavePanel progress={0} onSeek={onSeek} />)
    const track = container.firstElementChild as HTMLElement

    fireEvent.pointerDown(track, { clientX: 100 }) // 100 / 200 = 0.5
    fireEvent.pointerUp(window, { clientX: 100 })

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(0.5)
  })

  it('does not call the real seek during a drag — only once, on release', () => {
    // Regression test: an earlier version called onSeek (which triggers a real
    // player.seekTo() plus a full app state update) on every pointermove, spamming
    // dozens of calls per second while dragging and hanging the app. It should only
    // commit the real seek once, when the pointer is released.
    const onSeek = vi.fn()
    const { container } = render(<WavePanel progress={0} onSeek={onSeek} />)
    const track = container.firstElementChild as HTMLElement

    fireEvent.pointerDown(track, { clientX: 20 })
    fireEvent.pointerMove(window, { clientX: 40 })
    fireEvent.pointerMove(window, { clientX: 80 })
    fireEvent.pointerMove(window, { clientX: 150 })
    expect(onSeek).not.toHaveBeenCalled()

    fireEvent.pointerUp(window, { clientX: 150 })
    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(0.75) // 150 / 200
  })

  it('dots beyond the played portion but within loadedFraction render as buffered', () => {
    const { container } = render(<WavePanel progress={0} loadedFraction={0.6} />)
    const track = container.querySelector('.relative') as HTMLElement
    const dots = track.querySelectorAll('span')
    // DOT_COUNT is 32: dot 12 sits at ~38.7% (within the 60% buffered), dot 20 at ~64.5% (past it).
    expect(dots[12]).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.28)' })
    expect(dots[20]).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.12)' })
  })

  it('no dot renders as buffered when loadedFraction is omitted', () => {
    const { container } = render(<WavePanel progress={0} />)
    const track = container.querySelector('.relative') as HTMLElement
    const dots = track.querySelectorAll('span')
    expect(dots[20]).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.12)' })
  })

  it('renders the cue marker at the given position, as a small dot (no full-height line)', () => {
    const { container } = render(<WavePanel progress={0} cueProgress={0.3} />)
    const marker = container.querySelector('[title="Punto de cue marcado"]') as HTMLElement
    expect(marker).toHaveStyle({ left: '30%' })
    // A dot is a fixed small size, not a `h-full` line stretching across the bar.
    expect(marker.className).not.toContain('h-full')
  })

  it('dots up to the progress ratio light up in the accent color, the rest stay dim', () => {
    const { container } = render(<WavePanel progress={0.4} />)
    const track = container.querySelector('.relative') as HTMLElement
    const dots = track.querySelectorAll('span')
    // DOT_COUNT is 32: dot 12 sits at ~38.7% (played), dot 13 at ~41.9% (not played yet).
    expect(dots[12]).toHaveStyle({ backgroundColor: '#d7ff43' })
    expect(dots[13]).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.12)' })
  })

  it('the track grows taller on hover and shrinks back on mouse leave', () => {
    const { container } = render(<WavePanel progress={0} />)
    const wrapper = container.firstElementChild as HTMLElement
    const track = container.querySelector('.relative') as HTMLElement

    const restHeight = track.style.height
    fireEvent.mouseEnter(wrapper)
    const hoverHeight = track.style.height
    expect(hoverHeight).not.toBe(restHeight)

    fireEvent.mouseLeave(wrapper)
    expect(track.style.height).toBe(restHeight)
  })

  it('the handle is invisible at rest and appears while dragging', () => {
    const { container } = render(<WavePanel progress={0} />)
    const wrapper = container.firstElementChild as HTMLElement
    const handle = container.querySelectorAll('.border-white')[0] as HTMLElement

    expect(handle).toHaveStyle({ opacity: '0' })
    fireEvent.pointerDown(wrapper, { clientX: 20 })
    expect(handle).toHaveStyle({ opacity: '1' })
  })
})
