/**
 * v26 · 契约校验
 * ----------------------------------------------------------------------------
 * 作者写错了什么：一次报全，带 file:line 和改法；不抛异常。
 * 组件知识全在 schema.mjs，这里只按字段表做检查。
 */
import { TAGS, TAG_NAMES, attrsOf, childrenOf, ANCHOR_PARTS, FLOW_CHILD, FLOW_CHILD_TAGS } from '../schema.mjs';
import { GAP, STYLE_LOCKED } from '../vocab.mjs';
import { attrOf, hasAttr, flatten, kids, lineOf, directText, textOf } from '../shared/dom.mjs';
import { parseLines, parseRange } from '../shared/range.mjs';
import { CODES } from './codes.mjs';
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
const INLINE_TAGS = new Set(['em', 'strong', 'mark', 'code', 'kbd', 'small', 'br', 'span']);
const COLS_OK = /^((auto|[1-9]\d*)(\s+(auto|[1-9]\d*))*)$/;
const ID_OK = /^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/;
export { parseLines, parseRange };
/* 节点当前的变体：读 as，未知就退回默认。 */
export const asOf = (node) => {
  const tag = node.tagName;
  const t = TAGS[tag];
  if (!t?.variants) return null;
  const v = attrOf(node, 'as');
  return v && t.variants[v] ? v : t.attrs.as.default;
};
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
  if (spec.type === 'cols') {
    for (const part of String(value).split(/\s+/)) if (/^\d+$/.test(part) && Number(part) > 12) bad(CODES.VALUE_RANGE, '的列数超过 12', '改成 ≤ 12；要更细的分栏用比例，如 "7 5"');
  }
  if (spec.type === 'selector' && value !== '') {
    /* for 可以写多个目标（空格分隔），每个都是 #id 或 #id@part:arg。 */
    for (const one of String(value).trim().split(/\s+/)) {
      if (!one.startsWith('#')) bad(CODES.VALUE_SELECTOR, '要写 #id', '如 #c 或 #c@line:3；多个目标用空格分隔');
      else if (one === '#') bad(CODES.VALUE_SELECTOR, '缺少 id', '#id');
      else if (one.includes('@')) {
        const at = one.indexOf('@');
        const id = one.slice(1, at);
        if (!id) bad(CODES.VALUE_SELECTOR, '缺少 id', '#id@part:arg');
        else {
          /* 可以多段：#c@line:2@side:right。 */
          for (const piece of one.slice(at + 1).split('@')) {
            const i = piece.indexOf(':');
            const part = (i < 0 ? piece : piece.slice(0, i)).trim();
            const arg = (i < 0 ? '' : piece.slice(i + 1)).trim();
            if (!ANCHOR_PARTS.includes(part)) bad(CODES.VALUE_SELECTOR, `里的 @${part} 不认识`, `可用：${ANCHOR_PARTS.join(' / ')}`);
            else if (part === 'side' && !['top', 'right', 'bottom', 'left'].includes(arg)) bad(CODES.VALUE_SELECTOR, '里的 side 不认识', '可用：top / right / bottom / left');
            else if (part !== 'side' && !parseLines(arg)) bad(CODES.VALUE_SELECTOR, `里的 ${part}:… 要一个 1 起的行段`, '如 #c@line:3 / #c@line:3-4 / #buf@item:2');
          }
        }
      }
    }
  }
  if (name === 'ratio' && !/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(value))
    bad(CODES.VALUE_RATIO, '不是比例', '写 "16 / 9" 或 "4 / 3"');
  if (name === 'position' && !/^(left|center|right|top|bottom|[\d.]+%|[\d.]+px)(\s+(left|center|right|top|bottom|[\d.]+%|[\d.]+px))?$/.test(value))
    bad(CODES.VALUE_ENUM, '不是焦点位置', '写 "50% 50%"、"left top" 这类，不能塞别的样式');
  if (name === 'addr' && !/^0x[0-9a-f]+$/i.test(value)) bad(CODES.VALUE_ENUM, '地址要写成 0x 开头的十六进制', '如 "0x1000"；十进制会被当成十六进制显示');
}
/* ------------------------------------------------------------------ 子节点 */
function checkStyle(file, node, tag, errors) {
  const style = attrOf(node, 'style');
  if (!style) return;
  const LOCKED = STYLE_LOCKED;
  for (const piece of String(style).split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const prop = piece.slice(0, at).trim();
    if (!prop) continue;
    if (!prop.startsWith('--')) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 style 里写了 ${prop}`, fix: '风格只走 size / ink / tone / theme / surface；要改颜色只能写 --vk-* token' });
      return;
    }
    if (LOCKED.test(prop)) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 想用 ${prop} 改字号/间距/线宽/版心`, fix: '这些不归作者：换 size、换件、拆帧；style 只留颜色 token' });
      return;
    }
  }
}
function checkChildModel(file, node, tag, errors) {
  const model = childrenOf(tag, asOf(node));
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
        if (name === 'id') continue;
        if (name === 'style') continue;
        const spec = model.attrs?.[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(model.attrs || {}));
          errors.push({ file, line: lineOf(li), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 的 <li> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${Object.keys(model.attrs || {}).join(', ') || '无'}` });
          continue;
        }
        checkValue(file, li, `${tag} <li>`, name, spec, value, errors);
        if (spec.when) {
          const owner = li.parentNode || node;
          const actual = attrOf(owner, spec.when.attr) ?? TAGS[owner.tagName]?.attrs?.[spec.when.attr]?.default ?? '';
          if (actual && !spec.when.values.includes(actual))
            errors.push({ file, line: lineOf(li), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 <li> ${name} 只在 ${spec.when.attr}="${spec.when.values.join('|')}" 时有用`, fix: `现在的 ${spec.when.attr} 是 "${actual}"，这个属性不会生效` });
        }
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
    const rowSpec = model.attrs || {};
    const cellSpec = model.cellAttrs || {};
    const rows = flatten(table).filter((n) => n.tagName === 'tr');
    for (const tr of rows) {
      for (const { name, value } of tr.attrs || []) {
        if (name === 'style') continue;
        const spec = rowSpec[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(rowSpec));
          errors.push({ file, line: lineOf(tr), tag, code: CODES.UNKNOWN_ATTR, message: `<tr> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${Object.keys(rowSpec).join(' / ') || '无'}` });
          continue;
        }
        checkValue(file, tr, `${tag} <tr>`, name, spec, value, errors);
      }
      const cells = kids(tr);
      for (const cell of cells) {
        if (!['th', 'td'].includes(cell.tagName)) {
          errors.push({ file, line: lineOf(cell), tag, code: CODES.CHILD_KIND, message: `<tr> 里不能放 <${cell.tagName}>`, fix: '只写 th / td' });
          continue;
        }
        for (const { name, value } of cell.attrs || []) {
          if (name === 'style') continue;
          const spec = cellSpec[name];
          if (!spec) {
            const hint = suggest(name, Object.keys(cellSpec));
            errors.push({ file, line: lineOf(cell), tag, code: CODES.UNKNOWN_ATTR, message: `<${cell.tagName}> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${Object.keys(cellSpec).join(' / ') || '无'}` });
            continue;
          }
          checkValue(file, cell, `${tag} <${cell.tagName}>`, name, spec, value, errors);
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
    const inlineOk = tag === 'vk-math' || (tag === 'vk-code' && asOf(node) === 'bytes');
    if (!src && !script && !(inlineOk && textOf(node).trim())) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 没有内容`, fix: model.hint });
    }
  }
}
/* ------------------------------------------------------------------ 主校验 */
export function validate(tree, file = '<page>') {
  const errors = [];
  const all = flatten(tree);
  const pages = all.filter((n) => n.tagName === 'vk-page');
  const pageOf = (node) => {
    for (let n = node; n; n = n.parentNode) {
      const i = pages.indexOf(n);
      if (i >= 0) return i;
    }
    return null;
  };
  const pageIds = new Map();
  const elIds = new Map();
  for (const node of all) {
    const tag = node.tagName;
    if (node.attrs?.some((a) => a.name === 'style')) checkStyle(file, node, tag || '?', errors);
    if (!tag?.startsWith('vk-')) continue;
    if (!TAGS[tag]) {
      const hint = suggest(tag, TAG_NAMES);
      errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_TAG, message: `未知标签 <${tag}>`, fix: hint ? `是想写 <${hint}>？` : `可用：${TAG_NAMES.join(', ')}` });
      continue;
    }
    /* 先定变体：as 错了一切属性表都不对。as 写错时只报这一条，不再级联出别的错。 */
    const hasVariants = !!TAGS[tag].variants;
    if (hasVariants) {
      const raw = attrOf(node, 'as');
      if (raw != null && !TAGS[tag].variants[raw]) {
        const pool = Object.keys(TAGS[tag].variants);
        const hint = suggest(raw, pool);
        errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_VARIANT, message: `<${tag}> 没有 as="${raw}"`, fix: hint ? `是想写 ${hint}？` : `可用：${pool.join(' / ')}` });
        continue;
      }
    }
    const as = asOf(node);
    const spec = attrsOf(tag, as);
    const parent = node.parentNode?.tagName;
    for (const { name, value } of node.attrs || []) {
      if (name === 'style') continue;
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
        const variantNote = hasVariants && as && TAGS[tag].variants[as] ? `（as="${as}" 时）` : '';
        errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}>${variantNote} 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${pool.join(', ')}${FLOW_CHILD_TAGS.includes(tag) ? '；在 flow 里还可写 span / bleed' : ''}` });
        continue;
      }
      checkValue(file, node, tag, name, def, value, errors);
      if (def.when) {
        const actual = attrOf(node, def.when.attr) ?? spec[def.when.attr]?.default ?? '';
        if (actual && !def.when.values.includes(actual))
          errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 ${name} 只在 ${def.when.attr}="${def.when.values.join('|')}" 时有用`, fix: `现在的 ${def.when.attr} 是 "${actual}"，这个属性不会生效` });
      }
    }
    /* 必填：callout 的 for / from / to 按形态必填；seq 的 participants；code 的 lang；img 的 src；bits 的 value。 */
    const mode = attrOf(node, 'mode') ?? spec.mode?.default;
    const REQUIRED_FIX = {
      for: '写 for="#目标id"，或 for="#目标id@line:3"',
      from: '写 from="#起点id"；两端都要有 id',
      to: '写 to="#终点id"；两端都要有 id',
      lang: '写 lang="c" / "py" / "js" / "asm" 这类',
      participants: '写 participants="客户端,服务端"，2–4 个',
      src: '写 src="相对路径"',
      value: '写 value="0|01111|0000000000"',
    };
    for (const [name, def] of Object.entries(spec)) {
      if (!def.required) continue;
      if (def.when && !def.when.values.includes(mode)) continue;
      if (!hasAttr(node, name) || attrOf(node, name) === '')
        errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_REQUIRED, message: `<${tag}> 缺 ${name}`, fix: REQUIRED_FIX[name] || `补上 ${name}` });
    }
    /* span / bleed 只属于 flow 的直接子项。 */
    if (hasAttr(node, 'span') && parent !== 'vk-flow') {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 span 只属于 <vk-flow> 的直接子项`, fix: `父级是 <${parent || '无'}>；要跨栏，包一层 <vk-flow>` });
    }
    if (hasAttr(node, 'bleed')) {
      const bleed = attrOf(node, 'bleed');
      if (bleed === 'all' && tag !== 'vk-img') errors.push({ file, line: lineOf(node), tag, code: CODES.BLEED_ALL, message: `<${tag}> 不能用 bleed="all"`, fix: '整帧铺满只给 <vk-img>' });
      else if (bleed === 'all' && parent !== 'vk-page') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 bleed="all" 只能放在 <vk-page> 第一层`, fix: '移到 page 下；要跟文字并排请用普通图片' });
      else if (bleed !== 'all' && parent !== 'vk-flow') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 bleed 只属于 <vk-flow> 的直接子项`, fix: '要么放进 flow，要么删掉 bleed' });
    }
    if (hasAttr(node, 'span') && parent === 'vk-flow') {
      const cols = attrOf(node.parentNode, 'cols') ?? '1';
      const span = Number(attrOf(node, 'span'));
      const total = /^\d+$/.test(cols) ? Number(cols) : cols === 'auto' ? 0 : cols.split(/\s+/).length;
      if (cols === 'auto') errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 span 在 cols="auto" 下不生效`, fix: 'auto 按内容宽排，不需要 span' });
      else if (span > total) errors.push({ file, line: lineOf(node), tag, code: CODES.SPAN_TOO_WIDE, message: `<${tag}> 的 span="${span}" 超过父级 cols="${cols}"`, fix: '改 span 或改 cols' });
    }
    /* 标注：只有 note 显示文字；mark/arrow/measure 里写句子会被静默丢掉。 */
    if (tag === 'vk-callout') {
      const cmode = attrOf(node, 'mode') ?? spec.mode?.default ?? 'note';
      const body = textOf(node).trim();
      if (cmode !== 'note' && body) errors.push({ file, line: lineOf(node), tag, code: CODES.STRAY_TEXT, message: `<vk-callout mode="${cmode}"> 里不显示文字「${body.slice(0, 18)}」`, fix: '要说话就写 mode="note"；只画标记就删掉文字' });
      if (cmode === 'note' && !body) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: '<vk-callout mode="note"> 没有一句话', fix: '在标签里写这一句；只画标记用 mode="mark"' });
      if (cmode === 'arrow' || cmode === 'measure') {
        const a1 = attrOf(node, 'from');
        const a2 = attrOf(node, 'to');
        if (a1 && a2 && a1 === a2) errors.push({ file, line: lineOf(node), tag, code: CODES.CALLOUT_DEGENERATE, message: `arrows/measure 的 from 和 to 是同一个锚点 ${a1}`, fix: '换一个终点，或改成 mode="mark"' });
      }
    }
    /* 标注是覆盖层：只能挂在 page 或 flow 上，放进 card 会让正文不让出注栏。 */
    if (tag === 'vk-callout' && parent !== 'vk-page' && parent !== 'vk-flow') {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: '<vk-callout> 只能放在 <vk-page> 或 <vk-flow> 下', fix: '把它移到 page 的第一层；标注是覆盖层，不参与卡片内部排布' });
    }
    /* 位置规则。 */
    if (tag === 'vk-page' && parent && parent !== '#document-fragment' && parent !== '#document' && parent !== 'body') {
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: '<vk-page> 不能嵌套', fix: '一页一个 vk-page，并排写多个' });
    }
    if (tag === 'vk-page') {
      const notes = flatten(node).filter((n) => n.tagName === 'vk-callout' && (attrOf(n, 'mode') ?? 'note') === 'note');
      if (notes.length > 1) errors.push({ file, line: lineOf(notes[1]), tag, code: CODES.NOTE_MULTI, message: `这一帧有 ${notes.length} 条 note`, fix: '注栏只有一列，会叠字；拆帧，或把其中一条改成 mode="mark"' });
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
      if (!ID_OK.test(id))
        errors.push({ file, line: lineOf(node), tag, code: CODES.ID_FORMAT, message: `id \`${id}\` 只能有字母、数字、下划线、短横线、汉字`, fix: '出图文件名与锚点都用它；去掉空格、斜杠、@、冒号' });
      if (tag === 'vk-page') {
        if (pageIds.has(id)) errors.push({ file, line: lineOf(node), tag, code: CODES.ID_DUPLICATE, message: `帧 id \`${id}\` 重复了（上一处在第 ${pageIds.get(id)} 行）`, fix: '给每一帧一个唯一 id；产物重名会加短 hash，但引用会分不清' });
        else pageIds.set(id, lineOf(node));
      } else {
        const frame = pageOf(node);
        const key = `${frame}:${id}`;
        if (elIds.has(key)) errors.push({ file, line: lineOf(node), tag, code: CODES.ID_DUPLICATE, message: `这一帧里 id \`${id}\` 重复了（上一处在第 ${elIds.get(key)} 行）`, fix: '同一帧里 id 只能有一个；跨帧可以重名' });
        else elIds.set(key, lineOf(node));
      }
    }
    checkChildModel(file, node, tag, errors);
  }
  /* 关系：锚点 #id 与 graph 的 after/from/to 都必须指向本帧存在的 id。
     多帧页里每一帧是独立作用域：A 帧的标注不能指 B 帧的元素。 */
  const idsByPage = new Map();
  for (const n of all) {
    const id = attrOf(n, 'id');
    if (!id) continue;
    const frame = pageOf(n);
    if (!idsByPage.has(frame)) idsByPage.set(frame, new Set());
    idsByPage.get(frame).add(id);
  }
  for (const node of all) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    for (const a of node.attrs || []) {
      if (['for', 'from', 'to'].includes(a.name) && String(a.value).startsWith('#')) {
        for (const one of String(a.value).trim().split(/\s+/)) {
          if (!one.startsWith('#')) continue;
          const id = one.slice(1).split('@')[0];
          const frame = pageOf(node);
          const ids = idsByPage.get(frame) || new Set();
          if (id && !ids.has(id)) errors.push({ file, line: lineOf(node), tag, code: CODES.ANCHOR_MISSING, message: `<${tag}> 的 ${a.name}="${one}" 指向 #${id}，但这一帧没有这个 id`, fix: '改成这一帧里存在的 id，或给目标加 id' });
        }
      }
    }
    if (tag === 'vk-graph') {
      const lis = kids(node).filter((c) => c.tagName === 'li');
      const hasFromTo = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
      const nodes = lis.filter((li) => !hasFromTo(li));
      const edges = lis.filter(hasFromTo);
      const nodeIds = new Set(nodes.map((li) => attrOf(li, 'id')).filter(Boolean));
      const seenNode = new Map();
      for (const li of nodes) {
        const id = attrOf(li, 'id');
        if (!id) continue;
        if (seenNode.has(id)) errors.push({ file, line: lineOf(li), tag, code: CODES.ID_DUPLICATE, message: `<vk-graph> 的节点 id \`${id}\` 重复了`, fix: '节点 id 是边的目标，重复会让边接到错的节点' });
        else seenNode.set(id, lineOf(li));
      }
      /* after 不能成环：树/链没有根就没法排。 */
      const adj = new Map(nodes.map((li) => [attrOf(li, 'id'), (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean)]));
      const mark = new Map();
      const dfs = (id, path) => {
        if (mark.get(id) === 1) {
          errors.push({ file, line: seenNode.get(id) || 1, tag, code: CODES.GRAPH_CYCLE, message: `<vk-graph> 的 after 成环：${[...path, id].join(' → ')}`, fix: '树/链不能成环；环用显式 from/to 边' });
          return;
        }
        if (mark.get(id) === 2) return;
        mark.set(id, 1);
        for (const p of adj.get(id) || []) if (adj.has(p)) dfs(p, [...path, id]);
        mark.set(id, 2);
      };
      for (const id of adj.keys()) if (id) dfs(id, []);
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
        if (attrOf(li, 'from') && attrOf(li, 'from') === attrOf(li, 'to')) errors.push({ file, line: lineOf(li), tag, code: CODES.SELF_REF, message: '<vk-graph> 的边 from 和 to 是同一个节点', fix: '换终点；自环请用 mesh 布局的独立节点表达' });
      }
    }
    if (tag === 'vk-seq') {
      for (const li of kids(node).filter((c) => c.tagName === 'li')) {
        const f = attrOf(li, 'from');
        const t = attrOf(li, 'to');
        if (f && t && f === t) errors.push({ file, line: lineOf(li), tag, code: CODES.SELF_REF, message: '<vk-seq> 的消息 from 和 to 是同一条泳道', fix: '改终点；时序自消息暂不支持，用 note 说明' });
      }
    }
  }
  const pageAt = (line) => {
    for (let i = pages.length - 1; i >= 0; i--) {
      const loc = pages[i].sourceCodeLocation;
      if (!loc) continue;
      if (line >= loc.startLine && line <= (loc.endLine || loc.startLine)) return i;
    }
    return null;
  };
  return errors.map((e) => ({ ...e, frame: pageAt(e.line) })).sort((a, b) => a.line - b.line);
}