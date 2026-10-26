import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { POSE_BY_ID } from '../data/poses';
import { sessionSeconds, type Rating, type SessionPlan } from '../data/program';
import type { BreathPattern } from '../data/types';
import { db, type Wellness } from '../db/db';
import { newId, setSetting } from '../db/repo';
import { adapt } from '../lib/adapt';
import { today } from '../lib/dates';
import { clock as fmtClock, formatMinutes, plural } from '../lib/format';
import {
  addTime,
  finishEarly,
  next as nextStep,
  pause,
  phaseElapsed,
  phaseLength,
  poseIdAt,
  prev as prevStep,
  progress,
  replaceWithEasier,
  resume,
  startRun,
  tick,
  toWorkout,
  type RunEvent,
  type RunState,
} from '../lib/session';
import { keepAwake, releaseAwake, say, stopSpeech, tone, unlockAudio } from '../lib/voice';
import { PoseFigure, useBreathPhase } from './Figure';
import { IconClose, IconMute, IconNext, IconPause, IconPlay, IconPrev, IconVolume } from './icons';
import { BLOCK_LABEL, sideLabel } from './SessionPreview';
import { Sheet } from './Sheet';
import { showToast } from './toast';
import { isEmptyWellness, RatingPicker, WellnessForm } from './Wellness';

/** Незаконченное занятие: переживает закрытие приложения. */
export const SETTING_RUN = 'run';
export interface SavedRun {
  plan: SessionPlan;
  state: RunState;
  before?: Wellness;
  savedAt: number;
}

// ?speed=20 в адресе ускоряет время — чтобы проверить занятие целиком за минуту.
const SPEED = (() => {
  try {
    return Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);
  } catch {
    return 1;
  }
})();
const T0 = Date.now();
export const clock = () => (SPEED === 1 ? Date.now() : T0 + (Date.now() - T0) * SPEED);

