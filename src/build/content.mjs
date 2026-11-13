/** 构建期：表格、列表、目录树、公式、字节、位、内存格、标题、文字。 */
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { attrOf, hasAttr, kids, flatten, serialize, textOf, raw, esc } from '../shared/dom.mjs';
import { lineSet } from '../shared/range.mjs';
import { FONT } from '../vocab.mjs';
import { frame } from './layout.mjs';

/* ------------------------------------------------------------------ 表格 */
function colNum(cell) {
  const t = textOf(cell).trim();
  return /^[-+−×x*≈~<>]?\s*[\d.,]+\s*[a-zA-Z%µ]*$/.test(t) || /^[-+]?\d+(\.\d+)?[a-zA-Z%]*$/.test(t);
}

export function buildTable(node) {
  const table = kids(node).find((c) => c.tagName === 'table');
  if (!table) {
    node.childNodes = [raw('<div class="vk-missing">vk-table 里要有原生 &lt;table&gt;</div>')];
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
export function buildList(node) {
  kids(node)
    .filter((c) => c.tagName === 'li')
    .forEach((li, i) => {
      li.attrs = [...(li.attrs || []).filter((a) => a.name !== 'data-vk-item'), { name: 'data-vk-item', value: String(i + 1) }];
    });
}

/* ------------------------------------------------------------------ 目录树 */
const ICON_KIND = (name, isDir) => {
  if (isDir) return 'dir';
  if (/\.(c|h|cc|cpp|js|mjs|ts|tsx|py|go|rs|java|sh)$/i.test(name)) return 'code';
  if (/\.(bin|exe|o|obj|dis|s|elf)$/i.test(name)) return 'binary';
  return 'file';
};

export function buildDir(node, ctx) {
  const depth = Number(attrOf(node, 'depth') || 3);
  let budget = Number(attrOf(node, 'limit') || 6);
  let skipped = 0;
  let truncated = false;
  const current = attrOf(node, 'current');
  let itemNo = 0;
  let rootName = '';

  const iconFor = (name, isDir) => {
    const kind = ICON_KIND(name, isDir);
    return ctx.icon(isDir ? 'folder' : kind === 'code' ? 'file-code' : 'file-text') || '';
  };

  const nodeHtml = (name, isDir, p, level, children = '', isLast = false) => {
    const kind = ICON_KIND(name, isDir);
    const cur = current && p === current ? ' current' : '';
    return (
      `<div class="vk-node" data-vk-item="${++itemNo}" data-depth="${level}" data-kind="${kind}" data-path="${esc(p)}"${isLast ? ' data-last="1"' : ''}${cur} style="--vk-depth:${level}">` +
      `<span class="vk-nrow">${iconFor(name, isDir)}<span class="vk-tname">${esc(name)}${isDir ? '/' : ''}</span></span>` +
      (children ? `<div class="vk-kids">${children}</div>` : '') +
      `</div>`
    );
  };

  const walk = (items, level, base) => {
    if (level > depth) return '';
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (budget <= 0) {
        truncated = true;
        skipped += items.length - i;
        break;
      }
      budget--;
      const name = typeof it === 'string' ? it : it.name;
      if (!name) {
        ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'TREE_NODE', message: '<vk-dir> 的节点缺 name', fix: '每个节点写成 "src" 或 {"name":"src","children":[]}' });
        continue;
      }
      const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
      const p = base ? `${base}/${name}` : name;
      out.push(nodeHtml(name, isDir, p, level, it.children ? walk(it.children, level + 1, p) : '', i === items.length - 1));
    }
    return out.join('');
  };

  const src = attrOf(node, 'src');
  let list;
  if (src) {
    const abs = path.resolve(path.dirname(path.resolve(ctx.file)), src);
    if (!fs.existsSync(abs)) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<vk-dir> 的 src="${src}" 找不到目录`, fix: '路径相对页面文件解析' });
      return `<div class="vk-missing">目录不存在：${esc(src)}</div>`;
    }
    ctx.assets.add(abs);
    rootName = path.basename(abs);
    const scan = (dir, level) => {
      if (level > depth) return [];
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
        .slice(0, 40)
        .map((e) => ({ name: e.name, dir: e.isDirectory(), children: e.isDirectory() ? scan(path.join(dir, e.name), level + 1) : undefined }));
    };
    list = scan(abs, 1);
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script');
    if (!s) return '<div class="vk-missing">vk-dir 缺 src 或 data-vk-tree</div>';
    try {
      const data = JSON.parse((s.childNodes || []).map((c) => c.value || '').join(''));
      list = Array.isArray(data) ? data : data.children || [data];
    } catch (e) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'TREE_JSON', message: `<vk-dir> 的内联 JSON 解析失败：${e.message}`, fix: '检查逗号与引号' });
      return `<div class="vk-missing">目录 JSON 解析失败</div>`;
    }
  }

  const more = truncated ? `<div class="vk-node is-more">还有 ${skipped} 项…</div>` : '';
  const body = rootName ? nodeHtml(rootName, true, '', 1, walk(list, 2, ''), false) + more : walk(list, 1, '') + more;
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-tree">${body}</div>`, dots: false, kind: 'dir' });
}

