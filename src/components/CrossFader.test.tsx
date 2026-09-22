import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CrossFader } from './CrossFader'

// The actual drag gesture is now handled internally by GSAP's Draggable (its own
// pointer listeners, not React props), which isn't meaningfully simulatable through
// jsdom + fireEvent. That physics — bounded drag, inertia/coast-to-stop on release —
// is verified against the real running app with Playwright instead. These tests cover
// what's still controlled by React: the initial/controlled position, the derived
// DECK A / DECK B opacity, and the "Centrar" button.

describe('CrossFader', () => {
  it('renders a track and a draggable handle', () => {
    render(<CrossFader value={50} onChange={vi.fn()} />)
    expect(document.querySelector('.knob')).toBeInTheDocument()
  })

  it('"Centrar" reports the middle value', () => {
    const onChange = vi.fn()
    render(<CrossFader value={20} onChange={onChange} />)
    fireEvent.click(screen.getByText('Centrar'))
    expect(onChange).toHaveBeenCalledWith(50)
  })

  it('DECK A is fully opaque and DECK B nearly transparent at value 0', () => {
    render(<CrossFader value={0} onChange={vi.fn()} />)
    expect(screen.getByText('DECK A')).toHaveStyle({ opacity: '1' })
    expect(screen.getByText('DECK B')).toHaveStyle({ opacity: '0.15' })
  })

  it('DECK B is fully opaque and DECK A nearly transparent at value 100', () => {
    render(<CrossFader value={100} onChange={vi.fn()} />)
    expect(screen.getByText('DECK B')).toHaveStyle({ opacity: '1' })
    expect(screen.getByText('DECK A')).toHaveStyle({ opacity: '0.15' })
  })

  it('both decks are at half opacity when centered', () => {
    render(<CrossFader value={50} onChange={vi.fn()} />)
    expect(screen.getByText('DECK A')).toHaveStyle({ opacity: '0.5' })
    expect(screen.getByText('DECK B')).toHaveStyle({ opacity: '0.5' })
  })

  it('cleans up the Draggable instance on unmount without throwing', () => {
    const { unmount } = render(<CrossFader value={50} onChange={vi.fn()} />)
    expect(() => unmount()).not.toThrow()
  })
})
