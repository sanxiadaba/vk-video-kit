/**
 * v19 · 构建期
 * ----------------------------------------------------------------------------
 * 读作者页 → 校验 → 把「要算的东西」算好 → 输出一张自包含的页。
 *
 * v19 的分工：能在构建期定下来的几何，全部在这一层定下来（列、跨栏、地址、
 * 时间线位置、数字列对齐、树缩进）。运行期只剩三件必须测量的：代码缩字号、
 * 标注连线、关系图布局。
 *
 * 只写 .vk-cache/pages/，永不改源文件。样式与脚本用绝对 file:// 注入：
 * 产物只在渲染机上打开，交付物是 PNG 与 JSON。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parse, parseFragment } from 'parse5';
import { createHighlighter } from 'shiki';
import katex from 'katex';
import { validate, parseLines, lineSet } from './contract.mjs';
import { normalizeTree, setStyle, spacePx } from './normalize.mjs';
import { dedent, expandLeadingTabs, stripAnsi, SUPPORTED_LANGS, inferLang, langKey } from './shared/code.mjs';
import { parseAsm, splitInsn } from './shared/asm.mjs';
import { GAP, SYNTAX, FONT } from './vocab.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const label = (f) => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/') || String(f);

/* ---------------------------------------------------------------- 工具 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const hasAttr = (node, name) => (node.attrs || []).some((a) => a.name === name);
const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
const flatten = (node, out = []) => {
  out.push(node);
  for (const c of node.childNodes || []) flatten(c, out);
  return out;
};
const kids = (node) => (node.childNodes || []).filter((c) => c.tagName);
const textOf = (node) => (node.childNodes || []).map((c) => (c.nodeName === '#text' ? c.value : c.tagName === 'script' ? '' : textOf(c))).join('');
const raw = (html) => ({ nodeName: '#raw', value: html, childNodes: [], attrs: [] });
/* 间距只有一个解析口：tag 名 / 像素都走 normalize.mjs。 */
const px = (value, fallback = 0) => spacePx(value, fallback);

/* ---------------------------------------------------------------- 序列化 */
const VOID = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
const RAWTEXT = new Set(['script', 'style', 'textarea', 'title']);
const attrText = (attrs) => (attrs || []).map((a) => (a.value ? ` ${a.name}="${esc(a.value)}"` : ` ${a.name}`)).join('');

function serialize(node) {
  if (!node) return '';
  switch (node.nodeName) {
    case '#document':
    case '#document-fragment':
      return (node.childNodes || []).map(serialize).join('');
    case '#documentType':
      return '<!doctype html>';
    case '#text':
      return esc(node.value || '');
    case '#comment':
      return `<!--${node.data || ''}-->`;
    case '#raw':
      return node.value;
    default: {
      const tag = node.tagName;
      if (!tag) return (node.childNodes || []).map(serialize).join('');
      if (RAWTEXT.has(tag)) return `<${tag}${attrText(node.attrs)}>${(node.childNodes || []).map((c) => c.value || '').join('')}</${tag}>`;
      const open = `<${tag}${attrText(node.attrs)}>`;
      if (VOID.has(tag)) return open;
      return `${open}${(node.childNodes || []).map(serialize).join('')}</${tag}>`;
    }
  }
}

/* ---------------------------------------------------------------- 高亮 */
const TOKEN_THEME = {
  name: 'vk',
  type: 'light',
  settings: [
    { settings: { foreground: '#0B0F14', background: '#ffffff' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: SYNTAX.comment[0].toUpperCase() } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.interpolated', 'punctuation.definition.string'], settings: { foreground: SYNTAX.string[0].toUpperCase() } },
    { scope: ['constant.numeric', 'constant.language', 'support.constant', 'constant.character.format.placeholder'], settings: { foreground: SYNTAX.number[0].toUpperCase() } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: SYNTAX.fn[0].toUpperCase() } },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'storage.modifier.array'], settings: { foreground: SYNTAX.operator[0].toUpperCase() } },
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control', 'entity.name.type', 'support.type', 'entity.name.class', 'support.class', 'entity.name.tag', 'punctuation.definition.directive'], settings: { foreground: SYNTAX.keyword[0].toUpperCase() } },
  ],
};
const COLOR_CLASS = {
  [SYNTAX.string[0].toUpperCase()]: 's',
  [SYNTAX.comment[0].toUpperCase()]: 'c',
  [SYNTAX.number[0].toUpperCase()]: 'n',
  [SYNTAX.keyword[0].toUpperCase()]: 'k',
  [SYNTAX.fn[0].toUpperCase()]: 'f',
  [SYNTAX.operator[0].toUpperCase()]: 'o',
};

let highlighter = null;
const getHighlighter = async () => {
  highlighter ||= await createHighlighter({ themes: [TOKEN_THEME], langs: [] });
  return highlighter;
};

/** 一行里的 token → 带 class 的 HTML；顺带把 mark 命中的片段包起来。 */
function lineHtml(tokens, needle) {
  const out = [];
  for (const t of tokens) {
    const cls = COLOR_CLASS[(t.color || '').toUpperCase()] || '';
    const text = esc(t.content);
    if (!needle || !t.content.includes(needle)) {
      out.push(cls ? `<span class="${cls}">${text}</span>` : text);
      continue;
    }
    let rest = t.content;
    let buf = '';
    while (rest) {
      const i = rest.indexOf(needle);
      if (i < 0) {
        buf += esc(rest);
        break;
      }
      buf += esc(rest.slice(0, i)) + `<mark class="vk-mark">${esc(needle)}</mark>`;
      rest = rest.slice(i + needle.length);
    }
    out.push(cls ? `<span class="${cls}">${buf}</span>` : buf);
  }
  return out.join('');
}

