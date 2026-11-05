#!/usr/bin/env node
/**
 * vk CLI
 *
 *   vk build [paths…]     pages/ → out/；代码 / 公式 / hexdump / 文件树 / 图标构建期内联
 *   vk check [paths…]     build + 结构自检（字号 / 对比度 / 安全区 / 溢出 / 重叠 / 锚点）
 *   vk shot <page>        build + check + 一张 1920×1080 PNG（--phone 出 780 宽）
 *   vk doc <tag>          某个标签的属性、取值、默认值
 *   vk tags               全部标签（--json）
 *   vk brief              30 行契约摘要（--json 给机器）
 *   vk icons [query]      搜 Lucide 图标名
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , cmdRaw, ...rest] = process.argv;
const cmd = cmdRaw || 'help';
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');

const schema = () => import('../src/schema.mjs');
const layerLabel = (layers, id) => layers.find((l) => l.id === id)?.label || id;

if (cmd === 'build') {
  process.argv = [process.argv[0], 'build', ...rest];
  await import('../cli/build.mjs');
} else if (cmd === 'check') {
  process.argv = [process.argv[0], 'check', ...rest];
  await import('../cli/check.mjs');
} else if (cmd === 'shot') {
  process.argv = [process.argv[0], 'shot', ...rest];
  await import('../cli/shot.mjs');
} else if (cmd === 'tags') {
  const { TAGS, TAG_NAMES, LAYERS } = await schema();
  if (rest.includes('--json')) console.log(JSON.stringify(TAG_NAMES.map((t) => ({ tag: t, ...TAGS[t] })), null, 2));
  else {
    for (const layer of LAYERS) {
      const tags = TAG_NAMES.filter((t) => TAGS[t].layer === layer.id);
      if (!tags.length) continue;
      console.log(`\n${layer.label}`);
      for (const t of tags) console.log(`  ${t.padEnd(14)} ${TAGS[t].name}`);
    }
  }
} else if (cmd === 'doc') {
  const tag = rest.find((a) => !a.startsWith('-'));
  if (!tag) {
    console.error('用法：vk doc <tag> [--all] [--json]');
    process.exit(1);
  }
  const { TAGS, LAYERS, CHILDREN, STATES, LAYOUT_ATTRS } = await schema();
  const def = TAGS[tag];
  if (!def) {
    console.error(`[vk] 没有 ${tag}。先跑 vk tags 看清单。`);
    process.exit(1);
  }
  if (rest.includes('--json')) {
    console.log(JSON.stringify({ tag, ...def, children: CHILDREN[tag] || null, states: STATES[tag] || null }, null, 2));
  } else {
    console.log(`${tag} · ${def.name}  (${layerLabel(LAYERS, def.layer)})\n${def.summary}\n`);
    const all = rest.includes('--all');
    const groups = [
      ['content', '内容'],
      ['appearance', '外观'],
      ['state', '状态'],
      ['layout', '布局'],
    ];
    const rows = Object.entries(def.attrs || {}).filter(([name, spec]) => all || !spec.layout || !LAYOUT_ATTRS.has(name));
    for (const [group, title] of groups) {
      const list = rows.filter(([, spec]) => (spec.group || 'appearance') === group);
      if (!list.length) continue;
      console.log(`${title}：`);
      for (const [name, spec] of list) {
        const vals = spec.values ? spec.values.join(' | ') : spec.type || '';
        const defv = spec.default === undefined ? '' : `  默认 ${spec.default}`;
        const ctx = spec.context ? `  [${spec.context}]` : '';
        const label = spec.label ? `  ${spec.label}` : '';
        console.log(`  ${name.padEnd(14)} ${vals}${defv}${ctx}${label}`);
      }
      console.log('');
    }
    const model = CHILDREN[tag];
    if (model) {
      const desc =
        model.kind === 'item'
          ? `条目写成 <${model.item}>`
          : model.kind === 'wrapper'
            ? `内容必须包在 <${model.wrapper}> 里`
            : model.kind === 'source'
              ? `内容来自 src 或 <script data-vk-source>（不能同时写）`
              : '裸文本';
      console.log(`子节点：${desc}`);
    }
    if (STATES[tag]) console.log(`状态：state="${STATES[tag].values.join('|')}"（${STATES[tag].where.join(' / ')}）`);
    console.log('\n布局协议：span → vk-grid 子项；x / y / w / h / z → vk-canvas 子项；其余块级属性通用。');
  }
} else if (cmd === 'brief') {
  const { TAGS, TAG_NAMES, LAYERS, CHILDREN, STATES, LAYOUT_ATTRS } = await schema();
  if (rest.includes('--json')) {
    console.log(
      JSON.stringify(
        TAG_NAMES.map((tag) => ({
          tag,
          layer: TAGS[tag].layer,
          name: TAGS[tag].name,
          summary: TAGS[tag].summary,
          attrs: Object.fromEntries(
            Object.entries(TAGS[tag].attrs).filter(([n, s]) => !LAYOUT_ATTRS.has(n) && !s.hidden)
          ),
          children: CHILDREN[tag] || null,
          states: STATES[tag] || null,
        })),
        null,
        2
      )
    );
  } else {
    for (const layer of LAYERS) {
      const tags = TAG_NAMES.filter((t) => TAGS[t].layer === layer.id);
      if (!tags.length) continue;
      console.log(`\n${layer.label}`);
      for (const tag of tags) {
        const own = Object.entries(TAGS[tag].attrs).filter(([n, s]) => !LAYOUT_ATTRS.has(n) && !s.hidden);
        const attrs = own.map(([n, s]) => (s.values ? `${n}=${s.values.join('|')}` : n)).join(' ');
        const child =
          CHILDREN[tag]?.kind === 'item'
            ? ` · 子:${CHILDREN[tag].item}`
            : CHILDREN[tag]?.kind === 'wrapper'
              ? ` · 子:${CHILDREN[tag].wrapper}`
              : CHILDREN[tag]?.kind === 'source'
                ? ' · 子:src'
                : '';
        const state = STATES[tag] ? ` · state:${STATES[tag].values.join('|')}` : '';
        console.log(`  ${tag.padEnd(14)} ${attrs}${child}${state}`);
      }
    }
  }
} else if (cmd === 'icons') {
  const q = rest.find((a) => !a.startsWith('-')) || '';
  const data = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'icons.json'), 'utf8'));
  const all = (data.names || Object.keys(data)).sort();
  const hit = q ? all.filter((n) => n.includes(q.toLowerCase())) : all;
  if (rest.includes('--json')) console.log(JSON.stringify(hit, null, 2));
  else {
    console.log(hit.slice(0, 120).join('\n'));
    if (hit.length > 120) console.log(`…还有 ${hit.length - 120} 个，用更具体的 query`);
    console.log(`\n共 ${hit.length} 个`);
  }
} else {
  const { TAG_NAMES } = await schema();
  console.log(`
vk —— 把内容做成画面单元

  vk build [paths…]    pages/ → out/（预编译代码 / 公式 / 字节 / 树 / 图标）
  vk check [paths…]    结构自检：字号/对比度/安全区/溢出/重叠/空锚点
  vk shot <page>       一张 1920×1080（--phone 出 780 宽）
  vk doc <tag>         看某个标签的属性、取值与默认值
  vk tags              列出 ${TAG_NAMES.length} 个标签（--json）
  vk brief             契约摘要（--json）
  vk icons [query]     搜 Lucide 图标名（--json）

入口文档：SPEC.md
`);
}
