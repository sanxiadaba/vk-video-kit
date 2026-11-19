/**
 * v27 · 契约文档
 * ----------------------------------------------------------------------------
 * 三个出口，同一份 schema：
 *   vk brief            给 AI 的紧凑契约（默认，--json）
 *   vk brief --full     实现者全量（含颜色 / 字号 / 线宽）
 *   vk doc <tag>        单件下钻，含子项属性
 *
 * 印法只有两条：
 *   · 公共属性印一次；变体只印 delta（schema 里变体自己带全的，也不再重复公共的）。
 *   · 完整帧只用一个通用包装（exampleFrame）；示例里的锚点目标缺谁补谁。
 */
import { TAGS, TAG_NAMES, childrenOf, LAYERS, ANCHOR_PARTS, SKELETON, RULES, FLOW_CHILD, FLOW_CHILD_TAGS, AUTHOR_GLOBALS, CAPACITY, LAYOUT_FACTS } from '../schema.mjs';
import { GAP, FONT, LINE, MEASURE, INDEX_RULE, CANVAS, CONTENT, LINE_W, SYNTAX, PAINT, THEME, CARD_SURFACE, PHONE_W } from '../vocab.mjs';
import { CODES_INFO } from './codes.mjs';
import { VERSION } from '../version.mjs';

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

const GROUP_LABEL = { type: '字', appearance: '外观', layout: '布局', state: '状态', content: '内容', target: '目标', other: '其它' };

/** 一个属性的取值 / 默认 / 范围 / 说明。 */
const fmtAttr = (name, spec) => {
  const values = spec.values ? spec.values.join(' / ') : TYPE_LABEL[spec.type] || spec.type;
  const def = spec.default === undefined ? '—' : String(spec.default);
  const range = spec.min !== undefined && spec.max !== undefined ? `${spec.min}–${spec.max}` : spec.min !== undefined ? `≥ ${spec.min}` : spec.max !== undefined ? `≤ ${spec.max}` : '';
  const required = spec.required ? '必填' : '';
  const infer = spec.infer ? '不写由库推断' : '';
  return { name, values, def, range, label: [spec.label || '', required, infer].filter(Boolean).join('；') };
};

const contentOf = (children) =>
  children?.kind === 'source' ? 'source' : children?.kind === 'items' ? 'item' : children?.kind === 'table' ? 'table' : children?.kind === 'inline' ? 'text' : 'slot';

const childrenOut = (children) => {
  if (!children) return null;
  const { kind, hint, attrs, cellAttrs } = children;
  return { kind, hint, ...(attrs ? { attrs } : {}), ...(cellAttrs ? { cellAttrs } : {}) };
};

/** 变体只有自己那一份：和标签公共属性相同的不再重复印。 */
const deltaAttrs = (tag, as) => {
  const own = TAGS[tag].attrs || {};
  const out = {};
  for (const [name, spec] of Object.entries(TAGS[tag].variants[as].attrs || {})) if (JSON.stringify(own[name]) !== JSON.stringify(spec)) out[name] = spec;
  return out;
};

/* 示例里的两个历史遗留：v26 的 for= 已改名 target；文案里夹过零宽字符。
   schema.mjs 是另一个代理的文件，这里只对「示例字符串」做一次归一，属性表不动。 */
const modernize = (html) =>
  String(html || '')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\bfor=/g, 'target=');

/* 示例里引用了不在示例内的 id：补一个桩，完整帧才跑得起来。
   桩按示例真正指到的行号 / 条目数裁长度，不塞一整段源码。 */
