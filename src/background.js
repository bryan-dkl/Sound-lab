// Background: the "Creation" shader (src/shaders/creation.wgsl) drawn behind
// the scene via scene.backgroundNode.

import { wgslFn, uniform, screenUV, screenSize, vec2, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

import creationSource from './shaders/creation.wgsl?raw';

const creation = wgslFn(creationSource);

export function createBackground(scene) {
  const uniforms = {
    time: uniform(0),
    center: uniform(new THREE.Vector2(0.5, 0.5)),
    level: uniform(0),
    kick: uniform(0),
  };

  const color = creation({
    // Shadertoy's fragCoord starts bottom-left, screenUV starts top-left
    fragUV: vec2(screenUV.x, screenUV.y.oneMinus()),
    res: screenSize,
    time: uniforms.time,
    center: uniforms.center,
    level: uniforms.level,
    kick: uniforms.kick,
  });

  // clicks briefly brighten the whole thing
  const brightness = uniforms.kick.mul(0.4).add(0.6);
  scene.backgroundNode = vec4(color.mul(brightness), 1.0);

  return uniforms;
}
