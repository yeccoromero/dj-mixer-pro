import React, { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
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
import { extractYouTubeId } from '@/lib/youtubeId'
import { fetchYouTubeOembed } from '@/lib/youtubeOembed'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'
import type { Track } from './DJMixer'

interface AddTrackModalProps {
  onAddTrack: (track: Track) => void
}

export const AddTrackModal: React.FC<AddTrackModalProps> = ({ onAddTrack }) => {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [duration, setDuration] = useState('180')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  const [checkingEmbed, setCheckingEmbed] = useState(false)

  const reset = () => {
    setUrl('')
    setTitle('')
    setArtist('')
    setDuration('180')
    setThumbnail(null)
    setError(null)
    setFetchingMeta(false)
    setCheckingEmbed(false)
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
            Pega el enlace de un video de YouTube para añadirlo a la biblioteca.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
      </DialogContent>
    </Dialog>
  )
}
