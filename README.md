# Musical Lines

A small music toy in the browser, built with Three.js and WebGPU. You draw glowing 3D lines that each play a note: the longer the line, the lower the note. Then you play them yourself, or let physics balls bounce off them and make music on their own. A Shadertoy shader moves behind everything and reacts to your mouse and clicks.

Needs a browser with WebGPU: a recent Chrome or Edge, or Safari 26+.

## What's in it

| Tool | Key | What it does |
| --- | --- | --- |
| **Draw lines** | `D` | Drag to draw a line. Its length sets the note (pentatonic scale, so everything sounds fine together) and its colour. |
| **Line types** | `1`–`4` | **Classic** (soft synth), **Glass** (bell, an octave up, reverb), **Deep** (warm bass, an octave down, low-pass filter) and **Echo** (pluck with a ping-pong delay). Each one also looks different. |
| **Edit** | `E` | Move lines, holders and repeaters. On a line: drag the ring (or scroll) to rotate it and the diamond to resize it, which changes its note. `Delete` removes what's selected. |
| **Drop balls** | `B` | Click to drop a ball, hold to keep dropping. Balls bounce off lines and play their notes (harder hit = louder). |
| **Holders** | `H` | Blocks that hold a note. Placed on a line they take its note. Click one to turn its note on or off: when on, it keeps playing. |
| **Repeaters** | `R` | Portals that drop a ball on the beat (every 1, 2 or 4 beats, scroll in edit mode to change). Click one to pause it. |
| **Play** | `P` | Click or hold to play notes yourself. Hold and drag over lines to play them, the background goes from low (left) to high (right). |
| **Randomize** | `G` | Builds a random scene with at least one of everything. |
| **Clear all** | | Removes everything. |

## Built with

- [Three.js](https://threejs.org/) with `WebGPURenderer` and TSL (Three's shader language) for the 3D scene and the line, holder and portal materials
- WGSL, loaded into Three.js with `wgslFn`, for the two Shadertoy ports
- [Tone.js](https://tonejs.github.io/) for all the sound: synths, effects (reverb, filter, delay) and the held notes
- [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) for the ball physics
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
