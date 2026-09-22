import { loadYouTubeApi, describeYouTubeError } from './youtube'

export interface EmbedCheckResult {
  playable: boolean
  /** Only set when `playable` is false — a human-readable reason to show the user. */
  reason?: string
}

const CHECK_TIMEOUT_MS = 8000

/**
 * Confirms a YouTube video can actually be embedded and played here, before it's added to
 * the library. oEmbed (used for auto-filling title/artist) only reflects the "allow
 * embedding" toggle — it does not catch the label/Content-ID restrictions (errors 101/150,
 * common with majors like UMPG) that only surface once the real IFrame Player tries to load
 * the video. So this spins up a hidden, muted player purely to observe its onReady/onError
 * events, then tears it down — the same signal the deck itself would hit, just ahead of time.
 */
export function checkVideoEmbeddable(youtubeId: string): Promise<EmbedCheckResult> {
  return new Promise((resolve) => {
    let settled = false
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    document.body.appendChild(container)

    const finish = (result: EmbedCheckResult) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      player?.destroy()
      container.remove()
      resolve(result)
    }

    const timeoutId = window.setTimeout(() => {
      // Neither onReady nor onError fired in time — treat as unknown/allowed rather than
      // blocking a valid track just because the check itself was slow.
      finish({ playable: true })
    }, CHECK_TIMEOUT_MS)

    let player: { destroy(): void } | null = null

    loadYouTubeApi()
      .then((YT) => {
        if (settled) return
        player = new YT.Player(container, {
          videoId: youtubeId,
          playerVars: { controls: 0 },
          events: {
            onReady: () => finish({ playable: true }),
            onError: (event) => finish({ playable: false, reason: describeYouTubeError(event.data) }),
          },
        })
      })
      .catch(() => finish({ playable: true }))
  })
}
