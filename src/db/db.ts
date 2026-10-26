import Dexie, { type EntityTable } from 'dexie';
import type { Program, QuickId, Rating } from '../data/program';

/** Самочувствие по шкале 1–5; не заполнено — undefined. */
export interface Wellness {
  energy?: number;
  mood?: number;
  /** напряжение или боль в спине: 1 — нет, 5 — сильно */
  tension?: number;
}

export interface WorkoutPose {
  poseId: string;
  side?: 'right' | 'left';
  /** удержание по плану и сколько простоял на самом деле, секунды */
  planned: number;
  actual: number;
  skipped: boolean;
  /** отметка «получилось» после занятия */
  ok?: boolean;
  /** компенсация после прогиба — в статистику освоения не идёт */
  counter?: boolean;
  /** заменена кнопкой «полегче»: какая поза была по плану */
  replacedFrom?: string;
}

export type WorkoutKind = 'program' | 'quick' | 'manual';

export interface Workout {
  id: string;
  /** 'YYYY-MM-DD', местное время начала */
  date: string;
  startedAt: number;
  endedAt: number;
  kind: WorkoutKind;
  title: string;
  programId?: string;
  week?: number;
  /** номер занятия в неделе программы */
  index?: number;
  quick?: QuickId;
  plannedSec: number;
  actualSec: number;
  poses: WorkoutPose[];
  rating?: Rating;
  before?: Wellness;
  after?: Wellness;
  note: string;
  /** для ручной записи: «студия», «дома по видео» */
  place?: string;
}

/** Тест гибкости. Все замеры необязательные: что успел — то и записал. */
export interface FlexTest {
  id: string;
  date: string;
  createdAt: number;
  /** наклон вперёд стоя: см от кончиков пальцев до пола; не достаёт — минус */
  fold?: number;
  /** руки за спиной: см между пальцами; сцепил — 0, заходят друг за друга — плюс */
  shouldersR?: number;
  shouldersL?: number;
  /** баланс на одной ноге, секунды */
  balanceR?: number;
  balanceL?: number;
  /** планка на предплечьях, секунды */
  plank?: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const TABLE_NAMES = ['programs', 'workouts', 'tests', 'settings'] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export class YogaDB extends Dexie {
  programs!: EntityTable<Program, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  tests!: EntityTable<FlexTest, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'yoga') {
    super(name);
    // Схема сразу под все этапы спеки. Новые поля и индексы — только через this.version(2) с upgrade().
    this.version(1).stores({
      programs: 'id, createdAt, status',
      workouts: 'id, date, programId, startedAt, kind',
      tests: 'id, date',
      settings: 'key',
    });
  }
}

export const db = new YogaDB();
