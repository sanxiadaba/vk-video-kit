/** 构建期：条目图（list / steps / bars / timeline / table / cells / band / frames）。 */
import { attrOf, hasAttr, kids, flatten, serialize, textOf, raw, esc } from '../shared/dom.mjs';

const labelOf = (li) => (li.childNodes || []).map(serialize).join('');

/** 数字属性：没写 / 空 / 非数字都算「没有」。 */
const numOf = (node, name) => {
  const v = attrOf(node, name);
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ 分派 */
export function buildBoard(node, as, ctx) {
  if (as === 'table') return buildTable(node);
  if (as === 'list') return buildList(node);
  if (as === 'steps') node.childNodes = [raw(buildSteps(node))];
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
  const span = (cell) => Math.max(1, Number(attrOf(cell, 'colspan') || 1));
  const cols = Math.max(0, ...rows.map((r) => kids(r).filter((c) => c.tagName === 'th' || c.tagName === 'td').reduce((a, c) => a + span(c), 0)));

  const numeric = new Set();
  for (let c = 0; c < cols; c++) {
    const cells = [];
    for (const r of rows) {
      let pos = 0;
      for (const cell of kids(r).filter((n) => n.tagName === 'th' || n.tagName === 'td')) {
        if (pos <= c && c < pos + span(cell)) cells.push(cell);
        pos += span(cell);
      }
    }
    const body = cells.filter((cell) => cell.tagName === 'td');
    if (body.length >= 2 && body.filter(colNum).length * 3 >= body.length * 2) numeric.add(c);
  }
  rows.forEach((tr) => {
    let pos = 0;
    for (const cell of kids(tr).filter((n) => n.tagName === 'th' || n.tagName === 'td')) {
      const s = span(cell);
      if ([...numeric].some((c) => c >= pos && c < pos + s)) {
        const cls = attrOf(cell, 'class');
        cell.attrs = [...(cell.attrs || []).filter((a) => a.name !== 'class'), { name: 'class', value: cls ? `${cls} num` : 'num' }];
      }
      pos += s;
    }
  });

  /* 行锚点：只给数据行编号，表头不算「第几项」。 */
  let item = 0;
  for (const tr of rows) {
    if (!kids(tr).some((c) => c.tagName === 'td')) continue;
    item++;
    tr.attrs = [...(tr.attrs || []).filter((a) => a.name !== 'data-vk-item'), { name: 'data-vk-item', value: String(item) }];
  }

  /* 表题只认原生 <caption>：搬进 .vk-cap，和表格一起放进同一个壳。 */
  const cap = kids(table).find((c) => c.tagName === 'caption');
  const capHtml = cap ? `<div class="vk-cap">${(cap.childNodes || []).map(serialize).join('')}</div>` : '';
  if (cap) table.childNodes = (table.childNodes || []).filter((c) => c !== cap);
  node.childNodes = [...(capHtml ? [raw(capHtml)] : []), table];
}

/* ------------------------------------------------------------------ 列表 */
function buildList(node) {
  kids(node)
    .filter((c) => c.tagName === 'li')
    .forEach((li, i) => {
      const attrs = (li.attrs || []).filter((a) => a.name !== 'data-vk-item');
      attrs.push({ name: 'data-vk-item', value: String(i + 1) });
      const note = attrOf(li, 'note');
      if (note) attrs.push({ name: 'data-vk-note', value: note });
      li.attrs = attrs;
    });
}

/* ------------------------------------------------------------------ 步骤 */
function buildSteps(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const dir = attrOf(node, 'direction') || 'auto';
  const html = items
    .map((li, i) => {
      const tone = attrOf(li, 'tone') || 'neutral';
      const note = attrOf(li, 'note');
      return `<div class="vk-step" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(tone)}"><span class="vk-step-n">${i + 1}</span><span class="vk-step-t"><span class="vk-step-l">${labelOf(li)}</span></span>${note ? `<span class="vk-step-note">${esc(note)}</span>` : ''}</div>`;
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
  /* 4%–96%：首末事件贴近版心，轴吃满可用宽。 */
  const lefts = items.map((li, i) => {
    const t = proportional ? (Number(attrOf(li, 'at')) - start) / (end - start) : (i + 0.5) / Math.max(1, items.length);
    return Math.max(12, Math.min(88, 12 + 76 * t));
  });

  /* 一条连续轴，从第一个节点到最后一个节点；节点画在轴上面，不再把轴切断。 */
  const segs = lefts.length > 1
    ? [`<span class="vk-tl-seg" style="left:${lefts[0].toFixed(2)}%;width:${(lefts[lefts.length - 1] - lefts[0]).toFixed(2)}%"></span>`]
    : [];

  const html = items
    .map((li, i) => {
      const at = Number(attrOf(li, 'at'));
      if (proportional && Number.isFinite(at) && (at < start || at > end)) {
        ctx.diag(li, { code: 'VALUE_RANGE', message: `时间线的 at=${at} 不在 ${start}–${end} 之间，被夹到边上`, fix: `改成 ${start}–${end}；夹取会让时间轴说谎` });
      }
      const left = lefts[i];
      const date = attrOf(li, 'date') || (Number.isFinite(at) ? String(at) : '');
      const note = attrOf(li, 'note');
      return `<div class="vk-tl-i" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-at:${left.toFixed(2)}%"><span class="vk-tl-date">${esc(date)}</span><span class="vk-tl-dot"></span><span class="vk-tl-label">${labelOf(li)}</span>${note ? `<span class="vk-tl-note">${esc(note)}</span>` : ''}</div>`;
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

/* ------------------------------------------------------------------ 区间带
   一条轴上的有起止的横条：时间片、ELF 段、地址空间、流水线。
   域：容器 start/end；没写就用所有 li 的 min/max。 */
const pct = (v, a, b) => `${Number(Math.max(0, Math.min(100, ((v - a) / (b - a)) * 100)).toFixed(2))}%`;

export function buildBand(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const points = [];
  for (const li of items) {
    const s = numOf(li, 'start');
    const e = numOf(li, 'end');
    if (s != null) points.push(s);
    if (e != null) points.push(e);
  }
  let a = numOf(node, 'start');
  let b = numOf(node, 'end');
  if (a == null) a = points.length ? Math.min(...points) : 0;
  if (b == null) b = points.length ? Math.max(...points) : Math.max(items.length, 1);
  if (!(b > a)) b = a + 1;

  const lane = hasAttr(node, 'lane');
  const rows = items
    .map((li, i) => {
      const s = numOf(li, 'start');
      const e = numOf(li, 'end');
      const tone = attrOf(li, 'tone') || 'neutral';
      const labelAttr = attrOf(li, 'label');
      const label = labelAttr ? esc(labelAttr) : labelOf(li);
      const note = attrOf(li, 'note');
      const hole = s == null || e == null;
      /* 校验已报过 BAND_RANGE 就不再重复；这里只负责把缺段画成整行淡底。 */
      if (hole && !ctx.diag.has(li, 'BAND_RANGE')) {
        ctx.diag(li, { code: 'BAND_RANGE', message: `区间第 ${i + 1} 段缺 start/end，画成整行淡底`, fix: '每条 <li> 都要写 start="…" end="…"（数字）' });
      }
      const bar = hole ? '<i style="--vk-s:0%;--vk-e:100%"></i>' : `<i style="--vk-s:${pct(s, a, b)};--vk-e:${pct(e, a, b)}"></i>`;
      return `<div class="vk-band-r" data-vk-item="${i + 1}"${lane ? ` data-lane="${i}"` : ''} data-tone="${esc(tone)}"${hole ? ' data-vk-bad="1"' : ''}${hasAttr(li, 'current') ? ' current' : ''}><span class="vk-band-l">${label}</span><span class="vk-band-t">${bar}</span>${note ? `<span class="vk-band-n">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');

  const unit = attrOf(node, 'unit');
  const axis = `<div class="vk-band-axis"><span class="vk-band-from">${esc(String(a))}</span><span class="vk-band-to">${esc(String(b))}</span>${unit ? `<span class="vk-band-unit">${esc(unit)}</span>` : ''}</div>`;
  return `<div class="vk-band" style="--vk-a:${a};--vk-b:${b}"><div class="vk-band-rows">${rows}</div>${axis}</div>`;
}

/* ------------------------------------------------------------------ 栈帧
   一摞栈帧，一帧一行字段；正文首行当帧名，其余行保留行内标签。 */
const frameLines = (li) => {
  const out = [];
  let cur = [];
  for (const c of li.childNodes || []) {
    if (c.tagName === 'br') {
      out.push(cur.map(serialize).join(''));
      cur = [];
    } else cur.push(c);
  }
  out.push(cur.map(serialize).join(''));
  return out;
};

export function buildFrames(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const dir = attrOf(node, 'direction') || 'down';
  const top = attrOf(node, 'top-label');
  const rows = items
    .map((li, i) => {
      const lines = frameLines(li);
      const titleAttr = attrOf(li, 'title');
      let title = '';
      let rest = lines;
      if (titleAttr) title = esc(titleAttr);
      else {
        const k = lines.findIndex((s) => s.trim());
        title = k >= 0 ? lines[k].trim() : '';
        rest = k >= 0 ? [...lines.slice(0, k), ...lines.slice(k + 1)] : [];
      }
      const body = rest.map((s) => s.trim()).filter(Boolean).join('<br>');
      const note = attrOf(li, 'note');
      const hd = title || note ? `<div class="vk-fr-h">${title ? `<span class="vk-fr-t">${title}</span>` : ''}${note ? `<span class="vk-fr-n">${esc(note)}</span>` : ''}</div>` : '';
      return `<div class="vk-fr" data-vk-item="${i + 1}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"${hasAttr(li, 'current') ? ' current' : ''}>${hd}<div class="vk-fr-b">${body}</div></div>`;
    })
    .join('');
  return `<div class="vk-frames" data-dir="${dir}">${top != null && top !== '' ? `<div class="vk-fr-top">${esc(top)}</div>` : ''}${rows}</div>`;
}
