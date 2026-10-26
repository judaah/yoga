import type { Figure } from '../lib/figure';

/** Цели из анкеты. */
export type Goal = 'flexibility' | 'back' | 'strength' | 'balance' | 'calm' | 'posture' | 'energy';

export const GOALS: Array<{ id: Goal; label: string; hint: string; emoji: string }> = [
  { id: 'flexibility', label: 'Гибкость', hint: 'наклоны, задняя поверхность ног, бёдра', emoji: '🤸' },
  { id: 'back', label: 'Здоровая спина', hint: 'мягко разгрузить и укрепить спину', emoji: '🌿' },
  { id: 'strength', label: 'Сила и тонус', hint: 'ноги, кор, руки', emoji: '💪' },
  { id: 'balance', label: 'Баланс', hint: 'устойчивость и координация', emoji: '⚖️' },
  { id: 'calm', label: 'Стресс и сон', hint: 'расслабиться, спокойнее засыпать', emoji: '🌙' },
  { id: 'posture', label: 'Осанка', hint: 'шея, плечи и грудь после сидячей работы', emoji: '🪑' },
  { id: 'energy', label: 'Бодрость', hint: 'проснуться и зарядиться', emoji: '☀️' },
];

/** Ограничения по здоровью из анкеты. */
export type Limit = 'lowerBack' | 'knees' | 'wrists' | 'neck' | 'pressure' | 'injury';

export const LIMITS: Array<{ id: Limit; label: string; hint: string }> = [
  { id: 'lowerBack', label: 'Поясница, грыжа или протрузия', hint: 'уберём глубокие наклоны с круглой спиной, сильные прогибы и скрутки' },
  { id: 'knees', label: 'Колени', hint: 'уберём глубокие выпады, приседы и позы с опорой на колени' },
  { id: 'wrists', label: 'Запястья', hint: 'уберём упоры на прямые руки — будут варианты на предплечьях' },
  { id: 'neck', label: 'Шея', hint: 'уберём позы с нагрузкой на шею и запрокидыванием головы' },
  { id: 'pressure', label: 'Высокое давление или глаукома', hint: 'уберём перевёрнутые позы, глубокие наклоны головой вниз и задержки дыхания' },
  { id: 'injury', label: 'Недавняя травма или операция', hint: 'оставим только позы первого уровня — и обязательно согласуй занятия с врачом' },
];

export type PoseGroup = 'standing' | 'balance' | 'forward' | 'backbend' | 'twist' | 'hips' | 'core' | 'supine' | 'inversion' | 'rest';

export const GROUPS: Array<{ id: PoseGroup; label: string }> = [
  { id: 'standing', label: 'Стоя' },
  { id: 'balance', label: 'Баланс' },
  { id: 'forward', label: 'Наклоны вперёд' },
  { id: 'backbend', label: 'Прогибы' },
  { id: 'twist', label: 'Скрутки' },
  { id: 'hips', label: 'Сидя и бёдра' },
  { id: 'core', label: 'Кор и руки' },
  { id: 'supine', label: 'Лёжа на спине' },
  { id: 'inversion', label: 'Перевёрнутые' },
  { id: 'rest', label: 'Дыхание и отдых' },
];

/** Положение тела — по нему занятие выстраивается без лишних вставаний и ложений. */
export type Position = 'standing' | 'kneeling' | 'all4' | 'prone' | 'seated' | 'supine';

/** Характер позы — для правил последовательности. */
export type Kind = 'neutral' | 'backbend' | 'forward' | 'twist' | 'side' | 'balance' | 'core' | 'hip' | 'inversion' | 'relax' | 'breath';

/** Части занятия. */
export type Block = 'centering' | 'warmup' | 'standing' | 'floor' | 'cooldown' | 'relax';

export interface BreathPattern {
  /** секунды: вдох, задержка, выдох, задержка после выдоха */
  inhale: number;
  hold?: number;
  exhale: number;
  holdOut?: number;
}

export interface Pose {
  id: string;
  name: string;
  sanskrit?: string;
  group: PoseGroup;
  level: 1 | 2 | 3;
  position: Position;
  kind: Kind;
  blocks: Block[];
  goals: Partial<Record<Goal, 1 | 2 | 3>>;
  /** Базовое удержание на одну сторону, секунды (для уровня 1, первой недели — меньше). */
  hold: number;
  /** Делается на две стороны: сначала правая, потом левая. */
  bilateral?: boolean;
  /** Как войти в позу — по шагам. */
  steps: string[];
  /** На что обратить внимание; первые одна-две подсказки звучат голосом. */
  cues: string[];
  /** Упрощённый вариант словами. */
  easy?: string;
  /** Более лёгкая поза — на неё меняем, если эта не идёт. */
  easier?: string;
  contra: Limit[];
  figure: Figure;
  /** Вторая фигурка для динамики: фигурка плавно ходит между ними в ритме дыхания. */
  alt?: Figure;
  breath?: BreathPattern;
}
