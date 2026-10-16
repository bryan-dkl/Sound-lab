// Edit mode: select a line or a holder and drag it somewhere else.
// Lines can also be rotated with the handle at their end (or the scroll
// wheel), hold Shift to snap the angle. Delete removes what's selected.

import * as THREE from 'three/webgpu';

const HANDLE_GAP = 0.45; // distance between the end of the line and the handle
const SNAP = Math.PI / 12; // 15 degrees

// onHolderMoved(holder) is called when a holder is dropped somewhere new,
// so it can pick up the note of its new spot
export const createEditor = (scene, lines, holders, { onHolderMoved }) => {
    let selected = null; // { type: 'line', line } or { type: 'holder', holder }
    let drag = null; // { type: 'move', offset, moved } or { type: 'rotate' }
    // the unsnapped angle, so small scroll steps add up even while snapping
    let freeAngle = 0;

    const selectedLine = () => (selected?.type === 'line' ? selected.line : null);
    const meshOf = (item) => (item.type === 'line' ? item.line.mesh : item.holder.mesh);

    // --------------------------------------------------------- rotate handle
    // A small ring past one end of the selected line, plus a bigger invisible
    // sphere around it so it's easy to grab. Holders don't rotate, so they
    // don't get one.
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
        const line = selectedLine();
        handle.visible = line !== null;
        if (line) handle.position.copy(lines.endPoint(line, HANDLE_GAP));
    };

    const overHandle = (raycaster) => selectedLine() !== null && raycaster.intersectObject(handleHit).length > 0;

    // --------------------------------------------------------- selection
    const highlight = (on) => {
        if (selected?.type === 'line') lines.setSelected(selected.line, on);
        if (selected?.type === 'holder') holders.setSelected(selected.holder, on);
    };

    const select = (item) => {
        highlight(false);
        selected = item;
        highlight(true);
        if (selected?.type === 'line') freeAngle = lines.getAngle(selected.line);
        updateHandle();
    };

    const deselect = () => select(null);

    const deleteSelected = () => {
        if (!selected) return;
        const item = selected;
        deselect();
        if (item.type === 'line') lines.remove(item.line);
        else holders.remove(item.holder);
    };

    const rotateTo = (angle, snap) => {
        freeAngle = angle;
        lines.setAngle(selectedLine(), snap ? Math.round(angle / SNAP) * SNAP : angle);
        updateHandle();
    };

    // What's under the pointer: holders first, since they sit on top of lines
    const itemUnderPointer = (raycaster) => {
        const holder = raycaster.intersectObjects(holders.meshes())[0]?.object.userData.holder;
        if (holder) return { type: 'holder', holder };
        const line = raycaster.intersectObjects(lines.meshes())[0]?.object.userData.line;
        if (line) return { type: 'line', line };
        return null;
    };

    // --------------------------------------------------------- pointer
    // raycaster is already aimed at the pointer, point is where it hits z = 0

    const pointerDown = (raycaster, point) => {
        if (overHandle(raycaster)) {
            drag = { type: 'rotate' };
            return true;
        }

        const item = itemUnderPointer(raycaster);
        if (!item) {
            deselect();
            return false;
        }

        select(item);
        if (item.type === 'line') lines.hit(item.line);
        drag = { type: 'move', offset: meshOf(item).position.clone().sub(point), moved: false };
        return true;
    };

    const pointerMove = (raycaster, point, shiftKey) => {
        if (drag?.type === 'move') {
            const x = point.x + drag.offset.x;
            const y = point.y + drag.offset.y;
            if (selected.type === 'line') lines.setPosition(selected.line, x, y);
            else holders.setPosition(selected.holder, x, y);
            drag.moved = true;
            updateHandle();
            return 'grabbing';
        }

        if (drag?.type === 'rotate') {
            const center = selectedLine().mesh.position;
            rotateTo(Math.atan2(point.y - center.y, point.x - center.x), shiftKey);
            return 'grabbing';
        }

        // not dragging: show what you can do under the pointer
        if (overHandle(raycaster)) return 'grab';
        if (itemUnderPointer(raycaster)) return 'move';
        return 'default';
    };

    const pointerUp = () => {
        if (drag?.moved && selected?.type === 'holder') onHolderMoved(selected.holder);
        drag = null;
    };

    // scroll wheel rotates the selected line a bit
    const wheel = (deltaY, shiftKey) => {
        if (!selectedLine()) return false;
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
