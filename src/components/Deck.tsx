import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Disc3, AlertTriangle, RotateCcw, Repeat } from 'lucide-react'
import type { DeckState } from './DJMixer'
import { VerticalFader } from './VerticalFader'
import { WavePanel } from './WavePanel'
import { ScratchWheel } from './ScratchWheel'
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
  /** True while an FX pad is held — ducks this deck's track volume so the effect (which
   * plays through its own separate Web Audio/Tone.js output, not through the player) reads
   * as clearly louder than the music instead of getting buried under wherever Gain/crossfader
   * currently sit. */
  ducking?: boolean
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
// How far the track gets ducked while an FX pad is held — enough to clearly cede the
// foreground to the effect without going all the way to silence (still recognizably "the
// track, just quieter," not a hard mute).
const DUCK_FACTOR = 0.3
// A second LOOP tap closer than this to the in point would activate an imperceptibly short
// (or, at 0, infinitely-retriggering) loop — ignored instead, so the button just keeps
// waiting for a real out point.
const MIN_LOOP_PERCENT = 1
// How much track time one full 360° turn of the scratch wheel covers — tuned by feel, not by
// any real turntable spec (there's no physical platter circumference to match here). Small
// enough that a normal drag gesture covers a few seconds, not the whole track.
const SCRATCH_SECONDS_PER_REVOLUTION = 6
// The scratch wheel's onDrag fires on every pointer move (much more often than the 200ms poll
// used elsewhere) — seeking the real player and updating state on every tick would hammer the
// postMessage bridge to the iframe for no perceptible benefit. Skipping seeks smaller than
// this keeps the gesture responsive without seeking dozens of times per second.
const SCRATCH_SEEK_THRESHOLD_SECONDS = 0.05

