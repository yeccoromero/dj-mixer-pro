# Controles de DJ Mixer Pro

Este documento describe **cada control interactivo** de la aplicación: qué hace, a qué estado
afecta, y cómo se conecta con el resto de componentes. Todo lo aquí descrito está validado por:

- 61 tests automatizados (`npm run test`) — lógica pura, componentes con mocks del reproductor de
  YouTube, drag del crossfader, teclado de los knobs, formulario de agregar pista, etc.
- Una pasada de interacción real en navegador (Playwright) que ejercitó los 16 flujos descritos
  abajo contra la app corriendo, sin errores de JavaScript.

## Flujo de datos general

```
                         ┌─────────────────────────┐
                         │        DJMixer.tsx       │  ← dueño de todo el estado
                         │  tracks, deckA, deckB,    │
                         │  crossFaderValue,         │
                         │  selectedTrack, activeDeck│
                         └─────────────────────────┘
              ┌───────────────────┼───────────────────┐
              │                   │                   │
        ┌───────────┐      ┌─────────────┐      ┌───────────┐
        │  Deck "A"  │      │  CrossFader  │      │  Deck "B"  │
        │ (Deck.tsx) │      │(CrossFader.  │      │ (Deck.tsx) │
        └───────────┘      │    tsx)      │      └───────────┘
                            └─────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
             ┌─────────────┐ ┌──────────┐  ┌────────────┐
             │  CoverFlow  │ │ Timeline │  │EffectsPanel│
             │(+AddTrack   │ │          │  │            │
             │   Modal)    │ │          │  │            │
             └─────────────┘ └──────────┘  └────────────┘
```

`DJMixer.tsx` es el único componente con estado "real". Todo lo demás recibe props hacia abajo y
notifica hacia arriba con callbacks (`onChange`, `onTrackSelect`, `onStateChange`, etc.) — patrón
estándar de React de estado elevado ("lifted state").

El pegamento entre controles que **no** viven en el mismo árbol de props es
`src/lib/sessionEvents.ts`: un pequeño *pub/sub* en memoria. Cualquier control puede llamar
`publishEvent("texto")` y el `Timeline` (que se suscribe con `useSessionEvents()`) lo muestra al
instante, sin que `DJMixer` tenga que enrutar esa información.

---

## Header

| Elemento | Función |
|---|---|
| Texto "DJ Mixer Pro" + imagen hero | Puramente decorativo, sin interacción. |

---

## Panel de efectos (`EffectsPanel.tsx`)

| Botón | Qué hace al hacer clic | Con qué se conecta |
|---|---|---|
| **Siren** | Sintetiza un sonido de sirena (barrido de frecuencia) vía Web Audio API (`lib/effectSounds.ts`), llama a `onEffectTrigger('siren')` (log), y publica el evento `Efecto activado: siren` | `Timeline` (vía `sessionEvents`) |
| **Airhorn** | Sintetiza un sonido de bocina (onda sawtooth grave) | igual que arriba, con `'airhorn'` |
| **Laser** | Sintetiza un barrido agudo→grave corto (onda cuadrada) | igual que arriba, con `'laser'` |
| **Radio** | Sintetiza ruido filtrado en banda (simula estática de radio) | igual que arriba, con `'radio'` |

Los 4 botones comparten la misma lógica (`trigger(effect)`): reproducen el sonido, notifican al
padre, publican el evento y aplican una animación de "flash" de 350ms en el propio botón. No
dependen de ningún estado global — son autocontenidos.

---

## Deck A / Deck B (`Deck.tsx`, uno por cada lado del mixer)

Cada deck es dueño de **un reproductor de YouTube** (vía la IFrame API, `lib/youtube.ts`) y expone:

| Control | Qué hace | Estado que toca | Notas |
|---|---|---|---|
| **Cuerpo del deck** (clic en cualquier parte no interactiva) | Marca este deck como el "activo" | `DJMixer.activeDeck` | Determina a qué deck se asigna la próxima pista seleccionada en `CoverFlow` |
| **Botón ▶/⏸ (Play/Pause)** | Reproduce o pausa el video de YouTube (`player.playVideo()` / `player.pauseVideo()`) | `DeckState.isPlaying` (lo actualiza el propio evento `onStateChange` del reproductor, no el clic directamente) | Deshabilitado hasta que el reproductor emite `onReady`; también publica un evento en el Timeline |
| **Botón CUE** | Salta la reproducción al punto de cue (`player.seekTo(...)`) | Lee `DeckState.cue` (0–100%) y `track.duration` para calcular el segundo exacto | Deshabilitado hasta `onReady` y si no hay pista asignada |
| **Knob GAIN** | Arrastre vertical (o flechas ↑/↓ con teclado) ajusta la ganancia del deck, 0–100 | `DeckState.gain` | Se combina con el volumen del crossfader (`computeEffectiveVolume`) y se envía como `player.setVolume(...)` |
| **Knob FILTER** | Igual interacción que Gain | `DeckState.filter` | Aplica un filtro CSS `saturate()` en vivo sobre el video — efecto visual, no de audio (el audio del embed de YouTube no es interceptable) |
| **Knob CUE PT.** | Igual interacción | `DeckState.cue` | Define el % del track al que salta el botón CUE |

