import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchVideoTags, resolveSuggestionQuery, searchSuggestedVideos } from './youtubeSuggestions'

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

describe('fetchVideoTags', () => {
  it('returns an empty array with no API key configured, without calling fetch', async () => {
    vi.stubEnv('VITE_YOUTUBE_API_KEY', '')
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await fetchVideoTags('vid-no-key')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns the video's tags from a successful response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ snippet: { tags: ['house', 'deep house', 'electronic', 'a fifth tag'] } }] }),
    }) as unknown as typeof fetch

    expect(await fetchVideoTags('vid-with-tags')).toEqual(['house', 'deep house', 'electronic', 'a fifth tag'])
  })

  it('returns an empty array when the video has no tags set', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ snippet: {} }] }),
    }) as unknown as typeof fetch

    expect(await fetchVideoTags('vid-no-tags')).toEqual([])
  })

  it('returns an empty array on a non-OK response instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    expect(await fetchVideoTags('vid-error')).toEqual([])
  })

  it('returns an empty array on a network error instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network blocked')) as unknown as typeof fetch
    expect(await fetchVideoTags('vid-network-error')).toEqual([])
  })

  it('caches tags per video id, so a repeated lookup does not call fetch again', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ snippet: { tags: ['tag'] } }] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchVideoTags('vid-cached')
    await fetchVideoTags('vid-cached')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('resolveSuggestionQuery', () => {
  it("joins up to the first 3 of the video's tags when it has some", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ snippet: { tags: ['house', 'deep house', 'electronic', 'unused fourth tag'] } }] }),
    }) as unknown as typeof fetch

    expect(await resolveSuggestionQuery('vid-tagged', 'Fallback Artist')).toBe('house deep house electronic')
  })

  it('falls back to the artist when the video has no tags', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ snippet: {} }] }),
    }) as unknown as typeof fetch

    expect(await resolveSuggestionQuery('vid-untagged', 'Fallback Artist')).toBe('Fallback Artist')
  })

  it('falls back to the artist when the tags lookup fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network blocked')) as unknown as typeof fetch
    expect(await resolveSuggestionQuery('vid-failed', 'Fallback Artist')).toBe('Fallback Artist')
  })
})
