/**
 * v27 · 契约校验
 * ----------------------------------------------------------------------------
 * 作者写错了什么：一次报全，带 file:line 和改法；不抛异常，也不拦出图。
 * 组件知识全在 schema.mjs，这里只按 attrsOf / childrenOf 的表做检查。
 *
 * 三条纪律：
 *   · 变体统一走 variantOf；as 是全库唯一的调度词（mode / variant 都不存在）。
 *   · infer 的件（graph / callout）不写 as 时由库推断，这里不替它落默认：
 *     graph 取所有变体的并集，callout 按已写的锚点先定形。
 *   · 同一 line + code 只报一条：留信息量最大的那条（message + fix 最长）。
 */
import { TAGS, TAG_NAMES, attrsOf, childrenOf, variantOf, ANCHOR_PARTS, FLOW_CHILD, FLOW_CHILD_TAGS } from '../schema.mjs';
import { GAP, STYLE_LOCKED } from '../vocab.mjs';
import { attrOf, hasAttr, flatten, kids, lineOf, directText, textOf } from '../shared/dom.mjs';
import { parseLines, parseRange } from '../shared/range.mjs';
import { CODES, familyOf, severityOf } from './codes.mjs';

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
/* flow 的 cols 只认「列数 / auto」；比例走 split。写 "1 2 1" 构建期只会按 1 栏画。 */
const COLS_OK = /^(auto|[1-9]\d*)$/;
const ID_OK = /^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/;
const err = (file, node, tag, code, message, fix) => ({ file, line: lineOf(node), tag, code, message, fix });

/* 节点当前的变体：读 as，未知 / 未写都退回默认。构建层（build/index.mjs）也用它。 */
export const asOf = (node) => variantOf(node.tagName, attrOf(node, 'as'));

/* v27 删掉 / 改名的属性。分两类：
   LEGACY —— v26 旧名，构建侧静默兼容，所以这里只给一条 hint，绝不当硬错；
   RENAMED —— 已删、没有等价写法（depth / icon 之类），按 UNKNOWN_ATTR 报，但说清换成什么。
   键是 tag:name，必要时 tag:as:name 精确到变体。 */
const LEGACY = {
  'vk-callout:mode': { to: 'as', note: 'v27 用 as 选形' },
  'vk-callout:for': { to: 'target', note: 'v27 锚点属性叫 target' },
  'vk-code:bits:label': { to: 'caption', note: 'v27 左边一行说明写 caption' },
  'vk-code:bits:field-labels': { to: 'fields', note: 'v27 各段名写 fields' },
  'vk-code:asm:show-addr': { to: 'addr', note: 'v27 地址列写 addr="on|off"' },
  'vk-img:ratio': { to: 'aspect', note: 'v27 比例写 aspect' },
  'vk-img:fill': { to: 'fit', note: 'v27 填充写 fit="contain|cover"' },
  'vk-img:position': { to: 'focus', note: 'v27 焦点写 focus' },
  'vk-seq:direction': { to: '', note: 'v27 方向由 from/to 决定，direction 已忽略' },
};
const RENAMED = {
  'vk-callout:variant': 'v27 用 as 选形：as="note|mark|arrow|measure|jump"',
  'vk-code:mode': 'v27 用 as 选变体：as="code|term|diff|asm|bytes|bits"',
  'vk-code:variant': 'v27 用 as 选变体：as="code|term|diff|asm|bytes|bits"',
  'vk-board:mode': 'v27 用 as 选变体：as="list|steps|bars|timeline|table|cells|band|frames"',
  'vk-board:variant': 'v27 用 as 选变体：as="list|steps|bars|timeline|table|cells|band|frames"',
  'vk-board:table:caption': 'v27 表题只认原生 <caption>：<table><caption>…</caption>…</table>',
  'vk-graph:direction': 'v27 删了 direction：写 after 自动成树、写 lane 自动分泳道、写 from/to 自动成环',
  'vk-dir:depth': 'v27 删了 depth：层级由目录结构决定，只留 limit',
  'vk-text:icon': 'v27 删了 icon：文字前不放图标',
};
const renamedHint = (tag, as, name) => RENAMED[`${tag}:${as}:${name}`] || RENAMED[`${tag}:${name}`] || '';
const legacyOf = (tag, as, name) => LEGACY[`${tag}:${as}:${name}`] || LEGACY[`${tag}:${name}`] || null;

/* bits 的旧序号写法：down 按位权、up 从左数，构建侧会映射，这里只提示。 */
const LEGACY_INDEX = { down: 'weight', up: 'order' };

/* callout 不写 as 时按已写的锚点定形：只有 target（或旧名 for）有字是 note，
   没字是 mark；from/to 与 arrow 同形（measure / jump 也这么写）。 */
function calloutShape(node) {
  if (hasAttr(node, 'from') || hasAttr(node, 'to')) return 'arrow';
  return textOf(node).trim() ? 'note' : 'mark';
}

