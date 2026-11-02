#!/usr/bin/env node
/**
 * 能力矩阵（记分板）
 * ----------------------------------------------------------------------------
 * 记的是「能力」，不是「标签」：一个能力必须同时有三件东西，少一件就是红。
 *
 *   契约断言  在 registry + src/effects.mjs（或 contract-probes 的 PROBES）里
 *             真的有一条会执行的断言；内容属性也算（契约会做“改了就变”探针）。
 *   标本页    src/scenes/scenes.mjs 里有场景，且 _site/specimen/<tag>.html 与
 *             契约宿主 _site/specimens/<tag>.html 都真的生成了。
 *   测试      tests/ 下那个文件真的包含这个名字的 test。
 *
 * 用法：
 *   node tools/capabilities.mjs           # 校验 + 生成 docs/capabilities.md
 *   node tools/capabilities.mjs --check   # 只校验，生成物过期也报红（verify 用）
 *
 * 数据源只有 docs/capabilities.json；md 是生成物，不要手改。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAGS, isContent } from '../src/registry.mjs';
import { EFFECTS } from '../src/effects.mjs';
import { PROBES } from './lib/contract-probes.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { writeIfChanged } from './lib/io.mjs';

const SRC = 'docs/capabilities.json';
const MD = 'docs/capabilities.md';

/** 契约里这条断言会不会真的执行？（跳过类属性不算） */
export function checkContract(expr) {
  const dot = expr.lastIndexOf('.');
  if (dot < 1) return `契约断言要写成 标签.属性，收到 ${expr}`;
  const tag = expr.slice(0, dot);
  const attr = expr.slice(dot + 1);
  const spec = TAGS[tag]?.attrs?.[attr];
  if (!spec) return `契约里没有 ${expr}：registry 没有这个属性`;
  if (spec.motion) return `契约会跳过 ${expr}（motion 属性由 director 测试覆盖）`;
  if (spec.pose) return `契约会跳过 ${expr}（pose 属性由 pose 测试覆盖）`;
  if (spec.context) return `契约会跳过 ${expr}（context 属性由构建期/slice 覆盖）`;
  if (spec.build) return `契约会跳过 ${expr}（build 属性只在构建期生效）`;
  const declared = EFFECTS[tag]?.[attr] || PROBES[tag]?.[attr];
  if (!declared && !isContent(tag, attr)) return `契约里找不到 ${expr} 的断言`;
  return null;
}

/**
 * 纯函数校验：可注入文件系统，测试里能把「缺一件」造出来。
 * @returns {{ok:boolean,id:string,name:string,issues:{kind:string,message:string}[],contracts:string[],specimen:string,tests:{file:string,name:string}[]}[]}
 */
