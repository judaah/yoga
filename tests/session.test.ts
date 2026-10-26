import { describe, expect, it } from 'vitest';
import type { SessionPlan } from '../src/data/program';
import { adapt } from '../src/lib/adapt';
import { addTime, finishEarly, next, pause, phaseElapsed, prev, progress, replaceWithEasier, resume, startRun, tick, toWorkout, type RunEvent, type RunState } from '../src/lib/session';

const plan: SessionPlan = {
  key: 'q:test',
  title: 'Тест',
  subtitle: '',
  steps: [
    { poseId: 'tadasana', hold: 30, prep: 6, block: 'standing' },
    { poseId: 'warrior2', side: 'right', hold: 20, prep: 6, block: 'standing' },
    { poseId: 'warrior2', side: 'left', hold: 20, prep: 4, block: 'standing' },
    { poseId: 'shavasana', hold: 60, prep: 6, block: 'relax' },
  ],
};

/** Прогоняет время секундными тиками и собирает события. */
function run(state: RunState, from: number, seconds: number): { state: RunState; events: RunEvent[]; now: number } {
  const events: RunEvent[] = [];
  let now = from;
  for (let i = 0; i < seconds * 4; i++) {
    now += 250;
    const r = tick(state, plan, now);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events, now };
}

describe('ход занятия', () => {
  it('подготовка → удержание → следующая поза, события по порядку', () => {
    const r = run(startRun(0), 0, 37);
    expect(r.events.map((e) => e.type)).toEqual(['hold', 'half', 'last3', 'prep']);
    expect(r.state.index).toBe(1);
    expect(r.state.logs[0]).toEqual({ actual: 30, skipped: false });
  });

  it('смена стороны отмечается в событии', () => {
    const r = run(startRun(0), 0, 36 + 26 + 1);
    const prep = r.events.filter((e) => e.type === 'prep');
    expect(prep).toEqual([
      { type: 'prep', index: 1, sideSwitch: false },
      { type: 'prep', index: 2, sideSwitch: true },
    ]);
  });

  it('пауза останавливает время, продолжение — с того же места', () => {
    let s = startRun(0);
    s = tick(s, plan, 10_000).state; // 6 с подготовки прошли → удержание
    expect(s.phase).toBe('hold');
    s = pause(s, 20_000);
    expect(phaseElapsed(s, 500_000)).toBeCloseTo(10, 5);
    s = resume(s, 500_000);
    expect(phaseElapsed(s, 505_000)).toBeCloseTo(15, 5);
    expect(tick(s, plan, 505_000).state.index).toBe(0);
  });

  it('«дальше» на подготовке сразу начинает удержание, в удержании — засчитывает факт', () => {
    let s = startRun(0);
    s = next(s, plan, 1000).state;
    expect(s.phase).toBe('hold');
    s = next(s, plan, 26_000).state; // простоял 25 из 30
    expect(s.logs[0]).toEqual({ actual: 25, skipped: false });
    s = next(next(s, plan, 27_000).state, plan, 30_000).state; // 3 из 20 — пропуск
    expect(s.logs[1]).toEqual({ actual: 3, skipped: true });
  });

  it('«назад» возвращает к началу шага, а в начале подготовки — к предыдущему', () => {
    let s = next(startRun(0), plan, 0).state;
    s = next(s, plan, 30_000).state; // шаг 1, подготовка
    const back = prev(s, plan, 30_500).state;
    expect(back.index).toBe(0);
    expect(back.logs[0]).toBeNull();
    const restart = prev(next(s, plan, 31_000).state, plan, 40_000).state;
    expect(restart.index).toBe(1);
    expect(restart.phase).toBe('prep');
  });

  it('+15 секунд продлевают текущее удержание', () => {
    let s = next(startRun(0), plan, 0).state;
    s = addTime(s);
    expect(tick(s, plan, 40_000).state.index).toBe(0);
    expect(tick(s, plan, 45_000).state.index).toBe(1);
  });

  it('«полегче» меняет позу на этом шаге и на второй стороне', () => {
    let s = next(startRun(0), plan, 0).state;
    s = next(s, plan, 30_000).state; // воин II, правая
    s = replaceWithEasier(s, plan);
    expect(s.replaced).toEqual({});
    const plan2: SessionPlan = { ...plan, steps: plan.steps.map((x) => (x.poseId === 'warrior2' ? { ...x, poseId: 'side_angle' } : x)) };
    s = replaceWithEasier(s, plan2);
    expect(s.replaced).toEqual({ 1: 'warrior2', 2: 'warrior2' });
  });

  it('конец занятия, прогресс и запись в журнал', () => {
    const r = run(startRun(0), 0, 200);
    expect(r.state.done).toBe(true);
    expect(r.events.at(-1)).toEqual({ type: 'done' });
    expect(progress(r.state, plan, r.now)).toBe(1);
    const w = toWorkout(r.state, plan, 'w1', '2026-10-26', r.now);
    expect(w.kind).toBe('quick');
    expect(w.poses.every((p) => !p.skipped)).toBe(true);
    expect(w.actualSec).toBe(130 + 22);
  });

  it('закончить раньше: дальше всё пропущено', () => {
    const s = finishEarly(next(startRun(0), plan, 0).state, plan, 20_000);
    const w = toWorkout(s, plan, 'w', '2026-10-26', 20_000);
    expect(w.poses.map((p) => p.skipped)).toEqual([false, true, true, true]);
    expect(w.poses[0].actual).toBe(20);
  });
});

