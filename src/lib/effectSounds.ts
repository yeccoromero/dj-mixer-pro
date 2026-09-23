import * as Tone from 'tone'

export type EffectId = 'siren' | 'airhorn' | 'laser' | 'radio'

// Tone.js needs the audio context actually running before anything connected to it makes
// sound, same as the raw AudioContext.resume() the previous version called by hand — the
// only difference is Tone.start() also does its own internal setup. Must be triggered
// synchronously from the click handler that calls it, or the browser's autoplay policy
// blocks it; playOneShot below preserves that by starting the async chain directly inside
// the same call stack as the click.
let started = false
async function ensureAudioStarted() {
  if (started) return
  await Tone.start()
  started = true
}

/** Builds a one-shot chain of Tone.js nodes, plays it, and disposes every node once its
 * sound is over — these are short synthesized stingers triggered on demand, not instruments
 * that stick around, so nothing should linger in memory after it's done playing. */
function playOneShot(lifetimeSeconds: number, build: () => Tone.ToneAudioNode[]) {
  void ensureAudioStarted().then(() => {
    const nodes = build()
    window.setTimeout(() => nodes.forEach((node) => node.dispose()), lifetimeSeconds * 1000)
  })
}

export function playEffect(effect: EffectId) {
  switch (effect) {
    // A wailing alarm sweep — same up/down frequency ramp as before, now on a proper synth
    // voice (sustained envelope instead of a bare oscillator) with a touch of vibrato for
    // the "wobble" a real siren has instead of a perfectly clean tone sweep.
    case 'siren': {
      playOneShot(2.8, () => {
        const vibrato = new Tone.Vibrato({ frequency: 7, depth: 0.12 }).toDestination()
        const synth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.4 },
        }).connect(vibrato)
        synth.volume.value = -8
        const now = Tone.now()
        synth.triggerAttackRelease(500, 2.4, now)
        for (let i = 0; i < 3; i++) {
          synth.frequency.setValueAtTime(500, now + i * 0.8)
          synth.frequency.linearRampToValueAtTime(1100, now + i * 0.8 + 0.4)
          synth.frequency.linearRampToValueAtTime(500, now + i * 0.8 + 0.8)
        }
        return [synth, vibrato]
      })
      break
    }
    // The classic "BWAAAH" — two detuned notes on a sawtooth voice for the fat, slightly
    // dissonant beating a real airhorn has, through chorus (widens it) and light distortion
    // (grit), instead of two plain oscillators straight to the output.
    case 'airhorn': {
      playOneShot(1.8, () => {
        const distortion = new Tone.Distortion({ distortion: 0.35, wet: 0.4 }).toDestination()
        const chorus = new Tone.Chorus({ frequency: 1.5, depth: 0.5, wet: 0.35 }).connect(distortion)
        chorus.start()
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.02, decay: 0.15, sustain: 0.8, release: 0.4 },
        }).connect(chorus)
        synth.volume.value = -6
        synth.triggerAttackRelease(['A2', 'A3'], 1.1, Tone.now())
        return [synth, chorus, distortion]
      })
      break
    }
    // A sharp downward zap with a short ping-pong delay tail, instead of the previous dry
    // square-wave sweep — the delay is what actually sells "laser" over "beep."
    case 'laser': {
      playOneShot(0.8, () => {
        const delay = new Tone.PingPongDelay({ delayTime: 0.05, feedback: 0.25, wet: 0.25 }).toDestination()
        const synth = new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
        }).connect(delay)
        synth.volume.value = -10
        const now = Tone.now()
        synth.triggerAttackRelease(1800, 0.25, now)
        synth.frequency.exponentialRampToValueAtTime(80, now + 0.25)
        return [synth, delay]
      })
      break
    }
    // Filtered noise, same as before, now with a bitcrusher ahead of the bandpass filter
    // for the gritty, low-bitrate crackle of an actual radio signal instead of clean static.
    case 'radio': {
      playOneShot(0.7, () => {
        const filter = new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 1.5 }).toDestination()
        const crush = new Tone.BitCrusher(5).connect(filter)
        const noise = new Tone.Noise('white').connect(crush)
        noise.volume.value = -14
        const now = Tone.now()
        noise.start(now)
        noise.stop(now + 0.3)
        return [noise, crush, filter]
      })
      break
    }
  }
}
