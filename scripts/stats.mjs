// 每个作品拼出来的统计：零件数、是否连成一块、重心、步数、悬空组件
// node scripts/stats.mjs [works/xxx.json ...]
import { readFile, readdir } from 'node:fs/promises';
import { buildModel } from '../src/core/instructions.js';
import { components } from '../src/core/tiler.js';

const root = new URL('..', import.meta.url).pathname;
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(`${root}works`)).filter((f) => f.endsWith('.json')).map((f) => `${root}works/${f}`);
for (const f of files) {
  const m = buildModel(JSON.parse(await readFile(f, 'utf8')));
  const [w, d, h] = m.size.cm.map((v) => v.toFixed(1));
  console.log(
    `${m.work.id}: ${m.bricks.length} 块, ${m.bom.length} 种, ${w}×${d}×${h}cm, 连通 ${m.componentCount === 1 ? '✓' : `✗ ${m.componentCount}`}, 重心 ${m.balance.inside ? '✓' : '✗'}, ${m.steps.length} 步, 悬空 ${m.steps.filter((s) => s.kind === 'sub').length}`,
  );
  for (const c of components(m.bricks).slice(1))
    console.log('  孤立:', c.map((i) => { const b = m.bricks[i]; return `y${b.y} x${b.x} z${b.z} ${b.w}x${b.d} ${b.color}`; }).join(' | '));
}
