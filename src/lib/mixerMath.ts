/** Clamp a value to the 0-100 range used throughout the mixer's controls. */
export function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Converts a crossfader position (0 = full deck A, 100 = full deck B) into each deck's
 * output volume, using an equal-power (constant-power) curve: volumeA/volumeB follow a
 * quarter cosine/sine sweep instead of a straight line. A linear crossfade makes the
 * mix noticeably quieter around the center (both decks near 50%, well below the ~70%
 * each side hits alone), which is why real DJ mixers use this curve instead.
 */
export function computeCrossfaderVolumes(crossFaderValue: number): { volumeA: number; volumeB: number } {
  const value = clamp100(crossFaderValue)
  const angle = (value / 100) * (Math.PI / 2)
  return {
    volumeA: clamp100(Math.round(Math.cos(angle) * 100)),
    volumeB: clamp100(Math.round(Math.sin(angle) * 100)),
  }
}

/**
 * Combines the crossfader-derived deck volume with the deck's own gain
 * knob into the single 0-100 value sent to the YouTube player.
 */
export function computeEffectiveVolume(volume: number, gain: number): number {
  return Math.round((clamp100(volume) / 100) * (clamp100(gain) / 100) * 100)
}

/**
 * Converts an absolute playhead position (seconds) into the 0-100% format `DeckState.cue`
 * stores, so "Marcar" can capture wherever the track actually is right now instead of the
 * user having to dial in a blind percentage.
 */
export function computeCuePercent(currentTime: number, duration: number): number {
  if (duration <= 0) return 0
  return clamp100(Math.round((currentTime / duration) * 100))
}
