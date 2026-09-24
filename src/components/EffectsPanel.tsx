import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Siren, Megaphone, Zap, Radio } from 'lucide-react'
import { startEffect, stopEffect, type EffectId } from '@/lib/effectSounds'

interface EffectsPanelProps {
  onEffectTrigger: (effect: EffectId) => void
  /** True while any FX pad is held, false once it's released — lets the decks duck their
   * track volume so the effect reads as louder than the music, not buried under it. */
  onDuckingChange?: (active: boolean) => void
  /** Renders without its own panel card/padding, for when this sits inside another panel
   * (the header) instead of as its own standalone block in the main column. */
  embedded?: boolean
}

// Numeric keys double as hands-free pads — a DJ mixing live doesn't want to look away from
// the decks to find a small button. Order matches the visual grid (left to right).
const KEY_TO_EFFECT: Record<string, EffectId> = { '1': 'siren', '2': 'airhorn', '3': 'laser', '4': 'radio' }
const EFFECT_TO_KEY = Object.fromEntries(Object.entries(KEY_TO_EFFECT).map(([key, effect]) => [effect, key])) as Record<
  EffectId,
  string
>

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

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ onEffectTrigger, onDuckingChange, embedded }) => {
  const [activeEffect, setActiveEffect] = useState<EffectId | null>(null)
  // Read from the pointerup/keyboard listeners below, which are registered once at mount and
  // would otherwise close over a stale `activeEffect` forever.
  const activeEffectRef = useRef<EffectId | null>(null)
  const onDuckingChangeRef = useRef(onDuckingChange)
  const onEffectTriggerRef = useRef(onEffectTrigger)
  useEffect(() => {
    onDuckingChangeRef.current = onDuckingChange
  }, [onDuckingChange])
  useEffect(() => {
    onEffectTriggerRef.current = onEffectTrigger
  }, [onEffectTrigger])

  // Shared by the pointer and keyboard paths — reading callback props through the refs above
  // (instead of closing over them directly) keeps these stable across renders, so both the
  // pointerup/pointercancel effect and the keydown/keyup effect can depend on them safely.
  const press = useCallback((effect: EffectId) => {
    if (activeEffectRef.current === effect) return
    // A stray second press landing on a different pad before the first one's release fired
    // stops that one first, instead of leaving it sounding forever underneath the new one.
    const wasAlreadyHoldingOne = activeEffectRef.current !== null
    if (activeEffectRef.current) stopEffect(activeEffectRef.current)
    activeEffectRef.current = effect
    setActiveEffect(effect)
    startEffect(effect)
    onEffectTriggerRef.current(effect)
    if (!wasAlreadyHoldingOne) onDuckingChangeRef.current?.(true)
  }, [])

  const release = useCallback(() => {
    const effect = activeEffectRef.current
    if (!effect) return
    activeEffectRef.current = null
    setActiveEffect(null)
    stopEffect(effect)
    onDuckingChangeRef.current?.(false)
  }, [])

  // Like a real DJ FX pad: the effect sounds for as long as the button is held, and the
  // release has to be caught wherever the pointer ends up — even if it drifted off the
  // button first — so this listens globally instead of only on the button's own handlers
  // (same pattern the Cue button uses in Deck.tsx).
  useEffect(() => {
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [release])

  // Keyboard hotkeys (1-4): same hold-to-sustain behavior as the pads themselves, so a DJ can
  // trigger an effect without looking away from the decks. Ignored while typing in a field
  // (e.g. the add-track modal) and on OS key-repeat, which would otherwise re-fire `press` on
  // every repeat tick — harmless since `press` already no-ops on the same effect, but noisy.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return
      const effect = KEY_TO_EFFECT[event.key]
      if (!effect) return
      event.preventDefault()
      press(effect)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const effect = KEY_TO_EFFECT[event.key]
      if (effect && activeEffectRef.current === effect) release()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [press, release])

  return (
    <div className={embedded ? 'flex flex-col gap-2' : 'panel flex flex-col gap-3 p-5'}>
      <span className={embedded ? 'text-xs text-muted-foreground' : 'music-body'}>
        Efectos <span className="opacity-60">(teclas 1-4)</span>
      </span>
      <div className="grid grid-cols-4 gap-3">
        {EFFECTS.map(({ id, label, icon: Icon, bg, base, fg }) => {
          const isHeld = activeEffect === id
          return (
            <motion.button
              key={id}
              type="button"
              onPointerDown={() => press(id)}
              title={`Mantener presionado para ${label} (tecla ${EFFECT_TO_KEY[id]})`}
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
              className="relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-[box-shadow] duration-100"
            >
              <span className="absolute right-2 top-1.5 text-[9px] font-bold opacity-70">{EFFECT_TO_KEY[id]}</span>
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
