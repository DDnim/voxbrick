// 每个作品都要过的检查。新作品的 PR 必须让这些测试全部通过。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { buildModel } from '../src/core/instructions.js';
import { validateWork, workToGrid } from '../src/core/work.js';
import { PART_BY_ID, UNITS } from '../src/core/catalog.js';

// 作品必须用开放许可，别人才能自由拼、分享和改
export const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0'];

const dir = new URL('../works/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

test('至少有一个作品', () => assert.ok(files.length > 0));

test('作品 id 不重复', () => {
  const ids = files.map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')).id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const file of files) {
  const work = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));

  test(`[${file}] 格式正确，文件名等于 id，许可是开放许可`, () => {
    assert.deepEqual(validateWork(work), []);
    assert.equal(file, `${work.id}.json`);
    assert.ok(LICENSES.includes(work.license), `license 请用 ${LICENSES.join(' / ')} 之一`);
  });

  const grid = workToGrid(work);
  const model = buildModel(work);

  test(`[${file}] 每格正好被一块零件盖住，零件是目录里对应 unit 的尺寸，看得见的格子颜色一致`, () => {
    const allowed = new Set(UNITS[work.unit].parts.map((p) => p.id));
    const seen = new Set();
    for (const b of model.bricks) {
      const p = PART_BY_ID[b.part];
      assert.ok(allowed.has(b.part), `零件 ${b.part} 不属于 ${work.unit}`);
      assert.deepEqual([Math.min(b.w, b.d), Math.max(b.w, b.d)], [p.w, p.d]);
      for (let z = b.z; z < b.z + b.d; z++)
        for (let x = b.x; x < b.x + b.w; x++) {
          const k = `${x},${b.y},${z}`;
          assert.ok(grid.has(x, b.y, z), `零件超出模型 ${k}`);
          assert.ok(!seen.has(k), `${k} 被两块零件重叠`);
          seen.add(k);
          if (!grid.isHidden(x, b.y, z)) assert.equal(grid.get(x, b.y, z).color, b.color, k);
        }
    }
    assert.equal(seen.size, grid.size);
  });

  test(`[${file}] 所有零件连成一整块（不行的话改造型，或者换一个 seed 试试）`, () => {
    assert.equal(model.componentCount, 1);
  });

  test(`[${file}] 重心落在底面范围内`, () => {
    assert.equal(model.balance.inside, true);
  });

  test(`[${file}] 拼装步骤把每块零件放一次，而且放的时候有地方扣`, () => {
    assert.equal(model.bom.reduce((s, r) => s + r.count, 0), model.bricks.length);
    const placed = new Set();
    for (const step of model.steps) {
      const group = step.bricks.map((id) => model.bricks[id]);
      if (step.kind === 'layer') {
        for (const b of group) {
          const ok = b.y === 0 || model.bricks.some((p) => p.y === b.y - 1 && placed.has(p.id) && overlaps(p, b));
          assert.ok(ok, `第 ${step.index + 1} 步的零件 ${b.id} 悬空`);
        }
      } else {
        const hooked = group.some((g) => model.bricks.some((p) => p.y === g.y + 1 && placed.has(p.id) && overlaps(p, g)));
        assert.ok(hooked, `第 ${step.index + 1} 步的组件挂不上去`);
      }
      for (const id of step.bricks) {
        assert.ok(!placed.has(id), `零件 ${id} 放了两次`);
        placed.add(id);
      }
    }
    assert.equal(placed.size, model.bricks.length);
  });
}
