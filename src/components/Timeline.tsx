import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useSessionEvents } from '@/lib/sessionEvents'

function formatClock(date: Date) {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatEventTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const Timeline: React.FC = () => {
  const [now, setNow] = useState(() => new Date())
  const events = useSessionEvents()

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="music-body">Sesión en vivo</span>
        <span className="music-number flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {formatClock(now)}
        </span>
      </div>

      <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto no-scrollbar">
        <AnimatePresence initial={false}>
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">Los eventos de la sesión aparecerán aquí…</p>
          )}
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm"
            >
              <span className="music-number text-xs text-muted-foreground">{formatEventTime(event.timestamp)}</span>
              <span className="truncate">{event.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
