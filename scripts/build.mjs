// 打包成一个独立的 HTML（JS、CSS、works/*.json 全部内联），双击就能打开，不需要服务器。
// node scripts/build.mjs          → dist/voxbrick.html
// node scripts/build.mjs --watch  → 改代码或作品自动重新打包
import * as esbuild from 'esbuild';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const out = `${root}dist/voxbrick.html`;

// import WORKS from 'virtual:works' → works/ 下所有作品，按标题排序
const works = {
  name: 'works',
  setup(build) {
    build.onResolve({ filter: /^virtual:works$/ }, () => ({ path: 'works', namespace: 'works' }));
    build.onLoad({ filter: /.*/, namespace: 'works' }, async () => {
      const files = (await readdir(`${root}works`)).filter((f) => f.endsWith('.json')).sort();
      const list = await Promise.all(files.map(async (f) => JSON.parse(await readFile(`${root}works/${f}`, 'utf8'))));
      list.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
      return { contents: `export default ${JSON.stringify(list)};`, loader: 'js', watchDirs: [`${root}works`] };
    });
  },
};

const inline = {
  name: 'inline-html',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
      const css = await readFile(`${root}src/web/style.css`, 'utf8');
      const html = (await readFile(`${root}src/web/index.html`, 'utf8'))
        .replace('<!-- STYLE -->', () => `<style>\n${css}</style>`)
        .replace('<!-- SCRIPT -->', () => `<script>\n${js.replaceAll('</script', '<\\/script')}</script>`);
      await mkdir(`${root}dist`, { recursive: true });
      await writeFile(out, html);
      console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
    });
  },
};

const options = {
  entryPoints: [`${root}src/web/app.js`],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  write: false,
  outdir: `${root}dist`,
  plugins: [works, inline],
  legalComments: 'none',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ and works/ …');
} else {
  await esbuild.build(options);
}
