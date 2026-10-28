/**
 * vk plan —— 一套帧的容量表与布局计划。
 * ----------------------------------------------------------------------------
 * 语义：不在纸面上算布局，在浏览器里量。
 *
 *   候选（candidate）是作者/AI 给出的合法摆法，求解器逐条实测，
 *   取第一条"装得下"的；一条都不行，就报出最接近的那条，并指到真正装得下的帧。
 *
 *   为什么必须实测：CJK 折行、等宽字宽、字体度量——算不准，只有量得准。
 *   所以 plan.json 不是"预期"，是"实测记录"，它必须和截图同源。
 *
 * 用法：
 *   node tools/plan.mjs slice/deck.json      # 求解 + 截图 + 写 slice/plan.json
 *   node tools/plan.mjs slice/deck.json --dry   # 不截图
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const noSolve = args.includes('--no-solve');
const noApply = args.includes('--no-apply');
const deckPath = args.find((a) => !a.startsWith('--')) || 'slice/deck.json';
const deckDir = path.dirname(path.resolve(deckPath));
const OUT = path.join(deckDir, 'plan.json');
const SHOTS = path.join(deckDir, 'shots');

const deck = JSON.parse(fs.readFileSync(path.resolve(deckPath), 'utf8'));
const toUrl = (file) => {
  const abs = path.resolve(deckDir, file);
  return `${base}/${path.relative(ROOT, abs).replace(/\\/g, '/')}`;
};

/** 在页面里量：以 .vk-page-bd（1680×888）为基准盒。 */
const MEASURE = () => {
  const bd = document.querySelector('.vk-page-bd');
  if (!bd) return { error: 'no .vk-page-bd' };
  const box = bd.getBoundingClientRect();
  let maxBottom = box.top;
  let maxRight = box.left;
  let culprit = null;

  const walk = (el, depth) => {
    for (const c of el.children) {
      const tag = c.tagName.toLowerCase();
      if (tag === 'svg' || c.hasAttribute('data-vk-overlay')) continue;
      const b = c.getBoundingClientRect();
      if (b.width || b.height) {
        if (b.bottom > maxBottom) {
          maxBottom = b.bottom;
          culprit = { tag, depth, h: Math.round(b.height), w: Math.round(b.width) };
        }
        maxRight = Math.max(maxRight, b.right);
      }
      walk(c, depth + 1);
    }
  };
  walk(bd, 1);

  /* "用量"不能量盒子：fill 会把容器撑满，用量恒等于 1。
     只量墨水——文字实际画到哪，那才是这一帧真正用掉的高度。 */
  let inkBottom = box.top;
  const tw = document.createTreeWalker(bd, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const t = tw.currentNode;
    if (!t.textContent.trim()) continue;
    const r = document.createRange();
    r.selectNodeContents(t);
    for (const b of r.getClientRects()) if (b.height) inkBottom = Math.max(inkBottom, b.bottom);
  }

  const round = (n) => Math.round(n);
  return {
    box: { x: round(box.left), y: round(box.top), w: round(box.width), h: round(box.height) },
    content: { w: round(maxRight - box.left), h: round(maxBottom - box.top) },
    ink: { h: round(inkBottom - box.top) },
    overflowY: Math.max(0, round(maxBottom - box.bottom)),
    overflowX: Math.max(0, round(maxRight - box.right)),
    culprit,
  };
};

const why = (m) => {
  if (m.error) return m.error;
  const parts = [];
  if (m.overflowY) parts.push(`纵向溢出 ${m.overflowY}px`);
  if (m.overflowX) parts.push(`横向溢出 ${m.overflowX}px`);
  if (!parts.length) parts.push('装得下');
  if (m.culprit && (m.overflowY || m.overflowX)) {
    parts.push(`最深元素 <${m.culprit.tag}> 高 ${m.culprit.h}px / 宽 ${m.culprit.w}px`);
  }
  return parts.join('；');
};

let base = '';
const { base: b, close } = await startServer({ port: 0, root: ROOT, transform: false });
base = b;
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

const measureFile = async (file) => {
  const resp = await page.goto(toUrl(file), { waitUntil: 'load' });
  if (!resp || !resp.ok()) return { error: `HTTP ${resp?.status()}` };
  await page.evaluate(() => window.vk?.ready?.());
  await page.evaluate(() => window.vk?.freeze?.());
  return page.evaluate(MEASURE);
};

/** 等两帧：改完属性后让浏览器重排，再量。 */
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 在活页面上改一个 vk-grid 的属性并测量。 */
const mutateAndMeasure = async (i, attrs) => {
  await page.evaluate(
    ({ i, attrs }) => {
      const g = document.querySelectorAll('.vk-page-bd vk-grid')[i];
      if (!g) return;
      for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
    },
    { i, attrs }
  );
  await settle();
  return page.evaluate(MEASURE);
};

