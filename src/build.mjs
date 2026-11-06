/**
 * 构建期：读作者页 → 校验 → 把"要算的东西"算好 → 写出去。
 *
 * 只写 .vk-cache/pages/，永不改源文件。产物里所有库地址都是绝对 file://，
 * 所以出图不需要再复制一份 vk/ dist/ assets/。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, parseFragment } from 'parse5';
import { createHighlighter } from 'shiki';
import katex from 'katex';
import { validate } from './contract.mjs';
import { dedent, expandLeadingTabs, stripAnsi, lineSet, LANG_ALIAS, SUPPORTED_LANGS, inferLang } from './shared/code.mjs';
import { parseAsm, splitInsn } from './shared/asm.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
/** 错误信息里的路径：相对库根。`file` 本身可以是绝对路径（在别的目录里跑 vk 时）。 */
const label = (f) => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/') || String(f);


/* ---------------------------------------------------------------- 工具 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flatten = (node, out = []) => {
  out.push(node);
  for (const c of node.childNodes || []) flatten(c, out);
  return out;
};
const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
const isText = (n) => n.nodeName === '#text' || typeof n.value === 'string';
const textOf = (node) => (node.childNodes || []).map((c) => (isText(c) ? c.value : c.tagName === 'script' ? '' : textOf(c))).join('');

/* ---------------------------------------------------------------- 主题 */
/* 只用来分词：颜色 → class，颜色本身不写进产物。语法只有三个颜色。 */
const TOKEN_THEME = {
  name: 'vk',
  type: 'light',
  settings: [
    { settings: { foreground: '#0B0F14', background: '#ffffff' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#667085' } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.interpolated'], settings: { foreground: '#0B6B4F' } },
    { scope: ['constant.numeric', 'constant.language', 'support.constant'], settings: { foreground: '#8A4B00' } },
    { scope: ['entity.name.type', 'support.type', 'entity.name.class', 'support.class', 'entity.name.tag'], settings: { foreground: '#4A3A8F' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'], settings: { foreground: '#101826' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#101826' } },
  ],
};
const COLOR_CLASS = { '#101826': 'k', '#0B6B4F': 's', '#667085': 'c', '#8A4B00': 'n', '#4A3A8F': 't' };

let highlighter = null;
const getHighlighter = async () => {
  highlighter ||= await createHighlighter({ themes: [TOKEN_THEME], langs: [] });
  return highlighter;
};

function hastToHtml(node) {
  if (node.type === 'text') return esc(node.value);
  if (node.type !== 'element') return (node.children || []).map(hastToHtml).join('');
  const inner = (node.children || []).map(hastToHtml).join('');
  if (node.tagName === 'span') {
    const color = String(node.properties?.style || '').match(/color:\s*(#[0-9a-f]{6})/i)?.[1]?.toUpperCase();
    const cls = COLOR_CLASS[color];
    if (cls) return `<span class="${cls}">${inner}</span>`;
  }
  return inner;
}

async function highlight(code, lang) {
  const hl = await getHighlighter();
  const key = LANG_ALIAS[String(lang || 'text').toLowerCase()] || String(lang || 'text').toLowerCase();
  if (!hl.getLoadedLanguages().includes(key)) {
    if (!SUPPORTED_LANGS.includes(key)) throw new Error(`不支持的语言 "${lang}"。可用：${SUPPORTED_LANGS.slice(0, 12).join(', ')} …`);
    await hl.loadLanguage(key);
  }
  const hast = hl.codeToHast(code, { lang: key, theme: 'vk' });
  return hast.children.map(hastToHtml).join('');
}

/* ---------------------------------------------------------------- 源码 */

function inlineSource(node) {
  const s = (node.childNodes || []).find((c) => c.tagName === 'script' && attrOf(c, 'data-vk-source') !== null);
  if (!s) return null;
  return (s.childNodes || []).map((c) => c.value || '').join('');
}

function readSource(node, file, what) {
  const src = attrOf(node, 'src');
  const inline = inlineSource(node);
  if (src && inline != null) throw new Error(`${label(file)}:${lineOf(node)} <${node.tagName}> 同时写了 src 和内联源码：只能二选一`);
  if (!src && inline == null) return null;
  if (inline != null) return dedent(expandLeadingTabs(stripAnsi(inline)));
  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) throw new Error(`${label(file)}:${lineOf(node)} <${node.tagName}> 的 src="${src}" 找不到文件`);
  return dedent(expandLeadingTabs(stripAnsi(fs.readFileSync(abs, 'utf8'))));
}

function sliceRange(text, spec) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const raw = String(spec || '').trim();
  const m = raw.match(/^(\d+)\s*(?:-\s*(\d+)?)?$/);
  if (!m) return { start: 1, lines };
  const a = Math.max(1, Number(m[1]));
  const b = m[2] ? Math.min(lines.length, Number(m[2])) : raw.endsWith('-') ? lines.length : a;
  return { start: a, lines: lines.slice(a - 1, Math.max(a, b)) };
}

/* ---------------------------------------------------------------- 校验
   规则与报错全部在 src/contract.mjs（schema 驱动）。这里只负责把构建期算出来的
   东西塞回文档树。
   ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------- 内容件 */

async function buildCode(node, file, errors) {
  const lang = attrOf(node, 'lang') || inferLang(attrOf(node, 'src') || attrOf(node, 'file') || '') || 'text';
  const text = readSource(node, file, 'code');
  if (text == null) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-code> 没有源码：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
    return '';
  }
  const { start, lines } = sliceRange(text, attrOf(node, 'lines'));
  if (!lines.length) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-code> 的 lines="${attrOf(node, 'lines')}" 超出源码范围（共 ${text.split('\n').length} 行）`);
    return '';
  }
  const code = lines.join('\n');
  let body;
  try {
    body = await highlight(code, lang);
  } catch (e) {
    errors.push(`${label(file)}:${lineOf(node)} ${e.message}`);
    return '';
  }
  const rows = body.split('\n');
  const fold = lineSet(attrOf(node, 'fold'));
  const out = [];
  let folded = 0;
  for (let i = 0; i < rows.length; i++) {
    const n = start + i;
    if (fold?.has(n)) {
      folded++;
      continue;
    }
    if (folded) {
      out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-src">省略 ${folded} 行</span></div>`);
      folded = 0;
    }
    out.push(`<div class="vk-line" data-vk-line="${n}"><span class="vk-ln">${n}</span><span class="vk-src">${rows[i] || ' '}</span></div>`);
  }
  if (folded) out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-src">省略 ${folded} 行</span></div>`);
  const file2 = attrOf(node, 'file');
  const range = attrOf(node, 'lines');
  const chrome = attrOf(node, 'chrome') || 'min';
  const head =
    chrome === 'none'
      ? ''
      : `<div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>${
          file2 ? `<span class="vk-file">${esc(file2)}</span>` : ''
        }${range ? `<span class="vk-range">${esc(range)}</span>` : ''}</div>`;
  return `<div class="vk-win" data-chrome="${chrome}">${head}<div class="vk-bd">${out.join('')}</div></div>`;
}

