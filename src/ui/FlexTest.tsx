import { useEffect, useRef, useState } from 'preact/hooks';
import { db, type FlexTest } from '../db/db';
import { newId } from '../db/repo';
import { formatShortDate, today } from '../lib/dates';
import { TESTS, type TestKey } from '../lib/stats';
import { tone, unlockAudio } from '../lib/voice';
import { Sheet } from './Sheet';
import { showToast } from './toast';

const SIDE_LABEL: Partial<Record<TestKey, string>> = { shouldersR: 'Правая сверху', shouldersL: 'Левая сверху', balanceR: 'На правой', balanceL: 'На левой' };

/** Сантиметры со знаком: на айфоне в цифровой клавиатуре нет минуса, поэтому знак — переключателем. */
function CmInput({ value, onChange, minusLabel, plusLabel }: { value?: number; onChange: (v?: number) => void; minusLabel: string; plusLabel: string }) {
  const [neg, setNeg] = useState(value === undefined ? true : value < 0);
  const abs = value === undefined ? '' : String(Math.abs(value));
  const emit = (n: boolean, text: string) => {
    const v = parseFloat(text.replace(',', '.'));
    onChange(Number.isFinite(v) ? Math.round((n ? -v : v) * 10) / 10 : undefined);
  };
  return (
    <div class="cm-input">
      <div class="segmented">
        <button
          class={neg ? 'is-on' : ''}
          onClick={() => {
            setNeg(true);
            emit(true, abs);
          }}
        >
          {minusLabel}
        </button>
        <button
          class={!neg ? 'is-on' : ''}
          onClick={() => {
            setNeg(false);
            emit(false, abs);
          }}
        >
          {plusLabel}
        </button>
      </div>
      <label class="cm-field">
        <span>{neg ? '−' : '+'}</span>
        <input type="text" inputMode="decimal" placeholder="0" value={abs} onInput={(e) => emit(neg, e.currentTarget.value)} />
        <span>см</span>
      </label>
    </div>
  );
}

/** Секундомер с автостопом на максимуме; результат можно поправить руками. */
function Stopwatch({ value, onChange, max }: { value?: number; onChange: (v?: number) => void; max: number }) {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [, force] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => () => clearInterval(timer.current), []);
  const elapsed = startAt === null ? (value ?? 0) : Math.min(max, (Date.now() - startAt) / 1000);

  const stop = (v: number) => {
    clearInterval(timer.current);
    setStartAt(null);
    onChange(Math.round(v));
    tone('end');
  };

  useEffect(() => {
    if (startAt !== null && elapsed >= max) stop(max);
  });

  return (
    <div class="stopwatch">
      <span class="stopwatch-time num">{Math.floor(elapsed)} с</span>
      {startAt === null ? (
        <button
          class="btn btn-small"
          onClick={() => {
            unlockAudio();
            tone('hold');
            setStartAt(Date.now());
            timer.current = setInterval(() => force((x) => x + 1), 200);
          }}
        >
          {value === undefined ? 'Старт' : 'Заново'}
        </button>
      ) : (
        <button class="btn btn-small btn-danger" onClick={() => stop(elapsed)}>
          Стоп
        </button>
      )}
      <input
        class="stopwatch-edit"
        type="text"
        inputMode="numeric"
        aria-label="Секунды вручную"
        value={value ?? ''}
        placeholder="—"
        onInput={(e) => {
          const v = parseInt(e.currentTarget.value, 10);
          onChange(Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : undefined);
        }}
      />
    </div>
  );
}

export function FlexTestSheet({ last, onClose }: { last?: FlexTest; onClose: () => void }) {
  const [vals, setVals] = useState<Partial<Record<TestKey, number>>>({});
  const set = (k: TestKey) => (v?: number) => setVals((x) => ({ ...x, [k]: v }));
  const filled = Object.values(vals).some((v) => v !== undefined);

  const save = async () => {
    const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== undefined));
    await db.tests.add({ id: newId(), date: today(), createdAt: Date.now(), ...clean });
    showToast('Тест записан');
    onClose();
  };

  return (
    <Sheet full onClose={onClose} title="Тест гибкости">
      <p class="screen-sub" style={{ margin: '0 2px 4px' }}>
        Четыре замера, около 5 минут. Делай после лёгкой разминки, без рывков. Что не получилось измерить — пропусти.
      </p>
      {TESTS.map((t) => (
        <section class="section" key={t.id}>
          <h3 class="section-head">{t.title}</h3>
          <div class="card card-pad test-card">
            <p class="test-how">{t.how}</p>
            {t.keys.map((k) => (
              <div class="test-row" key={k}>
                {SIDE_LABEL[k] && <div class="test-side">{SIDE_LABEL[k]}</div>}
                {t.unit === 'см' ? (
                  <CmInput
                    value={vals[k]}
                    onChange={set(k)}
                    minusLabel={t.id === 'fold' ? 'Не достаю' : 'Не сомкнулись'}
                    plusLabel={t.id === 'fold' ? 'Ниже опоры' : 'Заходят'}
                  />
                ) : (
                  <Stopwatch value={vals[k]} onChange={set(k)} max={t.max ?? 120} />
                )}
                {last?.[k] !== undefined && (
                  <div class="test-last">
                    В прошлый раз ({formatShortDate(last.date)}): {last[k]! > 0 && t.unit === 'см' ? '+' : ''}
                    {String(last[k]).replace('.', ',').replace('-', '−')} {t.unit}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div class="sticky-foot">
        <button class="btn btn-block" disabled={!filled} onClick={() => void save()}>
          Записать результаты
        </button>
      </div>
    </Sheet>
  );
}
