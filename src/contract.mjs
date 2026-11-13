/**
 * v24 · 契约
 * ----------------------------------------------------------------------------
 * 构建期校验与文档生成只有这一条路径，全部由 schema.mjs 驱动：
 *
 *   validate(tree, file)   作者写错了什么（一次报全，带 file:line 和改法；不抛异常）
 *   contract()             机器可读的完整契约（vk brief --json）
 *   markdown() / docText() 人/AI 读的契约
 *
 * 规矩：这里不出现任何组件知识。要加一条校验，先在 schema 里加字段。
 */

import fs from 'node:fs';
import { TAGS, TAG_NAMES, attrsOf, LAYERS, ANCHOR_PARTS, SKELETON, RULES, FLOW_CHILD, FLOW_CHILD_TAGS } from './schema.mjs';
import { GAP, FONT, LINE, MEASURE, FLOOR, INDEX_RULE, CANVAS, CONTENT, LINE_W, SYNTAX, PAINT, THEME, CARD_SURFACE } from './vocab.mjs';
import { attrOf, hasAttr, flatten, kids, lineOf, directText, textOf } from './shared/dom.mjs';
import { parseLines, parseRange } from './shared/range.mjs';

/* 版本只有一个来源：package.json。 */
export const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/* ------------------------------------------------------------------ 错误码 */
export const CODES = {
  UNKNOWN_TAG: 'UNKNOWN_TAG',
  UNKNOWN_ATTR: 'UNKNOWN_ATTR',
  VALUE_ENUM: 'VALUE_ENUM',
  VALUE_BOOL: 'VALUE_BOOL',
  VALUE_NUMBER: 'VALUE_NUMBER',
  VALUE_RANGE: 'VALUE_RANGE',
  VALUE_SPACE: 'VALUE_SPACE',
  VALUE_LINES: 'VALUE_LINES',
  VALUE_RANGE_ATTR: 'VALUE_RANGE_ATTR',
  VALUE_SELECTOR: 'VALUE_SELECTOR',
  VALUE_RATIO: 'VALUE_RATIO',
  ATTR_REQUIRED: 'ATTR_REQUIRED',
  ATTR_IGNORED: 'ATTR_IGNORED',
  ATTR_PLACEMENT: 'ATTR_PLACEMENT',
  SPAN_TOO_WIDE: 'SPAN_TOO_WIDE',
  ID_DUPLICATE: 'ID_DUPLICATE',
  CHILD_KIND: 'CHILD_KIND',
  CHILD_MISSING: 'CHILD_MISSING',
  STRAY_TEXT: 'STRAY_TEXT',
  GRAPH_REF: 'GRAPH_REF',
  ANCHOR_MISSING: 'ANCHOR_MISSING',
  BLEED_ALL: 'BLEED_ALL',
  /* 构建期：内容来源与解析 */
  SRC_MISSING: 'SRC_MISSING',
  SRC_CONFLICT: 'SRC_CONFLICT',
  RANGE_OUT_OF_RANGE: 'RANGE_OUT_OF_RANGE',
  TREE_JSON: 'TREE_JSON',
  TREE_NODE: 'TREE_NODE',
  MATH: 'MATH',
  ICON: 'ICON',
  MARK_MISSING: 'MARK_MISSING',
  FIELD_LABELS: 'FIELD_LABELS',
  CURRENT_RANGE: 'CURRENT_RANGE',
  BUILD: 'BUILD',
  /* 运行期：只看「坏没坏」 */
  FRAME: 'FRAME',
  RUNTIME: 'RUNTIME',
  RENDER: 'RENDER',
  ASSET: 'ASSET',
  ANCHOR: 'ANCHOR',
  CLIPPED: 'CLIPPED',
};