async function buildTerm(node, file, errors) {
  const text = readSource(node, file, 'term');
  if (text == null) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-term> 没有内容：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
    return '';
  }
  const prompt = attrOf(node, 'prompt') || '$';
  const lines = text.split('\n');
  const parts = [];
  let n = 0;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line) continue;
    n++;
    const p = line.startsWith(prompt) ? prompt : '';
    if (p) {
      const cmd = line.slice(p.length).trim();
      parts.push(
        `<div class="vk-line" data-vk-line="${n}"><span class="vk-prompt">${esc(p)}</span> <span class="vk-cmd">${esc(cmd)}</span></div>`
      );
    } else {
      const isErr = /\b(error|Error|ERROR|fatal|failed|not found|No such)\b|错误|失败/.test(line);
      parts.push(`<div class="vk-line" data-vk-line="${n}"><span class="${isErr ? 'vk-err' : 'vk-out'}">${esc(line)}</span></div>`);
    }
  }
  const title = attrOf(node, 'title');
  const chrome = attrOf(node, 'chrome') || 'min';
  const head =
    chrome === 'none'
      ? ''
      : `<div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>${
          title ? `<span class="vk-file">${esc(title)}</span>` : ''
        }</div>`;
  return `<div class="vk-win vk-term" data-chrome="${chrome}">${head}<div class="vk-bd">${parts.join('')}</div></div>`;
}

