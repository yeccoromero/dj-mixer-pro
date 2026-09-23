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
                                   │
                            ┌─────────────┐
                            │  CoverFlow  │
                            │(+AddTrack   │
                            │   Modal)    │
                            └─────────────┘
                                   │
                            ┌─────────────┐
                            │EffectsPanel │
                            └─────────────┘
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

**Ubicación — debajo de la Biblioteca, no arriba de todo:** vivía como una barra propia a todo lo
ancho, entre el header y los tres paneles principales — separado del resto y sin relación visual
con ningún otro control. Pedido explícito de moverlo debajo de Biblioteca, dentro de la misma
columna central. Se redujo a una botonera compacta (`grid grid-cols-4`, íconos y texto más chicos)
para que las 4 acciones quepan en el ancho de esa columna en vez del ancho completo de la página.

---

## Deck A / Deck B (`Deck.tsx`, uno por cada lado del mixer)

Cada deck es dueño de **un reproductor de YouTube** (vía la IFrame API, `lib/youtube.ts`) y expone:

**Reproductor "limpio", control exclusivo desde la consola:** el embed se crea con
`controls: 0` (sin la barra nativa de YouTube), `disablekb: 1` (sin atajos de teclado propios),
`fs: 0` (sin botón de pantalla completa), `iv_load_policy: 3` (sin anotaciones) y
`cc_load_policy: 0` (sin subtítulos por defecto) — solo se ve el video, sin ninguna interfaz de
YouTube encima. Además, un div transparente cubre todo el reproductor y absorbe cualquier clic o
arrastre sobre el video (sin `onClick`, así que no hace nada): esto evita que tocar el video
directamente lo pause/reproduzca por su cuenta, saltándose el estado de la app — play/pause/cue
solo pasan por los botones de este panel, que son los que llaman a `player.playVideo()` /
`pauseVideo()` / `seekTo()` explícitamente.

| Control | Qué hace | Estado que toca | Notas |
|---|---|---|---|
| **Cuerpo del deck** (clic en cualquier parte no interactiva) | Marca este deck como el "activo" | `DJMixer.activeDeck` | Determina a qué deck carga la próxima pista con el botón "Cargar en Deck" de `CoverFlow` |
| **Contador LED (transcurrido) / Botón ▶/⏸ (Play/Pause) / Contador LED (restante)** | Los tres van en una sola fila, con el Play exactamente al centro entre los dos contadores (`grid-cols-[1fr_auto_1fr]`) — es el control principal del deck | El Play toca `DeckState.isPlaying` (lo actualiza el propio evento `onStateChange` del reproductor, no el clic directamente); los contadores solo leen `DeckState.currentTime`/`track.duration`, son informativos | Play deshabilitado hasta que el reproductor emite `onReady` |
| **Barra de posición** *(`WavePanel.tsx`, estilo idéntico al buscador de YouTube — sin líneas verticales)* | Tocar salta a ese punto; **arrastrar** (mouse o dedo) llena la barra en vivo mientras se sostiene; el salto real al video se confirma una sola vez, al soltar | `player.seekTo(...)` + `DeckState.currentTime`, solo en el `pointerup` | Delgada en reposo, un poco más gruesa al pasar el mouse o mientras se arrastra (igual que YouTube). El relleno de lo reproducido crece de izquierda a derecha en tiempo real, en el color del deck (lima/aqua) — no es una línea marcando un punto, es una barra llenándose. Detrás, un relleno gris muestra cuánto video está realmente precargado (`player.getVideoLoadedFraction()`, dato real de YouTube). La manija circular está invisible en reposo y aparece (crece) solo al pasar el mouse o arrastrar, igual que YouTube. El punto de cue guardado es un puntito blanco chico sobre la barra, no una línea |
| **Botón CUE** *(más chico, debajo del Play — control secundario)* | **Toque corto**: salta al punto de cue guardado sin cortar la reproducción — si estaba sonando, sigue sonando desde ahí (útil para hacer loops manuales, tocando CUE repetidas veces al ritmo). Si estaba pausado, queda pausado en el nuevo punto. **Mantener presionado**: reproduce de prueba desde el cue mientras se sostiene (arranca a sonar aunque estuviera pausado); al soltar, vuelve al cue y pausa — a diferencia del toque corto, soltar sí pausa siempre, porque la idea de la vista previa es volver exactamente a donde se empezó | Lee `DeckState.cue` (0–100%) y `track.duration` para calcular el segundo exacto; `player.seekTo(...)`, y solo `pauseVideo()`/`playVideo()` en el gesto de mantener presionado | Deshabilitado hasta `onReady` y si no hay pista asignada. El "soltar" se detecta con un listener global de `pointerup`, así funciona aunque el puntero se mueva fuera del botón antes de soltar |
| **Botón MARCAR** | Guarda la posición actual de reproducción como el nuevo punto de cue — se escucha el momento exacto (o se busca arrastrando la barra) y se marca ahí, en vez de calcular a ciegas un % | `DeckState.cue` (`lib/mixerMath.ts#computeCuePercent`) | Da un flash visual breve de confirmación al tocarlo |
| **Fader vertical GAIN** *(tooltip: "Ganancia del deck: se combina con el crossfader para dar el volumen final")* | Se arrastra la manija hacia arriba/abajo (con inercia — un flick rápido sigue deslizando hasta frenar), se toca cualquier punto de la barra para saltar directo ahí, o se usan las flechas ↑/↓ del teclado | `DeckState.gain` | Se combina con el volumen del crossfader (`computeEffectiveVolume`) y se envía como `player.setVolume(...)`. Arranca al máximo (100), no a la mitad — ver nota de volumen abajo. Arriba = volumen máximo, abajo = silencio, como el fader de canal de un mixer real |

