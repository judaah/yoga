// Все фигурки на одном листе — проверять глазами после правок в src/data/poses.ts.
// Красная рамка — точка опоры висит над полом (то же, что ловит tests/poses.test.ts).
import { render } from 'preact';
import { POSES } from '../../src/data/poses';
import { GROUPS } from '../../src/data/types';
import { contactGap, solve } from '../../src/lib/figure';
import { FigureSvg } from '../../src/ui/Figure';
import { ART_ALIAS } from '../art/prompts';

const TOLERANCE = 1.6;
const params = new URLSearchParams(location.search);
const only = params.get('group');

function Gallery() {
  const poses = only ? POSES.filter((p) => p.group === only) : POSES;
  return (
    <>
      <h1>
        Позы: {poses.length} {only && `(${GROUPS.find((g) => g.id === only)?.label})`}
      </h1>
      <div class="grid">
        {poses.map((p) => {
          const s = solve(p.figure);
          const gaps = s.view === 'top' ? [] : (p.figure.on ?? []).map((c) => [c, contactGap(s, c)] as const);
          const bad = gaps.some(([, g]) => g > TOLERANCE);
          return (
            <div class={`cell ${bad ? 'bad' : ''}`} key={p.id}>
              <div class="name">
                {p.name} · ур. {p.level}
              </div>
              <div class="id">{p.id}</div>
              <div class="pair">
                <FigureSvg solved={s} />
                {p.alt && <FigureSvg solved={solve(p.alt)} />}
              </div>
              {/* сырые иллюстрации из art/raw — сверить позу со схемой */}
              <div class="pair">
                <img class="art" src={`/art/raw/${ART_ALIAS[p.id] ?? p.id}.png`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                {p.alt && <img class="art" src={`/art/raw/${p.id}_alt.png`} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              </div>
              <div class="gaps">
                {gaps.map(([c, g]) => (g > TOLERANCE ? <b key={c}>{c} {g.toFixed(1)} </b> : <span key={c}>{c} {g.toFixed(1)} </span>))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

render(<Gallery />, document.getElementById('app')!);
