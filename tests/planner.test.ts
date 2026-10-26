import { describe, expect, it } from 'vitest';
import { POSE_BY_ID } from '../src/data/poses';
import { GOALS, LIMITS, type Goal, type Limit } from '../src/data/types';
import { MINUTES, QUICK, sessionSeconds, type Experience, type PlanStep, type Program } from '../src/data/program';
import { buildSession, isAllowed, maxLevel, quickSession, rng, weekOf, weekSessions, type BuildInput } from '../src/lib/planner';

const ALL_LIMITS = LIMITS.map((l) => l.id);
const subsets = <T,>(xs: T[]): T[][] => xs.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

/** Все правила спеки для одного занятия; возвращает список нарушений. */
function violations(input: BuildInput, steps: PlanStep[]): string[] {
  const out: string[] = [];
  const level = maxLevel(input.experience, input.week, input.limits, input.adapt?.boost ?? 0);
  const total = sessionSeconds(steps);
  const target = input.minutes * 60;
  if (Math.abs(total - target) > target * 0.1) out.push(`длительность ${total} при цели ${target}`);
  const last = steps[steps.length - 1];
  if (last.poseId !== 'shavasana') out.push(`последняя ${last.poseId}`);
  if (steps.filter((s) => s.poseId === 'shavasana').length !== 1) out.push('шавасана не одна');
  steps.forEach((s, i) => {
    const p = POSE_BY_ID.get(s.poseId)!;
    if (!isAllowed(p, input.limits, level)) out.push(`${p.id} запрещена (ур. ${p.level} > ${level} или ${p.contra.join(',')})`);
    if (s.hold <= 0) out.push(`${p.id} удержание ${s.hold}`);
    if (p.bilateral) {
      const pair = s.side === 'right' ? steps[i + 1] : steps[i - 1];
      if (!pair || pair.poseId !== s.poseId || pair.hold !== s.hold) out.push(`${p.id} не на обе стороны`);
    }
    const next = steps[i + 1] && POSE_BY_ID.get(steps[i + 1].poseId)!;
    if (p.kind === 'backbend' && next && next.id !== p.id && ['backbend', 'twist'].includes(next.kind)) out.push(`после прогиба ${p.id} сразу ${next.id}`);
  });
  const seen = new Map<string, number>();
  for (const s of steps) if (!s.counter && s.side !== 'left') seen.set(s.poseId, (seen.get(s.poseId) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) out.push(`${id} повторяется ${n} раз`);
  return out;
}

describe('подбор занятия', () => {
  it('все сочетания ограничений × длительности × опыта соблюдают правила', () => {
    const goalsCycle: Goal[][] = [['flexibility'], ['back', 'calm'], ['strength', 'energy', 'balance'], ['posture'], ['calm'], ['balance', 'flexibility']];
    let n = 0;
    const errors: string[] = [];
    for (const limits of subsets<Limit>(ALL_LIMITS)) {
      for (const minutes of MINUTES) {
        for (const experience of [1, 2, 3] as Experience[]) {
          const input: BuildInput = {
            experience,
            goals: goalsCycle[n % goalsCycle.length],
            minutes,
            time: n % 2 ? 'morning' : 'evening',
            limits,
            week: (n % 6) + 1,
            seed: n * 31 + 7,
          };
          n++;
          const v = violations(input, buildSession(input));
          if (v.length) errors.push(`${JSON.stringify({ ...input, goals: input.goals.join(',') })}: ${v.join('; ')}`);
        }
      }
    }
    expect(n).toBe(64 * 4 * 3);
    expect(errors.slice(0, 10)).toEqual([]);
  });

  it('случайные анкеты (2000 штук) соблюдают правила', () => {
    const r = rng(42);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    const errors: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const goals = [...new Set(Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(GOALS).id))];
      const limits = ALL_LIMITS.filter(() => r() < 0.25);
      const input: BuildInput = {
        experience: pick([1, 2, 3] as const),
        goals,
        minutes: pick(MINUTES),
        time: pick(['morning', 'evening'] as const),
        limits,
        week: 1 + Math.floor(r() * 6),
        seed: Math.floor(r() * 1e9),
        adapt: { hold: 0.7 + r() * 0.7, boost: r() < 0.3 ? 1 : 0, swaps: {}, skips: {}, ratings: [] },
      };
      const v = violations(input, buildSession(input));
      if (v.length) errors.push(`${JSON.stringify(input)}: ${v.join('; ')}`);
    }
    expect(errors.slice(0, 10)).toEqual([]);
  });

  it('одна и та же анкета и зерно дают то же занятие', () => {
    const input: BuildInput = { experience: 2, goals: ['back'], minutes: 30, time: 'evening', limits: ['knees'], week: 3, seed: 123 };
    expect(buildSession(input)).toEqual(buildSession(input));
  });

  it('новичку на первой неделе — только позы первого уровня, на пятой — до второго', () => {
    const base: BuildInput = { experience: 1, goals: ['strength', 'balance'], minutes: 45, time: 'morning', limits: [], week: 1, seed: 5 };
    const levels = (week: number) => buildSession({ ...base, week }).map((s) => POSE_BY_ID.get(s.poseId)!.level);
    expect(Math.max(...levels(1))).toBe(1);
    expect(Math.max(...levels(5))).toBeLessThanOrEqual(2);
  });

  it('удержания растут от первой недели к пятой', () => {
    const base: BuildInput = { experience: 2, goals: ['flexibility'], minutes: 30, time: 'evening', limits: [], week: 1, seed: 9 };
    const hold = (week: number) => {
      const s = buildSession({ ...base, week }).find((x) => x.poseId === 'cat_cow');
      return s?.hold ?? 0;
    };
    expect(hold(5)).toBeGreaterThanOrEqual(hold(1));
  });

  it('цель «стресс и сон» вечером даёт больше спокойных поз, чем «сила» утром', () => {
    const calmShare = (goals: Goal[], time: 'morning' | 'evening') => {
      let calm = 0;
      let all = 0;
      for (let seed = 0; seed < 30; seed++) {
        for (const s of buildSession({ experience: 2, goals, minutes: 30, time, limits: [], week: 3, seed })) {
          all += s.hold;
          if ((POSE_BY_ID.get(s.poseId)!.goals.calm ?? 0) >= 2) calm += s.hold;
        }
      }
      return calm / all;
    };
    expect(calmShare(['calm'], 'evening')).toBeGreaterThan(calmShare(['strength'], 'morning') + 0.1);
  });
});

