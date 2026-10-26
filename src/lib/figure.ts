// Схематичная фигурка позы. Поза задаётся углами сегментов тела, функция solve() считает точки,
// а shapes() превращает их в отрезки и круг для SVG. Пропорции у всех поз одинаковые.
//
// Углы в градусах, как в математике: 0 — вправо, 90 — вверх, 180 — влево, 270 — вниз.
// Сбоку фигурка смотрит вправо: «вперёд» — это вправо. Ось y внутри направлена вверх, пол — y = 0.

export const BODY = {
  torso: 27,
  neck: 5,
  head: 6.5,
  upperArm: 16,
  forearm: 18,
  thigh: 25,
  shin: 23,
  foot: 8,
  /** половина ширины плеч и таза — только для вида спереди и сверху */
  shoulderHalf: 9,
  hipHalf: 5.5,
} as const;

export const STROKE = { torsoSide: 12, torsoFront: 15, limb: 6.5, neck: 5 } as const;

export type View = 'side' | 'front' | 'top';

/** Сегмент: угол или [угол, доля длины] — укороченный сегмент «смотрит на зрителя». */
export type Seg = number | readonly [number, number];

/** Точка фигурки, до которой можно дотянуться рукой: колено, щиколотка, носок ноги 0/1. */
export type PointName = 'knee0' | 'knee1' | 'ankle0' | 'ankle1' | 'toe0' | 'toe1';

/**
 * Конечность, которая сама дотягивается до опоры:
 * - floor: x — кисть/щиколотка на полу в точке x (отсчёт от таза по горизонтали);
 * - to — до точки [x, y] относительно таза или до точки фигурки;
 * - straight: -1 | 1 — прямая конечность влево/вправо, ровно до пола;
 * bend — куда сгибается сустав: 1 — против часовой стрелки от линии «корень → цель», -1 — по.
 */
export interface Reach {
  floor?: number;
  to?: readonly [number, number] | PointName;
  straight?: -1 | 1;
  bend?: 1 | -1;
  foot?: Seg;
}

export type ArmSpec = readonly [Seg, Seg] | Reach;
export type LegSpec = readonly [Seg, Seg] | readonly [Seg, Seg, Seg] | Reach;

/** Что должно касаться пола — проверяется тестом, чтобы фигурка не висела в воздухе. */
export type Contact = 'hand0' | 'hand1' | 'forearm0' | 'forearm1' | 'foot0' | 'foot1' | 'knee0' | 'knee1' | 'shin0' | 'shin1' | 'hip' | 'shoulder' | 'head' | 'back';

export interface Figure {
  /** side — сбоку; front — спереди; top — сверху, лёжа на коврике. По умолчанию side. */
  view?: View;
  torso: Seg;
  /** Изгиб спины: + — круглая спина, − — прогиб. В единицах тела. */
  spine?: number;
  /** Направление шея → голова; по умолчанию как у корпуса. */
  head?: number;
  /** Спереди: куда «смотрит вверх» таз; по умолчанию как корпус. 90 — таз ровный при боковом наклоне. */
  pelvis?: number;
  /** Сбоку: [ближняя, дальняя]; спереди: [левая на экране, правая]; каждая — [плечо, предплечье]. */
  arms: readonly [ArmSpec, ArmSpec];
  /** То же для ног: [бедро, голень, стопа?]. */
  legs: readonly [LegSpec, LegSpec];
  /** Высота таза над полом, если её не вывести из опор (все опоры — «дотянуться»). */
  hip?: number;
  /** Точки опоры — для проверки в тестах и галерее. */
  on?: readonly Contact[];
}

export interface Vec {
  x: number;
  y: number;
}

export interface LimbPts {
  root: Vec;
  mid: Vec;
  end: Vec;
  toe?: Vec;
}

export interface Solved {
  view: View;
  hip: Vec;
  shoulder: Vec;
  head: Vec;
  spine: number;
  arms: [LimbPts, LimbPts];
  legs: [LimbPts, LimbPts];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): Vec => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) });
const add = (a: Vec, b: Vec, k = 1): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Vec) => Math.hypot(v.x, v.y);
const angleOf = (v: Vec) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
export const segAngle = (s: Seg) => (typeof s === 'number' ? s : s[0]);
const segScale = (s: Seg) => (typeof s === 'number' ? 1 : s[1]);

const isReach = (spec: ArmSpec | LegSpec): spec is Reach => !Array.isArray(spec);