/* 这个节点可能是哪几个变体：写了 as（或旧名 mode）就那一个；infer 的件不写 as
   时给候选集；没有变体的件返回 [null]（按标签自己的属性表即可）。 */
function variantIds(node) {
  const tag = node.tagName;
  const t = TAGS[tag];
  if (!t?.variants) return [null];
  const raw = attrOf(node, 'as');
  if (raw != null) return t.variants[raw] ? [raw] : null; /* null = 写错了，只报 UNKNOWN_VARIANT */
  const legacy = tag === 'vk-callout' ? attrOf(node, 'mode') : null;
  if (legacy != null && t.variants[legacy]) return [legacy];
  if (!t.attrs.as?.infer) return [variantOf(tag, raw)];
  if (tag === 'vk-callout') return [calloutShape(node)];
  return Object.keys(t.variants); /* graph：四种布局都可能，属性取并集 */
}

/* 多个变体的子节点模型合成一个：种类取第一个，子项属性取并集。 */
const mergeChildren = (models) => {
  const base = { ...models[0] };
  base.attrs = models.reduce((acc, m) => ({ ...acc, ...(m.attrs || {}) }), {});
  if (models.some((m) => m.cellAttrs)) base.cellAttrs = models.reduce((acc, m) => ({ ...acc, ...(m.cellAttrs || {}) }), {});
  base.hint = models.find((m) => m.hint)?.hint;
  return base;
};

/* 一个节点的属性表与子节点模型。 */
function modelOf(tag, ids) {
  if (ids.length === 1) return { attrs: attrsOf(tag, ids[0]), children: childrenOf(tag, ids[0]) };
  const attrs = {};
  for (const id of ids) Object.assign(attrs, attrsOf(tag, id));
  const children = mergeChildren(ids.map((id) => childrenOf(tag, id)).filter(Boolean));
  return { attrs, children };
}

/* img 的 aspect 只认一种形状：16:9 → 16 / 9。
   归一放在这里：validate 是构建期第一次遍历整棵树，后面各层不再各自写一遍解析。 */
