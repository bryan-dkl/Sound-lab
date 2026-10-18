// Edit mode: select a line, holder or repeater and drag it somewhere else.
// Lines can also be rotated with the ring at one end (or the scroll wheel,
// hold Shift to snap the angle) and resized with the diamond at the other
// end, which changes their note. Scrolling on a repeater changes how often it
// drops a ball. Delete removes what's selected.

import * as THREE from 'three/webgpu';

const HANDLE_GAP = 0.45; // distance between the end of the line and the handle
const SNAP = Math.PI / 12; // 15 degrees
const SCROLL_STEP = 120; // scroll distance per repeater rate step

// collections: { line: lines, holder: holders, repeater: repeaters }. Each one
// has meshes(), setPosition(), setSelected() and remove(), and its meshes
// carry the item in userData under the same name (userData.line, ...).
//
// Callbacks:
// onMoved(item) when something was dragged somewhere new,
// onSelect(item) when the selection changes (null = nothing selected),
// onResize(line, noteChanged) while a line is being resized,
// onRate(repeater) when a repeater's rate changed.
export const createEditor = (scene, collections, { onMoved, onSelect, onResize, onRate }) => {
    const { line: lines } = collections;
    // picked in this order: holders and repeaters sit on top of lines
    const PICK_ORDER = ['holder', 'repeater', 'line'];

    let selected = null; // { type: 'line' | 'holder' | 'repeater', target }
    let drag = null; // { type: 'move', offset, moved }, { type: 'rotate' } or { type: 'resize' }
    // the unsnapped angle, so small scroll steps add up even while snapping
    let freeAngle = 0;
    let scrolled = 0; // scroll distance collected for repeater rate steps

    const selectedOf = (type) => (selected?.type === type ? selected.target : null);
    const selectedLine = () => selectedOf('line');

    // --------------------------------------------------------- handles
    // Past the ends of the selected line: a ring to rotate it and a diamond to
    // resize it. Each has a bigger invisible sphere around it so it's easy to
    // grab. Holders and repeaters don't rotate or resize, so they don't get any.
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
    const select = (item) => {
        if (selected) collections[selected.type].setSelected(selected.target, false);
        selected = item;
        if (selected) collections[selected.type].setSelected(selected.target, true);
        if (selected?.type === 'line') freeAngle = lines.getAngle(selected.target);
        scrolled = 0;
        updateHandles();
        onSelect?.(selected);
    };

    const deselect = () => select(null);

    const deleteSelected = () => {
        if (!selected) return;
        const item = selected;
        deselect();
        collections[item.type].remove(item.target);
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

    const itemUnderPointer = (raycaster) => {
        for (const type of PICK_ORDER) {
            const target = raycaster.intersectObjects(collections[type].meshes())[0]?.object.userData[type];
            if (target) return { type, target };
        }
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
        if (item.type === 'line') lines.hit(item.target);
        drag = { type: 'move', offset: item.target.mesh.position.clone().sub(point), moved: false };
        return true;
    };

    const pointerMove = (raycaster, point, shiftKey) => {
        if (drag?.type === 'move') {
            collections[selected.type].setPosition(selected.target, point.x + drag.offset.x, point.y + drag.offset.y);
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
        if (drag?.moved) onMoved?.(selected);
        drag = null;
    };

    // scroll wheel: rotates the selected line, or changes a repeater's rate
    const wheel = (deltaY, shiftKey) => {
        const repeater = selectedOf('repeater');
        if (repeater) {
            scrolled += deltaY;
            if (Math.abs(scrolled) >= SCROLL_STEP) {
                collections.repeater.changeRate(repeater, Math.sign(scrolled));
                scrolled = 0;
                onRate?.(repeater);
            }
            return true;
        }

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
        selectedItem: () => selected,
    };
};
