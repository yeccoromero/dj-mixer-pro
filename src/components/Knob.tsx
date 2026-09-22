import React, { useCallback, useEffect, useRef, useState } from 'react'
import { gsap, Draggable } from '@/lib/gsapSetup'
import { cn } from '@/lib/utils'

interface KnobProps {
  label: string
  value: number // 0-100
  onChange: (value: number) => void
  size?: number
  accent?: 'lime' | 'aqua' | 'none'
  min?: number
  max?: number
  /** Longer explanation shown as a native tooltip on hover/focus. */
  description?: string
}

const MIN_ANGLE = -135
const MAX_ANGLE = 135

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  onChange,
  size = 56,
  accent = 'none',
  min = 0,
  max = 100,
  description,
}) => {
  const knobRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  // Kept fresh via a ref so the Draggable instance (created once) always calls the
  // latest onChange without needing to be torn down and recreated every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])

  const angleToValue = useCallback(
    (angle: number) => {
      const clamped = Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle))
      const ratio = (clamped - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE)
      return Math.round(min + ratio * (max - min))
    },
    [min, max],
  )

  const valueToAngle = useCallback(
    (v: number) => MIN_ANGLE + ((v - min) / (max - min)) * (MAX_ANGLE - MIN_ANGLE),
    [min, max],
  )

  // Create the Draggable once per knob: the whole dial is the draggable target, spun
  // by dragging anywhere on it (type: "rotation"), with InertiaPlugin so a quick flick
  // keeps spinning and glides to a natural stop instead of just tracking the pointer.
  useEffect(() => {
    const el = knobRef.current
    if (!el) return

    const reportFromRotation = function (this: Draggable) {
      onChangeRef.current(angleToValue(this.rotation))
    }

    const [draggable] = Draggable.create(el, {
      type: 'rotation',
      inertia: true,
      bounds: { minRotation: MIN_ANGLE, maxRotation: MAX_ANGLE },
      onPress: () => {
        isDraggingRef.current = true
        setIsDragging(true)
      },
      onDrag: reportFromRotation,
      onThrowUpdate: reportFromRotation,
      onRelease: () => {
        isDraggingRef.current = false
      },
      onThrowComplete: () => {
        isDraggingRef.current = false
        setIsDragging(false)
      },
    })
    draggableRef.current = draggable
    gsap.set(el, { rotation: valueToAngle(value) })

    return () => {
      draggable.kill()
      draggableRef.current = null
    }
    // The Draggable is recreated only if the value range changes; `value` itself is
    // synced separately below so dragging doesn't get reset mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angleToValue, valueToAngle])

  // Keep the dial's rotation in sync when `value` changes from outside (props or the
  // keyboard handler below) — but never fight the user while they're actively dragging.
  useEffect(() => {
    if (isDraggingRef.current || !knobRef.current) return
    const angle = valueToAngle(value)
    gsap.set(knobRef.current, { rotation: angle })
    draggableRef.current?.update()
  }, [value, valueToAngle])

  const accentColor =
    accent === 'lime' ? 'hsl(var(--lime-accent))' : accent === 'aqua' ? 'hsl(var(--aqua-accent))' : 'white'

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        ref={knobRef}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        title={description}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(clamp(value + 1))
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(clamp(value - 1))
        }}
        className={cn(
          'knob relative flex cursor-grab items-center justify-center border-2 border-black/10 touch-none active:cursor-grabbing',
          isDragging && 'ring-2 ring-lime-accent',
        )}
        style={{ width: size, height: size }}
      >
        <div
          className="absolute top-1.5 h-[35%] w-[2.5px] origin-bottom rounded-full"
          style={{ backgroundColor: accentColor, left: 'calc(50% - 1.25px)' }}
        />
        <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
      </div>
      <span className="music-number text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
