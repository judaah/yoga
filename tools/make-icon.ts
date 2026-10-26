// Иконка приложения из той же фигурки, что в каталоге: поза дерева на шалфейном фоне.
// npx vite-node tools/make-icon.ts && npm run icons
import { writeFileSync } from 'node:fs';
import { POSE_BY_ID } from '../src/data/poses';
import { bounds, shapePath, shapes, solve, type Vec } from '../src/lib/figure';

const SIZE = 512;
const MARGIN = 92;
// руки буквой V, чтобы голова не пряталась за ладонями
const tree = POSE_BY_ID.get('tree')!.figure;
const s = solve({ ...tree, arms: [[118, 112], [62, 68]] });
const b = bounds(s);
const scale = Math.min((SIZE - 2 * MARGIN) / (b.maxX - b.minX), (SIZE - 2 * MARGIN) / (b.maxY - b.minY));
const r = (n: number) => Math.round(n * 10) / 10;
const P = (v: Vec): [number, number] => [r(SIZE / 2 + (v.x - (b.minX + b.maxX) / 2) * scale), r(SIZE / 2 - (v.y - (b.minY + b.maxY) / 2) * scale)];
const X = (v: Vec) => P(v).join(' ');

const parts = shapes(s).map((sh) => {
  if (sh.kind === 'circle') {
    const [cx, cy] = P(sh.c);
    return `<circle cx="${cx}" cy="${cy}" r="${r(sh.r * scale)}" fill="#f3f5f1"/>`;
  }
  return `<path d="${shapePath(sh, X)}" stroke-width="${r(sh.width * scale)}"/>`;
});
const floorY = P({ x: 0, y: 0 })[1] + 14;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8f69"/><stop offset="1" stop-color="#2f6447"/></linearGradient></defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
<rect x="${SIZE / 2 - 120}" y="${floorY}" width="240" height="14" rx="7" fill="#f3f5f1" opacity="0.35"/>
<g fill="none" stroke="#f3f5f1" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g>
</svg>
`;
writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);
console.log('public/icon.svg', svg.length, 'байт');
