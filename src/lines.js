// Musical lines: glowing 3D capsules you draw yourself.
// Each line's length decides its note (longer = lower), and its colour
// follows the note so you can see the pitch at a glance. Its variant decides
// how it looks (and in audio.js, how it sounds).

import * as THREE from 'three/webgpu';
import { uniform, color, float, mix, uv, time, fract, smoothstep, normalView, positionViewDirection } from 'three/tsl';

import { NOTES, MIN_LENGTH, MAX_LENGTH, noteIndexForLength } from './audio.js';
import { variantById } from './variants.js';

export const tintForNote = (index) => {
    // low notes = warm red/orange, high notes = cool blue/violet
    return new THREE.Color().setHSL((index / (NOTES.length - 1)) * 0.75, 0.85, 0.55);
};

// A capsule between two points. CapsuleGeometry points along Y, so it is
// rotated to match the direction from start to end.
const capsuleBetween = (start, end, radius) => {
    const length = start.distanceTo(end);
    const geometry = new THREE.CapsuleGeometry(radius, length, 6, 16);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2;
    return { geometry, length, angle };
};

// ------------------------------------------------------------- materials
// Every variant flashes white-ish when hit (pulse) and glows brighter when
// selected in edit mode; on top of that each one has its own look.
// tint and length are uniforms, so resizing a line doesn't need a new material.
const createMaterial = (variantId, tint, pulse, selected, length) => {
    const flash = mix(tint, color(0xffffff), pulse.mul(0.5)).mul(pulse.mul(1.5).add(selected.mul(0.6)));

    if (variantId === 'glass') {
        // see-through, with a glow around the edges (fresnel: stronger where the
        // surface turns away from the camera)
        const rim = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(2);
        const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.05, metalness: 0, transparent: true });
        material.colorNode = tint.mul(0.6);
        material.opacityNode = rim.mul(0.5).add(0.45);
        material.emissiveNode = tint.mul(rim.mul(1.8).add(0.25)).add(flash);
        return material;
    }

    if (variantId === 'deep') {
        // dark, heavy metal with a faint glow
        const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.6 });
        material.colorNode = tint.mul(0.55);
        material.emissiveNode = tint.mul(0.12).add(flash);
        return material;
    }

    if (variantId === 'echo') {
        // glowing stripes that slowly run along the line, more on longer lines
        const stripes = fract(uv().y.mul(length.mul(2.5)).sub(time.mul(0.6)));
        const band = smoothstep(0.35, 0.5, stripes).mul(smoothstep(0.65, 0.5, stripes));
        const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.1 });
        material.colorNode = tint.mul(0.7);
        material.emissiveNode = tint.mul(band.mul(0.9).add(0.08)).add(flash);
        return material;
    }

    // classic: a soft glow all the time
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1 });
    material.colorNode = tint;
    material.emissiveNode = tint.mul(0.25).add(flash);
    return material;
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

    const placeMesh = (mesh, start, end, radius) => {
        const { geometry, length, angle } = capsuleBetween(start, end, radius);
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

    const updatePreview = (start, end, variantId) => {
        end = clampEnd(start, end);
        const length = placeMesh(preview, start, end, variantById(variantId).radius);
        const noteIndex = noteIndexForLength(length);
        previewTint.value.copy(tintForNote(noteIndex));
        preview.visible = length >= MIN_LENGTH;
        return { length, note: NOTES[noteIndex], valid: length >= MIN_LENGTH };
    };

    const hidePreview = () => {
        preview.visible = false;
    };

    // --------------------------------------------------------- real lines
    const addLine = (start, end, variantId = 'classic') => {
        end = clampEnd(start, end);
        if (start.distanceTo(end) < MIN_LENGTH) return null;

        const variant = variantById(variantId);
        const mesh = new THREE.Mesh(new THREE.BufferGeometry());
        const length = placeMesh(mesh, start, end, variant.radius);
        const noteIndex = noteIndexForLength(length);

        const pulse = uniform(0);
        const selected = uniform(0);
        const tintColor = tintForNote(noteIndex);
        const tint = uniform(tintColor.clone());
        const lengthUniform = uniform(length);
        mesh.material = createMaterial(variant.id, tint, pulse, selected, lengthUniform);

        const line = {
            mesh,
            length,
            note: NOTES[noteIndex],
            variant: variant.id,
            radius: variant.radius,
            tintColor,
            tint,
            lengthUniform,
            pulse,
            selected,
        };
        mesh.userData.line = line;
        group.add(mesh);
        lines.push(line);
        return line;
    };

    // amount 0..1: how strong the flash is (a click = 1, a soft ball hit less)
    const hit = (line, amount = 1) => {
        line.pulse.value = Math.max(line.pulse.value, amount);
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

    // Swap a line to another variant: new thickness and material, same note
    const setVariant = (line, variantId) => {
        const variant = variantById(variantId);
        if (variant.id === line.variant) return;
        line.variant = variant.id;
        line.radius = variant.radius;

        line.mesh.geometry.dispose();
        line.mesh.geometry = new THREE.CapsuleGeometry(variant.radius, line.length, 6, 16);
        line.mesh.material.dispose();
        line.mesh.material = createMaterial(variant.id, line.tint, line.pulse, line.selected, line.lengthUniform);
    };

    // Resize a line while keeping one end where it is (the end with the rotate
    // ring). The length decides the note, so the note and colour change too.
    const setLength = (line, length) => {
        length = THREE.MathUtils.clamp(length, MIN_LENGTH, MAX_LENGTH);
        const anchor = endPoint(line);
        const angle = getAngle(line);

        line.length = length;
        line.lengthUniform.value = length;
        line.mesh.geometry.dispose();
        line.mesh.geometry = new THREE.CapsuleGeometry(line.radius, length, 6, 16);
        // the centre sits half a length back from the anchor
        line.mesh.position.set(anchor.x - Math.cos(angle) * length / 2, anchor.y - Math.sin(angle) * length / 2, 0);

        const noteIndex = noteIndexForLength(length);
        line.note = NOTES[noteIndex];
        line.tintColor = tintForNote(noteIndex);
        line.tint.value.copy(line.tintColor);
        return line.note;
    };

    // The line that passes within `reach` of a point, or null
    const lineAt = (point, reach) => {
        const segment = new THREE.Line3();
        const closest = new THREE.Vector3();
        for (const line of lines) {
            segment.set(endPoint(line), endPoint(line, -line.length)); // both ends
            segment.closestPointToPoint(point, true, closest);
            if (closest.distanceTo(point) <= reach + line.radius) return line;
        }
        return null;
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
        lineAt,
        setVariant,
        setLength,
        setSelected,
        remove,
        clear,
        update,
    };
};
