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
import { parseAsm, splitInsn } from './shared/asm.mjs';
import { tokenDiff } from './runtime/code-utils.mjs';
import { dedent, expandLeadingTabs, hash32, indexRanges, isIndexList, lineSet, sliceLines, parseDiffItems, buildRows, LANG_ALIAS, EXT_LANG, SUPPORTED_LANGS, inferLang as inferLangShared } from './shared/code.mjs';
import { ICONS } from './icons.generated.mjs';
import { diag } from './shared/diag.mjs';
import { TAGS, CHILD_ATTRS, CHILDREN, STATES, STATE_VALUES } from './registry.mjs';

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
  'id', 'class', 'className', 'title', 'role', 'tabindex', 'slot', 'part',
  'x', 'y', 'lang', 'dir', 'hidden', 'aria-hidden', 'aria-label', 'aria-labelledby', 'bleed',
]);

/** 严格模式：像素摆位与后门直接报错。默认开——新帧只能用意图表达布局。 */
let STRICT = true;
export function setStrict(v) {
  STRICT = !!v;
}

/** 具名窗体的组件：它们自己带窗头，嵌进 vk-window 时必须 chrome="none"。 */
const WINDOWED = new Set(['vk-code', 'vk-term', 'vk-diff', 'vk-figure', 'vk-tree', 'vk-bytes', 'vk-window']);
/** 每个组件支持的内部锚点（与运行时 resolveTarget 同一份约定）。 */
const ANCHORS = {
  'vk-code': ['line', 'char'],
  'vk-diff': ['line', 'char'],
  'vk-asm': ['line', 'addr'],
  'vk-cells': ['cell', 'byte'],
  'vk-bytes': ['byte'],
  'vk-bits': ['bit', 'field'],
  'vk-table': ['row', 'cell'],
  'vk-tree': ['node'],
  'vk-steps': ['step'],
  'vk-list': ['item'],
  'vk-timeline': ['event', 'lane'],
};

/** 子节点 <i> 的合法属性由 registry 的 CHILD_ATTRS 统一声明。 */
const INDEX_PART = new Set(['cell', 'byte', 'bit', 'event', 'row', 'step', 'item']);
/** 允许自由坐标的三个覆盖层；其余标签的 x/y 只允许出现在 vk-canvas 里。 */
const XY_OVERLAY = new Set(['vk-pin', 'vk-ring', 'vk-spotlight']);
const Z_OK = new Set([...XY_OVERLAY, 'vk-edge']);

const countTag = (node, tag) => {
  let n = 0;
  if (node.childNodes) for (const c of node.childNodes) n += countTag(c, tag);
  if (node.content) n += countTag(node.content, tag);
  if (node.tagName === tag) n += 1;
  return n;
};

const ancestors = (node) => {
  const out = [];
  for (let p = node.parentNode; p; p = p.parentNode) out.push(p);
  return out;
};

/** 标本页用 <template> 惰性装镜头：同一段场景会重复多次，页内 id 允许重复。 */
const walkTpl = (node, fn, inTpl = false) => {
  fn(node, inTpl);
  if (node.childNodes) for (const c of node.childNodes) walkTpl(c, fn, inTpl);
  if (node.content) walkTpl(node.content, fn, true);
};

