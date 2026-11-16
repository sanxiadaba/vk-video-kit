/** 构建期：条目图（list / steps / bars / timeline / table / cells）与两个文本网格（bytes / bits）。 */
import { attrOf, hasAttr, kids, flatten, serialize, textOf, raw, esc } from '../shared/dom.mjs';
import { frame } from './frame.mjs';

const labelOf = (li) => (li.childNodes || []).map(serialize).join('');

/* ------------------------------------------------------------------ 分派 */
export function buildBoard(node, as, ctx) {
  if (as === 'table') return buildTable(node);
  if (as === 'list') return buildList(node);
  if (as === 'steps') node.childNodes = [raw(buildSteps(node, ctx))];
  else if (as === 'bars') node.childNodes = [raw(buildBars(node))];
  else if (as === 'timeline') node.childNodes = [raw(buildTimeline(node, ctx))];
  else if (as === 'cells') node.childNodes = [raw(buildCells(node))];
}

/* ------------------------------------------------------------------ 表格 */
function colNum(cell) {
  const t = textOf(cell).trim();
  return /^[-+−×x*≈~<>]?\s*[\d.,]+\s*[a-zA-Z%µ]*$/.test(t) || /^[-+]?\d+(\.\d+)?[a-zA-Z%]*$/.test(t);
}

function buildTable(node) {
  const table = kids(node).find((c) => c.tagName === 'table');
  if (!table) {
    node.childNodes = [raw('<div class="vk-missing">表格里要有原生 &lt;table&gt;</div>')];
    return;
  }
  const rows = flatten(table).filter((n) => n.tagName === 'tr');
  const cols = Math.max(0, ...rows.map((r) => flatten(r).filter((c) => c.tagName === 'th' || c.tagName === 'td').length));
  node.attrs = [...(node.attrs || []).filter((a) => a.name !== 'data-cols'), { name: 'data-cols', value: String(cols) }];

  const numeric = new Set();
  for (let c = 0; c < cols; c++) {
    const cells = rows.map((r) => flatten(r).filter((n) => n.tagName === 'th' || n.tagName === 'td')[c]).filter(Boolean);
    const body = cells.filter((cell) => cell.tagName === 'td');
    if (body.length >= 2 && body.filter(colNum).length * 3 >= body.length * 2) numeric.add(c);
  }
  rows.forEach((tr) => {
    flatten(tr)
      .filter((n) => n.tagName === 'th' || n.tagName === 'td')
      .forEach((cell, c) => {
        if (!numeric.has(c)) return;
        const cls = attrOf(cell, 'class');
        cell.attrs = [...(cell.attrs || []).filter((a) => a.name !== 'class'), { name: 'class', value: cls ? `${cls} num` : 'num' }];
      });
  });

  /* 行锚点：只给数据行编号，表头不算「第几项」。 */
  let item = 0;
  for (const tr of rows) {
    if (!kids(tr).some((c) => c.tagName === 'td')) continue;
    item++;
    tr.attrs = [...(tr.attrs || []).filter((a) => a.name !== 'data-vk-item'), { name: 'data-vk-item', value: String(item) }];
  }

  const cap = attrOf(node, 'caption');
  node.childNodes = [...(cap ? [raw(`<div class="vk-cap">${esc(cap)}</div>`)] : []), table];
}

/* ------------------------------------------------------------------ 列表 */
function buildList(node) {
  kids(node)
    .filter((c) => c.tagName === 'li')
    .forEach((li, i) => {
      li.attrs = [...(li.attrs || []).filter((a) => a.name !== 'data-vk-item'), { name: 'data-vk-item', value: String(i + 1) }];
    });
}

/* ------------------------------------------------------------------ 步骤 */
function buildSteps(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const dir = attrOf(node, 'direction') || 'auto';
  const html = items
    .map((li, i) => {
      const tone = attrOf(li, 'tone') || 'neutral';
      const note = attrOf(li, 'note');
      const icon = attrOf(li, 'icon');
      const svg = icon ? ctx.icon(icon) : '';
      if (icon && !svg) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `步骤的 icon="${icon}" 找不到`, fix: '用 vk icons <词> 搜 Lucide 名' });
      return `<div class="vk-step" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(tone)}"><span class="vk-step-n">${i + 1}</span><span class="vk-step-t">${svg || ''}<span class="vk-step-l">${labelOf(li)}</span></span>${note ? `<span class="vk-step-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-steps" data-dir="${dir}" style="--vk-n:${items.length || 1}">${html}</div>`;
}

/* ------------------------------------------------------------------ 条 */
function buildBars(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const values = items.map((li) => Number(attrOf(li, 'value') || 0)).filter((n) => Number.isFinite(n));
  const max = Number(attrOf(node, 'max') || Math.max(...values, 1));
  const log = attrOf(node, 'scale') === 'log';
  const unit = attrOf(node, 'unit') || '';
  const html = items
    .map((li, i) => {
      const v = Number(attrOf(li, 'value') || 0);
      const ratio = log ? Math.log10(Math.max(1, v) + 1) / Math.log10(Math.max(1, max) + 1) : v / max;
      const pct = Math.max(2, Math.min(100, ratio * 100));
      return `<div class="vk-bar" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"><span class="vk-bar-l">${labelOf(li)}</span><span class="vk-bar-t"><i style="width:${pct.toFixed(1)}%"></i></span><span class="vk-bar-v">${esc(String(v))}${unit ? `<span class="vk-unit">${esc(unit)}</span>` : ''}</span></div>`;
    })
    .join('');
  return `<div class="vk-bars">${html}</div>`;
}

