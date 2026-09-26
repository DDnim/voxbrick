// 雪人：三个雪球、黑礼帽、红围巾、胡萝卜鼻子、树枝手。用砖拼（1 层 = 1 块砖高）。
// 以第 8 格为左右中心（x=8 这一列正对着脸）。
import { VoxelGrid } from '../src/core/voxels.js';

export const meta = {
  id: 'snowman',
  title: '雪人',
  description: '三个雪球叠起来，戴黑礼帽、围红围巾，胡萝卜鼻子，两根树枝当手。适合第一次拼：零件大、颜色少。',
  author: { name: 'voxbrick' },
  license: 'CC0-1.0',
  unit: 'brick',
  sections: [
    { from: 0, to: 7, name: '底下的大雪球' },
    { from: 8, to: 13, name: '中间的雪球、纽扣和树枝手' },
    { from: 14, to: 17, name: '围巾和头' },
    { from: 18, to: 20, name: '礼帽' },
  ],
};

const CX = 8.5; // 第 8 格的中心
const CZ = 8.5;

export function build() {
  const g = new VoxelGrid();
  // 砖高是宽的 1.2 倍，所以竖直方向的距离要乘 1.2 才是圆的
  const ball = (cy, r) => {
    for (let y = Math.floor(cy - r / 1.2); y <= Math.ceil(cy + r / 1.2); y++) {
      const dy = (y + 0.5 - cy) * 1.2;
      if (Math.abs(dy) >= r) continue;
      const rr = Math.sqrt(r * r - dy * dy);
      g.ellipseLayer(y, CX, CZ, rr, rr, 'white');
    }
  };
  ball(4, 5.2);
  ball(10.6, 3.9);
  ball(16.4, 3.1);

  const front = (x, y) => {
    let z = 0;
    while (g.has(x, y, z + 1) || !g.has(x, y, z)) z++;
    return z;
  };
  // 纽扣
  for (const y of [9, 11]) g.set(8, y, front(8, y), 'black');
  // 树枝手：从身体两侧斜着往上伸出去（身体表面那一格也是棕色，树枝从里面插出来）
  for (const side of [-1, 1]) {
    let x = 8;
    while (g.has(x + side, 11, 8)) x += side;
    for (let k = 0; k < 3; k++) g.set(x + side * k, 11, 8, 'brown');
    for (let k = 2; k < 4; k++) g.set(x + side * k, 12, 8, 'brown');
  }
  // 围巾：比脖子宽一圈，右前方垂下一截
  g.ellipseLayer(14, CX, CZ, 3.3, 3.3, 'red');
  g.set(9, 13, front(9, 13) + 1, 'red');
  g.get(9, 12, front(9, 12)).color = 'red';
  // 眼睛和胡萝卜鼻子
  for (const x of [7, 9]) g.set(x, 17, front(x, 17), 'black');
  const nz = front(8, 16);
  for (let k = 0; k < 3; k++) g.set(8, 16, nz + k, 'orange');
  // 黑礼帽：帽檐直接扣在头顶那一层上（放在更上面的话，帽檐外圈底下是空的，扣不住）
  g.ellipseLayer(18, CX, CZ, 3.1, 3.1, 'black');
  g.ellipseLayer(19, CX, CZ, 2.3, 2.3, 'red');
  g.ellipseLayer(20, CX, CZ, 2.3, 2.3, 'black');
  return g;
}
