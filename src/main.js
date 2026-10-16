import * as THREE from 'three/webgpu';

import { createBackground } from './background.js';
import { createLines } from './lines.js';
import { createEditor } from './edit.js';
import { createBalls } from './balls.js';
import { createHolders, HOLDER_SIZE } from './holders.js';
import { playNote, holdNote, releaseNote, noteForX, startAudio } from './audio.js';

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
const balls = await createBalls(scene);
const holders = createHolders(scene);

// The note for a spot: on (or touching) a line it's that line's note,
// anywhere else it depends on where it is on screen (left = low)
const noteAt = (point) => {
  const line = lines.lineAt(point, HOLDER_SIZE / 2);
  if (line) return line.note;
  const screenX = point.clone().project(camera).x * 0.5 + 0.5;
  return noteForX(screenX);
};

const editor = createEditor(scene, lines, holders, {
  // a moved holder picks up the note of the spot it was dropped on
  onHolderMoved: (holder) => holders.setNote(holder, noteAt(holder.mesh.position)),
});

// ------------------------------------------------------------ modes
// "draw": drag to create a line, "edit": move/rotate lines,
// "balls": drop balls that bounce off the lines, "holders": place note blocks,
// "play": click lines to hear them. Clicking a holder toggles it in every mode.
let mode = 'draw';

const HINTS = {
  draw: 'Drag anywhere to draw a line. Longer = lower note.',
  edit: 'Drag a line or holder to move it. Drag the ring or scroll to rotate a line (Shift snaps). Delete removes it.',
  balls: 'Click to drop a ball, hold to keep dropping. Balls play a line\'s note when they hit it.',
  holders: 'Click to place a holder (on a line it takes that note). Click a holder to turn it on/off, Shift+click removes it.',
  play: 'Click, or hold and drag to keep playing. Left = low, right = high; lines play their own note.',
};

const setMode = (next) => {
  mode = next;
  for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === mode);
  hint.textContent = HINTS[mode];
  renderer.domElement.style.cursor = baseCursor();
  cancelDrawing();
  stopHolding();
  editor.deselect();
};

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}
clearButton.addEventListener('click', () => {
  stopHolding();
  editor.deselect();
  lines.clear();
  balls.clear();
  holders.clear();
});

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase(); // also works with caps lock on
  if (key === 'd') setMode('draw');
  else if (key === 'e') setMode('edit');
  else if (key === 'b') setMode('balls');
  else if (key === 'h') setMode('holders');
  else if (key === 'p') setMode('play');
  else if (key === 'escape') {
    cancelDrawing();
    editor.deselect();
  } else if ((key === 'delete' || key === 'backspace') && mode === 'edit') {
    editor.deleteSelected();
  }
});

// ------------------------------------------------------------ pointer
const mouse = new THREE.Vector2(0.5, 0.5); // 0..1, bottom-left origin like the shader
const smoothMouse = mouse.clone();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(); // -1..1
const drawPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // lines live on z = 0
const hitPoint = new THREE.Vector3();

let drawStart = null; // Vector3 while dragging a new line
let holding = false; // mouse button down in play mode
let heldLine = null; // the line that is sounding while holding
let heldNote = null; // the note that is sounding while holding
let dropping = false; // mouse button down in balls mode
let dropTimer = 0; // time until the next ball while holding
const DROP_INTERVAL = 0.15; // seconds between balls while holding

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

const holderUnderPointer = () => raycaster.intersectObjects(holders.meshes())[0]?.object.userData.holder ?? null;

const lineUnderPointer = () => raycaster.intersectObjects(lines.meshes())[0]?.object.userData.line ?? null;

// While holding, a note keeps sounding and follows the pointer: over a line
// it's that line's note, over the background it depends on x (left = low).
const holdAt = (e) => {
  const line = lineUnderPointer();
  const note = line ? line.note : noteForX(e.clientX / innerWidth);

  if (line && line !== heldLine) {
    lines.hit(line);
    pulseBackground(1);
  } else if (!line && note !== heldNote) {
    pulseBackground(0.3);
  }

  heldLine = line;
  heldNote = note;
  holdNote(note);
};

const stopHolding = () => {
  holding = false;
  heldLine = null;
  heldNote = null;
  dropping = false;
  releaseNote();
};

