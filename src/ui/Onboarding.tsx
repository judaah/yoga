import { useEffect, useState } from 'preact/hooks';
import { EXPERIENCE, MINUTES, WEEKDAYS, type DayTime, type Experience, type Minutes, type Profile } from '../data/program';
import { GOALS, LIMITS, type Goal, type Limit } from '../data/types';
import { createProgram } from '../db/repo';
import { plural } from '../lib/format';
import { IconBack, IconCheck } from './icons';
import { Sheet } from './Sheet';
import { showToast } from './toast';

const MAX_GOALS = 3;
const STEPS = ['Опыт', 'Цели', 'Расписание', 'Здоровье', 'Итог'];

/** Анкета → новая программа. initial — прошлые ответы, чтобы пройти заново быстро. */
export function Onboarding({ initial, onClose, onDone }: { initial?: Profile | null; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(initial?.experience ?? null);
  const [goals, setGoals] = useState<Goal[]>(initial?.goals ?? []);
  const [minutes, setMinutes] = useState<Minutes>(initial?.minutes ?? 20);
  const [days, setDays] = useState<number[]>(initial?.days ?? [0, 2, 4]);
  const [time, setTime] = useState<DayTime>(initial?.time ?? 'evening');
  const [remindAt, setRemindAt] = useState(initial?.remindAt ?? '19:30');
  const [limits, setLimits] = useState<Limit[]>(initial?.limits ?? []);
  const [pregnant, setPregnant] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(list: T[], x: T, max = Infinity) => (list.includes(x) ? list.filter((y) => y !== x) : list.length < max ? [...list, x] : list);

  useEffect(() => {
    document.querySelector('.sheet-body')?.scrollTo(0, 0);
  }, [step]);

  const canNext = [experience !== null, goals.length > 0, days.length >= 2, !pregnant, true][step];

  const finish = async () => {
    if (!experience) return;
    setSaving(true);
    try {
      await createProgram({ experience, goals, minutes, days: [...days].sort(), time, limits, remindAt });
      showToast('Программа готова');
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const back =
    step > 0 ? (
      <button class="icon-btn" onClick={() => setStep(step - 1)} aria-label="Назад">
        <IconBack />
      </button>
    ) : null;

  return (
    <Sheet full onClose={onClose} title={<span class="wizard-head">{back}{`${step + 1} из ${STEPS.length} · ${STEPS[step]}`}</span>}>
      <div class="wizard-progress">
        {STEPS.map((s, i) => (
          <span key={s} class={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h2 class="wizard-title">Занимался йогой раньше?</h2>
          <div class="options">
            {EXPERIENCE.map((e) => (
              <button key={e.id} class={`option ${experience === e.id ? 'is-on' : ''}`} onClick={() => setExperience(e.id)}>
                <span class="option-main">
                  <span class="option-title">{e.label}</span>
                  <span class="option-hint">{e.hint}</span>
                </span>
                {experience === e.id && <IconCheck />}
              </button>
            ))}
          </div>
          <p class="wizard-note">
            Приложение не заменяет врача и инструктора. Если есть заболевания — посоветуйся с врачом. В позе больно — сразу выходи из неё.
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <h2 class="wizard-title">Чего хочешь от занятий?</h2>
          <p class="wizard-sub">До трёх целей. Первая — главная.</p>
          <div class="options">
            {GOALS.map((g) => {
              const n = goals.indexOf(g.id);
              return (
                <button key={g.id} class={`option ${n >= 0 ? 'is-on' : ''}`} onClick={() => setGoals(toggle(goals, g.id, MAX_GOALS))}>
                  <span class="option-emoji" aria-hidden="true">
                    {g.emoji}
                  </span>
                  <span class="option-main">
                    <span class="option-title">{g.label}</span>
                    <span class="option-hint">{g.hint}</span>
                  </span>
                  {n >= 0 && <span class="option-num">{n + 1}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 class="wizard-title">Сколько времени на занятие?</h2>
          <div class="segmented segmented-big">
            {MINUTES.map((m) => (
              <button key={m} class={minutes === m ? 'is-on' : ''} onClick={() => setMinutes(m)}>
                {m} мин
              </button>
            ))}
          </div>

          <h2 class="wizard-title">В какие дни?</h2>
          <div class="weekdays">
            {WEEKDAYS.map((d, i) => (
              <button key={d} class={`weekday ${days.includes(i) ? 'is-on' : ''}`} onClick={() => setDays(toggle(days, i))} aria-pressed={days.includes(i)}>
                {d}
              </button>
            ))}
          </div>
          <p class="wizard-sub">
            {days.length < 2 ? 'Выбери хотя бы два дня.' : `${days.length} ${plural(days.length, 'занятие', 'занятия', 'занятий')} в неделю.`}
          </p>

          <h2 class="wizard-title">Когда удобнее?</h2>
          <div class="segmented segmented-big">
            <button
              class={time === 'morning' ? 'is-on' : ''}
              onClick={() => {
                setTime('morning');
                if (remindAt === '19:30') setRemindAt('07:30');
              }}
            >
              ☀️ Утром
            </button>
            <button
              class={time === 'evening' ? 'is-on' : ''}
              onClick={() => {
                setTime('evening');
                if (remindAt === '07:30') setRemindAt('19:30');
              }}
            >
              🌙 Вечером
            </button>
          </div>
          <label class="field">
            <span>Время занятия — для напоминаний в Календаре</span>
            <input type="time" value={remindAt} onInput={(e) => setRemindAt(e.currentTarget.value || remindAt)} />
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <h2 class="wizard-title">Есть ограничения по здоровью?</h2>
          <p class="wizard-sub">Отметь, что есть, — такие позы не попадут в программу.</p>
          <div class="options">
            {LIMITS.map((l) => (
              <button key={l.id} class={`option ${limits.includes(l.id) ? 'is-on' : ''}`} onClick={() => setLimits(toggle(limits, l.id))}>
                <span class={`checkbox ${limits.includes(l.id) ? 'is-on' : ''}`}>{limits.includes(l.id) && <IconCheck size={16} />}</span>
                <span class="option-main">
                  <span class="option-title">{l.label}</span>
                  <span class="option-hint">{l.hint}</span>
                </span>
              </button>
            ))}
            <button class={`option ${pregnant ? 'is-on' : ''}`} onClick={() => setPregnant(!pregnant)}>
              <span class={`checkbox ${pregnant ? 'is-on' : ''}`}>{pregnant && <IconCheck size={16} />}</span>
              <span class="option-main">
                <span class="option-title">Беременность</span>
              </span>
            </button>
          </div>
          {pregnant && (
            <div class="note note-warn" style={{ marginTop: 14 }}>
              Пренатальную программу это приложение не подбирает: при беременности многие позы нужно менять, и делать это лучше с
              инструктором по пренатальной йоге и с согласия врача. Каталог поз остаётся доступен для просмотра.
            </div>
          )}
          {(limits.includes('injury') || limits.includes('pressure')) && (
            <div class="note note-warn" style={{ marginTop: 14 }}>
              Перед началом занятий согласуй их с врачом.
            </div>
          )}
        </>
      )}

      {step === 4 && experience && (
        <>
          <h2 class="wizard-title">Программа на 6 недель</h2>
          <div class="card">
            <div class="row">
              <span class="row-main">
                <span class="row-sub">Опыт</span>
                <span class="row-title">{EXPERIENCE.find((e) => e.id === experience)?.label}</span>
              </span>
            </div>
            <div class="row">
              <span class="row-main">
                <span class="row-sub">Цели</span>
                <span class="row-title">{goals.map((g) => GOALS.find((x) => x.id === g)?.label).join(', ')}</span>
              </span>
            </div>
            <div class="row">
              <span class="row-main">
                <span class="row-sub">Расписание</span>
                <span class="row-title">
                  {[...days]
                    .sort()
                    .map((d) => WEEKDAYS[d])
                    .join(', ')}{' '}
                  · {minutes} мин · {time === 'morning' ? 'утром' : 'вечером'} в {remindAt}
                </span>
              </span>
            </div>
            <div class="row">
              <span class="row-main">
                <span class="row-sub">Ограничения</span>
                <span class="row-title">{limits.length ? limits.map((l) => LIMITS.find((x) => x.id === l)?.label).join('; ') : 'нет'}</span>
              </span>
            </div>
          </div>
          <p class="wizard-sub" style={{ marginTop: 14 }}>
            Неделя 1–2 — знакомство, 3–4 — развитие, 5 — усложнение, 6 — закрепление и повторный тест гибкости. После каждого занятия
            отмечай, легко было или тяжело, — программа подстроится.
          </p>
        </>
      )}

      <div class="wizard-foot">
        {step < STEPS.length - 1 ? (
          <button class="btn btn-block" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Дальше
          </button>
        ) : (
          <button class="btn btn-block" disabled={saving} onClick={() => void finish()}>
            Создать программу
          </button>
        )}
      </div>
    </Sheet>
  );
}
