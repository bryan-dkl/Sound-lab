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
        const selected = uniform(0);
        const tint = color(tintForNote(noteIndex));
        const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1 });
        material.colorNode = tint;
        // glow a little all the time, flash white-ish when clicked,
        // and glow brighter while selected in edit mode
        material.emissiveNode = mix(tint, color(0xffffff), pulse.mul(0.5))
            .mul(pulse.mul(1.5).add(0.25).add(selected.mul(0.6)));
        mesh.material = material;

        const line = { mesh, length, note: NOTES[noteIndex], pulse, selected };
        mesh.userData.line = line;
        group.add(mesh);
        lines.push(line);
        return line;
    };

    const hit = (line) => {
        line.pulse.value = 1;
    };

    // --------------------------------------------------------- editing
    // Moving and rotating keep the length, so the note stays the same
    const setPosition = (line, x, y) => {
        line.mesh.position.set(x, y, 0);
    };

    // angle = direction the line points in, 0 = to the right
    const getAngle = (line) => line.mesh.rotation.z + Math.PI / 2;

    const setAngle = (line, angle) => {
        line.mesh.rotation.z = angle - Math.PI / 2;
    };

    // Where one end of the line is, plus some extra distance past it
    const endPoint = (line, extra = 0) => {
        const angle = getAngle(line);
        const reach = line.length / 2 + extra;
        return new THREE.Vector3(Math.cos(angle) * reach, Math.sin(angle) * reach, 0).add(line.mesh.position);
    };

    const setSelected = (line, on) => {
        line.selected.value = on ? 1 : 0;
    };

    const disposeLine = (line) => {
        group.remove(line.mesh);
        line.mesh.geometry.dispose();
        line.mesh.material.dispose();
    };

    const remove = (line) => {
        const index = lines.indexOf(line);
        if (index === -1) return;
        disposeLine(line);
        lines.splice(index, 1);
    };

    const clear = () => {
        for (const line of lines) disposeLine(line);
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
        setPosition,
        getAngle,
        setAngle,
        endPoint,
        setSelected,
        remove,
        clear,
        update,
    };
};
