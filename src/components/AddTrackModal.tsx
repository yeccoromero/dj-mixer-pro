import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { extractYouTubeId, isYouTubeShortsUrl } from '@/lib/youtubeId'
import { fetchYouTubeOembed } from '@/lib/youtubeOembed'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'
import { searchSuggestedVideos, type SuggestedVideo } from '@/lib/youtubeSuggestions'
import { cn } from '@/lib/utils'
import type { Track } from './DJMixer'

interface AddTrackModalProps {
  onAddTrack: (track: Track) => void
  /** YouTube ids already in the library, so a search result already added shows as gone
   * instead of offering to add a duplicate. Defaults to none for callers that don't track it
   * (the empty-library screen, which by definition has nothing to exclude). */
  existingTrackIds?: readonly string[]
}

export const AddTrackModal: React.FC<AddTrackModalProps> = ({ onAddTrack, existingTrackIds = [] }) => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'link' | 'search'>('link')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [duration, setDuration] = useState('180')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [checkingEmbed, setCheckingEmbed] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SuggestedVideo[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Switching into the Buscar tab should let you start typing immediately, not require an
  // extra click into the field first.
  useEffect(() => {
    if (mode === 'search') searchInputRef.current?.focus()
  }, [mode])

  const reset = () => {
    setMode('link')
    setUrl('')
    setTitle('')
    setArtist('')
    setDuration('180')
    setThumbnail(null)
    setError(null)
    setFetchingMeta(false)
    setCheckingEmbed(false)
    setSearchQuery('')
    setSearchResults([])
    setSearching(false)
    setSearched(false)
    setAddingId(null)
  }

  const handleUrlBlur = async () => {
    const youtubeId = extractYouTubeId(url)
    if (!youtubeId) return

    setFetchingMeta(true)
    const meta = await fetchYouTubeOembed(youtubeId)
    setFetchingMeta(false)
    if (!meta) return

    // Only auto-fill fields the user hasn't already typed something into.
    setTitle((prev) => (prev.trim() ? prev : meta.title))
    setArtist((prev) => (prev.trim() ? prev : meta.authorName))
    setThumbnail(meta.thumbnailUrl)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const youtubeId = extractYouTubeId(url)
    if (!youtubeId) {
      setError('Pega una URL o ID de YouTube válido')
      return
    }

    if (isYouTubeShortsUrl(url)) {
      setError(
        'Los YouTube Shorts no se pueden mostrar limpios: YouTube les agrega su propia interfaz ' +
          '(título, avatar, compartir, subtítulos) que no se puede quitar. Buscá el video en su ' +
          'versión larga y pegá ese link.',
      )
      return
    }

    setError(null)
    setCheckingEmbed(true)
    const check = await checkVideoEmbeddable(youtubeId)
    setCheckingEmbed(false)

    if (!check.playable) {
      setError(check.reason ?? 'Este video no se puede reproducir aquí')
      return
    }

    onAddTrack({
      id: `${youtubeId}-${Date.now()}`,
      title: title.trim() || 'Pista sin título',
      artist: artist.trim() || 'Artista desconocido',
      youtubeId,
      duration: Number(duration) || 180,
      thumbnail: thumbnail ?? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    })

    reset()
    setOpen(false)
  }

  // Explicit submit (button click or Enter), not search-as-you-type: each search costs 100 of
  // the ~10,000 daily quota units, so firing one per keystroke would burn through it in a
  // single query typed out.
  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    setError(null)
    setSearching(true)
    const results = await searchSuggestedVideos(trimmed, existingTrackIds)
    setSearchResults(results)
    setSearching(false)
    setSearched(true)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setSearched(false)
    setError(null)
    searchInputRef.current?.focus()
  }

  const handleAddFromSearch = async (video: SuggestedVideo) => {
    setAddingId(video.youtubeId)
    setError(null)
    const check = await checkVideoEmbeddable(video.youtubeId)
    setAddingId(null)

    if (!check.playable) {
      setError(`"${video.title}" no se puede reproducir aquí: ${check.reason ?? 'video bloqueado'}`)
      return
    }

    // oxlint's purity check misflags this as running during render (it only runs when a
    // result's "+" is clicked, same event-handler shape as the identical pattern in
    // SuggestedTracks.tsx's handleAdd, which the same rule does not flag).
    // eslint-disable-next-line react/purity
    const id = `${video.youtubeId}-${Date.now()}`
    onAddTrack({
      id,
      title: video.title,
      artist: video.channelTitle,
      youtubeId: video.youtubeId,
      duration: 180,
      thumbnail: video.thumbnail,
    })
  }

  // Results already added (in existingTrackIds) drop out instead of offering a duplicate —
  // the same pattern SuggestedTracks uses, so a track just added visibly disappears from the
  // list as confirmation, without needing to re-run the search.
  const visibleSearchResults = searchResults.filter((video) => !existingTrackIds.includes(video.youtubeId))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Agregar pista
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar pista de YouTube</DialogTitle>
          <DialogDescription>
            {mode === 'link'
              ? 'Pega el enlace de un video de YouTube para añadirlo a la biblioteca.'
              : 'Buscá por título, artista o palabra clave sin salir de la app.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('link')}
              className={cn(
                'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                mode === 'link' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => setMode('search')}
              className={cn(
                'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                mode === 'search' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              Buscar
            </button>
          </div>

        {mode === 'search' ? (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Título, artista, remix..."
                  aria-label="Buscar en YouTube"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="outline" className="gap-2" disabled={searching || !searchQuery.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </form>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {searched && !searching && visibleSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin resultados (o falta configurar la API de búsqueda — ver .env.example).
              </p>
            )}

            {searched && !searching && visibleSearchResults.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {visibleSearchResults.length} resultado{visibleSearchResults.length === 1 ? '' : 's'}
              </p>
            )}

            <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto pr-1">
              {visibleSearchResults.map((video) => (
                <div key={video.youtubeId} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                  <div className="relative aspect-video w-full overflow-hidden bg-black/10">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFromSearch(video)}
                      disabled={addingId === video.youtubeId}
                      title={`Agregar "${video.title}" a la biblioteca`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-lime-accent text-black shadow disabled:opacity-60"
                    >
                      {addingId === video.youtubeId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-medium leading-snug">{video.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{video.channelTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="track-url">URL o ID de YouTube</Label>
            <div className="relative">
              <input
                id="track-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-10 w-full rounded-md border border-border bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {fetchingMeta && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Al salir del campo, intentamos completar título y artista automáticamente desde YouTube.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="track-title">Título</Label>
              <input
                id="track-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="track-artist">Artista</Label>
              <input
                id="track-artist"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="track-duration">Duración (segundos)</Label>
            <input
              id="track-duration"
              type="number"
              min={1}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="lime" className="mt-2 gap-2" disabled={checkingEmbed}>
            {checkingEmbed && <Loader2 className="h-4 w-4 animate-spin" />}
            {checkingEmbed ? 'Verificando que se pueda reproducir…' : 'Añadir a la biblioteca'}
          </Button>
        </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
