# Controles de DJ Mixer Pro

Este documento describe **cada control interactivo** de la aplicación: qué hace, a qué estado
afecta, y cómo se conecta con el resto de componentes. Todo lo aquí descrito está validado por:

- Tests automatizados (`npm run test`) — lógica pura, componentes con mocks del reproductor de
  YouTube, drag del crossfader, teclado de los knobs, swipe/borrado de la biblioteca, formulario
  de agregar pista, etc.
- Una pasada de interacción real en navegador (Playwright) que ejercitó los flujos descritos abajo
  contra la app corriendo, sin errores de JavaScript.

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
                    ┌──────────────┴──────────────┐
                    │                              │
             ┌─────────────┐               ┌────────────┐
             │  CoverFlow  │               │EffectsPanel│
             │(+AddTrack   │               │            │
             │   Modal)    │               │            │
             └─────────────┘               └────────────┘
```

`DJMixer.tsx` es el único componente con estado "real". Todo lo demás recibe props hacia abajo y
notifica hacia arriba con callbacks (`onChange`, `onTrackSelect`, `onRemoveTrack`, `onStateChange`,
etc.) — patrón estándar de React de estado elevado ("lifted state"). No hay ningún canal de eventos
global entre componentes: toda la comunicación pasa por `DJMixer.tsx`.

---

## Header

| Elemento | Función |
|---|---|
| Texto "DJ Mixer Pro" + imagen hero | Puramente decorativo, sin interacción. |

---

## Panel de efectos (`EffectsPanel.tsx`)

| Botón | Qué hace al hacer clic |
|---|---|
| **Siren** | Sintetiza un sonido de sirena (barrido de frecuencia) vía Web Audio API (`lib/effectSounds.ts`) y llama a `onEffectTrigger('siren')` |
| **Airhorn** | Sintetiza un sonido de bocina (onda sawtooth grave) |
| **Laser** | Sintetiza un barrido agudo→grave corto (onda cuadrada) |
| **Radio** | Sintetiza ruido filtrado en banda (simula estática de radio) |

Los 4 botones comparten la misma lógica (`trigger(effect)`): reproducen el sonido y aplican una
animación de "flash" de 350ms en el propio botón. Son autocontenidos, no dependen de estado global.

---

## Deck A / Deck B (`Deck.tsx`, uno por cada lado del mixer)

Cada deck es dueño de **un reproductor de YouTube** (vía la IFrame API, `lib/youtube.ts`) y expone:

| Control | Qué hace | Estado que toca | Notas |
|---|---|---|---|
| **Cuerpo del deck** (clic en cualquier parte no interactiva) | Marca este deck como el "activo" | `DJMixer.activeDeck` | Determina a qué deck carga la próxima pista con el botón "Cargar en Deck" de `CoverFlow` |
| **Botón ▶/⏸ (Play/Pause)** | Reproduce o pausa el video de YouTube (`player.playVideo()` / `player.pauseVideo()`) | `DeckState.isPlaying` (lo actualiza el propio evento `onStateChange` del reproductor, no el clic directamente) | Deshabilitado hasta que el reproductor emite `onReady` |
| **Botón CUE** *(tooltip: "Salta la reproducción al punto marcado por 'Cue pt.'")* | Salta la reproducción al punto de cue (`player.seekTo(...)`) | Lee `DeckState.cue` (0–100%) y `track.duration` para calcular el segundo exacto | Deshabilitado hasta `onReady` y si no hay pista asignada |
| **Knob GAIN** *(tooltip: "Ganancia del deck: se combina con el crossfader")* | Arrastre vertical (o flechas ↑/↓ con teclado) ajusta la ganancia del deck, 0–100 | `DeckState.gain` | Se combina con el volumen del crossfader (`computeEffectiveVolume`) y se envía como `player.setVolume(...)` |
| **Knob FILTER** *(tooltip aclara que es solo visual)* | Igual interacción que Gain | `DeckState.filter` | Aplica un filtro CSS `saturate()` en vivo sobre el video — efecto visual, no de audio (el audio del embed de YouTube no es interceptable) |
| **Knob CUE PT.** *(tooltip: "Define a qué % de la pista salta el botón 'Cue'")* | Igual interacción | `DeckState.cue` | Define el % del track al que salta el botón CUE |

**¿Qué son Gain y Cue, en criollo?**
- **Gain** = qué tan fuerte suena ese deck. Se multiplica con la posición del crossfader: si el
  crossfader está del lado del otro deck, aunque subas el Gain al máximo no vas a escuchar nada.
- **Cue** = un marcador de posición dentro de la pista. El knob "Cue pt." define el %; el botón
  "Cue" salta ahí instantáneamente (útil para volver siempre al mismo punto, como el "drop" de un
  tema).

**Conexión con el crossfader:** el volumen que cada deck realmente aplica al reproductor es
`computeEffectiveVolume(volumen_por_crossfader, gain)` (ver `lib/mixerMath.ts`), o sea
`(volumen/100) × (gain/100) × 100`. Mover el crossfader hacia un lado **y** subir el gain de ese
deck se combinan multiplicativamente, como en un mixer real.

**Pista removida de la biblioteca:** si borras desde `CoverFlow` la pista que un deck tiene
cargada, ese deck limpia su `track` (vuelve a "Sin pista asignada") y pausa la reproducción.

**Manejo de errores:** si YouTube reporta que un video no se puede reproducir ahí (embedding
bloqueado por el dueño — códigos 101/150 — video eliminado, ID inválido, etc.), el deck muestra un
mensaje claro en pantalla (`lib/youtube.ts#describeYouTubeError`) en vez de quedarse en silencio.
Esto **no se puede evitar desde la app** — es una restricción que pone el dueño del video en
YouTube (frecuente con sellos discográficos como UMPG); la solución es borrar esa pista de la
biblioteca y buscar otra versión/fuente.

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

