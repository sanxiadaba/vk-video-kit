/**
 * 构建期：读作者页 → 校验 → 把"要算的东西"算好 → 写 out/<同路径>。
 *
 * 只改 out/，永不改源文件。产物路径与源同深度，所以作者写的 ../assets / ../vk
 * 在 out/ 里仍然指得到（out/ 里有一份镜像的 vk / dist / assets）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import { createHighlighter } from 'shiki';
import katex from 'katex';
import { TAGS, attrsOf, CANVAS_ATTRS, TAG_NAMES } from './schema.mjs';
import { GAP } from './vocab.mjs';
import { dedent, expandLeadingTabs, stripAnsi, lineSet, LANG_ALIAS, SUPPORTED_LANGS, inferLang } from './shared/code.mjs';
import { parseAsm, splitInsn } from './shared/asm.mjs';

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
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'], settings: { foreground: '#101826' } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.interpolated'], settings: { foreground: '#0B6B4F' } },
    { scope: ['entity.name.function', 'support.function', 'entity.name.class', 'entity.name.type', 'support.class'], settings: { foreground: '#101826' } },
  ],
};
const COLOR_CLASS = { '#101826': 'k', '#0B6B4F': 's', '#667085': 'c' };

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
  if (src && inline != null) throw new Error(`${file}:${lineOf(node)} <${node.tagName}> 同时写了 src 和内联源码：只能二选一`);
  if (!src && inline == null) return null;
  if (inline != null) return dedent(expandLeadingTabs(stripAnsi(inline)));
  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) throw new Error(`${file}:${lineOf(node)} <${node.tagName}> 的 src="${src}" 找不到文件`);
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

/* ---------------------------------------------------------------- 校验 */

