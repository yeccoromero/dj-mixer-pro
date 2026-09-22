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

  it('renders the buffered fill at the loadedFraction width', () => {
    const { container } = render(<WavePanel progress={0} loadedFraction={0.6} />)
    const fill = container.querySelector('[title="Video precargado"]') as HTMLElement
    expect(fill).toHaveStyle({ width: '60%' })
  })

  it('does not render a buffered fill when loadedFraction is omitted', () => {
    const { container } = render(<WavePanel progress={0} />)
    expect(container.querySelector('[title="Video precargado"]')).not.toBeInTheDocument()
  })

  it('renders the cue marker at the given position, as a small dot (no full-height line)', () => {
    const { container } = render(<WavePanel progress={0} cueProgress={0.3} />)
    const marker = container.querySelector('[title="Punto de cue marcado"]') as HTMLElement
    expect(marker).toHaveStyle({ left: '30%' })
    // A dot is a fixed small size, not a `h-full` line stretching across the bar.
    expect(marker.className).not.toContain('h-full')
  })

  it('the played portion is a growing fill (width), not a line at a point (left)', () => {
    const { container } = render(<WavePanel progress={0.4} />)
    const track = container.querySelector('.relative') as HTMLElement
    // First child of the track is the played fill (loadedFraction wasn't passed here).
    const fill = track.firstElementChild as HTMLElement
    expect(fill).toHaveStyle({ width: '40%' })
    expect(fill.className).not.toMatch(/\bw-0\.5\b/)
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
