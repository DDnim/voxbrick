// 作品 → 拼装数据：砖块列表、零件表、拼装步骤、结构检查。
import { COLORS, PARTS, PART_BY_ID, STUD_MM, UNITS } from './catalog.js';
import { workToGrid } from './work.js';
import { tile, components } from './tiler.js';

export const MAX_BRICKS_PER_STEP = 16;
const COLOR_ORDER = Object.keys(COLORS);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

export const sectionOf = (work, y) => (work.sections ?? []).find((s) => y >= s.from && y <= s.to)?.name ?? '';

export function buildModel(work) {
  const grid = workToGrid(work);
  const unit = UNITS[work.unit];
  const { bricks, connected } = tile(grid, { seed: work.seed ?? 1, parts: unit.parts });
  bricks.forEach((b, i) => (b.id = i));
  const b = grid.bounds();
  return {
    work,
    grid,
    bricks,
    connected,
    componentCount: components(bricks).length,
    bounds: b,
    layerHeight: unit.height,
    size: {
      studs: [b.x1 - b.x0, b.z1 - b.z0],
      layers: b.y1 - b.y0,
      cm: [((b.x1 - b.x0) * STUD_MM) / 10, ((b.z1 - b.z0) * STUD_MM) / 10, ((b.y1 - b.y0) * unit.height * STUD_MM) / 10],
    },
    balance: balance(bricks),
    bom: billOfMaterials(bricks),
    steps: buildSteps(bricks, (y) => sectionOf(work, y)),
  };
}

// 零件表：按颜色、再按尺寸从大到小
export function billOfMaterials(bricks) {
  const rows = new Map();
  for (const b of bricks) {
    const k = `${b.part}|${b.color}`;
    if (!rows.has(k)) rows.set(k, { part: b.part, color: b.color, count: 0 });
    rows.get(k).count++;
  }
  return [...rows.values()].sort(
    (a, b) =>
      COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) ||
      PART_BY_ID[b.part].area - PART_BY_ID[a.part].area ||
      PART_BY_ID[b.part].d - PART_BY_ID[a.part].d,
  );
}

// 拼装顺序：从下往上一层一层。
// 下面没有已拼好的砖托着的（比如垂下来的手臂），先攒着，等上面那层把它“挂住”时作为一个小组件单独拼好再装上去。
export function buildSteps(bricks, sectionOf = () => '', maxPerStep = MAX_BRICKS_PER_STEP) {
  const byLayer = new Map();
  for (const b of bricks) {
    if (!byLayer.has(b.y)) byLayer.set(b.y, []);
    byLayer.get(b.y).push(b);
  }
  const ys = [...byLayer.keys()].sort((a, b) => a - b);
  const placed = new Set();
  let pending = [];
  const steps = [];

  for (const y of ys) {
    const layer = byLayer.get(y);
    const supported = layer.filter(
      (b) => y === ys[0] || bricks.some((p) => p.y === y - 1 && placed.has(p.id) && overlaps(p, b)),
    );
    pending.push(...layer.filter((b) => !supported.includes(b)));

    // 从后往前、从左往右，大致均分成几步
    const ordered = [...supported].sort((a, b) => a.z - b.z || a.x - b.x);
    const chunks = Math.ceil(ordered.length / maxPerStep);
    const per = Math.ceil(ordered.length / chunks);
    for (let i = 0; i < chunks; i++) {
      const ids = ordered.slice(i * per, (i + 1) * per).map((b) => b.id);
      ids.forEach((id) => placed.add(id));
      steps.push({ kind: 'layer', y, part: i + 1, parts: chunks, section: sectionOf(y), bricks: ids });
    }

    // 刚放上的这一层能挂住的悬空组件：一个或几个，合成一步“从下面扣上去”
    const hooked = [];
    for (;;) {
      const hook = pending.find((p) => bricks.some((b) => b.y === p.y + 1 && placed.has(b.id) && overlaps(b, p)));
      if (!hook) break;
      const group = new Set([hook]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const p of pending)
          if (!group.has(p) && [...group].some((g) => Math.abs(g.y - p.y) === 1 && overlaps(g, p))) {
            group.add(p);
            grew = true;
          }
      }
      group.forEach((b) => placed.add(b.id));
      pending = pending.filter((p) => !group.has(p));
      hooked.push([...group].sort((a, b) => b.y - a.y || a.z - b.z || a.x - b.x).map((b) => b.id));
    }
    if (hooked.length)
      steps.push({ kind: 'sub', y, section: sectionOf(y - 1), groups: hooked, bricks: hooked.flat() });
  }
  steps.forEach((s, i) => {
    s.index = i;
    s.bom = billOfMaterials(s.bricks.map((id) => bricks[id]));
  });
  return steps;
}

// 重心是否落在脚底（第 0 层）的凸包里。每块砖的重量按凸点数算。
export function balance(bricks) {
  let m = 0;
  let mx = 0;
  let mz = 0;
  for (const b of bricks) {
    const a = b.w * b.d;
    m += a;
    mx += a * (b.x + b.w / 2);
    mz += a * (b.z + b.d / 2);
  }
  const com = { x: mx / m, z: mz / m };
  const pts = bricks
    .filter((b) => b.y === 0)
    .flatMap((b) => [
      [b.x, b.z],
      [b.x + b.w, b.z],
      [b.x, b.z + b.d],
      [b.x + b.w, b.z + b.d],
    ]);
  const hull = convexHull(pts);
  return { com, hull, inside: insideConvex(hull, [com.x, com.z]) };
}

function convexHull(points) {
  const p = [...new Map(points.map((q) => [q.join(), q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function insideConvex(hull, [x, z]) {
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    if ((bx - ax) * (z - az) - (bz - az) * (x - ax) < 0) return false;
  }
  return true;
}

export { COLORS, PARTS, PART_BY_ID };