const CODE_LINES = ['int a[3] = {1, 2, 3};', 'a[1] = 7;', 'a[0] = a[1];', 'a[2] = 0;', 'printf("%d", a[0]);', 'return 0;'];
const codeStub = (n) => {
  const body = CODE_LINES.slice(0, Math.max(2, Math.min(n, CODE_LINES.length)));
  return [`  <vk-code id="c" lang="c" title="a.c" size="caption" current="2"><script type="text/plain" data-vk-source>`, ...body, '</script></vk-code>'].join('\n');
};
const boardStub = (n) => `  <vk-board id="m">${Array.from({ length: Math.max(2, n) }, (_, i) => `<li note="a[${i}]">${i}</li>`).join('')}</vk-board>`;
const stubOf = (id, frag) => {
  const hit = (part) => Math.max(0, ...[...frag.matchAll(new RegExp(`#${id}@${part}:(\\d+)`, 'g'))].map((m) => Number(m[1])));
  if (id === 'c') return codeStub(Math.max(2, hit('line')));
  if (id === 'm') return boardStub(Math.max(2, hit('item')));
  return `  <vk-text id="${id}">目标。</vk-text>`;
};

/** 机器可读契约（全量）：工具与实现者用。
    变体的 attrs 只写 delta：公共属性在 tags[tag].attrs 里只出现一次（和文本输出同一个规矩）。 */
