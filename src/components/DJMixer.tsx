import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Deck, type DeckHandle } from './Deck'
import { CrossFader } from './CrossFader'
import { CoverFlow } from './CoverFlow'
import { EffectsPanel } from './EffectsPanel'
import type { EffectId } from '@/lib/effectSounds'
import { computeCrossfaderVolumes } from '@/lib/mixerMath'

export interface Track {
  id: string
  title: string
  artist: string
  youtubeId: string
  duration: number
  thumbnail: string
}

export interface DeckState {
  isPlaying: boolean
  currentTime: number
  volume: number
  gain: number
  cue: number
  /** 0-100% loop bounds. `loopIn` alone means "armed, waiting for the out point"; both set
   * means active — see the 3-tap LOOP button in Deck.tsx. */
  loopIn: number | null
  loopOut: number | null
  loopActive: boolean
  track: Track | null
}

const SAMPLE_TRACKS: Track[] = [
  {
    id: 'sample-1',
    title: 'Electronic Vibes',
    artist: 'DJ Sample',
    youtubeId: 'jfKfPfyJRdk',
    duration: 240,
    thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
  },
  {
    id: 'sample-2',
    title: 'House Beats',
    artist: 'Mix Master',
    youtubeId: '5qap5aO4i9A',
    duration: 280,
    thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/hqdefault.jpg',
  },
  {
    id: 'sample-3',
    title: 'Techno Pulse',
    artist: 'Beat Maker',
    youtubeId: 'DWcJFNfaw9c',
    duration: 320,
    thumbnail: 'https://img.youtube.com/vi/DWcJFNfaw9c/hqdefault.jpg',
  },
]

const STORAGE_KEY = 'dj-mixer-tracks'
// When the deck that's playing has this many seconds or fewer left, Auto DJ starts bringing
// in the other deck. Kept a bit longer than the crossfade itself takes (below) so the handoff
// finishes with the outgoing track still comfortably playing, not right at its last frame.
const AUTO_DJ_TRIGGER_SECONDS = 5
// How long the crossfade itself takes once triggered. Snappy on purpose — an 8s linear fade
// (the original value) read as sluggish; real quick DJ transitions are a couple of seconds,
// and the equal-power crossfader curve already keeps the blend from dipping in volume.
const AUTO_DJ_TRANSITION_SECONDS = 2
// How often the crossfade advances a step. A plain interval instead of a GSAP tween: nothing
// here needs GSAP's easing or its own ticker, and a fixed-interval step is far more
// predictable to test than an animation tied to requestAnimationFrame timing.
const AUTO_DJ_STEP_MS = 50

const createInitialDeckState = (track: Track | null): DeckState => ({
  isPlaying: false,
  currentTime: 0,
  volume: 50,
  // Gain defaults to full (unity) send, not half — it's a straight 0-100% attenuator here
  // (see computeEffectiveVolume), so starting it at 50 made every deck sound noticeably
  // quieter than the same video played directly on YouTube until the user found and raised
  // this knob. Starting at 100 matches YouTube's own volume once the crossfader favors
  // this deck; the knob can still be pulled down from there like any real gain trim.
  gain: 100,
  cue: 0,
  loopIn: null,
  loopOut: null,
  loopActive: false,
  track,
})

