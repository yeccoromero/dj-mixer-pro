import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Deck } from './Deck'
import { CrossFader } from './CrossFader'
import { CoverFlow } from './CoverFlow'
import { EffectsPanel } from './EffectsPanel'
import heroImage from '@/assets/dj-mixer-hero.png'
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
  filter: number
  cue: number
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
  gain: 50,
  filter: 50,
  cue: 0,
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

  // Cross-fader drives each deck's output volume.
  useEffect(() => {
    const { volumeA, volumeB } = computeCrossfaderVolumes(crossFaderValue)

    setDeckA((prev) => (prev.volume === volumeA ? prev : { ...prev, volume: volumeA }))
    setDeckB((prev) => (prev.volume === volumeB ? prev : { ...prev, volume: volumeB }))
  }, [crossFaderValue])

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track)
    if (activeDeck === 'A') {
      setDeckA((prev) => ({ ...prev, track, currentTime: 0 }))
    } else {
      setDeckB((prev) => ({ ...prev, track, currentTime: 0 }))
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
    setDeckA((prev) => (prev.track?.id === trackId ? { ...prev, track: null, isPlaying: false, currentTime: 0 } : prev))
    setDeckB((prev) => (prev.track?.id === trackId ? { ...prev, track: null, isPlaying: false, currentTime: 0 } : prev))
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
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <motion.div
        className="panel relative overflow-hidden p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute inset-0 opacity-10">
          <img src={heroImage} alt="DJ Mixer Interface" className="h-full w-full object-cover" />
        </div>
        <div className="relative z-10">
          <h1 className="music-title mb-2 text-center">DJ Mixer Pro</h1>
          <p className="text-center text-sm text-muted-foreground">
            Reproducción vía YouTube • Contenido sin modificar • Uso bajo Política de YouTube
          </p>
        </div>
      </motion.div>

      {/* Panel de efectos */}
      <EffectsPanel onEffectTrigger={handleEffectTrigger} />

      {/* Layout principal */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Deck A */}
        <div className="space-y-4">
          <Deck
            id="A"
            state={deckA}
            onStateChange={setDeckA}
            isActive={activeDeck === 'A'}
            onActivate={() => setActiveDeck('A')}
            onDurationResolved={handleDurationResolved}
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
          />
        </div>
      </div>
    </div>
  )
}
