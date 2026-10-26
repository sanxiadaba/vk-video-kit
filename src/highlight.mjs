/**
 * vk 高亮核心 —— CLI 与 dev server 都调这里。
 *
 * 为什么不是正则：
 * HTML 不是正则能改的东西。`<vk-code>` 可能出现在注释、模板、属性值里，
 * 而 `<` / 引号 / 自闭合标签的边界正则永远差一条。这里用 parse5 的
 * sourceCodeLocation：只替换元素内部的字节区间，作者的 HTML 一个字节都不重排。
 *
 * 为什么源码可以从文件来：
 * `<vk-code lang="c" src="code/hello.c">` 让 .c 文件成为单一真源：
 * 不用把 `#include <stdio.h>` 写成 `&lt;stdio.h&gt;`，也能用编辑器写、用 gcc 编译。
 * 构建期把源码内联进 HTML，产物仍然是自包含的。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import { createHighlighter } from 'shiki';
import katex from 'katex';
import { tokenDiff } from './runtime/code-utils.mjs';
import { dedent, expandLeadingTabs, hash32, sliceLines, parseDiffItems, buildRows, LANG_ALIAS, EXT_LANG, SUPPORTED_LANGS, inferLang as inferLangShared } from './shared/code.mjs';
import { ICONS } from './icons.generated.mjs';
import { TAGS } from './registry.mjs';

/* ------------------------------------------------------------------ 主题 */

/**
 * 只用来「分词 + 给 token 一个稳定颜色」，颜色本身不写进产物。
 * 颜色 -> class 的映射在下面；改外观请改 vk/vk.css 的 --vk-syn-*。
 */