async function buildDiff(node, file, errors) {
  const text = readSource(node, file, 'diff');
  if (text == null) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-diff> 没有内容：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
    return '';
  }
  const lang = attrOf(node, 'lang');
  const rows = [];
  for (const line of text.split('\n')) {
    if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) continue;
    if (line.startsWith('@@')) {
      rows.push({ kind: 'hunk', text: line });
      continue;
    }
    if (line.startsWith('+')) rows.push({ kind: 'add', text: line.slice(1) });
    else if (line.startsWith('-')) rows.push({ kind: 'del', text: line.slice(1) });
    else rows.push({ kind: 'same', text: line.replace(/^ /, '') });
  }
  let n = 0;
  const parts = [];
  for (const r of rows) {
    if (r.kind === 'hunk') {
      parts.push(`<div class="vk-diff-hunk">${esc(r.text)}</div>`);
      continue;
    }
    n++;
    // 有 lang 才上语法色：diff 的 +/- 是语义色，语法色在右半边，两边不抢。
    let body = esc(r.text);
    if (lang) {
      try {
        body = await highlight(r.text || ' ', lang);
      } catch (e) {
        errors.push(`${label(file)}:${lineOf(node)} ${e.message}`);
        return '';
      }
    }
    parts.push(
      `<div class="vk-diff-row ${r.kind === 'same' ? '' : r.kind}" data-vk-line="${n}"><span class="vk-sign">${
        r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '
      }</span><span class="vk-dsrc">${body}</span></div>`
    );
  }
  const add = rows.filter((r) => r.kind === 'add').length;
  const del = rows.filter((r) => r.kind === 'del').length;
  return `<div class="vk-win"><div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>${
    attrOf(node, 'file') ? `<span class="vk-file">${esc(attrOf(node, 'file'))}</span>` : ''
  }</div><div class="vk-bd">${parts.join('')}</div><div class="vk-diff-foot">+${add} / −${del}</div></div>`;
}

function buildMath(node, file, errors) {
  // 三种写法都收：src 文件、内联 <script>、直接写在标签里的 TeX。
  const text = readSource(node, file, 'math') ?? textOf(node);
  if (text == null || !text.trim()) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-math> 没有内容：写 src="文件.tex"，或把 TeX 直接写在标签里`);
    return '';
  }
  try {
    return katex.renderToString(text.trim(), { displayMode: !!node.attrs.some((a) => a.name === 'display'), throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    errors.push(`${label(file)}:${lineOf(node)} 公式排版失败：${e.message}`);
    return '';
  }
}

/** 对齐填充：nop / int3 / 末尾的 lea 0x0(...) —— 不是函数干的事，标出来。 */
const isPaddingInsn = (mnemonic, operands) =>
  /^(nop|int3|xchg|lea)$/i.test(mnemonic) &&
  (/^(nop|int3)$/i.test(mnemonic) || /^0x0\(/.test(operands) || /%ax,\s*%ax/.test(operands));

function buildAsm(node, file) {
  const showBytes = (node.attrs || []).some((a) => a.name === 'bytes');
  const text = readSource(node, file, 'asm');
  if (text == null) return '';
  const { rows } = parseAsm(text);
  const raw = lineSet(attrOf(node, 'lines'));
  const keep = raw && raw.size ? raw : null;
  let n = 0;
  const body = rows
    .filter((r, i) => !keep || keep.has(i + 1))
    .map((r) => {
      if (r.kind === 'blank') return '';
      n++;
      if (r.kind === 'label') {
        // 标签行和紧接着的指令同地址：再写一遍地址只是噪音，留空。
        return `<div class="vk-arow vk-alabel" data-vk-line="${n}"><span class="vk-aaddr"></span><span class="vk-ainsn">${esc(
          '<' + r.text + '>:'
        )}</span></div>`;
      }
      const { mnemonic, operands } = splitInsn(r.text);
      return `<div class="vk-arow" data-vk-line="${n}"${r.addr ? ` data-vk-addr="${esc(r.addr)}"` : ''}><span class="vk-aaddr">${esc(r.addr)}</span>${
        showBytes ? `<span class="vk-abytes">${esc(r.bytes)}</span>` : ''
      }<span class="vk-ainsn">${esc(mnemonic)}</span><span class="vk-aops">${esc(operands)}</span></div>`;
    })
    .join('');
  const lines = attrOf(node, 'lines');
  return `<div class="vk-win"><div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>${
    attrOf(node, 'file') ? `<span class="vk-file">${esc(attrOf(node, 'file'))}</span>` : ''
  }${lines ? `<span class="vk-range">${esc(lines)}</span>` : ''}</div><div class="vk-bd">${body}</div></div>`;
}

function buildBytes(node, file, errors) {
  const src = attrOf(node, 'src');
  if (!src) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-bytes> 缺 src：写 src="文件.bin"`);
    return '';
  }
  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) {
    errors.push(`${label(file)}:${lineOf(node)} <vk-bytes> 的 src="${src}" 找不到文件`);
    return '';
  }
  const buf = fs.readFileSync(abs);
  const start = Number(attrOf(node, 'offset') || 0) || 0;
  const len = Math.min(Number(attrOf(node, 'length') || 32) || 32, buf.length - start);
  const cols = attrOf(node, 'cols') === '4' ? 4 : 8;
  const base = Number(attrOf(node, 'addr') || '0x0');
  const rows = [];
  for (let i = 0; i < len; i += cols) {
    const chunk = [...buf.subarray(start + i, start + i + cols)];
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
    rows.push(
      `<div class="vk-brow" data-vk-line="${i / cols + 1}"><span class="vk-baddr">0x${(base + start + i)
        .toString(16)
        .padStart(4, '0')}</span><span class="vk-hex">${chunk
        .map((b, j) => `<i data-vk-byte="${i + j + 1}">${b.toString(16).padStart(2, '0')}</i>`)
        .join('')}</span><span class="vk-ascii">${esc(ascii)}</span></div>`
    );
    void hex;
  }
  return `<div class="vk-win"><div class="vk-bd">${rows.join('')}</div></div>`;
}

