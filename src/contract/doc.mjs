/**
 * v26 · 契约文档
 * ----------------------------------------------------------------------------
 * 三个出口，同一份 schema：
 *   vk brief            给 AI 的紧凑契约（默认，--json / --md）
 *   vk brief --full     实现者全量（含颜色/字号/线宽）
 *   vk doc <tag>        单件下钻，含子项属性
 */
import { TAGS, TAG_NAMES, attrsOf, childrenOf, LAYERS, ANCHOR_PARTS, SKELETON, RULES, FLOW_CHILD, FLOW_CHILD_TAGS, AUTHOR_GLOBALS, CAPACITY } from '../schema.mjs';
import { GAP, FONT, LINE, MEASURE, INDEX_RULE, CANVAS, CONTENT, LINE_W, SYNTAX, PAINT, THEME, CARD_SURFACE } from '../vocab.mjs';
import { CODES, CODES_INFO, VERSION } from './validate.mjs';

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

const contentOf = (children) =>
  children?.kind === 'source' ? 'source' : children?.kind === 'items' ? 'item' : children?.kind === 'table' ? 'table' : children?.kind === 'inline' ? 'text' : 'slot';

const childrenOut = (children) => {
  if (!children) return null;
  const { kind, hint, attrs, cellAttrs } = children;
  return { kind, hint, ...(attrs ? { attrs } : {}), ...(cellAttrs ? { cellAttrs } : {}) };
};

/** 机器可读契约（全量）：工具与实现者用。 */
export function contract() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, marginX: CANVAS.marginX, marginY: CANVAS.marginY, content: CONTENT },
    phone: { width: 693, ratio: 693 / CANVAS.w },
    indexRule: INDEX_RULE,
    theme: THEME,
    surface: CARD_SURFACE,
    flowChild: FLOW_CHILD,
    flowChildTags: FLOW_CHILD_TAGS,
    rules: RULES,
    global: AUTHOR_GLOBALS,
    anchorParts: ANCHOR_PARTS,
    anchors: '#id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left',
    capacity: CAPACITY,
    codes: Object.fromEntries(Object.keys(CODES).map((k) => [k, CODES_INFO[k] ? { when: CODES_INFO[k][0], fix: CODES_INFO[k][1] } : null])),
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
        const variants = t.variants
          ? Object.fromEntries(
              Object.entries(t.variants).map(([id, v]) => [
                id,
                { label: v.label, summary: v.summary, attrs: attrsOf(tag, id), children: childrenOut(v.children), content: contentOf(v.children), example: v.example || null },
              ])
            )
          : null;
        return [
          tag,
          {
            name: t.name,
            layer: t.layer,
            summary: t.summary,
            example: t.example || null,
            content: contentOf(childrenOf(tag, null)),
            children: childrenOut(t.children),
            attrs: t.attrs,
            variants,
          },
        ];
      })
    ),
  };
}

/** 紧凑契约（AI 默认入口）：去重、去颜色、只留作者面与拆帧预算。 */
export function compact() {
  const full = contract();
  const tags = {};
  for (const tag of TAG_NAMES) {
    const t = full.tags[tag];
    const own = t.attrs || {};
    const variants = t.variants
      ? Object.fromEntries(
          Object.entries(t.variants).map(([as, v]) => {
            const delta = Object.fromEntries(Object.entries(v.attrs || {}).filter(([k, spec]) => JSON.stringify(own[k]) !== JSON.stringify(spec)));
            return [as, { label: v.label, summary: v.summary, ...(Object.keys(delta).length ? { attrs: delta } : {}), children: v.children, example: v.example }];
          })
        )
      : null;
    tags[tag] = { name: t.name, layer: t.layer, summary: t.summary, attrs: own, children: t.children, example: t.example, ...(variants ? { variants } : {}) };
  }
  return {
    version: full.version,
    canvas: full.canvas,
    phone: full.phone,
    indexRule: full.indexRule,
    rules: full.rules,
    global: full.global,
    anchors: full.anchors,
    flowChild: full.flowChild,
    capacity: full.capacity,
    skeleton: full.skeleton,
    tags,
    codes: full.codes,
  };
}