const program = (over: Partial<Program['profile']> = {}): Program => ({
  id: 'p1',
  createdAt: 0,
  startDate: '2026-10-26',
  number: 1,
  status: 'active',
  seed: 777,
  adapt: { hold: 1, boost: 0, swaps: {}, skips: {}, ratings: [] },
  profile: { experience: 2, goals: ['flexibility', 'back'], minutes: 30, days: [0, 2, 4], time: 'evening', limits: [], remindAt: '19:00', ...over },
});

describe('программа', () => {
  it('в неделе столько занятий, сколько дней выбрано; три разных', () => {
    const week = weekSessions(program(), 1);
    expect(week).toHaveLength(3);
    expect(week.map((s) => s.title)).toEqual(['Занятие А', 'Занятие Б', 'Занятие В']);
    const ids = week.map((s) => new Set(s.steps.map((x) => x.poseId)));
    const overlap = [...ids[0]].filter((id) => ids[1].has(id) && !['shavasana', 'balasana', 'apanasana', 'cat_cow'].includes(id));
    expect(overlap.length).toBeLessThan(ids[0].size / 2);
  });

  it('при пяти днях занятия А, Б, В повторяются по кругу', () => {
    const week = weekSessions(program({ days: [0, 1, 2, 3, 4] }), 2);
    expect(week.map((s) => s.title)).toEqual(['Занятие А', 'Занятие Б', 'Занятие В', 'Занятие А', 'Занятие Б']);
    expect(week[3].steps).toEqual(week[0].steps);
    expect(new Set(week.map((s) => s.key)).size).toBe(5);
  });

  it('замена позы из адаптации действует: заменённой позы в занятиях нет', () => {
    const p = program();
    const before = weekSessions(p, 3).flatMap((s) => s.steps.map((x) => x.poseId));
    const victim = before.find((id) => POSE_BY_ID.get(id)!.easier && !['shavasana'].includes(id))!;
    p.adapt.swaps[victim] = POSE_BY_ID.get(victim)!.easier!;
    const after = weekSessions(p, 3).flatMap((s) => s.steps.map((x) => x.poseId));
    expect(after).not.toContain(victim);
  });

  it('номер недели считается от первого дня программы', () => {
    const p = { startDate: '2026-10-26' };
    expect(weekOf(p, '2026-10-25')).toBe(0);
    expect(weekOf(p, '2026-10-26')).toBe(1);
    expect(weekOf(p, '2026-11-01')).toBe(1);
    expect(weekOf(p, '2026-11-02')).toBe(2);
    expect(weekOf(p, '2026-12-06')).toBe(6);
    expect(weekOf(p, '2026-12-07')).toBe(7);
  });
});

describe('короткие практики', () => {
  for (const q of QUICK) {
    it(`${q.title}: ${q.minutes} мин ±10%, шавасана в конце, без противопоказанных поз`, () => {
      for (const limits of [[], ['knees', 'wrists'], ['lowerBack', 'pressure', 'neck']] as Limit[][]) {
        const plan = quickSession(q.id, { experience: 1, limits }, 17);
        const total = sessionSeconds(plan.steps);
        expect(Math.abs(total - q.minutes * 60)).toBeLessThanOrEqual(q.minutes * 6);
        expect(plan.steps[plan.steps.length - 1].poseId).toBe('shavasana');
        for (const s of plan.steps) expect(POSE_BY_ID.get(s.poseId)!.contra.some((c) => limits.includes(c)), s.poseId).toBe(false);
      }
    });
  }
});
