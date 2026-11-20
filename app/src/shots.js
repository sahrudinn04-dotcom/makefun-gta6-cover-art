// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, drawn at export size.
// The query picks the photo (samples/<photo>.jpg), the layout, the grade,
// the caption and the size. window.__shotReady is set once the fonts are in
// and the cover is painted, so a screenshot never catches a half-drawn page.
import { SIZES, drawCover, defaultPanels } from './cover.js';

async function waitForFonts() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.load('40px Pacifico');
    await document.fonts.ready;
  } catch {
    // The display face is a nicety; the cover still draws without it.
  }
}

function applyQuery(state, query) {
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const title = query.get('title');
  if (title !== null) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
}

export async function runShot(shot, query, api) {
  const { addPhoto, redraw, state, syncControls } = api;
  applyQuery(state, query);
  syncControls();
  const photo = query.get('photo') ?? 'pier';
  await addPhoto(`samples/${photo}.jpg`, `${photo}.jpg`);
  const photo2 = query.get('photo2');
  if (photo2) {
    await addPhoto(`samples/${photo2}.jpg`, `${photo2}.jpg`);
    // The second photo takes the second panel, so the cover shows both.
    const list = state.panels[state.layout] || defaultPanels(state.layout, 0);
    if (list[1]) list[1].photo = 1;
    if (list[3]) list[3].photo = 1;
    state.panels[state.layout] = list;
    state.selected = 1;
  }
  await waitForFonts();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = SIZES[state.size];
    const canvas = document.getElementById('preview');
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas, state);
  } else {
    redraw();
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
