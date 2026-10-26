import { useMemo } from 'preact/hooks';
import { EXPERIENCE, PHASES, PROGRAM_WEEKS, WEEKDAYS, sessionSeconds, type Program, type SessionPlan } from '../data/program';
import { GOALS, LIMITS } from '../data/types';
import { db } from '../db/db';
import { currentWeek } from '../db/repo';
import { addDays, formatShortDate } from '../lib/dates';
import { formatMinutes } from '../lib/format';
import { useLive } from '../lib/hooks';
import { weekSessions } from '../lib/planner';
import { IconCheck, IconChevron } from './icons';

export function ProgramScreen({
  program,
  day,
  onQuestionnaire,
  onPreview,
}: {
  program: Program | null;
  day: string;
  onQuestionnaire: () => void;
  /** canStart — занятие текущей недели, его можно начать из просмотра */
  onPreview: (plan: SessionPlan, canStart: boolean) => void;
}) {
  const workouts = useLive(() => (program ? db.workouts.where('programId').equals(program.id).toArray() : []), [program?.id]);
  const weeks = useMemo(() => (program ? Array.from({ length: PROGRAM_WEEKS }, (_, i) => weekSessions(program, i + 1)) : []), [program]);

  if (!program) {
    return (
      <div class="screen-body">
        <div class="screen-head">
          <h1 class="screen-title">Программа</h1>
        </div>
        <div class="empty">
          <div class="empty-title">Программы пока нет</div>
          <div class="empty-text">Ответь на пять вопросов — и будет план на 6 недель.</div>
          <button class="btn" style={{ marginTop: 18 }} onClick={onQuestionnaire}>
            Пройти анкету
          </button>
        </div>
      </div>
    );
  }

  const now = currentWeek(program, day);
  const doneOf = (week: number, index: number) => workouts?.find((w) => w.week === week && w.index === index);
  const p = program.profile;

  return (
    <div class="screen-body">
      <div class="screen-head">
        <h1 class="screen-title">Программа</h1>
      </div>
      <p class="screen-sub">
        Программа {program.number} · с {formatShortDate(program.startDate)}
      </p>

      {weeks.map((sessions, i) => {
        const week = i + 1;
        const phase = PHASES.find((ph) => ph.weeks.includes(week))!;
        const start = addDays(program.startDate, i * 7);
        const isNow = week === now;
        return (
          <section class="section" key={week}>
            {phase.weeks[0] === week && (
              <div class="phase-head">
                <b>{phase.title}</b> — {phase.text}
              </div>
            )}
            <h3 class="section-head">
              <span>
                Неделя {week} · {formatShortDate(start)} – {formatShortDate(addDays(start, 6))}
              </span>
              {isNow && <span class="now-badge">сейчас</span>}
            </h3>
            <div class={`card ${isNow ? 'card-now' : ''}`}>
              {sessions.map((s) => {
                const done = doneOf(week, s.index!);
                return (
                  <button class="row" key={s.key} onClick={() => onPreview(s, isNow && !done)}>
                    <span class={`check ${done ? 'is-on' : ''}`}>{done && <IconCheck size={16} />}</span>
                    <span class="row-main">
                      <span class="row-title">{s.title}</span>
                      <span class="row-sub">{done ? `сделано ${formatShortDate(done.date)}` : formatMinutes(sessionSeconds(s.steps))}</span>
                    </span>
                    <IconChevron size={18} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <section class="section">
        <h3 class="section-head">Анкета</h3>
        <div class="card">
          <div class="row">
            <span class="row-main">
              <span class="row-sub">Опыт</span>
              <span class="row-title">{EXPERIENCE.find((e) => e.id === p.experience)?.label}</span>
            </span>
          </div>
          <div class="row">
            <span class="row-main">
              <span class="row-sub">Цели</span>
              <span class="row-title">{p.goals.map((g) => GOALS.find((x) => x.id === g)?.label).join(', ')}</span>
            </span>
          </div>
          <div class="row">
            <span class="row-main">
              <span class="row-sub">Расписание</span>
              <span class="row-title">
                {p.days.map((d) => WEEKDAYS[d]).join(', ')} · {p.minutes} мин · {p.time === 'morning' ? 'утром' : 'вечером'}
              </span>
            </span>
          </div>
          <div class="row">
            <span class="row-main">
              <span class="row-sub">Ограничения</span>
              <span class="row-title">{p.limits.length ? p.limits.map((l) => LIMITS.find((x) => x.id === l)?.label).join('; ') : 'нет'}</span>
            </span>
          </div>
          <button class="row" onClick={onQuestionnaire}>
            <span class="row-main">
              <span class="row-title accent">Пройти анкету заново</span>
              <span class="row-sub">Будет новая программа; история занятий сохранится</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
