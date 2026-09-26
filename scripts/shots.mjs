// 验证用：用本机 Chrome 无头模式打开页面，每个作品截几张图，并试一次 .vox 导入。
// node scripts/shots.mjs [输出目录] [作品 id ...]
import puppeteer from 'puppeteer-core';
import { readdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { workToGrid } from '../src/core/work.js';
import { writeVox } from '../src/core/vox.js';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? '/tmp/voxbrick';
const ids = process.argv.slice(3).length
  ? process.argv.slice(3)
  : (await readdir(`${root}works`)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', (d) => d.accept());
await page.setViewport({ width: 1440, height: 900 });
const url = (q) => new URL(`../dist/voxbrick.html${q}`, import.meta.url).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ready = () => page.waitForFunction(() => window.__voxbrick, { timeout: 30000 });

for (const id of ids) {
  await page.goto(url(`?w=${id}#model`));
  await ready();
  const n = await page.evaluate(() => window.__voxbrick.model.steps.length);
  await wait(1200);
  await page.screenshot({ path: `${outDir}/${id}-model.png` });
  await page.evaluate(() => window.__voxbrick.front());
  await wait(800);
  await page.screenshot({ path: `${outDir}/${id}-front.png` });
  await page.evaluate((i) => (window.__voxbrick.setTab('steps'), window.__voxbrick.go(i)), Math.floor(n / 2));
  await wait(1000);
  await page.screenshot({ path: `${outDir}/${id}-step.png` });
}

// 导入：把第一个作品导出成 .vox 再从页面导入
const vox = `${outDir}/import-test.vox`;
await writeFile(vox, writeVox(workToGrid(JSON.parse(readFileSync(`${root}works/${ids[0]}.json`, 'utf8')))));
await page.goto(url(`?w=${ids[0]}#steps-5`));
await ready();
await page.click('#open-gallery');
await wait(500);
await page.screenshot({ path: `${outDir}/gallery.png` });
await page.keyboard.press('Escape');
await page.click('#open-import');
const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('#drop-zone')]);
await chooser.accept([vox]);
await page.waitForSelector('#import-vox-options:not([hidden])');
await page.click('input[name="unit"][value="brick"]');
await wait(300);
await page.screenshot({ path: `${outDir}/import-dialog.png` });
await Promise.all([page.waitForNavigation(), page.click('#import-go')]);
await ready();
const imported = await page.evaluate(() => ({ id: window.__voxbrick.model.work.id, unit: window.__voxbrick.model.work.unit, n: window.__voxbrick.model.bricks.length, tab: document.body.dataset.tab, banner: !document.querySelector('#imported-banner').hidden }));
await wait(1000);
await page.screenshot({ path: `${outDir}/import.png` });
// 导出菜单
await page.click('#open-export');
await wait(200);
await page.screenshot({ path: `${outDir}/export-menu.png` });

await page.setViewport({ width: 390, height: 844, isMobile: true });
await page.goto(url(`?w=${ids[0]}#steps-1`));
await ready();
await wait(1000);
await page.screenshot({ path: `${outDir}/mobile.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors', JSON.stringify(imported));
await browser.close();
