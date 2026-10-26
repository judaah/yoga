import type { Block, Goal, Limit } from './types';

export type Experience = 1 | 2 | 3;
export type DayTime = 'morning' | 'evening';

export const EXPERIENCE: Array<{ id: Experience; label: string; hint: string }> = [
  { id: 1, label: 'Никогда или почти никогда', hint: 'начнём с простых поз и коротких удержаний' },
  { id: 2, label: 'Иногда занимаюсь', hint: 'знаю основные позы, хочу системности' },
  { id: 3, label: 'Занимаюсь регулярно', hint: 'нужны более сложные позы и длинные удержания' },
];

export const MINUTES = [10, 20, 30, 45] as const;
export type Minutes = (typeof MINUTES)[number];

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Ответы анкеты. Дни недели: 0 — понедельник … 6 — воскресенье. */
export interface Profile {
  experience: Experience;
  goals: Goal[];
  minutes: Minutes;
  days: number[];
  time: DayTime;
  limits: Limit[];
  /** время напоминания «ЧЧ:ММ» — для событий в Календаре */
  remindAt: string;
}

/** Как программа подстроилась под оценки занятий. */
export interface Adaptation {
  /** множитель удержаний, 0.7…1.4 */
  hold: number;
  /** на сколько уровней выше можно брать позы (0 или 1) */
  boost: number;
  /** поза → чем её заменили, потому что не шла */
  swaps: Record<string, string>;
  /** сколько раз подряд пропущена поза */
  skips: Record<string, number>;
  /** последние оценки занятий, новые в конце */
  ratings: Rating[];
}

export type Rating = 'easy' | 'ok' | 'hard';

export const PROGRAM_WEEKS = 6;

export interface Program {
  id: string;
  createdAt: number;
  /** первый день программы, 'YYYY-MM-DD'; недели считаются по 7 дней от него */
  startDate: string;
  profile: Profile;
  seed: number;
  adapt: Adaptation;
  /** номер по счёту: «Программа 2» */
  number: number;
  status: 'active' | 'done' | 'replaced';
}

export const PHASES: Array<{ weeks: number[]; title: string; text: string }> = [
  { weeks: [1, 2], title: 'Знакомство', text: 'Короткие удержания, учимся входить в позы и дышать.' },
  { weeks: [3, 4], title: 'Развитие', text: 'Удержания длиннее, позы выстраиваются в связки.' },
  { weeks: [5], title: 'Усложнение', text: 'Появляются позы уровнем выше.' },
  { weeks: [6], title: 'Закрепление', text: 'Закрепляем результат и повторяем тест гибкости.' },
];

export const phaseOf = (week: number) => PHASES.find((p) => p.weeks.includes(week)) ?? PHASES[PHASES.length - 1];

/** Шаг занятия: одна поза на одну сторону. */
export interface PlanStep {
  poseId: string;
  side?: 'right' | 'left';
  /** удержание, секунды */
  hold: number;
  /** время на переход и подсказку голосом перед удержанием, секунды */
  prep: number;
  block: Block;
  /** вставлена как компенсация после прогиба */
  counter?: boolean;
}

export interface SessionPlan {
  /** «p:<программа>:<неделя>:<номер>» или «q:<практика>» */
  key: string;
  title: string;
  subtitle: string;
  steps: PlanStep[];
  programId?: string;
  week?: number;
  /** номер занятия в неделе, с нуля */
  index?: number;
  quick?: QuickId;
}

export type QuickId = 'morning' | 'back' | 'evening' | 'neck';

export const QUICK: Array<{ id: QuickId; title: string; minutes: number; text: string; emoji: string }> = [
  { id: 'morning', title: 'Утро', minutes: 10, text: 'Проснуться и размяться', emoji: '☀️' },
  { id: 'back', title: 'Спина', minutes: 15, text: 'Разгрузить спину', emoji: '🌿' },
  { id: 'evening', title: 'Перед сном', minutes: 10, text: 'Успокоиться и расслабиться', emoji: '🌙' },
  { id: 'neck', title: 'Шея и плечи', minutes: 10, text: 'После работы за компьютером', emoji: '🪑' },
];

export const sessionSeconds = (steps: PlanStep[]) => steps.reduce((s, x) => s + x.hold + x.prep, 0);
