// 仓库里不出现积木品牌的商标名（作品标题、说明、代码、文档都算）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// 拆开写，免得这个文件自己被搜到
const WORDS = [['le', 'go'], ['乐', '高'], ['樂', '高'], ['レ', 'ゴ'], ['brick', 'link'], ['du', 'plo']].map((w) => w.join(''));
const pattern = new RegExp(WORDS.join('|'), 'i');

test('所有文件里都没有积木品牌的商标名', () => {
  const root = new URL('..', import.meta.url).pathname;
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.endsWith('package-lock.json'));
  const hits = files.filter((f) => pattern.test(readFileSync(`${root}${f}`, 'utf8')));
  assert.deepEqual(hits, []);
});
