import React, { useEffect, useRef, useState } from 'react'
import { gsap, Draggable } from '@/lib/gsapSetup'
import { cn } from '@/lib/utils'

interface VerticalFaderProps {
  label: string
  value: number // 0-100, 0 = bottom, 100 = top (like a real mixer channel fader)
  onChange: (value: number) => void
  accent?: 'lime' | 'aqua'
  height?: number
  /** Longer explanation shown as a native tooltip on hover/focus. */
  description?: string
  /** Stretch to fill the parent's height instead of using the fixed `height` prop — for
   * placing the fader beside something of variable height (e.g. the deck's video), where a
   * hardcoded pixel value would drift out of sync with the actual rendered size. */
  fill?: boolean
}

export const VerticalFader: React.FC<VerticalFaderProps> = ({
  label,
  value,
  onChange,
  accent = 'lime',
  height = 128,
  description,
  fill = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  // Kept fresh via a ref so the Draggable instance (created once) always calls the
  // latest onChange without needing to be torn down and recreated every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the Draggable once: the handle slides up/down (type: "y"), bounded to the
  // track, with InertiaPlugin so a quick flick keeps gliding after release instead of
  // stopping dead where the pointer let go. y=0 is the top in CSS, but value=100 (max)
  // should sit at the top — so the value/position mapping is inverted throughout.
  useEffect(() => {
    const track = trackRef.current
    const handle = handleRef.current
    if (!track || !handle) return

    const maxY = () => Math.max(1, track.offsetHeight - handle.offsetHeight)

    const reportFromY = function (this: Draggable) {
      const ratio = Math.min(1, Math.max(0, 1 - this.y / maxY()))
      onChangeRef.current(Math.round(ratio * 100))
    }

    const [draggable] = Draggable.create(handle, {
      type: 'y',
      bounds: track,
      inertia: true,
      onPress: () => {
        isDraggingRef.current = true
        setIsDragging(true)
      },
      onDrag: reportFromY,
      onThrowUpdate: reportFromY,
      // isDraggingRef only clears once the inertia coast actually settles (onThrowComplete),
      // not on release — with inertia:true, letting go while still moving keeps the throw
      // animating the handle for a bit longer. Clearing the flag on release (as this used to)
      // let the external-sync effect below start its own gsap.to() on the same `y` property
      // while GSAP's own throw tween was still running, and the two fought over the handle
      // until it visibly desynced from `value` — clicks would land on a handle that had
      // stopped actually representing the state, which read as the fader "getting stuck."
      onThrowComplete: () => {
        isDraggingRef.current = false
        setIsDragging(false)
      },
    })
    draggableRef.current = draggable
    gsap.set(handle, { y: (1 - value / 100) * maxY() })

    return () => {
      draggable.kill()
      draggableRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the handle in sync when `value` changes from outside — but never fight the
  // user while they're actively dragging it.
  useEffect(() => {
    if (isDraggingRef.current) return
    const track = trackRef.current
    const handle = handleRef.current
    const draggable = draggableRef.current
    if (!track || !handle || !draggable) return
    const maxY = Math.max(1, track.offsetHeight - handle.offsetHeight)
    gsap.to(handle, {
      y: (1 - value / 100) * maxY,
      duration: 0.3,
      ease: 'power3.out',
      onUpdate: () => draggable.update(),
    })
  }, [value])

  // Clicking anywhere on the track (not grabbing the handle itself) jumps the fader
  // there directly — GSAP's Draggable only owns the handle.
  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === handleRef.current) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height))
    onChange(Math.round(ratio * 100))
  }

  const accentColor = accent === 'lime' ? 'hsl(var(--lime-accent))' : 'hsl(var(--aqua-accent))'

  return (
    <div className={cn('flex flex-col items-center gap-1.5 select-none', fill && 'h-full')}>
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-orientation="vertical"
        title={description}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(Math.min(100, value + 1))
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(Math.max(0, value - 1))
        }}
        onPointerDown={handleTrackPointerDown}
        className={cn('knob relative w-3 cursor-pointer touch-none', fill && 'flex-1')}
        style={fill ? undefined : { height }}
      >
        <div
          className="pointer-events-none absolute bottom-0 left-0 w-full rounded-full"
          style={{ height: `${value}%`, backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <div
          ref={handleRef}
          className={cn(
            'absolute left-1/2 top-0 flex h-[22px] w-7 -translate-x-1/2 cursor-grab flex-col items-center justify-center gap-[3px] rounded-sm border border-black/40 bg-white shadow active:cursor-grabbing',
            isDragging && 'ring-2',
          )}
          style={isDragging ? ({ '--tw-ring-color': accentColor } as React.CSSProperties) : undefined}
        >
          <div className="h-px w-4 bg-black/30" />
          <div className="h-px w-4 bg-black/30" />
        </div>
      </div>
      <span className="music-number text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}