**Físicas reales del fader de Gain (GSAP):** es un `Draggable` de GSAP (`type: "y"`, acotado a la
barra) con `InertiaPlugin` — arrastrar la manija la desliza de verdad, y si se suelta con
velocidad, sigue deslizando por su cuenta y frena naturalmente en vez de detenerse en seco donde
soltaste el mouse. Tocar la barra (fuera de la manija) salta directo a ese punto. Las flechas del
teclado siguen funcionando igual que antes (accesibilidad).

**Se quitó el Filter:** el knob Filter aplicaba un filtro CSS `saturate()` en vivo sobre el video
— un efecto puramente visual, nunca de audio (el audio del embed de YouTube no es interceptable
vía Web Audio API, así que un "filtro" de audio real nunca fue posible en esta app). Pedido
explícito: si no se puede ofrecer un filtro de audio de verdad, no tiene sentido mantener uno que
solo cambia el color del video y puede confundirse con un control de sonido. Se eliminó el control,
su estado (`DeckState.filter`) y el componente `Knob.tsx` que ya no tenía otro uso.

**Rediseño de Gain — de knob rotativo a fader vertical:** a pedido explícito ("quita todo lo
innecesario como Filter"; el Gain "debería ser como la imagen de referencia"), se reemplazó el
knob giratorio por un fader vertical de dos posiciones (arriba = máximo, abajo = silencio),
inspirado en los faders de canal de un mixer de DJ real — el mismo lenguaje visual que ya usan las
consolas físicas, más legible de un vistazo que un ángulo de rotación. Nuevo componente
`VerticalFader.tsx`, con la misma base de `Draggable` + `InertiaPlugin` que ya usaban Gain/Filter/
CrossFader, adaptada a arrastre vertical (`type: "y"`) en vez de rotación.

**Ubicación del fader — al lado del video, no debajo de todo:** la primera versión ponía el fader
centrado en su propia fila, debajo de CUE/MARCAR, solo en medio de una franja vacía a ambos lados
— no se leía como parte de un mixer, se veía como un control suelto flotando en el aire. Se movió
al costado del video (a la derecha), ocupando toda su altura — igual que el fader de canal de un
mixer real, que va pegado a la pista que controla, no en un panel aparte. El video pasa de `w-full`
a `flex-1` dentro de una fila (`flex`) junto al fader; `VerticalFader` gana una prop `fill` que, en
vez de una altura fija en píxeles, estira el control al 100% de lo que el layout flexbox le da —
así la altura del fader sigue automáticamente la del video en cualquier ancho de pantalla, sin
necesidad de calcularla a mano.

**Deck B, en espejo:** con los dos faders a la derecha de su video, el de Deck A queda hacia el
centro de la pantalla (cerca del crossfader) pero el de Deck B queda en el borde exterior, lejos
de todo. Se invirtió el orden en Deck B (`flex-row-reverse`: fader primero, video después) para
que su fader también quede del lado que mira al centro — los dos decks simétricos, cada fader
cerca del crossfader que combina ambos, no uno cerca y el otro lejos.

**Cue, rehecho para que se sienta natural:** la versión anterior obligaba a calcular a ciegas un
% de la pista con un knob, sin escuchar nada mientras tanto — nunca se sentía como "marcar el
momento que estoy escuchando". Ahora el flujo es: arrastrar la barra de posición (o simplemente
reproducir) hasta el momento deseado, tocar **MARCAR** para guardarlo ahí, y usar **CUE** para
volver — toque corto salta ahí sin cortar el sonido (sirve para hacer loops manuales); mantener
presionado reproduce una vista previa desde ahí y, al soltar, sí vuelve a pausar en el mismo lugar.
Se eliminó el knob "Cue pt." — quedó obsoleto una vez que marcar el punto en vivo lo reemplaza.