async function highlightLines(code, lang) {
  const hl = await getHighlighter();
  const key = langKey(lang);
  if (!hl.getLoadedLanguages().includes(key)) {
    if (!SUPPORTED_LANGS.includes(key)) throw new Error(`不支持的语言 "${lang}"。可用：${SUPPORTED_LANGS.join(', ')}`);
    await hl.loadLanguage(key);
  }
  return hl.codeToTokens(code, { lang: key, theme: 'vk' }).tokens;
}

/* ---------------------------------------------------------------- 源码 */
function inlineSource(node) {
  const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
  if (!s) return null;
  return (s.childNodes || []).map((c) => c.value || '').join('');
}

function readSource(node, file, assets, diag) {
  const src = attrOf(node, 'src');
  const inline = inlineSource(node);
  if (src && inline != null) {
    diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_CONFLICT', message: `<${node.tagName}> 同时写了 src 和内联源码：只能二选一`, fix: '删掉 src，或删掉内联 <script data-vk-source>' });
    return null;
  }
  if (!src && inline == null) return null;
  if (inline != null) return dedent(expandLeadingTabs(stripAnsi(inline)));
  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) {
    diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<${node.tagName}> 的 src="${src}" 找不到文件`, fix: `路径相对页面文件解析：${path.dirname(label(file)) || '.'}/` });
    return null;
  }
  assets.add(abs);
  return dedent(expandLeadingTabs(stripAnsi(fs.readFileSync(abs, 'utf8'))));
}

/* ---------------------------------------------------------------- 窗口 */
function frame({ chrome, title, surface, body, range, digits }) {
  /* 标题栏：有 title 就出（无三点），写 chrome="dots" 才加三点。
     不再让「写了 title 但没写 chrome」静默丢掉标题。 */
  const mode = chrome === 'dots' ? 'dots' : title ? 'title' : 'none';
  const hd =
    mode !== 'none'
      ? `<div class="vk-fhd">${mode === 'dots' ? '<span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}${
          title ? `<span class="vk-ftitle">${esc(title)}</span>` : ''
        }${range ? `<span class="vk-frange">${esc(range)}</span>` : ''}</div>`
      : '';
  return `<div class="vk-frame" data-chrome="${mode}" data-surface="${surface || 'auto'}"${digits ? ` style="--vk-ln-digits:${digits}"` : ''}>${hd}<div class="vk-fbd">${body}</div></div>`;
}

const fmtRange = (a, b) => (a === b ? String(a) : `${a}–${b}`);

function sliceLines(text, spec) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (!spec) return { start: 1, rows: lines, count: lines.length };
  const ranges = parseLines(spec);
  if (!ranges) return { start: 1, rows: lines, count: lines.length };
  const [a, b] = ranges[0];
  const start = Math.max(1, Math.min(lines.length, a));
  const end = Math.min(lines.length, Number.isFinite(b) ? b : lines.length);
  return { start, rows: lines.slice(start - 1, Math.max(start, end)), count: lines.length };
}

/* ---------------------------------------------------------------- 四类源码窗 */
async function buildSource(node, file, ctx) {
  const as = attrOf(node, 'as') || 'code';
  const text = readSource(node, file, ctx.assets, ctx.diag);
  if (text == null) {
    if (!ctx.diag.some((d) => d.tag === node.tagName && d.line === lineOf(node))) {
      ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<${node.tagName}> 没有内容`, fix: '写 src="文件" 或内联 <script type="text/plain" data-vk-source>' });
    }
    return '';
  }
  const lang = attrOf(node, 'lang') || (as === 'code' ? inferLang(attrOf(node, 'src') || attrOf(node, 'title') || '') : '');
  const { start, rows: srcRows, count } = sliceLines(text, attrOf(node, 'lines'));
  if (attrOf(node, 'lines') && !parseLines(attrOf(node, 'lines'))) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'LINES_INVALID', message: `<${node.tagName}> 的 lines="${attrOf(node, 'lines')}" 不是行段`, fix: '写法："3" / "3-7" / "3,7,9" / "4-"' });
    return '';
  }
  if (start > count) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'LINES_OUT_OF_RANGE', message: `<${node.tagName}> 的 lines="${attrOf(node, 'lines')}" 超出源码范围（共 ${count} 行）`, fix: `改成 1–${count}` });
    return '';
  }
  const fold = lineSet(attrOf(node, 'fold'));
  const cur = lineSet(attrOf(node, 'current'));
  const mark = attrOf(node, 'mark') || '';
  const title = attrOf(node, 'title') || '';
  const chrome = attrOf(node, 'chrome') || 'none';
  const surface = attrOf(node, 'surface') || 'auto';

  let body = '';
  let digits = String(start + srcRows.length - 1).length;
  let range = attrOf(node, 'lines') || '';

  if (as === 'code') {
    const tokens = await highlightLines(srcRows.join('\n'), lang || 'text');
    const out = [];
    let folded = 0;
    srcRows.forEach((_, i) => {
      const win = i + 1;
      const srcNo = start + i;
      if (fold?.has(win)) {
        folded++;
        return;
      }
      if (folded) {
        out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
        folded = 0;
      }
      const cls = cur?.has(win) ? ' is-cur' : '';
      out.push(`<div class="vk-line${cls}" data-vk-line="${win}" data-src="${srcNo}"><span class="vk-ln">${srcNo}</span><span class="vk-lc">${lineHtml(tokens[i] || [], mark)}</span></div>`);
    });
    if (folded) out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
    body = out.join('');
    digits = String(start + srcRows.length - 1).length;
  } else if (as === 'term') {
    const prompt = attrOf(node, 'prompt') || '$';
    const out = [];
    let win = 0;
    for (const line of srcRows) {
      const t = line.replace(/\s+$/, '');
      if (!t) continue;
      win++;
      const isPrompt = t.startsWith(prompt);
      if (isPrompt) {
        out.push(`<div class="vk-line${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-prompt">${esc(prompt)}</span>${cmdHtml(t.slice(prompt.length).trim())}</div>`);
      } else {
        const isErr = /\b(error|Error|ERROR|fatal|failed|not found|No such)\b|错误|失败/.test(t);
        out.push(`<div class="vk-line${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="${isErr ? 'vk-errt' : 'vk-out'}">${esc(t)}</span></div>`);
      }
    }
    body = out.join('');
    digits = String(win).length;
    range = attrOf(node, 'lines') || '';
  } else if (as === 'diff') {
    const rows = [];
    let oldNo = 1;
    let newNo = 1;
    for (const line of srcRows) {
      if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) continue;
      if (line.startsWith('@@')) {
        const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (m) {
          oldNo = Number(m[1]);
          newNo = Number(m[3]);
        }
        rows.push({ kind: 'hunk', text: m ? '' : line, header: !!m });
        continue;
      }
      if (line.startsWith('+')) rows.push({ kind: 'add', text: line.slice(1), old: null, new: newNo++ });
      else if (line.startsWith('-')) rows.push({ kind: 'del', text: line.slice(1), old: oldNo++, new: null });
      else rows.push({ kind: 'same', text: line.replace(/^ /, ''), old: oldNo++, new: newNo++ });
    }
    // 每组 hunk 的「改第几行」按实际显示的改动行算，不信 header 的计数。
    const spanOf = (nums) => (Math.min(...nums) === Math.max(...nums) ? `${nums[0]}` : `${Math.min(...nums)}–${Math.max(...nums)}`);
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i];
      if (h.kind !== 'hunk' || !h.header) continue;
      const body2 = [];
      for (let j = i + 1; j < rows.length && rows[j].kind !== 'hunk'; j++) body2.push(rows[j]);
      const dels = body2.filter((r) => r.kind === 'del');
      const adds = body2.filter((r) => r.kind === 'add');
      if (dels.length || adds.length) {
        const changed = (adds.length ? adds : dels).map((r) => (r.kind === 'add' ? r.new : r.old));
        h.text = !dels.length ? `新增第 ${spanOf(changed)} 行` : !adds.length ? `删除第 ${spanOf(changed)} 行` : `改第 ${spanOf(changed)} 行`;
      } else {
        const olds = body2.filter((r) => r.kind === 'same').map((r) => r.old);
        const news = body2.filter((r) => r.kind === 'same').map((r) => r.new);
        const or = spanOf(olds);
        const nr = spanOf(news);
        h.text = or === nr ? `第 ${or} 行` : `旧 ${or} 行 → 新 ${nr} 行`;
      }
    }
    const out = [];
    let win = 0;
    let add = 0;
    let del = 0;
    let maxLn = 0;
    for (const r of rows) {
      if (r.kind === 'hunk') {
        out.push(`<div class="vk-dhunk">${esc(r.text)}</div>`);
        continue;
      }
      win++;
      const ln = r.kind === 'del' ? r.old : r.new;
      maxLn = Math.max(maxLn, ln || 0);
      if (r.kind === 'add') add++;
      if (r.kind === 'del') del++;
      const cls = r.kind === 'same' ? '' : ` ${r.kind}`;
      out.push(
        `<div class="vk-drow${cls}${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-ln">${ln}</span><span class="vk-sign">${r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span><span class="vk-dc">${esc(r.text) || ' '}</span></div>`
      );
    }
    body = out.join('');
    digits = String(maxLn).length;
    range = `+${add} / −${del}`;
  } else {
    // asm
    const showBytes = hasAttr(node, 'bytes');
    const keep = attrOf(node, 'lines') ? lineSet(attrOf(node, 'lines')) : null;
    const parsed = parseAsm(srcRows.join('\n'));
    const out = [];
    let win = 0;
    parsed.rows.forEach((r) => {
      if (keep && !keep.has(r.line)) return;
      if (r.kind === 'blank') return;
      win++;
      if (r.kind === 'label') {
        out.push(`<div class="vk-arow vk-alabel${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-aaddr"></span><span class="vk-ainsn">${esc(`<${r.text}>:`)}</span></div>`);
        return;
      }
      const { mnemonic, operands } = splitInsn(r.text);
      out.push(
        `<div class="vk-arow${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"${r.addr ? ` data-vk-addr="${esc(r.addr)}"` : ''}><span class="vk-aaddr">${esc(r.addr)}</span>${
          showBytes ? `<span class="vk-abytes">${esc(r.bytes)}</span>` : ''
        }<span class="vk-ainsn">${esc(mnemonic)}</span><span class="vk-aops">${esc(operands)
          .replace(/%[a-z0-9]+/gi, (m) => `<i class="vk-areg">${m}</i>`)
          .replace(/\$?0x[0-9a-f]+/gi, (m) => `<i class="vk-aimm">${m}</i>`)}</span></div>`
      );
    });
    body = out.join('');
    digits = String(win).length;
  }

  const cls = as === 'term' ? ' vk-term' : as === 'diff' ? ' vk-diff' : as === 'asm' ? ' vk-asm' : '';
  return frame({ chrome, title, surface, body: `<div class="vk-lines${cls}">${body}</div>`, range, digits });
}