## CoverFlow — biblioteca en stack de tarjetas (`CoverFlow.tsx`)

Rediseñada como un mazo de tarjetas apiladas (carátula a pantalla completa, tarjeta activa
arrastrable), en vez del carrusel plano anterior.

| Control | Qué hace | Estado que toca |
|---|---|---|
| **‹ Anterior / › Siguiente** | Mueve la tarjeta activa del stack (se deshabilitan en los extremos) | estado local `centerIndex` — **independiente** de qué pista esté cargada en un deck, para que siempre respondan |
| **Arrastrar la tarjeta activa** | Igual que Siguiente/Anterior pero con swipe (izquierda = siguiente, derecha = anterior); si el arrastre no supera el umbral, la tarjeta vuelve a su lugar | `centerIndex` |
| **Botón ✕ (esquina superior de la tarjeta)** | Quita esa pista de la biblioteca permanentemente | `DJMixer.tracks` (vía `onRemoveTrack`), y limpia el deck que la tuviera cargada |
| **Botón "Cargar en Deck A/B"** (el texto cambia según cuál deck esté activo) | Asigna la tarjeta de arriba del stack al deck activo | `DJMixer.selectedTrack`, `deckA.track` o `deckB.track` |
| **Botón "Agregar pista"** | Abre el modal `AddTrackModal` | — |

**Antes vs. ahora:** en la versión anterior, tocar cualquier miniatura la seleccionaba y cargaba de
inmediato — y una vez seleccionada, las flechas dejaban de mover el stack (bug ya corregido). Ahora
navegar el stack (flechas/swipe) y cargar una pista en el deck son dos acciones explícitas y
separadas, así siempre podés "hojear" la biblioteca sin disparar una carga accidental.

**Duración visible:** cada tarjeta muestra `artista · duración (m:ss)` para identificar la pista
sin tener que cargarla.

### Modal "Agregar pista" (`AddTrackModal.tsx`)

| Control | Qué hace |
|---|---|
| **Campo "URL o ID de YouTube"** | Acepta un ID de 11 caracteres, una URL completa (`youtube.com/watch?v=`), un link corto (`youtu.be/`) o un link de Shorts. Se valida con `lib/youtubeId.ts#extractYouTubeId`, que **rechaza** cualquier cosa que no matchee el patrón exacto de un ID de YouTube (evita inyectar valores arbitrarios en la URL del thumbnail o en el reproductor) |
| **Campos Título / Artista / Duración** | Opcionales; si se dejan vacíos, se usan valores por defecto ("Pista sin título", "Artista desconocido", 180s) |
| **Botón "Añadir a la biblioteca"** | Valida el link; si es inválido muestra un error inline; si es válido, construye un `Track` y llama `onAddTrack(track)`, cierra el modal y limpia el formulario |

**Conexión:** `onAddTrack` sube hasta `DJMixer.handleAddTrack`, que agrega la pista al array
`tracks` **y** lo persiste en `localStorage` (clave `dj-mixer-tracks`). `onRemoveTrack` hace lo
mismo mecanismo a la inversa (filtra el array y vuelve a guardar) — por eso la biblioteca sobrevive
a un refresh de página, altas y bajas incluidas.

---

## Resumen de validación

| Control | Verificado por test unitario | Verificado en navegador real |
|---|---|---|
| Play / Pause | ✅ (`Deck.test.tsx`, reproductor mockeado) | ✅ (queda deshabilitado correctamente; YouTube real no es alcanzable desde este sandbox de red) |
| Cue | ✅ cálculo del segundo exacto | ✅ |
| Knobs (Gain/Filter/Cue pt.) | ✅ teclado + clamps | ✅ |
| Crossfader (drag + Centrar) | ✅ | ✅ |
| Activar deck (A/B) | — | ✅ |
| CoverFlow (‹ › + swipe, sin bloquearse tras seleccionar) | ✅ | ✅ |
| CoverFlow — quitar pista de la biblioteca | ✅ | — |
| CoverFlow — "Cargar en Deck X" | ✅ | ✅ |
| Agregar pista (válida/ inválida) | ✅ | ✅ |
| Efectos (Siren/Airhorn/Laser/Radio) | ✅ | ✅ |
| Manejo de error de YouTube (101/150/etc.) | ✅ | — (requiere red real hacia YouTube) |