function treeHtml(node, rows, title) {
  const head = title
    ? `<div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="vk-file">${esc(title)}</span></div>`
    : '';
  return `<div class="vk-win">${head}<div class="vk-bd vk-tree">${rows.join('')}</div></div>`;
}

/** 一个节点：名字 + 子节点。缩进与导线由 CSS 画，不靠 └── 字符。 */
function treeNode(name, isDir, nodePath, kids = '') {
  return (
    `<div class="vk-node" data-vk-node="${esc(nodePath)}"${isDir ? ' data-dir' : ''}>` +
    `<span class="vk-tname">${esc(name)}${isDir ? '/' : ''}</span>` +
    (kids ? `<div class="vk-kids">${kids}</div>` : '') +
    `</div>`
  );
}

function buildTree(node, file) {
  const src = attrOf(node, 'src');
  const depth = Number(attrOf(node, 'depth') || 3) || 3;

  if (!src) {
    const inline = (node.childNodes || []).find((c) => c.tagName === 'script');
    if (!inline) return '';
    let data;
    try {
      data = JSON.parse((inline.childNodes || []).map((c) => c.value || '').join(''));
    } catch (e) {
      throw new Error(`${label(file)}:${lineOf(node)} <vk-tree> 的内联 JSON 解析失败：${e.message}`);
    }
    let budget = Number(attrOf(node, 'max') || 10) || 10;
    let more = false;
    const walk = (items, level, base) => {
      if (level > depth || budget <= 0) return '';
      const rows = [];
      for (const it of items || []) {
        if (budget <= 0) {
          more = true;
          break;
        }
        budget--;
        const name = typeof it === 'string' ? it : it.name;
        const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
        const p = base ? `${base}/${name}` : name;
        rows.push(treeNode(name, isDir, p, it.children ? walk(it.children, level + 1, p) : ''));
      }
      return rows.join('');
    };
    const list = Array.isArray(data) ? data : data.children || [data];
    const body = walk(list, 1, '');
    return treeHtml(node, [body + (more ? '<div class="vk-node is-more">…还有更多</div>' : '')], attrOf(node, 'title'));
  }

  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) throw new Error(`${label(file)}:${lineOf(node)} <vk-tree> 的 src="${src}" 找不到目录`);
  // 目录树也有一帧的容量上限：超了就截断，只在末尾留一行说明（不在每一层各留一行）。
  let budget = Number(attrOf(node, 'max') || 10) || 10;
  let truncated = false;
  const walk = (dir, level, base) => {
    if (level > depth) return '';
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
      .slice(0, 20);
    const rows = [];
    for (const e of entries) {
      if (budget <= 0) {
        truncated = true;
        break;
      }
      budget--;
      const p = base ? `${base}/${e.name}` : e.name;
      rows.push(treeNode(e.name, e.isDirectory(), p, e.isDirectory() ? walk(path.join(dir, e.name), level + 1, p) : ''));
    }
    return rows.join('');
  };
  const body = walk(abs, 1, '');
  return treeHtml(node, [body + (truncated ? '<div class="vk-node is-more">…还有更多</div>' : '')], attrOf(node, 'title'));
}

