import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CoverFlow } from './CoverFlow'
import type { Track } from './DJMixer'

const tracks: Track[] = [
  { id: '1', title: 'Track One', artist: 'Artist One', youtubeId: 'aaaaaaaaaaa', duration: 100, thumbnail: 'a.jpg' },
  { id: '2', title: 'Track Two', artist: 'Artist Two', youtubeId: 'bbbbbbbbbbb', duration: 100, thumbnail: 'b.jpg' },
  { id: '3', title: 'Track Three', artist: 'Artist Three', youtubeId: 'ccccccccccc', duration: 100, thumbnail: 'c.jpg' },
]

describe('CoverFlow', () => {
  it('shows an empty-state prompt with only the add-track action when there are no tracks', () => {
    render(<CoverFlow tracks={[]} selectedTrack={null} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    expect(screen.getByText('Tu biblioteca está vacía')).toBeInTheDocument()
    expect(screen.getByText('Agregar pista')).toBeInTheDocument()
  })

  it('shows the first track as active by default', () => {
    render(<CoverFlow tracks={tracks} selectedTrack={null} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    expect(screen.getByText(/Track One — Artist One/)).toBeInTheDocument()
  })

  it('"Siguiente" moves the active track forward', () => {
    render(<CoverFlow tracks={tracks} selectedTrack={null} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText(/Track Two — Artist Two/)).toBeInTheDocument()
  })

  it('"Anterior" does not move before the first track', () => {
    render(<CoverFlow tracks={tracks} selectedTrack={null} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Anterior'))
    expect(screen.getByText(/Track One — Artist One/)).toBeInTheDocument()
  })

  it('"Siguiente" does not move past the last track', () => {
    render(<CoverFlow tracks={tracks} selectedTrack={tracks[2]} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText(/Track Three — Artist Three/)).toBeInTheDocument()
  })

  it('clicking a track thumbnail selects it', () => {
    const onTrackSelect = vi.fn()
    render(<CoverFlow tracks={tracks} selectedTrack={null} onTrackSelect={onTrackSelect} onAddTrack={vi.fn()} />)
    fireEvent.click(screen.getByAltText('Track Two'))
    expect(onTrackSelect).toHaveBeenCalledWith(tracks[1])
  })

  it('reflects an externally selected track (e.g. set by a deck) as the active one', () => {
    render(<CoverFlow tracks={tracks} selectedTrack={tracks[2]} onTrackSelect={vi.fn()} onAddTrack={vi.fn()} />)
    expect(screen.getByText(/Track Three — Artist Three/)).toBeInTheDocument()
  })
})
