import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const PLAYHEAD_TRANSITION_MS = 260

interface WavePanelProps {
  progress: number // 0-1
  accent?: 'lime' | 'aqua'
  /** 0-1 position of the saved cue point, drawn as a marker on the track. */
  cueProgress?: number
  /** 0-1 fraction of the video actually buffered so far (`player.getVideoLoadedFraction()`),
   * drawn as a light fill ahead of playback — the same "preload" cue YouTube's own bar
   * shows. Omit to skip the fill entirely. */
  loadedFraction?: number
  /** False right after an explicit seek (Cue/Marcar), so the line snaps to the new spot
   * instantly instead of gliding there like it does during normal playback. Defaults to
   * true. */
  smoothPlayhead?: boolean
  /** Called with a 0-1 ratio once the user releases a click/drag on the track — this is
   * the one moment the real player actually seeks (see the note on `handlePointerUp` for
   * why it isn't called on every pointer move too). */
  onSeek?: (progress: number) => void
}

/**
 * The deck's playback-position track: just a plain bar with a colored line marking where
 * the video is, draggable like a normal video player's seek bar. There's no real waveform
 * data available for a YouTube embed, so this deliberately doesn't try to fake one — it's a
 * clean, minimal position indicator instead.
 */
export const WavePanel: React.FC<WavePanelProps> = ({
  progress,
  accent = 'lime',
  cueProgress,
  loadedFraction,
  smoothPlayhead = true,
  onSeek,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const onSeekRef = useRef(onSeek)
  useEffect(() => {
    onSeekRef.current = onSeek
  }, [onSeek])

  // While the user is actively dragging, the line follows the pointer 1:1 in real time
  // (like a normal video player's seek bar) instead of waiting on `progress` to catch up.
  const [dragPosition, setDragPosition] = useState<number | null>(null)

  const lineColor = accent === 'lime' ? '#d7ff43' : '#00eec4'
  const displayedProgress = dragPosition ?? progress

  const ratioFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  // Dragging only ever moves this local `dragPosition` — cheap, local re-renders. The real
  // player only actually seeks once, in `handlePointerUp`. Calling the real seek on every
  // pointermove (as an earlier version did) meant dozens of `player.seekTo()` postMessage
  // calls plus a full app state update per second while dragging, which is exactly what
  // made the app hang after a drag — and it's not how a normal video player's seek bar
  // behaves either: it always previews locally while dragging and commits once on release.
  const handlePointerMove = (event: PointerEvent) => {
    setDragPosition(ratioFromClientX(event.clientX))
  }

  const handlePointerUp = (event: PointerEvent) => {
    const ratio = ratioFromClientX(event.clientX)
    setDragPosition(null)
    onSeekRef.current?.(ratio)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  }

  const handleTrackPointerDown = (event: React.PointerEvent) => {
    setDragPosition(ratioFromClientX(event.clientX))
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className="relative h-6 cursor-pointer touch-none rounded-full bg-black/10"
    >
      {typeof loadedFraction === 'number' && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-black/15"
          style={{ width: `${Math.min(100, Math.max(0, loadedFraction * 100))}%` }}
          title="Video precargado"
          aria-hidden="true"
        />
      )}
      <div
        className={cn('pointer-events-none absolute top-0 h-full w-0.5 -translate-x-1/2')}
        style={{
          left: `${Math.min(100, Math.max(0, displayedProgress * 100))}%`,
          backgroundColor: lineColor,
          transition: smoothPlayhead && dragPosition === null ? `left ${PLAYHEAD_TRANSITION_MS}ms linear` : 'none',
        }}
        aria-hidden="true"
      >
        {/* A small round handle, like a normal video player's seek bar — makes it visually
            obvious the line is something you can grab and drag, not just a marker. The
            whole track is draggable either way, not just the handle itself. */}
        <div
          className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: lineColor }}
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
