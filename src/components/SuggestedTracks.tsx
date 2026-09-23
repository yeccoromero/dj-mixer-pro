import React, { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import type { Track } from './DJMixer'
import { searchSuggestedVideos, type SuggestedVideo } from '@/lib/youtubeSuggestions'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'

interface SuggestedTracksProps {
  /** The library track suggestions are based on — in practice, whichever card is centered
   * in the CoverFlow carousel. Its artist is the search query: "more from this artist" is a
   * more honest "goes with this song" signal than a generic keyword search, and it doubles
   * as a natural rate limiter (browsing settles on one artist rather than firing a distinct
   * query per keystroke). */
  basedOn: Track | null
  existingTrackIds: readonly string[]
  onAddTrack: (track: Track) => void
}

// Flipping through the library with the arrows/swipe changes `basedOn` rapidly — debouncing
// means that settles into one search instead of firing one per card passed through, which
// matters when the free API quota is only ~100 searches/day.
const SEARCH_DEBOUNCE_MS = 500

export const SuggestedTracks: React.FC<SuggestedTracksProps> = ({ basedOn, existingTrackIds, onAddTrack }) => {
  const [suggestions, setSuggestions] = useState<SuggestedVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!basedOn) {
      setSuggestions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      void searchSuggestedVideos(basedOn.artist, existingTrackIds).then((results) => {
        setSuggestions(results)
        setLoading(false)
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // existingTrackIds intentionally excluded: it changes on every add/remove anywhere in the
    // library, and re-searching for that alone would waste quota — the already-fetched list is
    // filtered against it directly below instead, which is enough to hide a track once added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basedOn?.artist])

  // With no API key configured, or nothing found, or the search still resolving before ever
  // returning anything — there's nothing worth taking up space for in either case.
  const visible = suggestions.filter((video) => !existingTrackIds.includes(video.youtubeId))
  if (!basedOn || (!loading && visible.length === 0)) return null

  const handleAdd = async (video: SuggestedVideo) => {
    setAddingId(video.youtubeId)
    const check = await checkVideoEmbeddable(video.youtubeId)
    setAddingId(null)
    if (!check.playable) return

    onAddTrack({
      id: `${video.youtubeId}-${Date.now()}`,
      title: video.title,
      artist: video.channelTitle,
      youtubeId: video.youtubeId,
      duration: 180,
      thumbnail: video.thumbnail,
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Sugeridos de {basedOn.artist}</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {loading && visible.length === 0 && (
          <div className="flex h-16 w-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {visible.map((video) => (
          <div key={video.youtubeId} className="flex w-24 shrink-0 flex-col gap-1">
            <div className="relative overflow-hidden rounded-lg bg-black/10">
              <img src={video.thumbnail} alt={video.title} className="h-16 w-24 object-cover" draggable={false} />
              <button
                type="button"
                onClick={() => handleAdd(video)}
                disabled={addingId === video.youtubeId}
                title={`Agregar "${video.title}" a la biblioteca`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-black shadow disabled:opacity-60"
              >
                {addingId === video.youtubeId ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </button>
            </div>
            <p className="truncate text-[10px] font-medium">{video.title}</p>
            <p className="truncate text-[9px] text-muted-foreground">{video.channelTitle}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