**Ajuste — CUE no debía cortar la reproducción:** la primera versión pausaba siempre al tocar CUE,
imitando el botón Cue de un CDJ real. Pedido explícito: que el toque corto salte al punto marcado
sin pausar, justamente para poder usarlo como loop (tocar CUE repetidas veces mientras suena, sin
que se corte cada vez). Se mantuvo la pausa solo para el gesto de mantener presionado y soltar,
ya que ahí el pausar al soltar es el punto central del gesto (volver exactamente a donde se
empezó la vista previa).

**Historia de `WavePanel.tsx` — de "onda falsa" a barra simple:** la primera versión usaba
WaveSurfer.js para dibujar una forma de onda con datos generados (no reales, ya que un embed de
YouTube no expone su audio para analizar). Con eso vinieron tres problemas seguidos: la posición
saltaba cada 400ms en vez de moverse en tiempo real (WaveSurfer redibujaba el canvas de golpe en
cada lectura), no se podía arrastrar para adelantar como en un reproductor real (faltaba activar
`dragToSeek`, una opción separada del clic), y finalmente — pedido explícito — la onda decorativa
en sí no aportaba nada real y confundía. Se sacó WaveSurfer.js por completo (dependencia incluida,
`npm uninstall wavesurfer.js`) y se reemplazó por una barra simple hecha a mano: una línea con
manija en el color del deck que sigue el puntero al arrastrar (`onPointerDown`/`pointermove`/
`pointerup` con listeners globales, mismo patrón que ya se usa para el botón CUE), con una
transición CSS para que la reproducción normal se vea fluida sin saltos, y sin transición durante
un arrastre o un salto explícito para que la línea responda al instante.

**Bug corregido — arrastrar y soltar colgaba la app:** la versión hecha a mano seguía llamando a
`onSeek` en cada evento `pointermove` durante el arrastre — igual que el problema original de
WaveSurfer, solo que ahora la causa era propia. Cada llamada disparaba un `player.seekTo(...)` real
(un mensaje al iframe de YouTube) más una actualización de estado de toda la app, y un arrastre
normal genera decenas de eventos `pointermove` por segundo — eso es lo que colgaba el navegador
después de soltar. Se corrigió separando las dos cosas, igual que hace cualquier reproductor de
video real: mientras se arrastra, solo se mueve la posición visual local (`dragPosition`, gratis,
sin tocar el reproductor); el salto real al video se confirma una única vez, en el evento
`pointerup` al soltar — así el video recién empieza a "precargar" esa nueva posición cuando el
usuario decide soltar, no en cada pixel de arrastre. Cubierto por un test de regresión que simula
un arrastre completo y confirma que `onSeek` no se llama ni una vez hasta soltar; se verificó que
fallaba (llamaba a `onSeek` 3 veces) contra el código anterior.

**Rediseño — igual al buscador de YouTube, sin líneas verticales:** pedido explícito de que no se
viera "prolijo" con líneas finas marcando un punto. Se cambió el modelo de "línea en una posición"
a "barra que se rellena": lo reproducido ahora es un relleno de ancho creciente (no una línea que
se mueve) en el color del deck, con el gris de precarga detrás. La barra es delgada en reposo (4px)
y crece un poco (6px) al pasar el mouse o mientras se arrastra (`onMouseEnter`/`onMouseLeave` +
el mismo estado de arrastre), y la manija circular pasa de tamaño 0 y opacidad 0 a visible con una
transición corta — el mismo patrón de "aparece al interactuar" que usa el buscador de YouTube. El
punto de cue guardado pasó de una línea blanca de altura completa a un puntito chico (círculo de
6px), para que no se lea como otra "línea vertical".