function lineRange(node) {
  const m = String(attr(node, 'lines') || '').match(/^\s*(\d+)\s*(?:-\s*(\d+))?/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  return [a, m[2] ? parseInt(m[2], 10) : a];
}

/** 这个宿主能容纳的锚点范围；null = 静态算不出，跳过。 */
function anchorCapacity(node, file) {
  const tag = node.tagName;
  if (tag === 'vk-code' || tag === 'vk-diff') {
    const r = lineRange(node);
    if (r) return { from: r[0], to: r[1] };
    // 没写 lines：范围就是源码本身的行数（src 文件或内联块）。
    const inline = inlineSourceText(node);
    if (inline != null) {
      const n = inline.split('\n').length;
      return n ? { from: 1, to: n } : null;
    }
    const src = attr(node, 'src');
    if (src) {
      try {
        const raw = fs.readFileSync(path.resolve(path.dirname(file), src), 'utf8');
        const n = raw.split('\n').length;
        return n ? { from: 1, to: n } : null;
      } catch {
        return null;
      }
    }
    return null;
  }
  if (tag === 'vk-cells') {
    // 一格一个 <i>：格数 = 子节点数，字节数 = 各格 span 之和。
    const items = (node.childNodes || []).filter((n) => n.tagName === 'li' || n.tagName === 'i');
    const n = items.length;
    const spans = items
      .map((el) => parseInt((el.attrs || []).find((a) => a.name === 'span')?.value || '1', 10))
      .map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
    const total = spans.reduce((a, b) => a + b, 0);
    // @cell 指字段；@byte 指字节，只有开了字节尺（offsets / ruler / direction=rtl）才存在。
    const byteMode = node.attrs?.some(
      (x) => x.name === 'offsets' || x.name === 'ruler' || (x.name === 'direction' && x.value === 'rtl')
    );
    const cellCap = Math.max(n, spans.length) - 1;
    const max = byteMode ? Math.max(cellCap, total - 1) : cellCap;
    return max >= 0 ? { from: 0, to: max } : null;
  }
  if (tag === 'vk-bytes') {
    const n = parseInt(attr(node, 'length') || '', 10);
    return Number.isFinite(n) && n > 0 ? { from: 0, to: n - 1 } : null;
  }
  if (tag === 'vk-table') {
    const n = countTag(node, 'tr');
    return n ? { from: 0, to: n - 1 } : null;
  }
  if (tag === 'vk-steps' || tag === 'vk-list') {
    const n = countTag(node, 'li');
    return n ? { from: 0, to: n - 1 } : null;
  }
  if (tag === 'vk-timeline') {
    const n = countTag(node, 'li') || countTag(node, 'i');
    return n ? { from: 0, to: n - 1 } : null;
  }
  if (tag === 'vk-bits') {
    const n = String(attr(node, 'value') || '').replace(/[^01]/g, '').length;
    return n ? { from: 0, to: n - 1 } : null;
  }
  if (tag === 'vk-asm') {
    const r = lineRange(node);
    return r ? { from: r[0], to: r[1] } : null;
  }
  return null;
}

/**
 * 引用关系校验：AI 写错锚点最典型的症状是"页面看起来没事，注解没了"。
 * 静态能判的一律在这里拦下 —— 运行时 warn 进 console，AI 看不到。
 */
function validateRefs(doc, file, errors) {
  const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
  const ids = new Map();
  const classes = new Set();
  walkTpl(doc, (node, inTpl) => {
    if (inTpl || !node.tagName) return;
    for (const c of String(attr(node, 'class') || '').split(/\s+/).filter(Boolean)) classes.add(c);
    const id = attr(node, 'id');
    if (!id) return;
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(node);
  });
  for (const [id, list] of ids) {
    if (list.length > 1) errors.push(`${file}: 页面里有 ${list.length} 个 id="${id}"，for/from/to 会指错`);
  }
  const idNames = [...ids.keys()];

  walkTpl(doc, (node, inTpl) => {
    const tag = node.tagName;
    if (!tag || inTpl) return;

    // 1) 未知的 vk- 标签：以前被静默忽略。
    if (tag.startsWith('vk-') && !TAGS[tag]) {
      errors.push(`${file}:${lineOf(node)} 未知标签 <${tag}>；可用：${Object.keys(TAGS).join(', ')}`);
      return;
    }

    // 2) for / from / to 的 `#id@part:arg` 形式（裸 CSS 选择器静态判不了，留给运行时）
    for (const name of ['for', 'from', 'to']) {
      const raw = attr(node, name);
      if (!raw) continue;
      const refs =
        name === 'for'
          ? String(raw)
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
          : [String(raw).trim()];
      for (const v of refs) {
        const m = v.match(/^#([^@\s]+?)(?:@([a-z]+)(?::(.+))?)?$/);
        if (!m) {
        const where = `${file}:${lineOf(node)} <${tag}> 的 ${name}="${v}"`;
        if (/^#[A-Za-z][\w-]*$/.test(v) && !ids.has(v.slice(1))) {
          errors.push(`${where}：找不到 ${v}${idNames.length ? `（可用：${idNames.slice(0, 8).join(', ')}）` : '（页面里没有任何 id）'}`);
        } else if (/^\.[A-Za-z][\w-]*$/.test(v) && !classes.has(v.slice(1))) {
          errors.push(`${where}：页面里没有 ${v} 这个 class`);
        }
        continue;
      }
      const [, id, part, argRaw] = m;
      const where = `${file}:${lineOf(node)} <${tag}> 的 ${name}="${v}"`;
      if (!ids.has(id)) {
        errors.push(`${where}：找不到 #${id}${idNames.length ? `（可用：${idNames.slice(0, 8).join(', ')}）` : '（页面里没有任何 id）'}`);
        continue;
      }
      if (!part) continue;
      const host = ids.get(id)[0];
      // 几何锚点：任何有盒子的标签都能被点到 / 圈到 / 连到，不查 ANCHORS。
      if (part === 'point' || part === 'side' || part === 'region') {
        if (part === 'side') {
          if (!['top', 'right', 'bottom', 'left'].includes(String(argRaw || '').trim())) {
            errors.push(`${where}：@side 只能是 top / right / bottom / left`);
          }
        } else {
          const want = part === 'point' ? 2 : 4;
          const nums = String(argRaw || '').split(',').map((s) => parseFloat(s));
          if (nums.length !== want || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
            errors.push(`${where}：@${part} 需要 ${want} 个 0–100 的百分比（写 ${want} 个逗号分隔的数字，可带 %）`);
          }
        }
        continue;
      }
      const allowed = ANCHORS[host.tagName] || [];
      if (!allowed.includes(part)) {
        errors.push(`${where}：#${id} 是 <${host.tagName}>，不支持 @${part}${allowed.length ? `；支持 ${allowed.join(' / ')}` : '；没有内部锚点'}`);
        continue;
      }
      if (part === 'byte' && host.tagName === 'vk-cells' && !host.attrs?.some(
        (x) => x.name === 'offsets' || x.name === 'ruler' || (x.name === 'direction' && x.value === 'rtl')
      )) {
        errors.push(`${where}：#${id} 没有字节尺，@byte 不存在；先写 offsets / ruler / direction="rtl"`);
        continue;
      }
      const cap = anchorCapacity(host, file);
      if (!cap) continue;
      if (part === 'line' || part === 'char') {
        const n = parseInt((argRaw || '').split(':')[0], 10);
        if (!Number.isFinite(n) || n < cap.from || n > cap.to) {
          errors.push(`${where}：#${id} 的行范围是 ${cap.from}–${cap.to}，${argRaw || ''} 越界`);
          continue;
        }
        if (part === 'char') {
          const range = (argRaw || '').split(':')[1] || '';
          const mm = range.match(/^(\d+)-(\d+)$/);
          if (!mm || Number(mm[1]) >= Number(mm[2])) errors.push(`${where}：字符区间应为 起-止，且起 < 止`);
        }
      } else if (INDEX_PART.has(part)) {
        const n = parseInt(argRaw, 10);
        // @lane:主线程 是名字锚点，不是下标；数值型才校验范围。
        if (!Number.isFinite(n) && part === 'lane') continue;
        if (!Number.isFinite(n) || n < cap.from || n > cap.to) {
          errors.push(`${where}：${part} 的可选范围是 ${cap.from}–${cap.to}，${argRaw} 越界（下标从 0 起）`);
        }
      }
      }
    }

    // 4) vk-code 的 omit="行:起-止"（属性叫 omit，span 归布局用）
    if (tag === 'vk-code') {
      for (const part of String(attr(node, 'omit') || '').split(',')) {
        const s = part.trim();
        if (!s) continue;
        const mm = s.match(/^(\d+):(\d+)-(\d+)$/);
        if (!mm || Number(mm[2]) >= Number(mm[3])) {
          errors.push(`${file}:${lineOf(node)} <vk-code> 的 omit="${s}" 不是 行:起-止，且起 < 止`);
        }
      }
    }

    // 5) vk-bars 的行必须是 <li value label>
    if (tag === 'vk-bars') {
      for (const child of node.childNodes || []) {
        if (!child.tagName) continue;
        if (child.tagName !== 'li' && child.tagName !== 'i') {
          errors.push(`${file}:${lineOf(child)} <vk-bars> 的条目只收 <li value="…" label="…">，现在收到 <${child.tagName}>`);
          continue;
        }
        if (!attr(child, 'label')) errors.push(`${file}:${lineOf(child)} <vk-bars> 的 <${child.tagName}> 缺 label`);
        const v = attr(child, 'value');
        if (v == null || !Number.isFinite(Number(v))) errors.push(`${file}:${lineOf(child)} <vk-bars> 的 <${child.tagName}> 缺数字 value`);
      }
    }

    // 6) 窗头嵌套：一个窗里再放一个带窗头的组件，会画出两条标题栏
    if (tag === 'vk-window') {
      walk(node, (inner) => {
        if (inner === node || !inner.tagName || !WINDOWED.has(inner.tagName)) return;
        if (attr(inner, 'chrome') !== 'none') {
          errors.push(`${file}:${lineOf(inner)} <${inner.tagName}> 在 <vk-window> 里没写 chrome="none"，会出现两条窗头`);
        }
      });
    }
  });
}

/** 构建期校验：作者页面的枚举/范围/布尔/图标名必须在 registry 内，不能静默。 */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** 拼错时给最接近的合法值；差太远就不猜，免得误导。 */
function closestOf(word, list) {
  let best = null;
  let bestD = Infinity;
  for (const w of list) {
    const d = editDistance(String(word).toLowerCase(), String(w).toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return bestD <= Math.max(2, Math.floor(String(word).length / 2)) ? best : null;
}

function validateAuthorHtml(doc, file) {
  const errors = [];
  const warnings = [];
  /** 新规矩：严格模式下是错误，默认只提醒——旧页要慢慢迁（清单见 docs/layout-plan.md）。 */
  const strictness = (msg) => (STRICT ? errors : warnings).push(msg);
  const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
  walk(doc, (node) => {
    const tag = node.tagName;
    if ((tag === 'i' || tag === 'li') && node.parentNode) {
      const parent = node.parentNode.tagName;
      const allowed = CHILD_ATTRS[parent];
      if (allowed) {
        if (tag === 'i' && CHILDREN[parent]?.item === 'li') {
          (STRICT ? errors : warnings).push(
            `${file}:${lineOf(node)} <${parent}> 的条目还是 <i>；v12 统一成 <li>（改标签名即可）`
          );
        }
        for (const { name, value: raw } of node.attrs || []) {
          if (name.startsWith('data-') || name.startsWith('aria-') || GLOBAL_ATTRS.has(name)) continue;
          if (name === 'bad') {
            (STRICT ? errors : warnings).push(`${file}:${lineOf(node)} <${parent}> 的 bad 已改名为 state="err"`);
            continue;
          }
          if (name === 'mark') {
            (STRICT ? errors : warnings).push(`${file}:${lineOf(node)} <${parent}> 的 mark 已改名为 state="mark"`);
            continue;
          }
          if (name === 'state') {
            if (!STATE_VALUES.includes(raw)) {
              errors.push(`${file}:${lineOf(node)} <${parent}> 的 state="${raw}" 不在词表里；可用：${STATE_VALUES.join(' / ')}`);
            }
            continue;
          }
          if (!allowed.includes(name)) {
            errors.push(
              `${file}:${lineOf(node)} <${parent}> 的子节点不认识 ${name}="${raw}"；可用：${allowed.join(', ')}`
            );
          }
        }
      }
      return;
    }
    if (!tag || !tag.startsWith('vk-') || !TAGS[tag]) return;
    const def = TAGS[tag];
    const attrs = new Map((node.attrs || []).map((a) => [a.name, a.value]));

    // 子节点契约：条目只能 <li>；table 必须包 <table>；源码件只能 src / 内联块。
    const model = CHILDREN[tag];
    if (model) {
      const elementChildren = (node.childNodes || []).filter((c) => c.tagName);
      if (model.kind === 'wrapper') {
        const hasWrapper = elementChildren.some((c) => c.tagName === model.wrapper);
        if (!hasWrapper && (node.childNodes || []).some((c) => c.nodeType === 3 && c.value.trim())) {
          errors.push(
            diag({
              file,
              line: lineOf(node),
              tag,
              what: '的内容没有包在 <table> 里',
              wrote: (node.childNodes || []).find((c) => c.nodeType === 3 && c.value.trim())?.value.trim().slice(0, 40),
              should: '写成 <vk-table><table><thead>…</thead><tbody>…</tbody></table></vk-table>',
              why: '裸 <tr>/<td> 会被浏览器丢掉，整张表会静默变成一段连着的字',
            })
          );
        }
      } else if (model.kind === 'item') {
        const badKids = elementChildren.filter((c) => c.tagName !== model.item && c.tagName !== 'i');
        if (badKids.length) {
          errors.push(
            `${file}:${lineOf(node)} <${tag}> 的条目只能是 <${model.item}>；发现 <${badKids.map((c) => c.tagName).join('>, <')}>`
          );
        }
      } else if (model.kind === 'source') {
        const hasSrc = attrs.has('src');
        const hasInline = elementChildren.some((c) => c.tagName === 'script' && (c.attrs || []).some((a) => a.name === 'data-vk-source'));
        if (hasSrc && hasInline) {
          errors.push(`${file}:${lineOf(node)} <${tag}> 同时写了 src 与内联源码；只能有一个入口`);
        }
      }
    }
    if (tag === 'vk-table') {
      walk(node, (n) => {
        if (!['tr', 'td', 'th'].includes(n.tagName)) return;
        const rowAttrs = n.attrs || [];
        if (rowAttrs.some((a) => a.name === 'data-em')) {
          (STRICT ? errors : warnings).push(
            `${file}:${lineOf(n)} <table> 的行标记 data-em 已改名为 state="mark"（列/格同）`
          );
        }
        const st = rowAttrs.find((a) => a.name === 'state');
        if (st && !STATE_VALUES.includes(st.value)) {
          errors.push(
            `${file}:${lineOf(n)} <${n.tagName}> 的 state="${st.value}" 不在词表里；可用：${STATE_VALUES.join(' / ')}`
          );
        }
      });
    }

    // x/y 只在坐标空间里成立：canvas 的子节点，或本身是覆盖层的三种关系件。
    if ((attrs.has('x') || attrs.has('y')) && !XY_OVERLAY.has(tag) && node.parentNode?.tagName !== 'vk-canvas') {
      errors.push(
        diag({
          file,
          line: lineOf(node),
          tag,
          what: '的 x/y 只有坐标空间认',
          wrote: [...attrs].filter(([n]) => n === 'x' || n === 'y').map(([n, v]) => `${n}="${v}"`).join(' '),
          should: '放进 <vk-canvas>，或用 <vk-stack> / <vk-row> / <vk-grid> 配 gap 排版',
          why: 'x/y 是绝对坐标：改一个字就要重算像素，布局也就不可求解了',
        })
      );
    }
    // w/h 是像素摆位，同样只在坐标空间里成立。
    if ((attrs.has('w') || attrs.has('h')) && tag !== 'vk-canvas' && node.parentNode?.tagName !== 'vk-canvas') {
      strictness(
        diag({
          file,
          line: lineOf(node),
          tag,
          what: '的 w/h 是像素摆位',
          wrote: [...attrs].filter(([n]) => n === 'w' || n === 'h').map(([n, v]) => `${n}="${v}"`).join(' '),
          should: '要分栏用 <vk-grid cols="3"> 配子项 span="2"；要撑满用 fill',
          why: '像素值进不了容量检查，也进不了求解器——它只是把"摆不下"推迟到肉眼发现',
        })
      );
    }
    // z 只在坐标空间成立：canvas 的子节点，或覆盖层/连线。
    if (attrs.has('z') && !Z_OK.has(tag) && node.parentNode?.tagName !== 'vk-canvas') {
      errors.push(
        diag({
          file,
          line: lineOf(node),
          tag,
          what: '的 z 只有在坐标空间里成立',
          wrote: `z="${attrs.get('z')}"`,
          should: '放进 <vk-canvas>，或改用覆盖层 / 连线',
          why: 'z 只在画布内比较；页面上随意叠层会盖住标注',
        })
      );
    }
    // bleed 只写在 vk-page 的直接子节点上；它铺满整帧、排在内容层后面。
    if (attrs.has('bleed') && node.parentNode?.tagName !== 'vk-page') {
      errors.push(
        diag({
          file,
          line: lineOf(node),
          tag,
          what: '的 bleed 只属于 page 的直接子节点',
          wrote: `bleed`,
          should: '把 <vk-img bleed> / <vk-box bleed> 放进 <vk-page>',
          why: 'bleed 是"这一层不守安全区"的布局意图，放在别的容器里没有语义',
        })
      );
    }
    // pin 只钉一个点；分号是给 ring / spotlight 的多目标语法。
    if (tag === 'vk-pin' && (attrs.get('for') || '').includes(';')) {
      errors.push(
        diag({
          file,
          line: lineOf(node),
          tag,
          what: '的 for 只能有一个目标',
          wrote: `for="${attrs.get('for')}"`,
          should: '拆成多个 <vk-pin>，或改用 <vk-ring> / <vk-spotlight>',
          why: '气泡只有一条引线；多目标会让气泡位置失去意义',
        })
      );
    }
    // span / row-span 只在分份容器里有意义：父级必须是 vk-grid。
    // 浏览器会忽略错误位置的 grid-column / grid-row，所以这条必须在构建期拦住。
    for (const name of ['span', 'row-span']) {
      if (!attrs.has(name)) continue;
      if (node.parentNode?.tagName !== 'vk-grid') {
        const axis = name === 'span' ? '列' : '行';
        errors.push(
          diag({
            file,
            line: lineOf(node),
            tag,
            what: `的 ${name} 放错了地方`,
            wrote: `${name}="${attrs.get(name)}"`,
            should: `让父级是 <vk-grid>（跨${axis}的份数由父级声明），或删掉 ${name}（当前父级是 <${node.parentNode?.tagName || '无'}>）`,
            why: 'span 的意思是"占几份"，份数必须由父级声明；放错位置时浏览器会静默忽略',
          })
        );
        continue;
      }
      const capAttr = name === 'span' ? 'cols' : 'rows';
      const capRaw = attr(node.parentNode, capAttr);
      // 没有 rows 时是自动行高，row-span 交给浏览器；cols 的默认是 2。
      if (name === 'row-span' && capRaw == null) continue;
      const cap = Number(capRaw ?? '2');
      const got = Number(attrs.get(name));
      if (Number.isFinite(got) && Number.isFinite(cap) && got > cap) {
        errors.push(`${file}:${lineOf(node)} <${tag}> 的 ${name}="${got}" 超过父级 ${capAttr}="${cap}"；浏览器会多出一列并挤坏兄弟项`);
      }
    }
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
      const where = { file, line: lineOf(node), tag };
      if (!spec) {
        const usable = Object.keys(def.attrs || {});
        const hit = closestOf(name, usable);
        errors.push(
          diag({
            ...where,
            what: `未知属性 ${name}`,
            wrote: `${name}="${raw}"`,
            should: hit ? `你是想写 ${hit}？可用：${usable.join(', ')}` : `可用：${usable.join(', ') || '无'}`,
            why: '未知属性不会静默失效就算了——它会在运行时变成没效果的空写',
          })
        );
        continue;
      }
      if (spec.type === 'bool') {
        if (raw !== '' && raw !== 'true')
          errors.push(
            diag({
              ...where,
              what: `的 ${name} 是布尔属性`,
              wrote: `${name}="${raw}"`,
              should: `只写 ${name}`,
              why: '给了值也只会被当成真：看着像能关掉，实际关不掉',
            })
          );
        continue;
      }
      if (spec.values && !spec.values.includes(raw)) {
        const hit = closestOf(raw, spec.values);
        errors.push(
          diag({
            ...where,
            what: `的 ${name} 不在词表里`,
            wrote: `${name}="${raw}"`,
            should: `${spec.values.join(' / ')}${hit ? `（你是想写 ${hit}？）` : ''}`,
            why: '词表是闭集：只允许"选"，不允许"调"',
          })
        );
        continue;
      }
      if (spec.type === 'num' || spec.type === 'int') {
        const n = Number(raw);
        const range = `${spec.min ?? '−∞'}…${spec.max ?? '∞'}`;
        if (!Number.isFinite(n)) {
          errors.push(
            diag({ ...where, what: `的 ${name} 不是数字`, wrote: `${name}="${raw}"`, should: '一个数字', why: 'NaN 会一路传进布局，比在入口报错难查得多' })
          );
        } else if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          errors.push(
            diag({ ...where, what: `的 ${name} 超出范围`, wrote: `${name}="${raw}"`, should: range, why: '越界值会被悄悄裁到边界，画面和你想的不一样' })
          );
        }
      }
      if (spec.type === 'size') {
        const special = raw === 'fit' || raw === 'full';
        if (!special) {
          const n = Number(raw);
          const range = `${spec.min ?? '−∞'}…${spec.max ?? '∞'}`;
          if (!Number.isFinite(n)) {
            errors.push(
              diag({ ...where, what: `的 ${name} 既不是数字也不是关键字`, wrote: `${name}="${raw}"`, should: `一个数字，或 fit / full`, why: '尺寸只有两种写法：像素档或撑满' })
            );
          } else if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
            errors.push(
              diag({ ...where, what: `的 ${name} 超出范围`, wrote: `${name}="${raw}"`, should: range, why: '越界值会被悄悄裁到边界，画面和你想的不一样' })
            );
          }
        }
      }
      if (spec.type === 'lines') {
        const bad =
          !isIndexList(raw) || indexRanges(raw).some(({ from, to }) => from < 1 || to < from);
        if (bad)
          errors.push(
            diag({ ...where, what: `的 ${name} 不是行段`, wrote: `${name}="${raw}"`, should: '1、1-8、1,3-5 这类写法', why: '行段从 1 起；写错的行段会让整个高亮错位' })
          );
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
    if (tag === 'vk-icon') {
      const name = attrs.get('name');
      if (name && !ICONS[name]) {
        const near = Object.keys(ICONS).filter((n) => n.includes(name) || name.includes(n)).slice(0, 3);
        errors.push(`${file}:${lineOf(node)} <vk-icon> 没有图标 "${name}"${near.length ? `；近似：${near.join(' / ')}` : ''}`);
      }
    }
    if (tag === 'vk-steps' && attrs.has('current')) {
      const items = (node.childNodes || []).filter((c) => c.tagName === 'li').length;
      const n = Number(attrs.get('current'));
      if (items > 0 && Number.isFinite(n) && n >= items) {
        errors.push(`${file}:${lineOf(node)} <vk-steps> 的 current="${n}" 超出 0–${items - 1}（共 ${items} 步）`);
      }
    }
    if (tag === 'vk-timeline' && attrs.has('lanes')) {
      const declared = String(attrs.get('lanes') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const child of node.childNodes || []) {
        if (child.tagName !== 'li') continue;
        const lane = ((child.attrs || []).find((a) => a.name === 'lane')?.value || '').trim();
        if (!lane) {
          errors.push(`${file}:${lineOf(child)} <vk-timeline> 的条目缺 lane；lanes 声明了 ${declared.join(' / ')}`);
        } else if (!declared.includes(lane)) {
          errors.push(`${file}:${lineOf(child)} <vk-timeline> 的 lane="${lane}" 不在 lanes 里（${declared.join(' / ')}）`);
        }
      }
    }
  });
  validateRefs(doc, file, errors);
  validateImages(doc, file, errors);
  return { errors, warnings };
}

/** 本地图片不存在时构建期就报错；远程 / data: / 绝对路径交给运行时占位。 */
function validateImages(doc, file, errors) {
  const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
  walk(doc, (node) => {
    const tag = node.tagName;
    if (tag !== 'vk-img' && tag !== 'vk-figure') return;
    const src = attr(node, 'src');
    if (!src) return;
    if (/^(?:[a-z]+:|\/|#)/i.test(src) || src.startsWith('//')) return;
    const clean = src.split(/[?#]/)[0];
    const abs = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(abs)) {
      errors.push(`${file}:${lineOf(node)} <${tag}> 找不到图片 ${src}`);
    }
  });
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
          hasAttr(n, 'data-vk-source') ||
          hasAttr(n, 'data-vk-asm') ||
          hasAttr(n, 'data-vk-tree') ||
          hasAttr(n, 'data-vk-bytes'))
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

/**
 * 内联源码块：<script type="text/plain" data-vk-source>…</script>
 *
 * 浏览器不会解析 script 里的 "<"，所以 C 代码、模板、HTML 都能直接放进来。
 * 构建期把它变成和高亮数据一起的机器数据；运行时不认识这个块。
 */
const inlineSourceNode = (node) =>
  (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));

const inlineSourceText = (node) => {
  const s = inlineSourceNode(node);
  if (!s) return null;
  return dedent((s.childNodes || []).map((n) => n.value || '').join(''));
};

function sourceConflict(node, tag, file, line) {
  if (attr(node, 'src') && inlineSourceNode(node)) {
    throw new Error(`${file}:${line} <${tag}> 同时写了 src 与 data-vk-source；源码只能有一个入口。`);
  }
}

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
  const { errors, warnings } = validateAuthorHtml(doc, file);
  if (errors.length) {
    throw new Error(
      `vk 校验失败（${errors.length} 条）：\n${errors.slice(0, 30).join('\n')}${errors.length > 30 ? `\n…还有 ${errors.length - 30} 条` : ''}`
    );
  }
  if (warnings.length) {
    console.warn(`[vk] ${file}：${warnings.length} 处旧写法（首处 ${warnings[0].split(': ').pop().slice(0, 90)}）`);
  }
  const blocks = [];
  const maths = [];
  const inlineMaths = [];
  const terms = [];
  const trees = [];
  const bytesNodes = [];
  const asmNodes = [];
  const iconNames = new Set();
  const iconNodes = [];

  walk(doc, (node) => {
    if (node.tagName === 'vk-code' || node.tagName === 'vk-diff') blocks.push(node);
    if (node.tagName === 'vk-math') maths.push(node);
    if (node.tagName === 'vk-inline' && attr(node, 'variant') === 'math') inlineMaths.push(node);
    if (node.tagName === 'vk-term') terms.push(node);
    if (node.tagName === 'vk-tree') trees.push(node);
    if (node.tagName === 'vk-bytes') bytesNodes.push(node);
    if (node.tagName === 'vk-asm') asmNodes.push(node);
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
    const linesAttr = attr(node, 'lines');

    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <${tag}> 缺少结束标签，无法预编译。`);
    }

    sourceConflict(node, tag, file, line);
    const { text, hasElement } = collectText(node);
    const inline = inlineSourceText(node);
    let source;
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      const raw = fs.readFileSync(abs, 'utf8');
      source = dedent(linesAttr ? sliceLines(raw, linesAttr) : raw);
      deps.push(abs);
    } else if (inline != null) {
      source = dedent(linesAttr ? sliceLines(inline, linesAttr) : inline);
    } else {
      if (hasElement) {
        throw new Error(
          `${file}:${line} <${tag}> 里有被浏览器解析掉的元素。源码里的 "<" 必须写成 "&lt;"，` +
            `或者把代码放进 <script type="text/plain" data-vk-source>，也可以改用 src。`
        );
      }
      source = dedent(linesAttr ? sliceLines(text, linesAttr) : text);
    }

    const lang = resolveLang(rawLang || inferLang(src) || 'text');
    const hash = hash32(source);
    const total = source.split('\n').length;
    // lines="4-6" 时，source 已经是切片；但 current/focus/fold 写的是源文件行号。
    // 越界不能静默：写错的行段只会让"重点"消失，画面看起来仍然正常。
    const base = Number((attr(node, 'lines') || '').match(/^\s*(\d+)/)?.[1]) || 1;
    const hi = base + total - 1;
    for (const name of ['current', 'focus', 'fold']) {
      for (const { from, to } of indexRanges(attr(node, name))) {
        if (from < base || from > hi || to > hi) {
          errors.push(
            `${file}:${line} <${tag}> 的 ${name}="${from}${to === from ? '' : '-' + to}" 超出 ${base}–${hi} 行（源文件行号）；` +
              `片段从 ${base} 起，写成 ${base}${hi > base ? `–${hi}` : ''} 范围内的行号`
          );
        }
      }
    }
    const foldRanges = indexRanges(attr(node, 'fold'));
    for (const name of ['current', 'focus']) {
      for (const { from, to } of indexRanges(attr(node, name))) {
        if (foldRanges.some((f) => from <= f.to && to >= f.from)) {
          errors.push(`${file}:${line} <${tag}> 的 ${name}="${from}${to === from ? '' : '-' + to}" 落在 fold 区间内，折叠后不会显示`);
        }
      }
    }
    const currentSet = lineSet(attr(node, 'current'));
    const focusSet = lineSet(attr(node, 'focus'));
    if (currentSet.size && focusSet.size) {
      const outside = [...currentSet].filter((n) => !focusSet.has(n));
      if (outside.length) {
        errors.push(`${file}:${line} <${tag}> 的 current="${outside.join(',')}" 不在 focus 内；聚光会把当前行一起压暗`);
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

  // 终端：src 指向真实 transcript 文件；也收内联源码块。
  for (const node of terms) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-term> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    const inline = inlineSourceText(node);
    if (!src && inline == null) continue;
    sourceConflict(node, 'vk-term', file, line);
    const linesAttr = attr(node, 'lines');
    let source;
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      const raw = fs.readFileSync(abs, 'utf8');
      source = dedent(linesAttr ? sliceLines(raw, linesAttr) : raw);
      deps.push(abs);
    } else {
      source = dedent(linesAttr ? sliceLines(inline, linesAttr) : inline);
    }
    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner: `\n${srcScript(source)}\n` });
  }

  // 树：src 指向真实目录；内联时收 JSON 条目。
  for (const node of trees) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-tree> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    const inline = inlineSourceText(node);
    if (!src && inline == null) continue;
    sourceConflict(node, 'vk-tree', file, line);
    let payload;
    if (inline != null) {
      let data;
      try {
        data = JSON.parse(inline);
      } catch (e) {
        throw new Error(`${file}:${line} <vk-tree> 的内联 JSON 不合法：${e.message}`);
      }
      payload = Array.isArray(data) ? { root: attr(node, 'title') || '', entries: data, total: data.length } : data;
      if (!payload || !Array.isArray(payload.entries)) {
        errors.push(`${file}:${line} <vk-tree> 的内联 JSON 需要条目数组`);
        continue;
      }
    } else {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      deps.push(abs);
      if (/\.json$/i.test(src)) {
        throw new Error(`${file}:${line} <vk-tree> 只收目录；JSON 树请用内联 data-vk-source。`);
      }
      const depth = parseInt(attr(node, 'depth') || '4', 10);
      payload = treeOf(abs, src.replace(/\\/g, '/'), Number.isFinite(depth) ? Math.max(0, depth) : 4, hasAttr(node, 'hidden'));
      for (const e of payload.entries) if (e.type === 'file') deps.push(path.join(abs, e.path));
    }
    const current = attr(node, 'active') || attr(node, 'current');
    if (current && !payload.entries.some((e) => e.path === current || e.name === current)) {
      errors.push(`${file}:${line} <vk-tree> 的 active="${current}" 不在目录里`);
    }
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-tree>${json}</script>\n`,
    });
  }

  // 字节：src 指向真实二进制；内联时收十六进制文本。
  for (const node of bytesNodes) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-bytes> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    const inline = inlineSourceText(node);
    if (!src && inline == null) continue;
    sourceConflict(node, 'vk-bytes', file, line);
    let buf;
    let fileName = attr(node, 'file') || '';
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      deps.push(abs);
      buf = fs.readFileSync(abs);
      fileName = fileName || path.basename(abs);
    } else {
      const hex = String(inline).replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
      if (hex.length % 2) throw new Error(`${file}:${line} <vk-bytes> 的内联十六进制字节数为奇数`);
      buf = Buffer.from(hex, 'hex');
    }
    const start = Math.max(0, parseInt(attr(node, 'offset') || '0', 10) || 0);
    const want = Math.max(1, parseInt(attr(node, 'length') || '64', 10) || 64);
    const end = Math.min(buf.length, start + want);
    const addrText = attr(node, 'addr') || '0x0000';
    const base = /^0x[0-9a-f]+$/i.test(addrText) ? parseInt(addrText, 16) : parseInt(addrText, 10) || 0;
    const bytes = [...buf.subarray(start, end)];
    for (const { from, to } of indexRanges(attr(node, 'current'))) {
      if (!bytes.length) {
        errors.push(`${file}:${line} <vk-bytes> 的 current="${from}" 无法定位：这段片段没有字节`);
      } else if (from < 0 || from >= bytes.length || to >= bytes.length) {
        errors.push(
          `${file}:${line} <vk-bytes> 的 current="${from}${to === from ? '' : '-' + to}" 超出 0–${bytes.length - 1}（相对片段的字节偏移）`
        );
      }
    }
    const payload = {
      file: fileName,
      start,
      end: end > start ? end - 1 : start,
      base,
      bytes: bytes.map((b) => b.toString(16).padStart(2, '0')),
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-bytes>${json}</script>\n`,
    });
  }

  // 汇编：src 或内联文本；解析地址/机器码后逐行高亮。
  for (const node of asmNodes) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) {
      throw new Error(`${file}:${line} <vk-asm> 缺少结束标签，无法预编译。`);
    }
    const src = attr(node, 'src');
    const inline = inlineSourceText(node);
    if (!src && inline == null) continue;
    sourceConflict(node, 'vk-asm', file, line);
    let raw;
    let fileName = attr(node, 'file') || attr(node, 'title') || '';
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      deps.push(abs);
      raw = fs.readFileSync(abs, 'utf8');
      fileName = fileName || path.basename(abs);
    } else {
      raw = inline;
    }
    const { rows, labels } = parseAsm(raw);
    const asmLang = resolveLang(attr(node, 'lang') || 'asm');
    const range = lineRange(node);
    const selected = range ? rows.filter((r) => r.line >= range[0] && r.line <= range[1]) : rows;
    if (!selected.length) {
      errors.push(`${file}:${line} <vk-asm> 的 lines="${attr(node, 'lines') || ''}" 没有命中任何行`);
    }
    const first = selected[0]?.line;
    const last = selected[selected.length - 1]?.line;
    for (const name of ['current', 'focus']) {
      for (const { from, to } of indexRanges(attr(node, name))) {
        if (first == null || from < first || to > last) {
          errors.push(
            `${file}:${line} <vk-asm> 的 ${name}="${from}${to === from ? '' : '-' + to}" 超出 ${first ?? '—'}–${last ?? '—'}（源文件行号）`
          );
        }
      }
    }
    const painted = [];
    for (const row of selected) {
      let h = escText(row.text);
      if (row.text && row.kind === 'insn') {
        try {
          const lines = await paintCode(highlighter, row.text, asmLang);
          if (lines[0]) h = lines[0];
        } catch {
          /* 没有 asm 语法就退化为等宽纯文本，不阻断构建 */
        }
      }
      painted.push({
        ...row,
        m: row.kind === 'insn' ? splitInsn(row.text).mnemonic : '',
        o: row.kind === 'insn' ? splitInsn(row.text).operands : '',
        h,
      });
    }
    const payload = { file: fileName, rows: painted, labels, base: attr(node, 'addr') || '', lang: asmLang };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    edits.push({
      start: loc.startTag.endOffset,
      end: loc.endTag.startOffset,
      inner: `\n<script type="application/json" data-vk-asm>${json}</script>\n`,
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
    const inline = inlineSourceText(node);
    sourceConflict(node, 'vk-math', file, line);
    let tex;
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      if (!fs.existsSync(abs)) {
        throw new Error(`${file}:${line} 找不到 ${src}（相对 ${path.dirname(file)}）。`);
      }
      tex = dedent(fs.readFileSync(abs, 'utf8')).trim();
      deps.push(abs);
    } else if (inline != null) {
      tex = inline.trim();
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

  // 行内公式：子节点就是 TeX；构建期渲染，原始 TeX 存进 script 供增量重建。
  for (const node of inlineMaths) {
    const loc = locOf(node);
    const line = lineOf(node);
    if (!loc.startTag || !loc.endTag) throw new Error(`${file}:${line} <vk-inline variant="math"> 缺少结束标签。`);
    const { text, hasElement } = collectText(node);
    if (hasElement) throw new Error(`${file}:${line} <vk-inline> 公式里有元素；TeX 里的 "<" 要写成 "&lt;"。`);
    const tex = dedent(text).trim();
    if (!tex) continue;
    let rendered = '';
    try {
      rendered = katex.renderToString(tex, { displayMode: false, throwOnError: true, strict: false, output: 'htmlAndMathml' });
    } catch (e) {
      throw new Error(`${file}:${line} 行内公式 KaTeX 渲染失败：${e.message}`);
    }
    const hash = hash32(tex);
    const body = `<script type="text/vk-math" data-vk-math="${hash}" data-vk-tex="${esc(tex)}">${rendered}</script>`;
    edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner: `\n${escText(tex)}${body}\n` });
  }

  // 图标：构建期把静态 <vk-icon> 内联成 SVG；运行时看到标记直接复用，不闪。
  for (const node of iconNodes) {
    const loc = locOf(node);
    if (!loc.startTag || !loc.endTag) continue;
    const label = attr(node, 'label') || '';
    const aria = label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"';
    const src = attr(node, 'src');
    if (src) {
      const abs = path.resolve(path.dirname(file), src);
      const line = lineOf(node);
      if (!fs.existsSync(abs)) {
        errors.push(`${file}:${line} <vk-icon> 找不到 ${src}`);
        continue;
      }
      deps.push(abs);
      const raw = fs.readFileSync(abs, 'utf8');
      const m = raw.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
      if (!m) {
        errors.push(`${file}:${line} <vk-icon src="${src}"> 不是 SVG`);
        continue;
      }
      const vb = (m[1].match(/viewBox\s*=\s*"([^"]+)"/i) || [])[1] || '0 0 24 24';
      const body = m[2].replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
      const inner = `<span class="vk-icon" data-vk-inline data-vk-src="${esc(src)}"${aria}><svg viewBox="${esc(vb)}">${body}</svg></span>`;
      edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, inner });
      continue;
    }
    const name = attr(node, 'name') || 'circle-help';
    if (ICONS[name]) iconNames.add(name);
    const body = ICONS[name] || ICONS['circle-help'];
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