/* ---------------------------------------------------------------- 图标 */
/* 直接读 lucide 的图标节点（[[tag, attrs], …]），不生成中间文件。
   全表 2169 个，按需查；名字是 kebab-case。 */
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
  (nodes || [])
    .map(([tag, attrs]) => `<${tag}${Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}/>`)
    .join('');

async function iconSvg(name) {
  const map = await loadIcons();
  const key = String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');
  const nodes = map.get(key);
  if (!nodes) return null;
  return `<span class="vk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInner(nodes)}</svg></span>`;
}

function suggestIcon(name) {
  const key = String(name).trim().toLowerCase();
  let best = '';
  let score = 99;
  for (const k of ICON_MAP.keys()) {
    if (k.includes(key) || key.includes(k)) return k;
    const d = Math.abs(k.length - key.length);
    if (d < score) {
      score = d;
      best = k;
    }
  }
  return best;
}

/* ---------------------------------------------------------------- 主流程 */

/* ---------------------------------------------------------------- 序列化 */

/** 挂在树上的原始 HTML 片段：序列化时原样输出（构建期已经排好，不能再被转义）。 */
const raw = (html) => ({ nodeName: '#raw', value: html, childNodes: [], attrs: [] });

const VOID = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

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
      const open = `<${tag}${attrText(node.attrs)}>`;
      if (VOID.has(tag)) return open;
      return `${open}${(node.childNodes || []).map(serialize).join('')}</${tag}>`;
    }
  }
}

/* ---------------------------------------------------------------- 路径 */
const abs = (p) => pathToFileURL(p).href;
const LIBS = {
  fonts: abs(path.join(ROOT, 'vk/fonts.css')),
  css: abs(path.join(ROOT, 'vk/vk.css')),
  js: abs(path.join(ROOT, 'dist/vk.js')),
};

