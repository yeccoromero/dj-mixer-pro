# DJ Mixer Pro

Un DJ mixer profesional en el navegador construido con React, TypeScript, Tailwind CSS, Framer Motion y GSAP. Reproduce pistas de YouTube en dos decks con crossfader funcional, efectos en vivo y una biblioteca en stack de tarjetas.

## Funcionalidades

- **Dos decks (A y B)** con reproducción de YouTube vía la YouTube IFrame API
- **Crossfader con físicas reales** (GSAP Draggable + inercia): clic para saltar, arrastre, y "flick" que desliza y frena solo
- **Knobs interactivos** (Gain, Filter, Cue point) que giran de verdad con inercia (GSAP), o por teclado, con tooltips explicando cada uno
- **Biblioteca en stack de tarjetas** (arrastrable/swipeable) con carátula a pantalla completa, duración visible, y opción de quitar pistas
- **Modal para agregar pistas** desde cualquier URL o ID de YouTube
- **Panel de efectos** (Siren, Airhorn, Laser, Radio) sintetizados con Web Audio API
- **Waveform simulado** con WaveSurfer.js sincronizado al progreso de reproducción
- **Diseño Music OS**: esquema de color lima/aqua (`#d7ff43`, `#00eec4`) sobre fondo gris claro
- **Persistencia local** de la biblioteca de pistas (altas y bajas) vía `localStorage`

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 3 · Framer Motion · GSAP (Draggable + InertiaPlugin) · Radix UI · WaveSurfer.js · lucide-react

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (tsc -b && vite build)
npm run lint      # oxlint
npm run test      # vitest (lógica pura + componentes)
```

## Estructura

```
src/
├── components/
│   ├── ui/               # Primitivas (button, dialog, slider, label)
│   ├── DJMixer.tsx       # Componente principal
│   ├── Deck.tsx          # Deck individual con integración de YouTube
│   ├── CrossFader.tsx    # Crossfader (GSAP Draggable + inercia)
│   ├── CoverFlow.tsx     # Biblioteca en stack de tarjetas
│   ├── AddTrackModal.tsx # Modal para agregar tracks
│   ├── Knob.tsx          # Knob circular personalizado
│   ├── EffectsPanel.tsx  # Panel de efectos DJ
│   └── WavePanel.tsx     # Waveform con WaveSurfer
├── lib/                  # Utilidades (YouTube API, efectos de audio, matemática del mixer)
├── pages/Index.tsx       # Página principal
└── index.css             # Sistema de diseño Music OS
```

## Controles

Cada botón, knob y control interactivo está documentado en detalle — qué hace, qué estado toca y
cómo se conecta con el resto de la app — en **[CONTROLS.md](./CONTROLS.md)**.

## Notas

Este proyecto reproduce contenido de YouTube sin modificarlo, mediante la YouTube IFrame Player API, respetando los [Términos de Servicio de la API de YouTube](https://developers.google.com/youtube/terms/api-services-terms-of-service).
