/** 构建期：步骤、条、时间线、关系图、时序。 */
import { attrOf, hasAttr, kids, serialize, esc } from '../shared/dom.mjs';

const labelOf = (li) => (li.childNodes || []).map(serialize).join('');

/* ------------------------------------------------------------------ 步骤 */
export function buildSteps(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const dir = attrOf(node, 'direction') || 'auto';
  const html = items
    .map((li, i) => {
      const tone = attrOf(li, 'tone') || 'neutral';
      const note = attrOf(li, 'note');
      const icon = attrOf(li, 'icon');
      const svg = icon ? ctx.icon(icon) : '';
      if (icon && !svg) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `<vk-steps> 的 icon="${icon}" 找不到`, fix: '用 vk icons <词> 搜 Lucide 名' });
      return `<div class="vk-step" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(tone)}"><span class="vk-step-n">${i + 1}</span><span class="vk-step-t">${svg || ''}<span class="vk-step-l">${labelOf(li)}</span></span>${note ? `<span class="vk-step-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-steps" data-dir="${dir}" style="--vk-n:${items.length || 1}">${html}</div>`;
}

/* ------------------------------------------------------------------ 条 */
export function buildBars(node) {
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
export function buildTimeline(node, ctx) {
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
      if (icon && !svg) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `<vk-timeline> 的 icon="${icon}" 找不到`, fix: '用 vk icons <词> 搜 Lucide 名' });
      const nodeMark = icon ? `<span class="vk-tl-node">${svg}</span>` : '<span class="vk-tl-dot"></span>';
      return `<div class="vk-tl-i" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-at:${left.toFixed(2)}%"><span class="vk-tl-date">${esc(date)}</span>${nodeMark}<span class="vk-tl-label">${labelOf(li)}</span>${note ? `<span class="vk-tl-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-tl${proportional ? ' is-prop' : ''}">${segs.join('')}${html}</div>`;
}

/* ------------------------------------------------------------------ 关系图 */
export function buildGraph(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const isEdge = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
  const nodes = items.filter((li) => !isEdge(li));
  const edges = items.filter(isEdge);

  const nodeHtml = nodes
    .map((li, i) => {
      const id = attrOf(li, 'id') || `n${i + 1}`;
      const note = attrOf(li, 'note');
      const after = (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean).join(' ');
      const lane = attrOf(li, 'lane');
      return `<div class="vk-gnode" data-vk-item="${i + 1}" data-id="${esc(id)}"${attrOf(li, 'id') ? ` id="${esc(attrOf(li, 'id'))}"` : ''} data-after="${esc(after)}"${lane != null ? ` data-lane="${esc(lane)}"` : ''}${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"><span class="vk-gn-l">${labelOf(li)}</span>${note ? `<span class="vk-gn-n">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');

  const edgeHtml = edges
    .map((li) => `<i class="vk-gedge" data-from="${esc(attrOf(li, 'from') || '')}" data-to="${esc(attrOf(li, 'to') || '')}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}">${labelOf(li)}</i>`)
    .join('');

  return `<div class="vk-graph" data-layout="${attrOf(node, 'layout') || 'row'}" data-dir="${attrOf(node, 'direction') || 'horizontal'}"><div class="vk-gstage">${nodeHtml}${edgeHtml}</div><svg class="vk-gedges" aria-hidden="true"></svg></div>`;
}

/* ------------------------------------------------------------------ 时序 */
const seqLane = (v, names) => {
  if (v == null || v === '') return null;
  if (/^\d+$/.test(String(v))) return Number(v) - 1;
  return names.indexOf(String(v));
};

export function buildSeq(node, ctx) {
  const partText = attrOf(node, 'participants');
  let names = partText ? partText.split(',').map((s) => s.trim()).filter(Boolean) : [attrOf(node, 'a') || '', attrOf(node, 'b') || ''];
  if (!partText && (!names[0] || !names[1])) names = ['A', 'B'];
  if (names.length < 2 || names.length > 4) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_ENUM', message: `<vk-seq> 需要 2–4 个参与者，现在 ${names.length} 个`, fix: '写 participants="客户端,服务端,缓存"' });
    names = names.slice(0, 4);
    while (names.length < 2) names.push(names.length ? 'B' : 'A');
  }
  const n = names.length;
  const x = (i) => (n === 1 ? 50 : 7.14 + (85.72 * i) / (n - 1));
  const items = kids(node).filter((c) => c.tagName === 'li');

  const rows = items.map((li, i) => {
    const from = seqLane(attrOf(li, 'from'), names);
    const to = seqLane(attrOf(li, 'to'), names);
    const dir = attrOf(li, 'direction') || 'right';
    let a = from;
    let b = to;
    if (a == null && b == null) a = dir === 'left' ? 1 : 0, b = dir === 'left' ? 0 : 1;
    else if (a == null) a = Math.max(0, b - 1);
    else if (b == null) b = Math.min(n - 1, a + 1);
    if (a < 0 || a >= n || b < 0 || b >= n) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_ENUM', message: `<vk-seq> 的消息 ${i + 1} 指向不存在的参与者`, fix: `可用：${names.join(' / ')} 或 1–${n}` });
      a = 0;
      b = Math.min(1, n - 1);
    }
    if (a === b) b = a === 0 ? 1 : a - 1;
    const x1 = x(a);
    const x2 = x(b);
    const rightward = x2 >= x1;
    const note = attrOf(li, 'note');
    return `<div class="vk-seq-row" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-dir="${rightward ? 'right' : 'left'}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-x1:${x1.toFixed(2)}%;--vk-x2:${x2.toFixed(2)}%;--vk-mid:${((x1 + x2) / 2).toFixed(2)}%"><span class="vk-seq-l">${labelOf(li)}</span><span class="vk-seq-arrow"></span>${note ? `<span class="vk-seq-note">${esc(note)}</span>` : ''}</div>`;
  });

  const head = names.map((name, i) => `<span style="--vk-x:${x(i).toFixed(2)}%">${esc(name)}</span>`).join('');
  const lanes = names.map((_, i) => `<span class="vk-seq-lane" style="--vk-x:${x(i).toFixed(2)}%"></span>`).join('');
  return `<div class="vk-seq" style="--vk-lanes:${n}"><div class="vk-seq-head">${head}</div><div class="vk-seq-body">${lanes}${rows.join('')}</div></div>`;
}
