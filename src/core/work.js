// 作品文件（works/<id>.json）的读写和检查。格式说明见 docs/work-format.md。
//
// layers[y][z] 是一行字符串，第 x 个字符是 (x, y, z) 这一格：
//   y = 层（0 是最底层），z = 从后往前（最后一行是正面），x = 从左往右（面对作品时）。
//   '.' 是空格，其他字符在 palette 里查颜色。
import { VoxelGrid } from './voxels.js';
import { COLORS, UNITS } from './catalog.js';

export const FORMAT = 1;
export const MAX_FOOTPRINT = 64; // 拼砖程序的 x、z 上限

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 返回错误列表（空数组 = 没问题）
export function validateWork(work) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!work || typeof work !== 'object') return ['作品不是一个 JSON 对象'];
  if (work.format !== FORMAT) err(`format 必须是 ${FORMAT}`);
  if (typeof work.id !== 'string' || !ID_RE.test(work.id)) err('id 只能用小写字母、数字和 -，比如 lucky-cat');
  for (const k of ['title', 'description', 'license'])
    if (typeof work[k] !== 'string' || !work[k].trim()) err(`缺少 ${k}`);
  if (!work.author || typeof work.author.name !== 'string' || !work.author.name.trim()) err('缺少 author.name');
  if (!(work.unit in UNITS)) err(`unit 只能是 ${Object.keys(UNITS).join(' / ')}`);
  if (work.seed !== undefined && !Number.isInteger(work.seed)) err('seed 必须是整数');

  const palette = work.palette ?? {};
  for (const [ch, color] of Object.entries(palette)) {
    if ([...ch].length !== 1 || ch === '.' || ch.trim() === '') err(`palette 的键 "${ch}" 必须是一个非空白字符，且不能是 "."`);
    if (!(color in COLORS)) err(`palette "${ch}" 的颜色 ${color} 不在颜色目录里（src/core/catalog.js）`);
  }

  if (!Array.isArray(work.layers) || work.layers.length === 0) {
    err('layers 必须是非空数组');
    return errors;
  }
  // 以出现最多的行数、行宽为准，这样出错的那一行会被指出来，而不是其他行全报错
  const mode = (values) => {
    const n = new Map();
    for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  };
  const depth = mode(work.layers.map((l) => (Array.isArray(l) ? l.length : 0)));
  const width = mode(work.layers.flatMap((l) => (Array.isArray(l) ? l.map((r) => (typeof r === 'string' ? [...r].length : 0)) : [])));
  if (width > MAX_FOOTPRINT || depth > MAX_FOOTPRINT) err(`占地最大 ${MAX_FOOTPRINT}×${MAX_FOOTPRINT}，现在是 ${width}×${depth}`);
  let filled = 0;
  work.layers.forEach((layer, y) => {
    if (!Array.isArray(layer) || layer.length !== depth) return err(`第 ${y} 层应该有 ${depth} 行`);
    layer.forEach((row, z) => {
      if (typeof row !== 'string' || [...row].length !== width) return err(`第 ${y} 层第 ${z} 行应该有 ${width} 个字符`);
      for (const ch of row) {
        if (ch === '.') continue;
        filled++;
        if (!(ch in palette)) err(`第 ${y} 层第 ${z} 行的字符 "${ch}" 不在 palette 里`);
      }
    });
  });
  if (filled === 0) err('作品里一格都没有');

  for (const s of work.sections ?? [])
    if (!Number.isInteger(s.from) || !Number.isInteger(s.to) || s.from > s.to || typeof s.name !== 'string')
      err(`sections 里的 ${JSON.stringify(s)} 格式不对（需要 from ≤ to 和 name）`);
  // 去重，一种错误只报前几次
  return [...new Set(errors)].slice(0, 30);
}

export function workToGrid(work) {
  const g = new VoxelGrid();
  work.layers.forEach((layer, y) =>
    layer.forEach((row, z) => [...row].forEach((ch, x) => ch !== '.' && g.set(x, y, z, work.palette[ch]))),
  );
  return g;
}

// 常用颜色的默认字符，读起来直观一些；其余颜色按顺序用剩下的字符
const DEFAULT_CHARS = {
  white: 'W',
  black: 'K',
  red: 'R',
  yellow: 'Y',
  blue: 'B',
  green: 'G',
  orange: 'O',
  brown: 'N',
  pink: 'P',
  tan: 'T',
  lightGray: 'l',
  darkGray: 'd',
  skin: 'S',
  gold: 'y',
  darkRed: 'r',
  lightBlue: 'b',
  darkBlue: 'u',
  darkGreen: 'g',
  purple: 'V',
};
const SPARE = 'ACDEFHIJLMQUXZacefhijkmnopqstvwxz0123456789#@%&*+=';

// VoxelGrid → 作品 JSON。坐标会平移到从 0 开始。
export function gridToWork(grid, meta) {
  const b = grid.bounds();
  const used = [...new Set([...grid.cells.values()].map((c) => c.color))];
  const palette = {};
  const charOf = {};
  const taken = new Set();
  for (const color of used) {
    let ch = DEFAULT_CHARS[color];
    if (!ch || taken.has(ch)) ch = [...SPARE].find((c) => !taken.has(c));
    taken.add(ch);
    palette[ch] = color;
    charOf[color] = ch;
  }
  const layers = [];
  for (let y = b.y0; y < b.y1; y++) {
    const rows = [];
    for (let z = b.z0; z < b.z1; z++) {
      let row = '';
      for (let x = b.x0; x < b.x1; x++) {
        const c = grid.get(x, y, z);
        row += c ? charOf[c.color] : '.';
      }
      rows.push(row);
    }
    layers.push(rows);
  }
  const sortedPalette = Object.fromEntries(Object.entries(palette).sort((a, c) => (a[0] < c[0] ? -1 : 1)));
  return { format: FORMAT, ...meta, palette: sortedPalette, layers };
}

// 固定键的顺序、每行一条字符串，方便在 PR 里看 diff
export function stringifyWork(work) {
  const { layers, sections, palette, ...head } = work;
  const order = ['format', 'id', 'title', 'description', 'author', 'license', 'unit', 'seed'];
  const meta = Object.fromEntries(
    [...order.filter((k) => k in head), ...Object.keys(head).filter((k) => !order.includes(k))].map((k) => [k, head[k]]),
  );
  const lines = Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  lines.push(`  "palette": ${JSON.stringify(palette)}`);
  if (sections?.length)
    lines.push(`  "sections": [\n${sections.map((s) => `    ${JSON.stringify(s)}`).join(',\n')}\n  ]`);
  lines.push(
    `  "layers": [\n${layers.map((rows) => `    [\n${rows.map((r) => `      ${JSON.stringify(r)}`).join(',\n')}\n    ]`).join(',\n')}\n  ]`,
  );
  return `{\n${lines.join(',\n')}\n}\n`;
}