function canonAspect(node) {
  if (node.tagName !== 'vk-img') return;
  const raw = attrOf(node, 'aspect');
  if (raw == null) return;
  const m = String(raw).trim().match(/^(\d+(?:\.\d+)?)\s*[/:：]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return;
  const canon = `${m[1]} / ${m[2]}`;
  if (canon === raw) return;
  node.attrs = node.attrs.map((a) => (a.name === 'aspect' ? { ...a, value: canon } : a));
}

/* ------------------------------------------------------------------ 值 */
export function checkValue(file, node, tag, name, spec, value, errors) {
  const where = `<${tag}>`;
  const bad = (code, message, fix) => errors.push(err(file, node, tag, code, `${where} 的 ${name}="${value}" ${message}`, fix));
  if (spec.values && !spec.values.includes(value)) {
    if (name === 'index' && LEGACY_INDEX[value])
      errors.push(
        err(file, node, tag, CODES.ATTR_IGNORED, `${where} 的 index="${value}" 是 v26 的写法`, `v27 写 index="${LEGACY_INDEX[value]}"（down → weight、up → order）；构建侧仍兼容旧值`)
      );
    else bad(CODES.VALUE_ENUM, '不在词表里', `可用：${spec.values.join(' / ')}`);
  }
  if (spec.type === 'bool' && value !== '' && value !== 'true') bad(CODES.VALUE_BOOL, '是开关，只写属性名就行', `删掉 ="${value}"`);
  if (spec.type === 'int' || spec.type === 'num') {
    const n = Number(value);
    if (!Number.isFinite(n)) bad(CODES.VALUE_NUMBER, '不是数字', '写一个数');
    else {
      if (spec.type === 'int' && !Number.isInteger(n)) bad(CODES.VALUE_NUMBER, '要整数', '写整数');
      if (spec.min !== undefined && n < spec.min) bad(CODES.VALUE_RANGE, `小于下限 ${spec.min}`, `改成 ≥ ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) bad(CODES.VALUE_RANGE, `大于上限 ${spec.max}`, `改成 ≤ ${spec.max}；要更多就拆件 / 拆帧`);
    }
  }
  if (spec.type === 'space' && !(value in GAP) && !/^\d+(\.\d+)?(px)?$/.test(value))
    bad(CODES.VALUE_SPACE, '不是间距', `可用：${Object.keys(GAP).join(' / ')}，或像素数如 "48"`);
  if (spec.type === 'lines' && value !== '' && !parseLines(value))
    bad(CODES.VALUE_LINES, '不是行段', '写法："3" / "3-7" / "3,7,9" / "4-"；行号 1 起');
  if (spec.type === 'range' && !parseRange(value)) bad(CODES.VALUE_RANGE_ATTR, '不是单段行段', '写法："3" / "3-7" / "4-"；只接受一段');
  if (spec.type === 'cols' && !COLS_OK.test(value)) bad(CODES.VALUE_ENUM, '不是列数', '写 1–12 的整数或 auto；比例用 split="7 5"');
  if (spec.type === 'cols' && /^\d+$/.test(value) && Number(value) > 12) bad(CODES.VALUE_RANGE, '的列数超过 12', '改成 ≤ 12；要更细的分栏用 split');
  if (spec.type === 'selector' && value !== '') {
    /* 一个属性可以写多个目标（空格分隔），每个是 #id 或 #id@part:arg。 */
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
            else if (part === 'side' && !['top', 'right', 'bottom', 'left'].includes(arg))
              bad(CODES.VALUE_SELECTOR, '里的 side 不认识', '可用：top / right / bottom / left');
            else if (part === 'text' && !/^[^\s[\]]+(?:\[\d+\])?$/.test(arg))
              bad(CODES.TEXT_ANCHOR, arg ? '里的 @text: 写法不对' : '里的 @text: 冒号后是空的', '写 @text:词（同一个词出现多次时写 @text:词[2]）');
            else if (part !== 'side' && part !== 'text' && !parseLines(arg))
              bad(CODES.VALUE_SELECTOR, `里的 ${part}:… 要一个 1 起的行段`, '如 #c@line:3 / #c@line:3-4 / #buf@item:2');
          }
        }
      }
    }
  }
  if (name === 'aspect' && !/^\d+(\.\d+)?\s*[/:]\s*\d+(\.\d+)?$/.test(value))
    bad(CODES.VALUE_RATIO, '不是比例', '写 "16 / 9" 或 "16:9"');
  if (name === 'focus' && !/^(left|center|right|top|bottom|[\d.]+%|[\d.]+px)(\s+(left|center|right|top|bottom|[\d.]+%|[\d.]+px))?$/.test(value))
    bad(CODES.VALUE_ENUM, '不是焦点位置', '写 "50% 50%"、"left top" 这类，不能塞别的样式');
  /* addr 在两个字件上有两种意思：bytes 是起始地址（0x…），asm 是「显示地址列 on/off」。 */
  if (name === 'addr' && node.tagName === 'vk-code' && asOf(node) === 'bytes' && !/^0x[0-9a-f]+$/i.test(value))
    bad(CODES.VALUE_ENUM, '地址要写成 0x 开头的十六进制', '如 "0x1000"；十进制会被当成十六进制显示');
}

/* ------------------------------------------------------------------ 子节点 */
function checkStyle(file, node, tag, errors) {
  const style = attrOf(node, 'style');
  if (!style) return;
  for (const piece of String(style).split(';')) {
    const at = piece.indexOf(':');
    if (at < 0) continue;
    const prop = piece.slice(0, at).trim();
    if (!prop) continue;
    if (!prop.startsWith('--')) {
      errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 的 style 里写了 ${prop}`, '风格只走 size / ink / tone / theme / surface；要改颜色只能写 --vk-* token'));
      return;
    }
    if (STYLE_LOCKED.test(prop)) {
      errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 想用 ${prop} 改字号 / 间距 / 线宽 / 版心`, '这些不归作者：换 size、换件、拆帧；style 只留颜色 token'));
      return;
    }
  }
}

function checkChildModel(file, node, tag, as, model, errors) {
  if (!model) return;
  const children = kids(node);
  const vkKids = children.filter((c) => c.tagName.startsWith('vk-'));
  if (model.kind === 'blocks') {
    for (const c of children) {
      if (!c.tagName.startsWith('vk-')) {
        errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 里不能直接放 <${c.tagName}>`, '块级内容用 vk- 件；文字用 <vk-text>'));
        continue;
      }
      if (c.tagName === 'vk-page' || (c.tagName === 'vk-head' && tag !== 'vk-page')) {
        errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 里不能放 <${c.tagName}>`, c.tagName === 'vk-head' ? 'vk-head 只能直接放在 vk-page 下' : '一页一个 vk-page'));
      }
    }
    const stray = directText(node);
    if (stray) errors.push(err(file, node, tag, CODES.STRAY_TEXT, `<${tag}> 里有一段裸文字「${stray.slice(0, 18)}」`, '把它包进 <vk-text>，或删掉'));
  }
  if (model.kind === 'inline') {
    for (const c of children) {
      /* vk-math 的行内/块由父级推断（inline 父级里一律行内），不再看 inline 属性。 */
      if (c.tagName === 'vk-math') continue;
      if (c.tagName?.startsWith('vk-')) {
        errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 里不能放 <${c.tagName}>`, '块级内容用 <vk-flow> 包起来'));
      } else if (!INLINE_TAGS.has(c.tagName)) {
        errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 里不能放 <${c.tagName}>`, `行内只认 ${[...INLINE_TAGS].join(' / ')}`));
      }
    }
  }
  if (model.kind === 'none') {
    if (vkKids.length) errors.push(err(file, node, tag, CODES.CHILD_KIND, `<${tag}> 里不能再放 <${vkKids[0].tagName}>`, '内容写在属性里'));
    const stray = directText(node);
    if (stray) errors.push(err(file, node, tag, CODES.STRAY_TEXT, `<${tag}> 里不能写文字「${stray.slice(0, 18)}」`, '内容写在属性里'));
  }
  if (model.kind === 'items') {
    const bad = children.filter((c) => c.tagName !== 'li');
    if (bad.length) errors.push(err(file, node, tag, CODES.CHILD_KIND, `<${tag}> 的条目要写成 <li>，而不是 <${bad[0].tagName}>`, `把 <${bad[0].tagName}> 换成 <li>`));
    const lis = children.filter((c) => c.tagName === 'li');
    if (!lis.length) errors.push(err(file, node, tag, CODES.CHILD_MISSING, `<${tag}> 还没有条目`, '每一条写成 <li>'));
    for (const li of lis) {
      for (const { name, value } of li.attrs || []) {
        if (name === 'id' || name === 'style') continue;
        const spec = model.attrs?.[name];
        if (!spec) {
          const legacy = legacyOf(tag, as, name);
          if (legacy) {
            errors.push(
              err(
                file,
                li,
                tag,
                CODES.ATTR_IGNORED,
                `<${tag}> 的 <li> ${name}="${value}" 是 v26 的名字`,
                legacy.to ? `v27 叫 ${legacy.to}（${legacy.note}）；构建侧仍兼容，新帧请写 ${legacy.to}` : `${legacy.note}；构建侧兼容，建议删掉`
              )
            );
            continue;
          }
          const hint = suggest(name, Object.keys(model.attrs || {}));
          errors.push(
            err(file, li, tag, CODES.UNKNOWN_ATTR, `<${tag}> 的 <li> 不认识属性 ${name}="${value}"`, hint ? `是想写 ${hint}？` : `可用：${Object.keys(model.attrs || {}).join(', ') || '无'}`)
          );
          continue;
        }
        checkValue(file, li, `${tag} <li>`, name, spec, value, errors);
      }
      for (const c of kids(li)) {
        /* 条目里的公式按父级推断成行内，和 vk-text 一样放行。 */
        if (c.tagName === 'vk-math') continue;
        if (c.tagName.startsWith('vk-')) {
          errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 的 <li> 里不能放 <${c.tagName}>`, '条目里只写文字；要放块内容就用 <vk-flow>'));
        } else if (!INLINE_TAGS.has(c.tagName)) {
          errors.push(err(file, c, tag, CODES.CHILD_KIND, `<${tag}> 的 <li> 里不能放 <${c.tagName}>`, `行内只认 ${[...INLINE_TAGS].join(' / ')}`));
        }
      }
    }
  }
  if (model.kind === 'table') {
    const table = children.find((c) => c.tagName === 'table');
    if (!table) {
      errors.push(err(file, node, tag, CODES.CHILD_MISSING, `<${tag}> 里要有原生 <table>`, '写 <table><caption>表题</caption><tr><th>…</th></tr>…</table>'));
      return;
    }
    if (children.some((c) => c.tagName !== 'table')) errors.push(err(file, node, tag, CODES.CHILD_KIND, `<${tag}> 里只能放一个 <table>`, '表题写原生 <caption>，不写 caption 属性'));
    if (directText(node)) errors.push(err(file, node, tag, CODES.STRAY_TEXT, `<${tag}> 里有一段裸文字`, '文字放进表格单元格'));
    const rowSpec = model.attrs || {};
    const cellSpec = model.cellAttrs || {};
    const rows = flatten(table).filter((n) => n.tagName === 'tr');
    for (const tr of rows) {
      for (const { name, value } of tr.attrs || []) {
        if (name === 'style') continue;
        const spec = rowSpec[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(rowSpec));
          errors.push(err(file, tr, tag, CODES.UNKNOWN_ATTR, `<tr> 不认识属性 ${name}="${value}"`, hint ? `是想写 ${hint}？` : `可用：${Object.keys(rowSpec).join(' / ') || '无'}`));
          continue;
        }
        checkValue(file, tr, `${tag} <tr>`, name, spec, value, errors);
      }
      for (const cell of kids(tr)) {
        if (!['th', 'td'].includes(cell.tagName)) {
          errors.push(err(file, cell, tag, CODES.CHILD_KIND, `<tr> 里不能放 <${cell.tagName}>`, '只写 th / td'));
          continue;
        }
        for (const { name, value } of cell.attrs || []) {
          if (name === 'style') continue;
          const spec = cellSpec[name];
          if (!spec) {
            const hint = suggest(name, Object.keys(cellSpec));
            errors.push(err(file, cell, tag, CODES.UNKNOWN_ATTR, `<${cell.tagName}> 不认识属性 ${name}="${value}"`, hint ? `是想写 ${hint}？` : `可用：${Object.keys(cellSpec).join(' / ') || '无'}`));
            continue;
          }
          checkValue(file, cell, `${tag} <${cell.tagName}>`, name, spec, value, errors);
        }
      }
    }
  }
  if (model.kind === 'source') {
    if (vkKids.length) errors.push(err(file, node, tag, CODES.CHILD_KIND, `<${tag}> 里不能再放 <${vkKids[0].tagName}>`, '内容写在 src 或 data-vk-* script 里'));
    const script = children.find((c) => c.tagName === 'script');
    const src = attrOf(node, 'src');
    if (script) {
      const data = (script.attrs || []).find((a) => a.name === 'data-vk-source' || a.name === 'data-vk-tree');
      if (!data) errors.push(err(file, script, tag, CODES.CHILD_MISSING, `<${tag}> 的 <script> 要写 data-vk-source 或 data-vk-tree`, '改成 <script type="text/plain" data-vk-source>'));
    }
    if (src && script) errors.push(err(file, node, tag, CODES.SRC_CONFLICT, `<${tag}> 同时写了 src 和内联内容：只能二选一`, '删掉 src，或删掉内联 script'));
    const inlineOk = tag === 'vk-math' || (tag === 'vk-code' && asOf(node) === 'bytes');
    if (!src && !script && !(inlineOk && textOf(node).trim())) {
      errors.push(err(file, node, tag, CODES.CHILD_MISSING, `<${tag}> 没有内容`, model.hint || '写 src 或内联内容'));
    }
  }
}

