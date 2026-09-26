import { buildModel, COLORS, PART_BY_ID } from '../core/instructions.js';
import { UNITS } from '../core/catalog.js';
import { validateWork, workToGrid, gridToWork, stringifyWork } from '../core/work.js';
import { readVox, writeVox } from '../core/vox.js';
import { createViewer } from './viewer.js';
import WORKS from 'virtual:works';

// ?w=<作品 id>；导入的作品放在 sessionStorage 里，用 ?w=imported 打开
const IMPORTED = 'imported';
const params = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);

function currentWork() {
  const id = params.get('w');
  if (id === IMPORTED) {
    const saved = sessionStorage.getItem('voxbrick:imported');
    if (saved) return JSON.parse(saved);
  }
  return WORKS.find((w) => w.id === id) ?? WORKS[0];
}

const work = currentWork();
const model = buildModel(work);
const imported = params.get('w') === IMPORTED;
const unit = UNITS[work.unit];
const colorName = (c) => COLORS[c].zh;
const partCount = model.bricks.length;

// ---------- 小图标：俯视的一块零件 ----------
function brickIcon(partId, color, cell = 9) {
  const p = PART_BY_ID[partId];
  const w = p.d * cell;
  const h = p.w * cell;
  const hex = COLORS[color].hex;
  let studs = '';
  for (let i = 0; i < p.d; i++)
    for (let j = 0; j < p.w; j++)
      studs += `<circle cx="${i * cell + cell / 2}" cy="${j * cell + cell / 2}" r="${cell * 0.3}" fill="${hex}" stroke="rgba(0,0,0,.28)" stroke-width="0.8"/>`;
  return `<svg class="brick-icon" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}"><rect width="${w}" height="${h}" rx="1.5" fill="${hex}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>${studs}</svg>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- 顶部 ----------
function renderHeader() {
  document.title = `${work.title} · Voxbrick 积木拼装图`;
  $('#work-title').textContent = work.title;
  $('#work-count').textContent = WORKS.length;
  const colors = new Set(model.bom.map((r) => r.color)).size;
  const parts = new Set(model.bom.map((r) => r.part)).size;
  const [w, d, h] = model.size.cm.map((v) => v.toFixed(1));
  $('#summary').innerHTML = `
    <span><b>${partCount}</b> 块${unit.zh}</span>
    <span><b>${parts}</b> 种尺寸 · <b>${colors}</b> 种颜色</span>
    <span>宽 ${w} × 深 ${d} × 高 ${h} cm（${model.size.studs[0]}×${model.size.studs[1]} 凸点，${model.size.layers} 层）</span>
    <span class="${model.componentCount === 1 ? 'ok' : 'ng'}">${model.componentCount === 1 ? '✓ 所有零件连成一整块' : `✗ 分成 ${model.componentCount} 块`}</span>
    <span class="${model.balance.inside ? 'ok' : 'ng'}">${model.balance.inside ? '✓ 重心落在底面范围内，能站稳' : '✗ 重心在底面外'}</span>`;
}

function renderIntro() {
  const author = work.author.url
    ? `<a href="${escapeHtml(work.author.url)}" target="_blank" rel="noopener">${escapeHtml(work.author.name)}</a>`
    : escapeHtml(work.author.name);
  $('#intro-title').textContent = work.title;
  $('#intro-body').textContent = work.description;
  $('#intro-meta').innerHTML = `作者 ${author} · 许可 ${escapeHtml(work.license)} · ${
    work.unit === 'plate' ? '用薄板拼（1 层 = 3.2mm，3 层 = 1 块砖高）' : '用砖拼（1 层 = 9.6mm）'
  }`;
}

// ---------- 零件清单 ----------
let selected = null;
function renderBom() {
  const groups = new Map();
  for (const r of model.bom) {
    if (!groups.has(r.color)) groups.set(r.color, []);
    groups.get(r.color).push(r);
  }
  $('#bom').innerHTML =
    `<p class="hint">点一行，3D 里只亮出这些零件；再点一次取消。<br>某些颜色的大块零件不好买时，可以用同色的小块拼出同样的长度代替。</p>` +
    [...groups.entries()]
      .map(([color, rows]) => {
        const c = COLORS[color];
        const total = rows.reduce((s, r) => s + r.count, 0);
        return `<section class="color-group">
          <button class="color-head" data-color="${color}">
            <i class="swatch" style="background:${c.hex}"></i>
            <span class="cname">${c.zh}</span>
            <span class="cmeta">${c.hex}</span>
            <span class="count">${total}</span>
          </button>
          ${rows
            .map(
              (r) => `<button class="bom-row" data-color="${color}" data-part="${r.part}">
                <span class="icon">${brickIcon(r.part, color)}</span>
                <span class="pname">${PART_BY_ID[r.part].name}</span>
                <span class="pid">${r.part}</span>
                <span class="count">× ${r.count}</span>
              </button>`,
            )
            .join('')}
        </section>`;
      })
      .join('') +
    `<div class="exports"><button data-export="csv">下载零件清单（CSV）</button></div>`;

  $('#bom').addEventListener('click', (e) => {
    if (e.target.closest('[data-export]')) return exportAs('csv');
    const row = e.target.closest('.bom-row, .color-head');
    if (!row) return;
    const key = `${row.dataset.color}|${row.dataset.part ?? ''}`;
    document.querySelectorAll('#bom .active').forEach((el) => el.classList.remove('active'));
    if (selected === key) {
      selected = null;
      viewer.showAll();
      return;
    }
    selected = key;
    row.classList.add('active');
    const { color, part } = row.dataset;
    viewer.highlight((b) => b.color === color && (!part || b.part === part));
  });
}

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- 导出 ----------
function exportAs(kind) {
  if (kind === 'json') download(`${work.id}.json`, stringifyWork(work), 'application/json');
  if (kind === 'vox') download(`${work.id}.vox`, writeVox(workToGrid(work)), 'application/octet-stream');
  if (kind === 'csv') {
    const lines = [['零件', '名称', '颜色', '颜色 id', '色值', '数量'].join(',')];
    for (const r of model.bom) {
      const c = COLORS[r.color];
      lines.push([r.part, PART_BY_ID[r.part].name, c.zh, r.color, c.hex, r.count].join(','));
    }
    download(`${work.id}-parts.csv`, '﻿' + lines.join('\n'), 'text/csv');
  }
}

function setupExport() {
  const button = $('#open-export');
  const menu = $('#export-menu');
  const toggle = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.onclick = (e) => {
    e.stopPropagation();
    toggle(menu.hidden);
  };
  menu.onclick = (e) => {
    const item = e.target.closest('[data-export]');
    if (!item) return;
    exportAs(item.dataset.export);
    toggle(false);
  };
  document.addEventListener('click', () => toggle(false));
}

// ---------- 导入 ----------
// .json 直接预览；.vox 先让人选砖还是薄板、填个标题
let pendingVox = null;
const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-work';

function showImportErrors(errors) {
  const list = $('#import-errors');
  list.hidden = !errors.length;
  list.innerHTML = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('');
}

function preview(next) {
  const errors = validateWork(next);
  if (errors.length) return showImportErrors(errors);
  sessionStorage.setItem('voxbrick:imported', JSON.stringify(next));
  location.href = `?w=${IMPORTED}${location.hash}`;
}

async function importFile(file) {
  $('#importer').open || $('#importer').showModal();
  showImportErrors([]);
  $('#import-vox-options').hidden = true;
  pendingVox = null;
  try {
    if (file.name.toLowerCase().endsWith('.vox')) {
      pendingVox = { grid: readVox(await file.arrayBuffer()), name: file.name.replace(/\.vox$/i, '') };
      const b = pendingVox.grid.bounds();
      $('#import-file-name').textContent = `${file.name} · ${b.x1 - b.x0}×${b.z1 - b.z0} 格，高 ${b.y1 - b.y0} 格，${pendingVox.grid.size} 个体素`;
      $('#import-title').value = pendingVox.name;
      $('#import-vox-options').hidden = false;
    } else if (file.name.toLowerCase().endsWith('.json')) {
      let next;
      try {
        next = JSON.parse(await file.text());
      } catch (e) {
        return showImportErrors([`不是合法的 JSON：${e.message}`]);
      }
      preview(next);
    } else showImportErrors(['只支持 .json（作品文件）和 .vox（MagicaVoxel）']);
  } catch (e) {
    showImportErrors([e.message]);
  }
}

function setupImport() {
  const dialog = $('#importer');
  const input = $('#import-file');
  $('#open-import').onclick = () => {
    showImportErrors([]);
    $('#import-vox-options').hidden = true;
    dialog.showModal();
  };
  input.onchange = () => {
    if (input.files[0]) importFile(input.files[0]);
    input.value = '';
  };
  $('#import-go').onclick = () => {
    if (!pendingVox) return;
    const title = $('#import-title').value.trim() || pendingVox.name;
    preview(
      gridToWork(pendingVox.grid, {
        id: slug(pendingVox.name),
        title,
        description: `${title}（从 MagicaVoxel 导入）`,
        author: { name: '（填你的名字）' },
        license: 'CC-BY-4.0',
        unit: document.querySelector('input[name="unit"]:checked').value,
      }),
    );
  };
  // 文件可以拖到对话框里，也可以直接拖到页面任何地方
  const zone = $('#drop-zone');
  const overlay = $('#drop-overlay');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    overlay.hidden = dialog.open;
    zone.classList.add('over');
  });
  addEventListener('dragleave', () => {
    if (--depth <= 0) {
      depth = 0;
      overlay.hidden = true;
      zone.classList.remove('over');
    }
  });
  addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
  addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    zone.classList.remove('over');
    if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]);
  });
}

// 导入的作品：顶部提示这只是预览，并给出下一步
function renderBanner() {
  if (!imported) return;
  const banner = $('#imported-banner');
  banner.hidden = false;
  banner.innerHTML = `这是导入的作品，只在这个标签页里预览。满意的话
    <button data-export="json" class="link">下载作品文件</button>，填好作者和说明后按 CONTRIBUTING.md 提交 PR。
    <a href="?w=${WORKS[0].id}">回到作品库</a>`;
  banner.querySelector('[data-export]').onclick = () => exportAs('json');
}

// ---------- 作品库 ----------
// 缩略图：正面看过去每一列最前面那格的颜色，按层高比例画
function thumbnail(w) {
  const depth = w.layers[0].length;
  const width = w.layers[0][0].length;
  const layerH = UNITS[w.unit].height;
  const scale = Math.max(2, Math.floor(120 / Math.max(width, w.layers.length * layerH)));
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = Math.ceil(w.layers.length * layerH * scale);
  const ctx = canvas.getContext('2d');
  w.layers.forEach((rows, y) => {
    const top = canvas.height - (y + 1) * layerH * scale;
    for (let x = 0; x < width; x++)
      for (let z = depth - 1; z >= 0; z--) {
        const ch = [...rows[z]][x];
        if (ch === '.') continue;
        ctx.fillStyle = COLORS[w.palette[ch]].hex;
        ctx.fillRect(x * scale, Math.floor(top), scale, Math.ceil(layerH * scale));
        break;
      }
  });
  return canvas.toDataURL();
}

function renderGallery(filter = '') {
  const q = filter.trim().toLowerCase();
  const list = WORKS.filter((w) => !q || [w.title, w.description, w.author.name, w.id].some((t) => t.toLowerCase().includes(q)));
  const cm = (w) => {
    const h = w.layers.length * UNITS[w.unit].height * 0.8;
    return `${w.layers[0][0].length}×${w.layers[0].length} 凸点 · 高 ${h.toFixed(1)} cm`;
  };
  $('#gallery-grid').innerHTML = list.length
    ? list
        .map(
          (w) => `<a class="card${w.id === work.id && !imported ? ' current' : ''}" href="?w=${w.id}${location.hash}">
            <div class="thumb"><img alt="" src="${thumbnail(w)}" /></div>
            <b>${escapeHtml(w.title)}</b>
            <small>${w.unit === 'plate' ? '薄板' : '砖'} · ${cm(w)}</small>
            <small>by ${escapeHtml(w.author.name)}</small>
          </a>`,
        )
        .join('')
    : `<p class="hint">没有找到“${escapeHtml(filter)}”。</p>`;
}

function setupGallery() {
  const dialog = $('#gallery');
  const search = $('#gallery-search');
  const open = () => {
    renderGallery(search.value);
    dialog.showModal();
    search.focus();
  };
  $('#open-gallery').onclick = open;
  search.oninput = () => renderGallery(search.value);
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !dialog.open) open();
  });
  // 所有对话框：点右上角 ✕ 或点外面的暗处关掉
  document.querySelectorAll('dialog').forEach((d) => {
    d.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => d.close()));
    d.addEventListener('click', (e) => e.target === d && d.close());
  });
}

// ---------- 拼装步骤 ----------
let stepIndex = 0;
const CELL = 20;

function layerMap(y, { current, done, title }) {
  const { x0, x1, z0, z1 } = model.bounds;
  const W = (x1 - x0) * CELL;
  const H = (z1 - z0) * CELL;
  const below = model.bricks.filter((b) => b.y === y - 1);
  const here = model.bricks.filter((b) => b.y === y);
  let svg = '';
  for (const b of below)
    svg += `<rect x="${(b.x - x0) * CELL}" y="${(b.z - z0) * CELL}" width="${b.w * CELL}" height="${b.d * CELL}" fill="#d9dde2" stroke="#c3c8ce" stroke-width="1"/>`;
  for (const b of here) {
    const state = current.has(b.id) ? 'current' : done.has(b.id) ? 'done' : 'todo';
    const hex = COLORS[b.color].hex;
    const x = (b.x - x0) * CELL + 1.5;
    const z = (b.z - z0) * CELL + 1.5;
    const w = b.w * CELL - 3;
    const h = b.d * CELL - 3;
    if (state === 'todo') {
      svg += `<rect x="${x}" y="${z}" width="${w}" height="${h}" rx="3" fill="none" stroke="#9aa3ad" stroke-dasharray="3 3"/>`;
      continue;
    }
    svg += `<g class="${state}"><rect x="${x}" y="${z}" width="${w}" height="${h}" rx="3" fill="${hex}" stroke="${state === 'current' ? '#ff8a00' : 'rgba(0,0,0,.45)'}" stroke-width="${state === 'current' ? 3 : 1}"/>`;
    for (let i = 0; i < b.w; i++)
      for (let j = 0; j < b.d; j++)
        svg += `<circle cx="${(b.x - x0 + i + 0.5) * CELL}" cy="${(b.z - z0 + j + 0.5) * CELL}" r="${CELL * 0.3}" fill="${hex}" stroke="rgba(0,0,0,.25)"/>`;
    svg += '</g>';
  }
  return `<figure class="layer-map">
    <figcaption>${title}</figcaption>
    <svg viewBox="-2 -2 ${W + 4} ${H + 4}" width="${W + 4}" height="${H + 4}">${svg}</svg>
    <div class="front">↓ 正面</div>
  </figure>`;
}

function renderStep() {
  const steps = model.steps;
  const step = steps[stepIndex];
  const done = new Set(steps.slice(0, stepIndex).flatMap((s) => s.bricks));
  const current = new Set(step.bricks);
  const count = step.bricks.length;
  const section = step.section ? ` · ${step.section}` : '';

  let title;
  let text;
  let maps;
  if (step.kind === 'layer') {
    title = `第 ${step.y + 1} 层${step.parts > 1 ? `（${step.part}/${step.parts}）` : ''}${section}`;
    text = `把下面 ${count} 块${unit.zh}按到第 ${step.y} 层上面（橙色框是这一步要放的）。`;
    if (step.y === 0) text = `从最底层开始：把这 ${count} 块${unit.zh}摆在桌面上（橙色框）。`;
    maps = layerMap(step.y, { current, done, title: `第 ${step.y + 1} 层 俯视图` });
  } else {
    const ys = [...new Set(step.bricks.map((id) => model.bricks[id].y))].sort((a, b) => b - a);
    const multi = step.groups.some((g) => g.length > 1);
    title = `挂上悬空的${unit.zh}${section}`;
    text = multi
      ? `这 ${step.groups.length} 组${unit.zh}下面没有东西托着（比如垂下来的手臂）。先把每组按图叠好，再从下面扣到第 ${step.y + 1} 层的底下。`
      : `这 ${count} 块${unit.zh}伸出在外面、下面是空的，要等第 ${step.y + 1} 层放好后，从下面往上扣住。`;
    maps = ys.map((y) => layerMap(y, { current, done, title: `第 ${y + 1} 层 俯视图` })).join('');
  }

  $('#step-title').textContent = title;
  $('#step-no').textContent = `第 ${stepIndex + 1} 步 / 共 ${steps.length} 步`;
  $('#step-range').value = stepIndex;
  $('#step-text').textContent = text;
  $('#step-parts').innerHTML = step.bom
    .map(
      (r) => `<div class="chip" title="${PART_BY_ID[r.part].name} · ${colorName(r.color)}">
        ${brickIcon(r.part, r.color, 8)}<span>${r.count}×</span><small>${PART_BY_ID[r.part].name.replace(/^[砖板] /, '')} ${colorName(r.color)}</small>
      </div>`,
    )
    .join('');
  $('#step-maps').innerHTML = maps;
  const placed = done.size + current.size;
  $('#step-progress').style.width = `${(placed / partCount) * 100}%`;
  $('#step-count').textContent = `已用 ${placed} / ${partCount} 块`;
  viewer.showStep(steps, stepIndex);
}

function go(i) {
  stepIndex = Math.max(0, Math.min(model.steps.length - 1, i));
  renderStep();
  history.replaceState(null, '', `${location.search}#steps-${stepIndex + 1}`);
}

