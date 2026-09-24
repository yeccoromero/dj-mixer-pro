# DJ Mixer Pro

Un DJ mixer profesional en el navegador construido con React, TypeScript, Tailwind CSS, Framer Motion y GSAP. Reproduce pistas de YouTube en dos decks con crossfader funcional, efectos en vivo y una biblioteca en stack de tarjetas.

## Funcionalidades

- **Dos decks (A y B)** con reproducción de YouTube vía la YouTube IFrame API
- **Crossfader con físicas reales** (GSAP Draggable + inercia) y curva de potencia constante (equal-power), como en un mixer real: clic para saltar, arrastre, y "flick" que desliza y frena solo
- **Auto DJ**: cuando la pista que suena está por terminar (8s o menos), cruza sola al otro deck si tiene una pista cargada — arranca esa pista desde su cue si no estaba sonando, anima el crossfader hasta el otro extremo, y se puede interrumpir en cualquier momento agarrando el fader a mano o apagando el interruptor
- **Fader vertical de Gain** que se desliza de verdad con inercia (GSAP), clic-para-saltar, o por teclado, con tooltip explicando su función
- **Reproductor limpio**: sin controles ni interfaz propia de YouTube encima del video, sin captions por defecto; play/pause/cue solo desde la consola de la app
- **Cue al estilo CDJ**: barra de posición tocable/arrastrable (como el buscador de YouTube) para buscar el momento, botón MARCAR para guardarlo ahí mismo (con un botón de reset para volver a 0), y CUE con toque corto (salta sin cortar la reproducción, útil para loops manuales) o mantener presionado (vista previa, vuelve y pausa al soltar)
- **Loop de 3 toques**: marca entrada, marca salida y activa, y desactiva — la pista se repite sola entre los dos puntos sin BPM ni cuantización
- **Contador LED de tiempo transcurrido/restante** por deck, en tipografía de matriz de puntos (`DotGothic16`)
- **Biblioteca en stack de tarjetas** (arrastrable/swipeable) con carátula a pantalla completa, duración visible, y opción de quitar pistas
- **Modal para agregar pistas**, con dos pestañas: pegar una URL/ID de YouTube, o **buscar por palabra clave sin salir de la app** (usa la misma API que Sugeridos), ambas con verificación de que el video se pueda reproducir antes de agregarlo
- **Sugeridos**: debajo de la biblioteca, una tira de videos similares en estilo a la pista activa (YouTube Data API v3, buscando por las etiquetas de género/estilo del video y cayendo al artista si no tiene), con un botón para agregarlos a la biblioteca en un toque; requiere una API key propia (ver [Variables de entorno](#variables-de-entorno)) y se degrada a no mostrar nada sin ella
- **Panel de efectos** (Siren, Airhorn, Laser, Radio) sintetizados con Tone.js (distorsión, coro, delay, bitcrusher), ubicado en el header junto al título, con hotkeys de teclado (1, 2, 3, 4) para dispararlos sin usar el mouse
- **Barra de posición minimalista**: una línea en el color del deck (no una onda falsa) marca el avance y se puede arrastrar para adelantar/retroceder, con una marca aparte para el punto de cue
- **Diseño Music OS**: esquema de color lima/aqua (`#d7ff43`, `#00eec4`) sobre fondo gris claro, con lecturas tipo LED en tipografía de puntos para los contadores
- **Persistencia local** de la biblioteca de pistas (altas y bajas) vía `localStorage`

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 3 · Framer Motion · GSAP (Draggable + InertiaPlugin) · Tone.js · Radix UI · lucide-react

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (tsc -b && vite build)
npm run lint      # oxlint
npm run test      # vitest (lógica pura + componentes)
```

## Variables de entorno

| Variable | Requerida | Para qué |
|---|---|---|
| `VITE_YOUTUBE_API_KEY` | No — sin ella, el resto de la app funciona igual, solo no aparece la tira de Sugeridos | Búsqueda de videos sugeridos por artista (YouTube Data API v3) |

Copiá `.env.example` a `.env.local` (ya está en `.gitignore`) y completá tu key para desarrollo
local; en Vercel, agregá la misma variable en *Project Settings → Environment Variables*. El
archivo `.env.example` trae el detalle de dónde conseguir la key y cómo restringirla.

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
│   ├── VerticalFader.tsx # Fader vertical de Gain (GSAP Draggable + inercia)
│   ├── EffectsPanel.tsx  # Panel de efectos DJ
│   └── WavePanel.tsx     # Barra de posición arrastrable (sin waveform)
├── lib/                  # Utilidades (YouTube API, efectos de audio, matemática del mixer, formato de tiempo)
├── pages/Index.tsx       # Página principal
└── index.css             # Sistema de diseño Music OS
```

## Controles

Cada botón, fader y control interactivo está documentado en detalle — qué hace, qué estado toca y
cómo se conecta con el resto de la app — en **[CONTROLS.md](./CONTROLS.md)**.

## Notas

Este proyecto reproduce contenido de YouTube sin modificarlo, mediante la YouTube IFrame Player API, respetando los [Términos de Servicio de la API de YouTube](https://developers.google.com/youtube/terms/api-services-terms-of-service).
