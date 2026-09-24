export interface SuggestedVideo {
  youtubeId: string
  title: string
  channelTitle: string
  thumbnail: string
}

const SEARCH_TIMEOUT_MS = 8000
const MAX_RESULTS = 8
const MAX_TAGS_IN_QUERY = 3

// Searching the same artist twice in one session (e.g. browsing back and forth in the
// library) shouldn't spend quota twice — the free tier is only ~100 searches/day.
const cache = new Map<string, SuggestedVideo[]>()
// Keyed by video id — cheap to keep separately from the search cache since a `videos.list`
// call (1 unit) is two orders of magnitude cheaper than a `search.list` call (100 units).
const tagsCache = new Map<string, string[]>()

/**
 * Fetches the uploader-set tags (genre/style keywords, not shown anywhere in YouTube's own UI)
 * for a video, used to build a suggestion query that reflects the track's actual style instead
 * of just its artist — see `resolveSuggestionQuery` below. Same graceful-failure contract as
 * `searchSuggestedVideos`: no key, no tags set on the video, or any failure all resolve to `[]`
 * rather than throwing.
 */
export async function fetchVideoTags(videoId: string): Promise<string[]> {
  const cached = tagsCache.get(videoId)
  if (cached) return cached

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  if (!apiKey) return []

  const params = new URLSearchParams({ part: 'snippet', id: videoId, key: apiKey })
  const endpoint = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) return []

    const data = (await response.json()) as { items?: { snippet?: { tags?: string[] } }[] }
    const tags = data.items?.[0]?.snippet?.tags ?? []
    tagsCache.set(videoId, tags)
    return tags
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Builds the query `searchSuggestedVideos` should search for, given the active track. Tags
 * describe the track's actual style (genre, mood, scene) and surface suggestions across
 * different artists — a real "goes with this song" signal, instead of "more uploads from this
 * one channel". Falls back to searching by `fallbackArtist` when the video has no tags set
 * (common for amateur uploads) or the tags lookup fails for any reason.
 */
export async function resolveSuggestionQuery(youtubeId: string, fallbackArtist: string): Promise<string> {
  const tags = await fetchVideoTags(youtubeId)
  return tags.length > 0 ? tags.slice(0, MAX_TAGS_IN_QUERY).join(' ') : fallbackArtist
}

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
