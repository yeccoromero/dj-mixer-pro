import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchSuggestedVideos } from './youtubeSuggestions'

const originalFetch = globalThis.fetch

function mockSearchResponse(items: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items }),
  }) as unknown as typeof fetch
}

const sampleItem = {
  id: { videoId: 'abc12345678' },
  snippet: {
    title: 'Some Remix',
    channelTitle: 'Some Artist',
    thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc12345678/mqdefault.jpg' } },
  },
}

beforeEach(() => {
  vi.stubEnv('VITE_YOUTUBE_API_KEY', 'test-key')
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('searchSuggestedVideos', () => {
  it('returns an empty array with no API key configured, without calling fetch', async () => {
    vi.stubEnv('VITE_YOUTUBE_API_KEY', '')
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await searchSuggestedVideos('Some Artist')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty array for a blank query', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await searchSuggestedVideos('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a successful response into SuggestedVideo entries', async () => {
    mockSearchResponse([sampleItem])

    const results = await searchSuggestedVideos('Some Artist')

    expect(results).toEqual([
      {
        youtubeId: 'abc12345678',
        title: 'Some Remix',
        channelTitle: 'Some Artist',
        thumbnail: 'https://i.ytimg.com/vi/abc12345678/mqdefault.jpg',
      },
    ])
  })

  it('falls back to a generated thumbnail when none is in the response', async () => {
    mockSearchResponse([{ id: { videoId: 'abc12345678' }, snippet: { title: 'X', channelTitle: 'Y' } }])
    const [result] = await searchSuggestedVideos('query')
    expect(result.thumbnail).toBe('https://img.youtube.com/vi/abc12345678/hqdefault.jpg')
  })

  it('skips items missing a video id or a title instead of crashing', async () => {
    mockSearchResponse([{ id: {}, snippet: { title: 'No id' } }, { id: { videoId: 'xyz98765432' }, snippet: {} }, sampleItem])
    const results = await searchSuggestedVideos('query')
    expect(results).toHaveLength(1)
    expect(results[0].youtubeId).toBe('abc12345678')
  })

  it('excludes ids already in the library', async () => {
    mockSearchResponse([sampleItem])
    expect(await searchSuggestedVideos('Some Artist 2', ['abc12345678'])).toEqual([])
  })

  it('returns an empty array on a non-OK response instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    expect(await searchSuggestedVideos('quota exceeded query')).toEqual([])
  })

  it('returns an empty array on a network error instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network blocked')) as unknown as typeof fetch
    expect(await searchSuggestedVideos('network error query')).toEqual([])
  })

  it('caches results per query, so a repeated search does not call fetch again', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [sampleItem] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await searchSuggestedVideos('cached artist')
    await searchSuggestedVideos('cached artist')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
