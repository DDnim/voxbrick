// 体素网格：x 从左到右（观众视角），y 是层（1 层 = 1 块砖高），z 从后到前。

export const key = (x, y, z) => `${x},${y},${z}`;

export class VoxelGrid {
  constructor() {
    this.cells = new Map();
  }

  set(x, y, z, color) {
    this.cells.set(key(x, y, z), { x, y, z, color });
  }

  get(x, y, z) {
    return this.cells.get(key(x, y, z));
  }

  has(x, y, z) {
    return this.cells.has(key(x, y, z));
  }

  delete(x, y, z) {
    this.cells.delete(key(x, y, z));
  }

  // 半开区间 [x0,x1) × [y0,y1) × [z0,z1)
  box(x0, x1, y0, y1, z0, z1, color) {
    for (let y = y0; y < y1; y++)
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) this.set(x, y, z, color);
  }

  // 圆角矩形截面：离两条边的距离之和小于 cut 的角格去掉。
  roundedLayer(y, x0, x1, z0, z1, cut, color) {
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        const i = Math.min(x - x0, x1 - 1 - x);
        const j = Math.min(z - z0, z1 - 1 - z);
        if (i + j >= cut) this.set(x, y, z, color);
      }
  }

  // 椭圆截面：格子中心落在椭圆内的格子。
  ellipseLayer(y, cx, cz, rx, rz, color) {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dz = (z + 0.5 - cz) / rz;
        if (dx * dx + dz * dz <= 1) this.set(x, y, z, color);
      }
  }

  // 正面（z 最大）朝外的那一格
  frontmost(x, y) {
    let best = null;
    for (const c of this.cells.values()) if (c.x === x && c.y === y && (!best || c.z > best.z)) best = c;
    return best;
  }

  // 六个方向都被占住的格子看不见，颜色可以随意。
  isHidden(x, y, z) {
    return (
      this.has(x + 1, y, z) &&
      this.has(x - 1, y, z) &&
      this.has(x, y + 1, z) &&
      this.has(x, y - 1, z) &&
      this.has(x, y, z + 1) &&
      this.has(x, y, z - 1)
    );
  }

  layers() {
    const byY = new Map();
    for (const c of this.cells.values()) {
      if (!byY.has(c.y)) byY.set(c.y, []);
      byY.get(c.y).push(c);
    }
    return [...byY.entries()].sort((a, b) => a[0] - b[0]);
  }

  bounds() {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const { x, y, z } of this.cells.values()) {
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x + 1);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y + 1);
      b.z0 = Math.min(b.z0, z);
      b.z1 = Math.max(b.z1, z + 1);
    }
    return b;
  }

  get size() {
    return this.cells.size;
  }
}
