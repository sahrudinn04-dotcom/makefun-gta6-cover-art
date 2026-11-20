# Vice Sunset — GTA 6 Cover Art Maker

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/sahrudinn04-dotcom/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/sahrudinn04-dotcom/makefun-gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns a photo and a caption into GTA 6-style poster
cover art — the multi-panel poster look with bold display lettering and a
Vice City neon-sunset grade — exported as a PNG to share. Built for the
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on
[make.fun](https://make.fun/r/2c51b8pr).

## What it does

- **Multi-panel covers** — four layouts (Hero + Trio, Poster Grid, Full Bleed,
  Tilted Snaps) filled from any photos: one photo across every panel, or a
  different photo in each.
- **Crop and position per panel** — click a panel in the live preview, drag to
  move its photo, scroll or slide to zoom.
- **Neon-sunset grades** — four canvas grades (Neon Sunset, Vice Nights,
  Golden Hour, After Dark) with halftone dots, grain and a vignette, all drawn
  by the app itself.
- **Genre lettering** — a big condensed display title with a sunset gradient
  fill and a neon script subtitle, set in Anton and Pacifico (SIL Open Font
  License, vendored under `app/fonts/`).
- **One-step export** — Export all 3 sizes downloads 1080 x 1350, 1080 x 1080
  and 1920 x 1080 PNGs at once.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Everything runs offline from `app/` — no network request, no upload, the
photos never leave the machine. Load a photo (or try the two bundled samples,
made with an image model for make.fun), pick a layout and a grade, type a
caption, export.

## Layout

- `main.ts` — the entry program (Node 22, standard library only): copies
  `app/` and `screenshots/` to `/output` and writes `dossier.json`.
- `app/index.html`, `app/style.css` — the editor page.
- `app/src/cover.js` — the cover renderer: layouts, grades, lettering,
  halftone and grain.
- `app/src/main.js` — the editor wiring: photos, panels, export.
- `app/src/shots.js` — fixed `?shot=` scenes for the screenshots.
- `app/fonts/` — Anton and Pacifico under the SIL Open Font License.
- `app/samples/` — two sample photos, made with an image model for make.fun.
- `screenshots/` — the entry's screenshots (the first by name is the cover).
- `vendor/makefun-app.ts` — make.fun's dossier library, unchanged.

Everything in this entry is the maker's own: no Rockstar Games logo, artwork
or font.
