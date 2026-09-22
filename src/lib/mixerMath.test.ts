import { describe, expect, it } from 'vitest'
import { clamp100, computeCrossfaderVolumes, computeEffectiveVolume } from './mixerMath'

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

  it('splits volume evenly at the center', () => {
    expect(computeCrossfaderVolumes(50)).toEqual({ volumeA: 50, volumeB: 50 })
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
