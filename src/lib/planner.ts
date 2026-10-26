// Подбор занятий по анкете: чистые функции, одно и то же «зерно» → то же занятие.
// Правила последовательности и границы длительности проверяются в tests/planner.test.ts.

import { POSES, POSE_BY_ID } from '../data/poses';
import type { Block, Goal, Kind, Limit, Pose, Position } from '../data/types';
import {
  phaseOf,
  PROGRAM_WEEKS,
  QUICK,
  sessionSeconds,
  type Adaptation,
  type DayTime,
  type Experience,
  type PlanStep,
  type Profile,
  type Program,
  type QuickId,
  type SessionPlan,
} from '../data/program';

/** Детерминированный генератор случайных чисел 0…1 (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round5 = (v: number) => Math.round(v / 5) * 5;

/** Самый высокий уровень поз, который можно брать на этой неделе. */
export function maxLevel(experience: Experience, week: number, limits: Limit[], boost = 0): number {
  if (limits.includes('injury')) return 1;
  return clamp(experience + (week >= 5 ? 1 : 0) + boost, 1, 3);
}

/** Поза подходит человеку с такими ограничениями и уровнем. */
export function isAllowed(p: Pose, limits: Limit[], level: number): boolean {
  return p.level <= level && !p.contra.some((c) => limits.includes(c));
}

// Удержания растут от недели к неделе: 1–2 знакомство, 3–4 развитие, 5 усложнение, 6 закрепление.
const WEEK_HOLD = [1, 0.8, 0.9, 1, 1.05, 1.15, 1.1];
const EXPERIENCE_HOLD: Record<Experience, number> = { 1: 0.9, 2: 1, 3: 1.15 };

const MIN_HOLD = 10;
const MAX_HOLD = 120;
/** Примерно столько секунд блока приходится на одну позу (с обеими сторонами и переходами). */
const SECONDS_PER_POSE = 80;
/** Переход к новой позе (голос называет её), смена стороны. */
export const PREP_NEW = 6;
export const PREP_SIDE = 4;
export const PREP_FIRST = 10;
const COUNTER_HOLD = 20;

type Shares = Record<'warmup' | 'standing' | 'floor' | 'cooldown', number>;

export interface BuildInput {
  experience: Experience;
  goals: Goal[];
  minutes: number;
  time: DayTime;
  limits: Limit[];
  /** неделя программы 1…6; 0 — короткая практика вне программы */
  week: number;
  seed: number;
  adapt?: Adaptation;
  /** позы из других занятий этой недели — их берём реже, ради разнообразия */
  avoid?: Set<string>;
  shares?: Partial<Shares>;
}

function centerRelax(minutes: number): { centering: number; relax: number } {
  if (minutes <= 10) return { centering: 60, relax: 90 };
  if (minutes <= 20) return { centering: 90, relax: 150 };
  if (minutes <= 30) return { centering: 120, relax: 180 };
  return { centering: 180, relax: 300 };
}

function blockShares(input: BuildInput): Shares {
  const s: Shares = input.time === 'morning' ? { warmup: 0.25, standing: 0.45, floor: 0.2, cooldown: 0.1 } : { warmup: 0.2, standing: 0.3, floor: 0.33, cooldown: 0.17 };
  if (input.goals.includes('calm')) {
    s.standing -= 0.05;
    s.cooldown += 0.05;
  }
  if (input.goals.includes('energy') || input.goals.includes('strength')) {
    s.cooldown -= 0.05;
    s.standing += 0.05;
  }
  Object.assign(s, input.shares);
  const sum = s.warmup + s.standing + s.floor + s.cooldown;
  for (const k of Object.keys(s) as Array<keyof Shares>) s[k] = s[k] / sum;
  return s;
}

const GOAL_WEIGHT = [1.5, 1.2, 1];

/** Порядок положений тела внутри блока — чтобы не вставать и не ложиться лишний раз. */
const POSITION_ORDER: Record<Position, number> = { standing: 0, kneeling: 1, all4: 2, prone: 3, seated: 4, supine: 5 };
const WARMUP_ORDER: Record<Position, number> = { seated: 0, supine: 0, prone: 1, all4: 1, kneeling: 2, standing: 3 };
const STANDING_KIND: Partial<Record<Kind, number>> = { neutral: 0, side: 1, hip: 2, forward: 3, balance: 4 };
const FLOOR_KIND: Partial<Record<Kind, number>> = { core: 0, neutral: 1, backbend: 2, hip: 3, forward: 4, twist: 5, relax: 6 };

