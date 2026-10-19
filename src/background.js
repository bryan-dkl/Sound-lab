// background: the "Creation" shader behind the scene,
// with ripples where balls drop and notes hit

import { wgslFn, uniform, screenUV, screenSize, vec2, vec3, vec4, float } from 'three/tsl';
import * as THREE from 'three/webgpu';

import creationSource from './shaders/creation.wgsl?raw';

const creation = wgslFn(creationSource);

const RIPPLES = 12; // max at once, the oldest gets reused
const SPEED = 0.45; // ring growth, screen heights per second
const WIDTH = 0.04; // ring thickness
const FADE = 2.2; // how fast a ripple dies out
const WARP = 0.035; // how far the ring bends the pattern
const GLOW = 0.35; // how bright the coloured ring is

export const createBackground = (scene) => {
  const uniforms = {
    time: uniform(0),
    center: uniform(new THREE.Vector2(0.5, 0.5)),
    level: uniform(0),
    kick: uniform(0),
  };

  // shadertoy's y starts at the bottom, screenUV's at the top
  const fragUV = vec2(screenUV.x, screenUV.y.oneMinus());
  const aspect = vec2(screenSize.x.div(screenSize.y), 1);

  // ------------------------------------------------------------ ripples
  // each slot: where (0..1, bottom-left), age in seconds, colour, strength.
  // a big age means the slot is unused
  const ripples = Array.from({ length: RIPPLES }, () => ({
    position: uniform(new THREE.Vector2()),
    age: uniform(99),
    color: uniform(new THREE.Color()),
    strength: uniform(0),
  }));

  // unrolled: every slot adds a bend and a glow
  let warp = vec2(0);
  let glow = vec3(0);
  for (const ripple of ripples) {
    const delta = fragUV.sub(ripple.position).mul(aspect); // round rings, not stretched
    const distance = delta.length();
    const offset = distance.sub(ripple.age.mul(SPEED)).div(WIDTH);
    const ring = offset.mul(offset).negate().exp(); // a soft band at the ring's radius
    const wave = ring.mul(ripple.age.mul(-FADE).exp()).mul(ripple.strength);
    warp = warp.add(delta.div(distance.max(0.001)).mul(wave));
    glow = glow.add(ripple.color.mul(wave));
  }

  const color = creation({
    fragUV: fragUV.add(warp.mul(WARP)),
    res: screenSize,
    time: uniforms.time,
    center: uniforms.center,
    level: uniforms.level,
    kick: uniforms.kick,
  });

  // dim so the lines stand out, clicks brighten it a bit
  const brightness = uniforms.kick.mul(0.1).add(0.3);
  scene.backgroundNode = vec4(color.mul(brightness).add(glow.mul(float(GLOW))), 1.0);

  // start a ripple at x, y (0..1 from the bottom-left) in a colour
  const ripple = (x, y, tint, strength = 1) => {
    const slot = ripples.reduce((oldest, r) => (r.age.value > oldest.age.value ? r : oldest));
    slot.position.value.set(x, y);
    slot.color.value.copy(tint);
    slot.strength.value = strength;
    slot.age.value = 0;
  };

  const update = (dt) => {
    for (const r of ripples) r.age.value += dt;
  };

  return { ...uniforms, ripple, update };
};