/* ------------------------------------------------------------------ 时间线 */
function buildTimeline(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const start = Number(attrOf(node, 'start'));
  const end = Number(attrOf(node, 'end'));
  const proportional = Number.isFinite(start) && Number.isFinite(end) && end > start && items.every((li) => Number.isFinite(Number(attrOf(li, 'at'))));
  const lefts = items.map((li, i) => {
    const p = proportional ? 12 + 76 * ((Number(attrOf(li, 'at')) - start) / (end - start)) : 12 + 76 * ((i + 0.5) / Math.max(1, items.length));
    return Math.max(4, Math.min(96, p));
  });

  /* 轴线只在数据域内：从第一个节点到最后一个节点，不画 0–100% 的假历史。 */
  const cut = 2.6;
  const segs = [];
  let prev = lefts.length ? lefts[0] : 0;
  for (let i = 1; i < lefts.length; i++) {
    const p = lefts[i];
    const from = prev + cut;
    const to = p - cut;
    if (to > from) segs.push(`<span class="vk-tl-seg" style="left:${from.toFixed(2)}%;width:${(to - from).toFixed(2)}%"></span>`);
    prev = p;
  }

  const html = items
    .map((li, i) => {
      const at = Number(attrOf(li, 'at'));
      const left = lefts[i];
      const date = attrOf(li, 'date') || (Number.isFinite(at) ? String(at) : '');
      const note = attrOf(li, 'note');
      const icon = attrOf(li, 'icon');
      const svg = icon ? ctx.icon(icon) : '';
      if (icon && !svg) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `时间线的 icon="${icon}" 找不到`, fix: '用 vk icons <词> 搜 Lucide 名' });
      const nodeMark = icon ? `<span class="vk-tl-node">${svg}</span>` : '<span class="vk-tl-dot"></span>';
      return `<div class="vk-tl-i" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-at:${left.toFixed(2)}%"><span class="vk-tl-date">${esc(date)}</span>${nodeMark}<span class="vk-tl-label">${labelOf(li)}</span>${note ? `<span class="vk-tl-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-tl${proportional ? ' is-prop' : ''}">${segs.join('')}${html}</div>`;
}

/* ------------------------------------------------------------------ 内存格 */
function buildCells(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const stride = Number(attrOf(node, 'stride') || 1);
  const base = attrOf(node, 'addr');
  const baseNum = base != null ? Number(base) : null;
  const cols = Number(attrOf(node, 'cols') || 4);
  const width = baseNum != null ? Math.max(4, (baseNum + items.length * stride).toString(16).length) : 0;

  const cells = items.map((li, i) => {
    const value = attrOf(li, 'value') ?? '';
    const name = attrOf(li, 'label') ?? '';
    const ptr = attrOf(li, 'ptr') || '';
    const was = attrOf(li, 'was');
    const cur = hasAttr(li, 'current') ? ' current' : '';
    const tone = attrOf(li, 'tone') || 'neutral';
    const addr = baseNum != null ? `0x${(baseNum + i * stride).toString(16).padStart(width, '0')}` : '';
    const vline = was != null ? `<span class="vk-cell-was">${esc(was)}</span><span class="vk-cell-arrow">→</span><span class="vk-cell-v">${esc(value)}</span>` : `<span class="vk-cell-v">${esc(value)}</span>`;
    return (
      `<div class="vk-cell" data-vk-item="${i + 1}" data-tone="${esc(tone)}"${cur}>` +
      (ptr ? `<span class="vk-cell-p">${esc(ptr)}</span>` : '') +
      `<span class="vk-cell-vline">${vline}</span>` +
      `<span class="vk-cell-l">${esc(name)}</span>` +
      (addr ? `<span class="vk-cell-a">${addr}</span>` : '') +
      `</div>`
    );
  });
  return `<div class="vk-cells" style="--vk-cols:${cols}">${cells.join('')}</div>`;
}
