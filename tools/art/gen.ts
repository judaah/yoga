// Иллюстрации поз через OpenRouter: фигурка-референс (поза и ракурс) + описание + образец стиля.
//
//   npx vite-node tools/art/gen.ts                 — все, у которых ещё нет art/raw/<id>.png
//   npx vite-node tools/art/gen.ts tree plank      — только эти
//   ... --force                                    — перегенерировать даже готовые
//   ... --model google/gemini-3-pro-image          — другая модель (по умолчанию MODEL ниже)
//   ... --style art/raw/tadasana.png               — образец стиля (по умолчанию art/style.png, если есть)
//   ... --note "left knee must touch the mat"      — добавка к описанию (для перегенерации неудачной)
//
// Ключ берётся из OPENROUTER_KEY или из ~/hh-autoapply/.env. Сырые PNG — в art/raw (в git не идут),
// референсы — в art/ref, расход — в art/log.jsonl. Потом: npx vite-node tools/art/build.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { POSE_BY_ID } from '../../src/data/poses';
import { bounds, shapePath, shapes, solve, type Figure, type Vec } from '../../src/lib/figure';
import { ART_IDS, ART_REF, PROMPTS, STYLE } from './prompts';

const ROOT = new URL('../../', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw');
const REF = join(ROOT, 'art/ref');
const LOG = join(ROOT, 'art/log.jsonl');
export const MODEL = 'google/gemini-3.1-flash-image';

function apiKey(): string {
  if (process.env.OPENROUTER_KEY) return process.env.OPENROUTER_KEY;
  const env = readFileSync(join(homedir(), 'hh-autoapply/.env'), 'utf8');
  const m = env.match(/^OPENROUTER_KEY=(.+)$/m);
  if (!m) throw new Error('Нет OPENROUTER_KEY');
  return m[1].trim();
}

function figureOf(id: string): Figure {
  const ref = ART_REF[id];
  const pose = POSE_BY_ID.get(ref?.pose ?? id)!;
  return ref?.alt ? pose.alt! : pose.figure;
}

/** Референс позы: тёмные — ближние конечности, серые — дальние, полоса — пол. 1536×1024. */
export async function referencePng(id: string): Promise<Buffer> {
  const W = 1536;
  const H = 1024;
  const s = solve(figureOf(id));
  const b = bounds(s);
  const top = s.view === 'top';
  const scale = Math.min((W * 0.72) / (b.maxX - b.minX), (H * 0.66) / (b.maxY - b.minY));
  const floorY = top ? H / 2 + ((b.minY + b.maxY) / 2) * scale : H * 0.84;
  const cx = (b.minX + b.maxX) / 2;
  const P = (v: Vec): [number, number] => [W / 2 + (v.x - cx) * scale, floorY - v.y * scale];
  const X = (v: Vec) => P(v).map((n) => n.toFixed(1)).join(' ');
  const parts = shapes(s).map((sh) => {
    if (sh.kind === 'circle') {
      const [x, y] = P(sh.c);
      return `<circle cx="${x}" cy="${y}" r="${sh.r * scale}" fill="#222"/>`;
    }
    return `<path d="${shapePath(sh, X)}" stroke="${sh.far ? '#9a9a9a' : '#222'}" stroke-width="${sh.width * scale}"/>`;
  });
  const floor = top
    ? `<rect x="${W * 0.08}" y="${H * 0.22}" width="${W * 0.84}" height="${H * 0.56}" rx="20" fill="#e8e2d4"/>`
    : `<rect x="${W * 0.08}" y="${floorY}" width="${W * 0.84}" height="18" fill="#c9bfa8"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${floor}<g fill="none" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function prompt(id: string, withStyle: boolean, note?: string): string {
  return [
    STYLE,
    `Pose: ${PROMPTS[id]}`,
    'The FIRST attached image is only a pose and camera-angle reference drawn with lines: dark lines are the limbs nearer to the viewer, light gray lines are the far limbs, the circle is the head, the beige bar or rectangle is the floor/mat. Reproduce exactly this body position, camera angle and facing direction, but draw a real person in the described style — no lines, no stick figure.',
    withStyle
      ? 'The SECOND attached image is the style reference: match its character, face, hair, outfit, colors, drawing style, background color, mat and framing exactly, as if it is the same illustration series.'
      : '',
    note ? `Important: ${note}` : '',
    'Landscape 3:2 picture.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;

async function generate(id: string, opts: { model: string; style?: Buffer; note?: string }): Promise<void> {
  const ref = await referencePng(id);
  writeFileSync(join(REF, `${id}.png`), ref);
  const content: unknown[] = [
    { type: 'text', text: prompt(id, !!opts.style, opts.note) },
    { type: 'image_url', image_url: { url: dataUrl(ref) } },
  ];
  if (opts.style) content.push({ type: 'image_url', image_url: { url: dataUrl(opts.style) } });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json', 'X-Title': 'Yoga PWA art' },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: 'user', content }],
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: '3:2' },
        usage: { include: true },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }>; content?: string } }>;
      usage?: { cost?: number };
      error?: { message?: string };
    };
    const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    appendFileSync(
      LOG,
      JSON.stringify({ id, model: opts.model, at: new Date().toISOString(), ok: !!url, status: res.status, cost: body.usage?.cost, ms: Date.now() - started, note: opts.note, error: body.error?.message }) + '\n',
    );
    if (url) {
      const b64 = url.slice(url.indexOf(',') + 1);
      writeFileSync(join(RAW, `${id}.png`), await sharp(Buffer.from(b64, 'base64')).png().toBuffer());
      console.log(`✓ ${id}  ${((Date.now() - started) / 1000).toFixed(0)} с  $${body.usage?.cost?.toFixed(4) ?? '?'}`);
      return;
    }
    console.log(`… ${id}: попытка ${attempt} без картинки (${res.status} ${body.error?.message ?? body.choices?.[0]?.message?.content?.slice(0, 120) ?? ''})`);
    // 429 у провайдера — подождать и повторить
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 15_000));
  }
  console.log(`✗ ${id}: не получилось`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const force = args.includes('--force');
  const model = flag('--model') ?? MODEL;
  const stylePath = flag('--style') ?? (existsSync(join(ROOT, 'art/style.png')) ? join(ROOT, 'art/style.png') : undefined);
  const note = flag('--note');
  const ids = args.filter((a) => !a.startsWith('--'));
  for (const id of ids) if (!PROMPTS[id]) throw new Error(`Нет описания для ${id}`);
  mkdirSync(RAW, { recursive: true });
  mkdirSync(REF, { recursive: true });
  const todo = (ids.length ? ids : ART_IDS).filter((id) => force || ids.length || !existsSync(join(RAW, `${id}.png`)));
  const style = stylePath ? readFileSync(stylePath) : undefined;
  console.log(`${todo.length} шт., модель ${model}${style ? ', со стилем ' + stylePath : ''}`);
  // по 4 одновременно
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) await generate(id, { model, style, note });
    }),
  );
}

void main();
