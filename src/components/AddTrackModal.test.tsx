import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddTrackModal } from './AddTrackModal'

describe('AddTrackModal', () => {
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
  })

  it('adds a well-formed track and resets the form', () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi pista' } })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    expect(onAddTrack).toHaveBeenCalledTimes(1)
    const track = onAddTrack.mock.calls[0][0]
    expect(track.youtubeId).toBe('dQw4w9WgXcQ')
    expect(track.title).toBe('Mi pista')
    expect(track.thumbnail).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('falls back to placeholder title/artist when left blank', () => {
    const onAddTrack = vi.fn()
    render(<AddTrackModal onAddTrack={onAddTrack} />)

    fireEvent.click(screen.getByText('Agregar pista'))
    fireEvent.change(screen.getByLabelText('URL o ID de YouTube'), {
      target: { value: 'dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByText('Añadir a la biblioteca'))

    const track = onAddTrack.mock.calls[0][0]
    expect(track.title).toBe('Pista sin título')
    expect(track.artist).toBe('Artista desconocido')
  })
})
