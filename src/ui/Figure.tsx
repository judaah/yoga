import { useEffect, useMemo, useState } from 'preact/hooks';
import { ART_ALIAS, ART_IDS } from '../data/art';
import type { Pose } from '../data/types';
import { FRAME, lerpSolved, mirror, place, shapePath, shapes, solve, type Solved } from '../lib/figure';

/** Рисует посчитанную фигурку. Цвет — currentColor, дальние руку и ногу бледнее. */
export function FigureSvg({ solved, class: cls }: { solved: Solved; class?: string }) {
  const { P, X, scale, left, right } = place(solved);
  const items = shapes(solved);
  const top = solved.view === 'top';
  return (
    <svg class={`figure ${cls ?? ''}`} viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} aria-hidden="true">
      {top ? (
        <rect class="figure-mat" x={6} y={FRAME.h / 2 - 34} width={FRAME.w - 12} height={68} rx={6} />
      ) : (
        <rect class="figure-mat" x={Math.max(4, left - 8)} y={FRAME.floor} width={Math.min(FRAME.w - 8, right - left + 16)} height={3} rx={1.5} />
      )}
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        {items.map((sh, i) => {
          if (sh.kind === 'circle') {
            const [cx, cy] = P(sh.c);
            return <circle key={i} cx={cx} cy={cy} r={sh.r * scale} fill="currentColor" stroke="none" />;
          }
          return <path key={i} d={shapePath(sh, X)} stroke-width={sh.width * scale} opacity={sh.far ? 0.42 : 1} />;
        })}
      </g>
    </svg>
  );
}

/** Есть ли у позы иллюстрация; alt — вторая (у кошки-коровы — кошка). */
export function artId(pose: Pose, alt = false): string | null {
  const id = alt ? `${pose.id}_alt` : (ART_ALIAS[pose.id] ?? pose.id);
  return ART_IDS.has(id) ? id : null;
}

/** small — уменьшенная копия для списков и миниатюр. */
export const artUrl = (id: string, small = false) => `${import.meta.env.BASE_URL}poses/${small ? 's/' : ''}${id}.webp`;

/**
 * Поза: иллюстрация, а если её нет — схематичная фигурка. side='left' — зеркально (вторая сторона).
 * phase 0…1 — где между основной картинкой и второй (у динамичных поз вроде кошки-коровы).
 */
export function PoseFigure({
  pose,
  side,
  phase = 0,
  class: cls,
  small,
}: {
  pose: Pose;
  side?: 'right' | 'left';
  phase?: number;
  class?: string;
  small?: boolean;
}) {
  const main = artId(pose);
  if (main) {
    const alt = pose.alt ? artId(pose, true) : null;
    return (
      <span class={`pose-art ${side === 'left' ? 'is-mirror' : ''} ${cls ?? ''}`} aria-hidden="true">
        <img src={artUrl(main, small)} alt="" decoding="async" draggable={false} />
        {/* две картинки не смешиваем (тела не совпадают точно) — на вдохе одна, на выдохе другая, с короткой сменой */}
        {alt && <img class="pose-art-alt" src={artUrl(alt, small)} style={{ opacity: phase >= 0.5 ? 1 : 0 }} alt="" decoding="async" draggable={false} />}
      </span>
    );
  }
  return <SchematicFigure pose={pose} side={side} phase={phase} class={cls} />;
}

function SchematicFigure({ pose, side, phase = 0, class: cls }: { pose: Pose; side?: 'right' | 'left'; phase?: number; class?: string }) {
  const base = useMemo(() => solve(pose.figure), [pose]);
  const alt = useMemo(() => (pose.alt ? solve(pose.alt) : null), [pose]);
  let s = alt && phase > 0 ? lerpSolved(base, alt, phase) : base;
  if (side === 'left') s = mirror(s);
  return <FigureSvg solved={s} class={cls} />;
}

/** Плавное «дыхание» 0 → 1 → 0 с периодом periodMs — для живой фигурки динамичной позы. */
export function useBreathPhase(active: boolean, periodMs = 8000): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % periodMs) / periodMs;
      setPhase((1 - Math.cos(t * 2 * Math.PI)) / 2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, periodMs]);
  return phase;
}
