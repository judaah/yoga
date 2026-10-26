// Сырые PNG из art/raw → public/poses/<id>.webp (960×640) и public/poses/s/<id>.webp (480×320, для списков),
// плюс src/data/art.ts — какие иллюстрации есть. Запуск: npx vite-node tools/art/build.ts

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ART_ALIAS, ART_IDS } from './prompts';

const ROOT = new URL('../../', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw');
const OUT = join(ROOT, 'public/poses');
const SMALL = join(OUT, 's');

/** Доля поля вокруг содержимого (фигура + коврик) — одинаковая у всех картинок. */
const MARGIN = 0.07;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Где на картинке рисунок (фигура с ковриком) и размер всей картинки. */
async function contentBox(path: string): Promise<{ box: Box; w: number; h: number }> {
  // границы ищем по размытой копии: у фона бывает лёгкая «бумажная» текстура, обрезка принимает её за рисунок
  const blurred = await sharp(path).blur(4).png().toBuffer();
  const { data, info } = await sharp(blurred).raw().toBuffer({ resolveWithObject: true });
  // фон — по углу картинки
  const bg = { r: data[0], g: data[1], b: data[2] };
  const { info: t } = await sharp(blurred).trim({ background: bg, threshold: 20 }).toBuffer({ resolveWithObject: true });
  return { box: { left: -(t.trimOffsetLeft ?? 0), top: -(t.trimOffsetTop ?? 0), width: t.width, height: t.height }, w: info.width, h: info.height };
}

const union = (a: Box, b: Box): Box => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top };
};

/**
 * Кадр 3:2 вокруг рисунка с одинаковым полем: модель рисует фигуру мелко и где придётся,
 * а в списках нужна крупная и по центру. box — рисунок; у пары кадров (кошка-корова) он общий,
 * чтобы при смене картинок тело стояло на месте.
 */
async function frame(path: string, box: Box): Promise<Buffer> {
  const { width: iw, height: ih } = await sharp(path).metadata();
  let w = box.width;
  let h = box.height;
  // поле вокруг и пропорция 3:2
  const pad = Math.round(Math.max(w, h * 1.5) * MARGIN);
  w += pad * 2;
  h += pad * 2;
  if (w / h > 1.5) h = Math.round(w / 1.5);
  else w = Math.round(h * 1.5);
  // кадр не больше исходника: если не влезает — берём исходник целиком
  if (w > iw! || h > ih!) {
    w = iw!;
    h = Math.round(w / 1.5);
    if (h > ih!) {
      h = ih!;
      w = Math.round(h * 1.5);
    }
  }
  // центр кадра — по рисунку, но сам кадр сдвигаем внутрь картинки:
  // дорисовывать фон нельзя, он у модели не идеально ровный и на стыке виден шов
  const clamp = (v: number, max: number) => Math.min(Math.max(0, v), max);
  const x0 = clamp(Math.round(box.left + box.width / 2 - w / 2), iw! - w);
  const y0 = clamp(Math.round(box.top + box.height / 2 - h / 2), ih! - h);
  return sharp(path).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
}

async function main() {
  mkdirSync(SMALL, { recursive: true });
  const ready = ART_IDS.filter((id) => existsSync(join(RAW, `${id}.png`)));
  const missing = ART_IDS.filter((id) => !ready.includes(id));
  let bytes = 0;
  const boxes = new Map<string, Box>();
  for (const id of ready) boxes.set(id, (await contentBox(join(RAW, `${id}.png`))).box);
  // пары «поза + вторая картинка» — одной рамкой
  for (const id of ready.filter((x) => x.endsWith('_alt'))) {
    const base = id.replace(/_alt$/, '');
    if (!boxes.has(base)) continue;
    const u = union(boxes.get(base)!, boxes.get(id)!);
    boxes.set(base, u);
    boxes.set(id, u);
  }
  for (const id of ready) {
    const framed = await frame(join(RAW, `${id}.png`), boxes.get(id)!);
    await sharp(framed).resize(960, 640).webp({ quality: 74, effort: 6 }).toFile(join(OUT, `${id}.webp`));
    await sharp(framed).resize(480, 320).webp({ quality: 70, effort: 6 }).toFile(join(SMALL, `${id}.webp`));
    bytes += statSync(join(OUT, `${id}.webp`)).size + statSync(join(SMALL, `${id}.webp`)).size;
  }
  // лишние файлы от удалённых поз
  for (const dir of [OUT, SMALL]) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.webp') && !ready.includes(f.replace('.webp', ''))) console.log(`лишний файл: ${join(dir, f)}`);
    }
  }
  const aliases = Object.fromEntries(Object.entries(ART_ALIAS).filter(([, to]) => ready.includes(to)));
  writeFileSync(
    join(ROOT, 'src/data/art.ts'),
    `// Сгенерировано tools/art/build.ts — руками не править.\n` +
      `// Иллюстрации поз лежат в public/poses/<id>.webp (большие) и public/poses/s/<id>.webp (для списков).\n\n` +
      `export const ART_IDS: ReadonlySet<string> = new Set(${JSON.stringify(ready)});\n\n` +
      `/** Позы без своей иллюстрации, которые показываются чужой (дыхание сидя → лёгкая поза). */\n` +
      `export const ART_ALIAS: Readonly<Record<string, string>> = ${JSON.stringify(aliases)};\n`,
  );
  console.log(`готово ${ready.length} из ${ART_IDS.length}, ${(bytes / 1024 / 1024).toFixed(2)} МБ`);
  if (missing.length) console.log(`нет картинок: ${missing.join(', ')}`);
}

void main();
