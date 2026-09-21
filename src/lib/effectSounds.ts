export type EffectId = 'siren' | 'airhorn' | 'laser' | 'radio'

let ctx: AudioContext | null = null

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

function playTone(
  audioCtx: AudioContext,
  {
    type,
    startFreq,
    endFreq,
    duration,
    startTime,
    gain = 0.2,
  }: {
    type: OscillatorType
    startFreq: number
    endFreq: number
    duration: number
    startTime: number
    gain?: number
  },
) {
  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(startFreq, startTime)
  osc.frequency.linearRampToValueAtTime(endFreq, startTime + duration)
  gainNode.gain.setValueAtTime(gain, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function playEffect(effect: EffectId) {
  const audioCtx = getContext()
  const now = audioCtx.currentTime

  switch (effect) {
    case 'siren': {
      for (let i = 0; i < 3; i++) {
        playTone(audioCtx, { type: 'sine', startFreq: 500, endFreq: 1100, duration: 0.4, startTime: now + i * 0.4 })
        playTone(audioCtx, { type: 'sine', startFreq: 1100, endFreq: 500, duration: 0.4, startTime: now + i * 0.4 + 0.4 })
      }
      break
    }
    case 'airhorn': {
      playTone(audioCtx, { type: 'sawtooth', startFreq: 220, endFreq: 210, duration: 0.9, startTime: now, gain: 0.28 })
      playTone(audioCtx, { type: 'sawtooth', startFreq: 330, endFreq: 315, duration: 0.9, startTime: now, gain: 0.14 })
      break
    }
    case 'laser': {
      playTone(audioCtx, { type: 'square', startFreq: 1800, endFreq: 80, duration: 0.25, startTime: now, gain: 0.18 })
      break
    }
    case 'radio': {
      const bufferSize = audioCtx.sampleRate * 0.3
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25
      }
      const noise = audioCtx.createBufferSource()
      noise.buffer = buffer
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1200
      const gainNode = audioCtx.createGain()
      gainNode.gain.setValueAtTime(0.3, now)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      noise.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      noise.start(now)
      noise.stop(now + 0.3)
      break
    }
  }
}