/**
 * 求解：装不下时，自己在合法维度里找一版能装下的。
 * 只动布局维度（cols / gap），绝不碰字号与对比度——那条线一动，视觉系统就没了。
 * 返回 null 表示"这个容器怎么改都装不下"，交给跨帧拆帧。
 */
const trySolve = async (file) => {
  const m0 = await measureFile(file);
  if (m0.error) return null;
  const grids = await page.evaluate(() =>
    [...document.querySelectorAll('.vk-page-bd vk-grid')].map((g, i) => ({ i, cols: g.getAttribute('cols'), gap: g.getAttribute('gap') }))
  );
  let attempts = 0;
  for (const g of grids) {
    const cur = Number(g.cols || 2);
    // 先试"少一列"：列越少格子越宽，CJK 折行越少，行数越省。
    const order = [1, 2, 3, 4, 5, 6].filter((v) => v !== cur).sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
    for (const v of order) {
      if (++attempts > 18) return null;
      const m = await mutateAndMeasure(g.i, { cols: String(v) });
      if (m.error || m.overflowY || m.overflowX) continue;
      return { gridIndex: g.i, attr: 'cols', from: g.cols || '2', to: String(v), lines: +(m.ink.h / 78).toFixed(1) };
    }
  }
  return null;
};

/** 把改动写回文件：只动那个 <vk-grid …> 开始标签里的一个属性。 */
const applyGridAttr = (file, index, attr, value) => {
  const abs = path.resolve(deckDir, file);
  const src = fs.readFileSync(abs, 'utf8');
  const re = /<vk-grid\b[^>]*>/g;
  let m;
  let i = -1;
  while ((m = re.exec(src))) {
    i++;
    if (i !== index) continue;
    const attrRe = new RegExp(`\\s${attr}="[^"]*"`);
    const tag = attrRe.test(m[0])
      ? m[0].replace(attrRe, ` ${attr}="${value}"`)
      : m[0].replace(/^<vk-grid/, `<vk-grid ${attr}="${value}"`);
    fs.writeFileSync(abs, src.slice(0, m.index) + tag + src.slice(m.index + m[0].length));
    return true;
  }
  return false;
};

const plan = {
  deck: deck.deck,
  frame: deck.frame,
  generatedAt: new Date().toISOString(),
  frames: [],
};

fs.mkdirSync(SHOTS, { recursive: true });

/* ---- 第一轮：逐帧在候选里实测择优 ---- */
for (const frame of deck.frames) {
  const candidates = frame.candidates || [frame.file];
  const tried = [];
  let chosen = null;

  for (const file of candidates) {
    const m = await measureFile(file);
    const fits = !m.error && !m.overflowY && !m.overflowX;
    tried.push({ file, fits, why: why(m), measured: m });
    if (fits && !chosen) chosen = { file, m };
  }

  if (!chosen) {
    const best = tried.slice().sort((a, b) => (a.measured.overflowY || 0) - (b.measured.overflowY || 0))[0];
    chosen = { file: best.file, m: best.measured };
  }

  const accepted = tried.find((t) => t.file === chosen.file);
  const buildEntry = (a, extra = {}) => ({
    id: frame.id,
    role: frame.role,
    file: chosen.file,
    fits: a?.fits ?? false,
    usage: a?.measured?.content
      ? {
          inkH: a.measured.ink.h,
          ratio: +(a.measured.ink.h / a.measured.box.h).toFixed(3),
          lines: +(a.measured.ink.h / 78).toFixed(1),
          budget: Math.floor(a.measured.box.h / 78),
        }
      : null,
    tried: tried.map(({ file, fits, why: w }) => ({ file, fits, why: w })),
    overflowY: Math.max(0, Math.round(a?.measured?.overflowY || 0)),
    ...extra,
  });

  let entry = buildEntry(accepted);

  if (entry.decisions === undefined && tried.length > 1 && chosen.file !== candidates[0]) {
    entry.decisions = [{ what: 'file', from: candidates[0], to: chosen.file, why: tried[0].why }];
  }

  /* 自动求解：候选都不行时，自己在合法维度里改（cols / gap），
     量到能装下为止，并把这个改动写回文件——plan 必须和产物一致。 */
  if (!entry.fits && !noSolve) {
    const fix = await trySolve(chosen.file);
    if (fix) {
      const applied = noApply ? false : applyGridAttr(chosen.file, fix.gridIndex, fix.attr, fix.to);
      const m = await measureFile(chosen.file);
      const fits = !m.error && !m.overflowY && !m.overflowX;
      const solved = { ...fix, applied, verified: fits };
      entry = buildEntry({ fits, why: why(m), measured: m }, { solved });
      if (fits) {
        console.log(
          `  ↳ ${frame.id} 自动修好：${fix.attr} ${fix.from} → ${fix.to}（${applied ? '已写回' : '未写回'}，${entry.usage?.lines}/${entry.usage?.budget} 行）`
        );
      } else {
        console.log(`  ↳ ${frame.id} 试过 ${fix.attr} ${fix.from} → ${fix.to}，仍然装不下`);
      }
    }
  }

  plan.frames.push(entry);

  if (!dry) {
    const r = await page.goto(toUrl(chosen.file), { waitUntil: 'load' });
    if (r && r.ok()) {
      await page.evaluate(() => window.vk?.ready?.());
      await page.evaluate(() => window.vk?.freeze?.());
    }
    await page.screenshot({ path: path.join(SHOTS, `${frame.id}.png`) });
  }

  const mark = entry.fits ? '✓' : '✗';
  console.log(
    `${mark} ${frame.id}  ${chosen.file}  ${entry.usage ? `${entry.usage.lines}/${entry.usage.budget} 行` : '-'}  ${tried.length > 1 ? `${tried.length} 候选` : ''}`
  );
  for (const t of entry.tried) console.log(`    · ${t.file}  ${t.fits ? 'fits' : 'overflow'}  ${t.why}`);
}

