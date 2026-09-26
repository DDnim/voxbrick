// 把 works-src/*.js 里用代码画的作品导出成 works/<id>.json。
// node scripts/gen-works.mjs            → 全部重新生成
// node scripts/gen-works.mjs snowman    → 只生成一个
// node scripts/gen-works.mjs --local    → works-local/*.js → works-local/<id>.json（不进 Git 的本地作品）
import { readdir, writeFile } from 'node:fs/promises';
import { gridToWork, stringifyWork, validateWork } from '../src/core/work.js';

const root = new URL('..', import.meta.url).pathname;
const local = process.argv.includes('--local');
const [src, dst] = local ? ['works-local', 'works-local'] : ['works-src', 'works'];
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
for (const file of (await readdir(`${root}${src}`)).filter((f) => f.endsWith('.js')).sort()) {
  if (only && file !== `${only}.js`) continue;
  const { meta, build } = await import(`${root}${src}/${file}`);
  const work = gridToWork(build(), meta);
  const errors = validateWork(work);
  if (errors.length) {
    console.error(`${file}:\n  ${errors.join('\n  ')}`);
    process.exitCode = 1;
    continue;
  }
  await writeFile(`${root}${dst}/${work.id}.json`, stringifyWork(work));
  console.log(`${dst}/${work.id}.json  ${work.layers[0][0].length}×${work.layers[0].length}×${work.layers.length}`);
}
