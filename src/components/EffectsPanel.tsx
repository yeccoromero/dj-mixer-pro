import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Siren, Megaphone, Zap, Radio } from 'lucide-react'
import { startEffect, stopEffect, type EffectId } from '@/lib/effectSounds'

interface EffectsPanelProps {
  onEffectTrigger: (effect: EffectId) => void
}

// Each effect gets its own flat retro color (bold, physical-keycap look — like the covers/
// player mockups this was modeled on) instead of the uniform gray pill it used to be. Picked
// to stay clear of the deck identity colors (lime/aqua): alarm-red, horn-yellow, sci-fi violet,
// warm radio-dial amber. `base` is a darker shade of the same hue, not generic black — the
// keycap reference shows each key's "wall" tinted to match its own face, not a flat gray shadow.
const EFFECTS: {
  id: EffectId
  label: string
  icon: React.ComponentType<{ className?: string }>
  bg: string
  base: string
  fg: string
}[] = [
  { id: 'siren', label: 'Siren', icon: Siren, bg: '#FF5A36', base: '#B33D22', fg: '#FFFFFF' },
  { id: 'airhorn', label: 'Airhorn', icon: Megaphone, bg: '#FFC933', base: '#C99A1F', fg: '#1A1A1A' },
  { id: 'laser', label: 'Laser', icon: Zap, bg: '#7B5CFA', base: '#5138B0', fg: '#FFFFFF' },
  { id: 'radio', label: 'Radio', icon: Radio, bg: '#E3A83B', base: '#A97527', fg: '#1A1A1A' },
]

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ onEffectTrigger }) => {
  const [activeEffect, setActiveEffect] = useState<EffectId | null>(null)
  // Read from the pointerup listener below, which is registered once at mount and would
  // otherwise close over a stale `activeEffect` forever.
  const activeEffectRef = useRef<EffectId | null>(null)

  // Like a real DJ FX pad: the effect sounds for as long as the button is held, and the
  // release has to be caught wherever the pointer ends up — even if it drifted off the
  // button first — so this listens globally instead of only on the button's own handlers
  // (same pattern the Cue button uses in Deck.tsx).
  useEffect(() => {
    const release = () => {
      const effect = activeEffectRef.current
      if (!effect) return
      activeEffectRef.current = null
      setActiveEffect(null)
      stopEffect(effect)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [])

  const press = (effect: EffectId) => {
    if (activeEffectRef.current === effect) return
    // A stray second pointerdown landing on a different pad before the first one's release
    // fired stops that one first, instead of leaving it sounding forever underneath the new one.
    if (activeEffectRef.current) stopEffect(activeEffectRef.current)
    activeEffectRef.current = effect
    setActiveEffect(effect)
    startEffect(effect)
    onEffectTrigger(effect)
  }

  return (
    <div className="panel flex flex-col gap-3 p-5">
      <span className="music-body">Efectos</span>
      <div className="grid grid-cols-4 gap-2">
        {EFFECTS.map(({ id, label, icon: Icon, bg, base, fg }) => {
          const isHeld = activeEffect === id
          return (
            <motion.button
              key={id}
              type="button"
              onPointerDown={() => press(id)}
              title={`Mantener presionado para ${label}`}
              // Driven by `animate` (not `whileTap`) because this has to track our own sustained
              // `isHeld` state for as long as the button is held, not just Framer's own instant
              // tap gesture — and mixing whileTap's transform with a plain `style.transform` here
              // let Framer's gesture animation silently win, so the "sink" never showed at all.
              animate={{ y: isHeld ? 3 : 0 }}
              transition={{ duration: 0.1 }}
              style={{
                backgroundColor: bg,
                color: fg,
                // A retro keycap: a colored "wall" the same hue as the face reads as physical
                // height — while held, the button sinks into that wall instead of floating above it.
                boxShadow: isHeld ? `0 1px 0 ${base}` : `0 4px 0 ${base}`,
              }}
              className="flex flex-col items-center gap-1 rounded-lg py-2.5 transition-[box-shadow] duration-100"
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
