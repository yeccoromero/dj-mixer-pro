import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Disc3, AlertTriangle } from 'lucide-react'
import type { DeckState } from './DJMixer'
import { Knob } from './Knob'
import { WavePanel } from './WavePanel'
import { loadYouTubeApi, describeYouTubeError, type YouTubePlayer } from '@/lib/youtube'
import { computeCuePercent, computeEffectiveVolume } from '@/lib/mixerMath'
import { formatTime } from '@/lib/format'
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
// How long the Cue button has to be held before it switches from a "jump back" tap into a
// "preview from here" hold — long enough that a normal tap never crosses it, short enough
// that holding still feels immediate.
const CUE_HOLD_THRESHOLD_MS = 200
// How often we ask the real player where it is. Frequent enough that the playhead line
// (which glides smoothly between updates via CSS, see WavePanel) reads as continuous
// motion rather than visible steps, without hammering the postMessage bridge to the iframe.
const POLL_INTERVAL_MS = 200

export const Deck: React.FC<DeckProps> = ({ id, state, onStateChange, isActive, onActivate, onDurationResolved }) => {
  const containerId = `yt-player-${id}`
  const playerRef = useRef<YouTubePlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const lastReportedDuration = useRef<{ trackId: string; duration: number } | null>(null)
  const [justMarked, setJustMarked] = useState(false)
  const [loadedFraction, setLoadedFraction] = useState(0)

  // The player's event handlers below are attached once (see the `[id]`-only effect) and
  // would otherwise close over a stale `state` forever, so they read from this ref instead.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const readyRef = useRef(ready)
  useEffect(() => {
    readyRef.current = ready
  }, [ready])

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
        playerVars: {
          controls: 0, // no native YouTube control bar — Play/Pause/Cue only from our own console
          disablekb: 1, // no keyboard shortcuts on the embed (space, arrows, etc.)
          fs: 0, // no fullscreen button
          iv_load_policy: 3, // no video annotations
          cc_load_policy: 0, // no captions/subtitles shown by default
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
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
    }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [state.isPlaying, onStateChange])

  // How much of the video has actually buffered — the real signal behind the "preload"
  // fill on the position bar (see WavePanel). Buffering can keep progressing even while
  // paused, so this runs independently of `isPlaying`; a slower interval is plenty since
  // buffering doesn't change nearly as fast as playback position.
  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => {
      if (playerRef.current) {
        setLoadedFraction(playerRef.current.getVideoLoadedFraction())
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [ready])

  const togglePlay = () => {
    if (!playerRef.current || !ready) return
    if (state.isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  // The playhead line glides smoothly between poll updates during normal playback (see
  // WavePanel) — but an explicit seek is a deliberate jump, not a small forward step, so it
  // needs to land instantly instead of visibly sliding there. Turning the transition off for
  // exactly one paint (via a double rAF, so the browser commits the "no transition" style
  // before the new position applies) and back on again gets both behaviors from one line.
  const [smoothPlayhead, setSmoothPlayhead] = useState(true)

  /** Seeks the real player AND updates `currentTime` immediately, so the LED counters and
   * waveform reflect the new position right away — the poll below only runs while playing,
   * so without this a seek while paused would look like it silently did nothing. */
  const seekAndSync = (seconds: number) => {
    if (!playerRef.current) return
    playerRef.current.seekTo(seconds, true)
    setSmoothPlayhead(false)
    onStateChange((prev) => ({ ...prev, currentTime: seconds }))
    requestAnimationFrame(() => requestAnimationFrame(() => setSmoothPlayhead(true)))
  }

  // Reads via refs (not `state`/`ready` directly) so it's safe to call from the mount-only
  // pointerup listener below, which would otherwise close over stale values forever.
  const jumpToCueAndStop = () => {
    const track = stateRef.current.track
    if (!playerRef.current || !track) return
    seekAndSync((stateRef.current.cue / 100) * track.duration)
    playerRef.current.pauseVideo()
  }

  // Cue behaves like a real CDJ's cue button: a quick tap jumps back to the marked point and
  // stops there; holding it down previews playback from that point, and releasing snaps back
  // to the marker and stops again — a single, global `pointerup` listener catches the release
  // even if the pointer drifted off the button first.
  const isPressedRef = useRef(false)
  const isHoldPreviewRef = useRef(false)
  const holdTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (!isPressedRef.current) return
      isPressedRef.current = false
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
      if (isHoldPreviewRef.current) {
        isHoldPreviewRef.current = false
        jumpToCueAndStop()
      }
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCuePointerDown = () => {
    if (!playerRef.current || !readyRef.current || !stateRef.current.track) return
    isPressedRef.current = true
    isHoldPreviewRef.current = false
    jumpToCueAndStop()
    holdTimerRef.current = window.setTimeout(() => {
      if (!isPressedRef.current) return
      isHoldPreviewRef.current = true
      playerRef.current?.playVideo()
    }, CUE_HOLD_THRESHOLD_MS)
  }

  /** "Marcar" grabs wherever the track actually is right now as the new cue point — no
   * more dialing in a blind percentage, you just mark the moment you're already hearing. */
  const handleSetCue = () => {
    if (!playerRef.current || !ready || !state.track) return
    const currentTime = playerRef.current.getCurrentTime()
    const cue = computeCuePercent(currentTime, state.track.duration)
    onStateChange((prev) => ({ ...prev, cue }))
    setJustMarked(true)
    window.setTimeout(() => setJustMarked(false), 400)
  }

  const handleWaveformSeek = (ratio: number) => {
    if (!playerRef.current || !ready || !state.track) return
    seekAndSync(ratio * state.track.duration)
  }

  const duration = state.track?.duration ?? 1
  const progress = duration > 0 ? state.currentTime / duration : 0
  const color = accent[id]
  const ledClass = id === 'A' ? 'led-display-lime' : 'led-display-aqua'

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
        {/* Absorbs clicks/drags on the video itself so it stays a clean, passive display —
            play/pause/seek only happen through our own controls below, never by interacting
            with the embedded player directly (no native YouTube overlay, no accidental pause). */}
        <div className="absolute inset-0" aria-hidden="true" />
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

      <div className="min-h-[32px]">
        <p className="truncate text-sm font-medium">{state.track?.title ?? 'Sin pista asignada'}</p>
        <p className="truncate text-xs text-muted-foreground">{state.track?.artist ?? '—'}</p>
      </div>

      <WavePanel
        progress={progress}
        accent={color}
        cueProgress={state.track ? state.cue / 100 : undefined}
        loadedFraction={state.track ? loadedFraction : undefined}
        smoothPlayhead={smoothPlayhead}
        onSeek={handleWaveformSeek}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <span className={cn(ledClass, 'justify-self-start text-xs')} title="Tiempo transcurrido">
          {formatTime(state.currentTime)}
        </span>
        <button
          type="button"
          disabled={!ready}
          onClick={() => togglePlay()}
          title="Reproducir/Pausar"
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full text-black shadow disabled:cursor-not-allowed disabled:opacity-40',
            id === 'A' ? 'bg-lime-accent' : 'bg-aqua-accent',
          )}
        >
          {state.isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 translate-x-0.5" />}
        </button>
        <span className={cn(ledClass, 'justify-self-end text-xs')} title="Tiempo restante">
          -{formatTime(Math.max(0, duration - state.currentTime))}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={!ready || !state.track}
          title="Toque corto: salta al punto marcado y para ahí. Mantener presionado: reproduce de prueba desde ese punto; al soltar, vuelve ahí y para."
          onPointerDown={handleCuePointerDown}
          className="knob flex h-8 w-16 items-center justify-center text-[10px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cue
        </button>
        <button
          type="button"
          disabled={!ready || !state.track}
          title="Marca el punto exacto donde está la pista ahora mismo como el nuevo cue — se puede tocar o arrastrar la onda para buscar el momento antes de marcarlo"
          onClick={handleSetCue}
          className={cn(
            'knob flex h-8 px-3 items-center justify-center text-[10px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40',
            justMarked && 'animate-flash-pulse',
          )}
        >
          Marcar
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
      </div>
    </motion.div>
  )
}
