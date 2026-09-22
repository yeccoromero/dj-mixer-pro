import { describe, expect, it } from 'vitest'
import { extractYouTubeId } from './youtubeId'

describe('extractYouTubeId', () => {
  it('accepts a bare 11-character video ID', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('trims surrounding whitespace on a bare ID', () => {
    expect(extractYouTubeId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from a standard watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from a watch URL with extra query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123')).toBe(
      'dQw4w9WgXcQ',
    )
  })

  it('extracts the id from a youtu.be short link', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from a Shorts URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('rejects a malformed v= parameter instead of passing it through', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=not-a-valid-id')).toBeNull()
  })

  it('rejects a v= parameter carrying a script injection attempt', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=<script>alert(1)</script>')).toBeNull()
  })

  it('rejects plain garbage input', () => {
    expect(extractYouTubeId('not a url or id')).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(extractYouTubeId('')).toBeNull()
  })

  it('rejects a URL from an unrelated domain with no video id', () => {
    expect(extractYouTubeId('https://example.com/watch?v=dQw4w9WgXcQextra')).toBeNull()
  })
})
