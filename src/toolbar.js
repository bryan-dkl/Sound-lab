// toolbar: drag by the header, collapse to the header
// remembers position and collapsed state, phones only collapse

const STORAGE_KEY = 'musical-lines-toolbar';
const MARGIN = 8; // px gap to the window edges

// localStorage can be blocked, then nothing is remembered
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
};

const save = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // fine, it just won't be remembered
  }
};

export const setupToolbar = (toolbar) => {
  const header = toolbar.querySelector('.toolbar-header');
  const collapseButton = toolbar.querySelector('#collapse');
  const phone = matchMedia('(max-width: 37.5rem)');

  const state = { x: null, y: null, collapsed: false, ...load() };
  let drag = null; // { offsetX, offsetY } while dragging

  // position
  // keep it fully on screen, also after resizing
  const place = () => {
    if (phone.matches || state.x === null) {
      toolbar.style.left = '';
      toolbar.style.top = '';
      return;
    }
    const maxX = innerWidth - toolbar.offsetWidth - MARGIN;
    const maxY = innerHeight - toolbar.offsetHeight - MARGIN;
    state.x = Math.max(MARGIN, Math.min(state.x, maxX));
    state.y = Math.max(MARGIN, Math.min(state.y, maxY));
    toolbar.style.left = `${state.x}px`;
    toolbar.style.top = `${state.y}px`;
  };

  header.addEventListener('pointerdown', (e) => {
    if (phone.matches || e.target.closest('button')) return;
    const rect = toolbar.getBoundingClientRect();
    drag = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    header.setPointerCapture(e.pointerId);
    toolbar.classList.add('dragging');
  });

  header.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.x = e.clientX - drag.offsetX;
    state.y = e.clientY - drag.offsetY;
    place();
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    toolbar.classList.remove('dragging');
    save(state);
  };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);

  // collapse
  const setCollapsed = (collapsed) => {
    state.collapsed = collapsed;
    toolbar.classList.toggle('collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Open menu' : 'Collapse menu';
    collapseButton.setAttribute('aria-label', label);
    collapseButton.title = `${label} (M)`;
    place(); // size changed, keep it on screen
    save(state);
  };

  const toggle = () => setCollapsed(!state.collapsed);

  collapseButton.addEventListener('click', toggle);
  header.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button')) toggle();
  });

  addEventListener('resize', place);
  phone.addEventListener('change', place);

  setCollapsed(state.collapsed);

  return { toggle };
};
