import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EffectsPanel } from './EffectsPanel'

vi.mock('@/lib/effectSounds', () => ({
  playEffect: vi.fn(),
}))

import { playEffect } from '@/lib/effectSounds'

describe('EffectsPanel', () => {
  it.each([
    ['Siren', 'siren'],
    ['Airhorn', 'airhorn'],
    ['Laser', 'laser'],
    ['Radio', 'radio'],
  ] as const)('clicking %s plays the synthesized effect and notifies the parent', (label, id) => {
    const onEffectTrigger = vi.fn()
    render(<EffectsPanel onEffectTrigger={onEffectTrigger} />)

    fireEvent.click(screen.getByText(label))

    expect(playEffect).toHaveBeenCalledWith(id)
    expect(onEffectTrigger).toHaveBeenCalledWith(id)
  })
})
