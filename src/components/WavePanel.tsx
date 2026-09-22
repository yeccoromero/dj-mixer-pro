import React, { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WavePanelProps {
  seed: string
  progress: number // 0-1
  isPlaying: boolean
  accent?: 'lime' | 'aqua'
  /** 0-1 position of the saved cue point, drawn as a marker over the waveform. */
  cueProgress?: number
  /** Called with a 0-1 ratio when the user clicks or drags on the waveform to seek. */
  onSeek?: (progress: number) => void
}

// Deterministic pseudo-random peaks so the same track always renders the same waveform shape.
function generatePeaks(seed: string, length = 200): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const peaks: number[] = []
  let state = hash || 1
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) >>> 0
    const base = ((state >>> 16) % 1000) / 1000
    const envelope = 0.35 + 0.65 * Math.sin((i / length) * Math.PI)
    peaks.push(Math.max(0.05, base * envelope))
  }
  return peaks
}

export const WavePanel: React.FC<WavePanelProps> = ({
  seed,
  progress,
  isPlaying,
  accent = 'lime',
  cueProgress,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const onSeekRef = useRef(onSeek)
  useEffect(() => {
    onSeekRef.current = onSeek
  }, [onSeek])

  useEffect(() => {
    if (!containerRef.current) return

    const progressColor = accent === 'lime' ? '#d7ff43' : '#00eec4'

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 56,
      waveColor: 'rgba(0,0,0,0.18)',
      progressColor,
      cursorWidth: 0,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      interact: true,
    })

    wavesurferRef.current = wavesurfer
    // Loaded against a fixed 1-second duration (fake peaks, no real audio decoding), so
    // both `seekTo` and the position `interaction` reports back are already 0-1 ratios —
    // that's what lets clicking/dragging the waveform double as "scrub to find a moment".
    void wavesurfer.load('', [generatePeaks(seed)], 1)
    wavesurfer.on('interaction', (newTime) => onSeekRef.current?.(newTime))

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [seed, accent])

  useEffect(() => {
    wavesurferRef.current?.seekTo(Math.min(1, Math.max(0, progress)))
  }, [progress])

  return (
    <div className="relative">
      <div ref={containerRef} data-playing={isPlaying} aria-hidden="true" />
      {typeof cueProgress === 'number' && (
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/90"
          style={{ left: `${Math.min(100, Math.max(0, cueProgress * 100))}%` }}
          title="Punto de cue marcado"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