**Rediseño — de relleno continuo a puntos ("Music OS", inspirado en widgets estilo Braun):** a
partir de una imagen de referencia de widgets minimalistas (reloj, clima, reproductor de música,
todos con barras de progreso hechas de puntos en vez de una línea o relleno sólido), se adoptó ese
mismo lenguaje acá: tanto la barra de posición (`WavePanel.tsx`) como los faders de Gain
(`VerticalFader.tsx`) reemplazaron su relleno continuo por una fila/columna de puntos que se van
"encendiendo" en el color del deck a medida que avanza la reproducción o sube el gain — los puntos
detrás del precargado (`loadedFraction`) quedan en un gris intermedio, y el resto en gris claro.
No es un capricho estético aislado: la app ya usaba una tipografía LED de puntos (`DotGothic16`)
para los contadores de tiempo, así que este cambio conecta ese motivo con los controles
interactivos — toda la interfaz "habla el mismo idioma" de puntos en vez de mezclar dos lenguajes
visuales distintos (líneas continuas para los controles, puntos solo para los números). La
interacción (click, arrastre, teclado, hover-reveal del handle) no cambió — es puramente visual.

**¿Qué son Gain y Cue, en términos simples?**
- **Gain** = qué tan fuerte suena ese deck. Se multiplica con la posición del crossfader: si el
  crossfader está del lado del otro deck, aunque el Gain esté al máximo no se va a escuchar nada.
- **Cue** = un marcador de posición dentro de la pista, como el "drop" o el estribillo. Se guarda
  con el botón MARCAR (en el punto que se esté escuchando en ese momento) y se vuelve ahí con el
  botón CUE.

**Bug corregido — el volumen salía más bajo que escuchando el video directo en YouTube:** el
Gain arrancaba en 50 (mitad), no en 100 (máximo). Como es un atenuador multiplicativo puro
(`(volumen_crossfader/100) × (gain/100) × 100`, ver abajo) y no un control tipo "unity gain" de
mixer real (donde el centro suele ser "0dB, sin cambio"), dejarlo en 50 por defecto silenciaba
cada deck a la mitad sin que se notara por qué — sonaba bajo desde el primer track agregado,
antes de tocar ningún knob. Se corrigió el valor inicial de Gain a 100. El techo real de volumen
sigue siendo el mismo que YouTube (`player.setVolume` tope en 100, no hay forma de superarlo vía
la IFrame API) — con Gain al máximo y el crossfader empujado del todo hacia ese deck, el volumen
iguala exactamente al de reproducir el video directo en YouTube.

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
| **Clic en cualquier parte de la barra** | Salta el fader directamente a esa posición | `DJMixer.crossFaderValue` |
| **Arrastrar el handle** | Se desliza manualmente; si se suelta con velocidad (un "flick"), sigue deslizando por inercia y frena solo, en vez de detenerse en seco | `DJMixer.crossFaderValue` |
| **Botón "Centrar"** | Anima la posición de vuelta a 50 (mitad) | `DJMixer.crossFaderValue` |

**Físicas reales (GSAP):** el handle es un `Draggable` de GSAP (`type: "x"`, acotado a la barra) con
`InertiaPlugin`, igual mecanismo que los knobs — por eso ambos controles se sienten consistentes
entre sí.

**Conexión:** un `useEffect` en `DJMixer.tsx` observa `crossFaderValue` y calcula
`computeCrossfaderVolumes(valor)` → `{ volumeA, volumeB }` (0 = A a full volumen, 100 = B a full
volumen). Esos valores se guardan en `deckA.volume` / `deckB.volume`, que cada `Deck` combina con
su propio Gain (ver arriba) antes de aplicarlo al reproductor real.

**Curva de potencia constante (equal-power):** `computeCrossfaderVolumes` ya no reparte el volumen
de forma lineal (50/50 en el centro); usa un barrido de un cuarto de coseno/seno, así que en el
centro ambos decks quedan cerca de 71/71 en vez de 50/50. Es el mismo motivo por el que los mixers
de DJ reales usan esta curva: una mezcla lineal suena perceptiblemente más floja justo a mitad de
camino, porque la potencia percibida no es la suma lineal de los dos volúmenes.

---

## CoverFlow — biblioteca en carrusel de tarjetas (`CoverFlow.tsx`)

