// 小机器人：方头方身体，胸口一块有指示灯的屏幕，头顶天线。用砖拼（1 层 = 1 块砖高）。
// 左右以 x=8 这条线对称（x 格 ↔ 15-x 格）。
import { VoxelGrid } from '../src/core/voxels.js';

export const meta = {
  id: 'robot',
  title: '小机器人',
  description: '方头方身体的小机器人：护目镜一样的黑色面罩和两只蓝眼睛，胸口屏幕上红黄绿三个指示灯，头顶一根天线，两只手垂在身体两侧。',
  author: { name: 'voxbrick' },
  license: 'CC0-1.0',
  unit: 'brick',
  sections: [
    { from: 0, to: 0, name: '脚' },
    { from: 1, to: 3, name: '腿' },
    { from: 4, to: 9, name: '身体、屏幕和手臂' },
    { from: 10, to: 10, name: '脖子' },
    { from: 11, to: 14, name: '头和面罩' },
    { from: 15, to: 17, name: '天线' },
  ],
  i18n: {
    en: {
      title: 'Little Robot',
      description: 'A little robot with a square head and body: a black visor like goggles with two blue eyes, a chest screen with red, yellow and green lights, an antenna on top, and arms hanging at its sides.',
      sections: ['Feet', 'Legs', 'Body, screen and arms', 'Neck', 'Head and visor', 'Antenna'],
    },
  },
};

export function build() {
  const g = new VoxelGrid();
  const mirror = (x0, x1, y0, y1, z0, z1, color) => {
    g.box(x0, x1, y0, y1, z0, z1, color);
    g.box(16 - x1, 16 - x0, y0, y1, z0, z1, color);
  };
  mirror(3, 7, 0, 1, 3, 10, 'darkGray'); // 脚
  mirror(4, 6, 1, 4, 5, 8, 'lightGray'); // 腿
  g.box(3, 13, 4, 10, 3, 10, 'lightGray'); // 身体
  g.box(1, 15, 9, 10, 4, 9, 'darkGray'); // 肩膀
  mirror(1, 3, 5, 9, 5, 8, 'darkGray'); // 手臂
  mirror(1, 3, 4, 5, 5, 8, 'yellow'); // 手
  // 胸口屏幕和指示灯
  g.box(5, 11, 5, 9, 9, 10, 'darkBlue');
  g.set(6, 7, 9, 'red');
  g.set(8, 7, 9, 'yellow');
  g.set(10, 7, 9, 'green');
  g.box(7, 9, 10, 11, 5, 7, 'darkGray'); // 脖子
  g.box(4, 12, 11, 15, 3, 9, 'lightGray'); // 头
  g.box(5, 11, 12, 14, 8, 9, 'black'); // 面罩
  for (const x of [6, 9]) g.box(x, x + 1, 12, 14, 8, 9, 'lightBlue'); // 眼睛
  g.box(6, 10, 11, 12, 8, 9, 'darkGray'); // 嘴（出风口）
  mirror(3, 4, 12, 14, 5, 7, 'red'); // 耳朵上的螺栓
  g.box(7, 9, 15, 17, 5, 7, 'darkGray'); // 天线
  g.box(7, 9, 17, 18, 5, 7, 'red');
  return g;
}
