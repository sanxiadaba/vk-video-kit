/**
 * v18 · 契约
 * ----------------------------------------------------------------------------
 * 构建期校验与文档生成只有这一条路径，全部由 schema.mjs 驱动：
 *
 *   validate(tree, file)   作者写错了什么（一次报全，带 file:line 和改法）
 *   contract()             机器可读的完整契约（vk brief --json）
 *   markdown()             人/AI 读的契约表（docs/CONTRACT.md，生成，不手写）
 *
 * 规矩：这里不出现任何组件知识。要加一条校验，先在 schema 里加字段。
 */

import { TAGS, TAG_NAMES, attrsOf, COMMON, CANVAS_ATTRS, LAYERS } from './schema.mjs';
import { GAP, CAPACITY, FONT, FONT_FLOOR, INDEX_RULE } from './vocab.mjs';

/* ------------------------------------------------------------------ 工具 */
const lineOf = (node) => node.sourceCodeLocation?.startLine || 1;
const attrOf = (node, name) => (node.attrs || []).find((a) => a.name === name)?.value ?? null;
const flatten = (node, out = []) => {
  out.push(node);
  for (const c of node.childNodes || []) flatten(c, out);
  return out;
};
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

const CSS_ID = /^#[A-Za-z_][-\w]*$/;
const ANCHOR_PARTS = ['line', 'word', 'cell', 'byte', 'bit', 'addr', 'step', 'event', 'lane', 'node', 'point', 'side', 'region'];

/* ------------------------------------------------------------------ 校验 */

/** 一条错误：{ file, line, tag, code, message, fix }。 */
const err = (file, node, message, fix) => ({ file, line: lineOf(node), tag: node.tagName, code: message.slice(0, 24), message, fix });

export function checkValue(file, node, tag, name, spec, value, errors) {
  const where = `<${tag}>`;
  if (spec.values && !spec.values.includes(value)) {
    errors.push(err(file, node, `${where} 的 ${name}="${value}" 不在词表里`, `可用：${spec.values.join(' / ')}`));
  }
  if (spec.type === 'bool' && value !== '' && value !== 'true') {
    errors.push(err(file, node, `${where} 的 ${name} 是开关，只写 ${name} 就行`, `删掉 ="${value}"`));
  }
  if ((spec.type === 'int' || spec.type === 'index' || spec.type === 'num') && value !== '') {
    const n = Number(value);
    if (!Number.isFinite(n)) errors.push(err(file, node, `${where} 的 ${name}="${value}" 不是数字`, '写一个数'));
    else {
      if (spec.type !== 'num' && !Number.isInteger(n)) errors.push(err(file, node, `${where} 的 ${name}="${value}" 要整数`, '写整数'));
      if (spec.min !== undefined && n < spec.min) errors.push(err(file, node, `${where} 的 ${name}="${value}" 小于下限 ${spec.min}`, `改成 ≥ ${spec.min}`));
      if (spec.max !== undefined && n > spec.max) errors.push(err(file, node, `${where} 的 ${name}="${value}" 大于上限 ${spec.max}`, `改成 ≤ ${spec.max}；要更多就拆件/拆帧`));
    }
  }
  if (spec.type === 'space' && !(value in GAP) && !/^\d+(\.\d+)?(px)?$/.test(value)) {
    errors.push(err(file, node, `${where} 的 ${name}="${value}" 不是间距`, `可用：${Object.keys(GAP).join(' / ')}，或像素数如 "48"`));
  }
  if (spec.type === 'measure' && value !== 'none' && !/^\d+$/.test(value)) {
    errors.push(err(file, node, `${where} 的 measure="${value}" 不是行宽`, '写 none 或 4–60 的整数（一行几个字）'));
  }
  if (spec.type === 'measure' && /^\d+$/.test(value) && (Number(value) < 4 || Number(value) > 60)) {
    errors.push(err(file, node, `${where} 的 measure="${value}" 超出 4–60`, '写 4–60 的整数'));
  }
  if (spec.type === 'lines' && value !== '') {
    const ok = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .every((tok) => /^\d+(\s*-\s*\d*)?$/.test(tok));
    if (!ok) errors.push(err(file, node, `${where} 的 ${name}="${value}" 不是行段`, '写法："3" / "3-7" / "3,7,9" / "4-"；行号按源文件算，1 起'));
  }
  if (spec.type === 'selector' && value !== '' && value.includes('@')) {
    const at = value.indexOf('@');
    if (!value.startsWith('#') || at < 2) {
      errors.push(err(file, node, `${where} 的 ${name}="${value}" 锚点写法不对`, '写 CSS 选择器，或 #id@part:arg（如 #c@line:5）'));
    } else {
      const part = value.slice(at + 1).split(':')[0];
      if (!ANCHOR_PARTS.includes(part)) {
        errors.push(err(file, node, `${where} 的 ${name}="${value}" 里的 @${part} 不认识`, `可用的 part：${ANCHOR_PARTS.join(' / ')}`));
      }
    }
  }
  if (spec.type === 'selector' && value !== '' && value.startsWith('#') && !value.includes('@') && !CSS_ID.test(value)) {
    errors.push(err(file, node, `${where} 的 ${name}="${value}" 不是合法 id 选择器`, 'id 只能含字母、数字、下划线、连字符'));
  }
}