/* ------------------------------------------------------------------ 工具 */
const editDistance = (a, b) => {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};
const suggest = (name, pool) => {
  let best = '';
  let dist = 99;
  for (const p of pool) {
    const d = editDistance(name, p);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return dist <= Math.max(2, Math.floor(name.length / 3)) ? best : '';
};

const GLOBAL_ATTRS = new Set(['id', 'style']);
const INLINE_TAGS = new Set(['em', 'strong', 'mark', 'code', 'kbd', 'small', 'br', 'span']);
const COLS_OK = /^((auto|[1-9]\d*)(\s+(auto|[1-9]\d*))*)$/;

export { parseLines, parseRange };

/* ------------------------------------------------------------------ 值 */
export function checkValue(file, node, tag, name, spec, value, errors) {
  const where = `<${tag}>`;
  const bad = (code, message, fix) => errors.push({ file, line: lineOf(node), tag, code, message: `${where} 的 ${name}="${value}" ${message}`, fix });

  if (spec.values && !spec.values.includes(value)) bad(CODES.VALUE_ENUM, '不在词表里', `可用：${spec.values.join(' / ')}`);

  if (spec.type === 'bool' && value !== '' && value !== 'true') bad(CODES.VALUE_BOOL, '是开关，只写属性名就行', `删掉 ="${value}"`);

  if (spec.type === 'int' || spec.type === 'num') {
    const n = Number(value);
    if (!Number.isFinite(n)) bad(CODES.VALUE_NUMBER, '不是数字', '写一个数');
    else {
      if (spec.type === 'int' && !Number.isInteger(n)) bad(CODES.VALUE_NUMBER, '要整数', '写整数');
      if (spec.min !== undefined && n < spec.min) bad(CODES.VALUE_RANGE, `小于下限 ${spec.min}`, `改成 ≥ ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) bad(CODES.VALUE_RANGE, `大于上限 ${spec.max}`, `改成 ≤ ${spec.max}；要更多就拆件/拆帧`);
    }
  }

  if (spec.type === 'space' && !(value in GAP) && !/^\d+(\.\d+)?(px)?$/.test(value))
    bad(CODES.VALUE_SPACE, '不是间距', `可用：${Object.keys(GAP).join(' / ')}，或像素数如 "48"`);

  if (spec.type === 'lines' && value !== '' && !parseLines(value))
    bad(CODES.VALUE_LINES, '不是行段', '写法："3" / "3-7" / "3,7,9" / "4-"；行号 1 起');

  if (spec.type === 'range' && !parseRange(value))
    bad(CODES.VALUE_RANGE_ATTR, '不是单段行段', '写法："3" / "3-7" / "4-"；只接受一段');

  if (spec.type === 'cols' && !COLS_OK.test(value)) bad(CODES.VALUE_ENUM, '不是列数', '写 1–12 的整数、比例（如 "1 2 1"）或 auto');

  if (spec.type === 'selector' && value !== '') {
    if (!value.startsWith('#')) bad(CODES.VALUE_SELECTOR, '要写 #id', '如 #c 或 #c@line:3');
    else if (value === '#') bad(CODES.VALUE_SELECTOR, '缺少 id', '#id');
    else if (value.includes('@')) {
      const at = value.indexOf('@');
      const id = value.slice(1, at);
      if (!id) bad(CODES.VALUE_SELECTOR, '缺少 id', '#id@part:arg');
      else {
        const [part, ...args] = value.slice(at + 1).split(':');
        const arg = (args[0] || '').trim();
        if (!ANCHOR_PARTS.includes(part)) bad(CODES.VALUE_SELECTOR, `里的 @${part} 不认识`, `可用：${ANCHOR_PARTS.join(' / ')}`);
        else if (part === 'side' && !['top', 'right', 'bottom', 'left'].includes(arg))
          bad(CODES.VALUE_SELECTOR, '里的 side 不认识', '可用：top / right / bottom / left');
        else if (part !== 'side' && !parseLines(arg)) bad(CODES.VALUE_SELECTOR, `里的 ${part}:… 要一个 1 起的行段`, '如 #c@line:3 / #c@line:3-4 / #buf@item:2');
      }
    }
  }

  if (name === 'ratio' && !/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(value))
    bad(CODES.VALUE_RATIO, '不是比例', '写 "16 / 9" 或 "4 / 3"');
}

/* ------------------------------------------------------------------ 子节点 */
function checkStyle(file, node, tag, errors) {
  const style = attrOf(node, 'style');
  if (!style) return;
  for (const piece of String(style).split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const prop = piece.slice(0, at).trim();
    if (prop && !prop.startsWith('--')) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 style 里写了 ${prop}`, fix: '风格只走 size / ink / tone / theme / surface；要改 token 只能写 --vk-*' });
      return;
    }
  }
}

