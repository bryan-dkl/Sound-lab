// background: the "Creation" shader behind the scene

import { wgslFn, uniform, screenUV, screenSize, vec2, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

import creationSource from './shaders/creation.wgsl?raw';

const creation = wgslFn(creationSource);

export const createBackground = (scene) => {
  const uniforms = {
    time: uniform(0),
    center: uniform(new THREE.Vector2(0.5, 0.5)),
    level: uniform(0),
    kick: uniform(0),
  };

  const color = creation({
    // shadertoy's y starts at the bottom, screenUV's at the top
    fragUV: vec2(screenUV.x, screenUV.y.oneMinus()),
    res: screenSize,
    time: uniforms.time,
    center: uniforms.center,
    level: uniforms.level,
    kick: uniforms.kick,
  });

  // dim so the lines stand out, clicks brighten it a bit
  const brightness = uniforms.kick.mul(0.1).add(0.3);
  scene.backgroundNode = vec4(color.mul(brightness), 1.0);

  return uniforms;
};
