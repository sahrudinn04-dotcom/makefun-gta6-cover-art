// Vice Sunset — a gta6-cover-art-01 entry (Node 22, standard library only).
//
// The app is this directory's app/ folder: plain static files a desktop
// browser loads offline (app/index.html and its ES modules, two OFL display
// fonts and two sample photos, no library and no network request). This
// program hands it in: it copies app/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root: the directory this file lives in.
const root = fileURLToPath(new URL('.', import.meta.url));
// The grader's output directory, or the local stand-in outside it.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the scorer enforces (reference/gate.json): only text_max_bytes
// shapes the dossier's bytes; the rest make this program fail exactly where
// the scorer would refuse the entry (too many screenshots, one over 256 KiB,
// app/ past 993 files or 48 MiB, or a path under app/ over 1000 bytes).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));
