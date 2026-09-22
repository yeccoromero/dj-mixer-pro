import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchYouTubeOembed } from './youtubeOembed'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchYouTubeOembed', () => {
  it('returns the title, channel name and thumbnail on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Never Gonna Give You Up',
        author_name: 'Rick Astley',
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      }),
    }) as unknown as typeof fetch

    const result = await fetchYouTubeOembed('dQw4w9WgXcQ')

    expect(result).toEqual({
      title: 'Never Gonna Give You Up',
      authorName: 'Rick Astley',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    })
  })

  it('queries the public oEmbed endpoint for the given video id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'X', author_name: 'Y' }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchYouTubeOembed('dQw4w9WgXcQ')

    const [calledUrl] = fetchMock.mock.calls[0]
    expect(calledUrl).toContain('youtube.com/oembed')
    expect(calledUrl).toContain('dQw4w9WgXcQ')
  })

  it('falls back to a generated thumbnail when the response omits one', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'X', author_name: 'Y' }),
    }) as unknown as typeof fetch

    const result = await fetchYouTubeOembed('dQw4w9WgXcQ')
    expect(result?.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('returns null when the video is not embeddable/found (non-OK response)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    expect(await fetchYouTubeOembed('dQw4w9WgXcQ')).toBeNull()
  })

  it('returns null instead of throwing on a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network blocked')) as unknown as typeof fetch
    expect(await fetchYouTubeOembed('dQw4w9WgXcQ')).toBeNull()
  })

  it('returns null when the response has no title', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch
    expect(await fetchYouTubeOembed('dQw4w9WgXcQ')).toBeNull()
  })
})
