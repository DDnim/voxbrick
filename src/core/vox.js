// MagicaVoxel .vox 文件的导入和导出（只处理文件里的第一个模型）。
// 坐标对应：vox 的 x → 本项目 x；vox 的 z（朝上）→ 层 y；vox 的 y → z 反过来，
// 也就是 vox 里 y=0 那一面是作品的正面。
// 颜色：每个 vox 颜色换成颜色目录里最接近的那个。
import { VoxelGrid } from './voxels.js';
import { COLORS } from './catalog.js';

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// 按人眼对红绿蓝的敏感度加权的距离，比直接算 RGB 距离更接近“看起来像不像”
function nearestColor([r, g, b]) {
  let best = null;
  for (const [id, c] of Object.entries(COLORS)) {
    const [r2, g2, b2] = hexToRgb(c.hex);
    const rm = (r + r2) / 2;
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2;
    if (!best || d < best.d) best = { id, d };
  }
  return best.id;
}

function* chunks(view, start, end) {
  let p = start;
  while (p + 12 <= end) {
    const id = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + p, 4));
    const content = view.getUint32(p + 4, true);
    const children = view.getUint32(p + 8, true);
    yield { id, offset: p + 12, content, children };
    p += 12 + content + children;
  }
}

// ArrayBuffer / Uint8Array → VoxelGrid
export function readVox(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  if (magic !== 'VOX ') throw new Error('不是 MagicaVoxel 的 .vox 文件');
  const [main] = chunks(view, 8, bytes.length);
  if (!main || main.id !== 'MAIN') throw new Error('.vox 文件里没有 MAIN 块');
  let size = null;
  let voxels = null;
  let rgba = null;
  for (const c of chunks(view, main.offset + main.content, main.offset + main.content + main.children)) {
    if (c.id === 'SIZE' && !size) size = [0, 4, 8].map((k) => view.getUint32(c.offset + k, true));
    if (c.id === 'XYZI' && !voxels) {
      const n = view.getUint32(c.offset, true);
      voxels = [];
      for (let i = 0; i < n; i++) voxels.push([...bytes.slice(c.offset + 4 + i * 4, c.offset + 8 + i * 4)]);
    }
    if (c.id === 'RGBA') rgba = bytes.slice(c.offset, c.offset + 1024);
  }
  if (!size || !voxels) throw new Error('.vox 文件里没有模型');
  if (!rgba) throw new Error('.vox 文件里没有调色板（RGBA 块），请用 MagicaVoxel 重新保存一次');
  const colorOf = new Map();
  const g = new VoxelGrid();
  for (const [x, y, z, i] of voxels) {
    if (!colorOf.has(i)) colorOf.set(i, nearestColor([...rgba.slice((i - 1) * 4, (i - 1) * 4 + 3)]));
    g.set(x, z, size[1] - 1 - y, colorOf.get(i));
  }
  return g;
}

// VoxelGrid → Uint8Array（.vox 文件内容）
export function writeVox(grid) {
  const b = grid.bounds();
  const size = [b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0];
  if (size.some((s) => s > 256)) throw new Error('.vox 每个方向最多 256 格');
  const colorIds = [...new Set([...grid.cells.values()].map((c) => c.color))];
  const index = new Map(colorIds.map((id, i) => [id, i + 1]));

  const cells = [...grid.cells.values()];
  const sizeChunk = chunk('SIZE', u32(...size));
  const xyzi = new Uint8Array(4 + cells.length * 4);
  new DataView(xyzi.buffer).setUint32(0, cells.length, true);
  cells.forEach((c, i) => xyzi.set([c.x - b.x0, size[1] - 1 - (c.z - b.z0), c.y - b.y0, index.get(c.color)], 4 + i * 4));
  const rgba = new Uint8Array(1024);
  colorIds.forEach((id, i) => rgba.set([...hexToRgb(COLORS[id].hex), 255], i * 4));
  const children = concat(sizeChunk, chunk('XYZI', xyzi), chunk('RGBA', rgba));
  return concat(new TextEncoder().encode('VOX '), u32(150), chunk('MAIN', new Uint8Array(0), children));
}

function u32(...values) {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v, true));
  return out;
}

function chunk(id, content, children = new Uint8Array(0)) {
  return concat(new TextEncoder().encode(id), u32(content.length, children.length), content, children);
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
