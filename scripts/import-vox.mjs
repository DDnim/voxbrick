// MagicaVoxel .vox → works/<id>.json
// node scripts/import-vox.mjs my-cat.vox --id my-cat --title 我的猫 --author 名字 [--unit brick|plate] [--license CC-BY-4.0]
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readVox } from '../src/core/vox.js';
import { gridToWork, stringifyWork, validateWork } from '../src/core/work.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    title: { type: 'string' },
    author: { type: 'string' },
    description: { type: 'string', default: '' },
    unit: { type: 'string', default: 'brick' },
    license: { type: 'string', default: 'CC-BY-4.0' },
    out: { type: 'string' },
  },
});
const [file] = positionals;
if (!file || !values.id || !values.title || !values.author) {
  console.error('用法: node scripts/import-vox.mjs <文件.vox> --id <id> --title <标题> --author <作者> [--unit brick|plate] [--description ...] [--license CC-BY-4.0]');
  process.exit(1);
}
const work = gridToWork(readVox(await readFile(file)), {
  id: values.id,
  title: values.title,
  description: values.description || `${values.title}（从 MagicaVoxel 导入）`,
  author: { name: values.author },
  license: values.license,
  unit: values.unit,
});
const errors = validateWork(work);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const out = values.out ?? new URL(`../works/${work.id}.json`, import.meta.url).pathname;
await writeFile(out, stringifyWork(work));
console.log(`wrote ${out}  ${work.layers[0][0].length}×${work.layers[0].length}×${work.layers.length}，颜色：${Object.values(work.palette).join(' ')}`);
