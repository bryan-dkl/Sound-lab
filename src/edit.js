// Edit mode: select a line, drag it somewhere else, or rotate it with the
// handle at its end (or the scroll wheel). Hold Shift to snap the angle.

import * as THREE from 'three/webgpu';

const HANDLE_GAP = 0.45; // distance between the end of the line and the handle
const SNAP = Math.PI / 12; // 15 degrees

export const createEditor = (scene, lines) => {
    let selected = null;
    let drag = null; // { type: 'move', offset } or { type: 'rotate' }
    // the unsnapped angle, so small scroll steps add up even while snapping
    let freeAngle = 0;

    // --------------------------------------------------------- rotate handle
    // A small ring past one end of the selected line, plus a bigger invisible
    // sphere around it so it's easy to grab
    const handle = new THREE.Group();
    handle.visible = false;
    scene.add(handle);

    const ringMaterial = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
    handle.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 32), ringMaterial));
    handle.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), ringMaterial));

    const handleHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 12),
        new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    handle.add(handleHit);

    const updateHandle = () => {
        handle.visible = selected !== null;
        if (selected) handle.position.copy(lines.endPoint(selected, HANDLE_GAP));
    };

    // --------------------------------------------------------- selection
    const select = (line) => {
        if (selected) lines.setSelected(selected, false);
        selected = line;
        if (selected) {
            lines.setSelected(selected, true);
            freeAngle = lines.getAngle(selected);
        }
        updateHandle();
    };

    const deselect = () => select(null);

    const deleteSelected = () => {
        if (!selected) return;
        const line = selected;
        deselect();
        lines.remove(line);
    };

    const rotateTo = (angle, snap) => {
        freeAngle = angle;
        lines.setAngle(selected, snap ? Math.round(angle / SNAP) * SNAP : angle);
        updateHandle();
    };

    // --------------------------------------------------------- pointer
    // raycaster is already aimed at the pointer, point is where it hits z = 0

    const pointerDown = (raycaster, point) => {
        if (selected && raycaster.intersectObject(handleHit).length > 0) {
            drag = { type: 'rotate' };
            return true;
        }

        const line = raycaster.intersectObjects(lines.meshes())[0]?.object.userData.line;
        if (line) {
            select(line);
            lines.hit(line);
            drag = { type: 'move', offset: line.mesh.position.clone().sub(point) };
            return true;
        }

        deselect();
        return false;
    };

    const pointerMove = (raycaster, point, shiftKey) => {
        if (drag?.type === 'move') {
            lines.setPosition(selected, point.x + drag.offset.x, point.y + drag.offset.y);
            updateHandle();
            return 'grabbing';
        }

        if (drag?.type === 'rotate') {
            const center = selected.mesh.position;
            rotateTo(Math.atan2(point.y - center.y, point.x - center.x), shiftKey);
            return 'grabbing';
        }

        // not dragging: show what you can do under the pointer
        if (selected && raycaster.intersectObject(handleHit).length > 0) return 'grab';
        if (raycaster.intersectObjects(lines.meshes()).length > 0) return 'move';
        return 'default';
    };

    const pointerUp = () => {
        drag = null;
    };

    // scroll wheel rotates the selected line a bit
    const wheel = (deltaY, shiftKey) => {
        if (!selected) return false;
        rotateTo(freeAngle - deltaY * 0.003, shiftKey);
        return true;
    };

    return {
        pointerDown,
        pointerMove,
        pointerUp,
        wheel,
        deselect,
        deleteSelected,
    };
};
