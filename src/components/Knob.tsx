import React, { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
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
  const dragState = useRef<{ startY: number; startValue: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      dragState.current = { startY: event.clientY, startValue: value }
      setIsDragging(true)
    },
    [value],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return
      const delta = dragState.current.startY - event.clientY
      const range = max - min
      const nextValue = clamp(dragState.current.startValue + (delta / 150) * range)
      onChange(Math.round(nextValue))
    },
    [clamp, max, min, onChange],
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragState.current = null
    setIsDragging(false)
  }, [])

  const ratio = (value - min) / (max - min)
  const angle = MIN_ANGLE + ratio * (MAX_ANGLE - MIN_ANGLE)

  const accentColor =
    accent === 'lime' ? 'hsl(var(--lime-accent))' : accent === 'aqua' ? 'hsl(var(--aqua-accent))' : 'white'

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        title={description}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') onChange(clamp(value + 1))
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') onChange(clamp(value - 1))
        }}
        className={cn(
          'knob relative flex cursor-ns-resize items-center justify-center border-2 border-black/10 touch-none',
          isDragging && 'ring-2 ring-lime-accent',
        )}
        style={{ width: size, height: size }}
      >
        <motion.div
          className="absolute top-1.5 left-1/2 h-[35%] w-[2.5px] origin-bottom rounded-full"
          style={{ backgroundColor: accentColor, translateX: '-50%' }}
          animate={{ rotate: angle }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        />
        <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
      </div>
      <span className="music-number text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
