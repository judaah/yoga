import { useMemo, useState } from 'preact/hooks';
import { POSES, POSE_BY_ID } from '../data/poses';
import { GOALS, GROUPS, LIMITS, type Pose, type PoseGroup } from '../data/types';
import { formatSeconds } from '../lib/format';
import { PoseFigure, useBreathPhase } from './Figure';
import { IconSearch } from './icons';
import { Sheet } from './Sheet';

export function LevelDots({ level }: { level: number }) {
  return (
    <span class="level-dots" aria-label={`уровень ${level}`}>
      {[1, 2, 3].map((n) => (
        <i key={n} class={n <= level ? 'on' : ''} />
      ))}
    </span>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const GROUP_ORDER = new Map(GROUPS.map((g, i) => [g.id, i]));

export function Poses() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<PoseGroup | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [open, setOpen] = useState<Pose | null>(null);

  const list = useMemo(() => {
    const q = norm(query.trim());
    return POSES.filter(
      (p) =>
        (!group || p.group === group) &&
        (!level || p.level === level) &&
        (!q || norm(p.name).includes(q) || norm(p.sanskrit ?? '').includes(q)),
    ).sort((a, b) => GROUP_ORDER.get(a.group)! - GROUP_ORDER.get(b.group)! || a.level - b.level);
  }, [query, group, level]);

  return (
    <div class="screen-body">
      <div class="screen-head">
        <h1 class="screen-title">Позы</h1>
      </div>
      <div class="filters">
        <label class="search">
          <IconSearch size={18} />
          <input type="search" placeholder="Название или санскрит" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
        <div class="chips">
          <button class={`chip ${!group ? 'is-on' : ''}`} onClick={() => setGroup(null)}>
            Все
          </button>
          {GROUPS.map((g) => (
            <button key={g.id} class={`chip ${group === g.id ? 'is-on' : ''}`} onClick={() => setGroup(group === g.id ? null : g.id)}>
              {g.label}
            </button>
          ))}
        </div>
        <div class="segmented" role="group" aria-label="Уровень">
          {[null, 1, 2, 3].map((l) => (
            <button key={String(l)} class={level === l ? 'is-on' : ''} onClick={() => setLevel(l)}>
              {l ? `Уровень ${l}` : 'Любой'}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div class="empty">
          <div class="empty-title">Ничего не нашлось</div>
          <div class="empty-text">Попробуй другое название или сбрось фильтры.</div>
        </div>
      ) : (
        <div class="pose-grid">
          {list.map((p) => (
            <button key={p.id} class="pose-tile" onClick={() => setOpen(p)}>
              <PoseFigure pose={p} small />
              <span class="pose-tile-name">{p.name}</span>
              <span class="pose-tile-sub">
                <span>{GROUPS.find((g) => g.id === p.group)?.label}</span>
                <LevelDots level={p.level} />
              </span>
            </button>
          ))}
        </div>
      )}

      {open && <PoseSheet pose={open} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

const POSITION_LABEL: Record<Pose['position'], string> = {
  standing: 'стоя',
  kneeling: 'на коленях',
  all4: 'на четвереньках',
  prone: 'лёжа на животе',
  seated: 'сидя',
  supine: 'лёжа на спине',
};

/** Карточка позы: большая фигурка (живая у динамичных), шаги, подсказки, противопоказания. */
export function PoseSheet({ pose, onClose, onOpen }: { pose: Pose; onClose: () => void; onOpen?: (p: Pose) => void }) {
  const phase = useBreathPhase(!!pose.alt);
  const easier = pose.easier ? POSE_BY_ID.get(pose.easier) : undefined;
  const contra = LIMITS.filter((l) => pose.contra.includes(l.id));
  const goals = GOALS.filter((g) => pose.goals[g.id]).sort((a, b) => (pose.goals[b.id] ?? 0) - (pose.goals[a.id] ?? 0));
  return (
    <Sheet full onClose={onClose} title={GROUPS.find((g) => g.id === pose.group)?.label}>
      <div class="pose-hero">
        <PoseFigure pose={pose} phase={phase} />
      </div>
      <h2 class="pose-title">{pose.name}</h2>
      {pose.sanskrit && <div class="pose-sanskrit">{pose.sanskrit}</div>}
      <div class="tags" style={{ marginTop: 12 }}>
        <span class="tag tag-accent">
          Уровень {pose.level} <LevelDots level={pose.level} />
        </span>
        <span class="tag">{POSITION_LABEL[pose.position]}</span>
        <span class="tag">
          {pose.breath ? `${formatSeconds(pose.hold)}` : `от ${formatSeconds(pose.hold)}`}
          {pose.bilateral ? ' на сторону' : ''}
        </span>
        {pose.alt && <span class="tag">в движении</span>}
      </div>

      <section class="section">
        <h3 class="section-head">Как войти</h3>
        <div class="card card-pad">
          <ol class="steps">
            {pose.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </section>

      <section class="section">
        <h3 class="section-head">Обрати внимание</h3>
        <div class="card card-pad">
          <ul class="bullets">
            {pose.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </section>

      {(pose.easy || easier) && (
        <section class="section">
          <h3 class="section-head">Если тяжело</h3>
          <div class="card">
            {pose.easy && <div class="card-pad">{pose.easy}</div>}
            {easier && (
              <button class="row" onClick={() => onOpen?.(easier)}>
                <span class="step-thumb">
                  <PoseFigure pose={easier} small />
                </span>
                <span class="row-main">
                  <span class="row-sub">Поза полегче</span>
                  <span class="row-title">{easier.name}</span>
                </span>
              </button>
            )}
          </div>
        </section>
      )}

      <section class="section">
        <h3 class="section-head">Для чего</h3>
        <div class="tags">
          {goals.map((g) => (
            <span key={g.id} class="tag">
              {g.emoji} {g.label}
            </span>
          ))}
        </div>
      </section>

      {contra.length > 0 && (
        <section class="section">
          <h3 class="section-head">Осторожно</h3>
          <div class="note note-warn">
            Не подбираем в программу, если отмечено: {contra.map((c) => c.label.toLowerCase()).join('; ')}.
          </div>
        </section>
      )}
    </Sheet>
  );
}