function orderBlock(block: Block, poses: Pose[]): Pose[] {
  const key = (p: Pose): number[] => {
    if (p.kind === 'inversion') return [99];
    switch (block) {
      case 'warmup':
        return [WARMUP_ORDER[p.position]];
      case 'standing':
        return [p.position === 'all4' ? -1 : 0, STANDING_KIND[p.kind] ?? 2];
      default:
        return [POSITION_ORDER[p.position], FLOOR_KIND[p.kind] ?? 3];
    }
  };
  return [...poses].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      const d = (ka[i] ?? 0) - (kb[i] ?? 0);
      if (d) return d;
    }
    return 0;
  });
}

/**
 * Пол и заминка одним списком: сначала на животе и четвереньках, потом сидя, потом лёжа на спине.
 * Внутри одного положения позы заминки — после поз основной части, перевёрнутые — в конце своей части.
 */
function orderFloor(floor: Pose[], cooldown: Pose[]): Array<{ pose: Pose; block: Block }> {
  const items = [...floor.map((pose) => ({ pose, block: 'floor' as Block })), ...cooldown.map((pose) => ({ pose, block: 'cooldown' as Block }))];
  const key = ({ pose, block }: { pose: Pose; block: Block }) => [
    POSITION_ORDER[pose.position],
    block === 'cooldown' ? 1 : 0,
    pose.kind === 'inversion' ? 99 : (FLOOR_KIND[pose.kind] ?? 3),
  ];
  return items.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
}

/** После прогиба сразу не идут прогиб, скрутка, перевёрнутая или силовая поза — вставляем компенсацию. */
export const needsCounter = (next: Pose | undefined) => !!next && !['relax', 'forward', 'neutral', 'breath'].includes(next.kind);