function checkChildModel(file, node, tag, errors) {
  const model = TAGS[tag].children;
  if (!model) return;
  const children = kids(node);
  const vkKids = children.filter((c) => c.tagName.startsWith('vk-'));

  if (model.kind === 'blocks') {
    for (const c of children) {
      if (!c.tagName.startsWith('vk-')) {
        errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能直接放 <${c.tagName}>`, fix: '块级内容用 vk- 件；文字用 <vk-text>' });
        continue;
      }
      if (c.tagName === 'vk-page' || (c.tagName === 'vk-head' && tag !== 'vk-page')) {
        errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能放 <${c.tagName}>`, fix: c.tagName === 'vk-head' ? 'vk-head 只能直接放在 vk-page 下' : '一页一个 vk-page' });
      }
    }
    const stray = directText(node);
    if (stray) errors.push({ file, line: lineOf(node), tag, code: CODES.STRAY_TEXT, message: `<${tag}> 里有一段裸文字「${stray.slice(0, 18)}」`, fix: '把它包进 <vk-text>，或删掉' });
  }

  if (model.kind === 'inline') {
    for (const c of children) {
      if (c.tagName?.startsWith('vk-')) {
        if (c.tagName === 'vk-math' && hasAttr(c, 'inline')) continue;
        errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能放 <${c.tagName}>`, fix: c.tagName === 'vk-math' ? '行内公式写 inline' : '块级内容用 <vk-flow> 包起来' });
      } else if (!INLINE_TAGS.has(c.tagName)) {
        errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能放 <${c.tagName}>`, fix: `行内只认 ${[...INLINE_TAGS].join(' / ')}` });
      }
    }
  }

  if (model.kind === 'none') {
    if (vkKids.length) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能再放 <${vkKids[0].tagName}>`, fix: '内容写在属性里' });
    const stray = directText(node);
    if (stray) errors.push({ file, line: lineOf(node), tag, code: CODES.STRAY_TEXT, message: `<${tag}> 里不能写文字「${stray.slice(0, 18)}」`, fix: '内容写在属性里' });
  }

  if (model.kind === 'items') {
    const bad = children.filter((c) => c.tagName !== 'li');
    if (bad.length) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 的条目要写成 <li>，而不是 <${bad[0].tagName}>`, fix: `把 <${bad[0].tagName}> 换成 <li>` });
    const lis = children.filter((c) => c.tagName === 'li');
    if (!lis.length) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 还没有条目`, fix: '每一条写成 <li>' });
    for (const li of lis) {
      for (const { name, value } of li.attrs || []) {
        if (name === 'id' || name === 'style') {
          if (name === 'style') checkStyle(file, li, `${tag} <li>`, errors);
          continue;
        }
        const spec = model.attrs?.[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(model.attrs || {}));
          errors.push({ file, line: lineOf(li), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 的 <li> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${Object.keys(model.attrs || {}).join(', ') || '无'}` });
          continue;
        }
        checkValue(file, li, `${tag} <li>`, name, spec, value, errors);
      }
      for (const c of kids(li)) {
        if (c.tagName.startsWith('vk-')) {
          if (c.tagName === 'vk-math' && hasAttr(c, 'inline')) continue;
          errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 的 <li> 里不能放 <${c.tagName}>`, fix: '条目里只写文字；要放块内容就用 <vk-flow>' });
        } else if (!INLINE_TAGS.has(c.tagName)) {
          errors.push({ file, line: lineOf(c), tag, code: CODES.CHILD_KIND, message: `<${tag}> 的 <li> 里不能放 <${c.tagName}>`, fix: `行内只认 ${[...INLINE_TAGS].join(' / ')}` });
        }
      }
    }
  }

  if (model.kind === 'table') {
    const table = children.find((c) => c.tagName === 'table');
    if (!table) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 里要有原生 <table>`, fix: '写 <table><tr><th>…</th></tr>…</table>' });
      return;
    }
    if (children.some((c) => c.tagName !== 'table')) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里只能放一个 <table>`, fix: '表题用 caption 属性' });
    if (directText(node)) errors.push({ file, line: lineOf(node), tag, code: CODES.STRAY_TEXT, message: `<${tag}> 里有一段裸文字`, fix: '文字放进表格单元格' });
    const rows = flatten(table).filter((n) => n.tagName === 'tr');
    for (const tr of rows) {      for (const { name, value } of tr.attrs || []) {
        if (name === 'tone' && !['ok', 'warn', 'err'].includes(value)) errors.push({ file, line: lineOf(tr), tag, code: CODES.VALUE_ENUM, message: `<tr> 的 tone="${value}" 不在词表里`, fix: '可用：ok / warn / err' });
        else if (name === 'current') {
          if (value !== '' && value !== 'true') errors.push({ file, line: lineOf(tr), tag, code: CODES.VALUE_BOOL, message: `<tr> 的 current 是开关，只写属性名`, fix: '删掉 ="…"' });
        } else if (!['tone', 'current'].includes(name)) errors.push({ file, line: lineOf(tr), tag, code: CODES.UNKNOWN_ATTR, message: `<tr> 不认识属性 ${name}="${value}"`, fix: `可用：tone / current` });
      }
      const cells = kids(tr);
      for (const cell of cells) {
        if (!['th', 'td'].includes(cell.tagName)) {
          errors.push({ file, line: lineOf(cell), tag, code: CODES.CHILD_KIND, message: `<tr> 里不能放 <${cell.tagName}>`, fix: '只写 th / td' });
          continue;
        }
        for (const { name, value } of cell.attrs || []) {
          if (name === 'current') {
            if (value !== '' && value !== 'true') errors.push({ file, line: lineOf(cell), tag, code: CODES.VALUE_BOOL, message: `<${cell.tagName}> 的 current 是开关，只写属性名`, fix: '删掉 ="…"' });
          } else if (name === 'colspan' || name === 'rowspan') {
            if (!/^\d+$/.test(value) || Number(value) < 1) errors.push({ file, line: lineOf(cell), tag, code: CODES.VALUE_NUMBER, message: `<${cell.tagName}> 的 ${name} 要是正整数`, fix: '写 ≥ 1 的整数' });
          } else {
            errors.push({ file, line: lineOf(cell), tag, code: CODES.UNKNOWN_ATTR, message: `<td> 不认识属性 ${name}="${value}"`, fix: `可用：current / colspan / rowspan` });
          }
        }
      }
    }
  }

  if (model.kind === 'source') {
    const vkKids = kids(node).filter((c) => c.tagName.startsWith('vk-'));
    if (vkKids.length) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能再放 <${vkKids[0].tagName}>`, fix: '内容写在 src 或 data-vk-* script 里' });
    const script = children.find((c) => c.tagName === 'script');
    const src = attrOf(node, 'src');
    if (script) {
      const data = (script.attrs || []).find((a) => a.name === 'data-vk-source' || a.name === 'data-vk-tree');
      if (!data) errors.push({ file, line: lineOf(script), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 的 <script> 要写 data-vk-source 或 data-vk-tree`, fix: '改成 <script type="text/plain" data-vk-source>' });
    }
    if (src && script) errors.push({ file, line: lineOf(node), tag, code: CODES.SRC_CONFLICT, message: `<${tag}> 同时写了 src 和内联内容：只能二选一`, fix: '删掉 src，或删掉内联 script' });
    const textOk = tag === 'vk-math' || tag === 'vk-bytes';
    if (!src && !script && !(textOk && textOf(node).trim())) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 没有内容`, fix: TAGS[tag].children.hint });
    }
  }
}

