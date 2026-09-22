import { describe, expect, it } from 'vitest'
import { formatTime } from './format'

describe('formatTime', () => {
  it('pads single-digit seconds', () => {
    expect(formatTime(65)).toBe('1:05')
  })

  it('formats zero as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('clamps negative input to zero', () => {
    expect(formatTime(-10)).toBe('0:00')
  })

  it('formats durations over an hour in total minutes', () => {
    expect(formatTime(3661)).toBe('61:01')
  })
})
