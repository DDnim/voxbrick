// 把体素模型拆成标准砖。
// 每层独立铺砖：大砖优先，和下一层错缝。
// 上下没有“实心柱”支撑的格子（帽檐外圈、发梢、耳朵）先铺，只用能伸进有支撑区域的砖。
// 铺完后检查所有砖是否连成一体，不连通时把孤立的砖和同层邻居合起来重铺。
import { PARTS, BRICKS } from './catalog.js';

// 零件的两种摆放方向，大的在前
const orientsOf = (parts) =>
  parts
    .flatMap((p) =>
      p.w === p.d ? [{ part: p.id, w: p.w, d: p.d }] : [{ part: p.id, w: p.w, d: p.d }, { part: p.id, w: p.d, d: p.w }],
    )
    .sort((a, b) => b.w * b.d - a.w * a.d);
const AREA = Object.fromEntries(PARTS.map((p) => [p.id, p.area]));

// 竖直方向连续 ≥ 3 格的柱子才算可靠的支撑（两格高的发梢+帽檐互相撑着不算）
const STRONG_RUN = 3;

const ck = (x, z) => `${x},${z}`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function* rectCells(x0, z0, w, d) {
  for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) yield [x, z];
}

// 一块砖的颜色：看得见的格子必须同色；全部看不见时用这些格子原本设计的颜色里最多的那个。
function brickColor(layer, x0, z0, w, d) {
  let color = null;
  const hiddenVotes = new Map();
  for (const [x, z] of rectCells(x0, z0, w, d)) {
    const c = layer.get(ck(x, z));
    if (!c) return undefined;
    if (c.hidden) hiddenVotes.set(c.color, (hiddenVotes.get(c.color) ?? 0) + 1);
    else if (color === null) color = c.color;
    else if (color !== c.color) return undefined;
  }
  if (color !== null) return color;
  return [...hiddenVotes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
}

function layerCells(grid) {
  const runLen = new Map();
  const columns = new Map();
  for (const c of grid.cells.values()) {
    const k = ck(c.x, c.z);
    if (!columns.has(k)) columns.set(k, []);
    columns.get(k).push(c.y);
  }
  for (const [k, ys] of columns) {
    ys.sort((a, b) => a - b);
    for (let i = 0; i < ys.length; ) {
      let j = i;
      while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
      for (let t = i; t <= j; t++) runLen.set(`${k},${ys[t]}`, j - i + 1);
      i = j + 1;
    }
  }
  const layers = new Map();
  for (const c of grid.cells.values()) {
    if (!layers.has(c.y)) layers.set(c.y, new Map());
    layers.get(c.y).set(ck(c.x, c.z), {
      x: c.x,
      z: c.z,
      color: c.color,
      hidden: grid.isHidden(c.x, c.y, c.z),
      onTop: grid.has(c.x, c.y - 1, c.z),
      strong: runLen.get(`${c.x},${c.z},${c.y}`) >= STRONG_RUN,
    });
  }
  return layers;
}

function tileLayer(y, layer, below, rng, noise, ORIENTS) {
  const candidates = [];
  const covering = new Map([...layer.keys()].map((k) => [k, []]));
  for (const cell of layer.values()) {
    for (const o of ORIENTS) {
      const color = brickColor(layer, cell.x, cell.z, o.w, o.d);
      if (color === undefined) continue;
      let attached = false;
      let grounded = y === 0;
      let weak = 0;
      const belowIds = new Set();
      for (const [x, z] of rectCells(cell.x, cell.z, o.w, o.d)) {
        const cc = layer.get(ck(x, z));
        if (cc.strong) attached = true;
        else weak++;
        if (cc.onTop) grounded = true;
        const b = below?.cells.get(ck(x, z));
        if (b !== undefined) belowIds.add(b);
      }
      let score = AREA[o.part] * 10 + weak * 6;
      // 下面有东西托着的砖可以直接按上去；整块悬空的只能等上一层放好后从下面挂，尽量少
      if (!grounded) score -= 30;
      // 同时压住下层几块砖 = 把它们连起来（错缝）
      score += Math.max(0, belowIds.size - 1) * 4;
      // 和下面那块砖一模一样的位置叠上去，不咬合
      if (belowIds.size === 1 && below.area.get([...belowIds][0]) === o.w * o.d) score -= 15;
      // 奇偶层长边方向交替
      if (o.w !== o.d && (o.w > o.d) === (y % 2 === 0)) score += 2;
      score += rng() * noise;
      const c = { x: cell.x, z: cell.z, w: o.w, d: o.d, part: o.part, color, score, attached, grounded };
      candidates.push(c);
      for (const [x, z] of rectCells(cell.x, cell.z, o.w, o.d)) covering.get(ck(x, z)).push(c);
    }
  }
  for (const list of covering.values()) list.sort((a, b) => b.score - a.score);
  candidates.sort((a, b) => b.score - a.score);

  const taken = new Set();
  const bricks = [];
  const isFree = (c) => {
    for (const [x, z] of rectCells(c.x, c.z, c.w, c.d)) if (taken.has(ck(x, z))) return false;
    return true;
  };
  const place = (c) => {
    for (const [x, z] of rectCells(c.x, c.z, c.w, c.d)) taken.add(ck(x, z));
    bricks.push({ x: c.x, y, z: c.z, w: c.w, d: c.d, part: c.part, color: c.color });
  };

  // 弱格先铺：回溯搜索，让每个弱格都被一块够得着支撑的砖盖住（约束满足问题）。
  // 每次挑剩余选择最少的弱格，放下后若有弱格无砖可用立刻退回。
  // 先按得分（大砖优先）试；找不到解再改成小砖先试——刚好够到支撑就行，不去占邻居需要的格子。
  const byScore = (a, b) => b.score - a.score;
  const bySize = (a, b) => a.w * a.d - b.w * b.d || b.score - a.score;
  let order = byScore;
  const optionsOf = (k) =>
    covering
      .get(k)
      .filter((c) => c.attached && isFree(c))
      .sort(order);
  // 一开始就没有任何可选砖的弱格（比如草鞋带，靠鞋底连着）不参与搜索
  const weak = [...layer.values()]
    .filter((c) => !c.strong && optionsOf(ck(c.x, c.z)).length > 0)
    .map((c) => ck(c.x, c.z));
  const unplace = (c) => {
    for (const [x, z] of rectCells(c.x, c.z, c.w, c.d)) taken.delete(ck(x, z));
    bricks.pop();
  };
  let budget = 0;
  const search = () => {
    if (--budget < 0) return false;
    let pick = null;
    for (const k of weak) {
      if (taken.has(k)) continue;
      const options = optionsOf(k);
      if (options.length === 0) return false;
      if (!pick || options.length < pick.length) pick = options;
    }
    if (!pick) return true;
    for (const option of pick) {
      place(option);
      if (search()) return true;
      unplace(option);
      if (budget < 0) return false;
    }
    return false;
  };
  let solved = false;
  for (const [o, b] of [[byScore, 3000], [bySize, 20000]]) {
    order = o;
    budget = b;
    if ((solved = search())) break;
    while (bricks.length) unplace(bricks[bricks.length - 1]);
  }
  if (!solved) {
    // 找不到完整解（或超出预算）：退回贪心，剩下的交给 repair
    while (bricks.length) unplace(bricks[bricks.length - 1]);
    for (const k of weak) {
      if (taken.has(k)) continue;
      const [best] = optionsOf(k);
      if (best) place(best);
    }
  }
  // 下面悬空的格子（脸往外扩的一圈、短裤卷边）：尽量用压着下层的砖盖住，这样拼的时候可以直接按上去。
  // 做不到的不强求（手臂最下面的拳头只能从上面挂）。每次挑选择最少的格子，选不会让别的格子无砖可用的那块。
  if (y > 0) {
    const overhang = [...layer.values()].filter((c) => !c.onTop).map((c) => ck(c.x, c.z));
    const groundedOptions = (k) =>
      covering
        .get(k)
        .filter((c) => c.grounded && (c.attached || layer.get(k).strong) && isFree(c));
    for (;;) {
      let pick = null;
      for (const k of overhang) {
        if (taken.has(k)) continue;
        const options = groundedOptions(k);
        if (options.length && (!pick || options.length < pick.length)) pick = options;
      }
      if (!pick) break;
      const alive = overhang.filter((k) => !taken.has(k) && groundedOptions(k).length > 0);
      let best = null;
      for (const option of pick) {
        const cells = [...rectCells(option.x, option.z, option.w, option.d)].map(([x, z]) => ck(x, z));
        cells.forEach((k) => taken.add(k));
        const killed = alive.filter((k) => !taken.has(k) && groundedOptions(k).length === 0).length;
        cells.forEach((k) => taken.delete(k));
        if (!best || killed < best.killed) best = { option, killed };
        if (killed === 0) break;
      }
      place(best.option);
    }
  }
  for (const c of candidates) if (isFree(c)) place(c);
  return bricks;
}

// 砖之间的连接：上下相邻层且俯视有重叠。x、z 在 0..63 内，y 不限。
const cellIndex = (x, y, z) => (y * 64 + x) * 64 + z;
let owner = new Int32Array(0);

export function components(bricks) {
  const parent = bricks.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const size = (Math.max(0, ...bricks.map((b) => b.y)) + 2) * 64 * 64;
  if (owner.length < size) owner = new Int32Array(size);
  owner.fill(-1);
  bricks.forEach((b, i) => {
    for (const [x, z] of rectCells(b.x, b.z, b.w, b.d)) owner[cellIndex(x, b.y, z)] = i;
  });
  bricks.forEach((b, i) => {
    for (const [x, z] of rectCells(b.x, b.z, b.w, b.d)) {
      const j = owner[cellIndex(x, b.y + 1, z)];
      if (j >= 0) parent[find(i)] = find(j);
    }
  });
  const groups = new Map();
  bricks.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

// 在一片小区域里穷举铺法（大砖先试），最多返回 limit 种
function enumerateTilings(layer, cells, y, limit, ORIENTS) {
  const cellSet = new Set(cells.map(([x, z]) => ck(x, z)));
  const order = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const results = [];
  const taken = new Set();
  const cur = [];
  const rec = () => {
    if (results.length >= limit) return;
    const next = order.find(([x, z]) => !taken.has(ck(x, z)));
    if (!next) {
      results.push([...cur]);
      return;
    }
    // next 是按行扫描时第一个空格，所以它一定是新砖的左上角
    const [x0, z0] = next;
    for (const o of ORIENTS) {
      let ok = true;
      for (const [x, z] of rectCells(x0, z0, o.w, o.d))
        if (!cellSet.has(ck(x, z)) || taken.has(ck(x, z))) {
          ok = false;
          break;
        }
      if (!ok) continue;
      const color = brickColor(layer, x0, z0, o.w, o.d);
      if (color === undefined) continue;
      for (const [x, z] of rectCells(x0, z0, o.w, o.d)) taken.add(ck(x, z));
      cur.push({ x: x0, y, z: z0, w: o.w, d: o.d, part: o.part, color });
      rec();
      cur.pop();
      for (const [x, z] of rectCells(x0, z0, o.w, o.d)) taken.delete(ck(x, z));
    }
  };
  rec();
  return results;
}

const touches = (a, b) =>
  a.y === b.y &&
  (((a.x + a.w === b.x || b.x + b.w === a.x) && a.z < b.z + b.d && b.z < a.z + a.d) ||
    ((a.z + a.d === b.z || b.z + b.d === a.z) && a.x < b.x + b.w && b.x < a.x + a.w));

// 孤立的砖：和同层相邻的砖（1 块或 2 块）合起来穷举重铺，找到能减少连通块数的铺法就换上
function repair(bricks, layers, ORIENTS, maxRounds = 100) {
  for (let round = 0; round < maxRounds; round++) {
    const comps = components(bricks);
    if (comps.length === 1) return true;
    const compOf = new Map();
    comps.forEach((c, ci) => c.forEach((i) => compOf.set(i, ci)));
    const tryRegion = (ids) => {
      const y = bricks[ids[0]].y;
      const cells = ids.flatMap((i) => [...rectCells(bricks[i].x, bricks[i].z, bricks[i].w, bricks[i].d)]);
      if (cells.length > 28) return false;
      let best = null;
      for (const tiling of enumerateTilings(layers.get(y), cells, y, 300, ORIENTS)) {
        const trial = bricks.filter((_, k) => !ids.includes(k)).concat(tiling);
        const n = components(trial).length;
        if (n < comps.length && (!best || n < best.n || (n === best.n && tiling.length < best.len)))
          best = { n, len: tiling.length, trial };
      }
      if (!best) return false;
      bricks.splice(0, bricks.length, ...best.trial);
      return true;
    };
    let fixed = false;
    outer: for (const small of comps.slice(1).reverse()) {
      for (const i of small) {
        const nbrs = bricks.map((_, j) => j).filter((j) => j !== i && touches(bricks[i], bricks[j]));
        const foreign = nbrs.filter((j) => compOf.get(j) !== compOf.get(i));
        for (const j of foreign)
          if (tryRegion([i, j])) {
            fixed = true;
            break outer;
          }
        for (const j of foreign)
          for (const k of nbrs)
            if (k !== j && tryRegion([i, j, k])) {
              fixed = true;
              break outer;
            }
      }
    }
    if (!fixed) return false;
  }
  return components(bricks).length === 1;
}

export function tile(grid, { seed = 7, noise = 3, repair: doRepair = true, parts = BRICKS } = {}) {
  const ORIENTS = orientsOf(parts);
  const rng = mulberry32(seed);
  const layers = layerCells(grid);
  const ys = [...layers.keys()].sort((a, b) => a - b);
  const bricks = [];
  let below = null;
  for (const y of ys) {
    const layerBricks = tileLayer(y, layers.get(y), below, rng, noise, ORIENTS);
    below = { cells: new Map(), area: new Map() };
    layerBricks.forEach((b) => {
      const id = bricks.length;
      bricks.push(b);
      below.area.set(id, b.w * b.d);
      for (const [x, z] of rectCells(b.x, b.z, b.w, b.d)) below.cells.set(ck(x, z), id);
    });
  }
  const connected = doRepair ? repair(bricks, layers, ORIENTS) : components(bricks).length === 1;
  bricks.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return { bricks, connected };
}