export const THEME = {
  name: 'vk-tokenize',
  type: 'light',
  settings: [
    { settings: { foreground: '#0B0F14', background: '#ffffff' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#6B7280', fontStyle: 'italic' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'], settings: { foreground: '#101826' } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.interpolated'], settings: { foreground: '#0F766E' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#9A4708' } },
    // f-string 的 {} 是标点，不是数字；别让插值比变量更响
    { scope: ['constant.character.format.placeholder'], settings: { foreground: '#5B6779' } },
    // 不要映射 meta.function-call：它会把整个实参表都染成函数色（printf("…", x, p) 里的 x/p 全紫）
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#5B21B6' } },
    { scope: ['entity.name.class', 'entity.name.type', 'support.class'], settings: { foreground: '#5B21B6' } },
    { scope: ['support.function.builtin', 'variable.language'], settings: { foreground: '#0E7490' } },
    { scope: ['keyword.operator', 'punctuation.operator'], settings: { foreground: '#475569' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#5B6779' } },
    { scope: ['entity.name.tag', 'meta.tag'], settings: { foreground: '#101826' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#5B21B6' } },
  ],
};

export const COLOR_CLASS = {
  '#101826': 'vk-k', // keyword（视觉上与正文同色，靠字重区分）
  '#0F766E': 'vk-s', // string
  '#9A4708': 'vk-n', // number / constant
  '#5B21B6': 'vk-f', // function / class
  '#0E7490': 'vk-b', // builtin
  '#475569': 'vk-o', // operator
  '#5B6779': 'vk-p', // punctuation
  '#6B7280': 'vk-c', // comment
};

/* ------------------------------------------------------------- 语言表 */

const SUPPORTED = new Set(SUPPORTED_LANGS);

export function resolveLang(raw) {
  const key = String(raw || 'text').toLowerCase();
  const lang = LANG_ALIAS[key] || key;
  if (!SUPPORTED.has(lang)) {
    throw new Error(`不支持的语言 "${raw}"。已支持：${[...SUPPORTED].sort().join(', ')}`);
  }
  return lang;
}

export { EXT_LANG };
export const inferLang = inferLangShared;

/* ----------------------------------------------------------------- 工具 */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 源码作为文本节点时只需要转义 & < >；引号保持原样，方便人读生成后的 HTML */
const escText = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// dedent / expandLeadingTabs / sliceLines / hash32 / parseDiffItems /
// buildRows / tokenDiff 全部来自 src/shared/code.mjs：构建期与运行时只有一份。

/* --------------------------------------------------------------- 分词 */

/** token 是否在字符串 / f-string / 注释里：括号着色必须跳过 */
function scopeKinds(token) {
  const scopes = (token.explanation || []).flatMap((e) => (e.scopes || []).map((s) => s.scopeName));
  const isStr = scopes.some(
    (s) =>
      /(^|\.)string(\.|$)/.test(s) ||
      /(^|\.)meta\.fstring(\.|$)/.test(s) ||
      /constant\.character\.format\.placeholder/.test(s)
  );
  const isCmt = scopes.some((s) => /(^|\.)comment(\.|$)/.test(s));
  return { isStr, isCmt };
}

function tokenHtml(t) {
  const content = t.content;
  if (!content) return '';
  const { isStr, isCmt } = scopeKinds(t);
  const cls = [];
  if (isCmt) {
    cls.push('vk-c');
  } else {
    const c = COLOR_CLASS[String(t.color || '').toUpperCase()];
    if (c) cls.push(c);
  }
  const fs = t.fontStyle || 0;
  if (fs & 1) cls.push('vk-it');
  if (fs & 2) cls.push('vk-bw');
  if (fs & 4) cls.push('vk-un');

  const tok = isCmt ? 'c' : isStr ? 's' : '';
  if (!cls.length && !tok) return esc(content);
  return `<span${cls.length ? ` class="${cls.join(' ')}"` : ''}${tok ? ` data-tok="${tok}"` : ''}>${esc(content)}</span>`;
}

/** 整块分词：codeToTokens 保留多行字符串 / 模板字符串的上下文 */
export async function paintCode(highlighter, code, lang) {
  await ensureLang(highlighter, lang);
  const { tokens } = await highlighter.codeToTokens(code, {
    lang,
    theme: THEME.name,
    includeExplanation: 'scopeName',
  });
  return tokens.map((line) => (line.length ? line.map(tokenHtml).join('') : ' '));
}

const LANG_LOADED = new WeakMap();

/**
 * 按需加载语法：一个页面只用到 c / python / bash 时，不必把 32 种语法全装进来。
 * 同一个 highlighter 并发请求同一种语言时只加载一次。
 */
export async function ensureLang(highlighter, lang) {
  if (!lang || lang === 'text') return;
  // 注入的 fake highlighter（测试）没有 loadLanguage：视为语法已经就绪
  if (typeof highlighter.loadLanguage !== 'function') return;
  let map = LANG_LOADED.get(highlighter);
  if (!map) {
    map = new Map();
    LANG_LOADED.set(highlighter, map);
  }
  if (map.has(lang)) return map.get(lang);
  const p = highlighter.loadLanguage(lang).then(() => undefined);
  map.set(lang, p);
  await p;
}

export async function createVkHighlighter(langs = []) {
  const unique = [...new Set(langs)].filter((l) => l !== 'text');
  const hl = await createHighlighter({ themes: [THEME], langs: unique });
  LANG_LOADED.set(hl, new Map(unique.map((l) => [l, Promise.resolve()])));
  return hl;
}

/* ------------------------------------------------------------- parse5 */

const attr = (node, name) => {
  const a = (node.attrs || []).find((x) => x.name === name);
  return a ? a.value : null;
};
const hasAttr = (node, name) => !!(node.attrs || []).find((x) => x.name === name);

function walk(node, fn) {
  fn(node);
  if (node.childNodes) for (const c of node.childNodes) walk(c, fn);
  // <template> 的内容不在 childNodes 里；标本页的四个非默认镜头靠它做惰性装载。
  if (node.content) walk(node.content, fn);
}

const GLOBAL_ATTRS = new Set([
  'id', 'class', 'className', 'style', 'title', 'role', 'tabindex', 'slot', 'part',
  'x', 'y', 'lang', 'dir', 'hidden', 'aria-hidden', 'aria-label', 'aria-labelledby',
]);

/** 构建期校验：作者页面的枚举/范围/布尔/图标名必须在 registry 内，不能静默。 */
function validateAuthorHtml(doc, file) {
  const errors = [];
  const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
  walk(doc, (node) => {
    const tag = node.tagName;
    if (!tag || !tag.startsWith('vk-') || !TAGS[tag]) return;
    const def = TAGS[tag];
    const attrs = new Map((node.attrs || []).map((a) => [a.name, a.value]));
    for (const [name, raw] of attrs) {
      if (name.startsWith('data-') || name.startsWith('aria-') || GLOBAL_ATTRS.has(name)) {
        if (name === 'slot') {
          const parent = node.parentNode?.tagName;
          const allowed = (TAGS[parent]?.slots || []).map((s) => s.name);
          if (!allowed.includes(raw)) errors.push(`${file}:${lineOf(node)} <${parent || '?'}> 不支持 slot="${raw}"；可用：${allowed.join(', ') || '无'}`);
        }
        continue;
      }
      const spec = def.attrs?.[name];
      const where = `${file}:${lineOf(node)} <${tag}>`;
      if (!spec) {
        errors.push(`${where} 未知属性 ${name}="${raw}"；可用：${Object.keys(def.attrs || {}).join(', ') || '无'}`);
        continue;
      }
      if (spec.type === 'bool') {
        if (raw !== '' && raw !== 'true') errors.push(`${where} 布尔属性 ${name} 只写名字（现在 ${name}="${raw}" 仍会被当成真）`);
        continue;
      }
      if (spec.values && !spec.values.includes(raw)) {
        errors.push(`${where} ${name}="${raw}" 不在 ${spec.values.join(' / ')} 内`);
        continue;
      }
      if (spec.type === 'num' || spec.type === 'int') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          errors.push(`${where} ${name}="${raw}" 不是数字`);
        } else if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          errors.push(`${where} ${name}="${raw}" 超出 ${spec.min ?? '−∞'}…${spec.max ?? '∞'}`);
        }
      }
      if (spec.type === 'size') {
        const special = raw === 'fit' || raw === 'full' || raw === 'auto';
        if (!special) {
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            errors.push(`${where} ${name}="${raw}" 不是数字，也不是 fit / full`);
          } else if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
            errors.push(`${where} ${name}="${raw}" 超出 ${spec.min ?? '−∞'}…${spec.max ?? '∞'}`);
          }
        }
      }
      if (spec.type === 'lines') {
        const bad = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .some((part) => {
            const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
            if (!m) return true;
            const a = Number(m[1]);
            const b = m[2] ? Number(m[2]) : a;
            return a < 1 || b < a;
          });
        if (bad) errors.push(`${where} ${name}="${raw}" 不是合法行段（1、1-8、1,3-5）`);
      }
    }
    const slotDefs = def.slots || [];
    if (slotDefs.length) {
      const allowedSlots = slotDefs.map((s) => s.name);
      const childSlots = [];
      for (const child of node.childNodes || []) {
        const slotAttr = (child.attrs || []).find((a) => a.name === 'slot');
        if (!slotAttr) continue;
        childSlots.push(slotAttr.value);
        if (!allowedSlots.includes(slotAttr.value)) {
          errors.push(`${file}:${lineOf(node)} <${tag}> 不支持 slot="${slotAttr.value}"；可用：${allowedSlots.join(', ')}`);
        }
      }
      const slots = new Set(childSlots);
      for (const slotName of allowedSlots) {
        if (slots.has(slotName) && attrs.has(slotName)) {
          errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${slotName} 不能同时写 slot 和属性；二选一`);
        }
      }
    }
    if (tag === 'vk-figure') {
      const caps = (node.childNodes || []).filter((c) => c.tagName === 'figcaption').length;
      if (caps > 1) errors.push(`${file}:${lineOf(node)} <vk-figure> 只能有一个 figcaption`);
      if (caps && attrs.has('caption')) errors.push(`${file}:${lineOf(node)} <vk-figure> 的 figcaption 和 caption 不能同时写`);
    }
    if (tag === 'vk-note' && (attrs.has('line') || attrs.has('for'))) {
      let p = node.parentNode;
      let inside = false;
      while (p) {
        if (p.tagName === 'vk-annotate') inside = true;
        p = p.parentNode;
      }
      if (!inside) errors.push(`${file}:${lineOf(node)} <vk-note> 的 line/for 只能写在 <vk-annotate> 内`);
    }
    if (tag === 'vk-icon') {
      const name = attrs.get('name');
      if (name && !ICONS[name]) {
        const near = Object.keys(ICONS).filter((n) => n.includes(name) || name.includes(n)).slice(0, 3);
        errors.push(`${file}:${lineOf(node)} <vk-icon> 没有图标 "${name}"${near.length ? `；近似：${near.join(' / ')}` : ''}`);
      }
    }
  });
  return errors;
}

/** 收集元素内的纯文本；跳过上一次构建写进去的 <script data-vk-hl…> */
function collectText(node) {
  let text = '';
  let hasElement = false;
  const visit = (n) => {
    if (n.nodeName === '#text') {
      text += n.value;
      return;
    }
    if (n.tagName) {
      if (
        n.tagName === 'script' &&
        (hasAttr(n, 'data-vk-hl') ||
          hasAttr(n, 'data-vk-hl-diff') ||
          hasAttr(n, 'data-vk-math') ||
          hasAttr(n, 'data-vk-src') ||
          hasAttr(n, 'data-vk-tree') ||
          hasAttr(n, 'data-vk-bytes') ||
          hasAttr(n, 'data-vk-frames'))
      )
        return;
      hasElement = true;
      for (const c of n.childNodes || []) visit(c);
    }
  };
  for (const c of node.childNodes || []) visit(c);
  return { text, hasElement };
}

const locOf = (node) => node.sourceCodeLocation || {};
const lineOf = (node) => {
  const l = locOf(node);
  return (l.startLine || (l.startTag && l.startTag.startLine) || 1);
};

/** 源码从真实文件来；HTML 里只留引用，源码放在机器数据里，不重复第二份。 */
const srcScript = (text) =>
  `<script type="application/json" data-vk-src>${JSON.stringify({ text }).replace(/</g, '\\u003c')}</script>`;

/** 真实目录 -> 树数据；不猜状态，只报目录里真实存在的东西。 */
function treeOf(abs, rootLabel, maxDepth = 4, showHidden = false) {
  const entries = [];
  const limit = 500;
  const walkDir = (dir, rel, depth) => {
    if (depth > maxDepth) return;
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    items = items
      .filter((d) => (showHidden || !d.name.startsWith('.')) && d.name !== 'node_modules')
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    for (const item of items) {
      if (entries.length >= limit) return;
      const full = path.join(dir, item.name);
      const childRel = path.posix.join(rel, item.name);
      const isDir = item.isDirectory();
      let size = 0;
      try {
        if (!isDir) size = fs.statSync(full).size;
      } catch {
        /* 读不到大小就留空 */
      }
      entries.push({
        name: item.name,
        path: childRel,
        depth,
        type: isDir ? 'dir' : 'file',
        ext: isDir ? '' : path.extname(item.name).slice(1).toLowerCase(),
        size,
      });
      if (isDir) walkDir(full, childRel, depth + 1);
    }
  };
  const st = fs.statSync(abs);
  if (st.isDirectory()) walkDir(abs, '', 0);
  else
    entries.push({
      name: path.basename(abs),
      path: path.basename(abs),
      depth: 0,
      type: 'file',
      ext: path.extname(abs).slice(1).toLowerCase(),
      size: st.size,
    });
  return { root: rootLabel, entries, total: entries.length, truncated: entries.length >= limit };
}

/* --------------------------------------------------------------- 图标注入 */

/** 只把本页 <vk-icon> 用到的 SVG 注入页面；运行时不带全量图标表。 */
function applyIcons(html, names) {
  if (!names.size) return html;
  const map = {};
  for (const name of names) if (ICONS[name]) map[name] = ICONS[name];
  const script = `<script type="application/json" data-vk-icons>${JSON.stringify(map).replace(/</g, '\\u003c')}</script>`;
  const re = /<script[^>]*data-vk-icons[^>]*>[\s\S]*?<\/script>/i;
  if (re.test(html)) return html.replace(re, script);
  if (!script) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${script}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => m + script);
  return script + html;
}

/**
 * 把一个 HTML 字符串里的 <vk-code> / <vk-diff> 预编译。
 *
 * 只替换元素的内部区间：开始标签、属性、周围的空白、注释，一个字节都不动。
 * 返回 { html, count }。
 */
export async function transformHtml(html, { file = '<memory>', highlighter } = {}) {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const errors = validateAuthorHtml(doc, file);
  const blocks = [];
  const maths = [];
  const terms = [];
  const trees = [];
  const bytesNodes = [];
  const frameNodes = [];
  const iconNames = new Set();
  const iconNodes = [];

  walk(doc, (node) => {
    if (node.tagName === 'vk-code' || node.tagName === 'vk-diff') blocks.push(node);
    if (node.tagName === 'vk-math') maths.push(node);
    if (node.tagName === 'vk-term') terms.push(node);
    if (node.tagName === 'vk-tree') trees.push(node);
    if (node.tagName === 'vk-bytes') bytesNodes.push(node);
    if (node.tagName === 'vk-frames') frameNodes.push(node);
    if (node.tagName === 'vk-icon') iconNodes.push(node);
  });

  const edits = [];
  const deps = [];
  for (const node of blocks) {
    const tag = node.tagName;
    const loc = locOf(node);
    const line = lineOf(node);
    const src = attr(node, 'src');
    const rawLang = attr(node, 'lang');

    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <${tag}> 缺少结束标签，无法预编译。`);
    }

    const { text, hasElement } = collectText(node);
    let source;
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      const raw = fs.readFileSync(abs, 'utf8');
      source = dedent(attr(node, 'lines') ? sliceLines(raw, attr(node, 'lines')) : raw);
      deps.push(abs);
    } else {
      if (hasElement) {
        throw new Error(
          `${file}:${line} <${tag}> 里有被浏览器解析掉的元素。源码里的 "<" 必须写成 "&lt;"，` +
            `或者把代码放进单独的文件：<${tag} src="…">。`
        );
      }
      source = dedent(text);
    }

    const lang = resolveLang(rawLang || inferLang(src) || 'text');
    const hash = hash32(source);
    const total = source.split('\n').length;
    for (const name of ['highlight', 'focus', 'fold']) {
      for (const part of (attr(node, name) || '').split(',')) {
        const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) continue;
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2] || m[1], 10);
        if (a > total || b > total) {
          errors.push(`${file}:${line} <${tag}> 的 ${name}="${part.trim()}" 超出 ${total} 行`);
        }
      }
    }
    let data;
    let attrName;

    if (tag === 'vk-diff') {
      const rows = buildRows(parseDiffItems(source));
      const cache = new Map();
      const paint = async (s) => {
        if (s === null) return null;
        if (!cache.has(s)) {
          const lines = await paintCode(highlighter, s, lang);
          cache.set(s, lines[0] || ' ');
        }
        return cache.get(s);
      };
      data = [];
      for (const r of rows) {
        const l = r.left ? await paint(r.left.text) : null;
        const rr = r.right ? await paint(r.right.text) : null;
        let dl = null;
        let dr = null;
        // 上下文行两边相同，不需要词级区间；只有成对的增删行才算
        if (!r.ctx && r.left && r.right) [dl, dr] = tokenDiff(r.left.text, r.right.text);
        data.push({ l, r: rr, dl, dr });
      }
      attrName = 'data-vk-hl-diff';
    } else {
      data = await paintCode(highlighter, source, lang);
      attrName = 'data-vk-hl';
    }

    const script =
      lang === 'text'
        ? ''
        : `\n<script type="text/plain" ${attrName} data-vk-hash="${hash}" data-vk-lang="${lang}">${JSON.stringify(data)}</script>`;
    // 有 src 时，源码来自真实文件：HTML 里只放引用 + 机器数据，不重复手敲源码。
    const inner = src ? `\n${srcScript(source)}${script}\n` : `\n${escText(source)}${script}\n`;

    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner });
  }

  // 终端：src 指向真实 transcript 文件；没有 src 时保持内联。
  for (const node of terms) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-term> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    if (!src) continue;
    const abs = path.resolve(path.dirname(file), src);
    if (!fs.existsSync(abs)) {
      throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
    }
    const raw = fs.readFileSync(abs, 'utf8');
    const source = dedent(attr(node, 'lines') ? sliceLines(raw, attr(node, 'lines')) : raw);
    deps.push(abs);
    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner: `\n${srcScript(source)}\n` });
  }

  // 树：src 指向真实目录或 JSON。目录扫出条目；JSON 原样作为结构数据。
  for (const node of trees) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-tree> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    if (!src) continue;
    const abs = path.resolve(path.dirname(file), src);
    if (!fs.existsSync(abs)) {
      throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
    }
    deps.push(abs);
    let payload;
    if (/\.json$/i.test(src)) {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch (e) {
        throw new Error(`${file}:${line} <vk-tree> 的 ${src} 不是合法 JSON：${e.message}`);
      }
      payload = { json: data, source: src.replace(/\\/g, '/') };
    } else {
      const depth = parseInt(attr(node, 'depth') || '4', 10);
      payload = treeOf(abs, src.replace(/\\/g, '/'), Number.isFinite(depth) ? Math.max(0, depth) : 4, hasAttr(node, 'hidden'));
      const current = attr(node, 'active') || attr(node, 'current');
      if (current && !payload.entries.some((e) => e.path === current || e.name === current)) {
        errors.push(`${file}:${line} <vk-tree> 的 active="${current}" 不在目录里`);
      }
      for (const e of payload.entries) if (e.type === 'file') deps.push(path.join(abs, e.path));
    }
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-tree>${json}</script>\n`,
    });
  }

  // 字节：src 指向真实二进制，构建期切行；运行时只摆格子。
  for (const node of bytesNodes) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-bytes> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    if (!src) continue;
    const abs = path.resolve(path.dirname(file), src);
    if (!fs.existsSync(abs)) {
      throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
    }
    deps.push(abs);
    const buf = fs.readFileSync(abs);
    const start = Math.max(0, parseInt(attr(node, 'offset') || '0', 10) || 0);
    const want = Math.max(1, parseInt(attr(node, 'length') || '64', 10) || 64);
    const end = Math.min(buf.length, start + want);
    const addrText = attr(node, 'addr') || '0x0000';
    const base = /^0x[0-9a-f]+$/i.test(addrText) ? parseInt(addrText, 16) : parseInt(addrText, 10) || 0;
    const hl = new Set();
    for (const part of (attr(node, 'highlight') || '').split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2] || m[1], 10);
      for (let i = a; i <= b; i++) hl.add(start + i - 1);
    }
    const bytes = [...buf.subarray(start, end)];
    const payload = {
      file: path.basename(abs),
      start,
      end: end > start ? end - 1 : start,
      base,
      bytes: bytes.map((b) => b.toString(16).padStart(2, '0')),
      hl: bytes.map((_, i) => hl.has(start + i)),
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-bytes>${json}</script>\n`,
    });
  }

  // 栈帧：src 指向真实 JSON；只摆数据，不猜结构。
  for (const node of frameNodes) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-frames> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    if (!src) continue;
    const abs = path.resolve(path.dirname(file), src);
    if (!fs.existsSync(abs)) {
      throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (e) {
      throw new Error(`${file}:${line} <vk-frames> 的 ${src} 不是合法 JSON：${e.message}`);
    }
    deps.push(abs);
    const payload = Array.isArray(data) ? { frames: data } : data;
    if (!payload || !Array.isArray(payload.frames)) {
      errors.push(`${file}:${line} <vk-frames> 的 ${src} 需要 { frames: [...] }`);
      continue;
    }
    if (payload.frames.some((f) => !f || typeof f !== 'object' || !Array.isArray(f.slots))) {
      errors.push(`${file}:${line} <vk-frames> 的每一帧都需要 slots 数组`);
    }
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-frames>${json}</script>\n`,
    });
  }

  // 公式：构建期 KaTeX 渲染，运行时只做一次 hash 校验
  for (const node of maths) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-math> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    let tex;
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      tex = dedent(fs.readFileSync(abs, 'utf8')).trim();
      deps.push(abs);
    } else {
      const { text, hasElement } = collectText(node);
      if (hasElement) {
        throw new Error(`${file}:${line} <vk-math> 里有被浏览器解析掉的元素。TeX 里的 "<" 要写成 "&lt;"。`);
      }
      tex = dedent(text).trim();
    }
    const display = (node.attrs || []).some((a) => a.name === 'display');
    let rendered = '';
    try {
      rendered = katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false, output: 'htmlAndMathml' });
    } catch (e) {
      throw new Error(`${file}:${line} KaTeX 渲染失败：${e.message}`);
    }
    const hash = hash32(tex);
    const body = `<script type="text/vk-math" data-vk-math="${hash}" data-vk-tex="${esc(tex)}">${rendered}</script>`;
    const inner = src ? `\n${srcScript(tex)}${body}\n` : `\n${escText(tex)}${body}\n`;
    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner });
  }

  // 图标：构建期把静态 <vk-icon> 内联成 SVG；运行时看到标记直接复用，不闪。
  for (const node of iconNodes) {
    const loc = locOf(node);
    if (!loc.startTag || !loc.endTag) continue;
    const name = attr(node, 'name') || 'circle-help';
    const label = attr(node, 'label') || '';
    if (ICONS[name]) iconNames.add(name);
    const body = ICONS[name] || ICONS['circle-help'];
    const aria = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
    const inner = `<span class="vk-icon" data-vk-inline data-vk-name="${esc(name)}"${aria}><svg viewBox="0 0 24 24">${body}</svg></span>`;
    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner });
  }

  if (errors.length) {
    throw new Error(`vk 属性校验失败：\n${errors.slice(0, 20).join('\n')}${errors.length > 20 ? `\n…还有 ${errors.length - 20} 条` : ''}`);
  }
  edits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of edits) out = out.slice(0, e.start) + e.inner + out.slice(e.end);
  return { html: applyIcons(out, iconNames), count: edits.length, deps, icons: [...iconNames] };
}