const LIMB_R = STROKE.limb / 2;
const torsoR = (view: View) => (view === 'side' ? STROKE.torsoSide : STROKE.torsoFront) / 2;

function fk(root: Vec, a: Seg, b: Seg, la: number, lb: number): LimbPts {
  const mid = add(root, dir(segAngle(a)), la * segScale(a));
  return { root, mid, end: add(mid, dir(segAngle(b)), lb * segScale(b)) };
}

/** Две кости до цели: сустав сгибается в сторону bend; если не достать — тянется прямой. */
function ik(root: Vec, target: Vec, la: number, lb: number, bend: 1 | -1): LimbPts {
  const d = sub(target, root);
  const dist = Math.max(Math.abs(la - lb) + 1e-6, Math.min(len(d), la + lb - 1e-6));
  const base = angleOf(d);
  const cosA = (la * la + dist * dist - lb * lb) / (2 * la * dist);
  const a = (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  const mid = add(root, dir(base + bend * a), la);
  const end = len(d) > la + lb ? add(mid, dir(angleOf(sub(target, mid))), lb) : target;
  return { root, mid, end };
}

function withFoot(limb: LimbPts, foot: Seg | undefined, view: View, shinAngle: number): LimbPts {
  if (foot === undefined && view !== 'side') return limb;
  const f = foot ?? shinAngle + 90;
  return { ...limb, toe: add(limb.end, dir(segAngle(f)), BODY.foot * segScale(f)) };
}

function lowest(limb: LimbPts): number {
  return Math.min(limb.mid.y, limb.end.y, limb.toe?.y ?? Infinity) - LIMB_R;
}

export function solve(fig: Figure): Solved {
  const view = fig.view ?? 'side';
  const hip: Vec = { x: 0, y: 0 };
  const torsoA = segAngle(fig.torso);
  const shoulder = add(hip, dir(torsoA), BODY.torso * segScale(fig.torso));
  const head = add(shoulder, dir(fig.head ?? torsoA), BODY.neck + BODY.head);

  // Сбоку обе руки растут из одной точки плеча; спереди и сверху — разнесены по ширине.
  const side = view === 'side';
  const across = side ? { x: 0, y: 0 } : dir(torsoA - 90);
  const acrossHip = side ? across : dir((fig.pelvis ?? torsoA) - 90);
  const shoulders: [Vec, Vec] = [add(shoulder, across, -BODY.shoulderHalf), add(shoulder, across, BODY.shoulderHalf)];
  const hips: [Vec, Vec] = [add(hip, acrossHip, -BODY.hipHalf), add(hip, acrossHip, BODY.hipHalf)];

  const arms: Array<LimbPts | null> = [null, null];
  const legs: Array<LimbPts | null> = [null, null];
  for (const i of [0, 1] as const) {
    const a = fig.arms[i];
    if (!isReach(a)) arms[i] = fk(shoulders[i], a[0], a[1], BODY.upperArm, BODY.forearm);
    const l = fig.legs[i];
    if (!isReach(l)) legs[i] = withFoot(fk(hips[i], l[0], l[1], BODY.thigh, BODY.shin), l[2], view, segAngle(l[1]));
  }

  // Пол: явная высота таза или самая низкая точка того, что уже посчитано.
  let floor = -Infinity;
  if (fig.hip !== undefined) floor = -fig.hip;
  else if (view !== 'top') {
    floor = Math.min(
      hip.y - torsoR(view),
      shoulder.y - torsoR(view),
      head.y - BODY.head,
      ...[...arms, ...legs].filter((l): l is LimbPts => !!l).map(lowest),
    );
  }

  const reach = (root: Vec, r: Reach, la: number, lb: number, isLeg: boolean): LimbPts => {
    const bend = r.bend ?? 1;
    const finish = (limb: LimbPts) => (isLeg ? withFoot(limb, r.foot, view, angleOf(sub(limb.end, limb.mid))) : limb);
    if (r.straight) {
      // Прямая конечность: ищем угол, при котором её нижняя точка ровно на полу.
      const make = (deg: number) => finish(fk(root, deg, deg, la, lb));
      let lo = 270;
      let hi = r.straight > 0 ? 360 : 180;
      if (lowest(make(lo)) > floor) return make(lo);
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (lowest(make(m)) < floor) lo = m;
        else hi = m;
      }
      return make(hi);
    }
    let target: Vec;
    if (r.floor !== undefined) target = { x: r.floor, y: floor + LIMB_R };
    else if (typeof r.to === 'string') target = pointOf(r.to);
    else if (r.to) target = { x: r.to[0], y: r.to[1] };
    else throw new Error('Reach без цели');
    return finish(ik(root, target, la, lb, bend));
  };

  const pointOf = (name: PointName): Vec => {
    const leg = legs[Number(name.slice(-1))];
    if (!leg) throw new Error(`Рука тянется к ${name}, но нога ещё не посчитана`);
    if (name.startsWith('knee')) return leg.mid;
    if (name.startsWith('ankle')) return leg.end;
    return leg.toe ?? leg.end;
  };

  // Сначала ноги (до них могут тянуться руки), потом руки.
  for (const i of [0, 1] as const) {
    const l = fig.legs[i];
    if (isReach(l)) legs[i] = reach(hips[i], l, BODY.thigh, BODY.shin, true);
  }
  for (const i of [0, 1] as const) {
    const a = fig.arms[i];
    if (isReach(a)) arms[i] = reach(shoulders[i], a, BODY.upperArm, BODY.forearm, false);
  }

  const solved: Solved = {
    view,
    hip,
    shoulder,
    head,
    spine: fig.spine ?? 0,
    arms: arms as [LimbPts, LimbPts],
    legs: legs as [LimbPts, LimbPts],
  };
  if (view === 'top') return solved;

  // Ничего не должно уходить под пол: если ушло — пол ниже. Потом сдвигаем всё так, чтобы пол был y = 0.
  const minY = Math.min(floor === -Infinity ? Infinity : floor, bounds(solved).minY);
  return translate(solved, { x: 0, y: -minY });
}

