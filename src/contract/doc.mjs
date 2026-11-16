/**
 * v25 · 契约文档
 * ----------------------------------------------------------------------------
 * 机器可读（vk brief --json）与人读（docs/CONTRACT.md、vk doc）两个出口，同一份 schema。
 */
import { TAGS, TAG_NAMES, attrsOf, childrenOf, variantOf, LAYERS, ANCHOR_PARTS, SKELETON, RULES, FLOW_CHILD, FLOW_CHILD_TAGS } from '../schema.mjs';
import { GAP, FONT, LINE, MEASURE, INDEX_RULE, CANVAS, CONTENT, LINE_W, SYNTAX, PAINT, THEME, CARD_SURFACE } from '../vocab.mjs';
import { CODES, VERSION } from './validate.mjs';
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
const contentOf = (children) =>
  children?.kind === 'source' ? 'source' : children?.kind === 'items' ? 'item' : children?.kind === 'table' ? 'table' : children?.kind === 'inline' ? 'text' : 'slot';
/** 机器可读契约：vk brief --json 的输出。 */
export function contract() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, marginX: CANVAS.marginX, marginY: CANVAS.marginY, content: CONTENT },
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
        const variants = t.variants
          ? Object.fromEntries(
              Object.entries(t.variants).map(([id, v]) => [
                id,
                { label: v.label, summary: v.summary, attrs: attrsOf(tag, id), children: v.children, content: contentOf(v.children), example: v.example || null },
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
            children: t.children || null,
            attrs: t.attrs,
            variants,
          },
        ];
      })
    ),
  };
}
/* 一个变体的小节。 */
function variantBlock(out, tag, as, label, summary, attrs, children, example) {
  out.push(`#### ${label}${as ? ` · as="${as}"` : ''} —— ${summary}`);
  const rows = Object.entries(attrs).map(([n, s]) => fmtAttr(n, s));
  if (rows.length) {
    out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
    for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
  }
  if (children?.hint) out.push('', children.hint);
  if (children?.attrs && Object.keys(children.attrs).length) {
    out.push('', '子项属性：', '', '| 子项属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
    for (const [n, s] of Object.entries(children.attrs)) {
      const r = fmtAttr(n, s);
      out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
    }
  }
  if (example) out.push('', '```html', example, '```');
  out.push('');
}
/** 一页人/AI 读的契约：vk brief 默认输出，也是 docs/CONTRACT.md。 */
export function markdown() {
  const c = contract();
  const out = [];
  out.push(`# vk 契约 ${c.version}`, '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.content.w}×${c.canvas.content.h}（左右 ${c.canvas.marginX} / 上下 ${c.canvas.marginY}）。观众在手机横屏看，实际约 780 宽（0.406×）。`);
  out.push(`索引一律 ${c.indexRule}。字只从 vocab 来，这份文档由 \`vk brief --md\` 生成。`, '');
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
    out.push('', `### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      if (FLOW_CHILD_TAGS.includes(tag)) out.push('', '可用 flow 子项属性：`span` / `bleed`。');
      out.push('');
      if (t.variants) {
        for (const [as, v] of Object.entries(t.variants)) variantBlock(out, tag, as, v.label, v.summary, v.attrs, v.children, v.example);
      } else {
        variantBlock(out, tag, null, t.name, t.summary, t.attrs, t.children, t.example);
      }
    }
  }
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
  if (!t.variants) {
    dump(t.attrs);
    if (t.children?.hint) out.push('', `内容：${t.children.hint}`);
  } else {
    for (const [as, v] of Object.entries(t.variants)) {
      out.push('', `## as="${as}" · ${v.label} —— ${v.summary}`);
      const attrs = { ...attrsOf(tag, as) };
      delete attrs.as;
      dump(attrs);
      if (v.children?.hint) out.push('', `内容：${v.children.hint}`);
      if (v.children?.attrs && Object.keys(v.children.attrs).length) {
        out.push('', '子项 (<li>)');
        for (const [name, spec] of Object.entries(v.children.attrs)) {
          const r = fmtAttr(name, spec);
          out.push(`  ${name.padEnd(13)} ${r.values}${r.def !== '—' ? `  默认 ${r.def}` : ''}${r.range ? `  范围 ${r.range}` : ''}  ${r.label}`);
        }
      }
      if (v.example) out.push('', '示例：', v.example);
    }
  }
  if (t.example && !t.variants) out.push('', '示例：', t.example);
  return out.join('\n');
}
export { variantOf };