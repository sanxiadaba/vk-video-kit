/**
 * v19 · 契约
 * ----------------------------------------------------------------------------
 * 构建期校验与文档生成只有这一条路径，全部由 schema.mjs 驱动：
 *
 *   validate(tree, file)   作者写错了什么（一次报全，带 file:line 和改法）
 *   contract()             机器可读的完整契约（vk brief --json）
 *   markdown()             人/AI 读的契约表（生成到 out/CONTRACT.md）
 *
 * 规矩：这里不出现任何组件知识。要加一条校验，先在 schema 里加字段。
 */

import fs from 'node:fs';
import { TAGS, TAG_NAMES, attrsOf, LAYERS, ANCHOR_PARTS, SKELETON } from './schema.mjs';
import { GAP, FONT, LINE, MEASURE, FLOOR, INDEX_RULE, CANVAS, LINE_W, SYNTAX, PAINT } from './vocab.mjs';

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
  VALUE_MEASURE: 'VALUE_MEASURE',
  VALUE_LINES: 'VALUE_LINES',
  VALUE_SELECTOR: 'VALUE_SELECTOR',
  ATTR_REQUIRED: 'ATTR_REQUIRED',
  ATTR_IGNORED: 'ATTR_IGNORED',
  ATTR_PLACEMENT: 'ATTR_PLACEMENT',
  SPAN_TOO_WIDE: 'SPAN_TOO_WIDE',
  ID_DUPLICATE: 'ID_DUPLICATE',
  CHILD_KIND: 'CHILD_KIND',
  CHILD_MISSING: 'CHILD_MISSING',
  CURRENT_RANGE: 'CURRENT_RANGE',
  GRAPH_REF: 'GRAPH_REF',
  ANCHOR_MISSING: 'ANCHOR_MISSING',
  BLEED_ALL: 'BLEED_ALL',
  /* 构建期：内容来源与解析 */
  SRC_MISSING: 'SRC_MISSING',
  SRC_CONFLICT: 'SRC_CONFLICT',
  LINES_INVALID: 'LINES_INVALID',
  LINES_OUT_OF_RANGE: 'LINES_OUT_OF_RANGE',
  TREE_JSON: 'TREE_JSON',
  TREE_NODE: 'TREE_NODE',
  MATH: 'MATH',
  ICON: 'ICON',
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
const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const hasAttr = (node, name) => (node.attrs || []).some((a) => a.name === name);
const flatten = (node, out = []) => {
  out.push(node);
  for (const c of node.childNodes || []) flatten(c, out);
  return out;
};
const kidsOf = (node) => (node.childNodes || []).filter((c) => c.tagName);

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

const GLOBAL_ATTRS = new Set(['id', 'class', 'style', 'role', 'hidden']);

/* 行段："3" / "3-7" / "3,7,9" / "4-"（到底） */
export const parseLines = (value) => {
  const out = [];
  for (const piece of String(value ?? '').split(',')) {
    const tok = piece.trim();
    if (!tok) continue;
    const m = tok.match(/^(\d+)\s*(?:-\s*(\d+)?)?$/);
    if (!m) return null;
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]) || Infinity;
    if (from < 1 || to < from) return null;
    out.push([from, to]);
  }
  return out.length ? out : null;
};

/** 把一个行段展开成 1 起的行号集合（Infinity 用 limit 截）。 */
export const lineSet = (value, limit = 4000) => {
  const ranges = parseLines(value);
  if (!ranges) return null;
  const set = new Set();
  for (const [a, b] of ranges) for (let i = a; i <= Math.min(b, a + limit); i++) set.add(i);
  return set;
};

/* 列：1–12、比例 "7 5"、auto，或混排 "auto 1"（先按内容、剩下的按比例分）。 */
const COLS_OK = /^((auto|[1-9]\d*)(\s+(auto|[1-9]\d*))*)$/;

