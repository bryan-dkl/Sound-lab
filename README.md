# Soundlab

A small music toy in the browser, built with Three.js and WebGPU. You draw glowing 3D lines that each play a note: the longer the line, the lower the note. Then you play them yourself, or let physics balls bounce off them and make music on their own. A Shadertoy shader moves behind everything and reacts to your mouse and clicks.

Needs a browser with WebGPU: a recent Chrome or Edge, or Safari 26+.

## What's in it

| Tool | Key | What it does |
| --- | --- | --- |
| **Draw lines** | `D` | Drag to draw a line. Its length sets the note and colour. Lines use the selected scale and key, and can be up to 10 units long. |
| **Line types** | `1`–`4` | **Classic** (soft synth), **Glass** (bell, an octave up, reverb), **Deep** (warm bass, an octave down, low-pass filter) and **Echo** (pluck with a ping-pong delay). Each one also looks different. |
| **Scale and key** | `S` / `K` | Cycle through major pentatonic, minor pentatonic, blues, major, minor, Dorian and Japanese scales. Change the root through all 12 keys. Hold `Shift` with either key to go backwards. Existing lines and active holders are retuned immediately. |
| **Edit** | `E` | Move lines, holders and repeaters. On a line: drag the ring (or scroll) to rotate it and the diamond to resize it, which changes its note. Scroll over a repeater to change its rate. `Delete` removes what's selected. |
| **Drop balls** | `B` | Click to drop a ball, hold to keep dropping. Balls bounce off lines and play their notes (harder hit = louder). |
| **Holders** | `H` | Blocks that hold a note. Placed on a line they take its note and stay connected to that line's sound. Click one to turn its note on or off: when on, it keeps playing. `Shift`+click removes it. |
| **Repeaters** | `R` | Portals that drop a ball on the shared 100 BPM beat, every 1, 2 or 4 beats. Scroll in edit mode to change the rate. Click one to pause or restart it; `Shift`+click removes it. |
| **Play** | `P` | Click or hold to play notes yourself. Hold and drag over lines to play them, the background goes from low (left) to high (right). |
| **Randomize** | `G` | Builds a random scene with lines for every sound type, repeaters with catcher lines, holders and balls. |
| **Clear all** | | Removes everything. |

The toolbar can be dragged by its grip and collapsed with the arrow or a double-click on its header. When editing, selected objects glow and the hint text shows the available action.

## Built with

- [Three.js](https://threejs.org/) with `WebGPURenderer` and TSL (Three's shader language) for the 3D scene and the line, holder and portal materials
- WGSL, loaded into Three.js with `wgslFn`, for the two Shadertoy ports
- [Tone.js](https://tonejs.github.io/) for all the sound: synths, effects (reverb, filter, delay) and the held notes
- [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) for the ball physics and collisions between balls, lines and holders
- [Vite](https://vite.dev/) for the dev server and build

## Shader credits

Both shaders were ported from GLSL to WGSL. Each `.wgsl` file in `src/shaders/` has the original code and notes on what changed in the port.

- **Background:** ["Creation" by Silexars](https://www.shadertoy.com/view/XsXXDn), in `src/shaders/creation.wgsl`. Fills the whole background. Its centre follows the mouse, and clicks and notes briefly brighten it.
- **Repeater portals:** [Shadertoy lcfyDj](https://www.shadertoy.com/view/lcfyDj), based on [cmzw_'s celestianmaze](https://x.com/cmzw_/status/1787147460772864188), in `src/shaders/repeater-portal.wgsl`. The swirl inside each repeater: it speeds up when a ball drops and freezes when the repeater is paused.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Every push to `main` builds the site and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.
