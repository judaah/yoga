// Распечатка занятия: npx vite-node tools/plan-debug.ts '{"experience":2,"goals":["back"],"minutes":30,"time":"evening","limits":[],"week":1,"seed":1}'
import { POSE_BY_ID } from '../src/data/poses';
import { sessionSeconds } from '../src/data/program';
import { buildSession, type BuildInput } from '../src/lib/planner';

const input: BuildInput = JSON.parse(process.argv[2] ?? '{"experience":2,"goals":["flexibility","back"],"minutes":30,"time":"evening","limits":[],"week":1,"seed":777}');
const steps = buildSession(input);
let t = 0;
for (const s of steps) {
  const p = POSE_BY_ID.get(s.poseId)!;
  console.log(
    `${String(Math.floor(t / 60)).padStart(2)}:${String(t % 60).padStart(2, '0')}  ${s.block.padEnd(9)} ${(p.name + (s.side ? ` (${s.side === 'right' ? 'пр' : 'лев'})` : '')).padEnd(40)} ${String(s.hold).padStart(3)} с ${p.kind}${s.counter ? ' ↺' : ''}`,
  );
  t += s.hold + s.prep;
}
console.log(`итого ${Math.round(sessionSeconds(steps) / 6) / 10} мин, шагов ${steps.length}, поз ${new Set(steps.map((s) => s.poseId)).size}`);
