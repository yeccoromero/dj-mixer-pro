import React, { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

const PLAYHEAD_TRANSITION_MS = 260

interface WavePanelProps {
  seed: string
  progress: number // 0-1
  isPlaying: boolean
  accent?: 'lime' | 'aqua'
  /** 0-1 position of the saved cue point, drawn as a marker over the waveform. */
  cueProgress?: number
  /** False right after an explicit seek (Cue/Marcar/waveform click), so the playhead
   * snaps to the new spot instantly instead of gliding there like it does during normal
   * playback. Defaults to true. */
  smoothPlayhead?: boolean
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
  smoothPlayhead = true,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const onSeekRef = useRef(onSeek)
  useEffect(() => {
    onSeekRef.current = onSeek
  }, [onSeek])

  // While the user is actively dragging across the waveform, the line follows the pointer
  // 1:1 in real time (like YouTube's own scrubber) instead of waiting for the real player
  // to actually seek and report back — that round trip alone would feel laggy to drag.
  const [dragPosition, setDragPosition] = useState<number | null>(null)

  const playheadColor = accent === 'lime' ? '#d7ff43' : '#00eec4'
  const displayedProgress = dragPosition ?? progress

  useEffect(() => {
    if (!containerRef.current) return

    // Waveform shape and click/drag-to-seek only — position is tracked by the playhead
    // line below instead, not by WaveSurfer's own progress fill (see the note on that
    // line for why: seekTo() hard-redraws the canvas, which is exactly the "jumps in
    // steps" motion this was meant to fix).
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 56,
      waveColor: 'rgba(0,0,0,0.18)',
      progressColor: 'rgba(0,0,0,0.18)',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      interact: true,
      // Click alone (`interact: true`) only jumps to where you tap — it does not let you
      // press and drag across the bar to scrub, which is what a real player's seek bar
      // does. This is what actually enables that.
      dragToSeek: true,
    })

    wavesurferRef.current = wavesurfer
    // Loaded against a fixed 1-second duration (fake peaks, no real audio decoding), so
    // the position these events report back is already a 0-1 ratio — that's what lets
    // clicking/dragging the waveform double as "scrub to find a moment".
    void wavesurfer.load('', [generatePeaks(seed)], 1)
    // `interaction` fires once per click or completed drag — this is what actually moves
    // the real player, same as before.
    wavesurfer.on('interaction', (newTime) => onSeekRef.current?.(newTime))
    // `drag`/`dragend` fire continuously while the pointer moves — used only to drive the
    // instant visual feedback above, not the real seek (that would be excessive).
    wavesurfer.on('drag', (relativeX) => setDragPosition(relativeX))
    wavesurfer.on('dragend', () => setDragPosition(null))

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [seed])

  return (
    <div className="relative">
      <div ref={containerRef} data-playing={isPlaying} aria-hidden="true" />
      {/* The actual playback position. A CSS `left` transition glides it smoothly between
          the ~4x/second position updates from the deck instead of jumping — the same
          reason it's a plain line rather than driving WaveSurfer's own progress redraw.
          `smoothPlayhead=false` (right after an explicit seek) skips the transition for
          one update so it snaps straight to the new spot instead of visibly sliding there. */}
      <div
        className="pointer-events-none absolute top-0 h-full w-0.5 -translate-x-1/2"
        style={{
          left: `${Math.min(100, Math.max(0, displayedProgress * 100))}%`,
          backgroundColor: playheadColor,
          transition: smoothPlayhead && dragPosition === null ? `left ${PLAYHEAD_TRANSITION_MS}ms linear` : 'none',
        }}
        aria-hidden="true"
      >
        {/* A small round handle at the top, like a normal video player's seek bar — makes
            it visually obvious the line is something you can grab and drag, not just a
            passive indicator. The whole waveform is draggable either way (dragToSeek). */}
        <div
          className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: playheadColor }}
        />
      </div>
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
