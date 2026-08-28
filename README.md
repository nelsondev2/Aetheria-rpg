# ⚔️ AETHERIA — Crónicas de Otro Mundo

Un JRPG de fantasía **isekai** en **HTML, CSS y JavaScript puro**.
Sin React, sin Node, sin CDN: abre `index.html` (incluso con `file://`).

---

## 🎮 Cómo jugar

1. Abre **`index.html`** en el navegador (Chrome, Edge, Firefox…).
2. Pulsa ENTER o toca la pantalla y empieza tu leyenda.

Opcional: `python -m http.server` → `http://localhost:8000`.

## 🕹️ Controles

**Escritorio**

| Tecla | Acción |
|-------|--------|
| **Flechas / WASD** | Mover |
| **Doble toque de dirección** o **C** | Dash (invulnerable un instante) |
| **Z / A / ENTER / Espacio** | Atacar · Hablar · Interactuar |
| **1 – 4** | Habilidades |
| **Q** | Poción rápida |
| **Shift** | Correr |
| **X / ESC** | Menú |

**Móvil / tablet**

| Control | Acción |
|---------|--------|
| Cruceta | Mover (doble toque = dash) |
| **A** | Atacar / hablar / avanzar |
| **B** | Menú |
| **CORRER** | Alterna carrera |
| **✦ 1–4** | Magia (barra inferior) |
| Tocar el diálogo | Avanzar texto |
| **⛶** | Pantalla completa |

La primera vez que juegas aparece una ficha de controles (también en el menú).

## ✨ Características

- **Historia isekai**: invocado a Aetheria para derrotar a Vorthak.
  Templo → Aldea → Bosque → Cavernas → Fortaleza → Nudo Sombrío (+ pozo secreto).
- **4 héroes**: Alex, Kira, Elowen y Fina, con árboles de habilidades.
- **Combate en tiempo real sobre el mapa**: tajo (Z/A), magias 1–4, poción Q,
  dash, aliados automáticos, jefes con barra de vida. Música de batalla al acercarte.
- **5 jefes**: Viuda Carmesí, Gólem de Cristal, General Mordrax, Draco Infernal y Vorthak.
  Si sales a mitad de pelea, el jefe **sigue ahí** al volver.
- **Misiones** en el HUD (`!` / `?` sobre NPCs). Final bueno si las tres están hechas.
- **3 tiendas**, posada, altar de guardado (aviso al cerrar la pestaña si no guardaste).
- **11+ mapas**, portales etiquetados, brújula al borde de pantalla, iluminación de cuevas.
- **Música chiptune y SFX** por WebAudio (sin archivos de audio).
- **Vanilla y mobile-first**. Pesa ~2,6 MB.

## 📁 Estructura

```
├── index.html
├── css/style.css
├── js/          motor, combate, mapas, UI, audio
└── assets/      sprites, fondos, icono
```

## 📜 Créditos

- Sprites: Charles Gabriel & Antifarea (OpenGameArt, CC-BY 3.0).
- Tilesets Tiny32 / Tiny16: Lanea Zimmerman “Sharm” (CC-BY / CC0).
- Ilustraciones de escenas: IA.
- Código, música y diseño: a medida.

¡Que la luz de Aetheria te acompañe! 🌟