function checkChildModel(file, node, tag, children, errors) {
  const kids = (children || []).filter((c) => c.tagName && c.tagName !== 'script');
  const model = TAGS[tag].children;
  if (!model) return;
  if (model.kind === 'item') {
    const bad = kids.filter((c) => c.tagName !== 'li');
    if (bad.length) errors.push(err(file, node, `<${tag}> 的条目要写成 <li>，而不是 <${bad[0].tagName}>`, `把 <${bad[0].tagName}> 换成 <li>`));
    if (!kids.some((c) => c.tagName === 'li')) errors.push(err(file, node, `<${tag}> 还没有条目`, '每一条写成 <li>'));
    for (const li of kids.filter((c) => c.tagName === 'li')) {
      for (const { name, value } of li.attrs || []) {
        if (name.startsWith('data-') || name.startsWith('aria-') || ['id', 'class'].includes(name)) continue;
        const spec = model.attrs?.[name];
        if (!spec) {
          const hint = suggest(name, Object.keys(model.attrs || {}));
          errors.push(
            err(file, li, `<${tag}> 的 <li> 不认识属性 ${name}="${value}"`, hint ? `是想写 ${hint}？` : `可用：${Object.keys(model.attrs || {}).join(', ') || '无'}`)
          );
          continue;
        }
        checkValue(file, li, `${tag} <li>`, name, spec, value, errors);
      }
    }
  }
  if (model.kind === 'table' && !kids.some((c) => c.tagName === 'table')) {
    errors.push(err(file, node, `<${tag}> 里要有原生 <table>`, '写 <table><tr><th>…</th></tr>…</table>'));
  }
  if (model.kind === 'slot' && model.exactly !== undefined && kids.length !== model.exactly) {
    errors.push(err(file, node, `<${tag}> 需要正好 ${model.exactly} 个子项（现在 ${kids.length} 个）`, '两块并置就写两个子项'));
  }
  if (model.kind === 'source') {
    const has = attrOf(node, 'src') != null || (children || []).some((c) => c.tagName === 'script' && (c.attrs || []).some((a) => a.name.startsWith('data-vk-')));
    if (!has) errors.push(err(file, node, `<${tag}> 没有内容`, TAGS[tag].children.hint || '写 src="文件" 或内联 <script type="text/plain" data-vk-source>'));
  }
}

/** 全量校验：一次报全，按标签 + 属性逐条查。 */
export function validate(tree, file = '<page>') {
  const errors = [];
  const all = flatten(tree);
  const ids = new Map();

  for (const node of all) {
    const tag = node.tagName;
    if (!tag?.startsWith('vk-')) continue;
    if (!TAGS[tag]) {
      const hint = suggest(tag, TAG_NAMES);
      errors.push(err(file, node, `未知标签 <${tag}>`, hint ? `是想写 <${hint}>？` : `可用：${TAG_NAMES.join(', ')}`));
      continue;
    }
    const spec = attrsOf(tag);
    const parent = node.parentNode?.tagName;

    for (const { name, value } of node.attrs || []) {
      if (name === 'style') {
        const bad = String(value).match(/(?:^|;)\s*(font-size|line-height|color|font-family|font-weight|letter-spacing)\s*:/i);
        if (bad) errors.push(err(file, node, `<${tag}> 的 style 里写了 ${bad[1]}`, '排版只走 size / ink / weight / align，不要手写'));
        continue;
      }
      if (name.startsWith('data-') || name.startsWith('aria-') || ['id', 'class', 'title', 'role', 'hidden'].includes(name)) continue;
      const def = spec[name] || (parent === 'vk-canvas' ? CANVAS_ATTRS[name] : null);
      if (!def) {
        const pool = Object.keys(spec);
        const hint = suggest(name, pool);
        errors.push(err(file, node, `<${tag}> 不认识属性 ${name}="${value}"`, hint ? `是想写 ${hint}？` : `可用：${pool.join(', ')}`));
        continue;
      }
      checkValue(file, node, tag, name, def, value, errors);
      if (def.when) {
        const actual = attrOf(node, def.when.attr) ?? spec[def.when.attr]?.default ?? '';
        if (actual && !def.when.values.includes(actual)) {
          errors.push(err(file, node, `<${tag}> 的 ${name} 只在 ${def.when.attr}="${def.when.values.join('|')}" 时有用`, `现在的 ${def.when.attr} 是 "${actual}"，这个属性不会生效`));
        }
      }
    }

    /* 位置规则：span 只属于 grid 子项，x/y 只属于 canvas 子项。 */
    const has = (n) => node.attrs?.some((a) => a.name === n);
    if (has('span') || has('row-span')) {
      if (parent !== 'vk-grid') {
        errors.push(err(file, node, `<${tag}> 的 span / row-span 只属于 <vk-grid> 的直接子项`, `父级是 <${parent || '无'}>；改用 gap 或包一层 vk-grid`));
      } else {
        const cols = Number(attrOf(node.parentNode, 'cols') || 2);
        const span = Number(attrOf(node, 'span') || 1);
        if (span > cols) errors.push(err(file, node, `<${tag}> 的 span="${span}" 超过父级 cols="${cols}"`, '改 span 或改 cols：超出的会被挤到下一行'));
      }
    }
    if (['x', 'y', 'w', 'h', 'z'].some(has) && parent !== 'vk-canvas' && tag !== 'vk-canvas') {
      errors.push(err(file, node, `<${tag}> 的 x / y / w / h / z 只在 <vk-canvas> 的子项上成立`, `父级是 <${parent || '无'}>`));
    }

    const id = attrOf(node, 'id');
    if (id) {
      const scope = tag === 'vk-page' ? 'page' : 'el';
      const key = `${scope}:${id}`;
      if (ids.has(key)) {
        errors.push(err(file, node, `${scope === 'page' ? '帧 id' : 'id'} \`${id}\` 重复了（上一处在第 ${ids.get(key)} 行）`, '出图会互相覆盖，锚点也只会指到第一个'));
      } else ids.set(key, lineOf(node));
    }

    checkChildModel(file, node, tag, node.childNodes, errors);
  }
  return errors.sort((a, b) => a.line - b.line);
}

