import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react'
import type { Track } from './DJMixer'
import { AddTrackModal } from './AddTrackModal'
import { SuggestedTracks } from './SuggestedTracks'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CoverFlowProps {
  tracks: Track[]
  selectedTrack: Track | null
  activeDeck: 'A' | 'B'
  onTrackSelect: (track: Track) => void
  onAddTrack: (track: Track) => void
  onRemoveTrack: (trackId: string) => void
}

const VISIBLE_RADIUS = 2 // show up to 2 cards fanned on each side of the active one
const CARD_WIDTH = 128
const CARD_HEIGHT = 172
const STEP_X = 84 // horizontal distance each side card slides per position
// A snappy "decelerate hard" curve (close to GSAP's power3/power4-out) — feels far more
// fluid for discrete navigation than a spring, which tends to wobble/overshoot when it's
// animating position, scale and 3D rotation all at once.
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const CoverFlow: React.FC<CoverFlowProps> = ({
  tracks,
  selectedTrack,
  activeDeck,
  onTrackSelect,
  onAddTrack,
  onRemoveTrack,
}) => {
  // The carousel's own position — the single source of truth for what's centered/active.
  // Kept independent of `selectedTrack` so the arrows/side cards always work, even after
  // a track has been loaded into a deck.
  const [centerIndex, setCenterIndex] = useState(0)

  useEffect(() => {
    setCenterIndex((i) => Math.min(Math.max(i, 0), Math.max(tracks.length - 1, 0)))
  }, [tracks.length])

  // When a track gets assigned to a deck from elsewhere, bring it to the front once —
  // this never fires again just from browsing with the arrows or side cards.
  useEffect(() => {
    if (!selectedTrack) return
    const idx = tracks.findIndex((t) => t.id === selectedTrack.id)
    if (idx !== -1) setCenterIndex(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack])

  const move = (direction: -1 | 1) => {
    setCenterIndex((prev) => Math.min(tracks.length - 1, Math.max(0, prev + direction)))
  }

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const SWIPE_DISTANCE = 60
    const SWIPE_VELOCITY = 400
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) move(1)
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) move(-1)
  }

  if (tracks.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-6 text-center">
        <p className="music-body text-muted-foreground">Tu biblioteca está vacía</p>
        <AddTrackModal onAddTrack={onAddTrack} />
      </div>
    )
  }

  // `centerIndex` is only re-clamped by the effect above *after* a render, so right after
  // a track is removed (e.g. the last/active one), `tracks` has already shrunk here while
  // `centerIndex` still points past the end for this one render. Deriving the safe value
  // used for everything below avoids indexing out of bounds and crashing that render.
  const safeIndex = Math.min(centerIndex, tracks.length - 1)
  const activeTrack = tracks[safeIndex]

  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="music-body">Biblioteca</span>
        <AddTrackModal onAddTrack={onAddTrack} />
      </div>

      <div className="relative flex h-52 items-center justify-center overflow-hidden" style={{ perspective: 900 }}>
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={safeIndex === 0}
          className="knob absolute left-0 z-30 flex h-8 w-8 items-center justify-center disabled:opacity-30"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="relative" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          <AnimatePresence initial={false}>
            {tracks.map((track, index) => {
              const offset = index - safeIndex
              if (Math.abs(offset) > VISIBLE_RADIUS) return null
              const isActive = offset === 0

              return (
                <motion.div
                  key={track.id}
                  onClick={() => {
                    if (!isActive) setCenterIndex(index)
                  }}
                  className={cn(
                    'coverflow-card absolute inset-0 overflow-hidden rounded-2xl border-2 shadow-lg',
                    isActive ? 'cursor-default border-white/70' : 'cursor-pointer border-white/20',
                  )}
                  style={{ zIndex: 10 - Math.abs(offset) }}
                  initial={{ opacity: 0, x: offset * STEP_X, scale: 0.7 }}
                  animate={{
                    x: offset * STEP_X,
                    opacity: isActive ? 1 : 0.82 - Math.abs(offset) * 0.12,
                    scale: isActive ? 1.08 : 0.86 - Math.abs(offset) * 0.05,
                    rotateY: offset * -22,
                  }}
                  exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                  transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
                  drag={isActive ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.5}
                  dragTransition={{ bounceStiffness: 500, bounceDamping: 32 }}
                  onDragEnd={isActive ? handleDragEnd : undefined}
                >
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                  {isActive && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveTrack(track.id)
                      }}
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-black shadow hover:bg-white"
                      aria-label={`Quitar "${track.title}" de la biblioteca`}
                      title="Quitar de la biblioteca"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{track.title}</p>
                      {isActive && (
                        <p className="flex items-center gap-1 truncate text-[10px] text-white/70">
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {track.artist} · {formatTime(track.duration)}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onTrackSelect(track)
                        }}
                        className={cn(
                          'w-full rounded-full py-1 text-[10px] font-semibold text-black shadow',
                          activeDeck === 'A' ? 'bg-lime-accent' : 'bg-aqua-accent',
                        )}
                        title={`Cargar esta pista en el Deck ${activeDeck} (el deck activo)`}
                      >
                        Cargar en Deck {activeDeck}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          disabled={safeIndex >= tracks.length - 1}
          className="knob absolute right-0 z-30 flex h-8 w-8 items-center justify-center disabled:opacity-30"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {activeTrack.title} — {activeTrack.artist}
      </p>

      <SuggestedTracks basedOn={activeTrack} existingTrackIds={tracks.map((t) => t.id)} onAddTrack={onAddTrack} />
    </div>
  )
}
