import { describe, expect, it } from 'vitest';
import { POSES, POSE_BY_ID } from '../src/data/poses';
import { bounds, contactGap, solve, type Solved } from '../src/lib/figure';

/** Точка опоры может «парить» не выше, чем на полтора деления (меньше толщины линии). */
const TOLERANCE = 1.6;

const allPoints = (s: Solved) => [s.hip, s.shoulder, s.head, ...s.arms, ...s.legs].flatMap((p) => ('root' in p ? [p.root, p.mid, p.end, ...(p.toe ? [p.toe] : [])] : [p]));

describe('библиотека поз', () => {
  it('id уникальны', () => {
    expect(POSE_BY_ID.size).toBe(POSES.length);
  });

  it('около 60 поз и 4 дыхательные практики', () => {
    expect(POSES.filter((p) => p.kind === 'breath')).toHaveLength(4);
    expect(POSES.filter((p) => p.kind !== 'breath').length).toBeGreaterThanOrEqual(55);
  });

  it('у каждой позы есть шаги, подсказки, цели и блоки', () => {
    for (const p of POSES) {
      expect(p.steps.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.cues.length, p.id).toBeGreaterThanOrEqual(1);
      expect(Object.keys(p.goals).length, p.id).toBeGreaterThan(0);
      expect(p.blocks.length, p.id).toBeGreaterThan(0);
      expect(p.hold, p.id).toBeGreaterThan(0);
    }
  });

  it('«полегче» ведёт на существующую позу того же или более низкого уровня', () => {
    for (const p of POSES.filter((x) => x.easier)) {
      const e = POSE_BY_ID.get(p.easier!);
      expect(e, `${p.id} → ${p.easier}`).toBeDefined();
      expect(e!.level, `${p.id} → ${p.easier}`).toBeLessThanOrEqual(p.level);
      expect(e!.id).not.toBe(p.id);
    }
  });

  it('у дыхательных практик есть ритм', () => {
    for (const p of POSES.filter((x) => x.kind === 'breath')) expect(p.breath, p.id).toBeDefined();
  });
});

describe('фигурки', () => {
  for (const p of POSES) {
    for (const [label, fig] of [['основная', p.figure], ['вторая', p.alt]] as const) {
      if (!fig) continue;
      it(`${p.id}: ${label} считается без NaN и стоит на полу`, () => {
        const s = solve(fig);
        for (const pt of allPoints(s)) {
          expect(Number.isFinite(pt.x) && Number.isFinite(pt.y), p.id).toBe(true);
        }
        if (s.view === 'top') return;
        // ничего не уходит под пол
        expect(bounds(s).minY, p.id).toBeGreaterThanOrEqual(-0.01);
        for (const c of fig.on ?? []) {
          expect(contactGap(s, c), `${p.id}: ${c} висит над полом`).toBeLessThanOrEqual(TOLERANCE);
        }
      });
    }
  }
});
