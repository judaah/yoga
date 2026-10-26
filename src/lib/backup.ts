import { db, TABLE_NAMES, type TableName } from '../db/db';
import { SETTING_LAST_BACKUP } from '../db/repo';

export const BACKUP_APP = 'yoga';
export const BACKUP_FORMAT = 1;
export const BACKUP_REMIND_DAYS = 14;
const DAY = 86_400_000;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export async function exportBackup(now: Date = new Date()): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const tables = {} as Record<TableName, unknown[]>;
    for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray();
    // дата бэкапа внутри самого бэкапа бессмысленна
    tables.settings = (tables.settings as Array<{ key: string }>).filter((s) => s.key !== SETTING_LAST_BACKUP);
    return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), tables };
  });
}

export const backupFileName = (now: Date = new Date()) => `yoga-backup-${now.toISOString().slice(0, 10)}.json`;

class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Проверяет разобранный JSON; ошибки — понятным текстом. */
export function validateBackup(data: unknown): BackupFile {
  if (!isObj(data) || data.app !== BACKUP_APP) throw new BackupError('Это не бэкап приложения «Йога»');
  if (typeof data.format !== 'number') throw new BackupError('Файл повреждён: нет версии формата');
  if (data.format > BACKUP_FORMAT) throw new BackupError('Бэкап сделан более новой версией приложения — сначала обнови приложение');
  if (!isStr(data.exportedAt) || !isObj(data.tables)) throw new BackupError('Файл повреждён');
  const tables = data.tables;
  for (const name of TABLE_NAMES) {
    if (tables[name] === undefined) tables[name] = [];
    if (!Array.isArray(tables[name])) throw new BackupError(`Файл повреждён: раздел ${name}`);
  }
  (tables.workouts as unknown[]).forEach((w, i) => {
    if (!isObj(w) || !isStr(w.id) || !isDate(w.date) || typeof w.startedAt !== 'number' || !Array.isArray(w.poses)) {
      throw new BackupError(`Файл повреждён: занятие №${i + 1}`);
    }
  });
  (tables.programs as unknown[]).forEach((p, i) => {
    if (!isObj(p) || !isStr(p.id) || !isDate(p.startDate) || !isObj(p.profile) || !isObj(p.adapt)) throw new BackupError(`Файл повреждён: программа №${i + 1}`);
  });
  (tables.tests as unknown[]).forEach((t, i) => {
    if (!isObj(t) || !isStr(t.id) || !isDate(t.date)) throw new BackupError(`Файл повреждён: тест №${i + 1}`);
  });
  (tables.settings as unknown[]).forEach((s, i) => {
    if (!isObj(s) || !isStr(s.key)) throw new BackupError(`Файл повреждён: настройка №${i + 1}`);
  });
  return data as unknown as BackupFile;
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Файл не читается: это не JSON');
  }
  return validateBackup(data);
}

/** Полностью заменяет данные на содержимое бэкапа. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkPut(backup.tables[name]);
    }
    await db.settings.put({ key: SETTING_LAST_BACKUP, value: Date.parse(backup.exportedAt) });
  });
}

/** Напомнить про бэкап: последний был больше 14 дней назад; если не было — 14 дней с первого занятия. */
export function needsBackupReminder(lastBackupAt: number | null, firstWorkoutAt: number | null, now: number = Date.now()): boolean {
  if (firstWorkoutAt === null) return false;
  return now - (lastBackupAt ?? firstWorkoutAt) > BACKUP_REMIND_DAYS * DAY;
}
