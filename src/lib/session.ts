// Ход занятия без интерфейса: шаг, фаза «приготовься/держим», пауза, пропуск, +15 секунд.
// Время считается по отметкам часов, а не по тикам: свернул приложение — ничего не «убежало».

import { POSE_BY_ID } from '../data/poses';
import { sessionSeconds, type SessionPlan } from '../data/program';
import type { Workout, WorkoutPose } from '../db/db';

export type Phase = 'prep' | 'hold';

export interface StepLog {
  /** сколько простоял в позе, секунды */
  actual: number;
  skipped: boolean;
}

export interface RunState {
  index: number;
  phase: Phase;
  /** накоплено секунд в текущей фазе до последней паузы */
  elapsed: number;
  /** сколько секунд фазы было на прошлом тике — чтобы поймать «половину» и «последние 3 секунды» */
  seen: number;
  /** добавлено кнопкой «+15 с» к текущему удержанию */
  extra: number;
  running: boolean;
  /** когда в последний раз нажали «продолжить» (мс), null — на паузе */
  resumedAt: number | null;
  startedAt: number;
  logs: Array<StepLog | null>;
  /** шаг → поза, на которую заменили кнопкой «полегче» */
  replaced: Record<number, string>;
  done: boolean;
}

export type RunEvent =
  | { type: 'prep'; index: number; sideSwitch: boolean }
  | { type: 'hold'; index: number }
  | { type: 'half'; index: number }
  | { type: 'last3'; index: number }
  | { type: 'done' };

export const EXTRA_SECONDS = 15;

export function startRun(now: number): RunState {
  return { index: 0, phase: 'prep', elapsed: 0, seen: 0, extra: 0, running: true, resumedAt: now, startedAt: now, logs: [], replaced: {}, done: false };
}

/** Поза шага с учётом замены «полегче». */
export const poseIdAt = (state: RunState, plan: SessionPlan, index: number) => state.replaced[index] ?? plan.steps[index].poseId;

export function phaseLength(state: RunState, plan: SessionPlan): number {
  const step = plan.steps[state.index];
  return state.phase === 'prep' ? step.prep : step.hold + state.extra;
}

/** Секунд прошло в текущей фазе. */
export function phaseElapsed(state: RunState, now: number): number {
  return state.elapsed + (state.running && state.resumedAt !== null ? Math.max(0, now - state.resumedAt) / 1000 : 0);
}

export const isSideSwitch = (plan: SessionPlan, index: number) =>
  index > 0 && plan.steps[index].side === 'left' && plan.steps[index - 1].poseId === plan.steps[index].poseId;

function goTo(state: RunState, plan: SessionPlan, index: number, now: number, events: RunEvent[]): RunState {
  if (index >= plan.steps.length) {
    events.push({ type: 'done' });
    return { ...state, done: true, running: false, resumedAt: null, elapsed: 0, seen: 0, extra: 0 };
  }
  events.push({ type: 'prep', index, sideSwitch: isSideSwitch(plan, index) });
  return { ...state, index, phase: 'prep', elapsed: 0, seen: 0, extra: 0, resumedAt: state.running ? now : null };
}

function logStep(state: RunState, actual: number, skipped: boolean): RunState {
  const logs = [...state.logs];
  logs[state.index] = { actual: Math.round(actual), skipped };
  return { ...state, logs };
}

/** Продвигает занятие к моменту now и возвращает события для голоса и звука. */
export function tick(state: RunState, plan: SessionPlan, now: number): { state: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  if (state.done || !state.running) return { state, events };
  const len = phaseLength(state, plan);
  const t = phaseElapsed(state, now);
  if (t < len) {
    if (state.phase === 'hold') {
      const half = len / 2;
      if (len >= 30 && state.seen < half && t >= half) events.push({ type: 'half', index: state.index });
      if (len >= 10 && state.seen < len - 3 && t >= len - 3) events.push({ type: 'last3', index: state.index });
    }
    return { state: { ...state, seen: t }, events };
  }
  if (state.phase === 'prep') {
    events.push({ type: 'hold', index: state.index });
    return { state: { ...state, phase: 'hold', elapsed: 0, seen: 0, resumedAt: now }, events };
  }
  return { state: goTo(logStep(state, len, false), plan, state.index + 1, now, events), events };
}

export function pause(state: RunState, now: number): RunState {
  if (!state.running || state.done) return state;
  return { ...state, running: false, elapsed: phaseElapsed(state, now), resumedAt: null };
}

export function resume(state: RunState, now: number): RunState {
  if (state.running || state.done) return state;
  return { ...state, running: true, resumedAt: now };
}

