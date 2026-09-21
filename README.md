# DJ Mixer Pro

Un DJ mixer profesional en el navegador construido con React, TypeScript, Tailwind CSS y Framer Motion. Reproduce pistas de YouTube en dos decks con crossfader funcional, efectos en vivo, biblioteca en CoverFlow 3D y una línea de tiempo de sesión.

## Funcionalidades

- **Dos decks (A y B)** con reproducción de YouTube vía la YouTube IFrame API
- **Crossfader funcional** que controla el volumen de cada deck en tiempo real
- **Knobs interactivos** (Gain, Filter, Cue point) con arrastre vertical
- **CoverFlow 3D** para navegar la biblioteca de pistas
- **Modal para agregar pistas** desde cualquier URL o ID de YouTube
- **Panel de efectos** (Siren, Airhorn, Laser, Radio) sintetizados con Web Audio API
- **Waveform simulado** con WaveSurfer.js sincronizado al progreso de reproducción
- **Timeline en tiempo real** con reloj y eventos de sesión
- **Diseño Music OS**: esquema de color lima/aqua (`#d7ff43`, `#00eec4`) sobre fondo gris claro
- **Persistencia local** de la biblioteca de pistas vía `localStorage`

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 3 · Framer Motion · Radix UI · WaveSurfer.js · lucide-react

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (tsc -b && vite build)
npm run lint      # oxlint
```

## Estructura

```
src/
├── components/
│   ├── ui/               # Primitivas (button, dialog, slider, label)
│   ├── DJMixer.tsx       # Componente principal
│   ├── Deck.tsx          # Deck individual con integración de YouTube
│   ├── CrossFader.tsx    # Crossfader con drag
│   ├── CoverFlow.tsx     # Biblioteca 3D
│   ├── AddTrackModal.tsx # Modal para agregar tracks
│   ├── Knob.tsx          # Knob circular personalizado
│   ├── EffectsPanel.tsx  # Panel de efectos DJ
│   ├── Timeline.tsx      # Timeline con hora real
│   └── WavePanel.tsx     # Waveform con WaveSurfer
├── lib/                  # Utilidades (YouTube API, efectos de audio, eventos de sesión)
├── pages/Index.tsx       # Página principal
└── index.css             # Sistema de diseño Music OS
```

## Notas

Este proyecto reproduce contenido de YouTube sin modificarlo, mediante la YouTube IFrame Player API, respetando los [Términos de Servicio de la API de YouTube](https://developers.google.com/youtube/terms/api-services-terms-of-service).
