// Vice Sunset cover renderer: turns photos and a caption into a multi-panel
// poster-style cover on a 2D canvas. Everything is drawn here — the panels,
// the neon-sunset grades, the halftone and grain, and the display lettering —
// so the preview, the exported PNG and the screenshot scenes all share one
// code path. No image leaves the machine and no artwork is borrowed.

export const SIZES = {
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const LAYOUTS = {
  hero: { name: 'Hero + Trio', panels: 4 },
  grid: { name: 'Poster Grid', panels: 4 },
  bleed: { name: 'Full Bleed', panels: 1 },
  tilt: { name: 'Tilted Snaps', panels: 3 },
};

export const GRADES = {
  sunset: { name: 'Neon Sunset', filter: 'contrast(1.18) saturate(1.45) brightness(1.02)' },
  vice: { name: 'Vice Nights', filter: 'contrast(1.15) saturate(1.35) hue-rotate(-14deg) brightness(0.98)' },
  gold: { name: 'Golden Hour', filter: 'contrast(1.08) saturate(1.3) sepia(0.28) brightness(1.05)' },
  noir: { name: 'After Dark', filter: 'contrast(1.28) saturate(0.12) brightness(1.0)' },
};

// A small deterministic generator, so the grain looks the same on every
// render of the same cover instead of flickering between preview and export.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh panel slot: which photo it shows, and its crop (zoom and offset). */
export function blankPanel(photo = 0) {
  return { photo, zoom: 1, ox: 0, oy: 0 };
}

/** Default panel slots for a layout, all showing `photo`. */
export function defaultPanels(layoutId, photo = 0) {
  const n = LAYOUTS[layoutId].panels;
  return Array.from({ length: n }, () => blankPanel(photo));
}

// ---------------------------------------------------------------- layouts

// Each layout answers, for a cover of W x H, the panel rectangles (fractions
// of the cover), the title block, and where the badge goes. Gutters are the
// white seams between panels, in pixels at export size.
function rect(x, y, w, h, rot = 0) {
  return { x, y, w, h, rot };
}

export function layoutGeometry(layoutId, W, H) {
  const g = Math.round(Math.min(W, H) * 0.008); // gutter
  const frame = Math.round(Math.min(W, H) * 0.012); // outer frame
  if (layoutId === 'hero') {
    const heroH = Math.round(H * 0.6);
    const rowY = heroH + g;
    const rowH = H - rowY - frame;
    const colW = (W - frame * 2 - g * 2) / 3;
    return {
      frame, gutter: g,
      panels: [
        rect(frame, frame, W - frame * 2, heroH - frame),
        rect(frame, rowY, colW, rowH),
        rect(frame + colW + g, rowY, colW, rowH),
        rect(frame + (colW + g) * 2, rowY, colW, rowH),
      ],
      title: { x: frame, y: frame + (heroH - frame) * 0.62, w: W - frame * 2, align: 'left', scrim: true, max: 0.115 },
      scrimBottom: heroH - frame,
      badge: { x: W - frame - 62, y: frame + 62, r: 52 },
    };
  }
  if (layoutId === 'grid') {
    const bandH = Math.round(H * 0.16);
    const gridH = H - bandH - frame;
    const cellW = (W - frame * 2 - g) / 2;
    const cellH = (gridH - frame - g) / 2;
    return {
      frame, gutter: g,
      panels: [
        rect(frame, frame, cellW, cellH),
        rect(frame + cellW + g, frame, cellW, cellH),
        rect(frame, frame + cellH + g, cellW, cellH),
        rect(frame + cellW + g, frame + cellH + g, cellW, cellH),
      ],
      title: { x: frame, y: H - bandH, w: W - frame * 2, align: 'center', band: true, max: 0.1 },
      badge: null,
    };
  }
  if (layoutId === 'bleed') {
    return {
      frame, gutter: g,
      panels: [rect(frame, frame, W - frame * 2, H - frame * 2)],
      title: { x: frame + W * 0.045, y: H - frame - H * 0.3, w: W * 0.86, align: 'left', scrim: true, max: 0.12 },
      scrimBottom: H - frame,
      badge: { x: W - frame - 66, y: frame + 66, r: 56 },
    };
  }
  // tilt: three snapshots, slightly rotated, on a painted sunset sky.
  const pw = W * 0.62;
  const ph = H * 0.34;
  return {
    frame, gutter: g,
    panels: [
      rect(W * 0.06, H * 0.3, pw, ph, -0.055),
      rect(W * 0.32, H * 0.47, pw, ph, 0.045),
      rect(W * 0.1, H * 0.64, pw, ph, -0.02),
    ],
    title: { x: frame, y: H * 0.13, w: W - frame * 2, align: 'center', max: 0.11 },
    badge: { x: W - frame - 58, y: H - frame - 58, r: 48 },
    sky: true,
  };
}

// ---------------------------------------------------------------- grades

// The tint each grade washes over a panel after the canvas filter, as a
// vertical gradient (top colour, bottom colour) and a blend mode.
const GRADE_TINTS = {
  sunset: { top: 'rgba(255, 190, 90, 0.10)', bottom: 'rgba(255, 45, 140, 0.30)', mode: 'overlay' },
  vice: { top: 'rgba(0, 225, 255, 0.14)', bottom: 'rgba(255, 0, 170, 0.26)', mode: 'overlay' },
  gold: { top: 'rgba(255, 200, 110, 0.16)', bottom: 'rgba(255, 140, 40, 0.20)', mode: 'soft-light' },
  noir: { top: 'rgba(30, 16, 48, 0.10)', bottom: 'rgba(10, 6, 20, 0.30)', mode: 'multiply' },
};

/** Draws one photo into one panel rectangle, graded, with its crop applied. */
function drawPanelPhoto(ctx, photo, panel, gradeId) {
  const { x, y, w, h, rot } = panel;
  ctx.save();
  if (rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
  } else {
    ctx.translate(x, y);
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const zoom = panel.zoom || 1;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Clamp the offset so the photo always covers the panel.
  const maxOx = Math.max(0, (dw - w) / 2 / w);
  const maxOy = Math.max(0, (dh - h) / 2 / h);
  const ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0));
  const oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0));
  const dx = (w - dw) / 2 + ox * w;
  const dy = (h - dh) / 2 + oy * h;
  ctx.filter = GRADES[gradeId].filter;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.filter = 'none';
  const tint = GRADE_TINTS[gradeId];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, tint.top);
  grad.addColorStop(1, tint.bottom);
  ctx.globalCompositeOperation = tint.mode;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ---------------------------------------------------------------- lettering

