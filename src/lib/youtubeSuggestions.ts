export interface SuggestedVideo {
  youtubeId: string
  title: string
  channelTitle: string
  thumbnail: string
}

const SEARCH_TIMEOUT_MS = 8000
const MAX_RESULTS = 8

// Searching the same artist twice in one session (e.g. browsing back and forth in the
// library) shouldn't spend quota twice — the free tier is only ~100 searches/day.
const cache = new Map<string, SuggestedVideo[]>()

/**
 * Searches YouTube for videos related to `query` (in practice, the active library track's
 * artist — "more like this artist" is a more honest "goes with this song" signal than a
 * generic text search, and cheaper to reason about). Needs `VITE_YOUTUBE_API_KEY` — with no
 * key configured, or on any failure (quota exceeded, network, invalid key), this resolves to
 * an empty array rather than throwing, so the suggestions panel can just render nothing
 * instead of surfacing an error for what's a non-essential feature.
 */
export async function searchSuggestedVideos(query: string, excludeIds: readonly string[] = []): Promise<SuggestedVideo[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const cached = cache.get(trimmed)
  if (cached) return cached.filter((video) => !excludeIds.includes(video.youtubeId))

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  if (!apiKey) return []

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: String(MAX_RESULTS),
    q: trimmed,
    key: apiKey,
  })
  const endpoint = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) return []

    const data = (await response.json()) as {
      items?: {
        id?: { videoId?: string }
        snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }
      }[]
    }

    const results: SuggestedVideo[] = (data.items ?? [])
      .map((item) => {
        const youtubeId = item.id?.videoId
        const title = item.snippet?.title
        if (!youtubeId || !title) return null
        return {
          youtubeId,
          title,
          channelTitle: item.snippet?.channelTitle ?? 'Canal desconocido',
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        }
      })
      .filter((video): video is SuggestedVideo => video !== null)

    cache.set(trimmed, results)
    return results.filter((video) => !excludeIds.includes(video.youtubeId))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}