export function checkValue(file, node, tag, name, spec, value, errors) {
  const where = `<${tag}>`;
  const bad = (code, message, fix) => errors.push({ file, line: lineOf(node), tag, code, message: `${where} 的 ${name}="${value}" ${message}`, fix });

  if (spec.values && !spec.values.includes(value)) bad(CODES.VALUE_ENUM, '不在词表里', `可用：${spec.values.join(' / ')}`);

  if (spec.type === 'bool' && value !== '' && value !== 'true') bad(CODES.VALUE_BOOL, '是开关，只写属性名就行', `删掉 ="${value}"`);

  if (spec.type === 'int' || spec.type === 'index' || spec.type === 'num' || spec.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) bad(CODES.VALUE_NUMBER, '不是数字', '写一个数');
    else {
      if (spec.type !== 'num' && spec.type !== 'number' && !Number.isInteger(n)) bad(CODES.VALUE_NUMBER, '要整数', '写整数');
      if (spec.min !== undefined && n < spec.min) bad(CODES.VALUE_RANGE, `小于下限 ${spec.min}`, `改成 ≥ ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) bad(CODES.VALUE_RANGE, `大于上限 ${spec.max}`, `改成 ≤ ${spec.max}；要更多就拆件/拆帧`);
    }
  }

  if (spec.type === 'space' && !(value in GAP) && !/^\d+(\.\d+)?(px)?$/.test(value))
    bad(CODES.VALUE_SPACE, '不是间距', `可用：${Object.keys(GAP).join(' / ')}，或像素数如 "48"`);

  if (spec.type === 'measure' && value !== 'none' && (!/^\d+$/.test(value) || Number(value) < 4 || Number(value) > 60))
    bad(CODES.VALUE_MEASURE, '不是行宽', '写 none 或 4–60 的整数（一行几个字）');

  if (spec.type === 'lines' && value !== '' && !parseLines(value))
    bad(CODES.VALUE_LINES, '不是行段', '写法："3" / "3-7" / "3,7,9" / "4-"；行号按窗口里第几行算，1 起');

  if (spec.type === 'cols' && !COLS_OK.test(value)) bad(CODES.VALUE_ENUM, '不是列数', '写 1–12 的整数、比例（如 "1 2 1"）或 auto');

  if (spec.type === 'selector' && value !== '') {
    if (!value.startsWith('#') || value.includes('@')) {
      const at = value.indexOf('@');
      if (!value.startsWith('#') || at < 2) bad(CODES.VALUE_SELECTOR, '写法不对', '写 CSS 选择器，或 #id@line:5 / #id@item:3 / #id@bit:5 / #id@side:left');
      else {
        const [part, ...args] = value.slice(at + 1).split(':');
        if (!ANCHOR_PARTS.includes(part)) bad(CODES.VALUE_SELECTOR, `里的 @${part} 不认识`, `可用：${ANCHOR_PARTS.join(' / ')}`);
        else if (part === 'side' && !['top', 'right', 'bottom', 'left'].includes((args[0] || '').trim()))
          bad(CODES.VALUE_SELECTOR, '里的 side 不认识', '可用：top / right / bottom / left');
        else if ((part === 'line' || part === 'item' || part === 'bit') && !/^\d+$/.test((args[0] || '').trim()))
          bad(CODES.VALUE_SELECTOR, `里的 ${part}:… 要一个 1 起的整数`, '如 #c@line:3 / #buf@item:2');
        else if (value.slice(0, at).length < 2) bad(CODES.VALUE_SELECTOR, '缺少 id', '#id@part:arg');
      }
    } else if (value === '#') bad(CODES.VALUE_SELECTOR, '缺少 id', '#id');
  }
}

/* ------------------------------------------------------------------ 子节点 */
function checkChildModel(file, node, tag, errors) {
  const model = TAGS[tag].children;
  if (!model) return;
  const kids = kidsOf(node);
  const vkKids = kids.filter((c) => c.tagName.startsWith('vk-'));

  if (model.kind === 'item') {
    const bad = kids.filter((c) => c.tagName !== 'li');
    if (bad.length) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 的条目要写成 <li>，而不是 <${bad[0].tagName}>`, fix: `把 <${bad[0].tagName}> 换成 <li>` });
    if (!kids.some((c) => c.tagName === 'li')) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 还没有条目`, fix: '每一条写成 <li>' });
    for (const li of kids.filter((c) => c.tagName === 'li')) {
      for (const { name, value } of li.attrs || []) {
        if (GLOBAL_ATTRS.has(name) || name.startsWith('data-') || name.startsWith('aria-')) continue;
        const spec = model.attrs?.[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(model.attrs || {}));
          errors.push({ file, line: lineOf(li), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 的 <li> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${Object.keys(model.attrs || {}).join(', ') || '无'}` });
          continue;
        }
        checkValue(file, li, `${tag} <li>`, name, spec, value, errors);
      }
    }
    const cur = attrOf(node, 'current');
    if (cur != null && /^\d+$/.test(cur)) {
      const n = Number(cur);
      const count =
        tag === 'vk-graph'
          ? kids.filter((c) => c.tagName === 'li' && !hasAttr(c, 'from') && !hasAttr(c, 'to')).length
          : kids.filter((c) => c.tagName === 'li').length;
      if (n < 1 || n > count) errors.push({ file, line: lineOf(node), tag, code: CODES.CURRENT_RANGE, message: `<${tag}> 的 current="${cur}" 越界（这一件有 ${count} 项）`, fix: `改成 1–${count}；不写就是没有当前` });
    }
  }

  if (model.kind === 'table') {
    const table = kids.find((c) => c.tagName === 'table');
    if (!table) {
      errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 里要有原生 <table>`, fix: '写 <table><tr><th>…</th></tr>…</table>' });
      return;
    }
    for (const tr of flatten(table).filter((n) => n.tagName === 'tr')) {
      for (const { name, value } of tr.attrs || []) {
        if (name === 'tone' && !['ok', 'warn', 'err'].includes(value)) errors.push({ file, line: lineOf(tr), tag, code: CODES.VALUE_ENUM, message: `<tr> 的 tone="${value}" 不在词表里`, fix: '可用：ok / warn / err' });
        else if (name === 'state' && value !== 'current') errors.push({ file, line: lineOf(tr), tag, code: CODES.VALUE_ENUM, message: `<tr> 的 state="${value}" 不在词表里`, fix: '可用：current' });
        else if (!['tone', 'state'].includes(name)) errors.push({ file, line: lineOf(tr), tag, code: CODES.UNKNOWN_ATTR, message: `<tr> 不认识属性 ${name}="${value}"`, fix: `可用：tone / state` });
      }
      for (const cell of flatten(tr).filter((n) => n.tagName === 'td')) {
        for (const { name, value } of cell.attrs || []) {
          if (name === 'state' && value !== 'current') errors.push({ file, line: lineOf(cell), tag, code: CODES.VALUE_ENUM, message: `<td> 的 state="${value}" 不在词表里`, fix: '可用：current' });
          else if (name === 'tone' && !['ok', 'warn', 'err'].includes(value)) errors.push({ file, line: lineOf(cell), tag, code: CODES.VALUE_ENUM, message: `<td> 的 tone="${value}" 不在词表里`, fix: '可用：ok / warn / err' });
          else if (!['tone', 'state', 'colspan', 'rowspan'].includes(name)) errors.push({ file, line: lineOf(cell), tag, code: CODES.UNKNOWN_ATTR, message: `<td> 不认识属性 ${name}="${value}"`, fix: `可用：tone / state` });
        }
      }
    }
  }

  if (model.kind === 'source') {
    const has = attrOf(node, 'src') != null || kids.some((c) => c.tagName === 'script' && c.attrs?.some((a) => a.name.startsWith('data-vk-')));
    if (!has) errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_MISSING, message: `<${tag}> 没有内容`, fix: TAGS[tag].children.hint });
  }

  if (model.kind === 'none' && vkKids.length) {
    errors.push({ file, line: lineOf(node), tag, code: CODES.CHILD_KIND, message: `<${tag}> 里不能再放 <${vkKids[0].tagName}>`, fix: '文字直接写在标签里；要分块就包一层 <vk-flow>' });
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
    const inFlow = parent === 'vk-flow' || parent === 'vk-page';

    for (const { name, value } of node.attrs || []) {
      if (name === 'style') {
        const bad = String(value).match(/(?:^|;)\s*(font-size|line-height|color|font-family|font-weight|letter-spacing|gap|padding|width|height)\s*:/i);
        if (bad) errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 style 里写了 ${bad[1]}`, fix: '排版只走 size / ink / weight / align / gap，不要手写' });
        continue;
      }
      if (GLOBAL_ATTRS.has(name) || name.startsWith('data-') || name.startsWith('aria-')) continue;
      const def = spec[name];
      if (!def) {
        const pool = Object.keys(spec);
        const hint = suggest(name, pool);
        errors.push({ file, line: lineOf(node), tag, code: CODES.UNKNOWN_ATTR, message: `<${tag}> 不认识属性 ${name}="${value}"`, fix: hint ? `是想写 ${hint}？` : `可用：${pool.join(', ')}` });
        continue;
      }
      checkValue(file, node, tag, name, def, value, errors);
      if (def.when) {
        const actual = attrOf(node, def.when.attr) ?? spec[def.when.attr]?.default ?? '';
        if (actual && !def.when.values.includes(actual))
          errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_IGNORED, message: `<${tag}> 的 ${name} 只在 ${def.when.attr}="${def.when.values.join('|')}" 时有用`, fix: `现在的 ${def.when.attr} 是 "${actual}"，这个属性不会生效` });
      }
    }

    /* 必填：callout 的 for / from / to 按形态必填。 */
    const mode = attrOf(node, 'mode') ?? spec.mode?.default;
    for (const [name, def] of Object.entries(spec)) {
      if (!def.required) continue;
      if (def.when && !def.when.values.includes(mode)) continue;
      if (!hasAttr(node, name)) errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_REQUIRED, message: `<${tag}> 缺 ${name}`, fix: name === 'for' ? '写 for="#目标id"，或 for="#目标id@line:3"' : '写 #目标id，两端都要有 id' });
    }

    /* 位置规则：span / bleed 只属于 flow 的子项。 */
    if (hasAttr(node, 'span') && parent !== 'vk-flow')
      errors.push({ file, line: lineOf(node), tag, code: CODES.ATTR_PLACEMENT, message: `<${tag}> 的 span / bleed 只属于 <vk-flow> 或 <vk-page> 的直接子项`, fix: `父级是 <${parent || '无'}>；包一层 <vk-flow>` });
    if (hasAttr(node, 'bleed') && attrOf(node, 'bleed') === 'all' && tag !== 'vk-img')
      errors.push({ file, line: lineOf(node), tag, code: CODES.BLEED_ALL, message: `<${tag}> 不能用 bleed="all"`, fix: '整帧铺满只给 <vk-img>；其他件用 bleed="x"' });
    if (hasAttr(node, 'span') && parent === 'vk-flow') {
      const cols = attrOf(node.parentNode, 'cols') ?? '1';
      if (/^\d+$/.test(cols) && Number(attrOf(node, 'span') || 1) > Number(cols))
        errors.push({ file, line: lineOf(node), tag, code: CODES.SPAN_TOO_WIDE, message: `<${tag}> 的 span="${attrOf(node, 'span')}" 超过父级 cols="${cols}"`, fix: '改 span 或改 cols' });
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

  /* 关系：锚点 #id 与 graph 的 after 都必须指向本页存在的 id。 */
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
      const lis = kidsOf(node).filter((c) => c.tagName === 'li');
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
          if (!ref) errors.push({ file, line: lineOf(li), tag, code: CODES.ATTR_REQUIRED, message: `<vk-graph> 的边缺 ${key}`, fix: '边要写成 <li from="起点id" to="终点id">' });
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
  number: '数字',
  bool: '开关',
  index: '序号',
  lines: '行段',
  space: '间距',
  measure: '行宽',
  selector: '锚点',
  cols: '列',
};

