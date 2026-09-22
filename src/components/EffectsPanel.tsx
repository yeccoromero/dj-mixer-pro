import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Siren, Megaphone, Zap, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playEffect, type EffectId } from '@/lib/effectSounds'

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

  const trigger = (effect: EffectId) => {
    playEffect(effect)
    onEffectTrigger(effect)
    setActiveEffect(effect)
    window.setTimeout(() => setActiveEffect((current) => (current === effect ? null : current)), 350)
  }

  return (
    <div className="panel mx-auto flex max-w-7xl items-center justify-center gap-3 p-4">
      {EFFECTS.map(({ id, label, icon: Icon }) => (
        <motion.button
          key={id}
          type="button"
          onClick={() => trigger(id)}
          whileTap={{ scale: 0.9 }}
          className={cn(
            'flex flex-col items-center gap-1 rounded-2xl border-2 border-transparent bg-panel px-5 py-3 shadow-sm transition-colors',
            activeEffect === id && 'animate-flash-pulse border-lime-accent bg-lime-accent/30',
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </motion.button>
      ))}
    </div>
  )
}
