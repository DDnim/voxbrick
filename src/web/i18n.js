// 界面文字（中文 / English）。选择存在 localStorage，也可以用 ?lang=en 指定。
// 静态 HTML 用 data-i18n（文字）、data-i18n-html（带标签）、data-i18n-title、data-i18n-placeholder 标出来。
// 作品自己的标题、说明、部位名在作品文件的 i18n 字段里（见 docs/work-format.md），没有翻译就显示原文。
import { COLORS, PART_BY_ID } from '../core/catalog.js';

export const LANGS = { zh: '中文', en: 'English' };
const KEY = 'voxbrick:lang';

function detect() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked in LANGS) return asked;
  const saved = localStorage.getItem(KEY);
  if (saved in LANGS) return saved;
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const lang = detect();

// 切换后重新加载页面（导入的作品在 sessionStorage 里，不会丢）
export function switchLang(next) {
  localStorage.setItem(KEY, next);
  const params = new URLSearchParams(location.search);
  params.delete('lang');
  const q = params.toString();
  location.href = `${location.pathname}${q ? `?${q}` : ''}${location.hash}`;
}

const zh = {
  appName: 'Voxbrick · 积木拼装图',
  docTitle: (title) => `${title} · Voxbrick 积木拼装图`,
  galleryTitle: '浏览全部作品（G）',
  gallery: '▦ 作品库',
  tabModel: '成品',
  tabParts: '零件清单',
  tabSteps: '拼装步骤',
  importTitle: '导入 .json 或 .vox，也可以直接把文件拖进页面',
  import: '导入',
  export: '导出 ▾',
  exportJson: '作品文件 .json',
  exportJsonHint: '投稿用，也能再导入',
  exportVox: 'MagicaVoxel .vox',
  exportVoxHint: '在体素编辑器里接着改',
  exportCsv: '零件清单 .csv',
  exportCsvHint: '按颜色和尺寸统计的数量',
  langTitle: 'Switch to English',
  resetCamTitle: '回到默认视角',
  resetCam: '⟲ 视角',
  stageHint: '拖动旋转 · 滚轮缩放 · 右键平移',
  stageHintTouch: '单指旋转 · 双指缩放 · 双指拖动平移',
  introHow:
    '全部用<strong>最普通的长方形积木</strong>拼成：砖或薄板，1×1 到 2×8 共 11 种尺寸，不用人偶、斜面这些特殊零件。零件的排法是程序按层自动算的：',
  introRule1: '上下层尽量错缝，互相咬住；',
  introRule2: '悬在外面的零件，都至少有一个凸点扣在有支撑的地方；',
  introRule3: '最后检查所有零件连成一整块、重心落在底面范围内。',
  introParts: '看每种零件要几块、什么颜色 → <a href="#parts" data-goto="parts">零件清单</a>',
  introSteps: '一步一步怎么拼 → <a href="#steps" data-goto="steps">拼装步骤</a>',
  introPr: '想把自己的作品放进作品库：用“导入”预览，没问题的话按仓库里的 CONTRIBUTING.md 提交 PR。',
  firstTitle: '第一步',
  prevTitle: '上一步（←）',
  prev: '◀ 上一步',
  nextTitle: '下一步（→ 或空格）',
  next: '下一步 ▶',
  lastTitle: '最后一步',
  stepUses: '这一步要用',
  galleryHead: '作品库',
  gallerySearch: '搜索标题、作者、说明',
  close: '关闭（Esc）',
  galleryFoot: '想加自己的作品？用右上角“导入”先预览，再按 CONTRIBUTING.md 提交 PR。',
  importHead: '导入作品',
  dropHere: '把文件拖到这里，或点这里选择',
  dropKinds: '作品文件 .json，或 MagicaVoxel 的 .vox',
  unitLegend: '一格体素用什么拼',
  unitBrick: '砖',
  unitBrickHint: '1 格接近正方体（高是宽的 1.2 倍）。在编辑器里按正常比例画的模型选这个',
  unitPlate: '薄板',
  unitPlateHint: '1 格高只有宽的 0.4 倍，模型会被压扁。适合竖向按 2.5 倍格数画的模型，能做出更细的五官',
  fieldTitle: '标题',
  previewGo: '预览',
  importLocal: '只在这个浏览器标签页里预览，不会上传。',
  dropOverlay: '松开鼠标导入作品',

  // 零件、单位
  brick: '砖',
  plate: '板',
  pieces: (n, u) => `<b>${n}</b> 块${u}`,
  kinds: (p, c) => `<b>${p}</b> 种尺寸 · <b>${c}</b> 种颜色`,
  dims: (w, d, h, sw, sd, layers) => `宽 ${w} × 深 ${d} × 高 ${h} cm（${sw}×${sd} 凸点，${layers} 层）`,
  connected: '✓ 所有零件连成一整块',
  split: (n) => `✗ 分成 ${n} 块`,
  balanced: '✓ 重心落在底面范围内，能站稳',
  unbalanced: '✗ 重心在底面外',
  introMeta: (author, license, unit) =>
    `作者 ${author} · 许可 ${license} · ${unit === 'plate' ? '用薄板拼（1 层 = 3.2mm，3 层 = 1 块砖高）' : '用砖拼（1 层 = 9.6mm）'}`,
  bomHint: '点一行，3D 里只亮出这些零件；再点一次取消。<br>某些颜色的大块零件不好买时，可以用同色的小块拼出同样的长度代替。',
  bomCsv: '下载零件清单（CSV）',
  csvHeader: ['零件', '名称', '颜色', '颜色 id', '色值', '数量'],

  // 导入
  voxInfo: (name, w, d, h, n) => `${name} · ${w}×${d} 格，高 ${h} 格，${n} 个体素`,
  badJson: (m) => `不是合法的 JSON：${m}`,
  badKind: '只支持 .json（作品文件）和 .vox（MagicaVoxel）',
  voxDescription: (title) => `${title}（从 MagicaVoxel 导入）`,
  authorPlaceholder: '（填你的名字）',
  banner: (home) => `这是导入的作品，只在这个标签页里预览。满意的话
    <button data-export="json" class="link">下载作品文件</button>，填好作者和说明后按 CONTRIBUTING.md 提交 PR。
    <a href="${home}">回到作品库</a>`,

  // 作品库
  cardSize: (w, d, h) => `${w}×${d} 凸点 · 高 ${h} cm`,
  cardUnit: (unit) => (unit === 'plate' ? '薄板' : '砖'),
  notFound: (q) => `没有找到“${q}”。`,

  // 拼装步骤
  front: '↓ 正面',
  layerN: (n) => `第 ${n} 层`,
  partOf: (i, n) => `（${i}/${n}）`,
  layerMap: (n) => `第 ${n} 层 俯视图`,
  layerStep: (count, u, y) => `把下面 ${count} 块${u}按到第 ${y} 层上面（橙色框是这一步要放的）。`,
  firstStep: (count, u) => `从最底层开始：把这 ${count} 块${u}摆在桌面上（橙色框）。`,
  hangTitle: (u) => `挂上悬空的${u}`,
  hangGroups: (groups, u, layer) =>
    `这 ${groups} 组${u}下面没有东西托着（比如垂下来的手臂）。先把每组按图叠好，再从下面扣到第 ${layer} 层的底下。`,
  hangSingle: (count, u, layer) => `这 ${count} 块${u}伸出在外面、下面是空的，要等第 ${layer} 层放好后，从下面往上扣住。`,
  stepNo: (i, n) => `第 ${i} 步 / 共 ${n} 步`,
  used: (placed, total) => `已用 ${placed} / ${total} 块`,
  tooltipLayer: (n) => `第 ${n} 层`,
};