// ---------- 页面 ----------
const viewer = createViewer($('#view'), model);
renderHeader();
renderIntro();
renderBom();
renderBanner();
setupExport();
setupImport();
setupGallery();
// 触屏上没有滚轮和右键
if (matchMedia('(pointer: coarse)').matches) $('#stage-hint').textContent = '单指旋转 · 双指缩放 · 双指拖动平移';
$('#step-range').max = model.steps.length - 1;

const tooltip = $('#tooltip');
viewer.setHover((b, e) => {
  if (!b) return (tooltip.hidden = true);
  tooltip.hidden = false;
  tooltip.innerHTML = `${brickIcon(b.part, b.color, 7)} <b>${PART_BY_ID[b.part].name}</b> · ${colorName(b.color)} · 第 ${b.y + 1} 层`;
  const r = $('#view').getBoundingClientRect();
  tooltip.style.left = `${e.clientX - r.left + 14}px`;
  tooltip.style.top = `${e.clientY - r.top + 14}px`;
});

function setTab(tab) {
  document.body.dataset.tab = tab;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  selected = null;
  document.querySelectorAll('#bom .active').forEach((el) => el.classList.remove('active'));
  viewer.setAutoRotate(tab === 'model');
  if (tab === 'steps') renderStep();
  else viewer.showAll();
  history.replaceState(null, '', `${location.search}#${tab}${tab === 'steps' ? `-${stepIndex + 1}` : ''}`);
}

document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(
  (a) =>
    (a.onclick = (e) => {
      e.preventDefault();
      setTab(a.dataset.goto);
    }),
);
$('#prev').onclick = () => go(stepIndex - 1);
$('#next').onclick = () => go(stepIndex + 1);
$('#first').onclick = () => go(0);
$('#last').onclick = () => go(model.steps.length - 1);
$('#step-range').oninput = (e) => go(+e.target.value);
$('#reset-cam').onclick = () => viewer.resetCamera();
document.addEventListener('keydown', (e) => {
  if (document.body.dataset.tab !== 'steps' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === ' ') (go(stepIndex + 1), e.preventDefault());
  if (e.key === 'ArrowLeft') go(stepIndex - 1);
});

const m = location.hash.match(/^#(model|parts|steps)(?:-(\d+))?/);
if (m?.[2]) stepIndex = Math.min(model.steps.length - 1, Math.max(0, +m[2] - 1));
setTab(m?.[1] ?? 'model');

// 给截图脚本和调试用
window.__voxbrick = { model, go, setTab, front: () => viewer.front() };