/* ------------------------------------------------------------------ 公式 */
export function buildMath(node, ctx) {
  const src = attrOf(node, 'src');
  let text = '';
  if (src) {
    const abs = path.resolve(path.dirname(path.resolve(ctx.file)), src);
    if (!fs.existsSync(abs)) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<vk-math> 的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">公式文件不存在</div>';
    }
    ctx.assets.add(abs);
    text = fs.readFileSync(abs, 'utf8');
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
    text = s ? (s.childNodes || []).map((c) => c.value || '').join('') : textOf(node);
  }
  if (!text.trim()) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '<vk-math> 没有内容', fix: 'src 指向 .tex，或把 TeX 直接写在标签里' });
    return '<div class="vk-missing">公式缺内容</div>';
  }
  try {
    return katex.renderToString(text.trim(), { displayMode: !hasAttr(node, 'inline'), throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'MATH', message: `<vk-math> 排版失败：${e.message}`, fix: '检查 TeX 括号是否配对' });
    return '<div class="vk-missing">公式排版失败</div>';
  }
}

/* ------------------------------------------------------------------ 字节 */
function inlineBytes(node) {
  const script = (node.childNodes || []).find((c) => c.tagName === 'script');
  const text = script ? (script.childNodes || []).map((c) => c.value || '').join('') : textOf(node);
  const tokens = String(text).replace(/0x/gi, ' ').split(/[\s,]+/).filter(Boolean);
  const bytes = [];
  for (const token of tokens) {
    if (/^[0-9a-f]{2}$/i.test(token)) bytes.push(parseInt(token, 16));
    else if (/^[0-9a-f]{1}$/i.test(token)) bytes.push(parseInt(token, 16));
    else return { error: token };
  }
  return bytes.length ? { bytes } : null;
}

