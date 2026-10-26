import type { Wellness } from '../db/db';
import type { Rating } from '../data/program';

export const WELLNESS: Array<{ id: keyof Wellness; label: string; low: string; high: string }> = [
  { id: 'energy', label: 'Энергия', low: 'нет сил', high: 'бодрость' },
  { id: 'mood', label: 'Настроение', low: 'плохое', high: 'отличное' },
  { id: 'tension', label: 'Напряжение, боль в спине', low: 'нет', high: 'сильно' },
];

/** Три шкалы 1–5. Повторное нажатие на ту же цифру снимает отметку. */
export function WellnessForm({ value, onChange }: { value: Wellness; onChange: (w: Wellness) => void }) {
  return (
    <div class="wellness">
      {WELLNESS.map((w) => (
        <div class="wellness-row" key={w.id}>
          <div class="wellness-label">{w.label}</div>
          <div class="scale" role="group" aria-label={w.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                class={`scale-btn ${value[w.id] === n ? 'is-on' : ''}`}
                aria-pressed={value[w.id] === n}
                onClick={() => onChange({ ...value, [w.id]: value[w.id] === n ? undefined : n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div class="scale-ends">
            <span>{w.low}</span>
            <span>{w.high}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const RATINGS: Array<{ id: Rating; label: string; emoji: string }> = [
  { id: 'easy', label: 'Легко', emoji: '🙂' },
  { id: 'ok', label: 'Нормально', emoji: '💪' },
  { id: 'hard', label: 'Тяжело', emoji: '😮‍💨' },
];

export function RatingPicker({ value, onChange }: { value?: Rating; onChange: (r: Rating) => void }) {
  return (
    <div class="rating">
      {RATINGS.map((r) => (
        <button key={r.id} class={`rating-btn ${value === r.id ? 'is-on' : ''}`} aria-pressed={value === r.id} onClick={() => onChange(r.id)}>
          <span class="rating-emoji" aria-hidden="true">
            {r.emoji}
          </span>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export const isEmptyWellness = (w?: Wellness) => !w || (w.energy === undefined && w.mood === undefined && w.tension === undefined);
