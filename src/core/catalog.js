// 零件和颜色目录。只用最常见的长方形积木：砖（brick）和薄板（plate），各 11 种尺寸。
// 尺寸单位：1 = 1 个凸点间距（8mm）。砖高 9.6mm = 1.2 个单位，薄板高 3.2mm = 0.4 个单位（3 块薄板 = 1 块砖）。

export const STUD_MM = 8;
export const BRICK_HEIGHT = 1.2;
export const PLATE_HEIGHT = 0.4;

// w ≤ d，放置时可以旋转 90°。
const SIZES = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 6],
  [1, 8],
  [2, 2],
  [2, 3],
  [2, 4],
  [2, 6],
  [2, 8],
];
const partsOf = (kind, zh) =>
  SIZES.map(([w, d]) => ({ id: `${kind}-${w}x${d}`, kind, w, d, name: `${zh} ${w}×${d}`, area: w * d }));

export const BRICKS = partsOf('brick', '砖');
export const PLATES = partsOf('plate', '板');
export const PARTS = [...BRICKS, ...PLATES];
export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));

// 作品的 unit 决定一层有多高、用哪类零件
export const UNITS = {
  brick: { parts: BRICKS, height: BRICK_HEIGHT, zh: '砖' },
  plate: { parts: PLATES, height: PLATE_HEIGHT, zh: '板' },
};

// 颜色：作品里用 id 引用。zh 是显示名，hex 是 3D 显示和导出用的颜色。
// 要加新颜色，在这里加一行，并在 PR 里说明用途。
export const COLORS = {
  white: { zh: '白', hex: '#F4F4F4' },
  lightGray: { zh: '浅灰', hex: '#A0A5A9' },
  darkGray: { zh: '深灰', hex: '#6C6E68' },
  black: { zh: '黑', hex: '#1B2A34' },
  red: { zh: '红', hex: '#C91A09' },
  darkRed: { zh: '暗红', hex: '#720E0F' },
  pink: { zh: '粉', hex: '#FC97AC' },
  orange: { zh: '橙', hex: '#FE8A18' },
  yellow: { zh: '黄', hex: '#F2CD37' },
  gold: { zh: '金黄', hex: '#DBAC34' },
  tan: { zh: '米色', hex: '#E4CD9E' },
  skin: { zh: '浅肤色', hex: '#F6D7B3' },
  brown: { zh: '棕', hex: '#582A12' },
  green: { zh: '绿', hex: '#4B9F4A' },
  darkGreen: { zh: '深绿', hex: '#184632' },
  blue: { zh: '蓝', hex: '#0055BF' },
  lightBlue: { zh: '浅蓝', hex: '#5A93DB' },
  darkBlue: { zh: '深蓝', hex: '#0A3463' },
  purple: { zh: '紫', hex: '#81007B' },
};