export function buildSession(input: BuildInput): PlanStep[] {
  const rand = rng(input.seed);
  const adapt = input.adapt;
  const level = maxLevel(input.experience, input.week, input.limits, adapt?.boost ?? 0);
  const swapped = new Set(Object.keys(adapt?.swaps ?? {}));
  // поза, которой заменили неподходящую, получает её место — то есть заметный приоритет
  const preferred = new Set(Object.values(adapt?.swaps ?? {}));
  const allowed = POSES.filter((p) => isAllowed(p, input.limits, level) && !swapped.has(p.id));
  const can = (id: string) => allowed.some((p) => p.id === id);
  const avoid = input.avoid ?? new Set<string>();

  const holdOf = (p: Pose) =>
    p.kind === 'breath' ? p.hold : round5(clamp(p.hold * WEEK_HOLD[input.week] * EXPERIENCE_HOLD[input.experience] * (adapt?.hold ?? 1), MIN_HOLD, MAX_HOLD));
  const costOf = (p: Pose) => (holdOf(p) + PREP_NEW) * (p.bilateral ? 2 : 1);

  const goalScore = (p: Pose) => input.goals.reduce((s, g, i) => s + (p.goals[g] ?? 0) * (GOAL_WEIGHT[i] ?? 1), 0);

  const total = input.minutes * 60;
  const cr = centerRelax(input.minutes);
  const shares = blockShares(input);
  const rest = total - cr.centering - cr.relax;
  const used = new Set<string>();

  // Настройка: дыхательная практика под цели и время суток.
  const breaths = allowed.filter((p) => p.kind === 'breath');
  const breathScore = (p: Pose) =>
    goalScore(p) +
    (input.time === 'evening' && p.id === 'breath_long_exhale' ? 2 : 0) +
    (input.time === 'morning' && p.id === 'breath_full' ? 2 : 0) +
    rand() * 1.5 -
    (avoid.has(p.id) ? 1.5 : 0);
  const centering = [...breaths].sort((a, b) => breathScore(b) - breathScore(a))[0] ?? POSE_BY_ID.get('sukhasana')!;

  const fill = (block: Block, budget: number): Pose[] => {
    const picked: Pose[] = [];
    let left = budget;
    // Поз немного, а удержания потом растягиваются под время — так спокойнее, чем 35 поз по 15 секунд.
    const maxCount = Math.max(1, Math.round(budget / SECONDS_PER_POSE));
    while (picked.length < maxCount) {
      const fits = allowed.filter(
        (p) => p.blocks.includes(block) && p.kind !== 'breath' && p.id !== 'shavasana' && !used.has(p.id) && costOf(p) <= left + 8,
      );
      if (!fits.length) break;
      const score = (p: Pose) =>
        1 +
        goalScore(p) +
        rand() * 2 -
        (avoid.has(p.id) ? 2.5 : 0) -
        1.2 * picked.filter((q) => q.kind === p.kind).length -
        (p.kind === 'relax' ? 1.5 : 0) +
        (block === 'warmup' && p.id === 'cat_cow' ? 4 : 0) +
        (preferred.has(p.id) ? 3 : 0) +
        (input.week >= 3 && level > 1 && p.level === level ? 0.8 : 0) +
        (input.time === 'evening' && p.goals.calm ? 0.5 : 0) +
        (input.time === 'morning' && p.goals.energy ? 0.5 : 0) -
        (input.time === 'evening' && (p.goals.energy ?? 0) >= 2 && p.kind === 'backbend' ? 1.5 : 0);
      let best = fits[0];
      let bestScore = -Infinity;
      for (const p of fits) {
        const sc = score(p);
        if (sc > bestScore) {
          best = p;
          bestScore = sc;
        }
      }
      picked.push(best);
      used.add(best.id);
      left -= costOf(best);
    }
    return picked;
  };

  const picked = {} as Record<'warmup' | 'standing' | 'floor' | 'cooldown', Pose[]>;
  for (const b of ['warmup', 'standing', 'floor', 'cooldown'] as const) picked[b] = shares[b] > 0 ? fill(b, rest * shares[b]) : [];

  type Item = { pose: Pose; block: Block; counter?: boolean };
  const tag = (block: Block) => (pose: Pose): Item => ({ pose, block });
  const flat: Item[] = [
    { pose: centering, block: 'centering' },
    ...orderBlock('warmup', picked.warmup).map(tag('warmup')),
    ...orderBlock('standing', picked.standing).map(tag('standing')),
    ...orderFloor(picked.floor, picked.cooldown),
    { pose: POSE_BY_ID.get('shavasana')!, block: 'relax' },
  ];

  // Компенсации после прогибов.
  const withCounters: Item[] = [];
  flat.forEach((item, i) => {
    withCounters.push(item);
    if (item.pose.kind !== 'backbend' || !needsCounter(flat[i + 1]?.pose)) return;
    const lowPos = ['prone', 'kneeling', 'all4'].includes(item.pose.position);
    const counterId = lowPos && can('balasana') ? 'balasana' : 'apanasana';
    withCounters.push({ pose: POSE_BY_ID.get(counterId)!, block: item.block, counter: true });
  });

  const steps: PlanStep[] = [];
  for (const { pose, block, counter } of withCounters) {
    let hold = counter ? COUNTER_HOLD : holdOf(pose);
    if (pose.id === centering.id && block === 'centering') hold = cr.centering;
    if (block === 'relax') hold = cr.relax;
    const sides: Array<PlanStep['side']> = pose.bilateral ? ['right', 'left'] : [undefined];
    sides.forEach((side, k) => steps.push({ poseId: pose.id, side, hold, prep: k === 0 ? PREP_NEW : PREP_SIDE, block, ...(counter ? { counter } : {}) }));
  }
  // перед первой позой — время дойти до коврика и сесть
  if (steps[0]) steps[0].prep = PREP_FIRST;
  fitDuration(steps, total);
  return steps;
}

const holdLimits = (s: PlanStep): [number, number] => {
  if (s.block === 'relax') return [60, 420];
  if (s.block === 'centering') return [30, 300];
  return [MIN_HOLD, 150];
};

