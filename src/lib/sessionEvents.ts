import { useEffect, useState } from 'react'

export interface SessionEvent {
  id: string
  label: string
  timestamp: number
}

type Listener = (event: SessionEvent) => void

const listeners = new Set<Listener>()

export function publishEvent(label: string) {
  const event: SessionEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    timestamp: Date.now(),
  }
  listeners.forEach((listener) => listener(event))
  return event
}

export function useSessionEvents(max = 20) {
  const [events, setEvents] = useState<SessionEvent[]>([])

  useEffect(() => {
    const listener: Listener = (event) => {
      setEvents((prev) => [event, ...prev].slice(0, max))
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [max])

  return events
}