/* ------------------------------------------------------------------ 主校验 */
export function validate(tree, file = '<page>') {
  const errors = [];
  const all = flatten(tree);
  const ids = new Map();

  for (const node of all) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    if (!TAGS[tag]) {
      const hint = suggest(tag, TAG_NAMES);
      errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_TAG, message: `未知标签 <${tag}>`, fix: hint ? `是想写 <${hint}>？` : `可用：${TAG_NAMES.join(', ')}` });
      continue;
    }
    const spec = attrsOf(tag);
    const parent = node.parentNode?.tagName;

    for (const { name, value } of node.attrs || []) {
      if (name === 'style') {
        checkStyle(file, node, tag, errors);
        continue;
      }
      if (name === 'id') continue;
      if (name.startsWith('data-')) {
        errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 不能用 ${name}`, fix: 'data-* 是库内部属性；作者只写契约里的属性' });
        continue;
      }
      if (name === 'span' || name === 'bleed') {
        if (name === 'span') checkValue(file, node, tag, name, FLOW_CHILD.span, value, errors);
        else if (!['x', 'all'].includes(value)) errors.push({ file, line: lineOf(node), tag, code: CODES.VALUE_ENUM, message: `<${tag}> 的 bleed="${value}" 不在词表里`, fix: '可用：x / all（all 只给 vk-img）' });
        continue;
      }
      const def = spec[name];
      if (!def) {
        const pool = Object.keys(spec);
        const hint = suggest(name, pool);
        errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${pool.join(', ')}${FLOW_CHILD_TAGS.includes(tag) ? '；在 flow 里还可写 span / bleed' : ''}` });
        continue;
      }
      checkValue(file, node, tag, name, def, value, errors);
      if (def.when) {
        const actual = attrOf(node, def.when.attr) ?? spec[def.when.attr]?.default ?? '';
        if (actual && !def.when.values.includes(actual))
          errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 ${name} 只在 ${def.when.attr}="${def.when.values.join('|')}" 时有用`, fix: `现在的 ${def.when.attr} 是 "${actual}"，这个属性不会生效` });
      }
    }

    /* 必填：callout 的 for / from / to 按形态必填；seq 的 a/b 或 participants。 */
    const mode = attrOf(node, 'mode') ?? spec.mode?.default;
    for (const [name, def] of Object.entries(spec)) {
      if (!def.required) continue;
      if (def.when && !def.when.values.includes(mode)) continue;
      if (!hasAttr(node, name) || attrOf(node, name) === '') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_REQUIRED, message: `<${tag}> 缺 ${name}`, fix: name === 'for' ? '写 for="#目标id"，或 for="#目标id@line:3"' : '写 #目标id，两端都要有 id' });
    }
    if (tag === 'vk-seq' && !hasAttr(node, 'participants') && (!hasAttr(node, 'a') || !hasAttr(node, 'b'))) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_REQUIRED, message: `<vk-seq> 缺参与者`, fix: '写 participants="A,B" 或 a="A" b="B"' });
    }

    /* span / bleed 只属于 flow 的直接子项。 */
    if (hasAttr(node, 'span') && parent !== 'vk-flow') {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 span 只属于 <vk-flow> 的直接子项`, fix: `父级是 <${parent || '无'}>；要跨栏，包一层 <vk-flow>` });
    }
    if (hasAttr(node, 'bleed')) {
      const bleed = attrOf(node, 'bleed');
      if (bleed === 'all' && tag !== 'vk-img') errors.push({ file, line: lineOf(node), tag, code: CODES.BLEED_ALL, message: `<${tag}> 不能用 bleed="all"`, fix: '整帧铺满只给 <vk-img>' });
      else if (bleed !== 'all' && parent !== 'vk-flow') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 bleed 只属于 <vk-flow> 的直接子项`, fix: '要么放进 flow，要么删掉 bleed' });
    }
    if (hasAttr(node, 'span') && parent === 'vk-flow') {
      const cols = attrOf(node.parentNode, 'cols') ?? '1';
      const span = Number(attrOf(node, 'span'));
      if (cols === 'auto') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 span 在 cols="auto" 下不生效`, fix: 'auto 按内容宽排，不需要 span' });
      else if (/^\d+$/.test(cols) && span > Number(cols)) errors.push({ file, line: lineOf(node), tag, code: CODES.SPAN_TOO_WIDE, message: `<${tag}> 的 span="${span}" 超过父级 cols="${cols}"`, fix: '改 span 或改 cols' });
    }

    /* 位置规则。 */
    if (tag === 'vk-page' && parent && parent !== '#document-fragment' && parent !== '#document') {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: '<vk-page> 不能嵌套', fix: '一页一个 vk-page，并排写多个' });
    }
    if (tag === 'vk-head') {
      if (parent !== 'vk-page') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: '<vk-head> 只能直接放在 <vk-page> 下', fix: '把它移到 page 的第一层；标题带不参与分栏' });
      else {
        const heads = kids(node.parentNode).filter((c) => c.tagName === 'vk-head');
        if (heads.length > 1 && heads[0] !== node) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: '一帧只能有一个 <vk-head>', fix: '把第二个标题并进第一个，或拆帧' });
      }
    }

    const id = attrOf(node, 'id');
    if (id) {
      const scope = tag === 'vk-page' ? 'page' : 'el';
      const key = `${scope}:${id}`;
      if (ids.has(key)) errors.push({ file, line: lineOf(node), tag, code: CODES.ID_DUPLICATE, message: `${scope === 'page' ? '帧 id' : 'id'} \`${id}\` 重复了（上一处在第 ${ids.get(key)} 行）`, fix: '出图会互相覆盖，锚点也只会指到第一个' });
      else ids.set(key, lineOf(node));
    }

    checkChildModel(file, node, tag, errors);
  }

  /* 关系：锚点 #id 与 graph 的 after/from/to 都必须指向本页存在的 id。 */
  const allIds = new Set(all.filter((n) => hasAttr(n, 'id')).map((n) => attrOf(n, 'id')));
  for (const node of all) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    for (const a of node.attrs || []) {
      if (['for', 'from', 'to'].includes(a.name) && String(a.value).startsWith('#')) {
        const id = String(a.value).slice(1).split('@')[0];
        if (id && !allIds.has(id)) errors.push({ file, line: lineOf(node), tag, code: CODES.ANCHOR_MISSING, message: `<${tag}> 的 ${a.name}="${a.value}" 指向 #${id}，但这一页没有这个 id`, fix: '改成页里存在的 id，或给目标加 id' });
      }
    }
    if (tag === 'vk-graph') {
      const lis = kids(node).filter((c) => c.tagName === 'li');
      const hasFromTo = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
      const nodes = lis.filter((li) => !hasFromTo(li));
      const edges = lis.filter(hasFromTo);
      const nodeIds = new Set(nodes.map((li) => attrOf(li, 'id')).filter(Boolean));
      for (const li of nodes) {
        const after = attrOf(li, 'after');
        if (!after) continue;
        for (const ref of after.split(/\s+/).filter(Boolean)) {
          if (ref === attrOf(li, 'id')) errors.push({ file, line: lineOf(li), tag, code: CODES.GRAPH_REF, message: `<vk-graph> 的节点 \`${ref}\` 指向自己`, fix: '删掉这个 after' });
          else if (!nodeIds.has(ref)) errors.push({ file, line: lineOf(li), tag, code: CODES.GRAPH_REF, message: `<vk-graph> 的 after="${ref}" 找不到节点`, fix: `这一张图里的节点 id：${[...nodeIds].join(', ') || '无'}` });
        }
      }
      for (const li of edges) {
        for (const key of ['from', 'to']) {
          const ref = attrOf(li, key);
          if (!ref) errors.push({ file, line: lineOf(li), tag, code: CODES.ATTR_REQUIRED, message: `<vk-graph> 的边缺 ${key}`, fix: '边要写成 <li from="起点id" to="终点id">文字</li>' });
          else if (!nodeIds.has(ref)) errors.push({ file, line: lineOf(li), tag, code: CODES.GRAPH_REF, message: `<vk-graph> 的边 ${key}="${ref}" 找不到节点`, fix: `这一张图里的节点 id：${[...nodeIds].join(', ') || '无'}` });
        }
      }
    }
  }

  return errors.sort((a, b) => a.line - b.line);
}

