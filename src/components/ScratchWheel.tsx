import React, { useEffect, useRef, useState } from 'react'
import { Draggable } from '@/lib/gsapSetup'
import { cn } from '@/lib/utils'

interface ScratchWheelProps {
  accent: 'lime' | 'aqua'
  disabled?: boolean
  size?: number
  onScratchStart: () => void
  /** Degrees rotated since the last call (positive = clockwise/forward). This component has
   * no notion of playback time — converting that into a seek offset is the caller's job
   * (see Deck.tsx's SECONDS_PER_REVOLUTION). */
  onScratchMove: (deltaDegrees: number) => void
  onScratchEnd: () => void
}

/**
 * A free-spinning jog wheel, not a bounded knob like the old Gain/Filter dials (see git
 * history for `Knob.tsx`) — no min/max rotation, and deliberately no inertia: a scratch only
 * ever moves while an actual finger/mouse is dragging it, so there's nothing meaningful to
 * "throw" once released (unlike a volume control, where flicking to a value makes sense).
 */
export const ScratchWheel: React.FC<ScratchWheelProps> = ({
  accent,
  disabled = false,
  size = 44,
  onScratchStart,
  onScratchMove,
  onScratchEnd,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null)
  const lastRotationRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // Kept fresh via refs so the Draggable instance (created once per mount) always calls the
  // latest callbacks without needing to be torn down and recreated every render.
  const onScratchStartRef = useRef(onScratchStart)
  const onScratchMoveRef = useRef(onScratchMove)
  const onScratchEndRef = useRef(onScratchEnd)
  useEffect(() => {
    onScratchStartRef.current = onScratchStart
    onScratchMoveRef.current = onScratchMove
    onScratchEndRef.current = onScratchEnd
  }, [onScratchStart, onScratchMove, onScratchEnd])

  useEffect(() => {
    const el = wheelRef.current
    if (!el || disabled) return

    const [draggable] = Draggable.create(el, {
      type: 'rotation',
      onPress: function (this: Draggable) {
        lastRotationRef.current = this.rotation
        setIsDragging(true)
        onScratchStartRef.current()
      },
      onDrag: function (this: Draggable) {
        const delta = this.rotation - lastRotationRef.current
        lastRotationRef.current = this.rotation
        onScratchMoveRef.current(delta)
      },
      onRelease: () => {
        setIsDragging(false)
        onScratchEndRef.current()
      },
    })

    return () => {
      draggable.kill()
    }
  }, [disabled])

  const accentVar = accent === 'lime' ? 'hsl(var(--lime-accent))' : 'hsl(var(--aqua-accent))'

  return (
    <div
      ref={wheelRef}
      role="slider"
      aria-label="Scratch"
      aria-disabled={disabled}
      title="Arrastrá para hacer scratch: pausa la pista y la mueve con el gesto; al soltar, retoma la reproducción si estaba sonando"
      className={cn(
        'knob relative flex shrink-0 items-center justify-center border-2 border-black/10 touch-none',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing',
      )}
      style={{
        width: size,
        height: size,
        boxShadow: isDragging ? `0 0 0 2px ${accentVar}` : undefined,
      }}
    >
      <div
        className="absolute top-1 h-[30%] w-[2px] origin-bottom rounded-full"
        style={{ backgroundColor: accentVar, left: 'calc(50% - 1px)' }}
      />
      <div className="h-1 w-1 rounded-full bg-white/30" />
    </div>
  )
}
