// Holders: blocks that hold a note. Placed on a line they take that line's
// note, anywhere else the note depends on x (left = low). Clicking a holder
// toggles it: when it's on, its note keeps playing until you turn it off.
// In edit mode they can be moved (and pick up the note of where they land).

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
    const tintColor = tintForNote(NOTES.indexOf(note));
    const tint = uniform(tintColor.clone()); // a uniform, so the colour can change when moved
    const on = uniform(0); // eases between 0 (off) and 1 (on)
    const selected = uniform(0);

    // off: dark with a faint glow, on: bright and slowly breathing,
    // selected in edit mode: a white glow on top
    const breathe = sin(time.mul(3)).mul(0.25).add(0.75);
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.2 });
    material.colorNode = mix(tint.mul(0.25), tint, on);
    material.emissiveNode = tint.mul(mix(float(0.1), breathe.mul(1.4), on)).add(color(0xffffff).mul(selected.mul(0.35)));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(point.x, point.y, 0);
    scene.add(mesh);

    const holder = { mesh, note, tintColor, tint, on, selected, active: false, drone: createDrone() };
    mesh.userData.holder = holder;
    holders.push(holder);
    return holder;
  };

  const toggle = (holder) => {
    holder.active = !holder.active;
    if (holder.active) holder.drone.start(holder.note);
    else holder.drone.stop();
  };

  // --------------------------------------------------------- editing
  const setPosition = (holder, x, y) => {
    holder.mesh.position.set(x, y, 0);
  };

  // give the holder a new note (and colour); if it's on, it plays the new one
  const setNote = (holder, note) => {
    if (note === holder.note) return;
    holder.note = note;
    holder.tintColor = tintForNote(NOTES.indexOf(note));
    holder.tint.value.copy(holder.tintColor);
    if (holder.active) holder.drone.start(note);
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
      // fade the glow in and out instead of snapping
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
    setSelected,
    remove,
    clear,
    update,
  };
};
