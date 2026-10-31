/**
 * 布局指纹 —— 收敛的验收尺子。
 *
 * 它不截像素，只抽"每个文字行在哪里、多大、写了什么"：
 *   { t: 文字, x, y, w, h, size }
 * 为什么不用像素：14.0 要删掉 title/stat/quote 这些标签，它们的 CSS 会跟着消失，
 * 画面必然有细微变化；但"字还在原位、还是那个字号"是可以说清、可以断言的事。
 *
 *   node tools/fingerprint.mjs --out qa/base.json frames/*.html
 *   node tools/fingerprint.mjs --compare qa/base.json frames/*.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const val = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const out = val('--out');
const compare = val('--compare');
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--compare');
if (!files.length) {
  console.error('用法：node tools/fingerprint.mjs [--out a.json] [--compare a.json] <页面…>');
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('playwright-core'));
}

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const urlOf = (f) => (/^https?:/.test(f) ? f : pathToFileURL(path.resolve(f)).href);

/** 每一行字：位置、尺寸、字号、内容。空白行不算。 */
const grab = async () =>
  page.evaluate(() => {
    const root = document.querySelector('.vk-page') || document.body;
    const rows = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const cs = getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const size = Math.round(parseFloat(cs.fontSize));
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        rows.push({
          t: text.slice(0, 80),
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          size,
        });
      }
    }
    // 阅读顺序：先上后下、先左后右；同一条基线内的两段字按 x 排。
    rows.sort((a, b) => a.y - b.y || a.x - b.x || (a.t < b.t ? -1 : 1));
    return rows;
  });

const result = { version: 1, files: {} };
for (const f of files) {
  await page.goto(urlOf(f), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (window.vk?.ready) await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  result.files[path.basename(f)] = await grab();
}

await browser.close();

if (compare) {
  const base = JSON.parse(fs.readFileSync(compare, 'utf8'));
  let bad = 0;
  for (const [name, want] of Object.entries(base.files)) {
    const got = result.files[name];
    if (!got) {
      console.log(`✗ ${name} 缺失`);
      bad++;
      continue;
    }
    if (got.length !== want.length) {
      console.log(`✗ ${name} 文字行数 ${want.length} → ${got.length}`);
      bad++;
    }
    const n = Math.min(want.length, got.length);
    let worst = null;
    let drift = 0;
    for (let i = 0; i < n; i++) {
      const a = want[i];
      const b = got[i];
      const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
      if (a.t !== b.t || a.size !== b.size || d > 1) drift++;
      if (d > 1 && (!worst || d > worst.d)) worst = { d, a, b };
    }
    if (drift) {
      bad++;
      console.log(`✗ ${name} ${drift}/${n} 处超出 ±1px 或字号/文字不同`);
      if (worst) console.log(`   最差：${JSON.stringify(worst.a)} → ${JSON.stringify(worst.b)}`);
    } else {
      console.log(`✓ ${name} ${n} 行零漂移`);
    }
  }
  console.log(bad ? `\n${bad} 帧不合格` : `\n全部合格`);
  process.exit(bad ? 1 : 0);
}

const text = JSON.stringify(result, null, 0);
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, text + '\n');
  const lines = Object.values(result.files).reduce((s, a) => s + a.length, 0);
  console.log(`fingerprint: ${files.length} 页 / ${lines} 行 → ${out}`);
} else {
  console.log(text);
}
