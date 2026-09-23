import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EffectsPanel } from './EffectsPanel'

vi.mock('@/lib/effectSounds', () => ({
  startEffect: vi.fn(),
  stopEffect: vi.fn(),
}))

import { startEffect, stopEffect } from '@/lib/effectSounds'

describe('EffectsPanel', () => {
  it.each([
    ['Siren', 'siren'],
    ['Airhorn', 'airhorn'],
    ['Laser', 'laser'],
    ['Radio', 'radio'],
  ] as const)('pressing %s starts the effect and notifies the parent', (label, id) => {
    const onEffectTrigger = vi.fn()
    render(<EffectsPanel onEffectTrigger={onEffectTrigger} />)

    fireEvent.pointerDown(screen.getByTitle(`Mantener presionado para ${label}`))

    expect(startEffect).toHaveBeenCalledWith(id)
    expect(onEffectTrigger).toHaveBeenCalledWith(id)
    expect(stopEffect).not.toHaveBeenCalled()
  })

  it('releasing anywhere on the page stops the held effect — like the Cue button, the pointer may have drifted off first', () => {
    render(<EffectsPanel onEffectTrigger={vi.fn()} />)

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Laser'))
    expect(stopEffect).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)
    expect(stopEffect).toHaveBeenCalledWith('laser')
  })

  it('pressing a second pad while the first is still held stops the first one instead of layering both', () => {
    render(<EffectsPanel onEffectTrigger={vi.fn()} />)

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Siren'))
    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Radio'))

    expect(stopEffect).toHaveBeenCalledWith('siren')
    expect(startEffect).toHaveBeenCalledWith('radio')

    // Releasing now only stops the pad that's actually still down (radio), not siren again.
    vi.mocked(stopEffect).mockClear()
    fireEvent.pointerUp(window)
    expect(stopEffect).toHaveBeenCalledExactlyOnceWith('radio')
  })

  it('a pointercancel (e.g. the OS interrupting the gesture) also stops the held effect', () => {
    render(<EffectsPanel onEffectTrigger={vi.fn()} />)

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Airhorn'))
    fireEvent.pointerCancel(window)

    expect(stopEffect).toHaveBeenCalledWith('airhorn')
  })

  it('reports ducking true on press and false on release, so the decks can duck under the FX pad', () => {
    const onDuckingChange = vi.fn()
    render(<EffectsPanel onEffectTrigger={vi.fn()} onDuckingChange={onDuckingChange} />)

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Siren'))
    expect(onDuckingChange).toHaveBeenCalledExactlyOnceWith(true)

    fireEvent.pointerUp(window)
    expect(onDuckingChange).toHaveBeenLastCalledWith(false)
  })

  it('switching to a different pad while one is already held does not re-report ducking (it never stopped)', () => {
    const onDuckingChange = vi.fn()
    render(<EffectsPanel onEffectTrigger={vi.fn()} onDuckingChange={onDuckingChange} />)

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Siren'))
    onDuckingChange.mockClear()

    fireEvent.pointerDown(screen.getByTitle('Mantener presionado para Radio'))
    expect(onDuckingChange).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)
    expect(onDuckingChange).toHaveBeenCalledExactlyOnceWith(false)
  })
})
