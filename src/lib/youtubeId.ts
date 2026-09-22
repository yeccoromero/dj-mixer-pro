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

/**
 * True when the raw input is specifically a /shorts/ link. YouTube serves Shorts through
 * ANY embed method — including the official IFrame API used here — wrapped in its own
 * mandatory overlay (title, channel avatar, share button, captions, YouTube branding) that
 * `playerVars` like `controls`/`modestbranding`/`iv_load_policy` cannot suppress; it isn't
 * part of the normal player chrome, it's baked into the required Shorts embed template. So
 * a Short can never be shown as a clean, console-only video here — this flags that case
 * before it's added, instead of surprising the user with it after.
 */
export function isYouTubeShortsUrl(input: string): boolean {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    return /\/shorts\/[\w-]{11}/.test(url.pathname)
  } catch {
    return false
  }
}
