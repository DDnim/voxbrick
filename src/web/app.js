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
  $('#works').innerHTML =
    WORKS.map((w) => `<a href="?w=${w.id}" class="${w.id === work.id && !imported ? 'active' : ''}">${escapeHtml(w.title)}</a>`).join('') +
    (imported ? `<a href="?w=${IMPORTED}" class="active">导入：${escapeHtml(work.title)}</a>` : '');
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
    `<div class="exports"><button id="dl-csv">下载零件清单（CSV）</button></div>`;

  $('#bom').addEventListener('click', (e) => {
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
  $('#dl-csv').onclick = () => {
    const lines = [['零件', '名称', '颜色', '颜色 id', '色值', '数量'].join(',')];
    for (const r of model.bom) {
      const c = COLORS[r.color];
      lines.push([r.part, PART_BY_ID[r.part].name, c.zh, r.color, c.hex, r.count].join(','));
    }
    download(`${work.id}-parts.csv`, '﻿' + lines.join('\n'), 'text/csv');
  };
}

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- 导入 / 导出 ----------
function setupFiles() {
  $('#dl-work').onclick = () => download(`${work.id}.json`, stringifyWork(work), 'application/json');
  $('#dl-vox').onclick = () => download(`${work.id}.vox`, writeVox(workToGrid(work)), 'application/octet-stream');
  const input = $('#import-file');
  $('#import').onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    try {
      let next;
      if (file.name.toLowerCase().endsWith('.vox')) {
        const grid = readVox(await file.arrayBuffer());
        const id = file.name.replace(/\.vox$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-work';
        const plate = confirm('这个 .vox 按薄板拼吗？\n确定 = 薄板（1 格 = 3.2mm 高）\n取消 = 砖（1 格 = 9.6mm 高）');
        next = gridToWork(grid, {
          id,
          title: file.name.replace(/\.vox$/i, ''),
          description: '从 MagicaVoxel 导入的作品。',
          author: { name: '（填你的名字）' },
          license: 'CC-BY-4.0',
          unit: plate ? 'plate' : 'brick',
        });
      } else next = JSON.parse(await file.text());
      const errors = validateWork(next);
      if (errors.length) throw new Error(errors.join('\n'));
      sessionStorage.setItem('voxbrick:imported', JSON.stringify(next));
      location.href = `?w=${IMPORTED}`;
    } catch (e) {
      alert(`导入失败：\n${e.message}`);
    }
  };
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
setupFiles();
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
