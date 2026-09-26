// 作品文件格式、.vox 导入导出、代码生成的作品和 works/ 保持一致
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { validateWork, workToGrid, gridToWork, stringifyWork } from '../src/core/work.js';
import { readVox, writeVox } from '../src/core/vox.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cells = (grid) =>
  [...grid.cells.values()].map((c) => `${c.x},${c.y},${c.z},${c.color}`).sort();
const sample = read('../works/robot.json');

test('stringifyWork 写出的是合法 JSON，读回来内容不变', () => {
  assert.deepEqual(JSON.parse(stringifyWork(sample)), sample);
});

test('gridToWork(workToGrid(work)) 还原出同样的格子', () => {
  const back = gridToWork(workToGrid(sample), { id: 'x', title: 't', description: 'd', author: { name: 'a' }, license: 'CC0-1.0', unit: 'brick' });
  assert.deepEqual(cells(workToGrid(back)), cells(workToGrid(sample)));
});

test('.vox 导出再导入，格子和颜色都不变', () => {
  for (const f of readdirSync(new URL('../works/', import.meta.url))) {
    const grid = workToGrid(read(`../works/${f}`));
    assert.deepEqual(cells(readVox(writeVox(grid))), cells(grid), f);
  }
});

test('validateWork 能指出常见错误', () => {
  const bad = structuredClone(sample);
  bad.id = 'Bad Id';
  bad.palette.Q = 'notAColor';
  bad.layers[0][0] = bad.layers[0][0] + 'X';
  const errors = validateWork(bad).join('\n');
  assert.match(errors, /id 只能用/);
  assert.match(errors, /notAColor/);
  assert.match(errors, /第 0 层第 0 行应该有/);
});

test('i18n 字段：格式检查、按原样读写', () => {
  const base = read('../works/snowman.json');
  assert.deepEqual(validateWork({ ...base, i18n: { en: { title: 'x', sections: ['a'] } } }), ['i18n.en.sections 应该和 sections 一样有 4 个']);
  assert.ok(validateWork({ ...base, i18n: { English: {} } }).some((e) => e.includes('语言代码')));
  assert.deepEqual(JSON.parse(stringifyWork(base)).i18n, base.i18n);
});

test('works-src/ 里用代码画的作品和 works/ 的 JSON 一致（改了代码请运行 npm run works）', async () => {
  const dir = new URL('../works-src/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const { meta, build } = await import(new URL(f, dir));
    const json = new URL(`../works/${meta.id}.json`, import.meta.url);
    assert.ok(existsSync(json), `缺少 works/${meta.id}.json`);
    assert.equal(stringifyWork(gridToWork(build(), meta)), readFileSync(json, 'utf8'), f);
  }
});
