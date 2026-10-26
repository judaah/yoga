import { POSE_BY_ID } from '../data/poses';
import { sessionSeconds, type SessionPlan } from '../data/program';
import type { Block } from '../data/types';
import { formatMinutes, formatSeconds, plural } from '../lib/format';
import { PoseFigure } from './Figure';
import { IconPlay } from './icons';
import { Sheet } from './Sheet';

export const BLOCK_LABEL: Record<Block, string> = {
  centering: 'Настройка',
  warmup: 'Разминка',
  standing: 'Стоя',
  floor: 'На полу',
  cooldown: 'Заминка',
  relax: 'Расслабление',
};

export const sideLabel = (side?: 'right' | 'left') => (side === 'right' ? 'правая сторона' : side === 'left' ? 'левая сторона' : '');

/** Сколько разных поз в занятии: без дыхания, шавасаны, компенсаций и вторых сторон. */
export const poseCount = (plan: SessionPlan) =>
  new Set(plan.steps.filter((s) => !s.counter && s.block !== 'centering' && s.block !== 'relax').map((s) => s.poseId)).size;

/** Полоска фигурок первых поз — для карточек занятий. */
export function PoseStrip({ plan, max = 6 }: { plan: SessionPlan; max?: number }) {
  const ids: string[] = [];
  for (const s of plan.steps) if (!ids.includes(s.poseId) && s.block !== 'centering' && s.block !== 'relax') ids.push(s.poseId);
  return (
    <div class="pose-strip" aria-hidden="true">
      {ids.slice(0, max).map((id) => (
        <span key={id} class="pose-strip-item">
          <PoseFigure pose={POSE_BY_ID.get(id)!} small />
        </span>
      ))}
    </div>
  );
}

/** Список шагов занятия по частям; снизу — «Начать». */
export function SessionPreview({ plan, onClose, onStart }: { plan: SessionPlan; onClose: () => void; onStart?: () => void }) {
  const groups: Array<{ block: Block; steps: SessionPlan['steps'] }> = [];
  for (const s of plan.steps) {
    const g = groups[groups.length - 1];
    if (g && g.block === s.block) g.steps.push(s);
    else groups.push({ block: s.block, steps: [s] });
  }
  const n = poseCount(plan);
  return (
    <Sheet full onClose={onClose} title={plan.title}>
      <p class="screen-sub" style={{ margin: '0 2px 4px' }}>
        {formatMinutes(sessionSeconds(plan.steps))} · {n} {plural(n, 'поза', 'позы', 'поз')}
        {plan.week ? ` · неделя ${plan.week}` : ''}
      </p>
      {groups.map((g, gi) => (
        <section class="section" key={gi}>
          <h3 class="section-head">{BLOCK_LABEL[g.block]}</h3>
          <div class="card">
            {g.steps.map((s, i) => {
              const p = POSE_BY_ID.get(s.poseId)!;
              return (
                <div class="row step-row" key={i}>
                  <span class="step-thumb">
                    <PoseFigure pose={p} side={s.side} small />
                  </span>
                  <span class="row-main">
                    <span class="row-title">{p.name}</span>
                    {(s.side || s.counter) && <span class="row-sub">{s.counter ? 'компенсация после прогиба' : sideLabel(s.side)}</span>}
                  </span>
                  <span class="row-value">{formatSeconds(s.hold)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {onStart && (
        <div class="sticky-foot">
          <button class="btn btn-block" onClick={onStart}>
            <IconPlay size={20} /> Начать занятие
          </button>
        </div>
      )}
    </Sheet>
  );
}
