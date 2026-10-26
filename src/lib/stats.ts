// Расчёты для экрана «Прогресс»: чистые функции над журналом и тестами.

import { POSE_BY_ID } from '../data/poses';
import type { FlexTest, Wellness, Workout } from '../db/db';
import { addDays, daysBetween, parseISODate, toISODate } from './dates';

/** Понедельник недели, в которую попадает дата. */
export function weekStart(iso: string): string {
  const d = parseISODate(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

/**
 * Дней подряд с занятиями. Сегодня ещё не занимался — серия не прерывается, считаем до вчера.
 */
export function dayStreak(dates: string[], today: string): number {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * Недель подряд с выполненным планом (не меньше target занятий за календарную неделю).
 * Текущая неделя засчитывается, если план уже выполнен; если нет — не прерывает серию.
 */
export function weekStreak(dates: string[], today: string, target: number): number {
  const perWeek = new Map<string, number>();
  for (const d of dates) perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) ?? 0) + 1);
  let week = weekStart(today);
  let n = 0;
  if ((perWeek.get(week) ?? 0) >= target) n++;
  week = addDays(week, -7);
  while ((perWeek.get(week) ?? 0) >= target) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

export interface WeekMinutes {
  start: string;
  minutes: number;
  count: number;
}

/** Минуты и число занятий по неделям, последние weeks недель, старые слева. */
export function minutesByWeek(workouts: Workout[], today: string, weeks = 8): WeekMinutes[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const out: WeekMinutes[] = Array.from({ length: weeks }, (_, i) => ({ start: addDays(first, i * 7), minutes: 0, count: 0 }));
  for (const w of workouts) {
    const i = Math.floor(daysBetween(first, w.date) / 7);
    if (i < 0 || i >= weeks) continue;
    out[i].minutes += Math.round(w.actualSec / 60);
    out[i].count++;
  }
  return out;
}

/** Минуты по дням месяца 'YYYY-MM' — для календаря. */
export function minutesByDay(workouts: Workout[], ym: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of workouts) if (w.date.startsWith(ym)) m.set(w.date, (m.get(w.date) ?? 0) + Math.max(1, Math.round(w.actualSec / 60)));
  return m;
}

/** Сетка месяца: недели с понедельника, null — дни соседних месяцев. */
export function monthGrid(ym: string): Array<Array<string | null>> {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => toISODate(new Date(y, m - 1, i + 1)))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

// ---------- самочувствие ----------

export type WellnessKey = keyof Wellness;

export interface WellnessPoint {
  date: string;
  before?: number;
  after?: number;
}

/** По каждому показателю: точки по занятиям (старые слева) и средний сдвиг «после − до». */
export function wellnessStats(workouts: Workout[], key: WellnessKey): { points: WellnessPoint[]; shift: number | null; pairs: number } {
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  const points: WellnessPoint[] = [];
  let sum = 0;
  let pairs = 0;
  for (const w of sorted) {
    const b = w.before?.[key];
    const a = w.after?.[key];
    if (b === undefined && a === undefined) continue;
    points.push({ date: w.date, before: b, after: a });
    if (b !== undefined && a !== undefined) {
      sum += a - b;
      pairs++;
    }
  }
  return { points, shift: pairs ? Math.round((sum / pairs) * 10) / 10 : null, pairs };
}

// ---------- освоение поз ----------

export type MasteryStatus = 'new' | 'learning' | 'mastered';

export interface PoseMastery {
  poseId: string;
  /** в скольких занятиях делал (хотя бы одну сторону) */
  times: number;
  /** лучшее удержание, секунды */
  best: number;
  /** доля «получилось» среди последних пяти раз */
  okRecent: number;
  /** сколько раз пропускал */
  skips: number;
  status: MasteryStatus;
  lastDate: string;
}

export const MASTERY_TIMES = 5;
export const MASTERY_OK = 4;

/**
 * Освоение по журналу. «Освоена» — сделана не меньше 5 раз и «получилось» в 4 из последних 5.
 * Компенсации и дыхательные практики не считаются.
 */