export function Practice({
  plan,
  saved,
  voiceOn,
  soundOn,
  onToggleVoice,
  onClose,
}: {
  plan: SessionPlan;
  saved?: SavedRun | null;
  voiceOn: boolean;
  soundOn: boolean;
  onToggleVoice: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'before' | 'run' | 'finish'>(saved ? 'run' : 'before');
  const [before, setBefore] = useState<Wellness>(saved?.before ?? {});
  const [run, setRun] = useState<{ state: RunState; fresh: boolean } | null>(saved ? { state: saved.state, fresh: false } : null);

  const discard = async () => {
    stopSpeech();
    await db.settings.delete(SETTING_RUN);
    onClose();
  };

  if (stage === 'before') {
    return (
      <Sheet full onClose={onClose} title={plan.title}>
        <p class="screen-sub" style={{ margin: '0 2px 18px' }}>
          {formatMinutes(sessionSeconds(plan.steps))} · {plan.subtitle}
        </p>
        <h2 class="wizard-title">Как ты сейчас?</h2>
        <p class="wizard-sub">Можно не отмечать. После занятия сравним.</p>
        <WellnessForm value={before} onChange={setBefore} />
        <p class="wizard-note">Положи телефон так, чтобы видеть экран с коврика, и сделай звук погромче — позы будут называться голосом.</p>
        <div class="sticky-foot">
          <button
            class="btn btn-block"
            onClick={() => {
              unlockAudio();
              setRun({ state: startRun(clock()), fresh: true });
              setStage('run');
            }}
          >
            <IconPlay size={20} /> Начать
          </button>
        </div>
      </Sheet>
    );
  }

  if (stage === 'run' && run) {
    return (
      <Player
        plan={plan}
        initial={run.state}
        fresh={run.fresh}
        before={before}
        voiceOn={voiceOn}
        soundOn={soundOn}
        onToggleVoice={onToggleVoice}
        onDone={(state) => {
          setRun({ state, fresh: false });
          setStage('finish');
        }}
        onDiscard={() => void discard()}
      />
    );
  }

  if (stage === 'finish' && run) return <Finish plan={plan} state={run.state} before={before} onClose={onClose} onDiscard={() => void discard()} />;
  return null;
}

function phraseFor(plan: SessionPlan, state: RunState, e: Extract<RunEvent, { type: 'prep' }>): string {
  if (e.sideSwitch) return 'Смена стороны.';
  const step = plan.steps[e.index];
  const pose = POSE_BY_ID.get(poseIdAt(state, plan, e.index))!;
  const side = step.side === 'right' ? ', правая сторона' : step.side === 'left' ? ', левая сторона' : '';
  const intro = e.index === 0 ? 'Начинаем. ' : step.counter ? 'Компенсация: ' : '';
  return `${intro}${pose.name}${side}. ${pose.cues[0]}.`;
}

const SMALL = 0.55;

/** Где мы в круге дыхания: подпись, размер круга (0.55…1) и номер круга. */
function breathAt(t: number, b: BreathPattern) {
  // [подпись, секунды, вид, размер круга в начале, в конце]
  const parts: Array<[string, number, 'in' | 'hold' | 'out', number, number]> = [['Вдох', b.inhale, 'in', SMALL, 1]];
  if (b.hold) parts.push(['Задержка', b.hold, 'hold', 1, 1]);
  parts.push(['Выдох', b.exhale, 'out', 1, SMALL]);
  if (b.holdOut) parts.push(['Задержка', b.holdOut, 'hold', SMALL, SMALL]);
  const cycle = parts.reduce((s, p) => s + p[1], 0);
  const cycleNo = Math.floor(t / cycle);
  let x = t - cycleNo * cycle;
  for (let i = 0; i < parts.length; i++) {
    const [label, len, kind, from, to] = parts[i];
    if (x < len || i === parts.length - 1) {
      const k = Math.min(1, x / len);
      return { label, kind, scale: from + (to - from) * k, cycleNo, key: `${cycleNo}:${i}` };
    }
    x -= len;
  }
  return null;
}

function Player({
  plan,
  initial,
  fresh,
  before,
  voiceOn,
  soundOn,
  onToggleVoice,
  onDone,
  onDiscard,
}: {
  plan: SessionPlan;
  initial: RunState;
  fresh: boolean;
  before: Wellness;
  voiceOn: boolean;
  soundOn: boolean;
  onToggleVoice: () => void;
  onDone: (state: RunState) => void;
  onDiscard: () => void;
}) {
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(clock);
  const [sheet, setSheet] = useState<'easy' | 'exit' | null>(null);
  const [awake, setAwake] = useState<boolean | null>(null);
  const ref = useRef(state);
  const opts = useRef({ voiceOn, soundOn });
  opts.current = { voiceOn, soundOn };

  const announce = (e: RunEvent, st: RunState) => {
    const { voiceOn: v, soundOn: s } = opts.current;
    if (e.type === 'prep') {
      if (s && e.index > 0) tone('next');
      if (v) say(phraseFor(plan, st, e), { interrupt: true });
    } else if (e.type === 'hold') {
      if (s) tone('hold');
    } else if (e.type === 'half') {
      const cue = POSE_BY_ID.get(poseIdAt(st, plan, e.index))?.cues[1];
      if (v && cue) say(cue);
    } else if (e.type === 'last3') {
      if (s) tone('tick');
    } else if (e.type === 'done') {
      if (s) tone('end');
      if (v) say('Занятие окончено. Пошевели пальцами, повернись на бок и не торопясь сядь.', { interrupt: true });
    }
  };

  const apply = (r: { state: RunState; events: RunEvent[] }) => {
    ref.current = r.state;
    setState(r.state);
    r.events.forEach((e) => announce(e, r.state));
    if (r.state.done) onDone(r.state);
  };

  // Первая поза называется сразу после «Начать».
  useEffect(() => {
    if (fresh) announce({ type: 'prep', index: 0, sideSwitch: false }, initial);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const n = clock();
      setNow(n);
      const r = tick(ref.current, plan, n);
      if (r.state !== ref.current) apply(r);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Свернул приложение или звонок — пауза; вернулся — ждём «продолжить».
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        apply({ state: pause(ref.current, clock()), events: [] });
        stopSpeech();
      } else if (ref.current.running) void keepAwake().then(setAwake);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (state.running) void keepAwake().then(setAwake);
  }, [state.running]);
  useEffect(() => () => releaseAwake(), []);

  // Сохраняем ход занятия при каждом шаге и паузе — чтобы продолжить после закрытия приложения.
  useEffect(() => {
    if (state.done) return;
    const saved: SavedRun = { plan, state: pause(state, clock()), before, savedAt: Date.now() };
    void setSetting(SETTING_RUN, saved);
  }, [state.index, state.phase, state.running, state.extra]);

  const step = plan.steps[state.index] ?? plan.steps[plan.steps.length - 1];
  const pose = POSE_BY_ID.get(poseIdAt(state, plan, state.index))!;
  const len = phaseLength(state, plan);
  const t = Math.min(len, phaseElapsed(state, now));
  const left = len - t;
  const holding = state.phase === 'hold';
  const breath = holding && pose.breath ? breathAt(t, pose.breath) : null;
  const dyn = useBreathPhase(!!pose.alt && holding && state.running);
  const nextIdx = state.index + 1;
  const nextPose = nextIdx < plan.steps.length ? POSE_BY_ID.get(poseIdAt(state, plan, nextIdx)) : null;
  const cue = holding ? pose.cues[t < len / 2 || pose.cues.length < 2 ? 0 : 1] : state.index === 0 ? 'Займи удобное положение' : 'Приготовься';

  // Голос и сигнал для ритма дыхания — первые два круга, дальше только сигнал.
  const lastBreath = useRef('');
  useEffect(() => {
    if (!breath || !state.running || breath.key === lastBreath.current) return;
    lastBreath.current = breath.key;
    if (opts.current.soundOn && breath.kind !== 'hold') tone(breath.kind);
    if (opts.current.voiceOn && breath.cycleNo < 2) say(breath.label);
  }, [breath?.key]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const act = (f: (s: RunState, n: number) => RunState | { state: RunState; events: RunEvent[] }) => {
    const r = f(ref.current, clock());
    apply('events' in r ? r : { state: r, events: [] });
  };

  return (
    <div class="player">
      <div class="player-top">
        <button
          class="icon-btn"
          aria-label="Закончить"
          onClick={() => {
            act((s, n) => pause(s, n));
            stopSpeech();
            setSheet('exit');
          }}
        >
          <IconClose />
        </button>
        <span class="player-count num">
          {state.index + 1} / {plan.steps.length}
        </span>
        <button class="icon-btn" aria-label={voiceOn ? 'Выключить голос' : 'Включить голос'} onClick={onToggleVoice}>
          {voiceOn ? <IconVolume /> : <IconMute />}
        </button>
      </div>
      <div class="player-bar">
        <span style={{ width: `${progress(state, plan, now) * 100}%` }} />
      </div>
      <div class="player-block">{BLOCK_LABEL[step.block]}</div>

      <div class="player-stage">
        {breath && (
          <div class="breath-circle" style={{ transform: `scale(${breath.scale})` }}>
            <span>{breath.label}</span>
          </div>
        )}
        <PoseFigure pose={pose} side={step.side} phase={dyn} class={`player-figure ${breath ? 'is-dim' : ''}`} />
      </div>

      <div class="player-info">
        <h1 class="player-name">{pose.name}</h1>
        <div class="player-side">{step.counter ? 'компенсация после прогиба' : sideLabel(step.side)}</div>
        <div class="player-cue">{cue}</div>
      </div>

      <div class={`player-timer ${holding ? '' : 'is-prep'}`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r={R} />
          <circle class="ring-fill" cx="60" cy="60" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - t / len)} transform="rotate(-90 60 60)" />
        </svg>
        <div class="player-time num">{fmtClock(left)}</div>
        {!state.running && <div class="player-paused">пауза</div>}
      </div>

      <div class="player-controls">
        <button class="ctl" aria-label="Назад" onClick={() => act((s, n) => prevStep(s, plan, n))}>
          <IconPrev />
        </button>
        <button class="ctl ctl-main" aria-label={state.running ? 'Пауза' : 'Продолжить'} onClick={() => act((s, n) => (s.running ? pause(s, n) : resume(s, n)))}>
          {state.running ? <IconPause size={30} /> : <IconPlay size={30} />}
        </button>
        <button class="ctl" aria-label="Дальше" onClick={() => act((s, n) => nextStep(s, plan, n))}>
          <IconNext />
        </button>
      </div>
      <div class="player-extra">
        <button class="btn btn-small btn-plain" disabled={!holding} onClick={() => act((s) => addTime(s))}>
          +15 с
        </button>
        {(pose.easy || pose.easier) && (
          <button
            class="btn btn-small btn-plain"
            onClick={() => {
              act((s, n) => pause(s, n));
              setSheet('easy');
            }}
          >
            Полегче
          </button>
        )}
      </div>
      <div class="player-next">{nextPose ? `Дальше: ${nextPose.name}` : 'Последняя поза'}</div>
      {awake === false && <div class="player-hint">Чтобы экран не гас: Настройки → Экран и яркость → Автоблокировка → Никогда.</div>}

      {sheet === 'easy' && (
        <Sheet title="Если тяжело" onClose={() => setSheet(null)}>
          {pose.easy && <p class="sheet-text">{pose.easy}</p>}
          {pose.easier && (
            <button
              class="btn btn-block"
              style={{ marginTop: 14 }}
              onClick={() => {
                const s = replaceWithEasier(ref.current, plan);
                apply({ state: resume(s, clock()), events: [] });
                const id = poseIdAt(s, plan, s.index);
                if (opts.current.voiceOn) say(`${POSE_BY_ID.get(id)!.name}.`, { interrupt: true });
                setSheet(null);
              }}
            >
              Заменить на «{POSE_BY_ID.get(pose.easier)!.name}»
            </button>
          )}
          <button
            class="btn btn-block btn-soft"
            style={{ marginTop: 10 }}
            onClick={() => {
              act((s, n) => resume(s, n));
              setSheet(null);
            }}
          >
            Продолжить как есть
          </button>
        </Sheet>
      )}

      {sheet === 'exit' && (
        <Sheet title="Закончить занятие?" onClose={() => setSheet(null)}>
          <button
            class="btn btn-block"
            onClick={() => {
              setSheet(null);
              const s = finishEarly(ref.current, plan, clock());
              ref.current = s;
              onDone(s);
            }}
          >
            Закончить и записать
          </button>
          <button
            class="btn btn-block btn-soft"
            style={{ marginTop: 10 }}
            onClick={() => {
              act((s, n) => resume(s, n));
              setSheet(null);
            }}
          >
            Продолжить занятие
          </button>
          <button class="btn btn-block btn-plain" style={{ marginTop: 10 }} onClick={onDiscard}>
            Выйти без записи
          </button>
        </Sheet>
      )}
    </div>
  );
}

