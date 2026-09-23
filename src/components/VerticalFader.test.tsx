import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VerticalFader } from './VerticalFader'

// The actual drag gesture is handled internally by GSAP's Draggable (its own pointer
// listeners, not React props), which isn't meaningfully simulatable through jsdom +
// fireEvent — that physics (bounded drag, inertia/coast-to-stop on release) is verified
// against the real running app with Playwright instead. These tests cover what's still
// controlled by React: rendering, keyboard interaction, and click-to-jump on the track.

function mockTrackRect(height = 128, top = 0) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 12,
    height,
    left: 0,
    right: 12,
    top,
    bottom: top + height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('VerticalFader', () => {
  it('renders a track and a draggable handle', () => {
    render(<VerticalFader label="Gain" value={50} onChange={vi.fn()} />)
    expect(screen.getByRole('slider', { name: 'Gain' })).toBeInTheDocument()
  })

  it('ArrowUp increases the value, ArrowDown decreases it', () => {
    const onChange = vi.fn()
    render(<VerticalFader label="Gain" value={50} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'Gain' })
    slider.focus()

    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(51)

    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(49)
  })

  it('clamps at 0 and 100', () => {
    const onChangeAtMax = vi.fn()
    render(<VerticalFader label="Gain" value={100} onChange={onChangeAtMax} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Gain' }), { key: 'ArrowUp' })
    expect(onChangeAtMax).toHaveBeenCalledWith(100)
  })

  it('clicking the track jumps to that position — top of the track is 100 (max)', () => {
    mockTrackRect(128, 0)
    const onChange = vi.fn()
    render(<VerticalFader label="Gain" value={50} onChange={onChange} height={128} />)
    const track = screen.getByRole('slider', { name: 'Gain' })

    fireEvent.pointerDown(track, { clientY: 0 }) // top of the track = max value
    expect(onChange).toHaveBeenCalledWith(100)

    vi.restoreAllMocks()
  })

  it('clicking the bottom of the track jumps to 0 (min)', () => {
    mockTrackRect(128, 0)
    const onChange = vi.fn()
    render(<VerticalFader label="Gain" value={50} onChange={onChange} height={128} />)
    const track = screen.getByRole('slider', { name: 'Gain' })

    fireEvent.pointerDown(track, { clientY: 128 })
    expect(onChange).toHaveBeenCalledWith(0)

    vi.restoreAllMocks()
  })

  it('cleans up the Draggable instance on unmount without throwing', () => {
    const { unmount } = render(<VerticalFader label="Gain" value={50} onChange={vi.fn()} />)
    expect(() => unmount()).not.toThrow()
  })
})
