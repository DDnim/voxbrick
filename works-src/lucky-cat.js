// 招财猫：坐着的白猫，举起一只手招客，另一只手抱着金币，脖子上红项圈挂金铃铛，头顶有橙色和黑色的花斑。
// 用薄板拼（1 层 = 1 块薄板高），五官才画得出来。左右以 x=10 这条线对称（x 格 ↔ 19-x 格）。
import { VoxelGrid } from '../src/core/voxels.js';

export const meta = {
  id: 'lucky-cat',
  title: '招财猫',
  description: '坐着的白色招财猫：举起一只手招客，另一只手抱着金币，红项圈上挂着金铃铛，头顶有橙色和黑色的花斑，耳朵里是粉色的。',
  author: { name: 'voxbrick' },
  license: 'CC0-1.0',
  unit: 'plate',
  sections: [
    { from: 0, to: 3, name: '前爪和身体底部' },
    { from: 4, to: 19, name: '身体、金币和铃铛' },
    { from: 20, to: 22, name: '红项圈' },
    { from: 23, to: 35, name: '嘴、鼻子、胡子和举起的手' },
    { from: 36, to: 48, name: '眼睛和头顶的花斑' },
    { from: 49, to: 56, name: '耳朵' },
  ],
};

// 脸的正面贴图，从下往上，第 i 列是 x=4+i（头宽 12 格）
const FACE = [
  [31, '.....KK.....'], // 嘴的中间低
  [32, 'KK..K..K..KK'], // 嘴角往上翘；两边是胡子
  [33, '.....PP.....'], // 粉鼻子
  [34, 'KK........KK'], // 下面一对胡子
  [36, '.KKK....KKK.'], // 眼睛：黑眼眶、金色眼珠、黑色竖瞳孔
  [37, '.yKy....yKy.'],
  [38, '.yKy....yKy.'],
  [39, '.KKK....KKK.'],
];
const PAINT = { K: 'black', P: 'pink', y: 'gold' };

export function build() {
  const g = new VoxelGrid();
  const mirror = (x0, x1, y0, y1, z0, z1, color) => {
    g.box(x0, x1, y0, y1, z0, z1, color);
    g.box(20 - x1, 20 - x0, y0, y1, z0, z1, color);
  };
  const front = (x, y) => {
    let best = null;
    for (let z = 0; z < 20; z++) if (g.has(x, y, z)) best = g.get(x, y, z);
    return best;
  };

  // 身体：底部稍宽，坐得稳
  for (let y = 0; y < 20; y++) g.roundedLayer(y, 5, 15, 3, 11, y < 2 ? 1 : 2, 'white');
  mirror(6, 9, 0, 4, 11, 13, 'white'); // 前爪
  // 红项圈，比身体宽一圈；前面挂金铃铛
  for (let y = 20; y < 23; y++) g.roundedLayer(y, 4, 16, 2, 12, 3, 'red');
  g.box(9, 11, 17, 20, 11, 12, 'gold');
  g.box(9, 11, 17, 18, 11, 12, 'brown'); // 铃铛下面的开口
  // 头：比身体宽，圆一点
  const cuts = { 23: 3, 24: 2, 46: 3, 47: 4, 48: 5 };
  for (let y = 23; y < 49; y++) g.roundedLayer(y, 4, 16, 2, 12, cuts[y] ?? 2, 'white');
  // 耳朵：三角形，越往上越窄，正面是粉色的耳朵里
  const EAR = [
    [49, 51, 4, 8],
    [51, 53, 4, 7],
    [53, 55, 4, 6],
    [55, 57, 4, 5],
  ];
  for (const [y0, y1, x0, x1] of EAR) mirror(x0, x1, y0, y1, 5, 8, 'white');
  for (const [y, x] of [[49, 5], [49, 6], [50, 5], [50, 6], [51, 5], [52, 5]]) {
    g.set(x, y, 7, 'pink');
    g.set(19 - x, y, 7, 'pink');
  }
  // 头顶的花斑：左边橙色、右边黑色（整块换色，里面看不见的格子无所谓）
  for (const c of g.cells.values()) {
    if (c.y >= 42 && c.x <= 7 && c.color === 'white') c.color = 'orange';
    if (c.y >= 44 && c.x >= 12 && c.z <= 9 && c.color === 'white') c.color = 'black';
  }
  // 身体后面也有一块橙色花斑
  g.box(10, 14, 8, 14, 3, 4, 'orange');

  // 举起的手（观众左边）：从身体侧面一直举到眼睛旁边，手心是粉色肉垫
  g.box(2, 5, 12, 42, 7, 11, 'white');
  g.box(3, 5, 38, 40, 10, 11, 'pink');
  // 抱着金币的手（观众右边）：金币竖在身体前面，手搭在金币上
  for (let y = 5; y < 18; y++)
    for (let x = 10; x < 16; x++) {
      const dx = (x + 0.5 - 13) / 3;
      const dy = (y + 0.5 - 11.5) / 6.5;
      if (dx * dx + dy * dy <= 1) g.set(x, y, 11, dx * dx + dy * dy > 0.55 ? 'gold' : 'yellow');
    }
  g.box(12, 16, 15, 18, 11, 13, 'white');

  for (const [y, row] of FACE)
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const c = front(4 + i, y);
      if (c) c.color = PAINT[ch];
    });
  return g;
}