/** Shrinks the font until `text` fits `maxW`, then draws it with a fill and an outline. */
function drawFittedText(ctx, text, cx, y, maxW, size, font, fill, outline) {
  let s = size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (;;) {
    ctx.font = `${s}px ${font}`;
    if (ctx.measureText(text).width <= maxW || s <= 10) break;
    s -= 2;
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2, s / 11);
  ctx.strokeText(text, cx, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, y);
  return s;
}

/** The cover's title and subtitle, in the layout's title block. */
function drawTitleBlock(ctx, geo, W, H, title, subtitle) {
  const t = geo.title;
  const size = Math.round(W * t.max);
  const cx = t.align === 'center' ? t.x + t.w / 2 : t.x + t.w / 2;
  if (t.scrim) {
    // A scrim that fades in above the title and runs to the panel's foot,
    // so it never ends in a hard line across the photo.
    const bottom = geo.scrimBottom ?? t.y + size * 0.75;
    const top = t.y - size * 0.9;
    const scrim = ctx.createLinearGradient(0, top, 0, bottom);
    scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 24, 0.72)');
    ctx.fillStyle = scrim;
    ctx.fillRect(geo.frame, top, W - geo.frame * 2, bottom - top);
  }
  if (t.band) {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, t.y, W, H - t.y);
    const rule = ctx.createLinearGradient(0, 0, W, 0);
    rule.addColorStop(0, '#ff9e2c');
    rule.addColorStop(0.5, '#ff2e88');
    rule.addColorStop(1, '#22d3ee');
    ctx.fillStyle = rule;
    ctx.fillRect(0, t.y, W, Math.max(3, H * 0.006));
  }
  const words = (title || 'SUNSET HEIST').trim().toUpperCase();
  const grad = ctx.createLinearGradient(0, t.y - size * 0.7, 0, t.y + size * 0.2);
  grad.addColorStop(0, '#fff7e0');
  grad.addColorStop(0.55, '#ffd166');
  grad.addColorStop(1, '#ff7a3d');
  const drawn = drawFittedText(ctx, words, cx, t.y, t.w, size, 'Anton, sans-serif', grad, '#160a24');
  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = Math.round(size * 0.34);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = subSize * 0.25;
    ctx.fillText(sub, cx, t.y + subSize * 1.5);
    ctx.shadowBlur = 0;
  }
  return drawn;
}

/** A small star-burst badge with two lines of text, top-right of the cover. */
function drawBadge(ctx, badge, lines) {
  const { x, y, r } = badge;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.78;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd166';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#160a24';
  ctx.stroke();
  ctx.fillStyle = '#160a24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(r * 0.3)}px Anton, sans-serif`;
  ctx.fillText(lines[0], 0, -r * 0.16);
  ctx.font = `bold ${Math.round(r * 0.22)}px Anton, sans-serif`;
  ctx.fillText(lines[1], 0, r * 0.22);
  ctx.restore();
}