function cmdHtml(cmd) {
  const out = [];
  let first = true;
  for (const m of cmd.matchAll(/"[^"]*"|'[^']*'|\S+/g)) {
    const tok = m[0];
    let cls = 'vk-arg';
    if (first) {
      cls = 'vk-cmd';
      first = false;
    } else if (/^--?[\w]/.test(tok)) cls = 'vk-flag';
    else if (/^["']/.test(tok)) cls = 'vk-arg-str';
    else if (tok.includes('/')) cls = 'vk-path';
    out.push(`<span class="${cls}">${esc(tok)}</span>`);
  }
  return out.join(' ');
}

/* ---------------------------------------------------------------- 内容件 */
function colNum(cell) {
  const t = textOf(cell).trim();
  return /^[-+−×x*≈~<>]?\s*[\d.,]+\s*[a-zA-Z%µ]*$/.test(t) || /^[-+]?\d+(\.\d+)?[a-zA-Z%]*$/.test(t);
}

function buildTable(node, file, ctx) {
  const table = kids(node).find((c) => c.tagName === 'table');
  if (!table) return '';
  const rows = flatten(table).filter((n) => n.tagName === 'tr');
  const cols = Math.max(0, ...rows.map((r) => flatten(r).filter((c) => c.tagName === 'th' || c.tagName === 'td').length));
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
  const cap = attrOf(node, 'caption');
  node.childNodes = [...(cap ? [raw(`<div class="vk-cap">${esc(cap)}</div>`)] : []), table];
  return '';
}

function buildList(node) {
  kids(node)
    .filter((c) => c.tagName === 'li')
    .forEach((li, i) => {
      li.attrs = [...(li.attrs || []), { name: 'data-vk-item', value: String(i + 1) }];
    });
  return '';
}

const ICON_KIND = (name, isDir) => {
  if (isDir) return 'dir';
  if (/\.(c|h|cc|cpp|js|mjs|ts|tsx|py|go|rs|java|sh)$/i.test(name)) return 'code';
  if (/\.(bin|exe|o|obj|dis|s|elf)$/i.test(name)) return 'binary';
  return 'file';
};

async function buildTree(node, file, ctx) {
  const off = attrOf(node, 'icons') === 'none';
  const pick = (key, fallback) => (off ? '' : ctx.icon(attrOf(node, key) || fallback) || '');
  const icons = { dir: pick('icon-dir', 'folder'), code: pick('icon-file', 'file'), binary: pick('icon-file', 'file'), file: pick('icon-file', 'file') };
  const depth = Number(attrOf(node, 'depth') || 3);
  let budget = Number(attrOf(node, 'max') || 6);
  let skipped = 0;
  let truncated = false;
  const current = attrOf(node, 'current');
  /* 序号是「这一棵树里第几行」，不是整页第几个：两张树不能互相串锚点。 */
  let itemNo = 0;

  const nodeHtml = (name, isDir, p, level, children = '') => {
    const kind = ICON_KIND(name, isDir);
    const cur = current && (p === current || current === name) ? ' is-cur' : '';
    return (
      `<div class="vk-node${cur}" data-vk-item="${++itemNo}" data-depth="${level}" data-kind="${kind}" data-path="${esc(p)}" style="--vk-depth:${level}">` +
      `<span class="vk-nrow">${icons[kind] || ''}<span class="vk-tname">${esc(name)}${isDir ? '/' : ''}</span></span>` +
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
        ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'TREE_NODE', message: `<vk-tree> 的节点缺 name`, fix: '每个节点写成 "src" 或 {"name":"src","children":[]}' });
        continue;
      }
      const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
      const p = base ? `${base}/${name}` : name;
      out.push(nodeHtml(name, isDir, p, level, it.children ? walk(it.children, level + 1, p) : ''));
    }
    return out.join('');
  };

  const src = attrOf(node, 'src');
  let list;
  if (src) {
    const abs = path.resolve(path.dirname(path.resolve(file)), src);
    if (!fs.existsSync(abs)) {
      ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<vk-tree> 的 src="${src}" 找不到目录`, fix: '路径相对页面文件解析' });
      return '';
    }
    ctx.assets.add(abs);
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
    if (!s) return '';
    try {
      const data = JSON.parse((s.childNodes || []).map((c) => c.value || '').join(''));
      list = Array.isArray(data) ? data : data.children || [data];
    } catch (e) {
      ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'TREE_JSON', message: `<vk-tree> 的内联 JSON 解析失败：${e.message}`, fix: '检查逗号与引号' });
      return '';
    }
  }
  const body = walk(list, 1, '') + (truncated ? `<div class="vk-node is-more">还有 ${skipped} 项…</div>` : '');
  return frame({ chrome: attrOf(node, 'chrome') || 'none', title: attrOf(node, 'title'), surface: attrOf(node, 'surface') || 'auto', body: `<div class="vk-tree">${body}</div>` });
}

function buildMath(node, file, ctx) {
  const text = readSource(node, file, ctx.assets, ctx.diag) ?? textOf(node);
  if (!text.trim()) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<vk-math> 没有内容`, fix: 'src 指向 .tex，或把 TeX 直接写在标签里' });
    return '';
  }
  try {
    return katex.renderToString(text.trim(), { displayMode: !hasAttr(node, 'inline'), throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'MATH', message: `<vk-math> 排版失败：${e.message}`, fix: '检查 TeX 括号是否配对' });
    return '';
  }
}

