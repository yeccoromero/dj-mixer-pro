import React, { useEffect, useRef, useState } from 'react'

const FILL_TRANSITION_MS = 260
const THUMB_TRANSITION = 'width 120ms ease, height 120ms ease, opacity 120ms ease'
// 40% thicker than the original 4/6px, per explicit request.
const THIN_HEIGHT = 5.6
const EXPANDED_HEIGHT = 8.4
const THUMB_SIZE = 12

interface WavePanelProps {
  progress: number // 0-1
  accent?: 'lime' | 'aqua'
  /** 0-1 position of the saved cue point, drawn as a small dot on the track. */
  cueProgress?: number
  /** 0-1 fraction of the video actually buffered so far (`player.getVideoLoadedFraction()`),
   * drawn as a gray fill ahead of playback — the same "preload" cue YouTube's own bar
   * shows. Omit to skip the fill entirely. */
  loadedFraction?: number
  /** False right after an explicit seek (Cue/Marcar), so the fill snaps to the new spot
   * instantly instead of gliding there like it does during normal playback. Defaults to
   * true. */
  smoothPlayhead?: boolean
  /** Called with a 0-1 ratio once the user releases a click/drag on the track — this is
   * the one moment the real player actually seeks (see the note on `handlePointerUp` for
   * why it isn't called on every pointer move too). */
  onSeek?: (progress: number) => void
}

/**
 * The deck's playback-position bar, styled after YouTube's own seek bar: thin at rest,
 * a colored fill (not a line) that grows as the video plays, a gray fill showing how much
 * has buffered, and a round handle that only appears — growing in — on hover or while
 * dragging. There's no real waveform data available for a YouTube embed, so this
 * deliberately doesn't try to fake one.
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

  // While the user is actively dragging, the fill follows the pointer 1:1 in real time
  // (like a normal video player's seek bar) instead of waiting on `progress` to catch up.
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const isExpanded = isHovered || dragPosition !== null

  const fillColor = accent === 'lime' ? '#d7ff43' : '#00eec4'
  const displayedProgress = clampPercent(dragPosition ?? progress)

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

  const fillTransition = smoothPlayhead && dragPosition === null ? `width ${FILL_TRANSITION_MS}ms linear` : 'none'

  return (
    <div
      className="flex cursor-pointer touch-none items-center py-2"
      onPointerDown={handleTrackPointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={trackRef}
        className="relative w-full rounded-full bg-black/10 transition-[height] duration-150"
        style={{ height: isExpanded ? EXPANDED_HEIGHT : THIN_HEIGHT }}
      >
        {typeof loadedFraction === 'number' && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-black/25"
            style={{ width: `${clampPercent(loadedFraction)}%` }}
            title="Video precargado"
            aria-hidden="true"
          />
        )}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${displayedProgress}%`,
            backgroundColor: fillColor,
            transition: fillTransition,
          }}
          aria-hidden="true"
        />
        {typeof cueProgress === 'number' && (
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black/30"
            style={{ left: `${clampPercent(cueProgress)}%` }}
            title="Punto de cue marcado"
            aria-hidden="true"
          />
        )}
        {/* The handle: invisible and tiny at rest, growing in on hover/drag — same reveal
            YouTube's own seek bar uses, instead of a marker that's always on screen. */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${displayedProgress}%`,
            backgroundColor: fillColor,
            width: isExpanded ? THUMB_SIZE : 0,
            height: isExpanded ? THUMB_SIZE : 0,
            opacity: isExpanded ? 1 : 0,
            transition: `left ${fillTransition === 'none' ? '0s' : `${FILL_TRANSITION_MS}ms linear`}, ${THUMB_TRANSITION}`,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

function clampPercent(ratio: number) {
  return Math.min(100, Math.max(0, ratio * 100))
}
