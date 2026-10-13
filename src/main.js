import * as THREE from 'three/webgpu';

import { createBackground } from './background.js';
import { playTone } from './audio.js';

const errorText = document.getElementById('error');

function showError(message) {
  errorText.textContent = message;
  errorText.hidden = false;
}

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
camera.position.set(0, 0, 10);

const bg = createBackground(scene);

// ------------------------------------------------------------ interaction
const mouse = new THREE.Vector2(0.5, 0.5); // 0..1, bottom-left origin like the shader
const smoothMouse = mouse.clone();

addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
});

addEventListener('pointerdown', (e) => {
  playTone(e.clientX / innerWidth);
  bg.kick.value = 1;
  bg.level.value = Math.min(1, bg.level.value + 0.5);
});

// ------------------------------------------------------------ resize
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------ main loop
const timer = new THREE.Timer();
timer.connect(document); // pauses correctly when the tab is hidden

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

  renderer.render(scene, camera);
});