/** 内联十六进制：`68 65 6c 6c 6f` / `0x68,0x65` / `68656c6c6f` 都认。 */
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

function buildBytes(node, file, ctx) {
  const src = attrOf(node, 'src');
  const inline = src ? null : inlineBytes(node);
  if (src && inlineBytes(node)) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_CONFLICT', message: `<vk-bytes> 同时写了 src 和内联字节：只能二选一`, fix: '删掉 src，或删掉内联内容' });
    return '';
  }
  if (!src && !inline) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<vk-bytes> 没有内容`, fix: '写 src="文件.bin"，或内联十六进制如 68 65 6c 6c 6f' });
    return '';
  }
  if (inline?.error) {
    ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<vk-bytes> 的内联字节里有 "${inline.error}"，不是两位十六进制`, fix: '每字节写两位十六进制，如 68 65 6c' });
    return '';
  }
  let buf;
  if (src) {
    const abs = path.resolve(path.dirname(path.resolve(file)), src);
    if (!fs.existsSync(abs)) {
      ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'SRC_MISSING', message: `<vk-bytes> 的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '';
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
  const cur = attrOf(node, 'current') ? lineSet(attrOf(node, 'current')) : null;
  const width = Math.max(4, (base + start + len).toString(16).length);
  const rows = [];
  for (let i = 0; i < len; i += cols) {
    const bytes = [...buf.subarray(start + i, start + i + cols)];
    const hex = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${b.toString(16).padStart(2, '0')}</i>`).join('');
    const ascii = bytes.map((b, j) => `<i data-vk-item="${i + j + 1}"${cur?.has(i + j + 1) ? ' class="is-cur"' : ''}>${esc(b >= 32 && b < 127 ? String.fromCharCode(b) : '·')}</i>`).join('');
    rows.push(`<div class="vk-brow"><span class="vk-baddr">0x${(base + start + i).toString(16).padStart(width, '0')}</span><span class="vk-bhex">${hex}</span><span class="vk-bascii">${ascii}</span></div>`);
  }
  const head = hasAttr(node, 'header') ? `<div class="vk-bhead"><span>地址</span><span>十六进制</span><span>ASCII</span></div>` : '';
  const fontPx = FONT[attrOf(node, 'size') || 'body'] || FONT.body;
  const bcol = Math.round(5.4 * fontPx);
  const bhexw = Math.round(cols * 3 * 0.6 * fontPx);
  return frame({ chrome: attrOf(node, 'chrome') || 'none', title: attrOf(node, 'title'), surface: attrOf(node, 'surface') || 'auto', body: `<div class="vk-bytes" style="--vk-cols:${cols};--vk-bcol:${bcol}px;--vk-bhexw:${bhexw}px">${head}${rows.join('')}</div>` });
}

