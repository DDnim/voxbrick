import { buildModel, COLORS, PART_BY_ID } from '../core/instructions.js';
import { UNITS } from '../core/catalog.js';
import { validateWork, workToGrid, gridToWork, stringifyWork } from '../core/work.js';
import { readVox, writeVox } from '../core/vox.js';
import { createViewer } from './viewer.js';
import { lang, LANGS, switchLang, t, unitWord, colorName, partName, partSize, localizeWork, applyStatic } from './i18n.js';
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

// work 是原文件（导出用），shown 是换成当前语言后的（显示用）
const work = currentWork();
const shown = localizeWork(work);
const model = buildModel(shown);
const imported = params.get('w') === IMPORTED;
const u = unitWord(work.unit);
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
  document.title = t('docTitle', shown.title);
  $('#work-title').textContent = shown.title;
  $('#work-count').textContent = WORKS.length;
  const colors = new Set(model.bom.map((r) => r.color)).size;
  const parts = new Set(model.bom.map((r) => r.part)).size;
  const [w, d, h] = model.size.cm.map((v) => v.toFixed(1));
  $('#summary').innerHTML = `
    <span>${t('pieces', partCount, u)}</span>
    <span>${t('kinds', parts, colors)}</span>
    <span>${t('dims', w, d, h, model.size.studs[0], model.size.studs[1], model.size.layers)}</span>
    <span class="${model.componentCount === 1 ? 'ok' : 'ng'}">${model.componentCount === 1 ? t('connected') : t('split', model.componentCount)}</span>
    <span class="${model.balance.inside ? 'ok' : 'ng'}">${model.balance.inside ? t('balanced') : t('unbalanced')}</span>`;
}