/* 去重：同一 line + code 只报一条，留信息量最大的（message + fix 最长）。
   构建期也会在同一条线上补诊断（SRC_CONFLICT / SRC_MISSING…），
   所以这一步是导出的：build 收尾时对整包 diagnostics 再调一次即可。 */
export function dedupe(errors) {
  const weight = (e) => (e.message || '').length + (e.fix || '').length;
  const best = new Map();
  for (const e of errors) {
    const key = `${e.line}|${e.code}`;
    const prev = best.get(key);
    if (!prev || weight(e) > weight(prev)) best.set(key, e);
  }
  return [...best.values()];
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
  const REQUIRED_FIX = {
    target: '写 target="#目标id"，或 target="#目标id@line:3"',
    from: '写 from="#起点id"；两端都要有 id',
    to: '写 to="#终点id"；两端都要有 id',
    src: '写 src="相对路径"',
    value: '写 value="0|01111|0000000000"',
  };

  for (const node of all) {
    const tag = node.tagName;
    if (node.attrs?.some((a) => a.name === 'style')) checkStyle(file, node, tag || '?', errors);
    canonAspect(node);
    if (!tag?.startsWith('vk-')) continue;
    if (!TAGS[tag]) {
      const hint = suggest(tag, TAG_NAMES);
      errors.push(err(file, node, tag, CODES.UNKNOWN_TAG, `未知标签 <${tag}>`, hint ? `是想写 <${hint}>？` : `可用：${TAG_NAMES.join(', ')}`));
      continue;
    }
    /* 先定变体：as 错了一切属性表都不对。as 写错时只报这一条，不再级联出别的错。 */
    const ids = variantIds(node);
    if (!ids) {
      const raw = attrOf(node, 'as');
      const pool = Object.keys(TAGS[tag].variants);
      const hint = suggest(raw || '', pool);
      errors.push(err(file, node, tag, CODES.UNKNOWN_VARIANT, `<${tag}> 没有 as="${raw}"`, hint ? `是想写 ${hint}？` : `可用：${pool.join(' / ')}`));
      continue;
    }
    const as = ids.length === 1 ? ids[0] : null;
    const model = modelOf(tag, ids);
    const spec = model.attrs;
    const parent = node.parentNode?.tagName;
    for (const { name, value } of node.attrs || []) {
      if (name === 'style' || name === 'id') continue;
      if (name.startsWith('data-')) {
        errors.push(err(file, node, tag, CODES.UNKNOWN_ATTR, `<${tag}> 不能用 ${name}`, 'data-* 是库内部属性；作者只写契约里的属性'));
        continue;
      }
      if (name === 'bleed' && tag !== 'vk-img') {
        errors.push(err(file, node, tag, CODES.BLEED_ALL, `<${tag}> 不能用 bleed="${value}"`, 'bleed 只属于 <vk-img>：横向出血给 flow 里的图，整帧铺满给 page 第一层的图'));
        continue;
      }
      if (name === 'span') {
        if (!FLOW_CHILD_TAGS.includes(tag)) errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 不能写 span`, 'span 只属于可以放进 flow 的件的直接子项'));
        else checkValue(file, node, tag, name, FLOW_CHILD.span, value, errors);
        continue;
      }
      const def = spec[name];
      if (!def) {
        /* 旧名：构建侧兼容，只提示改名，不阻断出图。 */
        const legacy = legacyOf(tag, as, name);
        if (legacy) {
          errors.push(
            err(
              file,
              node,
              tag,
              CODES.ATTR_IGNORED,
              `<${tag}> 的 ${name}="${value}" 是 v26 的名字`,
              legacy.to ? `v27 叫 ${legacy.to}（${legacy.note}）；构建侧仍兼容，新帧请写 ${legacy.to}` : `${legacy.note}；构建侧兼容，建议删掉`
            )
          );
          continue;
        }
        const pool = Object.keys(spec);
        const hint = renamedHint(tag, as, name) || (suggest(name, pool) ? `是想写 ${suggest(name, pool)}？` : '');
        const variantNote = TAGS[tag].variants && as ? `（as="${as}" 时）` : '';
        errors.push(
          err(file, node, tag, CODES.UNKNOWN_ATTR, `<${tag}>${variantNote} 不认识属性 ${name}="${value}"`, hint || `可用：${pool.join(', ')}${FLOW_CHILD_TAGS.includes(tag) ? '；在 flow 里还可写 span' : ''}`)
        );
        continue;
      }
      checkValue(file, node, tag, name, def, value, errors);
    }
    /* 必填：由推断出的变体决定，infer 的件不写 as 时也不放宽。
       target 认旧名 for（构建侧会映射），不然旧帧会被判缺 target。 */
    const present = (name) => {
      if (hasAttr(node, name) && attrOf(node, name) !== '') return true;
      return name === 'target' && hasAttr(node, 'for') && attrOf(node, 'for') !== '';
    };
    for (const [name, def] of Object.entries(spec)) {
      if (!def.required) continue;
      if (!present(name)) errors.push(err(file, node, tag, CODES.ATTR_REQUIRED, `<${tag}>${as ? ` as="${as}"` : ''} 缺 ${name}`, REQUIRED_FIX[name] || `补上 ${name}`));
    }
    /* span 只属于 flow 的直接子项。 */
    if (hasAttr(node, 'span') && FLOW_CHILD_TAGS.includes(tag) && parent !== 'vk-flow') {
      errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 的 span 只属于 <vk-flow> 的直接子项`, `父级是 <${parent || '无'}>；要跨栏，包一层 <vk-flow>`));
    }
    if (hasAttr(node, 'span') && FLOW_CHILD_TAGS.includes(tag) && parent === 'vk-flow') {
      const cols = attrOf(node.parentNode, 'cols') ?? '1';
      const span = Number(attrOf(node, 'span'));
      const total = /^\d+$/.test(cols) ? Number(cols) : cols === 'auto' ? 0 : cols.split(/\s+/).length;
      if (cols === 'auto') errors.push(err(file, node, tag, CODES.ATTR_IGNORED, `<${tag}> 的 span 在 cols="auto" 下不生效`, 'auto 按内容宽排，不需要 span'));
      else if (span > total) errors.push(err(file, node, tag, CODES.SPAN_TOO_WIDE, `<${tag}> 的 span="${span}" 超过父级 cols="${cols}"`, '改 span 或改 cols'));
    }
    /* img 的出血位置：x 只给 flow 子项，all 只给 page 第一层。 */
    if (tag === 'vk-img' && hasAttr(node, 'bleed')) {
      const bleed = attrOf(node, 'bleed');
      if (bleed === 'all' && parent !== 'vk-page') errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 的 bleed="all" 只能放在 <vk-page> 第一层`, '移到 page 下；要跟文字并排请用普通图片'));
      else if (bleed === 'x' && parent !== 'vk-flow') errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, `<${tag}> 的 bleed="x" 只属于 <vk-flow> 的直接子项`, '要么放进 flow，要么删掉 bleed'));
    }
    /* 标注：只有 note 显示文字；mark / arrow / measure / jump 里写句子会被静默丢掉。 */
    if (tag === 'vk-callout') {
      const body = textOf(node).trim();
      if (as === 'note' && !body) errors.push(err(file, node, tag, CODES.CHILD_MISSING, '<vk-callout as="note"> 没有一句话', '在标签里写这一句；只画标记用 as="mark"'));
      if (as !== 'note' && body)
        errors.push(err(file, node, tag, CODES.STRAY_TEXT, `<vk-callout as="${as}"> 里不显示文字「${body.slice(0, 18)}」`, '要说话就写 as="note"；只画标记就删掉文字'));
      if ((as === 'arrow' || as === 'measure') && attrOf(node, 'from') && attrOf(node, 'from') === attrOf(node, 'to'))
        errors.push(err(file, node, tag, CODES.TARGET_SELF, `<vk-callout as="${as}"> 的 from 和 to 是同一个锚点 ${attrOf(node, 'from')}`, '换一个终点，或改成 as="mark"'));
      /* 标注是覆盖层：只能挂在 page 或 flow 上，放进 card 会让正文不让出注栏。 */
      if (parent !== 'vk-page' && parent !== 'vk-flow')
        errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, '<vk-callout> 只能放在 <vk-page> 或 <vk-flow> 下', '把它移到 page 的第一层；标注是覆盖层，不参与卡片内部排布'));
    }
    /* 位置规则。 */
    if (tag === 'vk-page' && parent && parent !== '#document-fragment' && parent !== '#document' && parent !== 'body') {
      errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, '<vk-page> 不能嵌套', '一页一个 vk-page，并排写多个'));
    }
    if (tag === 'vk-page') {
      const notes = flatten(node).filter((n) => n.tagName === 'vk-callout' && asOfAbs(n) === 'note');
      if (notes.length > 1) errors.push(err(file, notes[1], tag, CODES.NOTE_MULTI, `这一帧有 ${notes.length} 条 note`, '注栏只有一列，会叠字；拆帧，或把其中一条改成 as="mark"'));
      const jumps = flatten(node).filter((n) => n.tagName === 'vk-callout' && asOfAbs(n) === 'jump');
      if (jumps.length > 3) errors.push(err(file, jumps[3], tag, CODES.JUMP_LIMIT, `这一帧有 ${jumps.length} 条 jump（最多 3 条）`, '跳转是强提示：一帧最多 3 条；其余改成 as="mark"，或拆帧'));
    }
    if (tag === 'vk-head') {
      if (parent !== 'vk-page') errors.push(err(file, node, tag, CODES.ATTR_PLACEMENT, '<vk-head> 只能直接放在 <vk-page> 下', '把它移到 page 的第一层；标题带不参与分栏'));
      else {
        const heads = kids(node.parentNode).filter((c) => c.tagName === 'vk-head');
        if (heads.length > 1 && heads[0] !== node) errors.push(err(file, node, tag, CODES.CHILD_KIND, '一帧只能有一个 <vk-head>', '把第二个标题并进第一个，或拆帧'));
      }
    }
    /* cells 的地址：没有 stride 就算不出第二格。 */
    if (tag === 'vk-board' && as === 'cells' && hasAttr(node, 'addr') && !hasAttr(node, 'stride')) {
      errors.push(err(file, node, tag, CODES.STRIDE_NEEDED, `<vk-board as="cells"> 写了 addr="${attrOf(node, 'addr')}" 却没有 stride`, '补 stride="4"（int 数组 4、char 1）；或删掉 addr，只显示值'));
    }
    /* band 的每一段都要有起止，且落在容器的域里。
       容器不写 start/end 时不猜域（域取 li 的 min/max）；attribute 缺失时 Number(null) 是 0，
       所以要先看属性有没有写。 */
    if (tag === 'vk-board' && as === 'band') {
      const cs = attrOf(node, 'start');
      const ce = attrOf(node, 'end');
      const hasDomain = cs != null && cs !== '' && ce != null && ce !== '';
      const d0 = Number(cs);
      const d1 = Number(ce);
      let i = 0;
      for (const li of kids(node).filter((c) => c.tagName === 'li')) {
        i++;
        const s = attrOf(li, 'start');
        const e = attrOf(li, 'end');
        if (s == null || s === '' || e == null || e === '')
          errors.push(err(file, li, tag, CODES.BAND_RANGE, `<vk-board as="band"> 的第 ${i} 条缺 ${s == null || s === '' ? 'start' : 'end'}`, '每条写 start="3" end="9"；数字，与容器的 start / end 同一单位'));
        else if (hasDomain && Number.isFinite(d0) && Number.isFinite(d1)) {
          const a = Number(s);
          const b = Number(e);
          if (Number.isFinite(a) && Number.isFinite(b) && (a < d0 || b > d1 || a > b))
            errors.push(
              err(
                file,
                li,
                tag,
                CODES.BAND_RANGE,
                `<vk-board as="band"> 的第 ${i} 条 start="${s}" end="${e}" 不在容器的 ${d0}–${d1} 里`,
                `收进容器的 start–end；要更宽的域就改容器的 start / end（现在是 ${d0}–${d1}）`
              )
            );
        }
      }
    }
    const id = attrOf(node, 'id');
    if (id) {
      if (!ID_OK.test(id)) errors.push(err(file, node, tag, CODES.ID_FORMAT, `id \`${id}\` 只能有字母、数字、下划线、短横线、汉字`, '出图文件名与锚点都用它；去掉空格、斜杠、@、冒号'));
      if (tag === 'vk-page') {
        if (pageIds.has(id)) errors.push(err(file, node, tag, CODES.ID_DUPLICATE, `帧 id \`${id}\` 重复了（上一处在第 ${pageIds.get(id)} 行）`, '给每一帧一个唯一 id；产物重名会加短 hash，但引用会分不清'));
        else pageIds.set(id, lineOf(node));
      } else {
        const key = `${pageOf(node)}:${id}`;
        if (elIds.has(key)) errors.push(err(file, node, tag, CODES.ID_DUPLICATE, `这一帧里 id \`${id}\` 重复了（上一处在第 ${elIds.get(key)} 行）`, '同一帧里 id 只能有一个；跨帧可以重名'));
        else elIds.set(key, lineOf(node));
      }
    }
    checkChildModel(file, node, tag, as, model.children, errors);
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
      if (['target', 'for', 'from', 'to'].includes(a.name) && String(a.value).startsWith('#')) {
        for (const one of String(a.value).trim().split(/\s+/)) {
          if (!one.startsWith('#')) continue;
          const id = one.slice(1).split('@')[0];
          const ids = idsByPage.get(pageOf(node)) || new Set();
          if (id && !ids.has(id)) errors.push(err(file, node, tag, CODES.ANCHOR_MISSING, `<${tag}> 的 ${a.name}="${one}" 指向 #${id}，但这一帧没有这个 id`, '改成这一帧里存在的 id，或给目标加 id'));
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
        if (seenNode.has(id)) errors.push(err(file, li, tag, CODES.ID_DUPLICATE, `<vk-graph> 的节点 id \`${id}\` 重复了`, '节点 id 是边的目标，重复会让边接到错的节点'));
        else seenNode.set(id, lineOf(li));
      }
      /* after 不能成环：树 / 链没有根就没法排。 */
      const adj = new Map(nodes.map((li) => [attrOf(li, 'id'), (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean)]));
      const mark = new Map();
      const path = [];
      const dfs = (id) => {
        const state = mark.get(id);
        if (state === 1) {
          errors.push(err(file, node, tag, CODES.GRAPH_CYCLE, `<vk-graph> 的 after 成环：${[...path, id].join(' → ')}`, '树 / 链不能成环；环用显式 from/to 边（as="mesh"）'));
          return;
        }
        if (state === 2) return;
        mark.set(id, 1);
        path.push(id);
        for (const p of adj.get(id) || []) if (adj.has(p)) dfs(p);
        path.pop();
        mark.set(id, 2);
      };
      for (const id of adj.keys()) if (id) dfs(id);
      for (const li of nodes) {
        const after = attrOf(li, 'after');
        if (!after) continue;
        const refs = after.split(/\s+/).filter(Boolean);
        if (hasAttr(li, 'edge') && refs.length > 1)
          errors.push(
            err(file, li, tag, CODES.EDGE_MULTI, `<vk-graph> 的 edge="${attrOf(li, 'edge')}" 配了多个 after（${after}）`, '一个标签只画一条边：拆成多个 <li>（每个一个 after），或删掉 edge')
          );
        for (const ref of refs) {
          if (ref === attrOf(li, 'id')) errors.push(err(file, li, tag, CODES.GRAPH_REF, `<vk-graph> 的节点 \`${ref}\` 指向自己`, '删掉这个 after'));
          else if (!nodeIds.has(ref)) errors.push(err(file, li, tag, CODES.GRAPH_REF, `<vk-graph> 的 after="${ref}" 找不到节点`, `这一张图里的节点 id：${[...nodeIds].join(', ') || '无'}`));
        }
      }
      for (const li of edges) {
        for (const key of ['from', 'to']) {
          const ref = attrOf(li, key);
          if (!ref) errors.push(err(file, li, tag, CODES.ATTR_REQUIRED, `<vk-graph> 的边缺 ${key}`, '边要写成 <li from="起点id" to="终点id">文字</li>'));
          else if (!nodeIds.has(ref)) errors.push(err(file, li, tag, CODES.GRAPH_REF, `<vk-graph> 的边 ${key}="${ref}" 找不到节点`, `这一张图里的节点 id：${[...nodeIds].join(', ') || '无'}`));
        }
        if (attrOf(li, 'from') && attrOf(li, 'from') === attrOf(li, 'to'))
          errors.push(err(file, li, tag, CODES.SELF_REF, '<vk-graph> 的边 from 和 to 是同一个节点', '换终点；自环请用 as="mesh" 的独立节点表达'));
      }
    }
    if (tag === 'vk-seq') {
      for (const li of kids(node).filter((c) => c.tagName === 'li')) {
        const f = attrOf(li, 'from');
        const t = attrOf(li, 'to');
        if (f && t && f === t) errors.push(err(file, li, tag, CODES.SELF_REF, '<vk-seq> 的消息 from 和 to 是同一条泳道', '改终点；时序自消息暂不支持，用 note 说明'));
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
  /* 同一 line + code 只留一条；再补上分级。 */
  return dedupe(errors)
    .map((e) => ({ ...e, family: familyOf(e.code), severity: severityOf(e.code), frame: pageAt(e.line) }))
    .sort((a, b) => a.line - b.line);
}

/* callout 的实际形状：写了 as 就是它，没写按锚点推断（NOTE_MULTI / JUMP_LIMIT 要数准）。 */
function asOfAbs(node) {
  const ids = variantIds(node);
  return ids && ids.length === 1 ? ids[0] : asOf(node);
}
