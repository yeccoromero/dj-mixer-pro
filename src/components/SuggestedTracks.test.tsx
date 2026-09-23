import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SuggestedTracks } from './SuggestedTracks'
import type { Track } from './DJMixer'

vi.mock('@/lib/youtubeSuggestions', () => ({
  searchSuggestedVideos: vi.fn(),
}))
vi.mock('@/lib/youtubeEmbedCheck', () => ({
  checkVideoEmbeddable: vi.fn(),
}))

import { searchSuggestedVideos } from '@/lib/youtubeSuggestions'
import { checkVideoEmbeddable } from '@/lib/youtubeEmbedCheck'

const track: Track = {
  id: 't1',
  title: 'Some Song',
  artist: 'Some Artist',
  youtubeId: 'aaaaaaaaaaa',
  duration: 200,
  thumbnail: 'a.jpg',
}

const video = {
  youtubeId: 'bbbbbbbbbbb',
  title: 'A Remix',
  channelTitle: 'Some Artist',
  thumbnail: 'b.jpg',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Fake timers + Promise-based mocks (searchSuggestedVideos/checkVideoEmbeddable) don't mix
// well with testing-library's own findBy*/waitFor, which poll via real setTimeout under the
// hood and hang forever once timers are faked. Advancing the debounce timer synchronously
// resolves the mocked promise's microtask, but React doesn't flush that into the DOM until
// the event loop gets a turn — awaiting a couple of resolved promises inside `act` gives it
// that turn, after which a plain synchronous `getByText` query works fine.
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('SuggestedTracks', () => {
  it('renders nothing when there is no active track', () => {
    const { container } = render(<SuggestedTracks basedOn={null} existingTrackIds={[]} onAddTrack={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('searches by the active track artist, debounced, and renders the results', async () => {
    vi.mocked(searchSuggestedVideos).mockResolvedValue([video])
    render(<SuggestedTracks basedOn={track} existingTrackIds={[]} onAddTrack={vi.fn()} />)

    expect(searchSuggestedVideos).not.toHaveBeenCalled() // still debouncing
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushMicrotasks()

    expect(searchSuggestedVideos).toHaveBeenCalledWith('Some Artist', [])
    expect(screen.getByText('A Remix')).toBeInTheDocument()
    expect(screen.getByText('Sugeridos de Some Artist')).toBeInTheDocument()
  })

  it('renders nothing once the search resolves with no results', async () => {
    vi.mocked(searchSuggestedVideos).mockResolvedValue([])
    const { container } = render(<SuggestedTracks basedOn={track} existingTrackIds={[]} onAddTrack={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushMicrotasks()

    expect(container).toBeEmptyDOMElement()
  })

  it('adding a suggestion checks embeddability first, then hands a Track to onAddTrack', async () => {
    vi.mocked(searchSuggestedVideos).mockResolvedValue([video])
    vi.mocked(checkVideoEmbeddable).mockResolvedValue({ playable: true })
    const onAddTrack = vi.fn()
    render(<SuggestedTracks basedOn={track} existingTrackIds={[]} onAddTrack={onAddTrack} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushMicrotasks()

    fireEvent.click(screen.getByTitle('Agregar "A Remix" a la biblioteca'))
    await flushMicrotasks()

    expect(checkVideoEmbeddable).toHaveBeenCalledWith('bbbbbbbbbbb')
    expect(onAddTrack).toHaveBeenCalledTimes(1)
    const added = onAddTrack.mock.calls[0][0] as Track
    expect(added.youtubeId).toBe('bbbbbbbbbbb')
    expect(added.title).toBe('A Remix')
    expect(added.artist).toBe('Some Artist')
  })

  it('does not add a suggestion that turns out not to be embeddable', async () => {
    vi.mocked(searchSuggestedVideos).mockResolvedValue([video])
    vi.mocked(checkVideoEmbeddable).mockResolvedValue({ playable: false, reason: 'blocked' })
    const onAddTrack = vi.fn()
    render(<SuggestedTracks basedOn={track} existingTrackIds={[]} onAddTrack={onAddTrack} />)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushMicrotasks()

    fireEvent.click(screen.getByTitle('Agregar "A Remix" a la biblioteca'))
    await flushMicrotasks()

    expect(checkVideoEmbeddable).toHaveBeenCalled()
    expect(onAddTrack).not.toHaveBeenCalled()
  })

  it('excludes suggestions already in the library from what is shown', async () => {
    vi.mocked(searchSuggestedVideos).mockResolvedValue([video])
    const { container } = render(
      <SuggestedTracks basedOn={track} existingTrackIds={[video.youtubeId]} onAddTrack={vi.fn()} />,
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushMicrotasks()

    expect(container).toBeEmptyDOMElement()
  })
})
