/** Clamp a value to the 0-100 range used throughout the mixer's controls. */
export function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Converts a crossfader position (0 = full deck A, 100 = full deck B) into
 * each deck's output volume.
 */
export function computeCrossfaderVolumes(crossFaderValue: number): { volumeA: number; volumeB: number } {
  const value = clamp100(crossFaderValue)
  return { volumeA: clamp100(100 - value), volumeB: clamp100(value) }
}

/**
 * Combines the crossfader-derived deck volume with the deck's own gain
 * knob into the single 0-100 value sent to the YouTube player.
 */
export function computeEffectiveVolume(volume: number, gain: number): number {
  return Math.round((clamp100(volume) / 100) * (clamp100(gain) / 100) * 100)
}
