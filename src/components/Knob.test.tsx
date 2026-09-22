import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Knob } from './Knob'

// The dial itself is now driven by GSAP's Draggable (type: "rotation") with
// InertiaPlugin for the actual drag/flick-and-glide gesture — that isn't meaningfully
// simulatable through jsdom + fireEvent, so it's verified against the real running app
// with Playwright instead. These tests cover the parts still owned by React: rendered
// a11y attributes, the keyboard interaction path, clamping, and mount/unmount safety.

describe('Knob', () => {
  it('renders its label and current value for assistive tech', () => {
    render(<Knob label="Gain" value={50} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider', { name: 'Gain' })
    expect(slider).toHaveAttribute('aria-valuenow', '50')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
  })

  it('increases the value on ArrowUp / ArrowRight', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={50} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'Gain' })
    slider.focus()

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(51)

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(51)
  })

  it('decreases the value on ArrowDown / ArrowLeft', () => {
    const onChange = vi.fn()
    render(<Knob label="Filter" value={50} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: 'Filter' })
    slider.focus()

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(49)
  })

  it('clamps at the maximum and never calls onChange past it', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={100} onChange={onChange} max={100} />)
    const slider = screen.getByRole('slider', { name: 'Gain' })
    slider.focus()
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('clamps at the minimum', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={0} onChange={onChange} min={0} />)
    const slider = screen.getByRole('slider', { name: 'Gain' })
    slider.focus()
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('creates and cleans up its Draggable instance without throwing', () => {
    const { unmount } = render(<Knob label="Gain" value={50} onChange={vi.fn()} />)
    expect(() => unmount()).not.toThrow()
  })
})