export function evaluate(data, { root = '.', exists = (p) => fs.existsSync(p), read = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  const out = [];
  for (const cap of data.capabilities || []) {
    const issues = [];
    const contracts = cap.contracts || [];
    if (!contracts.length) issues.push({ kind: 'contract', message: '没有登记契约断言' });
    for (const expr of contracts) {
      const bad = checkContract(expr);
      if (bad) issues.push({ kind: 'contract', message: bad });
    }

    const tag = cap.specimen;
    if (!tag) {
      issues.push({ kind: 'specimen', message: '没有登记标本页' });
    } else {
      const scene = SCENES.find((s) => s.tag === tag);
      if (!scene) issues.push({ kind: 'specimen', message: `scenes.mjs 里没有 ${tag} 的场景` });
      const page = path.join(root, '_site', 'specimen', `${tag}.html`);
      const host = path.join(root, '_site', 'specimens', `${tag}.html`);
      if (!exists(page)) issues.push({ kind: 'specimen', message: `标本页不存在：_site/specimen/${tag}.html（先 npm run build）` });
      else if (!read(page).includes(`<${tag}`)) issues.push({ kind: 'specimen', message: `标本页里没有 <${tag}>：_site/specimen/${tag}.html` });
      if (!exists(host)) issues.push({ kind: 'specimen', message: `契约宿主不存在：_site/specimens/${tag}.html` });
    }

    const tests = cap.tests || [];
    if (!tests.length) issues.push({ kind: 'test', message: '没有登记测试' });
    for (const t of tests) {
      if (!t.file || !t.name) {
        issues.push({ kind: 'test', message: '测试条目要写成 { file, name }' });
        continue;
      }
      if (!t.file.startsWith('tests/') || !t.file.endsWith('.test.mjs')) {
        issues.push({ kind: 'test', message: `测试文件必须在 tests/ 下且以 .test.mjs 结尾：${t.file}` });
        continue;
      }
      if (!exists(path.join(root, t.file))) {
        issues.push({ kind: 'test', message: `测试文件不存在：${t.file}` });
        continue;
      }
      if (!read(path.join(root, t.file)).includes(t.name)) {
        issues.push({ kind: 'test', message: `${t.file} 里找不到 test「${t.name}」` });
      }
    }

    out.push({ ok: !issues.length, id: cap.id, name: cap.name, issues, contracts, specimen: tag, tests });
  }
  return out;
}

const KIND = { contract: '契约', specimen: '标本', test: '测试' };

function statusOf(r) {
  if (r.ok) return '✅ 绿';
  const kinds = [...new Set(r.issues.map((i) => KIND[i.kind] || i.kind))];
  return `✗ 缺${kinds.join(' / ')}`;
}

export function renderMarkdown(data, results) {
  const rows = results.map((r) => {
    const contract = r.contracts.map((c) => `\`${c}\``).join('<br>') || '—';
    const tests = [...new Set(r.tests.map((t) => `\`${t.file}\``))].join('<br>') || '—';
    return `| ${r.name} | ${contract} | \`specimen/${r.specimen}.html\` | ${tests} | ${statusOf(r)} |`;
  });

  const detail = results
    .map((r) => {
      const lines = [
        `### ${r.ok ? '✅' : '✗'} ${r.name}`,
        '',
        `- 能力：${(data.capabilities.find((c) => c.id === r.id) || {}).what || ''}`,
        `- 契约断言：${r.contracts.map((c) => `\`${c}\``).join(' · ') || '（缺）'}`,
        `- 标本页：\`_site/specimen/${r.specimen}.html\` + 契约宿主 \`_site/specimens/${r.specimen}.html\``,
        `- 测试：${r.tests.map((t) => `\`${t.file}\` · 「${t.name}」`).join('；') || '（缺）'}`,
      ];
      if (!r.ok) {
        lines.push('- 缺件：');
        for (const i of r.issues) lines.push(`  - [${KIND[i.kind] || i.kind}] ${i.message}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  return `# 能力矩阵

> 由 \`tools/capabilities.mjs\` 从 \`docs/capabilities.json\` 生成 —— 不要手改。
> 一条能力必须同时有「契约断言 / 标本页 / 测试」三件；缺一件，状态变红，
> \`npm test\` 里的 capabilities 组与 \`tools/verify.mjs\` 都会失败。

记账方式：**能力**是用户能看见的一件事（“有一档淡底”“深色块也能用”），
不是标签。标签会删会改；能力不能悄悄消失。

| 能力 | 契约断言 | 标本页 | 测试 | 状态 |
|---|---|---|---|---|
${rows.join('\n')}

## 明细

${detail}

## 怎么判红

1. **契约**：\`标签.属性\` 必须出现在 registry，并且在 \`src/effects.mjs\` 里有一条
   \`on / prop / expect\`（内容属性走契约的“改了就变”探针）。motion / pose /
   context / build 这类会被契约跳过的属性不算数。
2. **标本**：\`src/scenes/scenes.mjs\` 里要有这个标签的场景，构建后
   \`_site/specimen/<tag>.html\`（人看的标本页）与 \`_site/specimens/<tag>.html\`
   （契约宿主）都要存在。
3. **测试**：\`tests/*.test.mjs\` 里真的能按名字找到那条 test（不是只建了文件）。

缺任何一件，脚本逐条打印缺什么并以退出码 1 结束；不会“生成了就算过”。
`;
}

function main() {
  const check = process.argv.includes('--check');
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const results = evaluate(data);
  const md = renderMarkdown(data, results);
  writeIfChanged(MD, md, check);

  const bad = results.filter((r) => !r.ok);
  for (const r of bad) {
    console.error(`✗ ${r.name}`);
    for (const i of r.issues) console.error(`  [${KIND[i.kind] || i.kind}] ${i.message}`);
  }
  if (bad.length) {
    console.error(`\n能力矩阵：${bad.length}/${results.length} 条缺件。补契约 / 标本 / 测试，或把这条能力删掉。`);
    process.exitCode = 1;
  } else {
    console.log(`能力矩阵：${results.length} 条能力，契约 / 标本 / 测试三件套齐全。`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