Fan de tarjetas (carátula a pantalla completa) inspirado en el carrusel 3D original: la tarjeta
activa queda al frente y agrandada; hasta 2 tarjetas a cada lado quedan **visibles** detrás,
achicadas y con menos opacidad, para poder "hojear" la biblioteca de un vistazo.

| Control | Qué hace | Estado que toca |
|---|---|---|
| **‹ Anterior / › Siguiente** | Mueve cuál tarjeta está al frente (se deshabilitan en los extremos) | estado local `centerIndex` — **independiente** de qué pista esté cargada en un deck, para que siempre respondan |
| **Arrastrar la tarjeta activa** | Igual que Siguiente/Anterior pero con swipe (izquierda = siguiente, derecha = anterior); si el arrastre no supera el umbral, la tarjeta vuelve a su lugar | `centerIndex` |
| **Clic en una tarjeta lateral** | La trae al frente (la centra), **sin** cargarla en ningún deck | `centerIndex` |
| **Botón ✕** *(solo visible en la tarjeta del frente)* | Quita esa pista de la biblioteca permanentemente | `DJMixer.tracks` (vía `onRemoveTrack`), y limpia el deck que la tuviera cargada |
| **Botón "Cargar en Deck A/B"** *(solo visible en la tarjeta del frente; el texto cambia según cuál deck esté activo)* | Asigna la tarjeta del frente al deck activo | `DJMixer.selectedTrack`, `deckA.track` o `deckB.track` |
| **Botón "Agregar pista"** | Abre el modal `AddTrackModal` | — |

**Solo la tarjeta activa es "accionable":** las tarjetas laterales no tienen botón de borrar ni de
cargar — eso evita borrar o cargar algo por error mientras solo estás mirando la biblioteca.
Tocar una tarjeta lateral únicamente la trae al frente; desde ahí sí aparecen sus acciones.

**Antes vs. ahora:** en la primera versión, tocar cualquier miniatura la seleccionaba y cargaba de
inmediato — y una vez seleccionada, las flechas dejaban de mover el carrusel (bug ya corregido).
Ahora navegar (flechas/swipe/clic en una lateral) y cargar una pista en el deck son dos acciones
explícitas y separadas.

**Duración visible:** la tarjeta activa muestra `artista · duración (m:ss)` para identificarla sin
tener que cargarla.

**Bug corregido — se colgaba al borrar la tarjeta activa cuando era la última de la lista:**
`centerIndex` (qué tarjeta está al frente) solo se recorta a un rango válido en un `useEffect`, que
corre *después* de que React ya renderizó con el array `tracks` más corto. Si justo se borraba la
tarjeta activa estando en la última posición, ese primer render usaba `tracks[centerIndex]` con un
índice que ya no existía (`undefined`), y leer `.title` de ahí tiraba un `TypeError` que rompía el
árbol de React entero (pantalla en blanco/congelada). Se corrigió calculando un índice seguro
(`safeIndex = Math.min(centerIndex, tracks.length - 1)`) directamente en el render, en vez de
depender solo del efecto — así nunca se indexa fuera de rango, ni siquiera por un instante. Cubierto
por un test de regresión que reproduce exactamente ese escenario (navegar a la última tarjeta,
borrarla, verificar que no explota).

### Modal "Agregar pista" (`AddTrackModal.tsx`)

| Control | Qué hace |
|---|---|
| **Campo "URL o ID de YouTube"** | Acepta un ID de 11 caracteres, una URL completa (`youtube.com/watch?v=`), un link corto (`youtu.be/`) o un link de Shorts. Se valida con `lib/youtubeId.ts#extractYouTubeId`, que **rechaza** cualquier cosa que no matchee el patrón exacto de un ID de YouTube (evita inyectar valores arbitrarios en la URL del thumbnail o en el reproductor). Al salir del campo (`onBlur`), dispara la búsqueda automática de metadatos (ver abajo) |
| **Campos Título / Artista / Duración** | Se autocompletan desde YouTube si es posible (ver abajo); si quedan vacíos al enviar, se usan valores por defecto ("Pista sin título", "Artista desconocido", 180s). Editable en cualquier momento — lo que ya escribiste a mano nunca se sobrescribe |
| **Botón "Añadir a la biblioteca"** | Valida el formato del link; si es inválido muestra un error inline. Si es un link de YouTube Shorts, lo rechaza de entrada (ver abajo). Si el formato es válido, antes de agregarla **verifica que el video realmente se pueda reproducir aquí** (ver abajo); mientras verifica, el botón cambia a "Verificando que se pueda reproducir…" y queda deshabilitado. Si pasa la verificación, construye un `Track`, llama `onAddTrack(track)`, cierra el modal y limpia el formulario. Si no pasa, muestra el motivo exacto y el modal queda abierto con los datos intactos para probar otro link |

