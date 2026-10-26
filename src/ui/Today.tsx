import { useMemo } from 'preact/hooks';
import { PROGRAM_WEEKS, QUICK, phaseOf, sessionSeconds, type Program, type SessionPlan } from '../data/program';
import { currentWeek, nextSession, type WeekState } from '../db/repo';
import { parseISODate } from '../lib/dates';
import { formatMinutes, plural } from '../lib/format';
import { quickSession, seedOf } from '../lib/planner';
import { IconPlay, IconSettings } from './icons';
import { poseCount, PoseStrip } from './SessionPreview';

const dateFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
/** Понедельник = 0 … воскресенье = 6. */
export const weekdayIndex = (iso: string) => (parseISODate(iso).getDay() + 6) % 7;

export function Today({
  day,
  program,
  week,
  onQuestionnaire,
  onPreview,
  onStart,
  onSettings,
  extra,
}: {
  day: string;
  program: Program | null;
  week: WeekState | null;
  onQuestionnaire: () => void;
  onPreview: (plan: SessionPlan) => void;
  onStart: (plan: SessionPlan) => void;
  onSettings: () => void;
  /** блоки прогресса и напоминаний — добавляются на следующих этапах */
  extra?: preact.ComponentChildren;
}) {
  const quick = useMemo(() => QUICK.map((q) => quickSession(q.id, program?.profile ?? null, seedOf(`${day}:${q.id}`))), [day, program]);
  const weekNo = program ? currentWeek(program, day) : 0;
  const next = week ? nextSession(week) : null;
  const plannedToday = program?.profile.days.includes(weekdayIndex(day)) ?? false;

  return (
    <div class="screen-body">
      <div class="screen-head">
        <h1 class="screen-title">Сегодня</h1>
        <button class="icon-btn" onClick={onSettings} aria-label="Настройки">
          <IconSettings />
        </button>
      </div>
      <p class="screen-sub">{dateFmt.format(parseISODate(day))}</p>

      {!program && (
        <div class="card card-pad hero-card">
          <h2 class="hero-title">Подберём программу</h2>
          <p class="hero-text">Пять коротких вопросов про опыт, цели, время и здоровье — и будет план занятий на 6 недель.</p>
          <button class="btn btn-block" onClick={onQuestionnaire}>
            Пройти анкету
          </button>
        </div>
      )}

      {program && weekNo >= 1 && weekNo <= PROGRAM_WEEKS && week && (
        <>
          <WeekProgress week={week} />
          {next ? (
            <div class="card card-pad session-card">
              <div class="session-card-head">
                <span class="session-card-kicker">{plannedToday ? 'Занятие на сегодня' : 'Сегодня по плану отдых — но можно позаниматься'}</span>
                <h2 class="session-card-title">{next.title}</h2>
                <span class="session-card-sub">
                  {formatMinutes(sessionSeconds(next.steps))} · {poseCount(next)} {plural(poseCount(next), 'поза', 'позы', 'поз')}
                </span>
              </div>
              <PoseStrip plan={next} />
              <div class="session-card-actions">
                <button class="btn" onClick={() => onStart(next)}>
                  <IconPlay size={18} /> Начать
                </button>
                <button class="btn btn-soft" onClick={() => onPreview(next)}>
                  Что в занятии
                </button>
              </div>
            </div>
          ) : (
            <div class="card card-pad hero-card">
              <h2 class="hero-title">План недели выполнен 🎉</h2>
              <p class="hero-text">Следующие занятия программы — с началом новой недели. Можно сделать короткую практику ниже.</p>
            </div>
          )}
        </>
      )}

      {program && weekNo > PROGRAM_WEEKS && (
        <div class="card card-pad hero-card">
          <h2 class="hero-title">Программа пройдена</h2>
          <p class="hero-text">Шесть недель позади. Сделай тест гибкости, чтобы сравнить с началом, и подбери следующую программу.</p>
          <button class="btn btn-block" onClick={onQuestionnaire}>
            Новая программа
          </button>
        </div>
      )}

      {extra}

      <section class="section">
        <h3 class="section-head">Короткие практики</h3>
        <div class="quick-grid">
          {quick.map((plan, i) => (
            <button key={plan.key} class="quick-card" onClick={() => onPreview(plan)}>
              <span class="quick-emoji" aria-hidden="true">
                {QUICK[i].emoji}
              </span>
              <span class="quick-title">{plan.title}</span>
              <span class="quick-sub">
                {formatMinutes(sessionSeconds(plan.steps))} · {QUICK[i].text.toLowerCase()}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function WeekProgress({ week }: { week: WeekState }) {
  const total = week.sessions.length;
  const done = week.sessions.filter((s) => week.done.has(s.index!)).length;
  return (
    <div class="week-progress">
      <div class="week-progress-head">
        <span>
          Неделя {week.week} из {PROGRAM_WEEKS} · {phaseOf(week.week).title}
        </span>
        <span class="num">
          {done} из {total}
        </span>
      </div>
      <div class="week-dots">
        {week.sessions.map((s) => (
          <span key={s.key} class={week.done.has(s.index!) ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
