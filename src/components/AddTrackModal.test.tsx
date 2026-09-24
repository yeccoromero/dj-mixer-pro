import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AddTrackModal } from './AddTrackModal'

vi.mock('@/lib/youtubeOembed', () => ({
  fetchYouTubeOembed: vi.fn(),
}))

vi.mock('@/lib/youtubeEmbedCheck', () => ({
  checkVideoEmbeddable: vi.fn(),
}))

vi.mock('@/lib/youtubeSuggestions', () => ({
  searchSuggestedVideos: vi.fn(),
}))

import { fetchYouTubeOembed } from '@/lib/youtubeOembed'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'
import { searchSuggestedVideos } from '@/lib/youtubeSuggestions'

const searchResult = {
  youtubeId: 'ccccccccccc',
  title: 'A Search Result',
  channelTitle: 'Some Channel',
  thumbnail: 'c.jpg',
}

describe('AddTrackModal', () => {
  beforeEach(() => {
    vi.mocked(fetchYouTubeOembed).mockReset().mockResolvedValue(null)
    vi.mocked(checkVideoEmbeddable).mockReset().mockResolvedValue({ playable: true })
    vi.mocked(searchSuggestedVideos).mockReset().mockResolvedValue([])
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

  it('blocks a /shorts/ link — YouTube forces its own overlay on Shorts that cannot be stripped', async () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    expect(screen.getByText(/Los YouTube Shorts no se pueden mostrar limpios/)).toBeInTheDocument()
    expect(onAddTrack).not.toHaveBeenCalled()
    // Never even reaches the embeddability check — Shorts fail for a different reason.
    expect(checkVideoEmbeddable).not.toHaveBeenCalled()
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

  describe('search tab', () => {
    it('searches on submit and lets you add a result', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([searchResult])
      const onAddTrack = vi.fn()
      render(<AddTrackModal onAddTrack={onAddTrack} existingTrackIds={['some-other-id']} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.change(screen.getByLabelText('Buscar en YouTube'), { target: { value: 'deep house mix' } })
      fireEvent.submit(screen.getByLabelText('Buscar en YouTube').closest('form')!)

      await waitFor(() => expect(searchSuggestedVideos).toHaveBeenCalledWith('deep house mix', ['some-other-id']))
      expect(await screen.findByText('A Search Result')).toBeInTheDocument()

      fireEvent.click(screen.getByTitle('Agregar "A Search Result" a la biblioteca'))
      await waitFor(() => expect(onAddTrack).toHaveBeenCalledTimes(1))
      expect(checkVideoEmbeddable).toHaveBeenCalledWith('ccccccccccc')
      const track = onAddTrack.mock.calls[0][0]
      expect(track.youtubeId).toBe('ccccccccccc')
      expect(track.title).toBe('A Search Result')
      expect(track.artist).toBe('Some Channel')
    })

    it('does not search on an empty query', () => {
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.submit(screen.getByLabelText('Buscar en YouTube').closest('form')!)

      expect(searchSuggestedVideos).not.toHaveBeenCalled()
    })

    it('blocks adding a search result that is not embeddable, showing why', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([searchResult])
      vi.mocked(checkVideoEmbeddable).mockResolvedValue({ playable: false, reason: 'bloqueado por el sello' })
      const onAddTrack = vi.fn()
      render(<AddTrackModal onAddTrack={onAddTrack} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.change(screen.getByLabelText('Buscar en YouTube'), { target: { value: 'blocked track' } })
      fireEvent.submit(screen.getByLabelText('Buscar en YouTube').closest('form')!)
      await screen.findByText('A Search Result')

      fireEvent.click(screen.getByTitle('Agregar "A Search Result" a la biblioteca'))
      await waitFor(() => expect(screen.getByText(/bloqueado por el sello/)).toBeInTheDocument())
      expect(onAddTrack).not.toHaveBeenCalled()
    })

    it('a result already in the library (existingTrackIds) does not render', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([searchResult])
      render(<AddTrackModal onAddTrack={vi.fn()} existingTrackIds={[searchResult.youtubeId]} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.change(screen.getByLabelText('Buscar en YouTube'), { target: { value: 'anything' } })
      fireEvent.submit(screen.getByLabelText('Buscar en YouTube').closest('form')!)

      await waitFor(() => expect(searchSuggestedVideos).toHaveBeenCalled())
      expect(screen.queryByText('A Search Result')).not.toBeInTheDocument()
    })

    it('shows a message when the search returns nothing', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([])
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.change(screen.getByLabelText('Buscar en YouTube'), { target: { value: 'nothing found' } })
      fireEvent.submit(screen.getByLabelText('Buscar en YouTube').closest('form')!)

      await waitFor(() => expect(screen.getByText(/Sin resultados/)).toBeInTheDocument())
    })

    it('focuses the search field when switching into the Buscar tab', () => {
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))

      expect(screen.getByLabelText('Buscar en YouTube')).toHaveFocus()
    })

    it('the clear button resets the query and results, and refocuses the field', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([searchResult])
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      const field = screen.getByLabelText('Buscar en YouTube')
      fireEvent.change(field, { target: { value: 'deep house mix' } })
      fireEvent.submit(field.closest('form')!)
      await screen.findByText('A Search Result')

      fireEvent.click(screen.getByLabelText('Limpiar búsqueda'))

      expect(field).toHaveValue('')
      expect(field).toHaveFocus()
      expect(screen.queryByText('A Search Result')).not.toBeInTheDocument()
    })

    it('the clear button only shows once there is something typed', () => {
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))

      expect(screen.queryByLabelText('Limpiar búsqueda')).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Buscar en YouTube'), { target: { value: 'a' } })
      expect(screen.getByLabelText('Limpiar búsqueda')).toBeInTheDocument()
    })

    it('shows a result count once the search resolves', async () => {
      vi.mocked(searchSuggestedVideos).mockResolvedValue([searchResult])
      render(<AddTrackModal onAddTrack={vi.fn()} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      const field = screen.getByLabelText('Buscar en YouTube')
      fireEvent.change(field, { target: { value: 'deep house mix' } })
      fireEvent.submit(field.closest('form')!)

      expect(await screen.findByText('1 resultado')).toBeInTheDocument()
    })

    it('switching back to the Link tab keeps the link form working as before', async () => {
      const onAddTrack = vi.fn()
      render(<AddTrackModal onAddTrack={onAddTrack} />)

      fireEvent.click(screen.getByText('Agregar pista'))
      fireEvent.click(screen.getByText('Buscar'))
      fireEvent.click(screen.getByText('Link'))
      fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      })
      fireEvent.click(screen.getByText('Añadir a la biblioteca'))

      await waitFor(() => expect(onAddTrack).toHaveBeenCalledTimes(1))
    })
  })
})
