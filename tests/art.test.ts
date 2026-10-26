import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART_ALIAS, ART_IDS } from '../src/data/art';
import { POSES } from '../src/data/poses';

const file = (id: string, small = false) => new URL(`../public/poses/${small ? 's/' : ''}${id}.webp`, import.meta.url);

describe('иллюстрации поз', () => {
  it('у каждой позы есть иллюстрация (своя или общая)', () => {
    const missing = POSES.filter((p) => !ART_IDS.has(ART_ALIAS[p.id] ?? p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it('у динамичных поз есть вторая картинка', () => {
    for (const p of POSES.filter((x) => x.alt)) expect(ART_IDS.has(`${p.id}_alt`), p.id).toBe(true);
  });

  it('файлы на месте: большой и уменьшенный', () => {
    for (const id of ART_IDS) {
      expect(existsSync(file(id)), id).toBe(true);
      expect(existsSync(file(id, true)), `${id} (малый)`).toBe(true);
    }
  });
});
