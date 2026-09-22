import React, { useCallback, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

interface CrossFaderProps {
  value: number // 0 (full A) - 100 (full B)
  onChange: (value: number) => void
}

export const CrossFader: React.FC<CrossFaderProps> = ({ value, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(value)
  const isDragging = useRef(false)

  useEffect(() => {
    if (!isDragging.current) x.set(value)
  }, [value, x])

  const limeOpacity = useTransform(x, [0, 50, 100], [1, 0.5, 0.15])
  const aquaOpacity = useTransform(x, [0, 50, 100], [0.15, 0.5, 1])

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const next = Math.round(ratio * 100)
      x.set(next)
      onChange(next)
    },
    [onChange, x],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    isDragging.current = true
    updateFromClientX(event.clientX)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return
    updateFromClientX(event.clientX)
  }

  const handlePointerUp = () => {
    isDragging.current = false
  }

  const snapCenter = () => {
    animate(x, 50, { type: 'spring', stiffness: 300, damping: 25, onUpdate: (v) => onChange(Math.round(v)) })
  }

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <motion.span className="chip-lime music-number" style={{ opacity: limeOpacity }}>
          DECK A
        </motion.span>
        <button
          type="button"
          onClick={snapCenter}
          className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          Centrar
        </button>
        <motion.span className="chip-aqua music-number" style={{ opacity: aquaOpacity }}>
          DECK B
        </motion.span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-8 w-full cursor-pointer touch-none rounded-full bg-gradient-to-r from-lime-accent/70 via-muted to-aqua-accent/70 px-1"
      >
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/10" />
        <motion.div
          className="knob absolute top-1/2 h-7 w-4 -translate-y-1/2 rounded-md border border-black/20"
          style={{ left: useTransform(x, (v) => `calc(${v}% - 8px)`) }}
        />
      </div>
    </div>
  )
}