**Conexión con el crossfader:** el volumen que cada deck realmente aplica al reproductor no es
solo el gain — es `computeEffectiveVolume(volumen_por_crossfader, gain)` (ver
`lib/mixerMath.ts`), o sea `(volumen/100) × (gain/100) × 100`. Así, mover el crossfader hacia un
lado **y** subir el gain de ese deck se combinan multiplicativamente, como en un mixer real.

**Manejo de errores:** si YouTube reporta que un video no se puede reproducir ahí (embedding
bloqueado por el dueño — códigos 101/150 — video eliminado, ID inválido, etc.), el deck muestra un
mensaje claro en pantalla (`lib/youtube.ts#describeYouTubeError`) en vez de quedarse en silencio.

---

## CrossFader (`CrossFader.tsx`)

| Control | Qué hace | Estado que toca |
|---|---|---|
| **Barra arrastrable** | Al arrastrar (mouse o touch, vía Pointer Events), calcula la posición 0–100 según dónde se soltó el puntero sobre la barra | `DJMixer.crossFaderValue` |
| **Botón "Centrar"** | Anima la posición de vuelta a 50 (mitad) con un spring de Framer Motion | `DJMixer.crossFaderValue` |

**Conexión:** un `useEffect` en `DJMixer.tsx` observa `crossFaderValue` y calcula
`computeCrossfaderVolumes(valor)` → `{ volumeA, volumeB }` (0 = A a full volumen, 100 = B a full
volumen). Esos valores se guardan en `deckA.volume` / `deckB.volume`, que cada `Deck` combina con
su propio Gain (ver arriba) antes de aplicarlo al reproductor real.

---

## CoverFlow (`CoverFlow.tsx`)

| Control | Qué hace | Estado que toca |
|---|---|---|
| **‹ Anterior** | Retrocede el índice de la pista resaltada (sin pasar de la primera) | estado local `centerIndex` |
| **› Siguiente** | Avanza el índice (sin pasar de la última) | estado local `centerIndex` |
| **Clic en una miniatura** | Selecciona esa pista y **se la asigna al deck actualmente activo** (`DJMixer.activeDeck`) | `DJMixer.selectedTrack`, `deckA.track` o `deckB.track` (según cuál esté activo) |
| **Botón "Agregar pista"** | Abre el modal `AddTrackModal` | — |

Este es el punto de conexión clave entre "elegir música" y "qué suena": seleccionar una miniatura
no reproduce nada por sí solo — solo carga esa pista en el deck activo (`Deck` reacciona a que
`state.track` cambió y llama `player.loadVideoById(...)`); hay que pulsar Play en el deck para
escucharla.

### Modal "Agregar pista" (`AddTrackModal.tsx`)

| Control | Qué hace |
|---|---|
| **Campo "URL o ID de YouTube"** | Acepta un ID de 11 caracteres, una URL completa (`youtube.com/watch?v=`), un link corto (`youtu.be/`) o un link de Shorts. Se valida con `lib/youtubeId.ts#extractYouTubeId`, que **rechaza** cualquier cosa que no matchee el patrón exacto de un ID de YouTube (evita inyectar valores arbitrarios en la URL del thumbnail o en el reproductor) |
| **Campos Título / Artista / Duración** | Opcionales; si se dejan vacíos, se usan valores por defecto ("Pista sin título", "Artista desconocido", 180s) |
| **Botón "Añadir a la biblioteca"** | Valida el link; si es inválido muestra un error inline; si es válido, construye un `Track` y llama `onAddTrack(track)`, cierra el modal y limpia el formulario |

**Conexión:** `onAddTrack` sube hasta `DJMixer.handleAddTrack`, que agrega la pista al array
`tracks` **y** lo persiste en `localStorage` (clave `dj-mixer-tracks`) — por eso la biblioteca
sobrevive a un refresh de página.

---

## Timeline (`Timeline.tsx`)

No tiene controles de entrada — es puramente un **panel de salida**. Se suscribe a
`sessionEvents` (`useSessionEvents()`) y muestra, en orden cronológico inverso, cada evento que
cualquier otro control publicó: play/pausa/cue de cada deck, movimientos del crossfader, efectos
activados, selección de pistas, y errores de reproducción. También muestra un reloj en vivo
(actualizado cada segundo) independiente de esos eventos.

---

## Resumen de validación

| Control | Verificado por test unitario | Verificado en navegador real |
|---|---|---|
| Play / Pause | ✅ (`Deck.test.tsx`, reproductor mockeado) | ✅ (queda deshabilitado correctamente; YouTube real no es alcanzable desde este sandbox de red) |
| Cue | ✅ cálculo del segundo exacto | ✅ |
| Knobs (Gain/Filter/Cue pt.) | ✅ teclado + clamps | ✅ |
| Crossfader (drag + Centrar) | ✅ | ✅ |
| Activar deck (A/B) | — | ✅ |
| CoverFlow (‹ › + selección) | ✅ | ✅ |
| Agregar pista (válida/ inválida) | ✅ | ✅ |
| Efectos (Siren/Airhorn/Laser/Radio) | ✅ | ✅ (se ven en el Timeline) |
| Timeline (eventos + reloj) | ✅ (pub/sub) | ✅ |
| Manejo de error de YouTube (101/150/etc.) | ✅ | — (requiere red real hacia YouTube) |
