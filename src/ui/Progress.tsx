import { useMemo, useState } from 'preact/hooks';
import { POSES, POSE_BY_ID } from '../data/poses';
import { WEEKDAYS, type Program } from '../data/program';
import { db } from '../db/db';
import { addDays, formatMonth, formatShortDate, monthOf, monthShort, parseISODate, shiftMonth } from '../lib/dates';
import { formatSeconds, plural } from '../lib/format';
import { useLive } from '../lib/hooks';
import { dayStreak, mastery, minutesByDay, minutesByWeek, monthGrid, testDue, testSeries, TESTS, weekStreak, wellnessStats, type MasteryStatus } from '../lib/stats';
import { ColumnChart, LineChart } from './charts';
import { PoseFigure } from './Figure';
import { FlexTestSheet } from './FlexTest';
import { IconBack, IconChevron, IconFlame } from './icons';
import { Journal } from './Journal';
import { PoseSheet } from './Poses';
import { Sheet } from './Sheet';
import { WELLNESS } from './Wellness';

const STATUS_LABEL: Record<MasteryStatus, string> = { new: 'новая', learning: 'осваиваю', mastered: 'освоена' };
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}.${iso.slice(5, 7)}`;
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${String(Math.abs(v)).replace('.', ',')}`;

export function Progress({ day, program }: { day: string; program: Program | null }) {
  const workouts = useLive(() => db.workouts.toArray(), []);
  const tests = useLive(() => db.tests.toArray(), []);
  const [month, setMonth] = useState(monthOf(day));
  const [picked, setPicked] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [allPoses, setAllPoses] = useState(false);
  const [poseOpen, setPoseOpen] = useState<string | null>(null);

  const dates = useMemo(() => (workouts ?? []).map((w) => w.date), [workouts]);
  const target = program?.profile.days.length ?? 2;
  const weeks = useMemo(() => minutesByWeek(workouts ?? [], day), [workouts, day]);
  const byDay = useMemo(() => minutesByDay(workouts ?? [], month), [workouts, month]);
  const poses = useMemo(() => mastery(workouts ?? []), [workouts]);
  if (!workouts || !tests) return null;

  const thisWeek = weeks[weeks.length - 1];
  const totalMin = workouts.reduce((s, w) => s + Math.round(w.actualSec / 60), 0);
  const lastTest = tests.length ? tests.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : undefined;
  const due = testDue(tests, day);
  const planned = new Set(program?.profile.days ?? []);
  const pickedWorkouts = picked ? workouts.filter((w) => w.date === picked) : [];

  const mastered = poses.filter((p) => p.status === 'mastered');
  const learning = poses.filter((p) => p.status === 'learning');
  const ranked = [...poses].filter((p) => p.times > 0).sort((a, b) => b.times - a.times || b.best - a.best);
  const skipped = [...poses].filter((p) => p.skips > 0).sort((a, b) => b.skips - a.skips).slice(0, 3);

  return (
    <div class="screen-body">
      <div class="screen-head">
        <h1 class="screen-title">Прогресс</h1>
      </div>

      <div class="tiles">
        <div class="tile">
          <span class="tile-label">
            <IconFlame size={16} /> Серия
          </span>
          <span class="tile-value">{dayStreak(dates, day)}</span>
          <span class="tile-sub">{plural(dayStreak(dates, day), 'день', 'дня', 'дней')} подряд</span>
        </div>
        <div class="tile">
          <span class="tile-label">План недель</span>
          <span class="tile-value">{weekStreak(dates, day, target)}</span>
          <span class="tile-sub">
            {plural(weekStreak(dates, day, target), 'неделя', 'недели', 'недель')} подряд по {target}+
          </span>
        </div>
        <div class="tile">
          <span class="tile-label">Эта неделя</span>
          <span class="tile-value">
            {thisWeek.count}
            <small> из {target}</small>
          </span>
          <span class="tile-sub">{thisWeek.minutes} мин</span>
        </div>
        <div class="tile">
          <span class="tile-label">Всего</span>
          <span class="tile-value">{workouts.length}</span>
          <span class="tile-sub">
            {plural(workouts.length, 'занятие', 'занятия', 'занятий')} · {String(Math.round(totalMin / 6) / 10).replace('.', ',')} ч
          </span>
        </div>
      </div>

      <section class="section">
        <div class="card card-pad">
          <div class="month-switch">
            <button class="icon-btn" aria-label="Предыдущий месяц" onClick={() => setMonth(shiftMonth(month, -1))}>
              <IconBack />
            </button>
            <span class="month-title">{formatMonth(month, monthOf(day))}</span>
            <button class="icon-btn" aria-label="Следующий месяц" disabled={month >= monthOf(day)} onClick={() => setMonth(shiftMonth(month, 1))}>
              <IconChevron />
            </button>
          </div>
          <div class="cal">
            {WEEKDAYS.map((d) => (
              <span key={d} class="cal-head">
                {d}
              </span>
            ))}
            {monthGrid(month)
              .flat()
              .map((d, i) =>
                d ? (
                  <button
                    key={d}
                    class={`cal-day ${byDay.has(d) ? 'is-done' : ''} ${d === day ? 'is-today' : ''} ${planned.has((parseISODate(d).getDay() + 6) % 7) && d >= (program?.startDate ?? '9') ? 'is-planned' : ''} ${picked === d ? 'is-picked' : ''}`}
                    onClick={() => setPicked(picked === d ? null : d)}
                    aria-label={`${formatShortDate(d)}${byDay.has(d) ? `, ${byDay.get(d)} мин` : ''}`}
                  >
                    {Number(d.slice(8))}
                  </button>
                ) : (
                  <span key={`e${i}`} />
                ),
              )}
          </div>
          <div class="cal-legend">
            <span>
              <i class="cal-key is-done" /> занятие
            </span>
            {program && (
              <span>
                <i class="cal-key is-planned" /> день по плану
              </span>
            )}
          </div>
          {picked && (
            <div class="cal-picked">
              {formatShortDate(picked)}:{' '}
              {pickedWorkouts.length ? pickedWorkouts.map((w) => `${w.title}, ${Math.max(1, Math.round(w.actualSec / 60))} мин`).join('; ') : 'занятий не было'}
            </div>
          )}
        </div>
      </section>

      <section class="section">
        <h3 class="section-head">Минуты по неделям</h3>
        <div class="card card-pad">
          <ColumnChart
            caption="Минуты занятий по неделям"
            unit="мин"
            data={weeks.map((w, i) => {
              const end = addDays(w.start, 6);
              const showMonth = i === 0 || monthOf(w.start) !== monthOf(weeks[i - 1].start);
              return {
                label: showMonth ? `${Number(w.start.slice(8))} ${monthShort(monthOf(w.start))}` : String(Number(w.start.slice(8))),
                value: w.minutes,
                title: `${formatShortDate(w.start)} – ${formatShortDate(end)}`,
                detail: `${w.count} ${plural(w.count, 'занятие', 'занятия', 'занятий')}`,
              };
            })}
          />
        </div>
      </section>

      <section class="section">
        <h3 class="section-head">Тесты гибкости</h3>
        <div class={`card card-pad test-cta ${due ? 'is-due' : ''}`}>
          <div class="row-main">
            <span class="row-title">{lastTest ? `Последний тест — ${formatShortDate(lastTest.date)}` : 'Ещё не было ни одного теста'}</span>
            <span class="row-sub">{due ? 'Пора замерить: раз в две недели видно, как растёт гибкость' : 'Следующий — через две недели после прошлого'}</span>
          </div>
          <button class={`btn btn-small ${due ? '' : 'btn-soft'}`} onClick={() => setTestOpen(true)}>
            Пройти тест
          </button>
        </div>
        {TESTS.map((t) => {
          const series = t.keys.map((k) => testSeries(tests, k));
          const datesUnion = [...new Set(series.flat().map((p) => p.date))].sort();
          if (!datesUnion.length) return null;
          const names = t.keys.length > 1 ? (t.id === 'shoulders' ? ['правая сверху', 'левая сверху'] : ['правая', 'левая']) : [t.title];
          if (datesUnion.length === 1) {
            return (
              <div class="card card-pad test-single" key={t.id}>
                <span class="row-title">{t.title}</span>
                <span class="row-sub">
                  {series
                    .map((s, i) => (s.length ? `${t.keys.length > 1 ? `${names[i]}: ` : ''}${t.unit === 'см' ? signed(s[0].value) : s[0].value} ${t.unit}` : ''))
                    .filter(Boolean)
                    .join(' · ')}{' '}
                  — график появится после второго теста
                </span>
              </div>
            );
          }
          return (
            <div class="card card-pad chart-card" key={t.id}>
              <div class="chart-title">
                {t.title}, {t.unit}
              </div>
              <LineChart
                caption={`${t.title}, ${t.unit}`}
                unit={t.unit}
                xLabels={datesUnion.map(shortDate)}
                xTitles={datesUnion.map(formatShortDate)}
                series={series.map((s, i) => ({
                  name: names[i],
                  color: `var(--series-${i + 1})`,
                  values: datesUnion.map((d) => s.filter((p) => p.date === d).at(-1)?.value ?? null),
                }))}
              />
            </div>
          );
        })}
      </section>

      <section class="section">
        <h3 class="section-head">Самочувствие</h3>
        {WELLNESS.every((w) => wellnessStats(workouts, w.id).points.length === 0) ? (
          <div class="card card-pad muted">Отмечай самочувствие до и после занятия — здесь появится, как йога на него влияет.</div>
        ) : (
          WELLNESS.map((w) => {
            const s = wellnessStats(workouts, w.id);
            if (!s.points.length) return null;
            const pts = s.points.slice(-12);
            const better = w.id === 'tension' ? (s.shift ?? 0) < 0 : (s.shift ?? 0) > 0;
            return (
              <div class="card card-pad chart-card" key={w.id}>
                <div class="chart-title">{w.label}</div>
                {s.shift !== null && (
                  <p class="chart-sub">
                    После занятия в среднем <b>{signed(s.shift)}</b> {better ? '— лучше' : s.shift === 0 ? '— без изменений' : ''} ({s.pairs}{' '}
                    {plural(s.pairs, 'занятие', 'занятия', 'занятий')})
                  </p>
                )}
                {pts.length >= 2 && (
                  <LineChart
                    caption={`${w.label}: до и после занятия`}
                    unit="из 5"
                    domain={[1, 5]}
                    height={120}
                    xLabels={pts.map((p) => shortDate(p.date))}
                    xTitles={pts.map((p) => formatShortDate(p.date))}
                    series={[
                      { name: 'до', color: 'var(--series-1)', values: pts.map((p) => p.before ?? null) },
                      { name: 'после', color: 'var(--series-2)', values: pts.map((p) => p.after ?? null) },
                    ]}
                  />
                )}
              </div>
            );
          })
        )}
      </section>

      <section class="section">
        <h3 class="section-head">Освоение поз</h3>
        <p class="wizard-sub" style={{ marginTop: -2 }}>
          Освоено {mastered.length}, в работе {learning.length} — из {POSES.filter((p) => p.kind !== 'breath').length - 1} поз в библиотеке
        </p>
        {ranked.length === 0 ? (
          <div class="card card-pad muted">После первых занятий здесь появятся позы: сколько раз делал, лучшее удержание и что уже освоено.</div>
        ) : (
          <div class="card">
            {(allPoses ? ranked : ranked.slice(0, 6)).map((m) => {
              const pose = POSE_BY_ID.get(m.poseId)!;
              return (
                <button class="row" key={m.poseId} onClick={() => setPoseOpen(m.poseId)}>
                  <span class="step-thumb">
                    <PoseFigure pose={pose} />
                  </span>
                  <span class="row-main">
                    <span class="row-title">{pose.name}</span>
                    <span class="row-sub">
                      {m.times} {plural(m.times, 'раз', 'раза', 'раз')} · лучшее {formatSeconds(m.best)} · получилось {Math.round(m.okRecent * Math.min(5, m.times))} из{' '}
                      {Math.min(5, m.times)}
                    </span>
                  </span>
                  <span class={`tag ${m.status === 'mastered' ? 'tag-accent' : ''}`}>{STATUS_LABEL[m.status]}</span>
                </button>
              );
            })}
            {ranked.length > 6 && (
              <button class="row" onClick={() => setAllPoses(!allPoses)}>
                <span class="row-title accent">{allPoses ? 'Свернуть' : `Все позы (${ranked.length})`}</span>
              </button>
            )}
          </div>
        )}
        {skipped.length > 0 && (
          <>
            <p class="wizard-sub" style={{ marginTop: 14 }}>
              Чаще всего пропускаешь — три пропуска подряд, и программа заменит позу на более лёгкую:
            </p>
            <div class="tags">
              {skipped.map((m) => (
                <span key={m.poseId} class="tag">
                  {POSE_BY_ID.get(m.poseId)!.name} · {m.skips}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section class="section">
        <h3 class="section-head">
          <span>Журнал</span>
          {workouts.length > 5 && (
            <button class="link" onClick={() => setJournalOpen(true)}>
              Весь журнал
            </button>
          )}
        </h3>
        <Journal day={day} limit={5} />
      </section>

      {testOpen && <FlexTestSheet last={lastTest} onClose={() => setTestOpen(false)} />}
      {journalOpen && (
        <Sheet full title="Журнал" onClose={() => setJournalOpen(false)}>
          <Journal day={day} />
        </Sheet>
      )}
      {poseOpen && <PoseSheet pose={POSE_BY_ID.get(poseOpen)!} onClose={() => setPoseOpen(null)} />}
    </div>
  );
}

/** Подсказки для «Сегодня»: пора тест, серия. */
export function TodayProgress({ day, program, onTest }: { day: string; program: Program | null; onTest: () => void }) {
  const workouts = useLive(() => db.workouts.toArray(), []);
  const tests = useLive(() => db.tests.toArray(), []);
  if (!workouts || !tests || !program) return null;
  const dates = workouts.map((w) => w.date);
  const streak = dayStreak(dates, day);
  const weeksOk = weekStreak(dates, day, program.profile.days.length);
  const due = testDue(tests, day) && workouts.length > 0;
  return (
    <>
      {(streak > 1 || weeksOk > 0) && (
        <div class="streak-line">
          <IconFlame size={18} />
          {streak > 1 && (
            <span>
              {streak} {plural(streak, 'день', 'дня', 'дней')} подряд
            </span>
          )}
          {weeksOk > 0 && (
            <span>
              план выполнен {weeksOk} {plural(weeksOk, 'неделю', 'недели', 'недель')} подряд
            </span>
          )}
        </div>
      )}
      {due && (
        <button class="card card-pad test-cta is-due" onClick={onTest}>
          <span class="row-main">
            <span class="row-title">Пора тест гибкости</span>
            <span class="row-sub">Пять минут: наклон, плечи, баланс, планка</span>
          </span>
          <IconChevron />
        </button>
      )}
    </>
  );
}
