import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Siren, Megaphone, Zap, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { startEffect, stopEffect, type EffectId } from '@/lib/effectSounds'

interface EffectsPanelProps {
  onEffectTrigger: (effect: EffectId) => void
}

const EFFECTS: { id: EffectId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'siren', label: 'Siren', icon: Siren },
  { id: 'airhorn', label: 'Airhorn', icon: Megaphone },
  { id: 'laser', label: 'Laser', icon: Zap },
  { id: 'radio', label: 'Radio', icon: Radio },
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
        {EFFECTS.map(({ id, label, icon: Icon }) => (
          <motion.button
            key={id}
            type="button"
            onPointerDown={() => press(id)}
            whileTap={{ scale: 0.9 }}
            title={`Mantener presionado para ${label}`}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border-2 border-transparent bg-panel py-2.5 shadow-sm transition-colors',
              activeEffect === id && 'border-lime-accent bg-lime-accent/30',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
