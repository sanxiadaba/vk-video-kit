/**
 * v26 · 字节与位域
 * ----------------------------------------------------------------------------
 * 两件都是「把一串二进制摊成格子」：字节窗按 8 列排十六进制 + ASCII，位域按字段分段。
 * 它们不属于 board 的条目图（列表 / 步骤 / 条 / 时间线），所以单独一层。
 */
import { attrOf, hasAttr, esc, textOf } from '../shared/dom.mjs';
import { lineSet } from '../shared/range.mjs';
import { frame } from './frame.mjs';

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
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_CONFLICT', message: '字节窗同时写了 src 和内联字节：只能二选一', fix: '删掉 src，或删掉内联内容' });
    return '<div class="vk-missing">字节源冲突</div>';
  }
  if (!src && !inline) {
    /* 空字节窗：validate 已经报过 CHILD_MISSING，这里不再用 SRC_MISSING 重说一遍。 */
    if (!ctx.diag.has?.(node, 'CHILD_MISSING')) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '字节窗没有内容', fix: '写 src="文件.bin"，或内联十六进制如 68 65 6c 6c 6f' });
    }
    return '<div class="vk-missing">字节缺内容</div>';
  }
  if (inline?.error) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `内联字节里有 "${inline.error}"，不是两位十六进制`, fix: '每字节写两位十六进制，如 68 65 6c' });
    return '<div class="vk-missing">内联字节格式不对</div>';
  }

  let buf;
  if (src) {
    const { resolveAsset } = ctx;
    const abs = resolveAsset(src);
    if (!abs) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `字节窗的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">字节文件不存在</div>';
    }
    buf = ctx.read(abs);
  } else {
    buf = Buffer.from(inline.bytes);
  }

  const start = Number(attrOf(node, 'offset') || 0) || 0;
  const len = Math.max(0, Math.min(Number(attrOf(node, 'length') || 16), buf.length - start));
  if (start >= buf.length || len === 0) {
    ctx.diag(node, { code: 'SRC_RANGE', message: `字节窗的 offset=${start} 超出了文件（共 ${buf.length} 字节）`, fix: `offset 改成 0–${Math.max(0, buf.length - 1)}` });
  }
  const cols = Number(attrOf(node, 'cols') || 8);
  const base = Number(attrOf(node, 'addr') || '0x0');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `字节窗的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
  const width = Math.max(4, (base + start + len).toString(16).length);
  const rows = [];
  for (let i = 0; i < len; i += cols) {
    const bytes = [...buf.subarray(start + i, start + i + cols)];
    const hex = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${b.toString(16).padStart(2, '0')}</i>`).join('');
    const ascii = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${esc(b >= 32 && b < 127 ? String.fromCharCode(b) : '·')}</i>`).join('');
    rows.push(`<div class="vk-brow"><span class="vk-baddr">0x${(base + start + i).toString(16).padStart(width, '0')}</span><span class="vk-bhex">${hex}</span><span class="vk-bascii">${ascii}</span></div>`);
  }
  const head = '<div class="vk-bhead"><span>地址</span><span>十六进制</span><span>ASCII</span></div>';
  /* 字节窗的 current 是字节序号（不是源码行号）：越界用 CURRENT_RANGE，和源窗分开。 */
  if (curText && cur && len > 0 && !rows.join('').includes('is-cur')) {
    ctx.diag(node, { code: 'CURRENT_RANGE', message: `字节窗的 current="${curText}" 没有命中任何字节（这一窗只有 1–${len}）`, fix: `current 写字节序号，1 起；不要写源码行号` });
  }
  /* 列宽用 px，不用 ch：表头 56、行 64，ch 在不同元素上会解析成不同宽度，
     表头与行就会错开（v26 的真 bug）。0.6em 是 JetBrains Mono 的 1ch。 */
  const CH = 0.6 * 64;
  const bcol = `${Math.round((2 + width) * CH)}px`;
  const bhexw = `${Math.round(cols * 3 * CH)}px`;
  const bascii = `${Math.round(cols * 1.15 * CH)}px`;
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-bytes" style="--vk-cols:${cols};--vk-bcol:${bcol};--vk-bhexw:${bhexw};--vk-bascii-w:${bascii}">${head}${rows.join('')}</div>`, kind: 'bytes' });
}