/* 一个变体的小节。 */
function variantBlock(out, tag, as, label, summary, attrs, children, example) {
  out.push(`#### ${label}${as ? ` · as="${as}"` : ''} —— ${summary}`);
  const rows = Object.entries(attrs || {}).map(([n, s]) => fmtAttr(n, s));
  if (rows.length) {
    out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
    for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
  }
  if (children?.hint) out.push('', children.hint);
  const childRows = [...Object.entries(children?.attrs || {}), ...Object.entries(children?.cellAttrs || {}).map(([n, s]) => [`td.${n}`, s])];
  if (childRows.length) {
    out.push('', '子项属性：', '', '| 子项属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
    for (const [n, s] of childRows) {
      const r = fmtAttr(n, s);
      out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
    }
  }
  if (example) out.push('', '```html', example, '```');
  out.push('');
}

/** 人/AI 读的紧凑契约：vk brief --md。 */
export function markdown() {
  const c = compact();
  const out = [];
  out.push(`# vk 契约 ${c.version}`, '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.content.w}×${c.canvas.content.h}。手机横屏满屏约 ${c.phone.width} 宽（${c.phone.ratio.toFixed(3)}×）。索引一律 ${c.indexRule}。`, '');
  out.push('## 规则', '');
  for (const r of c.rules) out.push(`- ${r}`);
  out.push('', `锚点：${c.anchors}。id：${c.global.id}。style：${c.global.style}。`, '');
  out.push('## 骨架', '', '```html', c.skeleton, '```', '');
  out.push('## 拆帧预算（实测参考，不是门禁）', '');
  out.push('| 内容 | 一帧上限 | 说明 |', '|---|---|---|');
  for (const x of c.capacity) out.push(`| ${x.what} | ${x.max} | ${x.note || ''} |`);
  out.push('', '## 标签', '');
  for (const layer of LAYERS) {
    out.push('', `### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      if (FLOW_CHILD_TAGS.includes(tag)) out.push('', 'flow 子项还可写：`span` / `bleed`。');
      out.push('');
      if (t.variants) {
        for (const [as, v] of Object.entries(t.variants)) variantBlock(out, tag, as, v.label, v.summary, { ...t.attrs, ...(v.attrs || {}) }, v.children, v.example);
      } else {
        variantBlock(out, tag, null, t.name, t.summary, t.attrs, t.children, t.example);
      }
    }
  }
  out.push('', '## 错误码', '');
  out.push('| 码 | 什么时候 | 怎么改 |', '|---|---|---|');
  for (const [k, v] of Object.entries(c.codes)) out.push(`| \`${k}\` | ${v?.when || ''} | ${v?.fix || ''} |`);
  return out.join('\n');
}

/** 单件说明：vk doc <tag>。 */
export function docText(tag) {
  const t = TAGS[tag];
  if (!t) return '';
  const out = [`${tag} · ${t.name}  (${t.layer})`, t.summary];
  if (FLOW_CHILD_TAGS.includes(tag)) out.push('flow 子项可用：span / bleed');
  const LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标', other: '其它' };
  const dump = (attrs, indent = '  ') => {
    const groups = {};
    for (const [name, spec] of Object.entries(attrs)) (groups[spec.group || 'other'] ||= []).push([name, spec]);
    for (const [g, list] of Object.entries(groups)) {
      out.push('', LABEL[g] || g);
      for (const [name, spec] of list) {
        const r = fmtAttr(name, spec);
        out.push(`${indent}${name.padEnd(13)} ${r.values}${r.def !== '—' ? `  默认 ${r.def}` : ''}${r.range ? `  范围 ${r.range}` : ''}  ${r.label}`);
      }
    }
  };
  const dumpChildren = (children, labelName = '子项 (<li>)') => {
    if (!children) return;
    if (children.hint) out.push('', `内容：${children.hint}`);
    const rows = [...Object.entries(children.attrs || {}), ...Object.entries(children.cellAttrs || {}).map(([n, s]) => [`td.${n}`, s])];
    if (!rows.length) return;
    out.push('', labelName);
    for (const [name, spec] of rows) {
      const r = fmtAttr(name, spec);
      out.push(`  ${name.padEnd(13)} ${r.values}${r.def !== '—' ? `  默认 ${r.def}` : ''}${r.range ? `  范围 ${r.range}` : ''}  ${r.label}`);
    }
  };
  if (!t.variants) {
    dump(t.attrs);
    dumpChildren(t.children);
  } else {
    for (const [as, v] of Object.entries(t.variants)) {
      out.push('', `## as="${as}" · ${v.label} —— ${v.summary}`);
      const attrs = { ...attrsOf(tag, as) };
      delete attrs.as;
      dump(attrs);
      dumpChildren(v.children);
      if (v.example) out.push('', '示例：', v.example);
    }
  }
  if (t.example && !t.variants) out.push('', '示例：', t.example);
  return out.join('\n');
}
