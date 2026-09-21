import React, { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WavePanelProps {
  seed: string
  progress: number // 0-1
  isPlaying: boolean
  accent?: 'lime' | 'aqua'
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

export const WavePanel: React.FC<WavePanelProps> = ({ seed, progress, isPlaying, accent = 'lime' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

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
      interact: false,
    })

    wavesurferRef.current = wavesurfer
    void wavesurfer.load('', [generatePeaks(seed)], 1)

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [seed, accent])

  useEffect(() => {
    wavesurferRef.current?.seekTo(Math.min(1, Math.max(0, progress)))
  }, [progress])

  return <div ref={containerRef} data-playing={isPlaying} aria-hidden="true" />
}
