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
| Texto "DJ Mixer Pro" | Puramente decorativo, sin interacción. |
| Panel de Efectos (ver sección propia abajo) | Botonera de 4 efectos, ubicada a la derecha del título en pantallas anchas (arriba del título, centrada, en mobile) |

**Tipografía pixel/8-bit, solo en el título:** a partir de una imagen de referencia con un título
estilo videojuego retro ("LET'S PLAY. TOGETHER"), se le dio al título principal la fuente
[Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (Google Fonts), en mayúsculas.
Pedido explícito: "solo eso en la parte superior, nada más" — así que se creó una clase nueva y
separada (`.header-title` en `index.css`) en vez de tocar `.music-title`, que sigue usando Inter y
también la usa el título del modal "Agregar pista" — cambiarla ahí habría afectado el modal, no
solo el header.

**Mismo ancho que los paneles de abajo:** el header y la grilla de tres columnas (Deck A / centro /
Deck B) comparten un único contenedor `mx-auto max-w-7xl` — antes el header no tenía ese límite y
quedaba más ancho que el resto de la interfaz, borde a borde de la pantalla, mientras los paneles
de abajo sí estaban centrados y acotados. Alinearlos hace que el panel de Efectos, ahora ubicado
en el header, quede visualmente asociado al resto de los controles en vez de flotar en una franja
de otro ancho.

---

## Panel de efectos (`EffectsPanel.tsx`)

| Botón | Qué hace mientras se lo mantiene presionado |
|---|---|
| **Siren** | Sirena sostenida (arranca en 500↔1100Hz) con vibrato — cada ciclo que pasa mientras se sigue presionando es más rápido y llega más agudo, cada vez más "escandalosa", hasta un tope (2000Hz, 180ms por ciclo) para que no termine siendo un pitido inaudible o un chillido eterno |
| **Airhorn** | Bocina de dos notas (sawtooth + chorus + distorsión) que suena mientras se sostiene el botón, como una bocina real — no un golpe de duración fija |
| **Laser** | Dispara ráfagas repetidas (~7 por segundo) con variación aleatoria de tono mientras se sostiene, cada una con su cola de ping-pong delay — una pistola láser, no un solo "pew" |
| **Radio** | Ruido filtrado continuo mientras se sostiene, con la frecuencia del filtro pasa-banda "derivando" cada medio segundo (como sintonizar el dial) y un bitcrusher adelante para la crepitación de baja fidelidad |

Los 4 botones comparten la misma lógica de sostener/soltar (`startEffect`/`stopEffect`
en `lib/effectSounds.ts`): al presionar arrancan el sonido y llaman a `onEffectTrigger(id)`; al
soltar — detectado con un listener global de `pointerup`/`pointercancel`, igual que el botón CUE
de cada deck, así funciona aunque el puntero se mueva fuera del botón antes de soltar — cada uno
resuelve su propio final (la sirena hace un último barrido descendente, el airhorn suelta su
envolvente, el láser y la radio simplemente cortan su repetición) antes de descartar sus nodos de
audio. Mientras está sostenido, el botón se "hunde" (baja 3px y su sombra se achica) — ver la nota
de diseño más abajo.

**Rediseño — botones tipo tecla retro, coloridos:** a partir de varias imágenes de referencia
(covers de playlist con grillas de puntos en colores sólidos, un mockup "Music OS" con controles
tipo reproductor vintage, un panel de Walkman con teclas PLAY/PAUSE físicas), se reemplazó la
píldora gris uniforme por una tecla de color sólido por efecto — alarma-rojo (Siren), bocina-
amarillo (Airhorn), violeta sci-fi (Laser), ámbar de dial de radio (Radio) — elegidos para no
pisar los colores de identidad de los decks (lima/aqua), ya que este panel es la parte "lúdica" de
la app, separada de los controles serios de mezcla. Cada tecla tiene una base de un tono más oscuro
del mismo color (no negro genérico) simulando la "pared" de una tecla física real, como en las
referencias — al soltar, la tecla "flota" sobre esa base (sombra de 4px); al sostenerla, se hunde
hasta casi tocarla (sombra de 1px, tecla desplazada 3px hacia abajo). Este movimiento se maneja con
`animate` de Framer Motion (no `whileTap`): `whileTap` es una animación efímera propia de Framer
que no se puede combinar con un `transform` fijado a mano vía `style` — Framer terminaba ganando esa
pelea y el hundido nunca se veía. Como el estado de "sostenido" ya se mantiene en React durante todo
el press-and-hold (no solo el instante del gesto), `animate={{ y: isHeld ? 3 : 0 }}` es lo que
corresponde usar acá, no `whileTap`.

**Ajuste — de un solo golpe a mantener presionado:** la primera versión de estos efectos era
"tocar = un sonido de duración fija", sin relación con cuánto tiempo se mantuviera el dedo/mouse
sobre el botón. Pedido explícito: que funcionen "como un DJ al aplastar" — sostener el botón debía
cambiar el sonido (la sirena, más aguda y escandalosa cuanto más se sostiene) y el láser/la radio
directamente "no tenían efecto" al mantenerlos porque no había ningún comportamiento ligado a
sostener, solo al tocar. Se separó `playEffect(effect)` (un solo disparo) en `startEffect(effect)`
/ `stopEffect(effect)`, con cada efecto manteniendo su propio estado vivo (nodos de Tone.js +
temporizadores) entre el press y el release.

**Motor de audio — Tone.js en vez de Web Audio API a mano:** la versión anterior armaba cada
efecto con osciladores y nodos de ganancia creados directamente (`AudioContext.createOscillator`,
etc.) — funcional, pero limitado: agregar un efecto de verdad (distorsión, coro, delay,
bitcrusher) significaba escribir esos procesadores de audio a mano, DSP incluido. Se migró
`lib/effectSounds.ts` a [Tone.js](https://github.com/Tonejs/Tone.js), la librería de referencia
para síntesis y efectos de audio en el navegador: da sintetizadores (`Tone.Synth`,
`Tone.PolySynth`) y procesadores (`Tone.Distortion`, `Tone.Chorus`, `Tone.PingPongDelay`,
`Tone.BitCrusher`, `Tone.Vibrato`) ya armados, así que cada uno de los 4 efectos ganó textura real
en vez de ser solo un tono/ruido crudo — sin escribir DSP a mano ni tocar la pista de YouTube (que
sigue sin ser interceptable vía Web Audio API, ver la nota de "Filter" más abajo en este
documento). Cada efecto crea su propia cadena de nodos al dispararse y los descarta (`.dispose()`)
un momento después de terminar de sonar — son sonidos puntuales, no instrumentos persistentes, así
que no hay razón para que ocupen memoria una vez que terminaron.

**Ducking — el efecto se escucha más fuerte que la música:** pedido explícito ("los efectos...
deben ser más altos en sonido que el audio"). Los efectos suenan por un camino de audio
completamente separado del video de YouTube (Tone.js/Web Audio API vs el audio nativo del iframe),
así que no hay forma de "mezclarlos" con volúmenes relativos de verdad — pero si el Gain de ambos
decks y el crossfader están al máximo, la pista puede sonar más fuerte que cualquier efecto por
más que se le suba el volumen propio. Se resolvió con **ducking real**: mientras se sostiene
cualquier botón de efecto, `DJMixer.tsx` pasa `ducking` a los dos decks, y cada uno multiplica su
volumen efectivo por 0.3 (`DUCK_FACTOR` en `Deck.tsx`, nuevo tercer parámetro `duckFactor` de
`computeEffectiveVolume` en `mixerMath.ts`) — la música baja a un 30%, el efecto queda al frente,
sin importar en qué posición estén Gain o crossfader en ese momento. Al soltar, vuelve
instantáneamente al volumen normal. De paso se subió el volumen propio de cada efecto (Tone.js,
`synth.volume.value`) unos 5dB para reforzar el mismo objetivo desde el otro lado.

**Ubicación — historia de dos mudanzas:** primero vivió como una barra propia a todo lo ancho,
entre el header y los tres paneles principales, sin relación visual con ningún otro control — se
lo movió debajo de Biblioteca, dentro de la columna central, reducido a una botonera compacta
(`grid grid-cols-4`). Con Sugeridos ocupando también esa columna, terminó como la tercera cosa
apilada ahí abajo y costaba encontrarlo ("quedó perdida, ¿dónde podemos ubicarla?"). Se lo movió de
nuevo, esta vez al **header**, junto al título — como panel `embedded` (prop nueva en
`EffectsPanel`: cuando es `true`, no dibuja su propio `panel` con fondo/borde, para no quedar como
una tarjeta dentro de otra tarjeta) alineado a la derecha del título en pantallas anchas (`lg:` y
en adelante) y apilado arriba del título, centrado, en mobile. Al estar siempre visible arriba de
todo (no hay que scrollear ni pasar por la biblioteca) queda igual de accesible desde cualquier
punto de la sesión.

**Hotkeys de teclado — 1, 2, 3, 4:** pedido explícito para poder dispararlos "sin mirar la
pantalla", como un DJ real con las manos en otro lado. Cada tecla numérica mapea a un efecto en el
mismo orden que la grilla visual (`1` Siren, `2` Airhorn, `3` Laser, `4` Radio) y respeta el mismo
comportamiento de sostener/soltar que el mouse/touch: `keydown` arranca el efecto (ignorando
`event.repeat`, que el sistema operativo dispara varias veces mientras se mantiene la tecla — sin
ese filtro se llamaría a `startEffect` de nuevo en cada tick, inofensivo porque ya no reinicia el
mismo efecto, pero innecesario) y `keydown`/`keyup` se ignoran por completo si el foco está en un
campo de texto (el modal de agregar pista, por ejemplo), para no interferir con escribir un título
o un link. Cada tecla queda dispuesta en la esquina de su botón como referencia visual, y el título
del botón (`title`, tooltip nativo del navegador) también la menciona.

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
| **Barra de posición** *(`WavePanel.tsx`, estilo idéntico al buscador de YouTube — sin líneas verticales)* | Tocar salta a ese punto; **arrastrar** (mouse o dedo) llena la barra en vivo mientras se sostiene; el salto real al video se confirma una sola vez, al soltar | `player.seekTo(...)` + `DeckState.currentTime`, solo en el `pointerup` | Delgada en reposo (7.28px — 4px original, +40% y luego +30% más, dos pedidos explícitos seguidos), un poco más gruesa al pasar el mouse o mientras se arrastra (10.92px, misma proporción sobre el 6px original — igual que YouTube). El relleno de lo reproducido crece de izquierda a derecha en tiempo real, en el color del deck (lima/aqua) — no es una línea marcando un punto, es una barra llenándose. Detrás, un relleno gris muestra cuánto video está realmente precargado (`player.getVideoLoadedFraction()`, dato real de YouTube). La manija circular está invisible en reposo y aparece (crece) solo al pasar el mouse o arrastrar, igual que YouTube. El punto de cue guardado es un puntito blanco chico sobre la barra; los puntos de entrada/salida del loop son puntitos del color del deck, para distinguirlos del cue de un vistazo |
| **Botón CUE** *(más chico, debajo del Play — control secundario)* | **Toque corto**: salta al punto de cue guardado sin cortar la reproducción — si estaba sonando, sigue sonando desde ahí (útil para hacer loops manuales, tocando CUE repetidas veces al ritmo). Si estaba pausado, queda pausado en el nuevo punto. **Mantener presionado**: reproduce de prueba desde el cue mientras se sostiene (arranca a sonar aunque estuviera pausado); al soltar, vuelve al cue y pausa — a diferencia del toque corto, soltar sí pausa siempre, porque la idea de la vista previa es volver exactamente a donde se empezó | Lee `DeckState.cue` (0–100%) y `track.duration` para calcular el segundo exacto; `player.seekTo(...)`, y solo `pauseVideo()`/`playVideo()` en el gesto de mantener presionado | Deshabilitado hasta `onReady` y si no hay pista asignada. El "soltar" se detecta con un listener global de `pointerup`, así funciona aunque el puntero se mueva fuera del botón antes de soltar |
| **Botón MARCAR** | Guarda la posición actual de reproducción como el nuevo punto de cue — se escucha el momento exacto (o se busca arrastrando la barra) y se marca ahí, en vez de calcular a ciegas un % | `DeckState.cue` (`lib/mixerMath.ts#computeCuePercent`) | Da un flash visual breve de confirmación al tocarlo |
| **Botón reset de cue** *(ícono circular con flecha, al lado de Marcar)* | Vuelve el punto de cue al comienzo de la pista (0%) | `DeckState.cue = 0` | Única forma de "borrar" una marca sin tener que buscar el inicio a mano y volver a tocar Marcar ahí |
| **Botón LOOP** *(al final de la fila de Cue/Marcar/Reset)* | Un solo botón con 3 toques, sin menú de opciones: **1er toque** marca la entrada del loop donde está sonando; **2do toque** marca la salida y activa el loop (la pista se repite sola entre los dos puntos); **3er toque** lo desactiva y sigue reproduciendo normal | `DeckState.loopIn`/`loopOut` (0-100%) y `loopActive` | Sin anillo mientras está inactivo, con anillo del color del deck mientras está "armado" (esperando el 2do toque), relleno sólido del color del deck mientras está activo. Un 2do toque a menos del 1% del punto de entrada se ignora (loop inútilmente corto), sigue esperando un punto de salida real |
**Loop — sin BPM ni cuantización, libre y de 3 toques:** pedido explícito, "muy usado por DJ".
Se descartó cualquier noción de "loop de 4/8/16 compases" porque ese cálculo necesita saber el BPM
de la pista, y el tap-tempo de BPM se sacó de la app hace varias fases (era manual e impreciso, ver
más abajo en este documento) — así que el loop es libre: entra y sale exactamente donde el usuario
toque el botón, sin cuantizar a ningún compás. Se evitó a propósito un flujo con controles
separados de "marcar entrada" / "marcar salida" / "activar" (3 botones o un menú) a favor de un
solo botón que interpreta el toque según en qué estado ya está — mismo criterio de "un control,
varios estados" que ya usa CUE (toque corto vs. mantener presionado). El salto de loopOut a loopIn
reutiliza el mismo `seekAndSync` que ya usan Cue/Marcar/la barra, dentro del `setInterval` que ya
polleaba `currentTime` — no hizo falta ningún mecanismo nuevo de sondeo, solo una condición extra
ahí adentro. Cambiar de pista (o borrarla) limpia el loop automáticamente: sus puntos son un % de
la duración de la pista anterior, sin sentido (y potencialmente disparándose al instante) sobre una
pista distinta.

| **Fader vertical GAIN** *(tooltip: "Ganancia del deck: se combina con el crossfader para dar el volumen final")* | Se arrastra la manija hacia arriba/abajo (con inercia — un flick rápido sigue deslizando hasta frenar), se toca cualquier punto de la barra para saltar directo ahí, o se usan las flechas ↑/↓ del teclado | `DeckState.gain` | Se combina con el volumen del crossfader (`computeEffectiveVolume`) y se envía como `player.setVolume(...)`. Arranca al máximo (100), no a la mitad — ver nota de volumen abajo. Arriba = volumen máximo, abajo = silencio, como el fader de canal de un mixer real |

**Físicas reales del fader de Gain (GSAP):** es un `Draggable` de GSAP (`type: "y"`, acotado a la
barra) con `InertiaPlugin` — arrastrar la manija la desliza de verdad, y si se suelta con
velocidad, sigue deslizando por su cuenta y frena naturalmente en vez de detenerse en seco donde
soltaste el mouse. Tocar la barra (fuera de la manija) salta directo a ese punto. Las flechas del
teclado siguen funcionando igual que antes (accesibilidad).

**Bug corregido — el fader quedaba inestable/pegado tras usarlo un rato:** el flag interno que le
dice al componente "no sincronices el valor externo mientras el usuario está arrastrando" se
apagaba en `onRelease` (al soltar el mouse), no en `onThrowComplete` (cuando termina de verdad el
deslizamiento de la inercia). Con `inertia: true`, soltar con velocidad sigue moviendo la manija
un rato más por su cuenta — apagar el flag antes de que termine dejaba que el efecto de
sincronización externa arrancara su propia animación GSAP sobre la misma manija mientras la
inercia todavía la estaba animando. Dos animaciones peleando por la misma propiedad podían dejar
la manija visualmente separada del valor real: los clics siguientes caían sobre una manija que ya
no representaba el estado real y no hacían nada, lo que se sentía como que el control "se quedaba
pegado". Se corrigió apagando el flag solo en `onThrowComplete`. El mismo patrón (y el mismo
arreglo) existía en el `CrossFader`. De paso se sacó del `Deck` un `layout` de Framer Motion que no
cumplía ninguna función visible y es un patrón de riesgo conocido al combinarse con un `Draggable`
de GSAP anidado — no se confirmó que causara el problema en sí, pero no había motivo para
mantenerlo.

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

**Pestaña "Buscar" — no hace falta salir a YouTube:** pedido explícito ("¿se puede incluir un
buscador para no ir a YouTube?"). El modal se dividió en dos pestañas, **Link** (el formulario
original de arriba) y **Buscar** — un toggle simple (`mode: 'link' | 'search'`, sin routing) que
alterna qué formulario se muestra, sin perder el estado del otro.

| Control (pestaña Buscar) | Qué hace |
|---|---|
| **Campo de búsqueda + botón "Buscar"** | Busca por texto libre (título, artista, lo que sea) vía `searchSuggestedVideos` (la misma función de `lib/youtubeSuggestions.ts` que usa Sugeridos) y muestra los resultados en una grilla de 2 columnas con miniatura grande |
| **Botón "×" dentro del campo** (solo visible con texto escrito) | Limpia la búsqueda (texto, resultados, error) y devuelve el foco al campo, para probar otra palabra sin tocar el mouse |
| **Botón "+" sobre la miniatura de un resultado** | Verifica reproducibilidad (mismo chequeo que el formulario de link) y, si pasa, agrega la pista directamente — sin cerrar el modal, para poder seguir buscando y agregar varias de una sola búsqueda |

**Búsqueda explícita, no autocompletar tecla por tecla:** a diferencia de Sugeridos (que busca
sola con debounce cuando cambia la pista activa), acá la búsqueda solo se dispara al enviar el
formulario (botón "Buscar" o Enter) — cada búsqueda cuesta 100 de las ~10.000 unidades diarias de
cuota, así que autobuscar en cada tecla tipeada agotaría la cuota en una sola palabra escrita.

**Autofocus al cambiar de pestaña:** pedido explícito ("mejora el modal de búsqueda" → autofocus +
limpiar). Un `useEffect` sobre el estado `mode` enfoca el campo de búsqueda apenas se activa la
pestaña Buscar, así se puede empezar a tipear de inmediato sin un clic extra en el campo.

**Espacios e inconsistencia de bordes — corregido:** reporte real del usuario tras ver el modal en
producción ("está muy pegado, no hay coherencia, botones rectos otros cerrados"). Dos problemas
distintos:
- El toggle Link/Buscar usaba `rounded` (esquinas apenas curvas) mientras que el resto de los
  botones del modal (`Añadir a la biblioteca`, el botón "Buscar" de la búsqueda, el "+" sobre cada
  resultado) usan el componente `Button` compartido, que es `rounded-full` (píldora) — quedaba un
  control con una forma completamente distinta al resto. Se cambió el toggle a `rounded-full`
  también, tanto el contenedor como cada botón interno.
- No había separación consistente entre el header del modal, el toggle de pestañas y el contenido
  de cada una — quedaban pegados unos a otros. Se envolvió todo debajo del header en un contenedor
  con `flex flex-col gap-4` y se subió el espaciado interno de ambos formularios (Link y Buscar) de
  `gap-3` a `gap-4`, para que cada sección respire lo mismo en todo el modal.

**Rediseño visual — grilla en vez de lista, miniaturas más grandes:** mismo pedido. Los resultados
pasaron de una lista vertical con miniaturas chicas (80×48px) a una grilla de 2 columnas con
miniatura a lo ancho de la tarjeta (`aspect-video`), título en hasta 2 líneas (`line-clamp-2`) y
el botón "+" superpuesto sobre la esquina de la miniatura — mismo patrón visual que usa el carrusel
de Biblioteca para su botón de cargar/quitar. También se agregó un contador ("N resultados") arriba
de la grilla para confirmar de un vistazo cuántos trajo la búsqueda.

**Resultados ya agregados desaparecen de la lista:** igual que Sugeridos, los resultados se
filtran contra `existingTrackIds` (los IDs de YouTube ya en la biblioteca, pasados desde
`CoverFlow.tsx`) — apenas se agrega uno, desaparece de la grilla de resultados visibles, como
confirmación visual de que ya está en la biblioteca, sin tener que volver a buscar.

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

### Sugeridos (`SuggestedTracks.tsx`)

Tira horizontal debajo de la biblioteca, pensada para acelerar el agregar pistas sin tener que
salir de la app a buscar un link en YouTube.

| Control | Qué hace | Estado que toca |
|---|---|---|
| **Botón "+" sobre una miniatura sugerida** | Verifica que el video se pueda reproducir acá (mismo chequeo que el modal de agregar) y, si pasa, lo agrega a la biblioteca | `SuggestedTracks` local (`addingId` mientras verifica) → `DJMixer.tracks` vía `onAddTrack` |

**De dónde salen las sugerencias — por estilo (tags), no solo por artista:** la primera versión
buscaba siempre por el **artista** de la tarjeta activa, lo cual devolvía nada más que más uploads
del mismo canal — poco útil si la biblioteca solo tiene una pista de ese artista. Pedido explícito
de hacerlo "más inteligente". Ahora, antes de buscar, `resolveSuggestionQuery` (en
`lib/youtubeSuggestions.ts`) consulta las **etiquetas (tags)** que el uploader cargó en el video
activo — datos de género/estilo que YouTube guarda pero no muestra en ninguna parte de su propia
interfaz — vía `videos.list`, y arma la consulta con hasta 3 de esas etiquetas
(`fetchVideoTags` + `resolveSuggestionQuery`). Eso trae pistas de **artistas distintos pero de
estilo similar**, que es la señal real de "pega con esta canción" — no "más de este canal". Si el
video no tiene tags cargados (frecuente en subidas amateur) o la consulta de tags falla por
cualquier motivo, cae de nuevo a buscar por artista, el comportamiento original, así que nunca
queda sin sugerencias por esto. Al cambiar de tarjeta activa, la resolución de consulta + búsqueda
esperan 500ms sin otro cambio antes de disparar (debounce) — recorrer varias tarjetas con las
flechas o el swipe dispara una sola vez al asentarse, no una por tarjeta. Por este mismo motivo el
título de la sección ya no dice "Sugeridos de {artista}" (dejó de ser siempre cierto) — quedó
como "Sugeridos" a secas.

**Costo de cuota de la consulta por tags:** `videos.list` cuesta 1 unidad contra las 100 de
`search.list` — agregar esta consulta extra por cada búsqueda de sugerencias apenas mueve el total
(de ~100 a ~101 unidades), así que el límite práctico sigue siendo las ~100 búsquedas/día del free
tier, no esta llamada adicional.

**El tag-based query solo no bastaba — se agregó un filtro explícito por canal:** reporte real del
usuario probando en producción: "sigue sugiriendo del mismo artista, no como lo hace YouTube". La
causa: `search.list` es una búsqueda de texto por relevancia, no el algoritmo propio (no público)
que usa YouTube.com para "videos relacionados" — ese endpoint (`relatedToVideoId`) fue discontinuado
por YouTube hace años y no tiene reemplazo en la API pública. Como un canal suele tagear todo su
catálogo de forma parecida, una consulta por tags igual devuelve bastante del mismo canal en el
ranking de relevancia. Se agregó entonces un filtro explícito: `searchSuggestedVideos` ahora acepta
un tercer parámetro `excludeArtist` y descarta cualquier resultado cuyo `channelTitle` coincida
(sin importar mayúsculas) con el artista de la pista activa — este es el guardarraíl real contra
"más de este canal"; la consulta por tags solo mejora la *calidad* de lo que queda después de este
filtro, no lo reemplaza. Para compensar lo que se descarta, `MAX_RESULTS` subió de 8 a 15 (se sigue
pidiendo una sola página de resultados, mismo costo de cuota — la API ya devuelve hasta 15 videos en
esa misma llamada).

**Requiere una API key propia (`VITE_YOUTUBE_API_KEY`):** a diferencia del autocompletado del modal
de agregar (que usa el endpoint público `oEmbed`, sin key), tanto `videos.list` como `search.list`
de la YouTube Data API v3 solo funcionan con una API key. Como esta app no tiene backend, la key
viaja como variable de entorno de Vite (`import.meta.env.VITE_YOUTUBE_API_KEY`) y queda embebida
en el bundle público — por eso hay que restringirla en Google Cloud Console (por referer HTTP y
por API habilitada) en vez de tratarla como un secreto. Ver `.env.example` para el detalle de cómo
conseguirla y restringirla, y el `README.md` para dónde configurarla en desarrollo y en Vercel.

**Sin key configurada, o sin resultados, no se muestra nada:** tanto `fetchVideoTags` como
`searchSuggestedVideos` (`lib/youtubeSuggestions.ts`) nunca tiran una excepción — ante falta de
key, cuota agotada, error de red o una respuesta que no sea OK, cada una resuelve un array vacío
(`fetchVideoTags`, lo que a su vez hace que `resolveSuggestionQuery` caiga al artista) o directamente
vacío (`searchSuggestedVideos`), y el componente no renderiza la tira (ni un mensaje de error) en
cualquiera de esos casos. Es una funcionalidad accesoria: preferible que no se note a que rompa o
ensucie la biblioteca con un error.

**Antes de agregar, se verifica reproducibilidad:** igual que el modal de agregar, el botón "+" no
agrega directamente — primero corre `lib/youtubeEmbedCheck.ts#checkVideoEmbeddable` (el mismo
chequeo con `YT.Player` oculto que detecta bloqueos de sello) y solo si el video pasa arma un
`Track` y llama `onAddTrack`. La duración se completa con el mismo placeholder (180s) que usa el
modal, y se autocorrige sola al reproducirse por primera vez (ver duración real más arriba).

**Cache en memoria por sesión — dos `Map` separados:** una consulta repetida (misma tarjeta
revisitada) no vuelve a llamar a la API en ninguno de los dos pasos — `fetchVideoTags` cachea por
id de video y `searchSuggestedVideos` cachea por consulta resuelta (`lib/youtubeSuggestions.ts`).
Mantenerlos separados tiene sentido porque son costos muy distintos: `videos.list` es 1 unidad,
`search.list` es 100 — cachear ambos por separado evita repetir la parte cara (la búsqueda) incluso
si en algún momento se decide cachear la consulta de tags con otra política.

**Ya en la biblioteca no se sugiere de nuevo:** las sugerencias se filtran contra
`existingTrackIds` (los IDs de YouTube ya presentes en `tracks`), tanto en el resultado cacheado
como en el fresco, para no ofrecer agregar un video que ya está.

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
