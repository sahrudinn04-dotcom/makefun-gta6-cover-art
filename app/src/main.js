// Vice Sunset editor: wires the page — photos in, layout and grade picked,
// caption typed, panels cropped by hand, PNGs out. The same drawCover the
// export uses also paints the live preview, so what you see is what ships.
import { SIZES, LAYOUTS, GRADES, drawCover, defaultPanels, panelAt } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const status = $('status');
const state = {
  photos: [],
  photoNames: [],
  panels: {},
  layout: 'hero',
  grade: 'sunset',
  title: 'SUNSET HEIST',
  subtitle: 'a neon coast story',
  size: 'portrait',
  selected: 0,
};

function slots() {
  if (!state.panels[state.layout]) state.panels[state.layout] = defaultPanels(state.layout, 0);
  return state.panels[state.layout];
}

/** Paints the preview at its own backing size for the chosen export size. */
function redraw() {
  const size = SIZES[state.size];
  const scale = 720 / size.w;
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  drawCover(preview, state);
  $('zoom').value = String(Math.round((slots()[state.selected]?.zoom || 1) * 100));
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${slots().length}`;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds a photo (a File or a sample URL) and fills empty panels with it. */
async function addPhoto(source, name) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = await loadImage(url);
  state.photos.push(img);
  state.photoNames.push(name);
  // Panels keep the photo they already show; the strip below assigns a
  // photo to the selected panel when it is clicked.
  renderPhotoStrip();
  redraw();
  status.textContent = `Loaded ${name} — ${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} in.`;
}

/** The strip of loaded photos; clicking one assigns it to the selected panel. */
function renderPhotoStrip() {
  const strip = $('photos');
  strip.innerHTML = '';
  state.photos.forEach((img, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 72;
    thumb.height = 54;
    const tctx = thumb.getContext('2d');
    const s = Math.max(72 / img.naturalWidth, 54 / img.naturalHeight);
    tctx.drawImage(img, (72 - img.naturalWidth * s) / 2, (54 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    thumb.title = `${state.photoNames[i]} — click to put it in panel ${state.selected + 1}`;
    thumb.className = 'thumb';
    thumb.addEventListener('click', () => {
      slots()[state.selected].photo = i;
      redraw();
      status.textContent = `${state.photoNames[i]} is in panel ${state.selected + 1}.`;
    });
    strip.appendChild(thumb);
  });
}

/** Renders one size to a fresh canvas at full export resolution. */
function renderExport(sizeId) {
  const size = SIZES[sizeId];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, { ...state, size: sizeId });
  return canvas;
}

/** Downloads a canvas as a PNG. */
function downloadPng(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportOne(sizeId) {
  const size = SIZES[sizeId];
  await downloadPng(renderExport(sizeId), `vice-sunset-${size.w}x${size.h}.png`);
  status.textContent = `Saved vice-sunset-${size.w}x${size.h}.png`;
}

async function exportAll() {
  for (const sizeId of Object.keys(SIZES)) {
    await exportOne(sizeId);
    await new Promise((r) => setTimeout(r, 350));
  }
  status.textContent = 'Saved all three sizes: 1080 x 1350, 1080 x 1080, 1920 x 1080.';
}

// ---------------------------------------------------------------- controls

$('file').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    await addPhoto(file, file.name);
  }
  e.target.value = '';
});
$('sampleBoulevard').addEventListener('click', () => addPhoto('samples/boulevard.jpg', 'boulevard.jpg'));
$('samplePier').addEventListener('click', () => addPhoto('samples/pier.jpg', 'pier.jpg'));
$('fillAll').addEventListener('click', () => {
  const idx = slots()[state.selected].photo;
  slots().forEach((slot) => { slot.photo = idx; });
  redraw();
  status.textContent = 'One photo fills every panel now.';
});
$('resetCrop').addEventListener('click', () => {
  slots()[state.selected].zoom = 1;
  slots()[state.selected].ox = 0;
  slots()[state.selected].oy = 0;
  redraw();
});
$('zoom').addEventListener('input', (e) => {
  slots()[state.selected].zoom = Number(e.target.value) / 100;
  redraw();
});
$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });

function buildPicker(el, entries, current, onPick) {
  el.innerHTML = '';
  for (const [id, def] of Object.entries(entries)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.textContent = def.name || def.label;
    if (id === current) b.classList.add('on');
    b.addEventListener('click', () => {
      onPick(id);
      el.querySelectorAll('.pick').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
    el.appendChild(b);
  }
}

/**
 * Brings every control in line with the state: the text inputs and which
 * picker button is lit. The screenshot scenes change the state from the
 * query, so they call this before painting.
 */
function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  const pickers = [
    [$('layouts'), LAYOUTS, state.layout],
    [$('grades'), GRADES, state.grade],
    [$('sizes'), SIZES, state.size],
  ];
  for (const [el, entries, current] of pickers) {
    const ids = Object.keys(entries);
    el.querySelectorAll('.pick').forEach((b, i) => b.classList.toggle('on', ids[i] === current));
  }
}
buildPicker($('layouts'), LAYOUTS, state.layout, (id) => {
  state.layout = id;
  state.selected = 0;
  slots();
  redraw();
});
buildPicker($('grades'), GRADES, state.grade, (id) => { state.grade = id; redraw(); });
buildPicker($('sizes'), SIZES, state.size, (id) => { state.size = id; redraw(); });

$('exportOne').addEventListener('click', () => exportOne(state.size));
$('exportAll').addEventListener('click', exportAll);

// ---------------------------------------------------------------- preview interaction

let dragging = false;
let lastX = 0;
let lastY = 0;

function canvasPoint(e) {
  const r = preview.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * preview.width,
    y: ((e.clientY - r.top) / r.height) * preview.height,
  };
}
preview.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state.layout, preview.width, preview.height, p.x, p.y);
  if (hit < 0) return;
  state.selected = hit;
  dragging = true;
  lastX = p.x;
  lastY = p.y;
  preview.setPointerCapture(e.pointerId);
  redraw();
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const slot = slots()[state.selected];
  slot.ox += (p.x - lastX) / preview.width;
  slot.oy += (p.y - lastY) / preview.height;
  lastX = p.x;
  lastY = p.y;
  redraw();
});
preview.addEventListener('pointerup', () => { dragging = false; });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = slots()[state.selected];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

// ---------------------------------------------------------------- boot

const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  runShot(params.get('shot'), params, { addPhoto, redraw, state, loadImage, syncControls });
} else {
  document.fonts.load('100px Anton').then(() => document.fonts.load('40px Pacifico')).then(() => {
    redraw();
  });
  redraw();
}
