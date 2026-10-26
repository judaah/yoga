import { useState } from 'preact/hooks';
import { POSE_BY_ID } from '../data/poses';
import type { Rating } from '../data/program';
import { db, type Wellness, type Workout } from '../db/db';
import { newId } from '../db/repo';
import { formatDay, today } from '../lib/dates';
import { formatSeconds } from '../lib/format';
import { useLive } from '../lib/hooks';
import { IconCheck, IconChevron, IconPlus } from './icons';
import { Sheet } from './Sheet';
import { sideLabel } from './SessionPreview';
import { showToast } from './toast';
import { isEmptyWellness, RATINGS, RatingPicker, WELLNESS, WellnessForm } from './Wellness';

const KIND_EMOJI: Record<Workout['kind'], string> = { program: '🧘', quick: '✨', manual: '📝' };
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const workoutMinutes = (w: Workout) => Math.max(1, Math.round(w.actualSec / 60));

/** Журнал по дням, новые сверху. limit — сколько показать (для блока на экране прогресса). */
export function Journal({ day, limit }: { day: string; limit?: number }) {
  const workouts = useLive(() => db.workouts.orderBy('startedAt').reverse().limit(limit ?? 10_000).toArray(), [limit]);
  const [open, setOpen] = useState<Workout | null>(null);
  const [manual, setManual] = useState(false);

  const groups: Array<{ date: string; items: Workout[] }> = [];
  for (const w of workouts ?? []) {
    const g = groups[groups.length - 1];
    if (g && g.date === w.date) g.items.push(w);
    else groups.push({ date: w.date, items: [w] });
  }

  return (
    <>
      <button class="btn btn-soft btn-block" onClick={() => setManual(true)}>
        <IconPlus size={20} /> Записать занятие вручную
      </button>
      {workouts && workouts.length === 0 && (
        <div class="empty">
          <div class="empty-title">Пока пусто</div>
          <div class="empty-text">Здесь появятся занятия: из программы, короткие практики и записанные вручную.</div>
        </div>
      )}
      {groups.map((g) => (
        <section class="section" key={g.date}>
          <h3 class="section-head">{formatDay(g.date, day)}</h3>
          <div class="card">
            {g.items.map((w) => (
              <button class="row" key={w.id} onClick={() => setOpen(w)}>
                <span class="row-emoji" aria-hidden="true">
                  {KIND_EMOJI[w.kind]}
                </span>
                <span class="row-main">
                  <span class="row-title">{w.title}</span>
                  <span class="row-sub">
                    {workoutMinutes(w)} мин
                    {w.rating ? ` · ${RATINGS.find((r) => r.id === w.rating)?.label.toLowerCase()}` : ''}
                    {w.week ? ` · неделя ${w.week}` : ''}
                  </span>
                </span>
                <span class="row-value">{timeFmt.format(w.startedAt)}</span>
                <IconChevron size={18} />
              </button>
            ))}
          </div>
        </section>
      ))}
      {open && <WorkoutSheet workout={open} onClose={() => setOpen(null)} />}
      {manual && <ManualWorkout onClose={() => setManual(false)} />}
    </>
  );
}

