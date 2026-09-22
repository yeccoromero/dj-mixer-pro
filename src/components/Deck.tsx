import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Disc3, AlertTriangle } from 'lucide-react'
import type { DeckState } from './DJMixer'
import { Knob } from './Knob'
import { WavePanel } from './WavePanel'
import { loadYouTubeApi, describeYouTubeError, type YouTubePlayer } from '@/lib/youtube'
import { computeEffectiveVolume } from '@/lib/mixerMath'
import { cn } from '@/lib/utils'

interface DeckProps {
  id: 'A' | 'B'
  state: DeckState
  onStateChange: React.Dispatch<React.SetStateAction<DeckState>>
  isActive: boolean
  onActivate: () => void
  /** Called once the real video duration is known, so the app can replace a placeholder. */
  onDurationResolved?: (trackId: string, duration: number) => void
}

const accent = { A: 'lime', B: 'aqua' } as const

export const Deck: React.FC<DeckProps> = ({ id, state, onStateChange, isActive, onActivate, onDurationResolved }) => {
  const containerId = `yt-player-${id}`
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const lastReportedDuration = useRef<{ trackId: string; duration: number } | null>(null)

  // The player's event handlers below are attached once (see the `[id]`-only effect) and
  // would otherwise close over a stale `state` forever, so they read from this ref instead.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const reportRealDuration = () => {
    const track = stateRef.current.track
    if (!playerRef.current || !track || !onDurationResolved) return
    const real = Math.round(playerRef.current.getDuration())
    if (real <= 0 || real === track.duration) return
    if (lastReportedDuration.current?.trackId === track.id && lastReportedDuration.current.duration === real) {
      return
    }
    lastReportedDuration.current = { trackId: track.id, duration: real }
    onDurationResolved(track.id, real)
  }

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
            event.target.setVolume(computeEffectiveVolume(state.volume, state.gain))
            setReady(true)
            reportRealDuration()
          },
          onStateChange: (event) => {
            const YTState = window.YT?.PlayerState
            if (!YTState) return
            if (event.data === YTState.PLAYING) {
              setError(null)
              reportRealDuration()
              onStateChange((prev) => ({ ...prev, isPlaying: true }))
            } else if (event.data === YTState.PAUSED || event.data === YTState.ENDED) {
              onStateChange((prev) => ({ ...prev, isPlaying: false }))
            }
          },
          onError: (event) => {
            setError(describeYouTubeError(event.data))
            onStateChange((prev) => ({ ...prev, isPlaying: false }))
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

  // Load a new video when the assigned track changes, or stop playback if it was cleared.
  useEffect(() => {
    if (!ready || !playerRef.current) return
    if (state.track) {
      setError(null)
      playerRef.current.loadVideoById(state.track.youtubeId)
    } else {
      setError(null)
      playerRef.current.pauseVideo()
    }
  }, [state.track?.youtubeId, ready])

  // Crossfader volume combined with the gain knob.
  useEffect(() => {
    if (ready && playerRef.current) {
      playerRef.current.setVolume(computeEffectiveVolume(state.volume, state.gain))
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
    if (!playerRef.current || !ready) return
    if (state.isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  const jumpToCue = () => {
    if (!playerRef.current || !ready || !state.track) return
    const target = (state.cue / 100) * state.track.duration
    playerRef.current.seekTo(target, true)
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
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/70">
            Cargando reproductor…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/80 px-3 text-center text-white">
            <AlertTriangle className="h-5 w-5 text-lime-accent" />
            <p className="text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="min-h-[40px]">
        <p className="music-body truncate">{state.track?.title ?? 'Sin pista asignada'}</p>
        <p className="truncate text-sm text-muted-foreground">{state.track?.artist ?? '—'}</p>
      </div>

      <WavePanel seed={state.track?.id ?? id} progress={progress} isPlaying={state.isPlaying} accent={color} />

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={!ready}
          title="Salta la reproducción al punto marcado por el knob 'Cue pt.'"
          onClick={(event) => {
            event.stopPropagation()
            jumpToCue()
          }}
          className="knob flex h-11 w-11 items-center justify-center text-[10px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cue
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={(event) => {
            event.stopPropagation()
            togglePlay()
          }}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full text-black shadow disabled:cursor-not-allowed disabled:opacity-40',
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
          description="Ganancia del deck: se combina con el crossfader para dar el volumen final"
        />
        <Knob
          label="Filter"
          value={state.filter}
          onChange={(v) => onStateChange((prev) => ({ ...prev, filter: v }))}
          accent={color}
          description="Filtro visual (saturación del video); no afecta el audio del embed de YouTube"
        />
        <Knob
          label="Cue pt."
          value={state.cue}
          onChange={(v) => onStateChange((prev) => ({ ...prev, cue: v }))}
          accent={color}
          description="Define a qué % de la pista salta el botón 'Cue'"
        />
      </div>
    </motion.div>
  )
}
