// 把 works-src/*.js 里用代码画的作品导出成 works/<id>.json。
// node scripts/gen-works.mjs            → 全部重新生成
// node scripts/gen-works.mjs snowman    → 只生成一个
import { readdir, writeFile } from 'node:fs/promises';
import { gridToWork, stringifyWork, validateWork } from '../src/core/work.js';

const root = new URL('..', import.meta.url).pathname;
const only = process.argv[2];
for (const file of (await readdir(`${root}works-src`)).filter((f) => f.endsWith('.js')).sort()) {
  if (only && file !== `${only}.js`) continue;
  const { meta, build } = await import(`${root}works-src/${file}`);
  const work = gridToWork(build(), meta);
  const errors = validateWork(work);
  if (errors.length) {
    console.error(`${file}:\n  ${errors.join('\n  ')}`);
    process.exitCode = 1;
    continue;
  }
  await writeFile(`${root}works/${work.id}.json`, stringifyWork(work));
  console.log(`works/${work.id}.json  ${work.layers[0][0].length}×${work.layers[0].length}×${work.layers.length}`);
}