/** Подгоняет удержания так, чтобы занятие уложилось в выбранное время (±5%, в худшем случае ±10%). */
export function fitDuration(steps: PlanStep[], target: number): void {
  for (let iter = 0; iter < 6; iter++) {
    const total = sessionSeconds(steps);
    if (Math.abs(total - target) <= target * 0.05) return;
    // Сначала двигаем удержания поз; дыхание и шавасану — только если позы упёрлись в пределы.
    const adjustable = steps.filter((s) => !s.counter && (iter >= 3 || (s.block !== 'centering' && s.block !== 'relax')));
    const holds = adjustable.reduce((a, s) => a + s.hold, 0);
    const fixed = total - holds;
    const factor = (target - fixed) / holds;
    // Позы на две стороны должны остаться одинаковыми — считаем по позе, а не по шагу.
    const byPose = new Map<string, number>();
    for (const s of adjustable) {
      const key = `${s.poseId}:${s.block}`;
      if (!byPose.has(key)) {
        const [lo, hi] = holdLimits(s);
        byPose.set(key, clamp(round5(s.hold * factor), lo, hi));
      }
      s.hold = byPose.get(key)!;
    }
  }
}

// ---------- программа ----------

/** Неделя программы на дату (1…6), 0 — ещё не началась, 7 — закончилась. */
export function weekOf(program: Pick<Program, 'startDate'>, today: string): number {
  const days = Math.round((Date.parse(today) - Date.parse(program.startDate)) / 86_400_000);
  if (days < 0) return 0;
  return Math.min(PROGRAM_WEEKS + 1, Math.floor(days / 7) + 1);
}

const LETTERS = 'АБВ';

/** Все занятия недели. Разных занятий — до трёх (А, Б, В), дальше они повторяются. */
export function weekSessions(program: Program, week: number): SessionPlan[] {
  const p = program.profile;
  const n = p.days.length;
  const variants = Math.min(3, n);
  const avoid = new Set<string>();
  const base: PlanStep[][] = [];
  for (let v = 0; v < variants; v++) {
    const steps = buildSession({
      experience: p.experience,
      goals: p.goals,
      minutes: p.minutes,
      time: p.time,
      limits: p.limits,
      week,
      // занятия меняются раз в две недели: внутри фазы повторяем, чтобы позы успели освоиться
      seed: program.seed + v * 7919 + Math.floor((week - 1) / 2) * 104729,
      adapt: program.adapt,
      avoid: new Set(avoid),
    });
    steps.forEach((s) => avoid.add(s.poseId));
    base.push(steps);
  }
  const phase = phaseOf(week);
  return Array.from({ length: n }, (_, i) => {
    const steps = base[i % variants];
    return {
      key: `p:${program.id}:${week}:${i}`,
      title: `Занятие ${LETTERS[i % variants]}`,
      subtitle: `Неделя ${week} · ${phase.title} · ${Math.round(sessionSeconds(steps) / 60)} мин`,
      steps,
      programId: program.id,
      week,
      index: i,
    };
  });
}

// ---------- короткие практики ----------

const QUICK_SETUP: Record<QuickId, { goals: Goal[]; time: DayTime; shares: Shares }> = {
  morning: { goals: ['energy', 'flexibility', 'posture'], time: 'morning', shares: { warmup: 0.4, standing: 0.6, floor: 0, cooldown: 0 } },
  back: { goals: ['back', 'flexibility'], time: 'evening', shares: { warmup: 0.35, standing: 0, floor: 0.45, cooldown: 0.2 } },
  evening: { goals: ['calm', 'flexibility'], time: 'evening', shares: { warmup: 0.15, standing: 0, floor: 0.35, cooldown: 0.5 } },
  neck: { goals: ['posture', 'calm'], time: 'morning', shares: { warmup: 0.65, standing: 0.35, floor: 0, cooldown: 0 } },
};

/** Короткая практика с учётом опыта и ограничений из анкеты (без анкеты — как новичку). */
export function quickSession(id: QuickId, profile: Pick<Profile, 'experience' | 'limits'> | null, seed: number): SessionPlan {
  const meta = QUICK.find((q) => q.id === id)!;
  const setup = QUICK_SETUP[id];
  const steps = buildSession({
    experience: profile?.experience ?? 1,
    limits: profile?.limits ?? [],
    goals: setup.goals,
    time: setup.time,
    minutes: meta.minutes,
    week: 0,
    seed,
    shares: setup.shares,
  });
  return { key: `q:${id}`, title: meta.title, subtitle: `${Math.round(sessionSeconds(steps) / 60)} мин · ${meta.text}`, steps, quick: id };
}

/** Число из строки — «зерно» для практики дня: одна и та же весь день, завтра другая. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
