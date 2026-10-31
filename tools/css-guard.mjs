/**
 * CSS 误伤守卫 —— 删组件时最危险的不是删错，是"连带把别人的规则切走"。
 *
 * 这一轮已经发生过三次：删 vk-quote / vk-title 时，按注释分段切 CSS，
 * 把 vk-text 的焦点色、vk-callout 的 wrap、窗头规则一起带走了——
 * 而它们都是"静默失效"：页面照常渲染，只是某个属性不再有任何效果。
 *
 * 用法：
 *   node tools/css-guard.mjs [git-rev] [--allow vk-a,vk-b]
 * 默认对比 HEAD，允许被删标签的规则消失；其它选择器消失就报错退出 1。
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const rev = args.find((a) => !a.startsWith('--')) || 'HEAD';
const allowArg = args.find((a) => a.startsWith('--allow'));
const allow = new Set(
  (allowArg ? (allowArg.split('=')[1] || '') : '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const FILES = ['src/components/components.css', 'src/elements/elements.css', 'src/layout/layout.css', 'src/compositions/overlays.css', 'src/elements/window.css'];

/** 粗略但够用的选择器提取：取 `{` 之前的最后一段，跳过 @ 规则。 */
function selectors(css) {
  const out = new Set();
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].split('}').pop().trim();
    if (!sel || sel.startsWith('@') || sel.includes('%')) continue;
    for (const part of sel.split(',')) out.add(part.trim());
  }
  return out;
}

let bad = 0;
for (const file of FILES) {
  if (!fs.existsSync(file)) continue;
  const prev = spawnSync('git', ['show', `${rev}:${file}`], { encoding: 'utf8' });
  if (prev.status !== 0) continue;
  const before = selectors(prev.stdout);
  const after = selectors(fs.readFileSync(file, 'utf8'));
  const gone = [...before].filter((s) => !after.has(s));
  const suspicious = gone.filter((s) => ![...allow].some((t) => s.includes(t)));
  if (suspicious.length) {
    bad += suspicious.length;
    console.log(`✗ ${file} 丢了 ${suspicious.length} 条不属于被删标签的规则：`);
    for (const s of suspicious.slice(0, 20)) console.log(`    ${s}`);
  }
}

if (bad) {
  console.error(`\nCSS 误伤 ${bad} 条。如果确实要删，用 --allow=标签名 显式放行。`);
  process.exit(1);
}
console.log('✓ CSS 选择器没有误伤（被删标签之外）');