export function mastery(workouts: Workout[]): PoseMastery[] {
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  const acc = new Map<string, { oks: boolean[]; best: number; skips: number; lastDate: string }>();
  for (const w of sorted) {
    const seen = new Map<string, { done: boolean; ok: boolean; skipped: boolean; best: number }>();
    for (const p of w.poses) {
      if (p.counter) continue;
      const pose = POSE_BY_ID.get(p.poseId);
      if (!pose || pose.kind === 'breath' || pose.id === 'shavasana') continue;
      const s = seen.get(p.poseId) ?? { done: false, ok: true, skipped: false, best: 0 };
      if (p.skipped) s.skipped = true;
      else {
        s.done = true;
        s.best = Math.max(s.best, p.actual);
        if (p.ok === false) s.ok = false;
      }
      seen.set(p.poseId, s);
    }
    for (const [id, s] of seen) {
      const a = acc.get(id) ?? { oks: [], best: 0, skips: 0, lastDate: w.date };
      if (s.done) {
        a.oks.push(s.ok);
        a.best = Math.max(a.best, s.best);
        a.lastDate = w.date;
      }
      if (s.skipped && !s.done) a.skips++;
      acc.set(id, a);
    }
  }
  return [...acc.entries()].map(([poseId, a]) => {
    const recent = a.oks.slice(-MASTERY_TIMES);
    const okCount = recent.filter(Boolean).length;
    const status: MasteryStatus = a.oks.length >= MASTERY_TIMES && okCount >= MASTERY_OK ? 'mastered' : a.oks.length > 0 ? 'learning' : 'new';
    return { poseId, times: a.oks.length, best: a.best, okRecent: recent.length ? okCount / recent.length : 0, skips: a.skips, status, lastDate: a.lastDate };
  });
}

// ---------- тесты гибкости ----------

export const TEST_EVERY_DAYS = 14;

export type TestKey = Exclude<keyof FlexTest, 'id' | 'date' | 'createdAt'>;

export const TESTS: Array<{ id: string; title: string; unit: 'см' | 'с'; keys: TestKey[]; how: string; higherIsBetter: true; max?: number }> = [
  {
    id: 'fold',
    title: 'Наклон вперёд стоя',
    unit: 'см',
    keys: ['fold'],
    how: 'Встань на ступеньку или книгу, ноги прямые. Плавно наклонись и потянись пальцами вниз. Измерь линейкой расстояние от кончиков пальцев до опоры: не достаёшь — с минусом, опускаешься ниже — с плюсом.',
    higherIsBetter: true,
  },
  {
    id: 'shoulders',
    title: 'Руки за спиной',
    unit: 'см',
    keys: ['shouldersR', 'shouldersL'],
    how: 'Правую руку заведи за спину сверху через плечо, левую — снизу. Тянись пальцами навстречу. Не сомкнулись — расстояние с минусом, сомкнулись — 0, заходят друг за друга — с плюсом. Потом поменяй руки.',
    higherIsBetter: true,
  },
  {
    id: 'balance',
    title: 'Баланс на одной ноге',
    unit: 'с',
    keys: ['balanceR', 'balanceL'],
    how: 'Встань на правую ногу, левую согни, руки на поясе, глаза открыты. Запусти секундомер, остановись, когда опустишь ногу или пройдёт минута. Потом на левой.',
    higherIsBetter: true,
    max: 60,
  },
  {
    id: 'plank',
    title: 'Планка на предплечьях',
    unit: 'с',
    keys: ['plank'],
    how: 'Встань в планку на предплечьях, тело прямое. Держи, пока сохраняешь ровную линию, но не дольше двух минут.',
    higherIsBetter: true,
    max: 120,
  },
];

/** Пора ли тест гибкости: ещё не было или прошло 14 дней. */
export function testDue(tests: FlexTest[], today: string): boolean {
  if (!tests.length) return true;
  const last = tests.reduce((a, b) => (a.date > b.date ? a : b));
  return daysBetween(last.date, today) >= TEST_EVERY_DAYS;
}

/** Ряд значений одного замера по датам (старые слева). */
export function testSeries(tests: FlexTest[], key: TestKey): Array<{ date: string; value: number }> {
  return [...tests]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .filter((t) => typeof t[key] === 'number')
    .map((t) => ({ date: t.date, value: t[key] as number }));
}
