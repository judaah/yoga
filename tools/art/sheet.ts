// Контактный лист для проверки глазами: схема-референс и иллюстрация рядом, с подписью.
//   npx vite-node tools/art/sheet.ts            — все группы → art/sheets/<группа>.png
//   npx vite-node tools/art/sheet.ts balance    — одна группа

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { POSES } from '../../src/data/poses';
import { GROUPS } from '../../src/data/types';
import { ART_ALIAS, ART_REF } from './prompts';

const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = join(ROOT, 'art/sheets');
const CELL_W = 520;
const IMG_H = 230;
const LABEL_H = 26;
const COLS = 2;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function cell(id: string, label: string): Promise<Buffer> {
  const ref = join(ROOT, 'art/ref', `${id}.png`);
  const raw = join(ROOT, 'public/poses', `${id}.webp`);
  const w = Math.round((CELL_W - 12) / 2);
  const part = async (p: string) =>
    existsSync(p) ? sharp(p).resize(w, IMG_H, { fit: 'contain', background: '#ffffff' }).png().toBuffer() : sharp({ create: { width: w, height: IMG_H, channels: 3, background: '#f4d7d7' } }).png().toBuffer();
  const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${LABEL_H}"><text x="6" y="18" font-family="Helvetica" font-size="15" fill="#222">${esc(label)}</text></svg>`);
  return sharp({ create: { width: CELL_W, height: IMG_H + LABEL_H + 8, channels: 3, background: '#ffffff' } })
    .composite([
      { input: text, left: 0, top: 0 },
      { input: await part(ref), left: 4, top: LABEL_H },
      { input: await part(raw), left: 8 + w, top: LABEL_H },
    ])
    .png()
    .toBuffer();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  for (const g of GROUPS.filter((x) => !only || x.id === only)) {
    const ids: Array<[string, string]> = [];
    for (const p of POSES.filter((x) => x.group === g.id && !ART_ALIAS[x.id])) {
      ids.push([p.id, `${p.id} · ${p.name}`]);
      for (const [alt, r] of Object.entries(ART_REF)) if (r.pose === p.id) ids.push([alt, `${alt} · ${p.name} (2)`]);
    }
    if (!ids.length) continue;
    const cells = await Promise.all(ids.map(([id, label]) => cell(id, label)));
    const ch = IMG_H + LABEL_H + 8;
    const rows = Math.ceil(cells.length / COLS);
    await sharp({ create: { width: CELL_W * COLS + 6 * (COLS - 1), height: rows * (ch + 6), channels: 3, background: '#9aa39c' } })
      .composite(cells.map((input, i) => ({ input, left: (i % COLS) * (CELL_W + 6), top: Math.floor(i / COLS) * (ch + 6) })))
      .png()
      .toFile(join(OUT, `${g.id}.png`));
    console.log(`art/sheets/${g.id}.png — ${ids.length}`);
  }
}

void main();