export const Deck: React.FC<DeckProps> = ({ id, state, onStateChange, isActive, onActivate, onDurationResolved, ducking = false }) => {
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

  // Crossfader volume combined with the gain knob, ducked while an FX pad is held.
  useEffect(() => {
    if (ready && playerRef.current) {
      playerRef.current.setVolume(computeEffectiveVolume(state.volume, state.gain, ducking ? DUCK_FACTOR : 1))
    }
  }, [state.volume, state.gain, ready, ducking])

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

  // Poll playback position for the waveform / timeline — and, while a loop is active, jump
  // back to loopIn the instant playback crosses loopOut, so the loop repeats seamlessly
  // instead of needing a separate "did we pass the end" effect layered on top.
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(() => {
      if (playerRef.current && state.isPlaying) {
        const currentTime = playerRef.current.getCurrentTime()
        if (state.loopActive && state.loopOut !== null && state.loopIn !== null && state.track) {
          const loopOutSeconds = (state.loopOut / 100) * state.track.duration
          if (currentTime >= loopOutSeconds) {
            seekAndSync((state.loopIn / 100) * state.track.duration)
            return
          }
        }
        onStateChange((prev) => (prev.isPlaying ? { ...prev, currentTime } : prev))
      }
    }, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
    // seekAndSync is intentionally excluded: it's a plain function recreated every render, but
    // its behavior only depends on playerRef (a ref) and onStateChange (already listed) — adding
    // it would just tear down and restart this interval on every render (including every poll
    // tick's own state update) instead of only when something here actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.loopActive, state.loopIn, state.loopOut, state.track, onStateChange])

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

  // Both read via refs (not `state`/`ready` directly) so they're safe to call from the
  // mount-only pointerup listener below, which would otherwise close over stale values
  // forever.
  const jumpToCue = () => {
    const track = stateRef.current.track
    if (!playerRef.current || !track) return
    seekAndSync((stateRef.current.cue / 100) * track.duration)
  }

  const jumpToCueAndStop = () => {
    jumpToCue()
    playerRef.current?.pauseVideo()
  }

  // A quick tap on Cue jumps to the marked point without touching playback state — if it
  // was playing, it keeps playing from there; if it was paused, it stays paused there.
  // Holding the button down previews playback from that point regardless of what was
  // happening before, and releasing snaps back to the marker and stops — that one always
  // pauses, since the whole point of a preview is to leave you exactly where you started
  // once you let go. A single, global `pointerup` listener catches the release even if the
  // pointer drifted off the button first.
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
    jumpToCue()
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

  /** Clears the cue point back to the very start of the track — the only way to get back
   * to 0% once Marcar has moved it, short of scrubbing there and marking it again by hand. */
  const handleResetCue = () => {
    onStateChange((prev) => ({ ...prev, cue: 0 }))
  }

  const handleWaveformSeek = (ratio: number) => {
    if (!playerRef.current || !ready || !state.track) return
    seekAndSync(ratio * state.track.duration)
  }

  /** A single LOOP button cycles through the three states a DJ loop needs, without any
   * separate "set in" / "set out" / "activate" controls to explain:
   *   1st tap (idle):   marks loopIn at wherever the track is right now.
   *   2nd tap (armed):  marks loopOut there and activates the loop — the poll effect above
   *                      then jumps back to loopIn every time playback crosses loopOut.
   *   3rd tap (active): clears both points and returns to idle, playback continues normally.
   * Taps that would produce a loop shorter than MIN_LOOP_PERCENT are ignored (stays armed,
   * waiting for a real out point) instead of activating a loop too short to be useful. */
  const handleLoopTap = () => {
    if (!playerRef.current || !ready || !state.track) return
    if (state.loopActive) {
      onStateChange((prev) => ({ ...prev, loopIn: null, loopOut: null, loopActive: false }))
      return
    }
    const percent = computeCuePercent(playerRef.current.getCurrentTime(), state.track.duration)
    if (state.loopIn === null) {
      onStateChange((prev) => ({ ...prev, loopIn: percent }))
      return
    }
    const loopIn = Math.min(state.loopIn, percent)
    const loopOut = Math.max(state.loopIn, percent)
    if (loopOut - loopIn < MIN_LOOP_PERCENT) return
    onStateChange((prev) => ({ ...prev, loopIn, loopOut, loopActive: true }))
  }

  // The real turntable-scratch sound (pitch-bent, reversible audio) isn't reachable here — the
  // track plays through YouTube's iframe, which exposes seekTo/play/pause but no raw audio
  // buffer and no reverse playback. This approximates the *gesture*: pausing and seeking
  // rapidly as the wheel turns produces the choppy "stutter" of a scratch, then resumes normal
  // playback (if it was playing) wherever the gesture left off. All three handlers read/write
  // via refs so they stay safe to pass straight into ScratchWheel's own ref-cached callbacks.
  const scratchWasPlayingRef = useRef(false)
  const scratchTimeRef = useRef(0)
  const lastScratchSeekRef = useRef(0)

  const handleScratchStart = () => {
    if (!playerRef.current || !readyRef.current || !stateRef.current.track) return
    scratchWasPlayingRef.current = stateRef.current.isPlaying
    const current = playerRef.current.getCurrentTime()
    scratchTimeRef.current = current
    lastScratchSeekRef.current = current
    playerRef.current.pauseVideo()
    setSmoothPlayhead(false)
  }

  const handleScratchMove = (deltaDegrees: number) => {
    const track = stateRef.current.track
    if (!playerRef.current || !track) return
    const deltaSeconds = (deltaDegrees / 360) * SCRATCH_SECONDS_PER_REVOLUTION
    const next = Math.min(track.duration, Math.max(0, scratchTimeRef.current + deltaSeconds))
    scratchTimeRef.current = next
    if (Math.abs(next - lastScratchSeekRef.current) < SCRATCH_SEEK_THRESHOLD_SECONDS) return
    lastScratchSeekRef.current = next
    playerRef.current.seekTo(next, true)
    onStateChange((prev) => ({ ...prev, currentTime: next }))
  }

  const handleScratchEnd = () => {
    // The last move may have been skipped by the threshold above — land exactly where the
    // gesture actually ended, not wherever the last *applied* seek happened to be.
    if (playerRef.current && scratchTimeRef.current !== lastScratchSeekRef.current) {
      playerRef.current.seekTo(scratchTimeRef.current, true)
      onStateChange((prev) => ({ ...prev, currentTime: scratchTimeRef.current }))
    }
    setSmoothPlayhead(true)
    if (scratchWasPlayingRef.current) playerRef.current?.playVideo()
  }

  const duration = state.track?.duration ?? 1
  const progress = duration > 0 ? state.currentTime / duration : 0
  const color = accent[id]
  const ledClass = id === 'A' ? 'led-display-lime' : 'led-display-aqua'
  const loopTitle = state.loopActive
    ? 'Loop activo — toca para desactivarlo'
    : state.loopIn !== null
      ? 'Toca para marcar la salida del loop y activarlo'
      : 'Toca para marcar la entrada del loop'

  return (
    <motion.div
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

      {/* Gain lives beside the video it controls, running the full height of the deck's
          playback area — like the channel fader on a real mixer sits right next to the deck,
          not off on its own below everything with empty space on both sides. On Deck B the
          row is mirrored (fader first, video second) so the fader sits on the side closest to
          the crossfader in the middle, matching Deck A's fader on its own inner side. */}
      <div className={cn('flex gap-3', id === 'B' && 'flex-row-reverse')}>
        <div className="relative aspect-video flex-1 overflow-hidden rounded-xl bg-black/80">
          <div id={containerId} className="h-full w-full" />
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

        <div className="flex" onClick={(event) => event.stopPropagation()}>
          <VerticalFader
            label="Gain"
            value={state.gain}
            onChange={(v) => onStateChange((prev) => ({ ...prev, gain: v }))}
            accent={color}
            fill
            description="Ganancia del deck: se combina con el crossfader para dar el volumen final"
          />
        </div>
      </div>

      <div className="min-h-[32px]">
        <p className="truncate text-sm font-medium">{state.track?.title ?? 'Sin pista asignada'}</p>
        <p className="truncate text-xs text-muted-foreground">{state.track?.artist ?? '—'}</p>
      </div>

      <WavePanel
        progress={progress}
        accent={color}
        cueProgress={state.track ? state.cue / 100 : undefined}
        loopInProgress={state.track && state.loopIn !== null ? state.loopIn / 100 : undefined}
        loopOutProgress={state.track && state.loopOut !== null ? state.loopOut / 100 : undefined}
        loadedFraction={state.track ? loadedFraction : undefined}
        smoothPlayhead={smoothPlayhead}
        onSeek={handleWaveformSeek}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <span className={cn(ledClass, 'justify-self-start text-xs')} title="Tiempo transcurrido">
          {formatTime(state.currentTime)}
        </span>
        <div className="flex items-center gap-3">
          <ScratchWheel
            accent={color}
            disabled={!ready || !state.track}
            onScratchStart={handleScratchStart}
            onScratchMove={handleScratchMove}
            onScratchEnd={handleScratchEnd}
          />
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
        </div>
        <span className={cn(ledClass, 'justify-self-end text-xs')} title="Tiempo restante">
          -{formatTime(Math.max(0, duration - state.currentTime))}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={!ready || !state.track}
          title="Toque corto: salta al punto marcado sin cortar la reproducción. Mantener presionado: reproduce de prueba desde ese punto; al soltar, vuelve ahí y pausa."
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
        <button
          type="button"
          disabled={!ready || !state.track}
          title="Reinicia el punto de cue al comienzo de la pista (0%)"
          onClick={handleResetCue}
          className="knob flex h-8 w-8 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={!ready || !state.track}
          title={loopTitle}
          onClick={handleLoopTap}
          className={cn(
            'knob flex h-8 items-center justify-center gap-1 px-3 text-[10px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40',
            state.loopActive && (id === 'A' ? 'bg-lime-accent text-black' : 'bg-aqua-accent text-black'),
            !state.loopActive && state.loopIn !== null && (id === 'A' ? 'ring-2 ring-lime-accent' : 'ring-2 ring-aqua-accent'),
          )}
        >
          <Repeat className="h-3 w-3" />
          Loop
        </button>
      </div>
    </motion.div>
  )
}
