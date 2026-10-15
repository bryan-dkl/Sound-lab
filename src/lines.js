// Musical lines: glowing 3D capsules you draw yourself.
// Each line's length decides its note (longer = lower), and its colour
// follows the note so you can see the pitch at a glance.

import * as THREE from 'three/webgpu';
import { uniform, color, mix } from 'three/tsl';

import { NOTES, MIN_LENGTH, MAX_LENGTH, noteIndexForLength } from './audio.js';

const RADIUS = 0.12;

const tintForNote = (index) => {
    // low notes = warm red/orange, high notes = cool blue/violet
    return new THREE.Color().setHSL((index / (NOTES.length - 1)) * 0.75, 0.85, 0.55);
};

// A capsule between two points. CapsuleGeometry points along Y, so it is
// rotated to match the direction from start to end.
const capsuleBetween = (start, end) => {
    const length = start.distanceTo(end);
    const geometry = new THREE.CapsuleGeometry(RADIUS, length, 6, 16);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2;
    return { geometry, length, angle };
};

export const createLines = (scene) => {
    const group = new THREE.Group();
    scene.add(group);

    const lines = [];

    // --------------------------------------------------------- preview line
    // Shown while dragging, so you see the length and colour before letting go
    const previewTint = uniform(new THREE.Color());
    const previewMaterial = new THREE.MeshStandardNodeMaterial({
        roughness: 0.4,
        transparent: true,
        opacity: 0.6,
    });
    previewMaterial.colorNode = previewTint;
    previewMaterial.emissiveNode = previewTint.mul(0.4);

    const preview = new THREE.Mesh(new THREE.BufferGeometry(), previewMaterial);
    preview.visible = false;
    group.add(preview);

    const placeMesh = (mesh, start, end) => {
        const { geometry, length, angle } = capsuleBetween(start, end);
        mesh.geometry.dispose();
        mesh.geometry = geometry;
        mesh.position.copy(start).add(end).multiplyScalar(0.5);
        mesh.rotation.z = angle;
        return length;
    };

    // Clamp the end point so a line is never longer than MAX_LENGTH
    const clampEnd = (start, end) => {
        const dir = end.clone().sub(start);
        if (dir.length() > MAX_LENGTH) dir.setLength(MAX_LENGTH);
        return start.clone().add(dir);
    };

    const updatePreview = (start, end) => {
        end = clampEnd(start, end);
        const length = placeMesh(preview, start, end);
        const noteIndex = noteIndexForLength(length);
        previewTint.value.copy(tintForNote(noteIndex));
        preview.visible = length >= MIN_LENGTH;
        return { length, note: NOTES[noteIndex], valid: length >= MIN_LENGTH };
    };

    const hidePreview = () => {
        preview.visible = false;
    };

    // --------------------------------------------------------- real lines
    const addLine = (start, end) => {
        end = clampEnd(start, end);
        if (start.distanceTo(end) < MIN_LENGTH) return null;

        const mesh = new THREE.Mesh(new THREE.BufferGeometry());
        const length = placeMesh(mesh, start, end);
        const noteIndex = noteIndexForLength(length);

        const pulse = uniform(0);
        const tint = color(tintForNote(noteIndex));
        const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1 });
        material.colorNode = tint;
        // glow a little all the time, and flash white-ish when clicked
        material.emissiveNode = mix(tint, color(0xffffff), pulse.mul(0.5)).mul(pulse.mul(1.5).add(0.25));
        mesh.material = material;

        const line = { mesh, length, note: NOTES[noteIndex], pulse };
        mesh.userData.line = line;
        group.add(mesh);
        lines.push(line);
        return line;
    };

    const hit = (line) => {
        line.pulse.value = 1;
    };

    const clear = () => {
        for (const line of lines) {
            group.remove(line.mesh);
            line.mesh.geometry.dispose();
            line.mesh.material.dispose();
        }
        lines.length = 0;
    };

    const update = (dt) => {
        for (const line of lines) {
            line.pulse.value *= Math.exp(-dt * 5);
            // a quick wobble outwards when hit
            const s = 1 + line.pulse.value * 0.6;
            line.mesh.scale.set(s, 1, s);
        }
    };

    return {
        lines,
        meshes: () => lines.map((l) => l.mesh),
        updatePreview,
        hidePreview,
        addLine,
        hit,
        clear,
        update,
    };
};