export function contract() {
  return {
    version: VERSION,
    canvas: { w: CANVAS.w, h: CANVAS.h, marginX: CANVAS.marginX, marginY: CANVAS.marginY, content: CONTENT },
    phone: { width: PHONE_W, ratio: PHONE_W / CANVAS.w },
    indexRule: INDEX_RULE,
    theme: THEME,
    surface: CARD_SURFACE,
    flowChild: FLOW_CHILD,
    flowChildTags: FLOW_CHILD_TAGS,
    rules: RULES,
    global: AUTHOR_GLOBALS,
    anchorParts: ANCHOR_PARTS,
    anchors: '#id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left / #id@text:词[1]',
    capacity: CAPACITY,
    layoutFacts: LAYOUT_FACTS,
    codes: Object.fromEntries(Object.entries(CODES_INFO).map(([k, v]) => [k, { family: v.family, severity: v.severity, when: v.when, fix: v.fix }])),
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
        const own = t.attrs || {};
        const variants = t.variants
          ? Object.fromEntries(
              Object.entries(t.variants).map(([id, v]) => [
                id,
                { label: v.label, summary: v.summary, attrs: deltaAttrs(tag, id), children: childrenOut(v.children), content: contentOf(v.children), example: modernize(v.example || '') || null },
              ])
            )
          : null;
        return [
          tag,
          {
            name: t.name,
            layer: t.layer,
            summary: t.summary,
            example: modernize(t.example || '') || null,
            content: contentOf(childrenOf(tag, null)),
            children: childrenOut(t.children),
            attrs: own,
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
    layoutFacts: full.layoutFacts,
    skeleton: full.skeleton,
    tags,
    codes: full.codes,
  };
}

/* ------------------------------------------------------------------ markdown */
const attrTable = (out, attrs) => {
  const rows = Object.entries(attrs || {}).map(([n, s]) => fmtAttr(n, s));
  if (!rows.length) return;
  out.push('', '| 属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
  for (const r of rows) out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
};

const childTable = (out, children) => {
  if (!children) return;
  if (children.hint) out.push('', children.hint);
  const rows = [...Object.entries(children.attrs || {}), ...Object.entries(children.cellAttrs || {}).map(([n, s]) => [`td.${n}`, s])];
  if (!rows.length) return;
  out.push('', '| 子项属性 | 取值 | 默认 | 范围 | 说明 |', '|---|---|---|---|---|');
  for (const [n, s] of rows) {
    const r = fmtAttr(n, s);
    out.push(`| \`${r.name}\` | ${r.values} | ${r.def} | ${r.range} | ${r.label} |`);
  }
};

const codeCell = (v) => `\`${v}\``;

/** 人 / AI 读的紧凑契约：vk brief。 */
export function markdown() {
  const c = compact();
  const out = [];
  out.push(`# vk 契约 ${c.version}`, '');
  out.push(`画布 ${c.canvas.w}×${c.canvas.h}，版心 ${c.canvas.content.w}×${c.canvas.content.h}。手机横屏满屏约 ${c.phone.width} 宽（${c.phone.ratio.toFixed(3)}×）。索引一律 ${c.indexRule}。`, '');
  out.push('## 规则', '');
  for (const r of c.rules) out.push(`- ${r}`);
  out.push('', `锚点：${c.anchors}。id：${c.global.id}。style：${c.global.style}。`, '');
  out.push('## 骨架', '', '```html', c.skeleton, '```', '');
  out.push('## 排版事实', '');
  const lf = c.layoutFacts;
  out.push(`- 标题带：带 lede ${lf.head.withLede} / 不带 ${lf.head.withoutLede} / subhead ${lf.head.subhead}。`);
  out.push(`- 有 note：正文让出 ${lf.note.gutter}，右注栏宽 ≤ ${lf.note.width}。无 note 半栏约 ${lf.halfColumnChars.body} 字（caption ${lf.halfColumnChars.caption}），有 note 只剩约 ${lf.halfColumnChars.withNote} 字。`);
  out.push(`- cells：${lf.cellsCompact}。`);
  out.push(`- 表格：${lf.tableWithLede}。一帧一条 note：${lf.oneNotePerFrame ? '是' : '否'}。`, '');
  out.push('## 拆帧预算（实测参考，不是门禁）', '');
  out.push('| 内容 | 一帧上限 | 说明 |', '|---|---|---|');
  for (const x of c.capacity) out.push(`| ${x.what} | ${x.max} | ${x.note || ''} |`);
  out.push('', '## 标签', '');
  for (const layer of LAYERS) {
    out.push('', `### ${layer.label}`, '');
    for (const [tag, t] of Object.entries(c.tags)) {
      if (t.layer !== layer.id) continue;
      out.push(`**\`${tag}\`** · ${t.name} —— ${t.summary}`);
      if (FLOW_CHILD_TAGS.includes(tag)) out.push('', '在 flow 里可直接写 `span`。');
      /* 公共属性只印一次。 */
      if (t.attrs && Object.keys(t.attrs).length) attrTable(out, t.attrs);
      if (t.variants) {
        for (const [as, v] of Object.entries(t.variants)) {
          out.push('', `#### ${v.label} · as="${as}" —— ${v.summary}`);
          if (v.attrs && Object.keys(v.attrs).length) attrTable(out, v.attrs);
          childTable(out, v.children);
          if (v.example) out.push('', '```html', v.example, '```');
        }
      } else {
        childTable(out, t.children);
        if (t.example) out.push('', '```html', t.example, '```');
      }
      out.push('');
    }
  }
  out.push('', '## 错误码', '');
  out.push('| 码 | 领域 | 级别 | 什么时候 | 怎么改 |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(c.codes)) out.push(`| ${codeCell(k)} | ${v?.family || ''} | ${v?.severity || ''} | ${v?.when || ''} | ${v?.fix || ''} |`);
  return out.join('\n');
}

/** 一个变体（或一个没有变体的件）的完整可跑最小帧。不是模板库，是契约示例。 */
export function exampleFrame(tag, as) {
  const t = TAGS[tag];
  if (!t) return '';
  if (as && t.variants && !t.variants[as]) return '';
  const v = t.variants ? t.variants[as || variantOfDefault(tag)] : null;
  const frag = modernize((v && v.example) || t.example || '').trim();
  if (!frag) return '';
  if (tag === 'vk-page') return frag;
  /* 示例引用了不在示例里的锚点：缺谁补谁（通用包装，不按标签写特例）。 */
  const defined = new Set([...frag.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...new Set([...frag.matchAll(/#([A-Za-z0-9_\-\u4e00-\u9fa5]+)/g)].map((m) => m[1]))].filter((id) => !defined.has(id));
  const lines = [...refs.map((id) => stubOf(id, frag)), `  ${frag}`];
  if (!/<vk-head\b/.test(frag)) lines.unshift('  <vk-head kicker="示例">示例帧。</vk-head>');
  return `<vk-page id="demo">\n${lines.join('\n')}\n</vk-page>`;
}

/* 默认变体：as 的 default（infer 的件也是它）。 */
const variantOfDefault = (tag) => TAGS[tag].attrs.as?.default || Object.keys(TAGS[tag].variants)[0];

/** 实现者全量文本：vk brief --full。 */
export function markdownFull() {
  const c = contract();
  const type = Object.entries(c.type)
    .map(([k, v]) => `| ${k} | ${v} | ${c.lineHeight[k]} | ${c.measure[k]} |`)
    .join('\n');
  return `${markdown()}

## 实现者数值（--full）

字号 / 行高 / 行宽：

| 档 | px | 行高 | em |
|---|---|---|---|
${type}

线宽：${Object.entries(c.lineWidth)
    .map(([k, v]) => `${k}=${v}`)
    .join(' / ')}。

间距：${Object.entries(c.space)
    .map(([k, v]) => `${k}=${v}`)
    .join(' / ')}。

颜色：focus ${c.colors.focus.join(' / ')}；ink ${c.colors.inks.map((x) => x.join('/')).join(' · ')}；syntax ${Object.entries(c.colors.syntax)
    .map(([k, v]) => `${k} ${v.join('/')}`)
    .join(' · ')}。`;
}

/* ------------------------------------------------------------------ docText */
const attrLines = (out, attrs) => {
  const groups = {};
  for (const [name, spec] of Object.entries(attrs || {})) (groups[spec.group || 'other'] ||= []).push([name, spec]);
  for (const [g, list] of Object.entries(groups)) {
    out.push('', GROUP_LABEL[g] || g);
    for (const [name, spec] of list) {
      const r = fmtAttr(name, spec);
      const def = r.def !== '—' ? `  默认 ${r.def}` : '';
      const range = r.range ? `  范围 ${r.range}` : '';
      out.push(`  ${name.padEnd(12)}${r.values}${def}${range}  ${r.label}`);
    }
  }
};

const childLines = (out, children) => {
  if (!children) return;
  if (children.hint && children.kind !== 'none') out.push('', `内容：${children.hint}`);
  const rows = [...Object.entries(children.attrs || {}), ...Object.entries(children.cellAttrs || {}).map(([n, s]) => [`td.${n}`, s])];
  if (!rows.length) return;
  out.push('', children.kind === 'table' ? '行 / 单元格' : '子项 (<li>)');
  for (const [name, spec] of rows) {
    const r = fmtAttr(name, spec);
    const def = r.def !== '—' ? `  默认 ${r.def}` : '';
    const range = r.range ? `  范围 ${r.range}` : '';
    out.push(`  ${name.padEnd(12)}${r.values}${def}${range}  ${r.label}`);
  }
};

/** 单件说明：vk doc <tag>。 */
export function docText(tag) {
  const t = TAGS[tag];
  if (!t) return '';
  const out = [`${tag} · ${t.name}  (${t.layer})`, t.summary];
  if (FLOW_CHILD_TAGS.includes(tag)) out.push('flow 子项可用：span');
  if (!t.variants) {
    attrLines(out, t.attrs);
    childLines(out, t.children);
    const frame = exampleFrame(tag);
    if (frame) out.push('', '示例（完整帧）：', frame);
    return out.join('\n');
  }
  /* 公共属性：as 不在属性表里重复印，改成一行调度词。 */
  const own = Object.fromEntries(Object.entries(t.attrs || {}).filter(([name]) => name !== 'as'));
  if (Object.keys(own).length) {
    out.push('', '公共属性（每个变体都能写）：');
    attrLines(out, own);
  }
  out.push('', `调度：as="${Object.keys(t.variants).join('|')}"（默认 ${variantOfDefault(tag)}${t.attrs.as?.infer ? '；不写按写的内容推断' : ''}）`);
  for (const [as, v] of Object.entries(t.variants)) {
    out.push('', `## as="${as}" · ${v.label} —— ${v.summary}`);
    attrLines(out, deltaAttrs(tag, as), false);
    childLines(out, v.children);
    const ex = modernize(v.example || '').trim();
    if (ex) out.push('', '示例：', ex);
  }
  /* 变体件不再逐个印完整帧：完整帧用 `vk example <tag> [as]` 取，同一份包装不重复三次。 */
  return out.join('\n');
}
