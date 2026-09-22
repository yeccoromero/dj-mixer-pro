import { loadYouTubeApi, describeYouTubeError } from './youtube'

export interface EmbedCheckResult {
  playable: boolean
  /** Only set when `playable` is false — a human-readable reason to show the user. */
  reason?: string
}

const CHECK_TIMEOUT_MS = 10000
// `onReady` fires as soon as the player shell is initialized — it does NOT mean this
// specific video is embeddable. A label/Content-ID restriction (errors 101/150, common
// with majors like UMPG) arrives separately via `onError`, shortly after `onReady`, once
// YouTube finishes evaluating that particular video's embedding permission. So `onReady`
// alone must not be treated as "playable" — it only starts this grace window to give a
// late `onError` a chance to arrive before declaring the video safe to add.
const READY_GRACE_MS = 2500

/**
 * Confirms a YouTube video can actually be embedded and played here, before it's added to
 * the library. oEmbed (used for auto-filling title/artist) only reflects the "allow
 * embedding" toggle — it does not catch the label/Content-ID restrictions above, which only
 * surface once the real IFrame Player tries to load the video. So this spins up a hidden
 * player purely to observe its onReady/onError events, then tears it down — the same signal
 * the deck itself would hit, just ahead of time.
 */
export function checkVideoEmbeddable(youtubeId: string): Promise<EmbedCheckResult> {
  return new Promise((resolve) => {
    let settled = false
    let graceTimeoutId: number | null = null
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    document.body.appendChild(container)

    const finish = (result: EmbedCheckResult) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      if (graceTimeoutId !== null) window.clearTimeout(graceTimeoutId)
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
            onReady: () => {
              if (graceTimeoutId !== null) return
              graceTimeoutId = window.setTimeout(() => finish({ playable: true }), READY_GRACE_MS)
            },
            onError: (event) => finish({ playable: false, reason: describeYouTubeError(event.data) }),
          },
        })
      })
      .catch(() => finish({ playable: true }))
  })
}
