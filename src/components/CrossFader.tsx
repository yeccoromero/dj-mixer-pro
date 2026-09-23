import React, { useEffect, useRef, useState } from 'react'
import { gsap, Draggable } from '@/lib/gsapSetup'
import { cn } from '@/lib/utils'

interface CrossFaderProps {
  value: number // 0 (full A) - 100 (full B)
  onChange: (value: number) => void
}

/** Piecewise-linear interpolation between named stops, e.g. [[0,1],[50,0.5],[100,0.15]]. */
function lerpStops(value: number, stops: [number, number][]) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i]
    const [x1, y1] = stops[i + 1]
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0)
      return Math.round((y0 + (y1 - y0) * t) * 1000) / 1000
    }
  }
  return stops[stops.length - 1][1]
}

export const CrossFader: React.FC<CrossFaderProps> = ({ value, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the Draggable once: the handle slides along the track (type: "x"), bounded
  // to stay inside it, with InertiaPlugin so a quick flick keeps gliding after release
  // instead of stopping dead where the pointer let go.
  useEffect(() => {
    const track = trackRef.current
    const handle = handleRef.current
    if (!track || !handle) return

    const maxX = () => Math.max(1, track.offsetWidth - handle.offsetWidth)

    const reportFromX = function (this: Draggable) {
      const ratio = Math.min(1, Math.max(0, this.x / maxX()))
      onChangeRef.current(Math.round(ratio * 100))
    }

    const [draggable] = Draggable.create(handle, {
      type: 'x',
      bounds: track,
      inertia: true,
      onPress: () => {
        isDraggingRef.current = true
        setIsDragging(true)
      },
      onDrag: reportFromX,
      onThrowUpdate: reportFromX,
      // isDraggingRef only clears once the inertia coast actually settles (onThrowComplete),
      // not on release — see the identical note in VerticalFader.tsx: clearing it on release
      // let the external-sync effect start its own gsap.to() on the same property while
      // GSAP's own throw tween was still running, and the two fought over the handle.
      onThrowComplete: () => {
        isDraggingRef.current = false
        setIsDragging(false)
      },
    })
    draggableRef.current = draggable
    gsap.set(handle, { x: (value / 100) * maxX() })

    return () => {
      draggable.kill()
      draggableRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the handle in sync when `value` changes from outside (the "Centrar" button),
  // animating smoothly — but never while the user is actively dragging it.
  useEffect(() => {
    if (isDraggingRef.current) return
    const track = trackRef.current
    const handle = handleRef.current
    const draggable = draggableRef.current
    if (!track || !handle || !draggable) return
    const maxX = Math.max(1, track.offsetWidth - handle.offsetWidth)
    gsap.to(handle, {
      x: (value / 100) * maxX,
      duration: 0.5,
      ease: 'power3.out',
      onUpdate: () => draggable.update(),
    })
  }, [value])

  // Clicking anywhere on the track (not grabbing the handle itself) jumps the fader
  // there directly — GSAP's Draggable only owns the handle, so this restores the
  // "click the track to set it" behavior the original implementation had.
  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === handleRef.current) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onChange(Math.round(ratio * 100))
  }

  const limeOpacity = lerpStops(value, [
    [0, 1],
    [50, 0.5],
    [100, 0.15],
  ])
  const aquaOpacity = lerpStops(value, [
    [0, 0.15],
    [50, 0.5],
    [100, 1],
  ])

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="chip-lime music-number" style={{ opacity: limeOpacity }}>
          DECK A
        </span>
        <button
          type="button"
          onClick={() => onChange(50)}
          className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          Centrar
        </button>
        <span className="chip-aqua music-number" style={{ opacity: aquaOpacity }}>
          DECK B
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className="relative h-8 w-full cursor-pointer touch-none rounded-full bg-gradient-to-r from-lime-accent/70 via-muted to-aqua-accent/70 px-1"
      >
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/10" />
        <div
          ref={handleRef}
          className={cn(
            'knob absolute left-0 h-7 w-4 cursor-grab rounded-md border border-black/20 active:cursor-grabbing',
            isDragging && 'ring-2 ring-lime-accent',
          )}
          style={{ top: 'calc(50% - 14px)' }}
        />
      </div>
    </div>
  )
}