function describeChange(before: { hold: number; swaps: Record<string, string> }, after: { hold: number; swaps: Record<string, string> }): string | null {
  const parts: string[] = [];
  if (after.hold > before.hold) parts.push('удержания станут длиннее');
  if (after.hold < before.hold) parts.push('удержания станут короче');
  for (const [from, to] of Object.entries(after.swaps)) {
    if (before.swaps[from]) continue;
    parts.push(`«${POSE_BY_ID.get(from)?.name}» заменим на «${POSE_BY_ID.get(to)?.name}»`);
  }
  if (!parts.length) return null;
  const text = parts.join(', ');
  return `Программа подстроилась: ${text}`;
}

function Finish({ plan, state, before, onClose, onDiscard }: { plan: SessionPlan; state: RunState; before: Wellness; onClose: () => void; onDiscard: () => void }) {
  const base = useMemo(() => toWorkout(state, plan, newId(), today(new Date(state.startedAt)), clock()), []);
  const [rating, setRating] = useState<Rating>();
  const [after, setAfter] = useState<Wellness>({});
  const [notOk, setNotOk] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const done = [...new Set(base.poses.filter((p) => !p.counter && !p.skipped).map((p) => p.poseId))];
  // дыхание и шавасану «не получилось» не отмечают
  const markable = done.filter((id) => POSE_BY_ID.get(id)!.kind !== 'breath' && id !== 'shavasana');
  const skipped = new Set(base.poses.filter((p) => !p.counter && p.skipped).map((p) => p.poseId)).size;
  const minutes = Math.max(1, Math.round(base.actualSec / 60));

  const save = async () => {
    setSaving(true);
    try {
      const workout = {
        ...base,
        rating,
        ...(isEmptyWellness(before) ? {} : { before }),
        ...(isEmptyWellness(after) ? {} : { after }),
        note: note.trim(),
        poses: base.poses.map((p) => (p.skipped || p.counter ? p : { ...p, ok: !notOk.has(p.poseId) })),
      };
      let message = 'Занятие записано';
      await db.transaction('rw', db.workouts, db.programs, db.settings, async () => {
        await db.workouts.add(workout);
        if (workout.programId) {
          const program = await db.programs.get(workout.programId);
          if (program) {
            const next = adapt(program.adapt, rating, workout.poses);
            await db.programs.update(program.id, { adapt: next });
            message = describeChange(program.adapt, next) ?? message;
          }
        }
        await db.settings.delete(SETTING_RUN);
      });
      showToast(message);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet full onClose={onDiscard} title="Занятие окончено">
      <div class="finish-stats">
        <div>
          <b class="num">{minutes}</b>
          <span>{plural(minutes, 'минута', 'минуты', 'минут')}</span>
        </div>
        <div>
          <b class="num">{markable.length}</b>
          <span>{plural(markable.length, 'поза', 'позы', 'поз')}</span>
        </div>
        <div>
          <b class="num">{skipped}</b>
          <span>пропущено</span>
        </div>
      </div>

      <h2 class="wizard-title">Как было?</h2>
      <RatingPicker value={rating} onChange={setRating} />
      {plan.programId && <p class="wizard-sub">По оценке программа подстроит следующие занятия.</p>}

      <h2 class="wizard-title">Как ты теперь?</h2>
      <WellnessForm value={after} onChange={setAfter} />

      {markable.length > 0 && (
        <>
          <h2 class="wizard-title">Что не получилось?</h2>
          <p class="wizard-sub">Отметь позы, которые не шли. Остальные считаются освоенными на этом занятии.</p>
          <div class="tags">
            {markable.map((id) => (
              <button
                key={id}
                class={`chip ${notOk.has(id) ? 'is-warn' : ''}`}
                aria-pressed={notOk.has(id)}
                onClick={() => {
                  const s = new Set(notOk);
                  if (s.has(id)) s.delete(id);
                  else s.add(id);
                  setNotOk(s);
                }}
              >
                {POSE_BY_ID.get(id)!.name}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 class="wizard-title">Заметка</h2>
      <textarea class="textarea" rows={3} placeholder="Например: тянуло правое колено" value={note} onInput={(e) => setNote(e.currentTarget.value)} />

      <div class="sticky-foot">
        <button class="btn btn-block" disabled={saving} onClick={() => void save()}>
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}
