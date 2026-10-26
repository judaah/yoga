// Свои SVG-графики по правилам скилла dataviz: тонкие метки, столбик ≤ 24px со скруглённым концом,
// линия 2px, маркер с кольцом цвета фона, волосяная сетка; по тапу — подпись со значениями,
// под графиком — таблица. Текст всегда цветом текста, а не цветом серии.

import { useState } from 'preact/hooks';

const W = 320;
const PAD = { top: 16, right: 12, bottom: 22, left: 34 };

/** Красивый верх шкалы: 0…max округляется до 5, 10, 15, 20, 30, 60… */
export function niceMax(max: number): number {
  if (max <= 0) return 10;
  const steps = [5, 10, 15, 20, 30, 40, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600];
  return steps.find((s) => s >= max) ?? Math.ceil(max / 100) * 100;
}

function ticks(min: number, max: number, n = 3): number[] {
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => Math.round((min + step * i) * 10) / 10);
}

/** Путь столбика: скругление 4px сверху, у основания — прямой угол. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

export interface Column {
  label: string;
  value: number;
  /** подпись для строки над графиком и таблицы */
  title: string;
  detail?: string;
}

export function ColumnChart({ data, unit, height = 150, caption }: { data: Column[]; unit: string; height?: number; caption: string }) {
  const [sel, setSel] = useState(data.length - 1);
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const plotH = height - PAD.top - PAD.bottom;
  const band = (W - PAD.left - PAD.right) / data.length;
  const colW = Math.min(24, band * 0.6);
  const y = (v: number) => PAD.top + plotH * (1 - v / max);
  const cur = data[sel];
  return (
    <figure class="chart">
      <div class="chart-readout" aria-live="polite">
        <b class="num">
          {cur.value} {unit}
        </b>
        <span>
          {cur.title}
          {cur.detail ? ` · ${cur.detail}` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={caption}>
        {ticks(0, max).map((t) => (
          <g key={t}>
            <line class="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text class="chart-tick" x={PAD.left - 6} y={y(t) + 3} text-anchor="end">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const h = Math.max(0, plotH * (d.value / max));
          return (
            <g key={i} class={`chart-col ${i === sel ? 'is-sel' : ''}`} onClick={() => setSel(i)}>
              <rect class="chart-hit" x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + PAD.bottom} />
              {d.value > 0 && <path class="chart-bar" d={columnPath(cx - colW / 2, y(d.value), colW, h)} />}
              <text class="chart-tick" x={cx} y={height - 6} text-anchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTable caption={caption} head={['', unit]} rows={data.map((d) => [d.title, String(d.value)])} />
    </figure>
  );
}

export interface Series {
  name: string;
  /** CSS-цвет метки: var(--series-1) и т.п. */
  color: string;
  /** значение для каждой точки оси X; null — нет замера */
  values: Array<number | null>;
}

/** Линии по точкам (даты замеров по порядку). Две серии и больше — легенда с линиями-ключами. */
export function LineChart({
  series,
  xLabels,
  xTitles,
  unit,
  caption,
  height = 140,
  domain,
}: {
  series: Series[];
  xLabels: string[];
  xTitles: string[];
  unit: string;
  caption: string;
  height?: number;
  /** фиксированная шкала, например 1…5 для самочувствия */
  domain?: [number, number];
}) {
  const n = xLabels.length;
  const [sel, setSel] = useState(n - 1);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  let [lo, hi] = domain ?? [Math.min(0, ...all), Math.max(...all)];
  if (!domain) {
    const span = hi - lo || 10;
    lo = lo < 0 ? -niceMax(-lo) : 0;
    hi = hi <= 0 ? 0 : niceMax(hi + span * 0.05);
  }
  const plotH = height - PAD.top - PAD.bottom;
  const step = n > 1 ? (W - PAD.left - PAD.right - 16) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? PAD.left + 8 + step * i : (PAD.left + W - PAD.right) / 2);
  const y = (v: number) => PAD.top + plotH * (1 - (v - lo) / (hi - lo || 1));
  const tickVals = domain ? Array.from({ length: domain[1] - domain[0] + 1 }, (_, i) => domain[0] + i).filter((_, i, a) => a.length <= 5 || i % 2 === 0) : ticks(lo, hi);
  // подписи X: не больше шести, крайние всегда
  const every = Math.max(1, Math.ceil(n / 6));

  return (
    <figure class="chart">
      <div class="chart-readout" aria-live="polite">
        {series.map((s) => (
          <span class="chart-readout-item" key={s.name}>
            <i class="line-key" style={{ background: s.color }} />
            <b class="num">{s.values[sel] === null || s.values[sel] === undefined ? '—' : `${fmt(s.values[sel]!)} ${unit}`}</b>
            {series.length > 1 && <span>{s.name}</span>}
          </span>
        ))}
        <span class="chart-readout-date">{xTitles[sel]}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={caption}>
        {tickVals.map((t) => (
          <g key={t}>
            <line class={`chart-grid ${t === 0 && lo < 0 ? 'is-zero' : ''}`} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text class="chart-tick" x={PAD.left - 6} y={y(t) + 3} text-anchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        <line class="chart-cross" x1={x(sel)} x2={x(sel)} y1={PAD.top} y2={PAD.top + plotH} />
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
          const d = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? 'L' : 'M'}${p[0]} ${p[1]}` : acc), '');
          return (
            <g key={s.name}>
              <path class="chart-line" d={d} style={{ stroke: s.color }} />
              {pts.map((p, i) => p && <circle key={i} class="chart-dot" cx={p[0]} cy={p[1]} r={i === sel ? 5 : 4} style={{ fill: s.color }} />)}
            </g>
          );
        })}
        {xLabels.map((l, i) =>
          i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.6) ? (
            <text key={i} class="chart-tick" x={x(i)} y={height - 6} text-anchor="middle">
              {l}
            </text>
          ) : null,
        )}
        {xLabels.map((_, i) => (
          <rect key={i} class="chart-hit" x={x(i) - Math.max(12, step / 2)} y={0} width={Math.max(24, step)} height={height} onClick={() => setSel(i)} />
        ))}
      </svg>
      {series.length > 1 && (
        <div class="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i class="line-key" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <ChartTable
        caption={caption}
        head={['', ...series.map((s) => (series.length > 1 ? s.name : unit))]}
        rows={xTitles.map((t, i) => [t, ...series.map((s) => (s.values[i] === null ? '—' : fmt(s.values[i]!)))])}
      />
    </figure>
  );
}

/** Число по-русски: запятая в дробях и настоящий минус. */
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')).replace('-', '−');

function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details class="chart-table">
      <summary>Таблицей</summary>
      <table>
        <caption class="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} class={j ? 'num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
