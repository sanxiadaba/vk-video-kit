/** 构建期：条目图（list / steps / bars / timeline / table / cells）与两个文本网格（bytes / bits）。 */
import { attrOf, hasAttr, kids, flatten, serialize, textOf, raw, esc } from '../shared/dom.mjs';
import { lineSet } from '../shared/range.mjs';
import { FONT } from '../vocab.mjs';
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

/* ------------------------------------------------------------------ 字节 */
function inlineBytes(node) {
  const script = (node.childNodes || []).find((c) => c.tagName === 'script');
  const text = script ? (script.childNodes || []).map((c) => c.value || '').join('') : textOf(node);
  const tokens = String(text).replace(/0x/gi, ' ').split(/[\s,]+/).filter(Boolean);
  const bytes = [];
  for (const token of tokens) {
    if (/^[0-9a-f]{1,2}$/i.test(token)) bytes.push(parseInt(token, 16));
    else return { error: token };
  }
  return bytes.length ? { bytes } : null;
}

export function buildBytes(node, ctx) {
  const src = attrOf(node, 'src');
  const inline = src ? null : inlineBytes(node);
  if (src && inlineBytes(node)) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_CONFLICT', message: '字节窗同时写了 src 和内联字节：只能二选一', fix: '删掉 src，或删掉内联内容' });
    return '<div class="vk-missing">字节源冲突</div>';
  }
  if (!src && !inline) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '字节窗没有内容', fix: '写 src="文件.bin"，或内联十六进制如 68 65 6c 6c 6f' });
    return '<div class="vk-missing">字节缺内容</div>';
  }
  if (inline?.error) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `内联字节里有 "${inline.error}"，不是两位十六进制`, fix: '每字节写两位十六进制，如 68 65 6c' });
    return '<div class="vk-missing">内联字节格式不对</div>';
  }

  let buf;
  if (src) {
    const { resolveAsset } = ctx;
    const abs = resolveAsset(src);
    if (!abs) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `字节窗的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">字节文件不存在</div>';
    }
    buf = ctx.read(abs);
  } else {
    buf = Buffer.from(inline.bytes);
  }

  const start = Number(attrOf(node, 'offset') || 0) || 0;
  const len = Math.max(0, Math.min(Number(attrOf(node, 'length') || 32), buf.length - start));
  const cols = Number(attrOf(node, 'cols') || 8);
  const base = Number(attrOf(node, 'addr') || '0x0');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `字节窗的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
  const width = Math.max(4, (base + start + len).toString(16).length);
  const rows = [];
  for (let i = 0; i < len; i += cols) {
    const bytes = [...buf.subarray(start + i, start + i + cols)];
    const hex = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${b.toString(16).padStart(2, '0')}</i>`).join('');
    const ascii = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${esc(b >= 32 && b < 127 ? String.fromCharCode(b) : '·')}</i>`).join('');
    rows.push(`<div class="vk-brow"><span class="vk-baddr">0x${(base + start + i).toString(16).padStart(width, '0')}</span><span class="vk-bhex">${hex}</span><span class="vk-bascii">${ascii}</span></div>`);
  }
  const head = '<div class="vk-bhead"><span>地址</span><span>十六进制</span><span>ASCII</span></div>';
  const bcol = '7ch';
  const bhexw = `${cols * 3}ch`;
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-bytes" style="--vk-cols:${cols};--vk-bcol:${bcol};--vk-bhexw:${bhexw}">${head}${rows.join('')}</div>`, kind: 'bytes' });
}

/* ------------------------------------------------------------------ 位 */
export function buildBits(node, ctx) {
  const rawValue = attrOf(node, 'value') || '';
  if (!rawValue.trim()) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '位域没有 value', fix: 'value="0|01111|0000000000"' });
    return '<div class="vk-missing">位串缺 value</div>';
  }
  const segments = rawValue.split('|');
  const labels = (attrOf(node, 'field-labels') || '').split(',').map((s) => s.trim());
  if (labels.length > 1 && labels.length !== segments.length) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'FIELD_LABELS', message: `位域有 ${segments.length} 段，但 field-labels 有 ${labels.filter(Boolean).length} 个`, fix: '逗号分隔的段名个数要与 | 的段数一致' });
  }
  const index = attrOf(node, 'index') || 'down';
  const sign = hasAttr(node, 'sign');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `位域的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
  const all = segments.join('').replace(/\s+/g, '');

  const fieldHtml = segments.map((seg, fi) => {
    const bits = [...seg.replace(/\s+/g, '')];
    const offset = [...segments.slice(0, fi).join('')].length;
    const cells = bits
      .map((b, bi) => {
        const globalIdx = offset + bi;
        const weight = all.length - 1 - globalIdx;
        const label = index === 'none' ? '' : index === 'sparse' ? (weight % 8 === 0 ? String(weight) : '') : index === 'up' ? String(globalIdx) : String(weight);
        const isSign = sign && globalIdx === 0;
        const isCur = cur?.has(globalIdx + 1) ? ' is-cur' : '';
        return `<i class="vk-bit${isSign ? ' is-sign' : ''}${isCur}" data-vk-bit="${globalIdx + 1}"><b class="vk-bit-i">${label}</b><span class="vk-bit-v">${esc(b)}</span></i>`;
      })
      .join('');
    const fieldCur = cur && bits.some((_, bi) => cur.has(offset + bi + 1));
    return `<div class="vk-field${fieldCur ? ' is-cur' : ''}" data-vk-item="${fi + 1}">${labels[fi] ? `<span class="vk-field-l">${esc(labels[fi])}</span>` : ''}<span class="vk-field-bits">${cells}</span></div>`;
  });
  const left = attrOf(node, 'label') ? `<span class="vk-bits-label">${esc(attrOf(node, 'label'))}</span>` : '';
  const body = `<div class="vk-bits" data-index="${index}">${left}<div class="vk-bits-body">${fieldHtml.join('')}</div></div>`;
  const title = attrOf(node, 'title');
  return title ? frame({ title, body, kind: 'bits' }) : body;
}
