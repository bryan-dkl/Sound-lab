import * as THREE from 'three/webgpu';

import { createBackground } from './background.js';
import { createLines } from './lines.js';
import { playNote, noteForX, startAudio } from './audio.js';

const errorText = document.getElementById('error');
const modeButtons = document.querySelectorAll('[data-mode]');
const clearButton = document.getElementById('clear');
const hint = document.getElementById('hint');

const showError = (message) => {
  errorText.textContent = message;
  errorText.hidden = false;
};

// ---------------------------------------------------------------- renderer
// The background is raw WGSL, which only runs on a real WebGPU device.
// WebGPURenderer would silently fall back to WebGL2, so check first.
if (!navigator.gpu) {
  showError('WebGPU is not available in this browser. Try a recent Chrome or Edge (or Safari 26+).');
  throw new Error('No WebGPU');
}

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);
await renderer.init();

if (!renderer.backend.isWebGPUBackend) {
  showError('Your GPU fell back to WebGL, but this project needs real WebGPU.');
  throw new Error('WebGPU backend not available');
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

scene.add(new THREE.HemisphereLight(0x8899ff, 0x220022, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(4, 8, 10);
scene.add(sun);

const bg = createBackground(scene);
const lines = createLines(scene);

// ------------------------------------------------------------ modes
// "draw": drag to create a line, "play": click lines to hear them
let mode = 'draw';

const HINTS = {
  draw: 'Drag anywhere to draw a line. Longer = lower note.',
  play: 'Click a line to play it, or the background for a random tone.',
};

const setMode = (next) => {
  mode = next;
  for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === mode);
  hint.textContent = HINTS[mode];
  renderer.domElement.style.cursor = mode === 'draw' ? 'crosshair' : 'default';
  cancelDrawing();
};

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}
clearButton.addEventListener('click', () => lines.clear());

addEventListener('keydown', (e) => {
  if (e.key === 'd') setMode('draw');
  else if (e.key === 'p') setMode('play');
  else if (e.key === 'Escape') cancelDrawing();
});

// ------------------------------------------------------------ pointer
const mouse = new THREE.Vector2(0.5, 0.5); // 0..1, bottom-left origin like the shader
const smoothMouse = mouse.clone();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(); // -1..1
const drawPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // lines live on z = 0
const hitPoint = new THREE.Vector3();

let drawStart = null; // Vector3 while dragging a new line

const updatePointer = (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(drawPlane, hitPoint);
};

const cancelDrawing = () => {
  drawStart = null;
  lines.hidePreview();
  if (mode === 'draw') hint.textContent = HINTS.draw;
};

const pulseBackground = (amount) => {
  bg.kick.value = Math.min(1, bg.kick.value + amount);
  bg.level.value = Math.min(1, bg.level.value + amount * 0.1);
};

// the shader follows the mouse everywhere, also over the toolbar
addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
});

const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
  startAudio();
  updatePointer(e);

  if (mode === 'draw') {
    drawStart = hitPoint.clone();
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  const hit = raycaster.intersectObjects(lines.meshes())[0];
  if (hit) {
    const line = hit.object.userData.line;
    lines.hit(line);
    playNote(line.note);
    pulseBackground(1);
  } else {
    playNote(noteForX(e.clientX / innerWidth));
    pulseBackground(0.6);
  }
});

canvas.addEventListener('pointermove', (e) => {
  updatePointer(e);

  if (mode === 'draw' && drawStart) {
    const { length, note, valid } = lines.updatePreview(drawStart, hitPoint);
    hint.textContent = valid ? `Length ${length.toFixed(1)} → ${note}` : 'Keep dragging…';
  } else if (mode === 'play') {
    const overLine = raycaster.intersectObjects(lines.meshes()).length > 0;
    canvas.style.cursor = overLine ? 'pointer' : 'default';
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'draw' || !drawStart) return;
  updatePointer(e);

  const line = lines.addLine(drawStart, hitPoint);
  if (line) {
    // play the new line once so you hear what you made
    lines.hit(line);
    playNote(line.note);
    pulseBackground(0.6);
  }
  cancelDrawing();
});

canvas.addEventListener('pointercancel', cancelDrawing);

// ------------------------------------------------------------ resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------ main loop
const timer = new THREE.Timer();
timer.connect(document); // pauses correctly when the tab is hidden

setMode('draw');

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const dt = timer.getDelta();

  bg.time.value = timer.getElapsed();

  // the shader centre eases towards the mouse
  smoothMouse.lerp(mouse, 1 - Math.exp(-dt * 4));
  bg.center.value.copy(smoothMouse);

  // click effects fade out
  bg.kick.value *= Math.exp(-dt * 4);
  bg.level.value *= Math.exp(-dt * 2);

  lines.update(dt);

  renderer.render(scene, camera);
});
