import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { CoverFlow } from './CoverFlow'
import type { Track } from './DJMixer'

const tracks: Track[] = [
  { id: '1', title: 'Track One', artist: 'Artist One', youtubeId: 'aaaaaaaaaaa', duration: 125, thumbnail: 'a.jpg' },
  { id: '2', title: 'Track Two', artist: 'Artist Two', youtubeId: 'bbbbbbbbbbb', duration: 100, thumbnail: 'b.jpg' },
  { id: '3', title: 'Track Three', artist: 'Artist Three', youtubeId: 'ccccccccccc', duration: 100, thumbnail: 'c.jpg' },
]

function setup(overrides: Partial<ComponentProps<typeof CoverFlow>> = {}) {
  const onTrackSelect = vi.fn()
  const onAddTrack = vi.fn()
  const onRemoveTrack = vi.fn()
  render(
    <CoverFlow
      tracks={tracks}
      selectedTrack={null}
      activeDeck="A"
      onTrackSelect={onTrackSelect}
      onAddTrack={onAddTrack}
      onRemoveTrack={onRemoveTrack}
      {...overrides}
    />,
  )
  return { onTrackSelect, onAddTrack, onRemoveTrack }
}

describe('CoverFlow', () => {
  it('shows an empty-state prompt with only the add-track action when there are no tracks', () => {
    setup({ tracks: [] })
    expect(screen.getByText('Tu biblioteca está vacía')).toBeInTheDocument()
    expect(screen.getByText('Agregar pista')).toBeInTheDocument()
  })

  it('shows the front card active and the next cards visible behind it', () => {
    setup()
    expect(screen.getByText('Track One — Artist One')).toBeInTheDocument()
    // Side cards are rendered (visible), just not actionable yet.
    expect(screen.getByText('Track Two')).toBeInTheDocument()
    expect(screen.getByText('Track Three')).toBeInTheDocument()
  })

  it('only the front card shows the delete and "Cargar en Deck" actions', () => {
    setup()
    expect(screen.getByLabelText('Quitar "Track One" de la biblioteca')).toBeInTheDocument()
    expect(screen.queryByLabelText('Quitar "Track Two" de la biblioteca')).not.toBeInTheDocument()
    expect(screen.getByText('Cargar en Deck A')).toBeInTheDocument()
  })

  it('"Siguiente" moves the front card forward, and keeps working after a track is loaded', () => {
    setup()
    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText('Track Two — Artist Two')).toBeInTheDocument()

    // Regression check: selecting a track must not lock the carousel in place.
    fireEvent.click(screen.getByText('Cargar en Deck A'))
    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText('Track Three — Artist Three')).toBeInTheDocument()
  })

  it('"Anterior" is disabled on the first track and "Siguiente" on the last', () => {
    setup()
    expect(screen.getByLabelText('Anterior')).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Siguiente'))
    fireEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText('Track Three — Artist Three')).toBeInTheDocument()
    expect(screen.getByLabelText('Siguiente')).toBeDisabled()
  })

  it('clicking a side (non-active) card brings it to the front without loading it', () => {
    const { onTrackSelect } = setup()
    fireEvent.click(screen.getByText('Track Two'))
    expect(screen.getByText('Track Two — Artist Two')).toBeInTheDocument()
    expect(onTrackSelect).not.toHaveBeenCalled()
  })

  it('re-centers on an externally selected track (e.g. loaded by clicking a deck)', () => {
    setup({ selectedTrack: tracks[2] })
    expect(screen.getByText('Track Three — Artist Three')).toBeInTheDocument()
  })

  it('"Cargar en Deck X" assigns the front card to the active deck', () => {
    const { onTrackSelect } = setup({ activeDeck: 'B' })
    fireEvent.click(screen.getByText('Cargar en Deck B'))
    expect(onTrackSelect).toHaveBeenCalledWith(tracks[0])
  })

  it('the remove button removes the front card from the library', () => {
    const { onRemoveTrack } = setup()
    fireEvent.click(screen.getByLabelText('Quitar "Track One" de la biblioteca'))
    expect(onRemoveTrack).toHaveBeenCalledWith('1')
  })

  it('shows the front track duration formatted as m:ss', () => {
    setup()
    expect(screen.getByText(/Artist One · 2:05/)).toBeInTheDocument()
  })
})