function renderIntro() {
  const author = work.author.url
    ? `<a href="${escapeHtml(work.author.url)}" target="_blank" rel="noopener">${escapeHtml(work.author.name)}</a>`
    : escapeHtml(work.author.name);
  $('#intro-title').textContent = shown.title;
  $('#intro-body').textContent = shown.description;
  $('#intro-meta').innerHTML = t('introMeta', author, escapeHtml(work.license), work.unit);
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
    `<p class="hint">${t('bomHint')}</p>` +
    [...groups.entries()]
      .map(([color, rows]) => {
        const c = COLORS[color];
        const total = rows.reduce((s, r) => s + r.count, 0);
        return `<section class="color-group">
          <button class="color-head" data-color="${color}">
            <i class="swatch" style="background:${c.hex}"></i>
            <span class="cname">${colorName(color)}</span>
            <span class="cmeta">${c.hex}</span>
            <span class="count">${total}</span>
          </button>
          ${rows
            .map(
              (r) => `<button class="bom-row" data-color="${color}" data-part="${r.part}">
                <span class="icon">${brickIcon(r.part, color)}</span>
                <span class="pname">${partName(r.part)}</span>
                <span class="pid">${r.part}</span>
                <span class="count">× ${r.count}</span>
              </button>`,
            )
            .join('')}
        </section>`;
      })
      .join('') +
    `<div class="exports"><button data-export="csv">${t('bomCsv')}</button></div>`;

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
    const lines = [t('csvHeader').join(',')];
    for (const r of model.bom) {
      const c = COLORS[r.color];
      lines.push([r.part, partName(r.part), colorName(r.color), r.color, c.hex, r.count].join(','));
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
      $('#import-file-name').textContent = t('voxInfo', file.name, b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0, pendingVox.grid.size);
      $('#import-title').value = pendingVox.name;
      $('#import-vox-options').hidden = false;
    } else if (file.name.toLowerCase().endsWith('.json')) {
      let next;
      try {
        next = JSON.parse(await file.text());
      } catch (e) {
        return showImportErrors([t('badJson', e.message)]);
      }
      preview(next);
    } else showImportErrors([t('badKind')]);
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
        description: t('voxDescription', title),
        author: { name: t('authorPlaceholder') },
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
  banner.innerHTML = t('banner', `?w=${WORKS[0].id}`);
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
  // 中英文的标题、说明都能搜到
  const text = (w) => [w.title, w.description, w.author.name, w.id, ...Object.values(w.i18n ?? {}).flatMap((tr) => [tr.title, tr.description])];
  const list = WORKS.filter((w) => !q || text(w).some((s) => s?.toLowerCase().includes(q)));
  const cm = (w) => t('cardSize', w.layers[0][0].length, w.layers[0].length, (w.layers.length * UNITS[w.unit].height * 0.8).toFixed(1));
  $('#gallery-grid').innerHTML = list.length
    ? list
        .map(
          (w) => `<a class="card${w.id === work.id && !imported ? ' current' : ''}" href="?w=${w.id}${location.hash}">
            <div class="thumb"><img alt="" src="${thumbnail(w)}" /></div>
            <b>${escapeHtml(localizeWork(w).title)}</b>
            <small>${t('cardUnit', w.unit)} · ${cm(w)}</small>
            <small>by ${escapeHtml(w.author.name)}</small>
          </a>`,
        )
        .join('')
    : `<p class="hint">${t('notFound', escapeHtml(filter))}</p>`;
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
    <div class="front">${t('front')}</div>
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
    title = `${t('layerN', step.y + 1)}${step.parts > 1 ? t('partOf', step.part, step.parts) : ''}${section}`;
    text = step.y === 0 ? t('firstStep', count, u) : t('layerStep', count, u, step.y);
    maps = layerMap(step.y, { current, done, title: t('layerMap', step.y + 1) });
  } else {
    const ys = [...new Set(step.bricks.map((id) => model.bricks[id].y))].sort((a, b) => b - a);
    const multi = step.groups.some((g) => g.length > 1);
    title = `${t('hangTitle', u)}${section}`;
    text = multi ? t('hangGroups', step.groups.length, u, step.y + 1) : t('hangSingle', count, u, step.y + 1);
    maps = ys.map((y) => layerMap(y, { current, done, title: t('layerMap', y + 1) })).join('');
  }

  $('#step-title').textContent = title;
  $('#step-no').textContent = t('stepNo', stepIndex + 1, steps.length);
  $('#step-range').value = stepIndex;
  $('#step-text').textContent = text;
  $('#step-parts').innerHTML = step.bom
    .map(
      (r) => `<div class="chip" title="${partName(r.part)} · ${colorName(r.color)}">
        ${brickIcon(r.part, r.color, 8)}<span>${r.count}×</span><small>${partSize(r.part)} ${colorName(r.color)}</small>
      </div>`,
    )
    .join('');
  $('#step-maps').innerHTML = maps;
  const placed = done.size + current.size;
  $('#step-progress').style.width = `${(placed / partCount) * 100}%`;
  $('#step-count').textContent = t('used', placed, partCount);
  viewer.showStep(steps, stepIndex);
}

function go(i) {
  stepIndex = Math.max(0, Math.min(model.steps.length - 1, i));
  renderStep();
  history.replaceState(null, '', `${location.search}#steps-${stepIndex + 1}`);
}

// ---------- 页面 ----------
applyStatic();
// 语言按钮显示“另一种语言”，点了就切过去
const otherLang = Object.keys(LANGS).find((l) => l !== lang);
$('#lang-toggle').textContent = otherLang === 'en' ? 'EN' : '中文';
$('#lang-toggle').onclick = () => switchLang(otherLang);
const viewer = createViewer($('#view'), model);
renderHeader();
renderIntro();
renderBom();
renderBanner();
setupExport();
setupImport();
setupGallery();
// 触屏上没有滚轮和右键
if (matchMedia('(pointer: coarse)').matches) $('#stage-hint').textContent = t('stageHintTouch');
$('#step-range').max = model.steps.length - 1;

const tooltip = $('#tooltip');
viewer.setHover((b, e) => {
  if (!b) return (tooltip.hidden = true);
  tooltip.hidden = false;
  tooltip.innerHTML = `${brickIcon(b.part, b.color, 7)} <b>${partName(b.part)}</b> · ${colorName(b.color)} · ${t('tooltipLayer', b.y + 1)}`;
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
