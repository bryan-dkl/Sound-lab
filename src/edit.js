// Edit mode: select a line or a holder and drag it somewhere else.
// Lines can also be rotated with the ring at one end (or the scroll wheel,
// hold Shift to snap the angle) and resized with the diamond at the other
// end, which changes their note. Delete removes what's selected.

import * as THREE from 'three/webgpu';

const HANDLE_GAP = 0.45; // distance between the end of the line and the handle
const SNAP = Math.PI / 12; // 15 degrees

// onHolderMoved(holder) is called when a holder is dropped somewhere new,
// so it can pick up the note of its new spot. onSelect(item) is called when
// the selection changes (item is null when nothing is selected).
// onResize(line, noteChanged) is called while a line is being resized.
export const createEditor = (scene, lines, holders, { onHolderMoved, onSelect, onResize }) => {
    let selected = null; // { type: 'line', line } or { type: 'holder', holder }
    let drag = null; // { type: 'move', offset, moved }, { type: 'rotate' } or { type: 'resize' }
    // the unsnapped angle, so small scroll steps add up even while snapping
    let freeAngle = 0;

    const selectedLine = () => (selected?.type === 'line' ? selected.line : null);
    const meshOf = (item) => (item.type === 'line' ? item.line.mesh : item.holder.mesh);

    // --------------------------------------------------------- handles
    // Past the ends of the selected line: a ring to rotate it and a diamond to
    // resize it. Each has a bigger invisible sphere around it so it's easy to
    // grab. Holders don't rotate or resize, so they don't get handles.
    const handleMaterial = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
    const hitMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false });

    const createHandle = (...meshes) => {
        const group = new THREE.Group();
        group.visible = false;
        group.add(...meshes);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), hitMaterial);
        group.add(hit);
        scene.add(group);
        return { group, hit };
    };

    const rotateHandle = createHandle(
        new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 32), handleMaterial),
        new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), handleMaterial),
    );

    const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), handleMaterial);
    diamond.rotation.z = Math.PI / 4;
    const resizeHandle = createHandle(diamond);

    const updateHandles = () => {
        const line = selectedLine();
        rotateHandle.group.visible = line !== null;
        resizeHandle.group.visible = line !== null;
        if (!line) return;
        rotateHandle.group.position.copy(lines.endPoint(line, HANDLE_GAP));
        // the other end: back past the whole line
        resizeHandle.group.position.copy(lines.endPoint(line, -line.length - HANDLE_GAP));
    };

    const over = (handle, raycaster) => selectedLine() !== null && raycaster.intersectObject(handle.hit).length > 0;

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
        updateHandles();
        onSelect?.(selected);
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
        updateHandles();
    };

    // The ring end stays put; the length is how far the pointer is from it,
    // measured along the line
    const resizeTo = (point) => {
        const line = selectedLine();
        const anchor = lines.endPoint(line);
        const angle = lines.getAngle(line);
        const length = (anchor.x - point.x) * Math.cos(angle) + (anchor.y - point.y) * Math.sin(angle) - HANDLE_GAP;
        const before = line.note;
        lines.setLength(line, length);
        updateHandles();
        onResize?.(line, line.note !== before);
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
        if (over(rotateHandle, raycaster)) {
            drag = { type: 'rotate' };
            return true;
        }
        if (over(resizeHandle, raycaster)) {
            drag = { type: 'resize' };
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
            updateHandles();
            return 'grabbing';
        }

        if (drag?.type === 'resize') {
            resizeTo(point);
            return 'grabbing';
        }

        if (drag?.type === 'rotate') {
            const center = selectedLine().mesh.position;
            rotateTo(Math.atan2(point.y - center.y, point.x - center.x), shiftKey);
            return 'grabbing';
        }

        // not dragging: show what you can do under the pointer
        if (over(rotateHandle, raycaster) || over(resizeHandle, raycaster)) return 'grab';
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
        selectedLine,
    };
};
