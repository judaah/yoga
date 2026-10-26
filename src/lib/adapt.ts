// Как программа подстраивается под человека после каждого занятия программы.
// Два «легко» подряд → удержания +12% и позы уровнем выше; «тяжело» → −15% и самая сложная поза
// меняется на лёгкую; позу пропустил три занятия подряд или заменил кнопкой «полегче» → больше её не даём.

import { POSE_BY_ID } from '../data/poses';
import type { Adaptation, Rating } from '../data/program';
import type { WorkoutPose } from '../db/db';

export const HOLD_MIN = 0.7;
export const HOLD_MAX = 1.4;
export const SKIPS_TO_SWAP = 3;

const round2 = (v: number) => Math.round(v * 100) / 100;

export function adapt(prev: Adaptation, rating: Rating | undefined, poses: WorkoutPose[]): Adaptation {
  const next: Adaptation = {
    hold: prev.hold,
    boost: prev.boost,
    swaps: { ...prev.swaps },
    skips: { ...prev.skips },
    ratings: rating ? [...prev.ratings, rating].slice(-6) : [...prev.ratings],
  };

  if (rating === 'easy' && next.ratings.slice(-2).join() === 'easy,easy') {
    next.hold = round2(Math.min(HOLD_MAX, next.hold * 1.12));
    next.boost = 1;
    // счёт «легко» начинается заново, чтобы не разгонять программу каждым следующим занятием
    next.ratings = [];
  }

  if (rating === 'hard') {
    next.hold = round2(Math.max(HOLD_MIN, next.hold * 0.85));
    const hardest = poses
      .filter((p) => !p.counter && !p.skipped && !next.swaps[p.poseId] && POSE_BY_ID.get(p.poseId)?.easier)
      .sort((a, b) => {
        const pa = POSE_BY_ID.get(a.poseId)!;
        const pb = POSE_BY_ID.get(b.poseId)!;
        return pb.level - pa.level || Number(a.ok !== false) - Number(b.ok !== false) || b.planned - a.planned;
      })[0];
    if (hardest) next.swaps[hardest.poseId] = POSE_BY_ID.get(hardest.poseId)!.easier!;
  }

  // Пропуски считаем по позе (обе стороны — одна поза): пропустил хоть одну сторону — пропуск.
  const byPose = new Map<string, boolean>();
  for (const p of poses) {
    if (p.counter) continue;
    if (p.replacedFrom) next.swaps[p.replacedFrom] = p.poseId;
    byPose.set(p.poseId, (byPose.get(p.poseId) ?? false) || p.skipped);
  }
  for (const [id, skipped] of byPose) {
    if (!skipped) {
      delete next.skips[id];
      continue;
    }
    next.skips[id] = (next.skips[id] ?? 0) + 1;
    const easier = POSE_BY_ID.get(id)?.easier;
    if (next.skips[id] >= SKIPS_TO_SWAP && easier) {
      next.swaps[id] = easier;
      delete next.skips[id];
    }
  }
  return next;
}