function mapPts(s: Solved, f: (v: Vec) => Vec): Solved {
  const limb = (l: LimbPts): LimbPts => ({ root: f(l.root), mid: f(l.mid), end: f(l.end), toe: l.toe && f(l.toe) });
  return {
    view: s.view,
    hip: f(s.hip),
    shoulder: f(s.shoulder),
    head: f(s.head),
    spine: s.spine,
    arms: [limb(s.arms[0]), limb(s.arms[1])],
    legs: [limb(s.legs[0]), limb(s.legs[1])],
  };
}

const translate = (s: Solved, d: Vec) => mapPts(s, (v) => add(v, d));

/** Зеркало по горизонтали — для второй стороны. */
export const mirror = (s: Solved) => mapPts(s, (v) => ({ x: -v.x, y: v.y }));

/** Промежуточное положение между двумя позами (кошка ↔ корова). */
export function lerpSolved(a: Solved, b: Solved, t: number): Solved {
  const pairs: Array<[Vec, Vec]> = [];
  mapPts(a, (v) => (pairs.push([v, v]), v));
  let i = 0;
  mapPts(b, (v) => ((pairs[i++][1] = v), v));
  let j = 0;
  const out = mapPts(a, () => {
    const [p, q] = pairs[j++];
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  });
  return { ...out, spine: a.spine + (b.spine - a.spine) * t };
}

// ---------- примитивы для рисования ----------

export type Shape =
  | { kind: 'line'; pts: Vec[]; width: number; far: boolean }
  | { kind: 'curve'; from: Vec; ctrl: Vec; to: Vec; width: number; far: boolean }
  | { kind: 'circle'; c: Vec; r: number; far: boolean };

function torsoCurve(s: Solved) {
  const d = sub(s.shoulder, s.hip);
  const n = { x: -d.y / len(d), y: d.x / len(d) }; // нормаль против часовой — сторона спины у фигурки сбоку
  const mid = { x: (s.hip.x + s.shoulder.x) / 2, y: (s.hip.y + s.shoulder.y) / 2 };
  return { from: s.hip, ctrl: add(mid, n, s.spine * 2), to: s.shoulder };
}

const limbLine = (l: LimbPts, far: boolean): Shape => ({
  kind: 'line',
  pts: [l.root, l.mid, l.end, ...(l.toe ? [l.toe] : [])],
  width: STROKE.limb,
  far,
});

