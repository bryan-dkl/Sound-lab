// repeaters: tilted swirling portals dropping balls on a shared beat
// inside is a shadertoy port (src/shaders/repeater-portal.wgsl)

import * as THREE from 'three/webgpu';
import { wgslFn, uniform, uv, color, float, mix, dot, vec3, smoothstep } from 'three/tsl';

import portalSource from './shaders/repeater-portal.wgsl?raw';

const repeaterPortal = wgslFn(portalSource);

export const BPM = 100;
export const BEAT = 60 / BPM; // seconds per beat
const RATES = [1, 2, 4]; // a ball every 1, 2 or 4 beats
const RADIUS = 0.45;
const TILT = 1.1; // radians, opening faces down at you

export const createRepeaters = (scene) => {
  const repeaters = [];

  const ringGeometry = new THREE.TorusGeometry(RADIUS, 0.06, 12, 48);
  const discGeometry = new THREE.CircleGeometry(RADIUS, 48);
  // bigger untilted invisible disc, easy to click
  const hitGeometry = new THREE.CircleGeometry(RADIUS + 0.2, 24);
  const hitMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const add = (point, beat) => {
    const pulse = uniform(0); // flashes on a drop
    const spin = uniform(0); // swirl time, only runs while on
    const on = uniform(1); // eases 0 (paused) to 1 (on)
    const selected = uniform(0);

    const tint = color(0xf59714); // orange from the portal shader
    const glow = mix(float(0.25), float(1), on).add(pulse.mul(1.5)).add(selected.mul(0.5));

    // rim: glowing ring
    const ringMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.3 });
    ringMaterial.colorNode = tint.mul(0.4);
    ringMaterial.emissiveNode = mix(tint, color(0xffffff), pulse.mul(0.6)).mul(glow);

    // inside: portal shader, time = spin, so it speeds up
    // on a drop and freezes while paused
    const p = uv().mul(2).sub(1); // -1..1 across the disc
    const portal = repeaterPortal({ uv: p, time: spin.mul(0.25) });
    // subtle: dark parts see-through, toned down, fading at the rim
    const brightness = dot(portal, vec3(0.299, 0.587, 0.114));
    const edge = smoothstep(1, 0.8, p.length());
    const discMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    discMaterial.colorNode = portal.mul(glow.mul(0.8));
    discMaterial.opacityNode = brightness.mul(1.4).clamp(0, 1).mul(edge).mul(mix(float(0.5), float(1), on));

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    const tilted = new THREE.Group();
    tilted.rotation.x = TILT;
    tilted.add(ring, disc);

    const hit = new THREE.Mesh(hitGeometry, hitMaterial);

    const mesh = new THREE.Group();
    mesh.add(tilted, hit);
    mesh.position.set(point.x, point.y, 0);
    scene.add(mesh);

    const repeater = {
      mesh,
      hit,
      materials: [ringMaterial, discMaterial],
      pulse,
      spin,
      on,
      selected,
      active: true,
      every: 2, // beats between balls
      startBeat: beat + 1, // first ball next beat
    };
    hit.userData.repeater = repeater;
    repeaters.push(repeater);
    return repeater;
  };

  // each beat: drop(repeater) for the ones whose turn it is
  const onBeat = (beat, drop) => {
    for (const repeater of repeaters) {
      if (!repeater.active || beat < repeater.startBeat) continue;
      if ((beat - repeater.startBeat) % repeater.every !== 0) continue;
      repeater.pulse.value = 1;
      drop(repeater);
    }
  };

  // ball spawn: just below the middle
  const dropPoint = (repeater) => repeater.mesh.position.clone().add(new THREE.Vector3(0, -0.15, 0));

  const toggle = (repeater, beat) => {
    repeater.active = !repeater.active;
    if (repeater.active) repeater.startBeat = beat + 1;
  };

  // step the rate: +1 = slower, -1 = faster
  const changeRate = (repeater, direction) => {
    const index = RATES.indexOf(repeater.every) + direction;
    repeater.every = RATES[THREE.MathUtils.clamp(index, 0, RATES.length - 1)];
    return repeater.every;
  };

  // --------------------------------------------------------- editing
  const setPosition = (repeater, x, y) => {
    repeater.mesh.position.set(x, y, 0);
  };

  const setSelected = (repeater, on) => {
    repeater.selected.value = on ? 1 : 0;
  };

  const disposeRepeater = (repeater) => {
    scene.remove(repeater.mesh);
    for (const material of repeater.materials) material.dispose();
  };

  const remove = (repeater) => {
    const index = repeaters.indexOf(repeater);
    if (index === -1) return;
    disposeRepeater(repeater);
    repeaters.splice(index, 1);
  };

  const clear = () => {
    for (const repeater of repeaters) disposeRepeater(repeater);
    repeaters.length = 0;
  };

  const update = (dt) => {
    for (const repeater of repeaters) {
      const target = repeater.active ? 1 : 0;
      repeater.on.value += (target - repeater.on.value) * (1 - Math.exp(-dt * 6));
      // spins faster right after a drop
      repeater.spin.value += dt * repeater.on.value * (2 + repeater.pulse.value * 8);
      repeater.pulse.value *= Math.exp(-dt * 5);
    }
  };

  return {
    repeaters,
    meshes: () => repeaters.map((p) => p.hit),
    add,
    onBeat,
    dropPoint,
    toggle,
    changeRate,
    setPosition,
    setSelected,
    remove,
    clear,
    update,
  };
};
