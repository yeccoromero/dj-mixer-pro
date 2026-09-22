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

  it('renders the cue marker at the given position', () => {
    const { container } = render(<WavePanel progress={0} cueProgress={0.3} />)
    const marker = container.querySelector('[title="Punto de cue marcado"]') as HTMLElement
    expect(marker).toHaveStyle({ left: '30%' })
  })
})