const en = {
  appName: 'Voxbrick · Brick Build Guide',
  docTitle: (title) => `${title} · Voxbrick`,
  galleryTitle: 'Browse all models (G)',
  gallery: '▦ Gallery',
  tabModel: 'Model',
  tabParts: 'Parts',
  tabSteps: 'Steps',
  importTitle: 'Import a .json or .vox file, or drop it anywhere on the page',
  import: 'Import',
  export: 'Export ▾',
  exportJson: 'Model file .json',
  exportJsonHint: 'For submitting, or importing again',
  exportVox: 'MagicaVoxel .vox',
  exportVoxHint: 'Keep editing in a voxel editor',
  exportCsv: 'Parts list .csv',
  exportCsvHint: 'Counts by color and size',
  langTitle: '切换到中文',
  resetCamTitle: 'Reset the view',
  resetCam: '⟲ View',
  stageHint: 'Drag to rotate · Scroll to zoom · Right-drag to pan',
  stageHintTouch: 'One finger to rotate · Pinch to zoom · Two fingers to pan',
  introHow:
    'Built only from <strong>plain rectangular bricks</strong>: bricks or plates in 11 sizes from 1×1 to 2×8, with no figures, slopes or other special parts. The layout is computed layer by layer:',
  introRule1: 'joints are staggered between layers so they lock together;',
  introRule2: 'every overhanging part has at least one stud on something supported;',
  introRule3: 'finally, all parts must form one piece and the center of mass must sit over the base.',
  introParts: 'How many of each part, in which color → <a href="#parts" data-goto="parts">Parts</a>',
  introSteps: 'How to build it, step by step → <a href="#steps" data-goto="steps">Steps</a>',
  introPr: 'Want your own model in the gallery? Preview it with “Import”, then open a PR as described in CONTRIBUTING.md.',
  firstTitle: 'First step',
  prevTitle: 'Previous (←)',
  prev: '◀ Back',
  nextTitle: 'Next (→ or Space)',
  next: 'Next ▶',
  lastTitle: 'Last step',
  stepUses: 'Parts for this step',
  galleryHead: 'Gallery',
  gallerySearch: 'Search title, author, description',
  close: 'Close (Esc)',
  galleryFoot: 'Want to add your own? Preview it with “Import” (top right), then open a PR as described in CONTRIBUTING.md.',
  importHead: 'Import a model',
  dropHere: 'Drop a file here, or click to choose',
  dropKinds: 'Model file .json, or MagicaVoxel .vox',
  unitLegend: 'Build each voxel from',
  unitBrick: 'Bricks',
  unitBrickHint: 'Each voxel is nearly a cube (1.2× as tall as wide). Pick this for models drawn at normal proportions',
  unitPlate: 'Plates',
  unitPlateHint:
    'Each voxel is only 0.4× as tall as wide, so the model gets squashed. For models drawn 2.5× taller in the editor, allowing finer faces',
  fieldTitle: 'Title',
  previewGo: 'Preview',
  importLocal: 'Previewed only in this browser tab. Nothing is uploaded.',
  dropOverlay: 'Release to import',

  brick: 'Brick',
  plate: 'Plate',
  pieces: (n, u) => `<b>${n}</b> ${u === 'plate' ? 'plates' : 'bricks'}`,
  kinds: (p, c) => `<b>${p}</b> sizes · <b>${c}</b> colors`,
  dims: (w, d, h, sw, sd, layers) => `${w} × ${d} × ${h} cm (${sw}×${sd} studs, ${layers} layers)`,
  connected: '✓ All parts form one piece',
  split: (n) => `✗ Falls apart into ${n} pieces`,
  balanced: '✓ Center of mass is over the base, stands on its own',
  unbalanced: '✗ Center of mass is outside the base',
  introMeta: (author, license, unit) =>
    `By ${author} · License ${license} · ${unit === 'plate' ? 'Built from plates (1 layer = 3.2 mm, 3 layers = 1 brick)' : 'Built from bricks (1 layer = 9.6 mm)'}`,
  bomHint:
    'Click a row to highlight those parts in 3D; click again to clear.<br>If a large part is hard to find in some color, smaller parts of the same color can make up the same length.',
  bomCsv: 'Download parts list (CSV)',
  csvHeader: ['Part', 'Name', 'Color', 'Color id', 'Hex', 'Count'],

  voxInfo: (name, w, d, h, n) => `${name} · ${w}×${d} cells, ${h} tall, ${n} voxels`,
  badJson: (m) => `Not valid JSON: ${m}`,
  badKind: 'Only .json (model files) and .vox (MagicaVoxel) are supported',
  voxDescription: (title) => `${title} (imported from MagicaVoxel)`,
  authorPlaceholder: '(your name)',
  banner: (home) => `This is an imported model, previewed only in this tab. If you like it,
    <button data-export="json" class="link">download the model file</button>, fill in the author and description, and open a PR as described in CONTRIBUTING.md.
    <a href="${home}">Back to the gallery</a>`,

  cardSize: (w, d, h) => `${w}×${d} studs · ${h} cm tall`,
  cardUnit: (unit) => (unit === 'plate' ? 'Plates' : 'Bricks'),
  notFound: (q) => `Nothing found for “${q}”.`,

  front: '↓ Front',
  layerN: (n) => `Layer ${n}`,
  partOf: (i, n) => ` (${i}/${n})`,
  layerMap: (n) => `Layer ${n}, top view`,
  layerStep: (count, u, y) => `Press these ${count} ${u === 'plate' ? 'plates' : 'bricks'} onto layer ${y} (orange outlines are this step).`,
  firstStep: (count, u) => `Start at the bottom: lay these ${count} ${u === 'plate' ? 'plates' : 'bricks'} on the table (orange outlines).`,
  hangTitle: (u) => `Attach the hanging ${u === 'plate' ? 'plates' : 'bricks'}`,
  hangGroups: (groups, u, layer) =>
    `These ${groups} groups have nothing underneath (like arms hanging down). Stack each group as shown, then press it onto the underside of layer ${layer}.`,
  hangSingle: (count, u, layer) =>
    `These ${count} ${u === 'plate' ? 'plates' : 'bricks'} stick out over empty space. Once layer ${layer} is in place, press them on from below.`,
  stepNo: (i, n) => `Step ${i} of ${n}`,
  used: (placed, total) => `${placed} / ${total} parts used`,
  tooltipLayer: (n) => `layer ${n}`,
};

const DICT = { zh, en };

// t('key', ...args)：字符串直接返回，函数带参数调用。英文缺的键退回中文。
export function t(key, ...args) {
  const v = DICT[lang][key] ?? zh[key];
  return typeof v === 'function' ? v(...args) : v;
}

// 中文界面里单位是“砖 / 板”，英文界面由句子自己决定单复数，所以把 unit id 原样传进去
export const unitWord = (unit) => (lang === 'zh' ? (unit === 'plate' ? '板' : '砖') : unit);

export const colorName = (id) => COLORS[id][lang] ?? COLORS[id].zh;

export function partName(id) {
  const p = PART_BY_ID[id];
  return `${t(p.kind)} ${p.w}×${p.d}`;
}
export const partSize = (id) => `${PART_BY_ID[id].w}×${PART_BY_ID[id].d}`;

// 作品的标题、说明、部位名换成当前语言（缺的保持原文）
export function localizeWork(work) {
  const tr = work.i18n?.[lang];
  if (!tr) return work;
  return {
    ...work,
    title: tr.title || work.title,
    description: tr.description || work.description,
    sections: work.sections?.map((s, i) => ({ ...s, name: tr.sections?.[i] || s.name })),
  };
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}
