import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { publishEvent, useSessionEvents } from './sessionEvents'

describe('useSessionEvents', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSessionEvents())
    expect(result.current).toEqual([])
  })

  it('prepends newly published events, newest first', () => {
    const { result } = renderHook(() => useSessionEvents())

    act(() => publishEvent('first'))
    act(() => publishEvent('second'))

    expect(result.current.map((event) => event.label)).toEqual(['second', 'first'])
  })

  it('caps the list at the requested maximum', () => {
    const { result } = renderHook(() => useSessionEvents(2))

    act(() => publishEvent('a'))
    act(() => publishEvent('b'))
    act(() => publishEvent('c'))

    expect(result.current).toHaveLength(2)
    expect(result.current.map((event) => event.label)).toEqual(['c', 'b'])
  })

  it('stops receiving events after unmount', () => {
    const { result, unmount } = renderHook(() => useSessionEvents())
    unmount()
    // Publishing after unmount must not throw even though no listener remains.
    expect(() => act(() => publishEvent('after unmount'))).not.toThrow()
    expect(result.current).toEqual([])
  })
})