const base = { hold: 1, boost: 0, swaps: {}, skips: {}, ratings: [] as Array<'easy' | 'ok' | 'hard'> };
const pose = (poseId: string, extra: Partial<{ skipped: boolean; ok: boolean; counter: boolean; replacedFrom: string }> = {}) => ({
  poseId,
  planned: 30,
  actual: extra.skipped ? 0 : 30,
  skipped: false,
  ...extra,
});

describe('адаптация программы', () => {
  it('два «легко» подряд: удержания +12% и уровень выше', () => {
    const a1 = adapt(base, 'easy', []);
    expect(a1.hold).toBe(1);
    const a2 = adapt(a1, 'easy', []);
    expect(a2.hold).toBe(1.12);
    expect(a2.boost).toBe(1);
    expect(a2.ratings).toEqual([]);
  });

  it('«тяжело»: удержания −15%, самая сложная поза — на лёгкую', () => {
    const a = adapt(base, 'hard', [pose('tadasana'), pose('warrior3'), pose('trikonasana')]);
    expect(a.hold).toBe(0.85);
    expect(a.swaps).toEqual({ warrior3: 'knee_hug_standing' });
  });

  it('удержания не уходят за пределы 0.7…1.4', () => {
    let a = base;
    for (let i = 0; i < 10; i++) a = adapt(a, 'hard', []);
    expect(a.hold).toBe(0.7);
    for (let i = 0; i < 30; i++) a = adapt(a, 'easy', []);
    expect(a.hold).toBe(1.4);
  });

  it('три пропуска подряд — замена; сделал между пропусками — счёт сначала', () => {
    let a = adapt(base, 'ok', [pose('pyramid', { skipped: true })]);
    a = adapt(a, 'ok', [pose('pyramid', { skipped: true })]);
    expect(a.skips).toEqual({ pyramid: 2 });
    const reset = adapt(a, 'ok', [pose('pyramid')]);
    expect(reset.skips).toEqual({});
    a = adapt(a, 'ok', [pose('pyramid', { skipped: true })]);
    expect(a.swaps).toEqual({ pyramid: 'ardha_uttanasana' });
    expect(a.skips).toEqual({});
  });

  it('замена кнопкой «полегче» запоминается сразу', () => {
    const a = adapt(base, 'ok', [pose('high_lunge', { replacedFrom: 'warrior1' })]);
    expect(a.swaps).toEqual({ warrior1: 'high_lunge' });
  });
});