const SUGGEST = (name, pool) => {
  let best = '';
  let dist = 99;
  for (const p of pool) {
    const d = editDistance(name, p);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return dist <= 2 ? best : '';
};
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

function validate(root, file, errors) {
  const all = flatten(root);
  const idSeen = {};
  for (const node of all) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    if (!TAGS[tag]) {
      const hint = SUGGEST(tag, TAG_NAMES);
      errors.push(`${file}:${lineOf(node)} 未知标签 <${tag}>${hint ? `，是想写 <${hint}>？` : ''}`);
      continue;
    }
    const spec = attrsOf(tag);
    const parent = node.parentNode?.tagName;
    for (const { name, value } of node.attrs || []) {
      if (name.startsWith('data-') || name.startsWith('aria-') || ['id', 'class', 'style', 'title', 'role', 'hidden'].includes(name)) continue;
      const def = spec[name];
      const canvasOk = parent === 'vk-canvas' && name in CANVAS_ATTRS;
      if (!def && !canvasOk) {
        const hint = SUGGEST(name, Object.keys(spec));
        errors.push(`${file}:${lineOf(node)} <${tag}> 不认识属性 ${name}="${value}"${hint ? `，是想写 ${hint}？` : `；可用：${Object.keys(spec).join(', ')}`}`);
        continue;
      }
      const s = def || CANVAS_ATTRS[name];
      if (s.values && !s.values.includes(value)) {
        errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${name}="${value}" 不在词表里；可用：${s.values.join(' / ')}`);
      }
      if (s.type === 'bool' && value !== '' && value !== 'true') {
        errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${name} 是开关，只写 ${name} 就行`);
      }
      if (s.type === 'index' && !/^-?\d+$/.test(value)) {
        errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${name}="${value}" 要是整数（1 起；-1 = 没有）`);
      }
      if (s.type === 'space' && !(value in GAP) && !/^\d+(\.\d+)?(px)?$/.test(value)) {
        errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${name}="${value}" 不是间距；可用：${Object.keys(GAP).join(' / ')} 或像素数`);
      }
      // 有的属性只在某几种形态下有用：写错形态它就是个哑属性，构建期就说清楚。
      if (s.modes) {
        const modeAttr = (node.attrs || []).find((a) => a.name === 'mode');
        const mode = modeAttr?.value ?? spec.mode?.default ?? '';
        if (mode && !s.modes.includes(mode)) {
          errors.push(
            `${file}:${lineOf(node)} <${tag}> 的 ${name} 只在 mode=${s.modes.map((m) => '\u201c' + m + '\u201d').join(' / ')} 时有用；现在的 mode 是 ${mode}，这个属性不会生效`
          );
        }
      }
    }
    // span 只在 grid 子项上成立；x/y 只在 canvas 子项上。
    if (node.attrs?.some((a) => a.name === 'span' || a.name === 'row-span') && parent !== 'vk-grid') {
      errors.push(`${file}:${lineOf(node)} <${tag}> 的 span 只属于 <vk-grid> 的直接子项（父级是 <${parent || '无'}>）`);
    }
    const spanAttr = node.attrs?.find((a) => a.name === 'span');
    if (spanAttr && parent === 'vk-grid') {
      const cols = Number(attrOf(node.parentNode, 'cols') || 2);
      if (Number(spanAttr.value) > cols) {
        errors.push(
          `${file}:${lineOf(node)} <${tag}> 的 span="${spanAttr.value}" 超过父级 cols="${cols}"：这一行会被挤到下一行。改 span 或改 cols`
        );
      }
    }
    if (node.attrs?.some((a) => ['x', 'y', 'w', 'h', 'z'].includes(a.name)) && parent !== 'vk-canvas' && tag !== 'vk-canvas') {
      errors.push(`${file}:${lineOf(node)} <${tag}> 的 x / y / w / h / z 只在 <vk-canvas> 的子项上成立（父级是 <${parent || '无'}>）`);
    }
    // id 是锚点和出图文件名的依据：重了就是静默覆盖，必须当场说。
    const idAttr = node.attrs?.find((a) => a.name === 'id');
    if (idAttr) {
      const scope = tag === 'vk-page' ? 'page' : 'el';
      const seen = (idSeen[scope] ||= new Map());
      if (seen.has(idAttr.value)) {
        const what = scope === 'page' ? '帧 id' : 'id';
        errors.push(
          `${file}:${lineOf(node)} ${what} \`${idAttr.value}\` 重复了（上一处在第 ${seen.get(idAttr.value)} 行）；出图会互相覆盖，锚点也只会指到第一个`
        );
      } else seen.set(idAttr.value, lineOf(node));
    }

    // 子节点契约
    const kids = (node.childNodes || []).filter((c) => c.tagName && c.tagName !== 'script');
    const model = TAGS[tag].children;
    if (model?.kind === 'item') {
      const bad = kids.filter((c) => c.tagName !== 'li');
      if (bad.length) errors.push(`${file}:${lineOf(node)} <${tag}> 的条目要写成 <li>，而不是 <${bad[0].tagName}>`);
      for (const li of kids.filter((c) => c.tagName === 'li')) {
        for (const { name, value } of li.attrs || []) {
          if (name.startsWith('data-') || name.startsWith('aria-') || ['id', 'class'].includes(name)) continue;
          if (!(name in (model.attrs || {}))) {
            errors.push(`${file}:${lineOf(li)} <${tag}> 的 <li> 不认识属性 ${name}="${value}"；可用：${Object.keys(model.attrs || {}).join(', ') || '无'}`);
          }
        }
      }
      if (!kids.some((c) => c.tagName === 'li')) errors.push(`${file}:${lineOf(node)} <${tag}> 还没有条目：每一条写成 <li>`);
    }
    if (model?.kind === 'table' && !kids.some((c) => c.tagName === 'table')) {
      errors.push(`${file}:${lineOf(node)} <${tag}> 里要有原生 <table>`);
    }
    if (model?.kind === 'slot' && model.exactly && kids.length !== model.exactly) {
      errors.push(`${file}:${lineOf(node)} <${tag}> 需要正好 ${model.exactly} 个子项（现在 ${kids.length} 个）`);
    }
  }
}

/* ---------------------------------------------------------------- 内容件 */

