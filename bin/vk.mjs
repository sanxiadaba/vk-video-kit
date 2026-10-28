#!/usr/bin/env node
/**
 * vk CLI —— 随包发布，装完就能用。
 *
 *   vk build [files...]   把 <vk-code src> 与 <vk-math> 预编译成自包含 HTML
 *   vk check <page>       结构自检（字号/对比度/安全区/溢出/重叠/空锚点）
 *   vk shot <page>        出一张 1920×1080
 *   vk serve [port]       开发服务器，改文件刷新即见
 *   vk tags               列出 43 个标签
 *   vk doc <tag>          看某个标签的属性与默认值
 *   vk icons [query]      搜 Lucide 图标名
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , cmdRaw, ...rest] = process.argv;
const cmd = cmdRaw || 'help';
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');

const need = async (pkg, why) => {
  try {
    return await import(pkg);
  } catch {
    console.error(`\n[vk] 缺少 ${pkg}（${why}）。包的依赖未装好，请重新安装 vk-video-kit。\n`);
    process.exit(1);
  }
};

if (cmd === 'build' || cmd === 'check-build') {
  await need('shiki', '代码高亮');
  await need('parse5', '解析 HTML');
  await need('katex', '公式渲染');
  process.argv = [process.argv[0], 'precompile', ...(cmd === 'check-build' ? ['--check'] : []), ...rest];
  const m = await import('../cli/build.mjs');
  await m.main();
} else if (cmd === 'check') {
  process.argv = [process.argv[0], 'check', ...rest];
  await import('../cli/check.mjs');
} else if (cmd === 'serve') {
  await need('shiki', '代码高亮');
  await need('parse5', '解析 HTML');
  await need('katex', '公式渲染');
  const m = await import('../cli/serve.mjs');
  await m.main(Number(rest[0]) || 8099, process.cwd());
} else if (cmd === 'shot') {
  process.argv = [process.argv[0], 'shot', ...rest];
  const m = await need('playwright-core', '截图');
  await m;
  await import('../cli/shot.mjs');
} else if (cmd === 'tags') {
  const { TAGS, TAG_NAMES, LAYERS } = await import('../src/registry.mjs');
  if (rest.includes('--json')) {
    console.log(JSON.stringify(TAG_NAMES.map((tag) => ({ tag, ...TAGS[tag] })), null, 2));
  } else {
    for (const layer of LAYERS) {
      const tags = TAG_NAMES.filter((t) => TAGS[t].layer === layer.id);
      if (!tags.length) continue;
      console.log(`\n${layer.label}`);
      for (const tag of tags) console.log(`  ${tag.padEnd(15)} ${TAGS[tag].name}`);
    }
  }
} else if (cmd === 'doc') {
  const tag = rest[0];
  if (!tag) {
    console.error('用法：vk doc <tag>');
    process.exit(1);
  }
  const { TAGS, LAYERS } = await import('../src/registry.mjs');
  const def = TAGS[tag];
  if (!def) {
    console.error(`[vk] 没有 ${tag}。先跑 vk tags 看清单。`);
    process.exit(1);
  }
  const layer = LAYERS.find((l) => l.id === def.layer)?.label || def.layer;
  console.log(`${tag} · ${def.name}  (${layer})\n${def.summary}\n`);
  console.log('属性：');
  for (const [name, spec] of Object.entries(def.attrs || {})) {
    const vals = spec.values ? spec.values.join(' | ') : spec.type || '';
    const defv = spec.default === undefined ? '' : `  默认 ${spec.default}`;
    console.log(`  ${name.padEnd(14)} ${vals}${defv}`);
  }
} else if (cmd === 'icons') {
  const q = rest.find((a) => !a.startsWith('-')) || '';
  const json = fs.readFileSync(path.join(pkgRoot, 'icons.json'), 'utf8');
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
  console.log(`
vk —— 把内容做成画面单元

  vk build [files...]   预编译代码高亮与公式（产物自包含）
  vk check <page>       结构自检：字号/对比度/安全区/溢出/重叠/空锚点
  vk shot <page>        截一张 1920×1080（--phone / --crop x,y,w,h）
  vk serve [port]       开发服务器（默认 8099）
  vk tags               列出 43 个标签（--json）
  vk doc <tag>          看某个标签的属性与默认值
  vk icons [query]      搜 Lucide 图标名（--json）

用法与属性见包内的 README.md / USAGE.md，给 AI 的入口是 docs/ai.md。
`);
}