/* ------------------------------------------------------------------ 文档 */
const TYPE_LABEL = {
  text: '文本',
  enum: '枚举',
  int: '整数',
  num: '数字',
  bool: '开关',
  lines: '行段',
  range: '单段行段',
  space: '间距',
  selector: '锚点',
  cols: '列',
};

export const fmtAttr = (name, spec) => {
  const values = spec.values ? spec.values.join(' / ') : TYPE_LABEL[spec.type] || spec.type;
  const def = spec.default === undefined ? '—' : String(spec.default);
  const range = spec.min !== undefined && spec.max !== undefined ? `${spec.min}–${spec.max}` : spec.min !== undefined ? `≥ ${spec.min}` : spec.max !== undefined ? `≤ ${spec.max}` : '';
  const required = spec.required ? '必填' : '';
  const when = spec.when ? `只对 ${spec.when.attr}=${spec.when.values.join('|')}` : '';
  return { name, values, def, range, label: [spec.label || '', required, when].filter(Boolean).join('；') };
};

/** 机器可读契约：vk brief --json 的输出。 */
export function contract() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, marginX: CANVAS.marginX, marginY: CANVAS.marginY, content: CONTENT },
    floor: FLOOR,
    indexRule: INDEX_RULE,
    theme: THEME,
    surface: CARD_SURFACE,
    flowChild: FLOW_CHILD,
    flowChildTags: FLOW_CHILD_TAGS,
    rules: RULES,
    anchorParts: ANCHOR_PARTS,
    codes: Object.keys(CODES),
    space: GAP,
    lineWidth: LINE_W,
    type: FONT,
    lineHeight: LINE,
    measure: MEASURE,
    colors: { focus: PAINT.focus, inks: [PAINT.ink1, PAINT.ink2, PAINT.ink3], tones: { info: PAINT.info, ok: PAINT.ok, warn: PAINT.warn, err: PAINT.err }, syntax: SYNTAX },
    layers: LAYERS,
    skeleton: SKELETON,
    tags: Object.fromEntries(
      TAG_NAMES.map((tag) => {
        const t = TAGS[tag];
        return [
          tag,
          {
            name: t.name,
            layer: t.layer,
            summary: t.summary,
            example: t.example || null,
            content: t.content || (t.children?.kind === 'source' ? 'source' : t.children?.kind === 'items' ? 'item' : t.children?.kind === 'table' ? 'table' : t.children?.kind === 'inline' ? 'text' : 'slot'),
            children: t.children || null,
            attrs: attrsOf(tag),
          },
        ];
      })
    ),
  };
}

