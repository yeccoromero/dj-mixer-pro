import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Deck } from './Deck'
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
  const [crossFaderValue, setCrossFaderValue] = useState<number>(50)
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
            <CrossFader value={crossFaderValue} onChange={setCrossFaderValue} />

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