function buildBits(node) {
  const rawValue = attrOf(node, 'value') || '';
  const segments = rawValue.split('|');
  const labels = (attrOf(node, 'field-labels') || '').split(',').map((s) => s.trim());
  const index = attrOf(node, 'index') || 'down';
  const group = Number(attrOf(node, 'group') || 4);
  const sign = hasAttr(node, 'sign');
  const cur = attrOf(node, 'current') ? lineSet(attrOf(node, 'current')) : null;
  const all = segments.join('').replace(/\s+/g, '');
  const fieldHtml = segments.map((seg, fi) => {
    const bits = [...seg.replace(/\s+/g, '')];
    const cells = bits
      .map((b, bi) => {
        const globalIdx = [...segments.slice(0, fi).join('')].length + bi;
        const weight = all.length - 1 - globalIdx;
        const label = index === 'none' ? '' : index === 'sparse' ? (weight % 8 === 0 ? String(weight) : '') : index === 'up' ? String(globalIdx) : String(weight);
        const isSign = sign && globalIdx === 0;
        const gap = group > 1 && globalIdx > 0 && globalIdx % group === 0 ? ' data-group' : '';
        const isCur = cur?.has(globalIdx + 1) ? ' is-cur' : '';
        return `<i class="vk-bit${isSign ? ' is-sign' : ''}${isCur}" data-vk-bit="${globalIdx + 1}"${gap}><b class="vk-bit-i">${label}</b><span class="vk-bit-v">${esc(b)}</span></i>`;
      })
      .join('');
    return `<div class="vk-field" data-vk-item="${fi + 1}">${labels[fi] ? `<span class="vk-field-l">${esc(labels[fi])}</span>` : ''}<span class="vk-field-bits">${cells}</span></div>`;
  });
  const left = attrOf(node, 'label') ? `<span class="vk-bits-label">${esc(attrOf(node, 'label'))}</span>` : '';
  return `<div class="vk-bits" data-index="${index}">${left}<div class="vk-bits-body">${fieldHtml.join('')}</div></div>`;
}

function buildCells(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const stride = Number(attrOf(node, 'stride') || 1);
  const base = attrOf(node, 'addr') ?? null;
  const baseNum = base != null ? Number(base) : null;
  const cols = Number(attrOf(node, 'cols') || 4);
  const current = Number(attrOf(node, 'current') || 0);
  const width = baseNum != null ? Math.max(4, (baseNum + items.length * stride).toString(16).length) : 0;
  const cells = items.map((li, i) => {
    const value = attrOf(li, 'value') ?? '';
    const name = attrOf(li, 'label') ?? '';
    const ptr = attrOf(li, 'ptr') || '';
    const state = attrOf(li, 'state') || (current === i + 1 ? 'current' : '');
    const tone = attrOf(li, 'tone') || 'neutral';
    const addr = baseNum != null ? `0x${(baseNum + i * stride).toString(16).padStart(width, '0')}` : '';
    return (
      `<div class="vk-cell" data-vk-item="${i + 1}" data-state="${esc(state)}" data-tone="${esc(tone)}">` +
      (ptr ? `<span class="vk-cell-p">${esc(ptr)}</span>` : '') +
      `<span class="vk-cell-v">${esc(value)}</span>` +
      `<span class="vk-cell-l">${esc(name)}</span>` +
      (addr ? `<span class="vk-cell-a">${addr}</span>` : '') +
      `</div>`
    );
  });
  return `<div class="vk-cells" style="--vk-cols:${cols}">${cells.join('')}</div>`;
}