export const DJMixer: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? (JSON.parse(saved) as Track[]) : SAMPLE_TRACKS
    } catch {
      return SAMPLE_TRACKS
    }
  })

  const [deckA, setDeckA] = useState<DeckState>(() => createInitialDeckState(tracks[0] ?? null))
  const [deckB, setDeckB] = useState<DeckState>(() => createInitialDeckState(tracks[1] ?? tracks[0] ?? null))
  // Starts fully on Deck A, not centered — a fresh session (or a reload) should already read
  // as "one deck is the live one" rather than both decks audible at once, which is also what
  // Auto DJ needs: a clear side to hand off *from* once the user presses Play there.
  const [crossFaderValue, setCrossFaderValue] = useState<number>(0)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [activeDeck, setActiveDeck] = useState<'A' | 'B'>('A')
  // While an FX pad is held, both decks duck their track volume so the effect (a separate
  // audio path, not something that goes through the player) reads as clearly louder than
  // the music instead of getting buried under wherever Gain/crossfader currently sit.
  const [ducking, setDucking] = useState(false)

  // Cross-fader drives each deck's output volume.
  useEffect(() => {
    const { volumeA, volumeB } = computeCrossfaderVolumes(crossFaderValue)

    setDeckA((prev) => (prev.volume === volumeA ? prev : { ...prev, volume: volumeA }))
    setDeckB((prev) => (prev.volume === volumeB ? prev : { ...prev, volume: volumeB }))
  }, [crossFaderValue])

  // Auto DJ: watches whichever deck is playing, and hands off to the other one automatically
  // when it's about to end — it does NOT pick or queue tracks on its own (that would need a
  // playlist/queue concept this app doesn't have); it only automates the crossfade handoff
  // between whatever the two decks already have loaded.
  const [autoDj, setAutoDj] = useState(false)
  const [autoDjTransitioning, setAutoDjTransitioning] = useState(false)
  const autoDjTransitioningRef = useRef(false)
  const autoDjIntervalRef = useRef<number | null>(null)
  const deckARef = useRef<DeckHandle>(null)
  const deckBRef = useRef<DeckHandle>(null)

  const stopAutoDjTransition = () => {
    if (autoDjIntervalRef.current !== null) {
      window.clearInterval(autoDjIntervalRef.current)
      autoDjIntervalRef.current = null
    }
    autoDjTransitioningRef.current = false
    setAutoDjTransitioning(false)
  }

  const startAutoDjTransition = (target: 'A' | 'B', fromValue: number) => {
    if (autoDjTransitioningRef.current) return
    const targetState = target === 'A' ? deckA : deckB
    if (!targetState.track) return

    // Bring the incoming deck in the way a DJ would cue it up, but only if it isn't already
    // running — if the other deck is already playing (started by hand, mid-track), respect
    // that instead of yanking it back to its cue point.
    if (!targetState.isPlaying) {
      ;(target === 'A' ? deckARef : deckBRef).current?.cueAndPlay()
    }

    autoDjTransitioningRef.current = true
    setAutoDjTransitioning(true)
    const endValue = target === 'A' ? 0 : 100
    const totalSteps = Math.max(1, Math.round((AUTO_DJ_TRANSITION_SECONDS * 1000) / AUTO_DJ_STEP_MS))
    let step = 0
    autoDjIntervalRef.current = window.setInterval(() => {
      step += 1
      const t = Math.min(1, step / totalSteps)
      setCrossFaderValue(Math.round(fromValue + (endValue - fromValue) * t))
      if (t >= 1) stopAutoDjTransition()
    }, AUTO_DJ_STEP_MS)
  }

  // Checked on every playhead update from either deck (the same 200ms poll that already
  // drives the LED counters and position bar) — cheap, and it's the only reliable signal for
  // "about to end" without duplicating Deck's own polling.
  useEffect(() => {
    if (!autoDj || autoDjTransitioningRef.current) return

    const remaining = (deck: DeckState) => (deck.track ? deck.track.duration - deck.currentTime : Infinity)

    if (deckA.isPlaying && deckB.track && remaining(deckA) <= AUTO_DJ_TRIGGER_SECONDS && remaining(deckA) >= 0) {
      startAutoDjTransition('B', crossFaderValue)
    } else if (deckB.isPlaying && deckA.track && remaining(deckB) <= AUTO_DJ_TRIGGER_SECONDS && remaining(deckB) >= 0) {
      startAutoDjTransition('A', crossFaderValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckA.currentTime, deckA.isPlaying, deckA.track, deckB.currentTime, deckB.isPlaying, deckB.track, autoDj])

  // Turning Auto DJ off mid-crossfade cedes control back immediately instead of letting the
  // transition play out on its own — same as a manual grab of the fader, below.
  useEffect(() => {
    if (!autoDj) stopAutoDjTransition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDj])

  useEffect(() => stopAutoDjTransition, [])

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track)
    // A loop's in/out points are percentages of the *previous* track's duration — meaningless
    // (and possibly instantly re-triggering) once a different track loads, so it clears too.
    if (activeDeck === 'A') {
      setDeckA((prev) => ({ ...prev, track, currentTime: 0, loopIn: null, loopOut: null, loopActive: false }))
    } else {
      setDeckB((prev) => ({ ...prev, track, currentTime: 0, loopIn: null, loopOut: null, loopActive: false }))
    }
  }

  const handleAddTrack = (track: Track) => {
    setTracks((prev) => {
      const updatedTracks = [...prev, track]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTracks))
      return updatedTracks
    })
  }

  const handleRemoveTrack = (trackId: string) => {
    setTracks((prev) => {
      const updatedTracks = prev.filter((t) => t.id !== trackId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTracks))
      return updatedTracks
    })
    setSelectedTrack((prev) => (prev?.id === trackId ? null : prev))
    setDeckA((prev) =>
      prev.track?.id === trackId
        ? { ...prev, track: null, isPlaying: false, currentTime: 0, loopIn: null, loopOut: null, loopActive: false }
        : prev,
    )
    setDeckB((prev) =>
      prev.track?.id === trackId
        ? { ...prev, track: null, isPlaying: false, currentTime: 0, loopIn: null, loopOut: null, loopActive: false }
        : prev,
    )
  }

  const handleEffectTrigger = (effect: EffectId) => {
    console.log(`Activando efecto: ${effect}`)
  }

  // Once a deck's player reports the video's real duration, replace the placeholder
  // everywhere it's used: the library entry and, if it's the one currently loaded, the deck.
  const handleDurationResolved = (trackId: string, duration: number) => {
    setTracks((prev) => {
      const index = prev.findIndex((t) => t.id === trackId)
      if (index === -1 || prev[index].duration === duration) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], duration }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
    setDeckA((prev) =>
      prev.track?.id === trackId && prev.track.duration !== duration
        ? { ...prev, track: { ...prev.track, duration } }
        : prev,
    )
    setDeckB((prev) =>
      prev.track?.id === trackId && prev.track.duration !== duration
        ? { ...prev, track: { ...prev.track, duration } }
        : prev,
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header + efectos, mismo ancho que los paneles de abajo */}
        <motion.div
          className="panel flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center lg:text-left">
            <h1 className="header-title mb-2">DJ Mixer Pro</h1>
            <p className="text-sm text-muted-foreground">
              Reproducción vía YouTube • Contenido sin modificar • Uso bajo Política de YouTube
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:w-auto">
            <EffectsPanel embedded onEffectTrigger={handleEffectTrigger} onDuckingChange={setDucking} />
          </div>
        </motion.div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Deck A */}
          <div className="space-y-4">
            <Deck
              ref={deckARef}
              id="A"
              state={deckA}
              onStateChange={setDeckA}
              isActive={activeDeck === 'A'}
              onActivate={() => setActiveDeck('A')}
              onDurationResolved={handleDurationResolved}
              ducking={ducking}
            />
          </div>

          {/* Centro: Cross-fader y CoverFlow */}
          <div className="space-y-6">
            <CrossFader
              value={crossFaderValue}
              onChange={setCrossFaderValue}
              instant={autoDjTransitioning}
              onDragStart={stopAutoDjTransition}
              autoDj={autoDj}
              onAutoDjChange={setAutoDj}
              autoDjTransitioning={autoDjTransitioning}
            />

            <CoverFlow
              tracks={tracks}
              selectedTrack={selectedTrack}
              activeDeck={activeDeck}
              onTrackSelect={handleTrackSelect}
              onAddTrack={handleAddTrack}
              onRemoveTrack={handleRemoveTrack}
            />
          </div>

          {/* Deck B */}
          <div className="space-y-4">
            <Deck
              ref={deckBRef}
              id="B"
              state={deckB}
              onStateChange={setDeckB}
              isActive={activeDeck === 'B'}
              onActivate={() => setActiveDeck('B')}
              onDurationResolved={handleDurationResolved}
              ducking={ducking}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