/** Порядок важен: сначала дальние конечности, потом тело, потом ближние. */
export function shapes(s: Solved): Shape[] {
  const side = s.view === 'side';
  const t = torsoCurve(s);
  const body: Shape[] = [
    { kind: 'curve', ...t, width: side ? STROKE.torsoSide : STROKE.torsoFront, far: false },
    { kind: 'line', pts: [s.shoulder, s.head], width: STROKE.neck, far: false },
    { kind: 'circle', c: s.head, r: BODY.head, far: false },
  ];
  if (side) {
    return [limbLine(s.arms[1], true), limbLine(s.legs[1], true), ...body, limbLine(s.legs[0], false), limbLine(s.arms[0], false)];
  }
  return [limbLine(s.legs[0], false), limbLine(s.legs[1], false), ...body, limbLine(s.arms[0], false), limbLine(s.arms[1], false)];
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function bounds(s: Solved): Bounds {
  const b: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const grow = (p: Vec, r: number) => {
    b.minX = Math.min(b.minX, p.x - r);
    b.maxX = Math.max(b.maxX, p.x + r);
    b.minY = Math.min(b.minY, p.y - r);
    b.maxY = Math.max(b.maxY, p.y + r);
  };
  for (const sh of shapes(s)) {
    if (sh.kind === 'circle') grow(sh.c, sh.r);
    else if (sh.kind === 'line') sh.pts.forEach((p) => grow(p, sh.width / 2));
    else {
      // квадратичная кривая: несколько точек вдоль неё
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const p = {
          x: (1 - u) * (1 - u) * sh.from.x + 2 * (1 - u) * u * sh.ctrl.x + u * u * sh.to.x,
          y: (1 - u) * (1 - u) * sh.from.y + 2 * (1 - u) * u * sh.ctrl.y + u * u * sh.to.y,
        };
        grow(p, sh.width / 2);
      }
    }
  }
  return b;
}

/** Насколько точка опоры выше пола (0 — касается). Для тестов и галереи. */
export function contactGap(s: Solved, c: Contact): number {
  const tr = torsoR(s.view);
  const low = (...pts: Array<Vec | undefined>) => Math.min(...pts.filter((p): p is Vec => !!p).map((p) => p.y)) - LIMB_R;
  const i = Number(c.slice(-1)) as 0 | 1;
  const arm = s.arms[i];
  const leg = s.legs[i];
  if (c.startsWith('hand')) return low(arm.end);
  if (c.startsWith('forearm')) return low(arm.mid, arm.end);
  if (c.startsWith('foot')) return low(leg.end, leg.toe);
  if (c.startsWith('knee')) return low(leg.mid);
  if (c.startsWith('shin')) return low(leg.mid, leg.end);
  if (c === 'hip') return s.hip.y - tr;
  if (c === 'shoulder') return s.shoulder.y - tr;
  if (c === 'head') return s.head.y - BODY.head;
  // back — самая низкая точка корпуса
  const t = torsoCurve(s);
  let m = Infinity;
  for (let k = 0; k <= 8; k++) {
    const u = k / 8;
    m = Math.min(m, (1 - u) * (1 - u) * t.from.y + 2 * (1 - u) * u * t.ctrl.y + u * u * t.to.y);
  }
  return m - tr;
}

/** SVG-путь для формы — общий для компонента и для генерации иконки. */
export function shapePath(sh: Exclude<Shape, { kind: 'circle' }>, X: (v: Vec) => string): string {
  if (sh.kind === 'line') return 'M' + sh.pts.map(X).join('L');
  return `M${X(sh.from)}Q${X(sh.ctrl)} ${X(sh.to)}`;
}

/** Рамка рисунка: пол внизу, фигурка по центру; если не влезает — уменьшается целиком. */
export const FRAME = { w: 160, h: 112, floor: 104, pad: 4 } as const;

export interface Placement {
  /** перевод точки фигурки в координаты SVG */
  P: (v: Vec) => [number, number];
  /** то же строкой «x y» — для путей */
  X: (v: Vec) => string;
  scale: number;
  /** по горизонтали: где фигурка начинается и кончается (для коврика) */
  left: number;
  right: number;
}

export function place(s: Solved): Placement {
  const b = bounds(s);
  const top = s.view === 'top';
  const availW = FRAME.w - FRAME.pad * 2;
  const availH = (top ? FRAME.h : FRAME.floor) - FRAME.pad * 2;
  const scale = Math.min(1, availW / (b.maxX - b.minX), availH / (b.maxY - b.minY));
  const cx = (b.minX + b.maxX) / 2;
  const baseY = top ? FRAME.h / 2 + ((b.minY + b.maxY) / 2) * scale : FRAME.floor;
  const r = (n: number) => Math.round(n * 10) / 10;
  const P = (v: Vec): [number, number] => [r(FRAME.w / 2 + (v.x - cx) * scale), r(baseY - v.y * scale)];
  return {
    P,
    X: (v) => P(v).join(' '),
    scale,
    left: FRAME.w / 2 + (b.minX - cx) * scale,
    right: FRAME.w / 2 + (b.maxX - cx) * scale,
  };
}