function buildHead(node) {
  const kicker = attrOf(node, 'kicker') || '';
  const counter = attrOf(node, 'counter') || '';
  const lede = attrOf(node, 'lede') || '';
  const title = (node.childNodes || []).map(serialize).join('');
  const kick = kicker || counter ? `<div class="vk-kick">${kicker ? `<span class="vk-kicker">${esc(kicker)}</span>` : ''}${counter ? `<span class="vk-counter">${esc(counter)}</span>` : ''}</div>` : '';
  const ledeHtml = lede ? `<div class="vk-lede">${esc(lede)}</div>` : '';
  node.childNodes = [raw(`${kick}<div class="vk-title">${title}</div>${ledeHtml}`)];
}

function buildText(node, file, ctx) {
  /* 行宽：作者写的是「一行几个字」，中文 1 字 ≈ 1em，直接落成 max-width。 */
  const measure = attrOf(node, 'measure');
  if (measure && /^\d+$/.test(measure)) setStyle(node, { 'max-width': `${measure}em` });
  const icon = attrOf(node, 'icon');
  if (icon) {
    const svg = ctx.icon(icon);
    if (!svg) ctx.diag.push({ file: label(file), line: lineOf(node), tag: node.tagName, code: 'ICON', message: `<vk-text> 的 icon="${icon}" 找不到`, fix: '写 Lucide 的 kebab 名；用 vk icons <词> 搜' });
    else node.childNodes = [raw(svg), ...(node.childNodes || [])];
  }
  const counter = attrOf(node, 'counter');
  if (counter) node.childNodes = [...(node.childNodes || []), raw(`<span class="vk-counter">${esc(counter)}</span>`)];
}