// drop a ball at the pointer, with a soft note for where it starts
const dropBall = () => {
  balls.drop(hitPoint.x, hitPoint.y);
  playNote(noteForX(mouse.x), 0.4);
  pulseBackground(0.1);
};

// the shader follows the mouse everywhere, also over the toolbar
addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
});

const canvas = renderer.domElement;

// the cursor for each mode when you're not over anything special
const baseCursor = () => (mode === 'edit' || mode === 'play' ? 'default' : 'crosshair');

canvas.addEventListener('pointerdown', (e) => {
  startAudio();
  updatePointer(e);

  // holders can be switched on and off in every mode except edit,
  // where they're moved instead
  const holder = mode === 'edit' ? null : holderUnderPointer();
  if (holder) {
    if (mode === 'holders' && e.shiftKey) {
      holders.remove(holder);
    } else {
      holders.toggle(holder);
      pulseBackground(0.3);
    }
    return;
  }

  if (mode === 'holders') {
    holders.toggle(holders.add(hitPoint, noteAt(hitPoint)));
    const line = lines.lineAt(hitPoint, HOLDER_SIZE / 2);
    if (line) lines.hit(line, 0.6);
    pulseBackground(0.3);
    return;
  }

  if (mode === 'draw') {
    drawStart = hitPoint.clone();
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  if (mode === 'balls') {
    dropping = true;
    dropTimer = DROP_INTERVAL;
    canvas.setPointerCapture(e.pointerId);
    dropBall();
    return;
  }

  if (mode === 'edit') {
    if (editor.pointerDown(raycaster, hitPoint)) {
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
    return;
  }

  holding = true;
  canvas.setPointerCapture(e.pointerId); // keep getting events outside the canvas

  holdAt(e);
});

canvas.addEventListener('pointermove', (e) => {
  updatePointer(e);

  if (mode === 'draw' && drawStart) {
    const { length, note, valid } = lines.updatePreview(drawStart, hitPoint);
    hint.textContent = valid ? `Length ${length.toFixed(1)} → ${note}` : 'Keep dragging…';
  } else if (mode === 'edit') {
    canvas.style.cursor = editor.pointerMove(raycaster, hitPoint, e.shiftKey);
  } else if (mode === 'play') {
    canvas.style.cursor = lineUnderPointer() ? 'pointer' : 'default';
    if (holding) holdAt(e);
  } else {
    canvas.style.cursor = baseCursor();
  }

  // show that a holder can be clicked, unless you're busy dragging something
  const busy = mode === 'edit' || drawStart || holding || dropping;
  if (!busy && holderUnderPointer()) canvas.style.cursor = 'pointer';
});

canvas.addEventListener('pointerup', (e) => {
  if (holding || dropping) stopHolding();
  if (mode === 'edit') {
    editor.pointerUp();
    canvas.style.cursor = editor.pointerMove(raycaster, hitPoint, e.shiftKey);
  }
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

canvas.addEventListener('pointercancel', () => {
  cancelDrawing();
  stopHolding();
  editor.pointerUp();
});

// scroll to rotate the selected line in edit mode
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'edit') return;
  // on macOS, Shift + scroll turns vertical scrolling into horizontal
  const delta = e.deltaY || e.deltaX;
  if (editor.wheel(delta, e.shiftKey)) e.preventDefault();
}, { passive: false });

// don't leave a note hanging when you switch tabs or windows mid-hold
addEventListener('blur', stopHolding);

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

  // keep dropping balls while holding in balls mode
  if (dropping) {
    dropTimer -= dt;
    if (dropTimer <= 0) {
      dropTimer += DROP_INTERVAL;
      dropBall();
    }
  }

  // ball hits flash less than clicks, so lots of balls don't get too flashy
  balls.step(dt, lines.lines, holders.holders, (line, strength) => {
    lines.hit(line, 0.25 + strength * 0.35);
    playNote(line.note, strength);
    pulseBackground(strength * 0.15);
  });

  lines.update(dt);
  holders.update(dt);
  // the line you're holding keeps glowing
  if (heldLine) heldLine.pulse.value = Math.max(heldLine.pulse.value, 0.5);

  renderer.render(scene, camera);
});
