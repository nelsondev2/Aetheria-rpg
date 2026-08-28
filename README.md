# ⚔️ AETHERIA — Crónicas de Otro Mundo

Un JRPG de fantasía **isekai** completo, hecho 100% con **HTML, CSS y JavaScript puro**.
Sin React, sin Node.js, sin dependencias externas: todo funciona en local, incluso
abriendo el juego directamente con doble clic (`file://`).

---

## 🎮 Cómo jugar

1. Descarga o descomprime esta carpeta.
2. Abre **`index.html`** con tu navegador (Chrome, Edge, Firefox…).
   - No necesita servidor: funciona con doble clic.
   - Opcional: `python -m http.server` y abre `http://localhost:8000`.
3. Pulsa ENTER o toca la pantalla y empieza tu leyenda.

## 🕹️ Controles

**Escritorio (teclado):**

| Tecla | Acción |
|-------|--------|
| **Flechas / WASD** | Moverte |
| **Z / E / ENTER / Espacio** | Confirmar · Hablar · Interactuar |
| **X / ESC** | Cancelar · Menú |
| **Shift (mantener)** | Correr |

**Móvil y tablet (diseño mobile-first, controles táctiles):**

| Control | Acción |
|---------|--------|
| **Cruceta virtual** (abajo-izquierda) | Moverte (desliza el dedo entre direcciones) |
| **Botón A** | Confirmar · Hablar · Interactuar · Avanzar diálogos |
| **Botón B** | Cancelar · Abrir el menú |
| **Botón CORRER** | Alterna correr (no hace falta mantener) |
| **Tocar el escenario** | Acepta / avanza diálogos y mensajes de combate |
| **Tocar opciones** | Menús, tienda, batalla y misiones son 100 % táctiles |
| **⛶** | Pantalla completa (Android/Chrome) |

La interfaz se dibuja a resolución nativa de pantalla: textos nítidos y
botones del tamaño de un dedo en cualquier dispositivo. En retrato, el
lienzo se coloca arriba y la interfaz ocupa el resto; en horizontal, el
juego llena la pantalla y los controles flotan en las esquinas.

## ✨ Características

- **Historia isekai completa**: un estudiante es invocado a Aetheria para derrotar
  al Rey Demonio Vorthak. Templo → Aldea → Bosque → Cavernas → Fortaleza → Nudo Sombrío.
- **4 héroes reclutables**: Alex (héroe invocado), Kira (espadachina),
  Elowen (maga élfica) y Fina (clériga), cada uno con su árbol de habilidades.
- **Combate por turnos estilo JRPG clásico**: orden por AGI, ataques, 25 habilidades,
  objetos, defender, huir, debilidades elementales, críticos, buffs/debuffs,
  jefes con fases de furia y animaciones (embestidas, partículas, flashes, sacudidas).
- **5 jefes únicos**: Viuda Carmesí, Gólem de Cristal, General Mordrax,
  Draco Infernal y Vorthak (2 fases).
- **26 monstruos**, 20+ objetos, armas/armaduras/accesorios equipables.
- **3 tiendas**, posada con descanso de pago, altar de guardado.
- **Misiones secundarias**: la reliquia robada, la flor de aurora y el camino peligroso.
- **Guardado en 3 ranuras** (localStorage) con pantalla de Continuar.
- **11 mapas** explorados con cámara suave, portales, cofres, iluminación dinámica
  de cuevas y antorchas.
- **Música chiptune y 20 efectos** generados proceduralmente con WebAudio
  (sin archivos de audio).
- **Arte anime**: ilustraciones de portada, batalla y cinemáticas; sprites estilo
  RPG Maker; retratos de diálogo para cada personaje.
- **UI JRPG**: ventanas con filigrana dorada, HUD de exploración (PS/PM/oro/lugar),
  barras de vida con alerta, emblema y pantalla de carga.

## 📁 Estructura

```
game/
├── index.html          ← ábreme
├── css/style.css       ← mobile-first (base móvil → escritorio)
├── js/
│   ├── audio.js        ← motor chiptune WebAudio
│   ├── data.js         ← habilidades, objetos, héroes, enemigos, tiendas
│   ├── manifest.js     ← atlas de tiles embebido (soporte file://)
│   ├── maps.js         ← los 11 mapas del mundo
│   ├── engine.js       ← motor: assets, input, render, colisiones
│   ├── battle.js       ← sistema de combate por turnos
│   ├── ui.js           ← diálogos, menús, tienda, guardado
│   ├── touch.js        ← gamepad táctil, escalado responsivo, taps
│   └── main.js         ← título, cinemáticas, arranque
└── assets/
    ├── sprites/        ← personajes, monstruos, retratos, props, atlas
    ├── bg/             ← fondos de batalla e ilustraciones
    └── tiles/          ← tilesets originales
```

## 📜 Créditos y licencias

- **Sprites de personajes, monstruos y caras**: Charles Gabriel & Antifarea
  ([OpenGameArt](https://opengameart.org), **CC-BY 3.0**).
- **Tilesets** Tiny32 / Tiny16 / Path & Objects: Lanea Zimmerman “Sharm” y
  colaboradores (CC-BY / CC0).
- **Ilustraciones de escenas y portada**: generadas con IA.
- **Código, música y diseño**: realizados a medida para este proyecto.

Los créditos también aparecen dentro del juego (menú del título → Créditos).

¡Que la luz de Aetheria te acompañe, héroe! 🌟