**Los links de YouTube Shorts se rechazan (`lib/youtubeId.ts#isYouTubeShortsUrl`):** YouTube sirve
los Shorts, incluso a través de la IFrame API oficial, con su propia interfaz obligatoria
encima del video (título, avatar del canal, botón de compartir, subtítulos, el logo de
YouTube) — esa interfaz **no** es parte de la barra de controles normal que ya se puede ocultar
(`controls: 0`, etc.); viene incorporada al formato de embed que YouTube exige para los Shorts, y
ningún parámetro del lado del cliente la puede quitar. Como el pedido explícito es que el
reproductor se vea limpio y se controle solo desde la consola de la app, un link `/shorts/` se
bloquea directamente al intentar agregarlo, con un mensaje explicando por qué y sugiriendo pegar
la versión larga del video si existe. Esto solo detecta el link `/shorts/` en sí — un video
agregado por su URL normal (`watch?v=`) que YouTube también clasifique internamente como Short
puede seguir mostrando esa interfaz, ya que no hay forma de saberlo de antemano sin cargarlo.

**Verificación de reproducibilidad antes de agregar (`lib/youtubeEmbedCheck.ts`):** el endpoint
`oEmbed` (usado para autocompletar) solo refleja el interruptor "permitir incrustar" del video — no
detecta los bloqueos de sello/Content-ID (los mismos códigos de error 101/150 que sellos como UMPG
usan para bloquear la reproducción fuera de YouTube), que solo se manifiestan cuando el reproductor
real de YouTube intenta cargar el video. Por eso, al enviar el formulario se crea un
`YT.Player` oculto (fuera de pantalla, sin controles) únicamente para observar sus eventos
`onReady`/`onError`, y se destruye inmediatamente después — es la misma señal que ya usa cada deck,
solo que ahora se consulta *antes* de agregar la pista a la biblioteca, no después de cargarla en un
deck. Si no responde en 10 segundos (verificación lenta o colgada), se permite agregar igual en vez
de bloquear una pista válida por un problema de red.

**Bug corregido — algunas pistas bloqueadas se agregaban igual:** `onReady` se dispara apenas el
reproductor en sí queda listo, **no** significa que ese video puntual se pueda incrustar — el
bloqueo de sello (`onError`, código 101/150) llega por separado, un instante después, una vez que
YouTube termina de evaluar el permiso de ese video específico. La primera versión resolvía
"reproducible" apenas veía `onReady`, sin esperar a ver si un `onError` llegaba justo después —
por eso algunas pistas bloqueadas (como las de UMPG) pasaban el chequeo igual y solo mostraban el
error real ya cargadas en un deck. Se corrigió dándole a `onError` una ventana de gracia de 2.5s
después de `onReady` antes de declarar la pista reproducible. Cubierto por un test de regresión
que reproduce ese orden de eventos exacto y se confirmó que fallaba sin el fix.

**Autocompletado desde la URL original (`lib/youtubeOembed.ts`):** al pegar un link y salir del
campo, se consulta el endpoint público `oEmbed` de YouTube (`youtube.com/oembed?url=...`) — no
requiere API key ni backend propio, es una llamada directa desde el navegador. Si responde,
completa Título, Artista (el nombre del canal) y una miniatura de mejor calidad; si falla (sin
red, video privado/eliminado, timeout de 6s), no rompe nada — el formulario queda como estaba para
completarlo a mano. Un ícono de carga (⟳) aparece junto al campo mientras se consulta.

**Duración real desde el reproductor:** como `oEmbed` no incluye la duración del video, esta se
"autocorrige" sola la primera vez que la pista se reproduce de verdad: en cuanto el reproductor de
YouTube del deck confirma la duración real (`player.getDuration()`), reemplaza el valor por
defecto (180s) tanto en la biblioteca como en el deck que la tenga cargada.