/** 作者写的相对路径 → 绝对 file:// 地址。构建产物不再复制一份 vk/ dist/ assets/。 */
function toAbs(src, file) {
  if (!src || /^[a-z]+:|^\/\//i.test(src)) return src;
  return abs(path.resolve(path.dirname(path.resolve(file)), src.split('#')[0].split('?')[0]));
}

function rewritePageLinks(doc, file) {
  for (const node of flatten(doc)) {
    if (node.nodeName !== 'link' && node.nodeName !== 'script') continue;
    const name = node.nodeName === 'link' ? 'href' : 'src';
    const a = (node.attrs || []).find((x) => x.name === name);
    if (a) a.value = toAbs(a.value, file);
  }
}

/* ---------------------------------------------------------------- 主流程 */

/**
 * 作者页默认是「片段」：只写 <vk-page>，head 与资源由构建注入。
 * 注入的是绝对 file:// 地址：产物落在哪里都指得到，构建期也不用再复制一份库。
 */
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

export async function transformHtml(rawHtml, { file }) {
  const isFull = /<html[\s>]/i.test(rawHtml);
  const doc = isFull ? parse(rawHtml, { sourceCodeLocationInfo: true }) : parseFragment(rawHtml, { sourceCodeLocationInfo: true });
  if (isFull) rewritePageLinks(doc, file);

  const problems = validate(doc, label(file));
  const errors = problems.slice();
  const warnings = [];

  // 锚点里写死的 #id 必须在同一份文档里存在：不然运行期只会安静地不画。
  const ids = new Set(flatten(doc).filter((n) => (n.attrs || []).some((a) => a.name === 'id')).map((n) => attrOf(n, 'id')));
  for (const node of flatten(doc)) {
    if (!node.tagName?.startsWith('vk-')) continue;
    for (const a of node.attrs || []) {
      if (!['for', 'from', 'to'].includes(a.name)) continue;
      for (const piece of String(a.value).split(';')) {
        const t = piece.trim();
        if (!t.startsWith('#')) continue;
        const id = t.slice(1).split('@')[0];
        if (id && !ids.has(id)) {
          errors.push({ file: label(file), line: lineOf(node), message: `<${node.tagName}> 的 ${a.name}="${t}" 指向 #${id}，但这一页没有这个 id`, fix: '改成页里存在的 id，或给目标加 id' });
        }
      }
    }
  }

  /* 第一阶段：只读地把要算的东西算好（异步，逐个等）。 */
  const rendered = new Map();
  const icons = new Map();
  for (const node of flatten(doc)) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    try {
      if (tag === 'vk-code') rendered.set(node, await buildCode(node, file, errors));
      else if (tag === 'vk-term') rendered.set(node, await buildTerm(node, file, errors));
      else if (tag === 'vk-diff') rendered.set(node, await buildDiff(node, file, errors));
      else if (tag === 'vk-math') rendered.set(node, await buildMath(node, file, errors));
      else if (tag === 'vk-asm') rendered.set(node, await buildAsm(node, file, errors));
      else if (tag === 'vk-bytes') rendered.set(node, await buildBytes(node, file, errors));
      else if (tag === 'vk-tree') rendered.set(node, await buildTree(node, file, errors));
      else if (tag === 'vk-inline' && attrOf(node, 'variant') === 'math') {
        const tex = inlineSource(node) || textOf(node);
        if (tex) rendered.set(node, katex.renderToString(tex.trim(), { displayMode: false, throwOnError: true, strict: false, output: 'htmlAndMathml' }));
      } else if (tag === 'vk-img') {
        const a = (node.attrs || []).find((x) => x.name === 'src');
        if (a && a.value) a.value = toAbs(a.value, file);
      } else if (tag === 'vk-compare') {
        // labels="a.png,b.png|改前|改后"：前两段是图片路径，要换成绝对地址。
        const a = (node.attrs || []).find((x) => x.name === 'labels');
        if (a && a.value) {
          const [srcs, ...caps] = a.value.split('|');
          a.value = [srcs.split(',').map((s) => toAbs(s.trim(), file)).join(','), ...caps].join('|');
        }
      }
      const icon = attrOf(node, 'icon');
      if (icon && (tag === 'vk-text' || tag === 'vk-label')) {
        const svg = await iconSvg(icon);
        if (!svg) {
          const near = suggestIcon(icon);
          errors.push({ file: label(file), line: lineOf(node),
            message: `<${tag}> 的 icon="${icon}" 找不到`,
            fix: near ? `是想写 "${near}"？全表用 vk icons <词> 搜` : '全表用 vk icons <词> 搜；图标名是 Lucide 的 kebab 名',
          });
        } else icons.set(node, svg);
      }
    } catch (e) {
      if (process.env.VK_DEBUG) console.error('DEBUG', tag, e.stack);
      errors.push({ file: label(file), line: lineOf(node), message: `<${tag}> 构建失败：${e.message}`, fix: '看这条错误的上一行；通常是 src 路径或行段写错' });
    }
  }

  /* 第二阶段：把算好的片段挂回树上。嵌套件（label 里的行内公式）天然正确。 */
  for (const [node, html] of rendered) node.childNodes = [raw(html)];
  for (const [node, svg] of icons) node.childNodes = [raw(svg), ...node.childNodes];
  // 图标之外的元素（不需要重排的）保持原样；作者写的 <script data-vk-source> 跟着内容一起被替换掉了。

  const body = serialize(doc);
  if (errors.length) {
    errors.sort((a, b) => (a.line || 0) - (b.line || 0));
    const e = new Error(errors.map((x) => `${x.file}:${x.line} ${x.message}${x.fix ? ` → ${x.fix}` : ''}`).join('\n'));
    e.errors = errors;
    throw e;
  }
  return { html: isFull ? body : wrapFragment(body), count: rendered.size, warnings };
}