/** 一页人/AI 读的契约：vk brief 默认输出。 */
export function markdown() {
  const c = contract();
  const out = [];
  out.push(`# vk 契约 ${c.version}`, '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.content.w}×${c.canvas.content.h}（左右 ${c.canvas.marginX} / 上下 ${c.canvas.marginY}）。观众在手机横屏看，实际约 780 宽（0.406×）。`);
  out.push(`自动缩小的地板 **${c.floor}px**（手机 16.2px）。索引一律 ${c.indexRule}。`, '');

  out.push('## 规则', '');
  for (const r of c.rules) out.push(`- ${r}`);
  out.push('', '## 骨架', '', '```html', c.skeleton, '```', '');

  out.push('## 字号', '');
  out.push('| 档 | px | 手机 | 行高 | 行宽（字） |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(c.type)) out.push(`| ${k} | ${v} | ${(v * 0.406).toFixed(1)} | ${c.lineHeight[k]} | ${c.measure[k]} |`);
  out.push('', '## 间距', '');
  out.push(`档名：${Object.entries(c.space).map(([k, v]) => `${k}=${v}`).join(' / ')}；也可以写像素数（gap="48"）。`);
  out.push('', '## flow 子项', '');
  out.push(`任何块级件放进 <vk-flow> 后还可以写：${Object.keys(c.flowChild).map((k) => `\`${k}\``).join(' / ')}。`);

  out.push('', '## 标签', '');
  for (const layer of LAYERS) {
    out.push(`### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      const rows = Object.entries(t.attrs).map(([n, s]) => fmtAttr(n, s));
      if (rows.length) {
        out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
        for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
      }
      if (FLOW_CHILD_TAGS.includes(tag)) out.push('', '可用 flow 子项属性：`span` / `bleed`。');
      if (t.children?.hint) out.push('', t.children.hint);
      if (t.children?.attrs && Object.keys(t.children.attrs).length) {
        out.push('', '子项属性：');
        out.push('', '| 子项属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
        for (const [n, s] of Object.entries(t.children.attrs)) {
          const r = fmtAttr(n, s);
          out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
        }
      }
      if (t.example) out.push('', '```html', t.example, '```');
      out.push('');
    }
  }
  return out.join('\n');
}