const fmtAttr = (name, spec) => {
  const values = spec.values ? spec.values.join(' / ') : TYPE_LABEL[spec.type] || spec.type;
  const def = spec.default === undefined ? '—' : String(spec.default);
  const range = spec.min !== undefined && spec.max !== undefined ? `${spec.min}–${spec.max}` : '';
  const when = spec.when ? `只对 ${spec.when.attr}=${spec.when.values.join('|')}` : '';
  return { name, values, def, range, label: [spec.label || '', when].filter(Boolean).join('；') };
};

/** 机器可读契约：vk brief --json 的输出，也是 CONTRACT.md 的数据源。 */
export function contract() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, safeX: CANVAS.safeX, safeY: CANVAS.safeY },
    floor: FLOOR,
    indexRule: INDEX_RULE,
    anchorParts: ANCHOR_PARTS,
    codes: Object.keys(CODES),
    space: GAP,
    lineWidth: LINE_W,
    type: Object.fromEntries(Object.entries(FONT).map(([k, v]) => [k, v])),
    colors: { focus: PAINT.focus, inks: [PAINT.ink1, PAINT.ink2, PAINT.ink3], syntax: SYNTAX },
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
            capacity: t.capacity || null,
            content: t.content || (t.children?.kind === 'source' ? 'source' : t.children?.kind === 'item' ? 'item' : t.children?.kind === 'table' ? 'table' : 'slot'),
            children: t.children || null,
            attrs: attrsOf(tag),
          },
        ];
      })
    ),
  };
}

