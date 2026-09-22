import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AddTrackModal } from './AddTrackModal'

vi.mock('@/lib/youtubeOembed', () => ({
  fetchYouTubeOembed: vi.fn(),
}))

vi.mock('@/lib/youtubeEmbedCheck', () => ({
  checkVideoEmbeddable: vi.fn(),
}))

import { fetchYouTubeOembed } from '@/lib/youtubeOembed'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'

describe('AddTrackModal', () => {
  beforeEach(() => {
    vi.mocked(fetchYouTubeOembed).mockReset().mockResolvedValue(null)
    vi.mocked(checkVideoEmbeddable).mockReset().mockResolvedValue({ playable: true })
  })

  it('shows a validation error and does not call onAddTrack for an invalid link', () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'esto-no-es-un-link' },
    })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    expect(screen.getByText('Pega una URL o ID de YouTube válido')).toBeInTheDocument()
    expect(onAddTrack).not.toHaveBeenCalled()
    expect(checkVideoEmbeddable).not.toHaveBeenCalled()
  })

  it('adds a well-formed, playable track and resets the form', async () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi pista' } })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    await waitFor(() => expect(onAddTrack).toHaveBeenCalledTimes(1))
    expect(checkVideoEmbeddable).toHaveBeenCalledWith('dQw4w9WgXcQ')
    const track = onAddTrack.mock.calls[0][0]
    expect(track.youtubeId).toBe('dQw4w9WgXcQ')
    expect(track.title).toBe('Mi pista')
    expect(track.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('falls back to placeholder title/artist when left blank', async () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    await waitFor(() => expect(onAddTrack).toHaveBeenCalledTimes(1))
    const track = onAddTrack.mock.calls[0][0]
    expect(track.title).toBe('Pista sin título')
    expect(track.artist).toBe('Artista desconocido')
  })

  it('blocks adding a track that is not embeddable, and shows why', async () => {
    vi.mocked(checkVideoEmbeddable).mockResolvedValue({
      playable: false,
      reason: 'El dueño del video bloqueó su reproducción fuera de YouTube',
    })
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    await waitFor(() =>
      expect(screen.getByText('El dueño del video bloqueó su reproducción fuera de YouTube')).toBeInTheDocument(),
    )
    expect(onAddTrack).not.toHaveBeenCalled()
    // The modal stays open with the form intact so the user can try another link.
    expect(screen.getByLabelText('URL o ID de YouTube')).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('auto-fills title/artist from YouTube oEmbed when the URL field loses focus', async () => {
    vi.mocked(fetchYouTubeOembed).mockResolvedValue({
      title: 'Never Gonna Give You Up',
      authorName: 'Rick Astley',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    })
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    const urlField = screen.getByLabelText('URL o ID de YouTube')
    fireEvent.change(urlField, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    fireEvent.blur(urlField)

    await waitFor(() => {
      expect(screen.getByLabelText('Título')).toHaveValue('Never Gonna Give You Up')
    })
    expect(screen.getByLabelText('Artista')).toHaveValue('Rick Astley')

    fireEvent.click(screen.getByText('Añadir a la biblioteca'))
    await waitFor(() => expect(onAddTrack).toHaveBeenCalledTimes(1))
    const track = onAddTrack.mock.calls[0][0]
    expect(track.thumbnail).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('does not overwrite a title the user already typed themselves', async () => {
    vi.mocked(fetchYouTubeOembed).mockResolvedValue({
      title: 'Never Gonna Give You Up',
      authorName: 'Rick Astley',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    })
    render(<AddTrackModal onAddTrack={vi.fn()} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi título propio' } })
    const urlField = screen.getByLabelText('URL o ID de YouTube')
    fireEvent.change(urlField, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    fireEvent.blur(urlField)

    await waitFor(() => expect(fetchYouTubeOembed).toHaveBeenCalled())
    expect(screen.getByLabelText('Título')).toHaveValue('Mi título propio')
  })

  it('leaves the form untouched when oEmbed lookup fails (e.g. offline)', async () => {
    vi.mocked(fetchYouTubeOembed).mockResolvedValue(null)
    render(<AddTrackModal onAddTrack={vi.fn()} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    const urlField = screen.getByLabelText('URL o ID de YouTube')
    fireEvent.change(urlField, { target: { value: 'dQw4w9WgXcQ' } })
    fireEvent.blur(urlField)

    await waitFor(() => expect(fetchYouTubeOembed).toHaveBeenCalled())
    expect(screen.getByLabelText('Título')).toHaveValue('')
  })
})