export function buildBytes(node, ctx) {
  const src = attrOf(node, 'src');
  const inline = src ? null : inlineBytes(node);
  if (src && inlineBytes(node)) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_CONFLICT', message: '<vk-bytes> 同时写了 src 和内联字节：只能二选一', fix: '删掉 src，或删掉内联内容' });
    return '<div class="vk-missing">字节源冲突</div>';
  }
  if (!src && !inline) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '<vk-bytes> 没有内容', fix: '写 src="文件.bin"，或内联十六进制如 68 65 6c 6c 6f' });
    return '<div class="vk-missing">字节缺内容</div>';
  }
  if (inline?.error) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<vk-bytes> 的内联字节里有 "${inline.error}"，不是两位十六进制`, fix: '每字节写两位十六进制，如 68 65 6c' });
    return '<div class="vk-missing">内联字节格式不对</div>';
  }

  let buf;
  if (src) {
    const abs = path.resolve(path.dirname(path.resolve(ctx.file)), src);
    if (!fs.existsSync(abs)) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<vk-bytes> 的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">字节文件不存在</div>';
    }
    ctx.assets.add(abs);
    buf = fs.readFileSync(abs);
  } else {
    buf = Buffer.from(inline.bytes);
  }

  const start = Number(attrOf(node, 'offset') || 0) || 0;
  const len = Math.max(0, Math.min(Number(attrOf(node, 'length') || 32), buf.length - start));
  const cols = Number(attrOf(node, 'cols') || 8);
  const base = Number(attrOf(node, 'addr') || '0x0');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `<vk-bytes> 的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
  const width = Math.max(4, (base + start + len).toString(16).length);
  const rows = [];
  for (let i = 0; i < len; i += cols) {
    const bytes = [...buf.subarray(start + i, start + i + cols)];
    const hex = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${b.toString(16).padStart(2, '0')}</i>`).join('');
    const ascii = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${esc(b >= 32 && b < 127 ? String.fromCharCode(b) : '·')}</i>`).join('');
    rows.push(`<div class="vk-brow"><span class="vk-baddr">0x${(base + start + i).toString(16).padStart(width, '0')}</span><span class="vk-bhex">${hex}</span><span class="vk-bascii">${ascii}</span></div>`);
  }
  const head = '<div class="vk-bhead"><span>地址</span><span>十六进制</span><span>ASCII</span></div>';
  const fontPx = FONT.body;
  const bcol = Math.round(5.4 * fontPx);
  const bhexw = Math.round(cols * 3 * 0.6 * fontPx);
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-bytes" style="--vk-cols:${cols};--vk-bcol:${bcol}px;--vk-bhexw:${bhexw}px">${head}${rows.join('')}</div>`, dots: false, kind: 'bytes' });
}

/* ------------------------------------------------------------------ 位 */
export function buildBits(node, ctx) {
  const rawValue = attrOf(node, 'value') || '';
  if (!rawValue.trim()) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '<vk-bits> 没有 value', fix: 'value="0|01111|0000000000"' });
    return '<div class="vk-missing">位串缺 value</div>';
  }
  const segments = rawValue.split('|');
  const labels = (attrOf(node, 'field-labels') || '').split(',').map((s) => s.trim());
  if (labels.length > 1 && labels.length !== segments.length) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'FIELD_LABELS', message: `<vk-bits> 有 ${segments.length} 段，但 field-labels 有 ${labels.filter(Boolean).length} 个`, fix: '逗号分隔的段名个数要与 | 的段数一致' });
  }
  const index = attrOf(node, 'index') || 'down';
  const sign = hasAttr(node, 'sign');
  const curText = attrOf(node, 'current');
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `<vk-bits> 的 current="${curText}" 不是行段`, fix: '写法："4-7" / "3"' });
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
  return `<div class="vk-bits" data-index="${index}">${left}<div class="vk-bits-body">${fieldHtml.join('')}</div></div>`;
}

/* ------------------------------------------------------------------ 内存格 */
export function buildCells(node) {
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

/* ------------------------------------------------------------------ 标题带 */
export function buildHead(node) {
  const kicker = attrOf(node, 'kicker') || '';
  const counter = attrOf(node, 'counter') || '';
  const lede = attrOf(node, 'lede') || '';
  const title = (node.childNodes || []).map(serialize).join('');
  const kick = kicker || counter ? `<div class="vk-kick">${kicker ? `<span class="vk-kicker">${esc(kicker)}</span>` : ''}${counter ? `<span class="vk-counter">${esc(counter)}</span>` : ''}</div>` : '';
  const ledeHtml = lede ? `<div class="vk-lede">${esc(lede)}</div>` : '';
  node.childNodes = [raw(`${kick}<div class="vk-title">${title}</div>${ledeHtml}`)];
}

/* ------------------------------------------------------------------ 文字 */
export function buildText(node, ctx) {
  const icon = attrOf(node, 'icon');
  if (icon) {
    const svg = ctx.icon(icon);
    if (!svg) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `<vk-text> 的 icon="${icon}" 找不到`, fix: '写 Lucide 的 kebab 名；用 vk icons <词> 搜' });
    else node.childNodes = [raw(svg), ...(node.childNodes || [])];
  }
}