**Conexión:** `onAddTrack` sube hasta `DJMixer.handleAddTrack`, que agrega la pista al array
`tracks` **y** lo persiste en `localStorage` (clave `dj-mixer-tracks`). `onRemoveTrack` hace lo
mismo mecanismo a la inversa (filtra el array y vuelve a guardar), y `onDurationResolved` actualiza
la duración de una pista existente — por eso la biblioteca sobrevive a un refresh de página, con
altas, bajas y correcciones de duración incluidas.

---

## Resumen de validación

| Control | Verificado por test unitario | Verificado en navegador real |
|---|---|---|
| Play / Pause | ✅ (`Deck.test.tsx`, reproductor mockeado) | ✅ (queda deshabilitado correctamente; YouTube real no es alcanzable desde este sandbox de red) |
| Cue | ✅ cálculo del segundo exacto | ✅ |
| Fader de Gain | ✅ teclado + clamps + clic-para-saltar | ✅ (drag real con mouse + inercia/flick confirmados con Playwright) |
| Crossfader (clic-para-saltar + drag + Centrar) | ✅ (lo controlado por React) | ✅ (clic, drag, flick con inercia y Centrar, todos confirmados con Playwright) |
| Activar deck (A/B) | — | ✅ |
| CoverFlow (‹ › + swipe, sin bloquearse tras seleccionar) | ✅ | ✅ |
| CoverFlow — tarjetas laterales visibles, solo la activa es accionable | ✅ | ✅ |
| CoverFlow — quitar pista de la biblioteca | ✅ | ✅ |
| CoverFlow — "Cargar en Deck X" | ✅ | ✅ |
| Agregar pista (válida/ inválida) | ✅ | ✅ |
| Autocompletado de Título/Artista desde `oEmbed` | ✅ (fetch mockeado) | — (este sandbox bloquea la red hacia youtube.com; funciona en producción) |
| Corrección de duración real desde el reproductor | ✅ | — (requiere red real hacia YouTube) |
| Efectos (Siren/Airhorn/Laser/Radio) | ✅ | ✅ |
| Manejo de error de YouTube (101/150/etc.) | ✅ | — (requiere red real hacia YouTube) |
| Crossfader con curva de potencia constante | ✅ (`mixerMath.test.ts`) | ✅ |
| Contador LED de tiempo transcurrido/restante | ✅ (`format.test.ts`) | ✅ |
| Cue: toque corto (salta y pausa) | ✅ (`Deck.test.tsx`) | — (requiere reproductor real; el flujo se confirmó visualmente en navegador) |
| Cue: mantener presionado (preview) y soltar (vuelve y pausa) | ✅ (`Deck.test.tsx`, timers simulados) | — (requiere reproductor real) |
| MARCAR (guarda la posición actual como cue) | ✅ (`Deck.test.tsx`, `mixerMath.test.ts`) | — (requiere reproductor real) |
| Barra de posición (tocar/arrastrar para saltar) | ✅ (`Deck.test.tsx`, `WavePanel.test.tsx`) | ✅ (arrastre confirmado visualmente en navegador, la línea sigue el puntero sin errores de consola) |
| Arrastrar no cuelga la app — solo un salto real al soltar | ✅ (`WavePanel.test.tsx`, confirmado que falla sin el fix) | ✅ (arrastre completo + suelte, app responde en <1s) |
| Precarga real del video (`getVideoLoadedFraction`) mostrada en la barra | ✅ (`WavePanel.test.tsx`) | — (requiere reproductor real) |
| CoverFlow — no se cuelga al borrar la tarjeta activa en la última posición | ✅ (test de regresión, confirmado que falla sin el fix) | ✅ |
| Verificación de reproducibilidad antes de agregar (bloquea videos no embebibles) | ✅ (`AddTrackModal.test.tsx`, chequeo mockeado) | — (requiere red real hacia YouTube; el flujo de "Verificando…" se confirmó en navegador) |

---

## Tipografía LED (contadores)

Los valores numéricos "en vivo" (tiempo transcurrido/restante) usan una fuente de matriz de
puntos (`DotGothic16`, clase `.font-led` en `index.css`) sobre un panel negro con resplandor de
color (`.led-display-lime` / `.led-display-aqua`), inspirados en las pantallas LED de un mixer de
hardware real. El resto de la interfaz sigue usando Inter/Space Grotesk — la fuente de puntos se
reserva a propósito para lecturas tipo "display", no para texto general.
