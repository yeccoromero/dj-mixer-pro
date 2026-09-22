export interface YouTubePlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead?: boolean): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getDuration(): number
  loadVideoById(videoId: string): void
  destroy(): void
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string
      playerVars?: Record<string, unknown>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void
        onError?: (event: { data: number; target: YouTubePlayer }) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Human-readable messages for the YouTube IFrame API's onError codes. */
export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'ID de video inválido'
    case 5:
      return 'Este video no es compatible con el reproductor HTML5'
    case 100:
      return 'Video no encontrado o eliminado'
    case 101:
    case 150:
      return 'El dueño del video bloqueó su reproducción fuera de YouTube'
    default:
      return 'No se pudo reproducir este video'
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      if (window.YT) resolve(window.YT)
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })

  return apiPromise
}