/** 人/AI 读的契约表。生成物，写到 out/，不入库。 */
export function markdown() {
  const c = contract();
  const out = [];
  out.push(`# vk 契约 ${c.version}（生成物，不要手改）`, '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.w - c.canvas.safeX * 2}×${c.canvas.h - c.canvas.safeY * 2}。观众在手机横屏看，实际约 780 宽（0.406×）。`);
  out.push(`自动缩小的地板 **${c.floor}px**（手机 17.9px）。索引一律 ${c.indexRule}。`, '');

  out.push('## 字号', '');
  out.push('| 档 | px | 手机 | 行高 | 行宽（字） |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(FONT)) out.push(`| ${k} | ${v} | ${(v * 0.406).toFixed(1)} | ${LINE[k]} | ${MEASURE[k]} |`);

  out.push('', '## 间距', '');
  out.push(`档名：${Object.entries(GAP).map(([k, v]) => `${k}=${v}`).join(' / ')}；也可以写像素数（gap="48"）。`);

  out.push('', '## 一帧的容量', '');
  out.push('| 组件 | 一帧最多 |', '|---|---|');
  for (const tag of TAG_NAMES) {
    const t = TAGS[tag];
    if (!t.capacity) continue;
    const by = t.capacity.by ? Object.entries(t.capacity.by).map(([k, v]) => `${k} ${v}`).join(' / ') : '';
    out.push(`| \`${tag}\` | ${t.capacity.max} ${t.capacity.unit}${by ? `（${by}）` : ''} |`);
  }

  out.push('', '## 标签', '');
  for (const layer of LAYERS) {
    out.push(`### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      if (t.capacity) {
        const by = t.capacity.by ? `（${Object.entries(t.capacity.by).map(([k, v]) => `${k} ${v}`).join(' / ')}）` : '';
        out.push(`  一帧容量：${t.capacity.max} ${t.capacity.unit}${by}。`);
      }
      const rows = Object.entries(t.attrs).map(([n, s]) => fmtAttr(n, s));
      if (rows.length) {
        out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
        for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
      }
      if (t.children?.hint) out.push('', t.children.hint);
      if (t.children?.attrs && Object.keys(t.children.attrs).length) {
        out.push('', '子项属性：');
        const crows = Object.entries(t.children.attrs).map(([n, s]) => fmtAttr(n, s));
        out.push('', '| 子项属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
        for (const r of crows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
      }
      if (t.example) out.push('', '```html', t.example, '```');
      out.push('');
    }
  }
  return out.join('\n');
}
