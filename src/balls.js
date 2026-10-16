// Balls: 3D spheres with Rapier physics that fall and bounce off the lines.
// Every line gets a capsule collider that follows its mesh, so lines you
// move or rotate in edit mode push the balls around too. Holders get a box
// collider, so balls bounce off them as well.

import * as THREE from 'three/webgpu';
import { uniform, color, mix } from 'three/tsl';
import RAPIER from '@dimforge/rapier3d-compat';

import { HOLDER_SIZE } from './holders.js';

const BALL_RADIUS = 0.22;
const LINE_RADIUS = 0.12; // same thickness as the line meshes
const MAX_BALLS = 60;
const KILL_Y = -10; // balls below this have fallen off the screen
const FIXED_DT = 1 / 120;

export const createBalls = async (scene) => {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;
  const eventQueue = new RAPIER.EventQueue(true);

  // collider handle -> the ball or line it belongs to, for collision events
  const lookup = new Map();

  // --------------------------------------------------------- line colliders
  // line -> { body, collider }
  const lineBodies = new Map();

  const addLineBody = (line) => {
    const { position, quaternion } = line.mesh;
    // kinematic = not pushed around by balls, but we can move it by code
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(quaternion),
    );
    // CapsuleGeometry and Rapier's capsule both point along Y
    const collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(line.length / 2, LINE_RADIUS)
        .setRestitution(0.6)
        .setFriction(0.2),
      body,
    );
    lookup.set(collider.handle, { type: 'line', line });
    lineBodies.set(line, { body, collider });
  };

  const removeLineBody = (line) => {
    const { body, collider } = lineBodies.get(line);
    lookup.delete(collider.handle);
    world.removeRigidBody(body);
    lineBodies.delete(line);
  };

  // Make the physics match the lines on screen: add new ones, remove deleted
  // ones, and follow lines that were moved or rotated
  const syncLines = (lines) => {
    const current = new Set(lines);
    for (const line of lineBodies.keys()) {
      if (!current.has(line)) removeLineBody(line);
    }
    for (const line of lines) {
      if (!lineBodies.has(line)) {
        addLineBody(line);
        continue;
      }
      const { body } = lineBodies.get(line);
      body.setNextKinematicTranslation(line.mesh.position);
      body.setNextKinematicRotation(line.mesh.quaternion);
    }
  };

  // ------------------------------------------------------- holder colliders
  // holder -> body. Kinematic like the lines, so moving a holder in edit
  // mode pushes balls out of the way
  const holderBodies = new Map();

  const syncHolders = (holders) => {
    const current = new Set(holders);
    for (const [holder, body] of holderBodies) {
      if (current.has(holder)) continue;
      world.removeRigidBody(body);
      holderBodies.delete(holder);
    }
    for (const holder of holders) {
      if (holderBodies.has(holder)) {
        holderBodies.get(holder).setNextKinematicTranslation(holder.mesh.position);
        continue;
      }
      const { x, y } = holder.mesh.position;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, 0));
      const half = HOLDER_SIZE / 2;
      world.createCollider(RAPIER.ColliderDesc.cuboid(half, half, half).setRestitution(0.5), body);
      holderBodies.set(holder, body);
    }
  };

  // --------------------------------------------------------------- balls
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 24, 16);
  const balls = [];

  const drop = (x, y) => {
    if (balls.length >= MAX_BALLS) removeBall(balls[0]);

    // the ball lights up in the colour of the last line it hit
    const glow = uniform(0);
    const tint = uniform(new THREE.Color(0xffffff));
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0.4 });
    material.colorNode = mix(color(0xdde3ff), tint, glow);
    material.emissiveNode = tint.mul(glow.mul(1.2).add(0.15));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    scene.add(mesh);

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, 0)
        .enabledTranslations(true, true, false) // stay on the z = 0 plane with the lines
        .setCcdEnabled(true), // fast balls don't fly through thin lines
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(0.6)
        .setFriction(0.2)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );

    const ball = { mesh, body, collider, glow, tint, lastHit: 0 };
    lookup.set(collider.handle, { type: 'ball', ball });
    balls.push(ball);
    return ball;
  };

  const removeBall = (ball) => {
    lookup.delete(ball.collider.handle);
    world.removeRigidBody(ball.body);
    scene.remove(ball.mesh);
    ball.mesh.material.dispose();
    balls.splice(balls.indexOf(ball), 1);
  };

  const clear = () => {
    while (balls.length) removeBall(balls[0]);
  };

  // --------------------------------------------------------- simulation
  let accumulator = 0;

  // A ball hitting a line: find which is which, ignore soft touches
  // (rolling, resting) and call onHit(line, strength 0..1)
  const handleCollision = (handle1, handle2, started, onHit) => {
    if (!started) return;
    const a = lookup.get(handle1);
    const b = lookup.get(handle2);
    const line = a?.type === 'line' ? a.line : b?.type === 'line' ? b.line : null;
    const ball = a?.type === 'ball' ? a.ball : b?.type === 'ball' ? b.ball : null;
    if (!line || !ball) return;

    const v = ball.body.linvel();
    const speed = Math.hypot(v.x, v.y);
    const now = performance.now();
    if (speed < 1 || now - ball.lastHit < 80) return;
    ball.lastHit = now;

    ball.glow.value = 1;
    ball.tint.value.copy(line.tintColor);
    onHit(line, THREE.MathUtils.clamp(speed / 12, 0.2, 1));
  };

  const step = (dt, lines, holders, onHit) => {
    syncLines(lines);
    syncHolders(holders);

    // fixed steps so the physics behaves the same at any frame rate
    accumulator += Math.min(dt, 0.1);
    while (accumulator >= FIXED_DT) {
      world.step(eventQueue);
      accumulator -= FIXED_DT;
      eventQueue.drainCollisionEvents((h1, h2, started) => handleCollision(h1, h2, started, onHit));
    }

    // move the meshes to where the physics bodies are
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      const p = ball.body.translation();
      ball.mesh.position.set(p.x, p.y, p.z);
      ball.mesh.quaternion.copy(ball.body.rotation());
      ball.glow.value *= Math.exp(-dt * 3);
      if (p.y < KILL_Y) removeBall(ball);
    }
  };

  return { balls, drop, clear, step };
};