/* ---------------------------------------------------------------- 图 */
function buildSteps(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const cur = Number(attrOf(node, 'current') || 0);
  const dir = attrOf(node, 'direction') || 'auto';
  const connector = attrOf(node, 'connector') || 'arrow';
  const html = items
    .map((li, i) => {
      const state = attrOf(li, 'state') || (cur === i + 1 ? 'current' : '');
      const tone = attrOf(li, 'tone') || 'neutral';
      const note = attrOf(li, 'note');
      return `<div class="vk-step" data-vk-item="${i + 1}" data-state="${esc(state)}" data-tone="${esc(tone)}"><span class="vk-step-n">${i + 1}</span><span class="vk-step-t">${serialize({ ...li, tagName: 'span', attrs: [], sourceCodeLocation: null }).replace(/^<span>|<\/span>$/g, '')}</span>${note ? `<span class="vk-step-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-steps" data-dir="${dir}" data-connector="${connector}" style="--vk-n:${items.length || 1}">${html}</div>`;
}

function buildBars(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const cur = Number(attrOf(node, 'current') || 0);
  const values = items.map((li) => Number(attrOf(li, 'value') || 0)).filter((n) => Number.isFinite(n));
  const max = Number(attrOf(node, 'max') || Math.max(...values, 1));
  const log = attrOf(node, 'scale') === 'log';
  const unit = attrOf(node, 'unit') || '';
  const html = items
    .map((li, i) => {
      const v = Number(attrOf(li, 'value') || 0);
      const ratio = log ? Math.log10(Math.max(1, v) + 1) / Math.log10(Math.max(1, max) + 1) : v / max;
      const pct = Math.max(2, Math.min(100, ratio * 100));
      const state = attrOf(li, 'state') || (cur === i + 1 ? 'current' : '');
      return `<div class="vk-bar" data-vk-item="${i + 1}" data-state="${esc(state)}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"><span class="vk-bar-l">${esc(attrOf(li, 'label') || '')}</span><span class="vk-bar-t"><i style="width:${pct.toFixed(1)}%"></i></span><span class="vk-bar-v">${esc(String(v))}${unit ? `<span class="vk-unit">${esc(unit)}</span>` : ''}</span></div>`;
    })
    .join('');
  return `<div class="vk-bars">${html}</div>`;
}

function buildTimeline(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const cur = Number(attrOf(node, 'current') || 0);
  const start = Number(attrOf(node, 'start'));
  const end = Number(attrOf(node, 'end'));
  const proportional = Number.isFinite(start) && Number.isFinite(end) && end > start && items.every((li) => Number.isFinite(Number(attrOf(li, 'at'))));
  const html = items
    .map((li, i) => {
      const at = Number(attrOf(li, 'at'));
      const left = proportional ? ((at - start) / (end - start)) * 100 : ((i + 0.5) / items.length) * 100;
      const edge = left <= 10 ? 'start' : left >= 90 ? 'end' : 'mid';
      const state = attrOf(li, 'state') || (cur === i + 1 ? 'current' : '');
      const date = attrOf(li, 'date') || (Number.isFinite(at) ? String(at) : '');
      const note = attrOf(li, 'note');
      return `<div class="vk-tl-i" data-vk-item="${i + 1}" data-edge="${edge}" data-state="${esc(state)}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-at:${left.toFixed(2)}%"><span class="vk-tl-date">${esc(date)}</span><span class="vk-tl-dot"></span><span class="vk-tl-label">${esc(attrOf(li, 'label') || '')}</span>${note ? `<span class="vk-tl-note">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  return `<div class="vk-tl${proportional ? ' is-prop' : ''}">${html}</div>`;
}

function buildGraph(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const isEdge = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
  const nodes = items.filter((li) => !isEdge(li));
  const edges = items.filter(isEdge);
  const nodeHtml = nodes
    .map((li, i) => {
      const id = attrOf(li, 'id') || `n${i + 1}`;
      const label = attrOf(li, 'label') ?? '';
      const note = attrOf(li, 'note');
      const state = attrOf(li, 'state') || '';
      const after = (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean).join(' ');
      const lane = attrOf(li, 'lane');
      return `<div class="vk-gnode" data-vk-item="${i + 1}" data-id="${esc(id)}"${attrOf(li, 'id') ? ` id="${esc(attrOf(li, 'id'))}"` : ''} data-after="${esc(after)}"${lane != null ? ` data-lane="${esc(lane)}"` : ''} data-state="${esc(state)}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"><span class="vk-gn-l">${esc(label)}</span>${note ? `<span class="vk-gn-n">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');
  const edgeHtml = edges
    .map((li) => `<i class="vk-gedge" data-from="${esc(attrOf(li, 'from') || '')}" data-to="${esc(attrOf(li, 'to') || '')}" data-label="${esc(attrOf(li, 'label') || '')}"></i>`)
    .join('');
  return `<div class="vk-graph" data-layout="${attrOf(node, 'layout') || 'row'}" data-dir="${attrOf(node, 'direction') || 'horizontal'}" data-edge="${attrOf(node, 'edge') || 'arrow'}"><div class="vk-gstage">${nodeHtml}${edgeHtml}</div><svg class="vk-gedges" aria-hidden="true"></svg></div>`;
}

function buildSeq(node) {
  const cur = Number(attrOf(node, 'current') || 0);
  const items = kids(node).filter((c) => c.tagName === 'li');
  const rows = items
    .map((li, i) => {
      const state = attrOf(li, 'state') || (cur === i + 1 ? 'current' : '');
      const dir = attrOf(li, 'dir') || 'right';
      const label = attrOf(li, 'label') ?? textOf(li);
      const note = attrOf(li, 'note');
      return (
        `<div class="vk-seq-row" data-vk-item="${i + 1}" data-dir="${esc(dir)}" data-state="${esc(state)}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}">` +
        `<span class="vk-seq-l">${esc(String(label).trim())}</span>` +
        `<span class="vk-seq-arrow" aria-hidden="true"></span>` +
        (note ? `<span class="vk-seq-note">${esc(note)}</span>` : '') +
        `</div>`
      );
    })
    .join('');
  const a = attrOf(node, 'a') || '';
  const b = attrOf(node, 'b') || '';
  return `<div class="vk-seq"><div class="vk-seq-head"><span>${esc(a)}</span><span>${esc(b)}</span></div><div class="vk-seq-body">${rows}</div></div>`;
}

/* ---------------------------------------------------------------- 布局 */
function buildFlow(node) {
  const cols = attrOf(node, 'cols') || '1';
  const gap = px(attrOf(node, 'gap') ?? 'normal', GAP.normal);
  const pad = px(attrOf(node, 'pad') ?? 'none', 0);
  /* 每一层 flow 都把列模板写死：否则子 flow 会继承父级模板，
     内层 cols="1" 实际排成父级的两栏（surface-img 的列宽就是这么错的）。 */
  let template;
  if (cols === 'auto') template = 'none';
  else if (/^\d+$/.test(cols)) template = `repeat(${cols}, minmax(0, 1fr))`;
  else template = cols.split(/\s+/).map((n) => (/^\d+$/.test(n) ? `${n}fr` : n)).join(' ');

  setStyle(node, {
    '--vk-gap': `${gap}px`,
    '--vk-pad': `${pad}px`,
    '--vk-cols-template': template,
  });
  if (cols === 'auto') node.attrs.push({ name: 'data-cols', value: 'auto' });
  // 子项跨栏：写在子项自己的自定义属性上，CSS 只有一条规则。
  for (const child of kids(node)) {
    if (!hasAttr(child, 'span')) continue;
    const n = Number(attrOf(child, 'span'));
    if (!Number.isFinite(n) || n <= 1) continue;
    setStyle(child, { '--vk-span': n });
  }
}

function buildSurface(node) {
  const title = attrOf(node, 'title');
  const chrome = attrOf(node, 'chrome') || 'none';
  const body = (node.childNodes || []).map(serialize).join('');
  const hd =
    chrome === 'dots' || title
      ? `<div class="vk-fhd">${chrome === 'dots' ? '<span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}${title ? `<span class="vk-ftitle">${esc(title)}</span>` : ''}</div>`
      : '';
  node.childNodes = [raw(`${hd}<div class="vk-fbd">${body}</div>`)];
}

function buildPage(node) {
  const list = node.childNodes || [];
  const head = list.find((c) => c.tagName === 'vk-head');
  const rest = list.filter((c) => c !== head);
  const gap = px(attrOf(node, 'gap') ?? 'normal', GAP.normal);
  const stage = `<div class="vk-stage">${head ? serialize(head) : ''}<div class="vk-body" style="--vk-gap:${gap}px">${rest.map(serialize).join('')}</div></div>`;
  node.childNodes = [raw(stage)];
}

function buildImg(node, file) {
  const src = attrOf(node, 'src');
  if (!src) return;
  const alt = attrOf(node, 'alt') || '';
  const position = attrOf(node, 'position') || '50% 50%';
  const ratio = attrOf(node, 'ratio');
  let href = src;
  if (!/^[a-z]+:|^\/\//i.test(src)) href = pathToFileURL(path.resolve(path.dirname(path.resolve(file)), src)).href;
  if (ratio) setStyle(node, { 'aspect-ratio': ratio });
  node.childNodes = [raw(`<img class="vk-img-el" src="${esc(href)}" alt="${esc(alt)}" style="object-position:${esc(position)}">`)];
}

/* ---------------------------------------------------------------- 图标 */
let ICON_MAP = null;
const loadIcons = async () => {
  if (ICON_MAP) return ICON_MAP;
  const lucide = await import('lucide');
  ICON_MAP = new Map();
  for (const [name, nodes] of Object.entries(lucide.icons || {})) {
    ICON_MAP.set(name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase(), nodes);
  }
  return ICON_MAP;
};

const iconInner = (nodes) =>
  (nodes || []).map(([tag, attrs]) => `<${tag}${Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}/>`).join('');

async function iconSvg(name) {
  const map = await loadIcons();
  const key = String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');
  const nodes = map.get(key);
  if (!nodes) return null;
  return `<span class="vk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInner(nodes)}</svg></span>`;
}

/* ---------------------------------------------------------------- 主流程 */
const LIBS = {
  fonts: pathToFileURL(path.join(ROOT, 'vk/fonts.css')).href,
  css: pathToFileURL(path.join(ROOT, 'vk/vk.css')).href,
  js: pathToFileURL(path.join(ROOT, 'dist/vk.js')).href,
};

function wrapFragment(body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${LIBS.fonts}">
<link rel="stylesheet" href="${LIBS.css}">
</head>
<body>
${body}
<script src="${LIBS.js}"></script>
</body>
</html>
`;
}

function rewriteLinks(doc, file) {
  for (const node of flatten(doc)) {
    if (node.nodeName !== 'link' && node.nodeName !== 'script') continue;
    const name = node.nodeName === 'link' ? 'href' : 'src';
    const a = (node.attrs || []).find((x) => x.name === name);
    if (!a || /^[a-z]+:|^\/\/|^#/i.test(a.value)) continue;
    a.value = pathToFileURL(path.resolve(path.dirname(path.resolve(file)), a.value)).href;
  }
}

export async function transformHtml(rawHtml, { file }) {
  const isFull = /<html[\s>]/i.test(rawHtml);
  const doc = isFull ? parse(rawHtml, { sourceCodeLocationInfo: true }) : parseFragment(rawHtml, { sourceCodeLocationInfo: true });
  if (isFull) rewriteLinks(doc, file);

  // 先按作者原文校验，再落地默认值：默认值不参与「有没有写」的判断。
  const diag = validate(doc, label(file));
  normalizeTree(doc);
  const assets = new Set();
  const warnings = [];
  const ctx = {
    diag,
    assets,
    item: 1,
    icon: (name) => {
      // 同步别名：图标在构建期逐个 await，这里先返回占位，主流程会换成真 SVG。
      return iconCache.get(String(name).trim().toLowerCase().replace(/[_\s]+/g, '-')) || '';
    },
  };
  const iconCache = new Map();

  /* 先把所有用到的图标一次性解析好（await 不能出现在 render 回调里）。 */
  const iconNames = new Set();
  for (const node of flatten(doc)) {
    if (!node.tagName?.startsWith('vk-')) continue;
    const n = attrOf(node, 'icon');
    if (n) iconNames.add(n);
    for (const key of ['icon-dir', 'icon-file']) {
      const v = attrOf(node, key);
      if (v) iconNames.add(v);
    }
  }
  iconNames.add('folder');
  iconNames.add('file');
  for (const name of iconNames) {
    const svg = await iconSvg(name);
    if (svg) iconCache.set(String(name).trim().toLowerCase().replace(/[_\s]+/g, '-'), svg);
  }

  /* 逆序：先叶子后父级，父级拿到的子节点已经是排好的 HTML。 */
  const nodes = flatten(doc).reverse();
  for (const node of nodes) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    try {
      if (tag === 'vk-code') node.childNodes = [raw(await buildSource(node, file, ctx))];
      else if (tag === 'vk-table') buildTable(node, file, ctx);
      else if (tag === 'vk-list') buildList(node);
      else if (tag === 'vk-tree') node.childNodes = [raw(await buildTree(node, file, ctx))];
      else if (tag === 'vk-math') node.childNodes = [raw(buildMath(node, file, ctx))];
      else if (tag === 'vk-bytes') node.childNodes = [raw(buildBytes(node, file, ctx))];
      else if (tag === 'vk-bits') node.childNodes = [raw(buildBits(node))];
      else if (tag === 'vk-cells') node.childNodes = [raw(buildCells(node))];
      else if (tag === 'vk-head') buildHead(node);
      else if (tag === 'vk-text') buildText(node, file, ctx);
      else if (tag === 'vk-steps') node.childNodes = [raw(buildSteps(node))];
      else if (tag === 'vk-bars') node.childNodes = [raw(buildBars(node))];
      else if (tag === 'vk-timeline') node.childNodes = [raw(buildTimeline(node))];
      else if (tag === 'vk-graph') node.childNodes = [raw(buildGraph(node))];
      else if (tag === 'vk-seq') node.childNodes = [raw(buildSeq(node))];
      else if (tag === 'vk-surface') buildSurface(node);
      else if (tag === 'vk-flow') buildFlow(node);
      else if (tag === 'vk-img') buildImg(node, file);
      else if (tag === 'vk-page') buildPage(node);
    } catch (e) {
      if (process.env.VK_DEBUG) console.error(e);
      diag.push({ file: label(file), line: lineOf(node), tag, code: 'BUILD', message: `<${tag}> 构建失败：${e.message}`, fix: '看这一条的上下文；通常是 src 路径或行段写错' });
    }
  }

  const body = serialize(doc);
  if (diag.length) {
    diag.sort((a, b) => (a.line || 0) - (b.line || 0));
    const e = new Error(diag.map((x) => `${x.file}:${x.line} ${x.message}${x.fix ? ` → ${x.fix}` : ''}`).join('\n'));
    e.diagnostics = diag;
    throw e;
  }
  return { html: isFull ? body : wrapFragment(body), count: nodes.filter((n) => n.tagName === 'vk-page').length, warnings, assets: [...assets] };
}

