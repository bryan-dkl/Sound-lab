import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site at https://bryan-dkl.github.io/WebGPU-ThreeJS-Challenge/
  // so every asset path needs this prefix. Must match the repo name exactly.
  base: '/WebGPU-ThreeJS-Challenge/',
  build: {
    // WebGPU + Rapier use top-level await, which needs a modern build target
    target: 'esnext',
  },
});