async function buildCode(node, file, errors) {
  const lang = attrOf(node, 'lang') || inferLang(attrOf(node, 'src') || attrOf(node, 'file') || '') || 'text';
  const text = readSource(node, file, 'code');
  if (text == null) {
    errors.push(`${file}:${lineOf(node)} <vk-code> 没有源码：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
    return '';
  }
  const { start, lines } = sliceRange(text, attrOf(node, 'lines'));
  if (!lines.length) {
    errors.push(`${file}:${lineOf(node)} <vk-code> 的 lines="${attrOf(node, 'lines')}" 超出源码范围（共 ${text.split('\n').length} 行）`);
    return '';
  }
  const code = lines.join('\n');
  let body;
  try {
    body = await highlight(code, lang);
  } catch (e) {
    errors.push(`${file}:${lineOf(node)} ${e.message}`);
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
      out.push(`<div class="vk-line is-fold" data-meta>⋯ 省略 ${folded} 行</div>`);
      folded = 0;
    }
    out.push(`<div class="vk-line" data-vk-line="${n}"><span class="vk-ln">${n}</span><span class="vk-src">${rows[i] || ' '}</span></div>`);
  }
  if (folded) out.push(`<div class="vk-line is-fold" data-meta>⋯ 省略 ${folded} 行</div>`);
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
    errors.push(`${file}:${lineOf(node)} <vk-term> 没有内容：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
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

function buildDiff(node, file, errors) {
  const text = readSource(node, file, 'diff');
  if (text == null) {
    errors.push(`${file}:${lineOf(node)} <vk-diff> 没有内容：写 src="文件" 或内联 <script type="text/plain" data-vk-source>`);
    return '';
  }
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
  const html = rows
    .map((r) => {
      if (r.kind === 'hunk') return `<div class="vk-diff-hunk">${esc(r.text)}</div>`;
      n++;
      return `<div class="vk-diff-row ${r.kind === 'same' ? '' : r.kind}" data-vk-line="${n}"><span class="vk-sign">${
        r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '
      }</span><span class="vk-dsrc">${esc(r.text)}</span></div>`;
    })
    .join('');
  const add = rows.filter((r) => r.kind === 'add').length;
  const del = rows.filter((r) => r.kind === 'del').length;
  return `<div class="vk-win"><div class="vk-hd"><span class="vk-dots" aria-hidden="true"><i></i><i></i><i></i></span>${
    attrOf(node, 'file') ? `<span class="vk-file">${esc(attrOf(node, 'file'))}</span>` : ''
  }</div><div class="vk-bd">${html}</div><div class="vk-diff-foot">+${add} / −${del}</div></div>`;
}

function buildMath(node, file, errors) {
  // 三种写法都收：src 文件、内联 <script>、直接写在标签里的 TeX。
  const text = readSource(node, file, 'math') ?? textOf(node);
  if (text == null || !text.trim()) {
    errors.push(`${file}:${lineOf(node)} <vk-math> 没有内容：写 src="文件.tex"，或把 TeX 直接写在标签里`);
    return '';
  }
  try {
    return katex.renderToString(text.trim(), { displayMode: !!node.attrs.some((a) => a.name === 'display'), throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    errors.push(`${file}:${lineOf(node)} 公式排版失败：${e.message}`);
    return '';
  }
}

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
    errors.push(`${file}:${lineOf(node)} <vk-bytes> 缺 src：写 src="文件.bin"`);
    return '';
  }
  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) {
    errors.push(`${file}:${lineOf(node)} <vk-bytes> 的 src="${src}" 找不到文件`);
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
      throw new Error(`${file}:${lineOf(node)} <vk-tree> 的内联 JSON 解析失败：${e.message}`);
    }
    const walk = (items, level, base) => {
      if (level > depth) return '';
      return (items || [])
        .map((it) => {
          const name = typeof it === 'string' ? it : it.name;
          const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
          const p = base ? `${base}/${name}` : name;
          return treeNode(name, isDir, p, it.children ? walk(it.children, level + 1, p) : '');
        })
        .join('');
    };
    const list = Array.isArray(data) ? data : data.children || [data];
    return treeHtml(node, [walk(list, 1, '')], attrOf(node, 'title'));
  }

  const abs = path.resolve(path.dirname(path.resolve(file)), src);
  if (!fs.existsSync(abs)) throw new Error(`${file}:${lineOf(node)} <vk-tree> 的 src="${src}" 找不到目录`);
  const walk = (dir, level, base) => {
    if (level > depth) return '';
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
      .slice(0, 20);
    return entries
      .map((e) => {
        const p = base ? `${base}/${e.name}` : e.name;
        return treeNode(e.name, e.isDirectory(), p, e.isDirectory() ? walk(path.join(dir, e.name), level + 1, p) : '');
      })
      .join('');
  };
  return treeHtml(node, [walk(abs, 1, '')], attrOf(node, 'title'));
}

/* ---------------------------------------------------------------- 图标 */
let ICONS = null;
const loadIcons = async () => {
  if (ICONS) return ICONS;
  try {
    ({ ICONS } = await import('./icons.generated.mjs'));
  } catch {
    throw new Error('缺少图标数据：先跑 npm run build');
  }
  return ICONS;
};

async function iconSvg(name) {
  const icons = await loadIcons();
  const key = String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');
  const inner = icons[key];
  if (!inner) return null;
  return `<span class="vk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
}

/* ---------------------------------------------------------------- 主流程 */

/**
 * 作者页默认是「片段」：只写 <vk-page>，head 与资源由构建注入。
 * 这样页面不必知道自己在第几层目录（../vk 还是 ../../vk），
 * 也不用每次抄一遍 link/script —— 那正是最容易错的地方。
 */
function wrapFragment(body, depth) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${up}vk/fonts.css">
<link rel="stylesheet" href="${up}vk/vk.css">
</head>
<body>
${body}
<script src="${up}dist/vk.js"></script>
</body>
</html>
`;
}

export async function transformHtml(rawHtml, { file, outRel = '' }) {
  const isFull = /<html[\s>]/i.test(rawHtml);
  const depth = outRel ? outRel.split('/').length - 1 : 0;
  const html = rawHtml;
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const errors = [];
  const warnings = [];
  validate(doc, file, errors);

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
          errors.push(`${file}:${lineOf(node)} <${node.tagName}> 的 ${a.name}="${t}" 指向 #${id}，但这一页没有这个 id`);
        }
      }
    }
  }

  const edits = [];

  for (const node of flatten(doc)) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    const loc = node.sourceCodeLocation;
    if (!loc?.startTag || !loc?.endTag) continue;
    const start = loc.startTag.endOffset;
    const end = loc.endTag.startOffset;
    const inner = html.slice(start, end);
    let out = null;

    try {
      if (tag === 'vk-code') out = await buildCode(node, file, errors);
      else if (tag === 'vk-term') out = await buildTerm(node, file, errors);
      else if (tag === 'vk-diff') out = await buildDiff(node, file, errors);
      else if (tag === 'vk-math') out = await buildMath(node, file, errors);
      else if (tag === 'vk-asm') out = await buildAsm(node, file);
      else if (tag === 'vk-bytes') out = await buildBytes(node, file, errors);
      else if (tag === 'vk-tree') out = await buildTree(node, file);
      else if (tag === 'vk-inline' && attrOf(node, 'variant') === 'math') {
        const tex = inlineSource(node) || textOf(node);
        if (tex) {
          try {
            out = katex.renderToString(tex.trim(), { displayMode: false, throwOnError: true, strict: false, output: 'htmlAndMathml' });
          } catch (e) {
            errors.push(`${file}:${lineOf(node)} 行内公式排版失败：${e.message}`);
          }
        }
      }
    } catch (e) {
      // 单个件失败不要吃掉整页的其它错误：记下来，继续。
      if (process.env.VK_DEBUG) console.error('DEBUG', tag, e.stack);
      errors.push(`${file}:${lineOf(node)} <${tag}> 构建失败：${e.message}`);
      out = '';
    }

    const icon = node.attrs?.find((a) => a.name === 'icon')?.value;
    if (icon && (tag === 'vk-text' || tag === 'vk-label')) {
      const svg = await iconSvg(icon);
      if (!svg) errors.push(`${file}:${lineOf(node)} <${tag}> 的 icon="${icon}" 不是 Lucide 图标名`);
      else out = svg + (out ?? inner);
    }

    if (out != null) edits.push({ start, end, html: out });
  }

  // 从不重叠的最内层开始替换：按起点从大到小。
  edits.sort((a, b) => b.start - a.start);
  let result = html;
  for (const e of edits) result = result.slice(0, e.start) + e.html + result.slice(e.end);

  if (errors.length) {
    // 按文件里的行号排序：作者改起来是自上而下的。
    errors.sort((x, y) => Number((x.match(/:\s*(\d+)\s/) || [])[1] || 1e9) - Number((y.match(/:\s*(\d+)\s/) || [])[1] || 1e9));
    const err = new Error(errors.join('\n'));
    err.errors = errors;
    throw err;
  }
  return { html: isFull ? result : wrapFragment(result, depth), count: edits.length, warnings };
}

export const vars = { CANVAS_ATTRS, GAP };
