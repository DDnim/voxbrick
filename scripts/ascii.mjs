// 调试造型用：打印作品的正视图 / 侧视图 / 某一层的俯视图（用作品自己的 palette 字符）
// node scripts/ascii.mjs works/snowman.json [front|side|<层号>]
import { readFile } from 'node:fs/promises';
import { workToGrid } from '../src/core/work.js';

const work = JSON.parse(await readFile(process.argv[2], 'utf8'));
const g = workToGrid(work);
const b = g.bounds();
const ch = Object.fromEntries(Object.entries(work.palette).map(([k, v]) => [v, k]));
const view = process.argv[3] ?? 'front';
if (view === 'front' || view === 'side') {
  for (let y = b.y1 - 1; y >= b.y0; y--) {
    let line = String(y).padStart(3) + ' ';
    const [u0, u1] = view === 'front' ? [b.x0, b.x1] : [b.z0, b.z1];
    for (let u = u0; u < u1; u++) {
      let best = null;
      for (let v = 63; v >= 0 && !best; v--) best = view === 'front' ? g.get(u, y, v) : g.get(63 - v, y, u);
      line += best ? ch[best.color] : '.';
    }
    console.log(line);
  }
} else console.log(work.layers[+view].join('\n'));