/* ---- 第二轮：跨帧容量 --------------------------------------------------------
   单帧里解不掉的，必须能指到下一帧——否则"拆帧"只是句空话。 */
const LINE = 78;
const slack = (e) => (e.fits && e.usage ? Math.max(0, +(e.usage.budget - e.usage.lines).toFixed(1)) : null);

plan.frames.forEach((entry, i) => {
  if (entry.fits) return;
  const need = Math.max(1, Math.ceil(entry.overflowY / LINE));
  const fitsNeed = (e) => slack(e) !== null && slack(e) >= need;
  const after = plan.frames.slice(i + 1).filter(fitsNeed).sort((a, b) => slack(b) - slack(a));
  const before = plan.frames.slice(0, i).filter(fitsNeed).sort((a, b) => slack(b) - slack(a));
  const forward = after[0];
  const target = forward || before[0];
  const dir = forward ? '移到' : '向前回填到';
  const budget = entry.usage?.budget || 11;
  const total = entry.usage?.lines ?? need;
  // 没有哪一帧接得住：这一帧本身超载，该拆成几帧是算得出来的。
  const splitInto = Math.max(2, Math.ceil(total / budget));
  entry.suggest = [
    target
      ? {
          action: 'move',
          moveLines: need,
          to: target.id,
          why: `本帧最省空间的一版仍溢出 ${entry.overflowY}px（约 ${need} 行）；第 ${target.id} 帧还有 ${slack(target)} 行余量，${dir}第 ${target.id} 帧${forward ? '' : '（会打乱叙事顺序）'}`,
        }
      : {
          action: 'split',
          moveLines: need,
          to: null,
          splitInto,
          why: `本帧最省空间的一版仍溢出 ${entry.overflowY}px（约 ${need} 行）；整套没有哪一帧接得住——按 ${total} 行 ÷ ${budget} 行算，这一帧要拆成 ${splitInto} 帧`,
        },
  ];
  console.log(
    `  ↳ ${entry.id} 溢出 ${entry.overflowY}px，约 ${need} 行 → ${target ? `${dir}第 ${target.id} 帧` : `拆成 ${splitInto} 帧`}`
  );
});

plan.deckSummary = {
  frames: plan.frames.length,
  fits: plan.frames.filter((f) => f.fits).length,
  lines: +plan.frames.reduce((n, f) => n + (f.usage?.lines || 0), 0).toFixed(1),
  slack: plan.frames.map((f) => ({ id: f.id, free: slack(f), budget: f.usage?.budget ?? null })),
};

/* ---- 一致性强校验：plan 说的"装得下"，再量一遍必须还是装得下 ---- */
let drift = 0;
for (const f of plan.frames) {
  const m = await measureFile(f.file);
  const fits = !m.error && !m.overflowY && !m.overflowX;
  if (fits !== f.fits) {
    drift++;
    console.error(`✗ 不一致 ${f.id}：plan=${f.fits} 实测=${fits}`);
  }
}
plan.consistent = drift === 0;

fs.writeFileSync(OUT, JSON.stringify(plan, null, 2) + '\n');
console.log(`\n容量表：${plan.deckSummary.slack.map((s) => `${s.id} 余 ${s.free ?? '—'} 行`).join(' · ')}（每帧 11 行）`);
console.log(`plan → ${path.relative(ROOT, OUT)}（${plan.frames.filter((f) => f.fits).length}/${plan.frames.length} 装得下，一致性 ${plan.consistent ? '通过' : '失败'}）`);

await browser.close();
await close();
process.exitCode = drift ? 1 : 0;