// ---------------------------------------------------------------- texture

/** Halftone dots and grain over the whole cover, from a fixed seed. */
function drawTexture(ctx, W, H) {
  const rand = mulberry32(20261119);
  ctx.save();
  // Halftone: dots that grow toward the edges, faint.
  const step = Math.max(9, Math.round(W / 120));
  ctx.fillStyle = 'rgba(20, 8, 32, 0.10)';
  for (let yy = step / 2; yy < H; yy += step) {
    for (let xx = step / 2; xx < W; xx += step) {
      const edge = Math.max(Math.abs(xx / W - 0.5), Math.abs(yy / H - 0.5)) * 2;
      const r = step * 0.1 + edge * step * 0.16;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Grain: a few thousand speckles, light and dark.
  const specks = Math.round((W * H) / 900);
  for (let i = 0; i < specks; i++) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }
  ctx.restore();
  // Vignette: darkened corners, kept light so the title stays readable.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(10, 4, 24, 0)');
  vig.addColorStop(1, 'rgba(10, 4, 24, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- entry point

/**
 * Draws the whole cover onto `canvas` at its own size, from `state`:
 * photos (loaded images), panels (per-layout slots), layout, grade,
 * title, subtitle. A state with no photos yet draws empty panels.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layoutId = state.layout || 'hero';
  const geo = layoutGeometry(layoutId, W, H);
  const gradeId = state.grade || 'sunset';
  const panels = state.panels && state.panels[layoutId] ? state.panels[layoutId] : defaultPanels(layoutId);

  // Ground: a painted sunset sky for the tilted layout, white seams otherwise.
  if (geo.sky) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b1055');
    sky.addColorStop(0.45, '#c94b7c');
    sky.addColorStop(0.75, '#ff7a3d');
    sky.addColorStop(1, '#ffd166');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, W * 0.3);
    sun.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
    sun.addColorStop(0.5, 'rgba(255, 170, 90, 0.45)');
    sun.addColorStop(1, 'rgba(255, 170, 90, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#fdf8f2';
    ctx.fillRect(0, 0, W, H);
  }

  // Panels, in order, each with its photo and grade.
  geo.panels.forEach((panel, i) => {
    const slot = panels[i] || blankPanel(0);
    const photo = state.photos && state.photos[slot.photo];
    if (geo.sky) {
      // Polaroid frame: a white border around the tilted snapshot.
      ctx.save();
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      ctx.fillStyle = '#fffdf8';
      ctx.shadowColor = 'rgba(20, 8, 32, 0.45)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetY = W * 0.008;
      ctx.fillRect(-panel.w / 2 - 10, -panel.h / 2 - 10, panel.w + 20, panel.h + 20);
      ctx.restore();
    }
    if (photo) {
      drawPanelPhoto(ctx, photo, panel, gradeId);
    } else {
      ctx.save();
      ctx.fillStyle = '#3a2340';
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `${Math.round(Math.min(panel.w, panel.h) * 0.07)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add a photo', panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.restore();
    }
    // A thin dark keyline around each panel.
    ctx.save();
    if (panel.rot) {
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      ctx.translate(-panel.w / 2, -panel.h / 2);
    } else {
      ctx.translate(panel.x, panel.y);
    }
    ctx.strokeStyle = 'rgba(22, 10, 36, 0.85)';
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeRect(0, 0, panel.w, panel.h);
    ctx.restore();
  });

  drawTexture(ctx, W, H);
  drawTitleBlock(ctx, geo, W, H, state.title, state.subtitle);
  if (geo.badge) drawBadge(ctx, geo.badge, ['EST.', '2026']);

  // Outer frame.
  ctx.strokeStyle = '#fdf8f2';
  ctx.lineWidth = geo.frame;
  ctx.strokeRect(geo.frame / 2, geo.frame / 2, W - geo.frame, H - geo.frame);
}

/** Which panel, if any, holds the point (px, py) in canvas pixels. */
export function panelAt(layoutId, W, H, px, py) {
  const geo = layoutGeometry(layoutId, W, H);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const p = geo.panels[i];
    let lx = px;
    let ly = py;
    if (p.rot) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const cos = Math.cos(-p.rot);
      const sin = Math.sin(-p.rot);
      lx = cx + (px - cx) * cos - (py - cy) * sin;
      ly = cy + (px - cx) * sin + (py - cy) * cos;
    }
    if (lx >= p.x && lx <= p.x + p.w && ly >= p.y && ly <= p.y + p.h) return i;
  }
  return -1;
}
