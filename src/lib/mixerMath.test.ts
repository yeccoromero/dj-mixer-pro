import { describe, expect, it } from 'vitest'
import { clamp100, computeCrossfaderVolumes, computeCuePercent, computeEffectiveVolume } from './mixerMath'

describe('clamp100', () => {
  it('leaves in-range values untouched', () => {
    expect(clamp100(42)).toBe(42)
  })

  it('clamps values below 0', () => {
    expect(clamp100(-10)).toBe(0)
  })

  it('clamps values above 100', () => {
    expect(clamp100(150)).toBe(100)
  })
})

describe('computeCrossfaderVolumes', () => {
  it('gives deck A full volume and deck B silence at position 0', () => {
    expect(computeCrossfaderVolumes(0)).toEqual({ volumeA: 100, volumeB: 0 })
  })

  it('gives deck B full volume and deck A silence at position 100', () => {
    expect(computeCrossfaderVolumes(100)).toEqual({ volumeA: 0, volumeB: 100 })
  })

  it('uses an equal-power curve, so both decks sit above the midpoint at the center', () => {
    // A linear crossfade would give 50/50 here, which is audibly quieter than either
    // deck alone; equal-power keeps perceived loudness constant across the sweep.
    expect(computeCrossfaderVolumes(50)).toEqual({ volumeA: 71, volumeB: 71 })
  })

  it('clamps out-of-range input', () => {
    expect(computeCrossfaderVolumes(-20)).toEqual({ volumeA: 100, volumeB: 0 })
    expect(computeCrossfaderVolumes(120)).toEqual({ volumeA: 0, volumeB: 100 })
  })
})

describe('computeEffectiveVolume', () => {
  it('is silent when the gain knob is at 0', () => {
    expect(computeEffectiveVolume(100, 0)).toBe(0)
  })

  it('is silent when the crossfader volume is 0', () => {
    expect(computeEffectiveVolume(0, 100)).toBe(0)
  })

  it('is full volume when both inputs are maxed', () => {
    expect(computeEffectiveVolume(100, 100)).toBe(100)
  })

  it('multiplies the two inputs proportionally', () => {
    expect(computeEffectiveVolume(50, 50)).toBe(25)
  })
})

describe('computeCuePercent', () => {
  it('converts a playhead position into a percentage of the total duration', () => {
    expect(computeCuePercent(60, 240)).toBe(25)
  })

  it('is 0 at the very start', () => {
    expect(computeCuePercent(0, 240)).toBe(0)
  })

  it('is 100 at the very end', () => {
    expect(computeCuePercent(240, 240)).toBe(100)
  })

  it('returns 0 when duration is unknown (0 or negative)', () => {
    expect(computeCuePercent(30, 0)).toBe(0)
    expect(computeCuePercent(30, -10)).toBe(0)
  })

  it('clamps a time past the end of the track', () => {
    expect(computeCuePercent(300, 240)).toBe(100)
  })
})
