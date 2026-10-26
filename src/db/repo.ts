import { db, type Workout } from './db';
import { PROGRAM_WEEKS, type Profile, type Program, type SessionPlan } from '../data/program';
import { weekOf, weekSessions } from '../lib/planner';
import { today } from '../lib/dates';

export const SETTING_ACTIVE_PROGRAM = 'activeProgram';
export const SETTING_VOICE = 'voice';
export const SETTING_SOUND = 'sound';
export const SETTING_LAST_BACKUP = 'lastBackup';
/** Последняя анкета — чтобы пройти её заново с теми же ответами. */
export const SETTING_PROFILE = 'profile';

export const newId = () => crypto.randomUUID();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function activeProgram(): Promise<Program | null> {
  const id = await getSetting<string | null>(SETTING_ACTIVE_PROGRAM, null);
  return (id && (await db.programs.get(id))) || null;
}

/** Новая программа по анкете. Старая активная остаётся в истории со статусом «заменена». */
export async function createProgram(profile: Profile, now: Date = new Date()): Promise<Program> {
  return db.transaction('rw', db.programs, db.settings, async () => {
    const prev = await activeProgram();
    if (prev && prev.status === 'active') await db.programs.update(prev.id, { status: 'replaced' });
    const count = await db.programs.count();
    const program: Program = {
      id: newId(),
      createdAt: now.getTime(),
      startDate: today(now),
      profile,
      seed: Math.floor(Math.random() * 2 ** 31),
      adapt: { hold: 1, boost: 0, swaps: {}, skips: {}, ratings: [] },
      number: count + 1,
      status: 'active',
    };
    await db.programs.add(program);
    await setSetting(SETTING_ACTIVE_PROGRAM, program.id);
    await setSetting(SETTING_PROFILE, profile);
    return program;
  });
}

export interface WeekState {
  week: number;
  sessions: SessionPlan[];
  /** какие занятия недели сделаны: по номеру занятия */
  done: Map<number, Workout>;
}

/** Состояние недели программы: занятия и какие из них уже сделаны. */
export async function weekState(program: Program, week: number): Promise<WeekState> {
  const sessions = weekSessions(program, week);
  const workouts = await db.workouts.where('programId').equals(program.id).toArray();
  const done = new Map<number, Workout>();
  for (const w of workouts) if (w.week === week && w.index !== undefined && !done.has(w.index)) done.set(w.index, w);
  return { week, sessions, done };
}

/** Следующее несделанное занятие текущей недели; null — план недели выполнен или программа кончилась. */
export function nextSession(state: WeekState): SessionPlan | null {
  if (state.week < 1 || state.week > PROGRAM_WEEKS) return null;
  return state.sessions.find((s) => !state.done.has(s.index!)) ?? null;
}

export const currentWeek = (program: Program, day: string = today()) => weekOf(program, day);
