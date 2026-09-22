import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CrossFader } from './CrossFader'

// jsdom reports 0 for all layout metrics; give the track a real, stable box
// so drag-position math (clientX -> percentage) is testable.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, right: 200, width: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect
})

describe('CrossFader', () => {
  it('reports 0 (full deck A) when dragged to the left edge', () => {
    const onChange = vi.fn()
    render(<CrossFader value={50} onChange={onChange} />)
    const trackEl = document.querySelector('.cursor-pointer') as HTMLElement
    fireEvent.pointerDown(trackEl, { clientX: 0, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('reports 100 (full deck B) when dragged to the right edge', () => {
    const onChange = vi.fn()
    render(<CrossFader value={50} onChange={onChange} />)
    const trackEl = document.querySelector('.cursor-pointer') as HTMLElement
    fireEvent.pointerDown(trackEl, { clientX: 200, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('tracks pointer movement while the button is held', () => {
    const onChange = vi.fn()
    render(<CrossFader value={50} onChange={onChange} />)
    const trackEl = document.querySelector('.cursor-pointer') as HTMLElement
    fireEvent.pointerDown(trackEl, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(trackEl, { clientX: 150, pointerId: 1, buttons: 1 })
    expect(onChange).toHaveBeenLastCalledWith(75)
  })

  it('ignores pointer movement once the button is released (no buttons pressed)', () => {
    const onChange = vi.fn()
    render(<CrossFader value={50} onChange={onChange} />)
    const trackEl = document.querySelector('.cursor-pointer') as HTMLElement
    fireEvent.pointerDown(trackEl, { clientX: 100, pointerId: 1 })
    onChange.mockClear()
    fireEvent.pointerMove(trackEl, { clientX: 180, pointerId: 1, buttons: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('"Centrar" animates the crossfader back toward the middle', async () => {
    const onChange = vi.fn()
    render(<CrossFader value={0} onChange={onChange} />)
    fireEvent.click(screen.getByText('Centrar'))
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls.at(-1)?.[0]).toBe(50)
    })
  })
})