/** 单件说明：vk doc <tag>。 */
export function docText(tag) {
  const t = TAGS[tag];
  if (!t) return '';
  const out = [`${tag} · ${t.name}  (${t.layer})`, t.summary];
  if (t.children?.hint) out.push(`内容：${t.children.hint}`);
  if (FLOW_CHILD_TAGS.includes(tag)) out.push('flow 子项可用：span / bleed');
  const groups = {};
  for (const [name, spec] of Object.entries(attrsOf(tag))) (groups[spec.group || 'other'] ||= []).push([name, spec]);
  const LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标', other: '其它' };
  for (const [g, list] of Object.entries(groups)) {
    out.push('', LABEL[g] || g);
    for (const [name, spec] of list) {
      const r = fmtAttr(name, spec);
      out.push(`  ${name.padEnd(13)} ${r.values}${r.def !== '—' ? `  默认 ${r.def}` : ''}${r.range ? `  范围 ${r.range}` : ''}  ${r.label}`);
    }
  }
  if (t.children?.attrs && Object.keys(t.children.attrs).length) {
    out.push('', '子项 (<li>)');
    for (const [name, spec] of Object.entries(t.children.attrs)) {
      const r = fmtAttr(name, spec);
      out.push(`  ${name.padEnd(13)} ${r.values}${r.def !== '—' ? `  默认 ${r.def}` : ''}${r.range ? `  范围 ${r.range}` : ''}  ${r.label}`);
    }
  }
  if (t.example) out.push('', '示例：', t.example);
  return out.join('\n');
}