/* ------------------------------------------------------------------ 位 */
export function buildBits(node, ctx) {
  const rawValue = attrOf(node, 'value') || '';
  if (!rawValue.trim()) {
    /* value 是必填：validate 已经报过 ATTR_REQUIRED，这里不再重说一遍。 */
    if (!ctx.diag.has?.(node, 'ATTR_REQUIRED')) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '位域没有 value', fix: 'value="0|01111|0000000000"' });
    }
    return '<div class="vk-missing">位串缺 value</div>';
  }
  const segments = rawValue.split('|');
  /* v27：field-labels → fields，label → caption。旧名照收、不报错（文档可能滞后），
     但新名优先。 */
  const fieldsText = attrOf(node, 'fields') ?? attrOf(node, 'field-labels') ?? '';
  const labels = fieldsText.split(',').map((s) => s.trim());
  if (labels.length > 1 && labels.length !== segments.length) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'FIELD_LABELS', message: `位域有 ${segments.length} 段，但 fields 有 ${labels.filter(Boolean).length} 个`, fix: '逗号分隔的段名个数要与 | 的段数一致' });
  }
  /* index：down / up 是 v26 的叫法，按 weight / order 处理，不报错。 */
  const LEGACY_INDEX = { down: 'weight', up: 'order' };
  const rawIndex = attrOf(node, 'index') || 'weight';
  const mapped = LEGACY_INDEX[rawIndex] || rawIndex;
  const index = ['weight', 'order', 'none', 'sparse'].includes(mapped) ? mapped : 'weight';
  const sign = hasAttr(node, 'sign');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `位域的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
  /* 空格只是排版：先剥掉再算长度，否则第二段的位索引会多 1。 */
  const clean = segments.map((s) => s.replace(/\s+/g, ''));
  const all = clean.join('');
  if (!/^[01]*$/.test(all)) {
    const bad = [...all].find((c) => c !== '0' && c !== '1') || '';
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_ENUM', message: `位串里有 "${bad}"，只认 0 / 1 / |`, fix: 'value="0|01111|0000000000"' });
  }

  const fieldHtml = clean.map((bits, fi) => {
    const offset = clean.slice(0, fi).join('').length;
    const cells = [...bits]
      .map((b, bi) => {
        const globalIdx = offset + bi;
        const weight = all.length - 1 - globalIdx;
        const label = index === 'none' ? '' : index === 'sparse' ? (weight % 8 === 0 ? String(weight) : '') : index === 'order' ? String(globalIdx) : String(weight);
        const isSign = sign && globalIdx === 0;
        const isCur = cur?.has(globalIdx + 1) ? ' is-cur' : '';
        return `<i class="vk-bit${isSign ? ' is-sign' : ''}${isCur}" data-vk-bit="${globalIdx + 1}"><b class="vk-bit-i">${label}</b><span class="vk-bit-v">${esc(b)}</span></i>`;
      })
      .join('');
    const fieldCur = cur && [...bits].some((_, bi) => cur.has(offset + bi + 1));
    return `<div class="vk-field${fieldCur ? ' is-cur' : ''}" data-vk-item="${fi + 1}">${labels[fi] ? `<span class="vk-field-l">${esc(labels[fi])}</span>` : ''}<span class="vk-field-bits">${cells}</span></div>`;
  });
  const captionText = attrOf(node, 'caption') ?? attrOf(node, 'label') ?? '';
  const left = captionText ? `<span class="vk-bits-label">${esc(captionText)}</span>` : '';
  const body = `<div class="vk-bits" data-index="${index}">${left}<div class="vk-bits-body">${fieldHtml.join('')}</div></div>`;
  /* 位域的 current 是位序号（从左数，1 起）：越界用 CURRENT_RANGE，和源窗分开。 */
  if (curText && cur && all.length > 0 && !fieldHtml.join('').includes('is-cur')) {
    ctx.diag(node, { code: 'CURRENT_RANGE', message: `位域的 current="${curText}" 没有命中任何位（这一行只有 1–${all.length}）`, fix: `current 写位序号，1 起、从左数；不要写源码行号` });
  }
  const title = attrOf(node, 'title');
  return title ? frame({ title, body, kind: 'bits' }) : body;
}
