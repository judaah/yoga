// Иконка приложения в стиле иллюстраций поз: npx vite-node tools/art/icon.ts && npm run icons
// Берёт образец стиля art/style.png, кладёт результат в art/raw/icon.png и art/icon-source.png (1024×1024).

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../../', import.meta.url).pathname;
const MODEL = process.argv.includes('--pro') ? 'google/gemini-3-pro-image' : 'google/gemini-3.1-flash-image';

const key = process.env.OPENROUTER_KEY ?? readFileSync(join(homedir(), 'hh-autoapply/.env'), 'utf8').match(/^OPENROUTER_KEY=(.+)$/m)![1].trim();
const style = readFileSync(join(ROOT, 'art/style.png'));

const prompt = [
  'App icon for a personal yoga app, square, full-bleed.',
  'Solid muted sage green background (#4F8F69) filling the whole square edge to edge, no border, no rounded corners, no text, no letters.',
  'In the center: the same woman as in the attached style reference (same flat vector style, dark brown hair in a low bun, sage green tank top, charcoal leggings) standing in Tree Pose, front view, palms together overhead, one foot on the inner thigh of the standing leg.',
  'She is drawn in a slightly lighter, simplified way so she reads well at small size; she occupies about 70% of the height, centered with even margins. A subtle soft light circle behind her. Simple, calm, recognizable at 60 pixels.',
].join(' ');

const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Yoga PWA art' },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/png;base64,${style.toString('base64')}` } }] }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: '1:1' },
    usage: { include: true },
  }),
});
const body = (await res.json()) as { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>; usage?: { cost?: number }; error?: { message?: string } };
const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
appendFileSync(join(ROOT, 'art/log.jsonl'), JSON.stringify({ id: 'icon', model: MODEL, at: new Date().toISOString(), ok: !!url, status: res.status, cost: body.usage?.cost, error: body.error?.message }) + '\n');
if (!url) throw new Error(`нет картинки: ${res.status} ${body.error?.message ?? ''}`);
const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
writeFileSync(join(ROOT, 'art/raw/icon.png'), png);
// модель рисует почти впритык к краю — уменьшаем до 88% и добавляем поле цветом фона из угла
const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
const inner = await sharp(png).resize(900, 900, { fit: 'cover' }).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: data[0], g: data[1], b: data[2] } } })
  .composite([{ input: inner, left: 62, top: 62 }])
  .png()
  .toFile(join(ROOT, 'art/icon-source.png'));
console.log(`✓ иконка, $${body.usage?.cost?.toFixed(4) ?? '?'}`);
