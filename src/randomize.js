// Randomize: build a random scene with at least one of everything: lines
// (every variant at least once), holders, repeaters and balls. It's laid out
// so it plays straight away: repeaters along the top, a line under each one
// to catch its balls, more lines lower down for them to bounce on to.

import * as THREE from 'three/webgpu';

import { VARIANTS } from './variants.js';

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// a copy of the list in random order
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// bounds: the visible area on the z = 0 plane, { left, right, top, bottom }
// beat: the current beat, so new repeaters start in time with the rest
// noteAt(point): the note a holder at that point gets
export const randomizeScene = ({ lines, holders, repeaters, balls, bounds, beat, noteAt }) => {
  const margin = 0.8;
  const left = bounds.left + margin;
  const right = bounds.right - margin;
  const top = bounds.top - margin;
  const bottom = bounds.bottom + margin;
  const width = right - left;
  const height = top - bottom;

  // every variant at least once, then some random extras
  const lineCount = VARIANTS.length + 1 + Math.floor(Math.random() * 3);
  const variants = shuffle([...VARIANTS.map((v) => v.id), ...Array.from({ length: lineCount - VARIANTS.length }, () => pick(VARIANTS).id)]);

  // keep line centres apart so they don't pile up on each other
  const centres = [];
  const farEnough = (point) => centres.every((c) => c.distanceTo(point) > 1.6) && !lines.lineAt(point, 0.8);

  const addLine = (centre, variant) => {
    // a wide range of lengths gives a wide range of notes (and colours)
    const length = random(1, Math.min(7, width * 0.6));
    const angle = random(-0.45, 0.45); // gentle slopes so balls roll on
    const half = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(length / 2);
    // keep both ends on screen
    centre.x = THREE.MathUtils.clamp(centre.x, left + Math.abs(half.x), right - Math.abs(half.x));
    centres.push(centre);
    return lines.addLine(centre.clone().sub(half), centre.clone().add(half), variant);
  };

  // --------------------------------------------------------- repeaters
  // spread over the width, each with a line underneath to catch its balls.
  // Fewer on narrow screens (phones), so they don't overlap
  const fits = Math.max(1, Math.floor(width / 2.2));
  const repeaterCount = Math.min(fits, 2 + Math.floor(Math.random() * 2));
  const spacing = width / repeaterCount;
  const added = [];
  for (let i = 0; i < repeaterCount; i++) {
    const x = left + spacing * (i + 0.5) + random(-0.15, 0.15) * spacing;
    const repeater = repeaters.add(new THREE.Vector3(x, top - random(0, 0.4), 0), beat);
    repeater.every = pick([1, 2, 2, 4]); // every 2 beats most often
    const catcher = new THREE.Vector3(x + random(-0.5, 0.5), top - height * random(0.25, 0.4), 0);
    added.push(addLine(catcher, variants.pop()));
  }

  // --------------------------------------------------------- more lines
  // lower down, wherever there's room. If there's no free spot after some
  // tries it goes in anyway, so every variant still shows up
  const randomSpot = () => new THREE.Vector3(random(left, right), random(bottom, top - height * 0.35), 0);
  while (variants.length) {
    let centre = randomSpot();
    for (let tries = 0; tries < 30 && !farEnough(centre); tries++) centre = randomSpot();
    added.push(addLine(centre, variants.pop()));
  }

  // --------------------------------------------------------- holders
  // sitting on two of the lines, so they take those lines' notes
  const withHolders = shuffle(added.filter(Boolean)).slice(0, 2);
  withHolders.forEach((line, i) => {
    const along = random(-0.3, 0.3) * line.length;
    const angle = lines.getAngle(line);
    const point = line.mesh.position.clone().add(new THREE.Vector3(Math.cos(angle) * along, Math.sin(angle) * along, 0));
    const holder = holders.add(point, noteAt(point));
    if (i === 0) holders.toggle(holder); // one of them already on
  });

  // --------------------------------------------------------- balls
  // a few to get things going before the repeaters kick in
  const ballCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < ballCount; i++) {
    balls.drop(random(left, right), top - random(0, 0.5));
  }
};