/* ------------------------------------------------------------------ 文档 */

const TYPE_LABEL = { text: '文本', enum: '枚举', int: '整数', num: '数字', bool: '开关', index: '序号', lines: '行段', space: '间距', measure: '行宽', selector: '锚点', list: '序列' };

const fmtAttr = (name, spec) => {
  const values = spec.values ? spec.values.join(' / ') : TYPE_LABEL[spec.type] || spec.type;
  const def = spec.default === undefined ? '—' : String(spec.default);
  const range = spec.min !== undefined && spec.max !== undefined ? `${spec.min}–${spec.max}` : '';
  return { name, values, def, range, label: spec.label || '' };
};

/** 机器可读契约：vk brief --json 的输出，也是 CONTRACT.md 的数据源。 */
export function contract() {
  return {
    canvas: { w: 1920, h: 1080, safeX: 120, safeY: 96 },
    fontFloor: FONT_FLOOR,
    indexRule: INDEX_RULE,
    capacity: CAPACITY,
    type: FONT,
    layers: LAYERS,
    tags: Object.fromEntries(
      TAG_NAMES.map((tag) => {
        const t = TAGS[tag];
        return [
          tag,
          {
            name: t.name,
            layer: t.layer,
            summary: t.summary,
            capacity: t.capacity || null,
            content: t.content || (t.children?.kind === 'source' ? 'source' : t.children?.kind === 'item' ? 'item' : t.children?.kind === 'table' ? 'table' : 'slot'),
            children: t.children || null,
            attrs: Object.fromEntries(Object.entries(attrsOf(tag)).map(([n, s]) => [n, { ...s, type: s.type }])),
          },
        ];
      })
    ),
  };
}

/** 人/AI 读的契约表。生成物，不手改。 */
export function markdown() {
  const c = contract();
  const out = [];
  out.push('# vk 契约（生成物，不要手改）', '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.w - c.canvas.safeX * 2}×${c.canvas.h - c.canvas.safeY * 2}。观众在手机横屏看，实际约 780 宽（0.406×）。`);
  out.push(`最小可读字号 **${c.fontFloor}px**（手机 17.9px）。索引一律 ${c.indexRule}。`, '');
  out.push('## 一帧的容量', '');
  const CAP = {
    rows: '行级单元（合计）',
    code: '代码行',
    term: '终端行',
    diff: 'diff 行',
    asm: '汇编行',
    table: '表格数据行',
    tree: '文件树行',
    cells: '内存格行',
    bits: '位',
    steps: '步骤（横排）',
    bars: '横条',
    timeline: '时间线点',
  };
  out.push('| 项 | 一帧最多 |', '|---|---|');
  Object.entries(c.capacity).forEach(([k, v]) => out.push(`| ${CAP[k] || k} | ${v} |`));
  out.push('', '## 字号', '');
  out.push('| 档 | px | 手机 | 用在哪 |', '|---|---|---|---|');
  const use = { caption: '元信息（来源、单位、编号）', body: '正文与数据（地板）', subhead: '一句话的主张', headline: '一帧的标题', display: '一页最多一次', hero: '一个数字 / 一个词' };
  for (const [k, v] of Object.entries(c.type)) out.push(`| ${k} | ${v} | ${(v * 0.406).toFixed(1)} | ${use[k] || ''} |`);
  out.push('', '## 标签', '');
  for (const layer of LAYERS) {
    out.push(`### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      if (t.capacity) out.push(`  一帧容量：${t.capacity.max} ${t.capacity.unit}。`);
      const rows = Object.entries(t.attrs).map(([n, s]) => fmtAttr(n, s));
      if (rows.length) {
        out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
        for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
      }
      if (t.children?.hint) out.push('', t.children.hint);
      out.push('');
    }
  }
  return out.join('\n');
}