/** «Дальше»: на подготовке — сразу к удержанию; в удержании — шаг засчитан как есть (или пропущен, если почти не стоял). */
export function next(state: RunState, plan: SessionPlan, now: number): { state: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  if (state.done) return { state, events };
  if (state.phase === 'prep') {
    events.push({ type: 'hold', index: state.index });
    return { state: { ...state, phase: 'hold', elapsed: 0, seen: 0, resumedAt: state.running ? now : null }, events };
  }
  const t = phaseElapsed(state, now);
  // меньше трети удержания — считаем, что поза пропущена
  const skipped = t < phaseLength(state, plan) / 3;
  return { state: goTo(logStep(state, t, skipped), plan, state.index + 1, now, events), events };
}

/** «Назад»: в начало текущего шага, а если он только начался — к предыдущему. */
export function prev(state: RunState, plan: SessionPlan, now: number): { state: RunState; events: RunEvent[] } {
  const events: RunEvent[] = [];
  if (state.done) return { state, events };
  const t = phaseElapsed(state, now);
  const target = state.phase === 'prep' && t < 2 && state.index > 0 ? state.index - 1 : state.index;
  const logs = [...state.logs];
  logs[target] = null;
  return { state: goTo({ ...state, logs }, plan, target, now, events), events };
}

export function addTime(state: RunState): RunState {
  return state.phase === 'hold' ? { ...state, extra: state.extra + EXTRA_SECONDS } : state;
}

/** Заменить позу текущего шага (и её вторую сторону) на более лёгкую до конца занятия. */
export function replaceWithEasier(state: RunState, plan: SessionPlan): RunState {
  const id = poseIdAt(state, plan, state.index);
  const easier = POSE_BY_ID.get(id)?.easier;
  if (!easier) return state;
  const replaced = { ...state.replaced };
  plan.steps.forEach((_, i) => {
    if (i >= state.index && poseIdAt(state, plan, i) === id) replaced[i] = easier;
  });
  return { ...state, replaced };
}

/** Закончить раньше: текущий шаг засчитывается по факту, остальные — пропущены. */
export function finishEarly(state: RunState, plan: SessionPlan, now: number): RunState {
  let s = state;
  if (!s.done && s.phase === 'hold') s = logStep(s, phaseElapsed(s, now), phaseElapsed(s, now) < phaseLength(s, plan) / 3);
  return { ...s, done: true, running: false, resumedAt: null };
}

/** Доля пройденного занятия 0…1 — для полоски прогресса. */
export function progress(state: RunState, plan: SessionPlan, now: number): number {
  if (state.done) return 1;
  const total = sessionSeconds(plan.steps);
  let before = 0;
  for (let i = 0; i < state.index; i++) before += plan.steps[i].prep + plan.steps[i].hold;
  const t = phaseElapsed(state, now);
  const inStep = state.phase === 'prep' ? t : plan.steps[state.index].prep + Math.min(t, plan.steps[state.index].hold);
  return Math.min(1, (before + inStep) / total);
}

/** Позы занятия для журнала: что было по плану и что на самом деле. Не дошёл до шага — пропущен. */
export function workoutPoses(state: RunState, plan: SessionPlan): WorkoutPose[] {
  return plan.steps.map((s, i) => {
    const log = state.logs[i];
    return {
      poseId: poseIdAt(state, plan, i),
      ...(s.side ? { side: s.side } : {}),
      planned: s.hold,
      actual: log?.actual ?? 0,
      skipped: log ? log.skipped : true,
      ...(s.counter ? { counter: true } : {}),
      ...(state.replaced[i] ? { replacedFrom: s.poseId } : {}),
    };
  });
}

/** Запись для журнала (без оценки и самочувствия — их добавляет экран завершения). */
export function toWorkout(state: RunState, plan: SessionPlan, id: string, date: string, now: number): Workout {
  const poses = workoutPoses(state, plan);
  return {
    id,
    date,
    startedAt: state.startedAt,
    endedAt: now,
    kind: plan.programId ? 'program' : 'quick',
    title: plan.title,
    ...(plan.programId ? { programId: plan.programId, week: plan.week, index: plan.index } : {}),
    ...(plan.quick ? { quick: plan.quick } : {}),
    plannedSec: sessionSeconds(plan.steps),
    actualSec: poses.reduce((s, p) => s + p.actual, 0) + plan.steps.reduce((s, x, i) => s + (state.logs[i] ? x.prep : 0), 0),
    poses,
    note: '',
  };
}
