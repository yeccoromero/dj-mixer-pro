import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Track } from './DJMixer'
import { AddTrackModal } from './AddTrackModal'
import { cn } from '@/lib/utils'
import { publishEvent } from '@/lib/sessionEvents'

interface CoverFlowProps {
  tracks: Track[]
  selectedTrack: Track | null
  onTrackSelect: (track: Track) => void
  onAddTrack: (track: Track) => void
}

export const CoverFlow: React.FC<CoverFlowProps> = ({ tracks, selectedTrack, onTrackSelect, onAddTrack }) => {
  const [centerIndex, setCenterIndex] = useState(0)

  const activeIndex = useMemo(() => {
    if (!selectedTrack) return centerIndex
    const idx = tracks.findIndex((t) => t.id === selectedTrack.id)
    return idx === -1 ? centerIndex : idx
  }, [selectedTrack, tracks, centerIndex])

  const move = (direction: -1 | 1) => {
    setCenterIndex((prev) => Math.min(tracks.length - 1, Math.max(0, prev + direction)))
  }

  if (tracks.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-6 text-center">
        <p className="music-body text-muted-foreground">Tu biblioteca está vacía</p>
        <AddTrackModal onAddTrack={onAddTrack} />
      </div>
    )
  }

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="music-body">Biblioteca</span>
        <AddTrackModal onAddTrack={onAddTrack} />
      </div>

      <div className="relative flex h-36 items-center justify-center overflow-visible">
        <button
          type="button"
          onClick={() => move(-1)}
          className="knob absolute left-0 z-20 flex h-8 w-8 items-center justify-center"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-center gap-0">
          <AnimatePresence initial={false}>
            {tracks.map((track, index) => {
              const offset = index - activeIndex
              if (Math.abs(offset) > 2) return null
              const isActive = offset === 0

              return (
                <motion.button
                  type="button"
                  key={track.id}
                  layout
                  onClick={() => {
                    setCenterIndex(index)
                    onTrackSelect(track)
                    publishEvent(`Pista seleccionada: "${track.title}"`)
                  }}
                  className={cn('coverflow-card relative -mx-3 shrink-0 overflow-hidden rounded-lg border-2 shadow', isActive ? 'active border-lime-accent' : 'side border-transparent')}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    scale: isActive ? 1.1 : 0.85 - Math.abs(offset) * 0.1,
                    zIndex: isActive ? 10 : 5 - Math.abs(offset),
                    rotateY: offset * -25,
                  }}
                  style={{ width: 96, height: 96 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                >
                  <img src={track.thumbnail} alt={track.title} className="h-full w-full object-cover" draggable={false} />
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-left">
                      <p className="truncate text-[10px] font-medium text-white">{track.title}</p>
                    </div>
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          className="knob absolute right-0 z-20 flex h-8 w-8 items-center justify-center"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {tracks[activeIndex]?.title} — {tracks[activeIndex]?.artist}
      </p>
    </div>
  )
}
