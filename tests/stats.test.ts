import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutPose } from '../src/db/db';
import { dayStreak, mastery, minutesByDay, minutesByWeek, monthGrid, testDue, testSeries, weekStart, weekStreak, wellnessStats } from '../src/lib/stats';

let seq = 0;
const w = (date: string, extra: Partial<Workout> = {}): Workout => ({
  id: `w${++seq}`,
  date,
  startedAt: Date.parse(date) + seq,
  endedAt: Date.parse(date) + seq + 1,
  kind: 'program',
  title: 'Занятие',
  plannedSec: 1800,
  actualSec: 1800,
  poses: [],
  note: '',
  ...extra,
});
const p = (poseId: string, extra: Partial<WorkoutPose> = {}): WorkoutPose => ({ poseId, planned: 30, actual: 30, skipped: false, ...extra });

describe('серии', () => {
  it('дни подряд: сегодня ещё не занимался — считаем до вчера', () => {
    expect(dayStreak(['2026-10-24', '2026-10-25'], '2026-10-26')).toBe(2);
    expect(dayStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26')).toBe(3);
    expect(dayStreak(['2026-10-23', '2026-10-25'], '2026-10-26')).toBe(1);
    expect(dayStreak(['2026-10-20'], '2026-10-26')).toBe(0);
  });

  it('понедельник недели', () => {
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
  });

  it('недели с выполненным планом: текущая неполная не прерывает серию', () => {
    const dates = ['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26'];
    expect(weekStreak(dates, '2026-10-27', 3)).toBe(2);
    expect(weekStreak([...dates, '2026-10-27', '2026-10-28'], '2026-10-28', 3)).toBe(3);
    expect(weekStreak(['2026-10-12', '2026-10-14'], '2026-10-27', 3)).toBe(0);
  });
});

describe('минуты', () => {
  it('по неделям: последние 8, старые слева, чужие недели не попадают', () => {
    const weeks = minutesByWeek([w('2026-10-26', { actualSec: 600 }), w('2026-10-20', { actualSec: 1800 }), w('2026-10-21', { actualSec: 900 }), w('2026-01-01')], '2026-10-27');
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ start: '2026-10-26', minutes: 10, count: 1 });
    expect(weeks[6]).toEqual({ start: '2026-10-19', minutes: 45, count: 2 });
    expect(weeks[0].start).toBe('2026-09-07');
  });

  it('по дням месяца', () => {
    const m = minutesByDay([w('2026-10-26', { actualSec: 600 }), w('2026-10-26', { actualSec: 1200 }), w('2026-11-01')], '2026-10');
    expect(m.get('2026-10-26')).toBe(30);
    expect(m.has('2026-11-01')).toBe(false);
  });

  it('сетка месяца с понедельника', () => {
    const g = monthGrid('2026-10');
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.at(-1)!.filter(Boolean).at(-1)).toBe('2026-10-31');
    expect(g.every((row) => row.length === 7)).toBe(true);
  });
});

describe('самочувствие', () => {
  it('средний сдвиг «после − до» только по парам', () => {
    const s = wellnessStats(
      [w('2026-10-20', { before: { energy: 2 }, after: { energy: 4 } }), w('2026-10-21', { before: { energy: 3 }, after: { energy: 4 } }), w('2026-10-22', { after: { energy: 5 } }), w('2026-10-23')],
      'energy',
    );
    expect(s.points).toHaveLength(3);
    expect(s.pairs).toBe(2);
    expect(s.shift).toBe(1.5);
  });
});

describe('освоение поз', () => {
  it('освоена: 5 раз и «получилось» в 4 из последних 5; обе стороны — одна поза', () => {
    const list = [
      w('2026-10-01', { poses: [p('tree', { side: 'right' }), p('tree', { side: 'left', ok: false })] }),
      w('2026-10-02', { poses: [p('tree', { side: 'right' }), p('tree', { side: 'left' })] }),
      w('2026-10-03', { poses: [p('tree')] }),
      w('2026-10-04', { poses: [p('tree', { actual: 45 })] }),
      w('2026-10-05', { poses: [p('tree')] }),
    ];
    const m = mastery(list).find((x) => x.poseId === 'tree')!;
    expect(m.times).toBe(5);
    expect(m.okRecent).toBe(0.8);
    expect(m.best).toBe(45);
    expect(m.status).toBe('mastered');
  });

  it('пропуски, компенсации и дыхание', () => {
    const list = [
      w('2026-10-01', { poses: [p('breath_full'), p('pyramid', { skipped: true, actual: 0 }), p('balasana', { counter: true }), p('shavasana')] }),
      w('2026-10-02', { poses: [p('pyramid', { ok: false })] }),
    ];
    const m = mastery(list);
    expect(m.map((x) => x.poseId)).toEqual(['pyramid']);
    expect(m[0]).toMatchObject({ times: 1, skips: 1, status: 'learning', okRecent: 0 });
  });
});

describe('тесты гибкости', () => {
  it('пора, если тестов нет или прошло 14 дней', () => {
    expect(testDue([], '2026-10-26')).toBe(true);
    const t = { id: 't', date: '2026-10-20', createdAt: 0, fold: -5 };
    expect(testDue([t], '2026-10-26')).toBe(false);
    expect(testDue([t], '2026-11-03')).toBe(true);
  });

  it('ряд значений по датам, без пустых', () => {
    const tests = [
      { id: 'b', date: '2026-11-03', createdAt: 2, fold: -2 },
      { id: 'a', date: '2026-10-20', createdAt: 1, fold: -5, plank: 40 },
      { id: 'c', date: '2026-11-17', createdAt: 3, plank: 60 },
    ];
    expect(testSeries(tests, 'fold')).toEqual([
      { date: '2026-10-20', value: -5 },
      { date: '2026-11-03', value: -2 },
    ]);
    expect(testSeries(tests, 'plank').map((x) => x.value)).toEqual([40, 60]);
  });
});