function WellnessDelta({ before, after }: { before?: Wellness; after?: Wellness }) {
  if (isEmptyWellness(before) && isEmptyWellness(after)) return null;
  return (
    <div class="card">
      {WELLNESS.map((w) => {
        const b = before?.[w.id];
        const a = after?.[w.id];
        if (b === undefined && a === undefined) return null;
        return (
          <div class="row" key={w.id}>
            <span class="row-main">
              <span class="row-title">{w.label}</span>
            </span>
            <span class="row-value">
              {b ?? '—'} → {a ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Карточка тренировки: позы, самочувствие; оценку, самочувствие и заметку можно поправить. */
function WorkoutSheet({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [rating, setRating] = useState<Rating | undefined>(workout.rating);
  const [note, setNote] = useState(workout.note);
  const [edit, setEdit] = useState(false);
  const [before, setBefore] = useState<Wellness>(workout.before ?? {});
  const [after, setAfter] = useState<Wellness>(workout.after ?? {});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    await db.workouts.update(workout.id, {
      rating,
      note: note.trim(),
      before: isEmptyWellness(before) ? undefined : before,
      after: isEmptyWellness(after) ? undefined : after,
    });
    showToast('Сохранено');
    onClose();
  };

  const remove = async () => {
    await db.workouts.delete(workout.id);
    showToast('Занятие удалено');
    onClose();
  };

  const poses = workout.poses.filter((p) => !p.counter);
  return (
    <Sheet full onClose={onClose} title={workout.title}>
      <p class="screen-sub" style={{ margin: '0 2px 4px' }}>
        {formatDay(workout.date, today())} · {timeFmt.format(workout.startedAt)} · {workoutMinutes(workout)} мин
        {workout.place ? ` · ${workout.place}` : ''}
      </p>

      <section class="section">
        <h3 class="section-head">Оценка</h3>
        <RatingPicker value={rating} onChange={setRating} />
      </section>

      <section class="section">
        <h3 class="section-head">
          <span>Самочувствие до → после</span>
          <button class="link" onClick={() => setEdit(!edit)}>
            {edit ? 'Готово' : 'Изменить'}
          </button>
        </h3>
        {edit ? (
          <>
            <p class="wizard-sub">До занятия</p>
            <WellnessForm value={before} onChange={setBefore} />
            <p class="wizard-sub">После</p>
            <WellnessForm value={after} onChange={setAfter} />
          </>
        ) : isEmptyWellness(before) && isEmptyWellness(after) ? (
          <p class="wizard-sub">Не отмечено.</p>
        ) : (
          <WellnessDelta before={before} after={after} />
        )}
      </section>

      {poses.length > 0 && (
        <section class="section">
          <h3 class="section-head">Позы</h3>
          <div class="card">
            {poses.map((p, i) => (
              <div class="row" key={i}>
                <span class={`check ${p.skipped ? '' : p.ok === false ? 'is-warn' : 'is-on'}`}>{!p.skipped && <IconCheck size={14} />}</span>
                <span class="row-main">
                  <span class="row-title">{POSE_BY_ID.get(p.poseId)?.name ?? p.poseId}</span>
                  <span class="row-sub">
                    {[sideLabel(p.side), p.skipped ? 'пропущена' : p.ok === false ? 'не получилось' : '', p.replacedFrom ? 'заменена на более лёгкую' : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span class="row-value">{p.skipped ? '—' : formatSeconds(p.actual)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section class="section">
        <h3 class="section-head">Заметка</h3>
        <textarea class="textarea" rows={3} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      </section>

      <div class="sticky-foot">
        <button class="btn btn-block" onClick={() => void save()}>
          Сохранить
        </button>
        {confirmDelete ? (
          <button class="btn btn-block btn-danger" style={{ marginTop: 10 }} onClick={() => void remove()}>
            Точно удалить занятие
          </button>
        ) : (
          <button class="btn btn-block btn-plain" style={{ marginTop: 10 }} onClick={() => setConfirmDelete(true)}>
            Удалить
          </button>
        )}
      </div>
    </Sheet>
  );
}

const PLACES = ['Студия', 'Дома по видео', 'Своя практика', 'Другое'];
const DURATIONS = [15, 30, 45, 60, 75, 90];

/** Занятие вне приложения: студия, видео. Попадает в журнал, календарь и минуты. */
export function ManualWorkout({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState(PLACES[0]);
  const [rating, setRating] = useState<Rating>();
  const [before, setBefore] = useState<Wellness>({});
  const [after, setAfter] = useState<Wellness>({});
  const [withWellness, setWithWellness] = useState(false);
  const [note, setNote] = useState('');

  const save = async () => {
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, new Date().getHours(), new Date().getMinutes()).getTime();
    await db.workouts.add({
      id: newId(),
      date,
      startedAt: start,
      endedAt: start + minutes * 60_000,
      kind: 'manual',
      title: place === 'Другое' ? 'Занятие' : place,
      place,
      plannedSec: minutes * 60,
      actualSec: minutes * 60,
      poses: [],
      rating,
      ...(isEmptyWellness(before) ? {} : { before }),
      ...(isEmptyWellness(after) ? {} : { after }),
      note: note.trim(),
    });
    showToast('Занятие записано');
    onClose();
  };

  return (
    <Sheet full onClose={onClose} title="Записать занятие">
      <label class="field" style={{ marginTop: 0 }}>
        <span>Дата</span>
        <input type="date" value={date} max={today()} onInput={(e) => setDate(e.currentTarget.value || date)} />
      </label>

      <h2 class="wizard-title">Где занимался?</h2>
      <div class="tags">
        {PLACES.map((p) => (
          <button key={p} class={`chip ${place === p ? 'is-on' : ''}`} onClick={() => setPlace(p)}>
            {p}
          </button>
        ))}
      </div>

      <h2 class="wizard-title">Сколько минут?</h2>
      <div class="tags">
        {DURATIONS.map((m) => (
          <button key={m} class={`chip ${minutes === m ? 'is-on' : ''}`} onClick={() => setMinutes(m)}>
            {m}
          </button>
        ))}
        <input
          class="chip-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={300}
          aria-label="Своё число минут"
          value={DURATIONS.includes(minutes) ? '' : minutes}
          placeholder="своё"
          onInput={(e) => {
            const v = Number(e.currentTarget.value);
            if (v > 0 && v <= 300) setMinutes(Math.round(v));
          }}
        />
      </div>

      <h2 class="wizard-title">Как было?</h2>
      <RatingPicker value={rating} onChange={setRating} />

      {withWellness ? (
        <>
          <h2 class="wizard-title">Самочувствие до</h2>
          <WellnessForm value={before} onChange={setBefore} />
          <h2 class="wizard-title">После</h2>
          <WellnessForm value={after} onChange={setAfter} />
        </>
      ) : (
        <button class="link" style={{ margin: '18px 2px 0' }} onClick={() => setWithWellness(true)}>
          + Самочувствие до и после
        </button>
      )}

      <h2 class="wizard-title">Заметка</h2>
      <textarea class="textarea" rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} />

      <div class="sticky-foot">
        <button class="btn btn-block" onClick={() => void save()}>
          Записать
        </button>
      </div>
    </Sheet>
  );
}
