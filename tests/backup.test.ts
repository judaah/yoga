import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { createProgram, SETTING_LAST_BACKUP } from '../src/db/repo';
import { exportBackup, needsBackupReminder, parseBackup, restoreBackup } from '../src/lib/backup';
import { programIcs } from '../src/lib/ics';
import type { Profile } from '../src/data/program';

const profile: Profile = { experience: 2, goals: ['back'], minutes: 30, days: [0, 2, 4], time: 'evening', limits: [], remindAt: '19:30' };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('бэкап', () => {
  it('туда и обратно: все таблицы восстанавливаются, дата бэкапа не уходит в файл', async () => {
    const program = await createProgram(profile, new Date(2026, 9, 26));
    await db.workouts.add({ id: 'w1', date: '2026-10-26', startedAt: 1, endedAt: 2, kind: 'program', title: 'А', programId: program.id, week: 1, index: 0, plannedSec: 1800, actualSec: 1700, poses: [{ poseId: 'tree', planned: 30, actual: 30, skipped: false, ok: true }], note: 'колено', rating: 'ok' });
    await db.tests.add({ id: 't1', date: '2026-10-26', createdAt: 1, fold: -5.5 });
    await db.settings.put({ key: SETTING_LAST_BACKUP, value: 123 });
    const file = await exportBackup(new Date('2026-10-27T10:00:00Z'));
    expect((file.tables.settings as Array<{ key: string }>).some((s) => s.key === SETTING_LAST_BACKUP)).toBe(false);
    const text = JSON.stringify(file);

    await db.workouts.clear();
    await db.programs.clear();
    await db.tests.clear();
    await restoreBackup(parseBackup(text));
    expect(await db.workouts.get('w1')).toMatchObject({ note: 'колено', rating: 'ok' });
    expect((await db.programs.get(program.id))?.profile).toEqual(profile);
    expect((await db.tests.get('t1'))?.fold).toBe(-5.5);
    expect((await db.settings.get(SETTING_LAST_BACKUP))?.value).toBe(Date.parse('2026-10-27T10:00:00Z'));
  });

  it('чужой и битый файл — понятная ошибка', () => {
    expect(() => parseBackup('не json')).toThrow('это не JSON');
    expect(() => parseBackup(JSON.stringify({ app: 'rashody' }))).toThrow('не бэкап приложения «Йога»');
    expect(() => parseBackup(JSON.stringify({ app: 'yoga', format: 99, exportedAt: '', tables: {} }))).toThrow('более новой версией');
    expect(() => parseBackup(JSON.stringify({ app: 'yoga', format: 1, exportedAt: 'x', tables: { workouts: [{ id: 'w', date: '26.10.2026' }] } }))).toThrow('занятие №1');
  });

  it('напоминание про бэкап через 14 дней', () => {
    const day = 86_400_000;
    expect(needsBackupReminder(null, null)).toBe(false);
    expect(needsBackupReminder(null, 0, 13 * day)).toBe(false);
    expect(needsBackupReminder(null, 0, 15 * day)).toBe(true);
    expect(needsBackupReminder(10 * day, 0, 20 * day)).toBe(false);
  });
});

describe('календарь', () => {
  it('одно повторяющееся событие на дни программы до конца шести недель', async () => {
    // программа начинается во вторник 27.10 — первое занятие в среду 28.10
    const program = await createProgram(profile, new Date(2026, 9, 27));
    const ics = programIcs(program, new Date('2026-10-27T08:00:00Z'));
    expect(ics).toContain('DTSTART:20261028T193000');
    expect(ics).toContain('DTEND:20261028T200000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261207T235959');
    expect(ics).toContain('SUMMARY:Йога\\, 30 мин');
    expect(ics).toContain('TRIGGER:-PT10M');
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('занятие через полночь не ломает время окончания', async () => {
    const program = await createProgram({ ...profile, remindAt: '23:45', minutes: 45 }, new Date(2026, 9, 26));
    const ics = programIcs(program);
    expect(ics).toContain('DTSTART:20261026T234500');
    expect(ics).toContain('DTEND:20261027T003000');
  });
});
