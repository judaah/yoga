// Точки фигурки и зазоры опор для одной позы: npx vite-node tools/fig-debug.ts <id> [alt]
import { POSE_BY_ID } from '../src/data/poses';
import { bounds, contactGap, solve, type LimbPts } from '../src/lib/figure';

const [id, which] = process.argv.slice(2);
const pose = POSE_BY_ID.get(id);
if (!pose) throw new Error(`нет позы ${id}`);
const fig = which === 'alt' ? pose.alt! : pose.figure;
const s = solve(fig);
const f = (v: { x: number; y: number }) => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)})`;
const limb = (l: LimbPts) => `${f(l.root)} → ${f(l.mid)} → ${f(l.end)}${l.toe ? ` → ${f(l.toe)}` : ''}`;
console.log(`${pose.id} (${s.view})`);
console.log(`таз ${f(s.hip)}  плечо ${f(s.shoulder)}  голова ${f(s.head)}`);
s.arms.forEach((a, i) => console.log(`рука${i} ${limb(a)}`));
s.legs.forEach((l, i) => console.log(`нога${i} ${limb(l)}`));
const b = bounds(s);
console.log(`рамка x ${b.minX.toFixed(1)}…${b.maxX.toFixed(1)}  y ${b.minY.toFixed(1)}…${b.maxY.toFixed(1)}`);
for (const c of fig.on ?? []) console.log(`опора ${c}: ${contactGap(s, c).toFixed(2)}`);
