const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/

/**
 * Extracts and validates an 11-character YouTube video ID from a raw ID,
 * a full watch/share URL, or a shortened youtu.be / shorts URL. Returns
 * null for anything that doesn't resolve to a well-formed ID, so callers
 * never pass unvalidated input into the IFrame API or an image URL.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  let candidate: string | null = null
  if (url.hostname.includes('youtu.be')) {
    candidate = url.pathname.slice(1)
  } else {
    const fromQuery = url.searchParams.get('v')
    if (fromQuery) {
      candidate = fromQuery
    } else {
      const shortsMatch = url.pathname.match(/\/shorts\/([\w-]{11})/)
      if (shortsMatch) candidate = shortsMatch[1]
    }
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null
}
