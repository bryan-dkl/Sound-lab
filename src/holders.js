// holders: blocks that hold a note (a line's note, or by x)
// click to toggle, when on the note keeps playing

import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { uniform, color, float, mix, sin, time } from 'three/tsl';

import { NOTES, createDrone } from './audio.js';
import { tintForNote } from './lines.js';

export const HOLDER_SIZE = 0.6;

export const createHolders = (scene) => {
  const holders = [];
  const geometry = new RoundedBoxGeometry(HOLDER_SIZE, HOLDER_SIZE, HOLDER_SIZE, 4, 0.1);

  const add = (point, note) => {
    const step = NOTES.indexOf(note); // place in the scale
    const tintColor = tintForNote(step);
    const tint = uniform(tintColor.clone()); // uniform, so it can change colour
    const on = uniform(0); // eases 0 (off) to 1 (on)
    const selected = uniform(0);

    // off: dark, on: bright and breathing, selected: white glow
    const breathe = sin(time.mul(3)).mul(0.25).add(0.75);
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.2 });
    material.colorNode = mix(tint.mul(0.25), tint, on);
    material.emissiveNode = tint.mul(mix(float(0.1), breathe.mul(1.4), on)).add(color(0xffffff).mul(selected.mul(0.35)));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(point.x, point.y, 0);
    scene.add(mesh);

    const holder = { mesh, step, note, tintColor, tint, on, selected, active: false, drone: createDrone() };
    mesh.userData.holder = holder;
    holders.push(holder);
    return holder;
  };

  const toggle = (holder) => {
    holder.active = !holder.active;
    if (holder.active) holder.drone.start(holder.note);
    else holder.drone.stop();
  };

  // editing
  const setPosition = (holder, x, y) => {
    holder.mesh.position.set(x, y, 0);
  };

  // new note and colour, plays it if on
  const setNote = (holder, note) => {
    if (note === holder.note) return;
    holder.note = note;
    holder.step = NOTES.indexOf(note);
    holder.tintColor = tintForNote(holder.step);
    holder.tint.value.copy(holder.tintColor);
    if (holder.active) holder.drone.start(note);
  };

  // new scale or key: same step, new note, playing ones switch right away
  const retune = () => {
    for (const holder of holders) {
      holder.note = NOTES[holder.step];
      if (holder.active) holder.drone.start(holder.note);
    }
  };

  const setSelected = (holder, on) => {
    holder.selected.value = on ? 1 : 0;
  };

  const disposeHolder = (holder) => {
    holder.drone.dispose();
    scene.remove(holder.mesh);
    holder.mesh.material.dispose();
  };

  const remove = (holder) => {
    const index = holders.indexOf(holder);
    if (index === -1) return;
    disposeHolder(holder);
    holders.splice(index, 1);
  };

  const clear = () => {
    for (const holder of holders) disposeHolder(holder);
    holders.length = 0;
  };

  const update = (dt) => {
    for (const holder of holders) {
      // fade the glow instead of snapping
      const target = holder.active ? 1 : 0;
      holder.on.value += (target - holder.on.value) * (1 - Math.exp(-dt * 8));
    }
  };

  return {
    holders,
    meshes: () => holders.map((h) => h.mesh),
    add,
    toggle,
    setPosition,
    setNote,
    retune,
    setSelected,
    remove,
    clear,
    update,
  };
};
