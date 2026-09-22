export interface YouTubeOembedResult {
  title: string
  authorName: string
  thumbnailUrl: string
}

/**
 * Looks up a video's real title, channel name and thumbnail from YouTube's public
 * oEmbed endpoint — no API key required, and it's CORS-open for browser fetches.
 * Returns null on any failure (network blocked, private/deleted video, timeout) so
 * callers can fall back to manual entry instead of blocking the form.
 */
export async function fetchYouTubeOembed(youtubeId: string): Promise<YouTubeOembedResult | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) return null

    const data = (await response.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    if (!data.title) return null

    return {
      title: data.title,
      authorName: data.author_name ?? 'Artista desconocido',
      thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
