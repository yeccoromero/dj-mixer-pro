import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Disc3 } from 'lucide-react'
import type { DeckState } from './DJMixer'
import { Knob } from './Knob'
import { WavePanel } from './WavePanel'
import { loadYouTubeApi, type YouTubePlayer } from '@/lib/youtube'
import { publishEvent } from '@/lib/sessionEvents'
import { cn } from '@/lib/utils'

interface DeckProps {
  id: 'A' | 'B'
  state: DeckState
  onStateChange: React.Dispatch<React.SetStateAction<DeckState>>
  isActive: boolean
  onActivate: () => void
}

const accent = { A: 'lime', B: 'aqua' } as const

export const Deck: React.FC<DeckProps> = ({ id, state, onStateChange, isActive, onActivate }) => {
  const containerId = `yt-player-${id}`
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [ready, setReady] = useState(false)
  const pollRef = useRef<number | null>(null)

  // Create the YouTube player once per deck.
  useEffect(() => {
    let cancelled = false

    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      const player = new YT.Player(containerId, {
        videoId: state.track?.youtubeId ?? '',
        playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (event) => {
            playerRef.current = event.target
            event.target.setVolume(state.volume)
            setReady(true)
          },
          onStateChange: (event) => {
            const YTState = window.YT?.PlayerState
            if (!YTState) return
            if (event.data === YTState.PLAYING) {
              onStateChange((prev) => ({ ...prev, isPlaying: true }))
            } else if (event.data === YTState.PAUSED || event.data === YTState.ENDED) {
              onStateChange((prev) => ({ ...prev, isPlaying: false }))
            }
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load a new video when the assigned track changes.
  useEffect(() => {
    if (ready && playerRef.current && state.track) {
      playerRef.current.loadVideoById(state.track.youtubeId)
    }
  }, [state.track?.youtubeId, ready])

  // Crossfader volume combined with the gain knob.
  useEffect(() => {
    if (ready && playerRef.current) {
      const effective = Math.round((state.volume / 100) * (state.gain / 100) * 100)
      playerRef.current.setVolume(effective)
    }
  }, [state.volume, state.gain, ready])

  // Poll playback position for the waveform / timeline.
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(() => {
      if (playerRef.current && state.isPlaying) {
        const currentTime = playerRef.current.getCurrentTime()
        onStateChange((prev) => (prev.isPlaying ? { ...prev, currentTime } : prev))
      }
    }, 400)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [state.isPlaying, onStateChange])

  const togglePlay = () => {
    if (!playerRef.current) return
    if (state.isPlaying) {
      playerRef.current.pauseVideo()
      publishEvent(`Deck ${id} en pausa`)
    } else {
      playerRef.current.playVideo()
      publishEvent(`Deck ${id} reproduciendo "${state.track?.title ?? 'sin pista'}"`)
    }
  }

  const jumpToCue = () => {
    if (!playerRef.current || !state.track) return
    const target = (state.cue / 100) * state.track.duration
    playerRef.current.seekTo(target, true)
    publishEvent(`Deck ${id} salto a cue (${Math.round(target)}s)`)
  }

  const duration = state.track?.duration ?? 1
  const progress = duration > 0 ? state.currentTime / duration : 0
  const color = accent[id]

  return (
    <motion.div
      layout
      onClick={onActivate}
      className={cn(
        'deck flex flex-col gap-4 border-2 transition-colors',
        isActive ? (id === 'A' ? 'border-lime-accent' : 'border-aqua-accent') : 'border-transparent',
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <span className={cn('chip-lime music-number', id === 'B' && 'chip-aqua')}>DECK {id}</span>
        <motion.div animate={state.isPlaying ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}>
          <Disc3 className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/80">
        <div id={containerId} className="h-full w-full" style={{ filter: `saturate(${0.5 + state.filter / 100})` }} />
      </div>

      <div className="min-h-[40px]">
        <p className="music-body truncate">{state.track?.title ?? 'Sin pista asignada'}</p>
        <p className="truncate text-sm text-muted-foreground">{state.track?.artist ?? '—'}</p>
      </div>

      <WavePanel seed={state.track?.id ?? id} progress={progress} isPlaying={state.isPlaying} accent={color} />

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            jumpToCue()
          }}
          className="knob flex h-11 w-11 items-center justify-center text-[10px] font-semibold uppercase"
        >
          Cue
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            togglePlay()
          }}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full text-black shadow',
            id === 'A' ? 'bg-lime-accent' : 'bg-aqua-accent',
          )}
        >
          {state.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
        </button>
      </div>

      <div className="flex items-center justify-around pt-1" onClick={(event) => event.stopPropagation()}>
        <Knob
          label="Gain"
          value={state.gain}
          onChange={(v) => onStateChange((prev) => ({ ...prev, gain: v }))}
          accent={color}
        />
        <Knob
          label="Filter"
          value={state.filter}
          onChange={(v) => onStateChange((prev) => ({ ...prev, filter: v }))}
          accent={color}
        />
        <Knob
          label="Cue pt."
          value={state.cue}
          onChange={(v) => onStateChange((prev) => ({ ...prev, cue: v }))}
          accent={color}
        />
      </div>
    </motion.div>
  )
}
