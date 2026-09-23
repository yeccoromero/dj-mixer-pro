import * as Tone from 'tone'

export type EffectId = 'siren' | 'airhorn' | 'laser' | 'radio'

// Tone.js needs the audio context actually running before anything connected to it makes
// sound, same as the raw AudioContext.resume() the previous version called by hand — the
// only difference is Tone.start() also does its own internal setup. Must be triggered
// synchronously from the pointerdown handler that calls it, or the browser's autoplay policy
// blocks it; startEffect below preserves that by starting the async chain directly inside
// the same call stack as the press.
let started = false
async function ensureAudioStarted() {
  if (started) return
  await Tone.start()
  started = true
}

interface LiveEffect {
  /** Tears down this effect's node chain — called once, on release. */
  stop: () => void
}

// Real DJ FX pads sound for as long as they're held, not once per tap: a siren gets more
// frantic the longer you lean on it, a laser fires repeatedly, radio static keeps
// scanning — none of that comes across in a single fire-and-forget hit. One live instance
// per effect id, so pressing the same pad again while it's already sounding is a no-op
// (see `startEffect`) instead of stacking a second copy on top.
const live = new Map<EffectId, LiveEffect>()

export function startEffect(effect: EffectId) {
  if (live.has(effect)) return
  void ensureAudioStarted().then(() => {
    // The button may have already been released before the context finished starting —
    // don't begin a sound nobody is holding down anymore.
    if (live.has(effect)) return
    live.set(effect, buildEffect(effect))
  })
}

export function stopEffect(effect: EffectId) {
  const instance = live.get(effect)
  if (!instance) return
  live.delete(effect)
  instance.stop()
}

function buildEffect(effect: EffectId): LiveEffect {
  switch (effect) {
    case 'siren':
      return buildSiren()
    case 'airhorn':
      return buildAirhorn()
    case 'laser':
      return buildLaser()
    case 'radio':
      return buildRadio()
  }
}

// A wailing alarm that gets faster and higher-pitched the longer it's held — like leaning on
// a real DJ siren pad — instead of a fixed sweep that just plays the same shape once.
// Releasing resolves it with one last downward sweep instead of cutting off mid-wail.
function buildSiren(): LiveEffect {
  const vibrato = new Tone.Vibrato({ frequency: 7, depth: 0.12 }).toDestination()
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.1, sustain: 1, release: 0.5 },
  }).connect(vibrato)
  // Boosted from -8dB — combined with the track-ducking in Deck.tsx, this is what makes the
  // effect clearly cut through the mix instead of getting buried under wherever Gain sits.
  synth.volume.value = -3
  synth.triggerAttack(500, Tone.now())

  let cycle = 0
  let timer: ReturnType<typeof window.setTimeout>
  const sweep = () => {
    // Each cycle is shorter and reaches higher than the last (floors/caps keep it from
    // becoming an inaudible strobe or an ultrasonic screech if held for a long time).
    const period = Math.max(0.18, 0.8 - cycle * 0.08)
    const peak = Math.min(2000, 1100 + cycle * 120)
    const now = Tone.now()
    synth.frequency.linearRampToValueAtTime(peak, now + period / 2)
    synth.frequency.linearRampToValueAtTime(500, now + period)
    cycle += 1
    timer = window.setTimeout(sweep, period * 1000)
  }
  sweep()

  return {
    stop: () => {
      window.clearTimeout(timer)
      const now = Tone.now()
      synth.frequency.cancelScheduledValues(now)
      synth.frequency.setValueAtTime(synth.frequency.value, now)
      synth.frequency.linearRampToValueAtTime(200, now + 0.3)
      synth.triggerRelease(now + 0.3)
      window.setTimeout(() => {
        synth.dispose()
        vibrato.dispose()
      }, 900)
    },
  }
}

// The classic "BWAAAH" sustains for as long as the button is held, same as a real airhorn —
// two detuned notes on a sawtooth voice through chorus (widens it) and light distortion
// (grit), instead of two plain oscillators fixed to a single short duration.
function buildAirhorn(): LiveEffect {
  const distortion = new Tone.Distortion({ distortion: 0.35, wet: 0.4 }).toDestination()
  const chorus = new Tone.Chorus({ frequency: 1.5, depth: 0.5, wet: 0.35 }).connect(distortion)
  chorus.start()
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.15, sustain: 0.8, release: 0.4 },
  }).connect(chorus)
  synth.volume.value = -2
  synth.triggerAttack(['A2', 'A3'], Tone.now())

  return {
    stop: () => {
      synth.triggerRelease(['A2', 'A3'], Tone.now())
      window.setTimeout(() => {
        synth.dispose()
        chorus.dispose()
        distortion.dispose()
      }, 900)
    },
  }
}

// Rapid-fire zaps while held — a laser gun, not one "pew" — each with a short ping-pong
// delay tail and a bit of randomized pitch so a held burst doesn't sound like the exact same
// sample looping.
function buildLaser(): LiveEffect {
  const delay = new Tone.PingPongDelay({ delayTime: 0.05, feedback: 0.25, wet: 0.25 }).toDestination()
  const synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.05 },
  }).connect(delay)
  synth.volume.value = -5

  const fire = () => {
    const now = Tone.now()
    const peak = 1600 + Math.random() * 500
    synth.triggerAttackRelease(peak, 0.18, now)
    synth.frequency.exponentialRampToValueAtTime(70, now + 0.18)
  }
  fire()
  const interval = window.setInterval(fire, 140)

  return {
    stop: () => {
      window.clearInterval(interval)
      window.setTimeout(() => {
        synth.dispose()
        delay.dispose()
      }, 400)
    },
  }
}

// Filtered noise that keeps going while held, with the bandpass frequency wandering like
// someone scanning a dial — a bitcrusher ahead of the filter gives it the gritty, low-bitrate
// crackle of an actual radio signal instead of one clean static burst.
function buildRadio(): LiveEffect {
  const filter = new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 1.5 }).toDestination()
  const crush = new Tone.BitCrusher(5).connect(filter)
  const noise = new Tone.Noise('white').connect(crush)
  noise.volume.value = -8
  noise.start(Tone.now())

  const drift = window.setInterval(() => {
    filter.frequency.rampTo(500 + Math.random() * 3000, 0.4)
  }, 500)

  return {
    stop: () => {
      window.clearInterval(drift)
      const now = Tone.now()
      noise.volume.rampTo(-60, 0.15)
      noise.stop(now + 0.2)
      window.setTimeout(() => {
        noise.dispose()
        crush.dispose()
        filter.dispose()
      }, 400)
    },
  }
}
