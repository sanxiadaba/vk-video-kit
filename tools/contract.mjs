/**
 * 契约门禁：每个公开属性必须产生「声明过的效果」，并且所有取值下都过
 * 44px / 对比度 / 安全区。
 *
 *   node tools/contract.mjs                # 全部 30 个标签
 *   node tools/contract.mjs vk-code        # 单件
 *   node tools/contract.mjs --shard=1/4    # 分片（必须 1..16）
 *
 * 和像素门禁的区别：这里问「该变的变了没」，不是「有没有变」。
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { SITE } from './lib/paths.mjs';
import { TAGS, TAG_NAMES, isContent, isHidden } from '../src/registry.mjs';
import { EFFECTS } from '../src/effects.mjs';
import { diffSnap, effectHit, valuesFor } from './lib/contract-core.mjs';
import { PROBES, EFFECT_OVERRIDES, VISUAL_EXEMPT, EFFECT_ANY, EFFECT_ANY_BUDGET, SHARED_VALUES, visualExemptReason } from './lib/contract-probes.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const shardArg = process.argv.find((a) => a.startsWith('--shard='));
let shard = null;
if (shardArg) {
  const raw = shardArg.slice('--shard='.length);
  const parts = raw.split('/');
  const [i, n] = parts.map(Number);
  if (parts.length !== 2 || !Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 16 || i < 1 || i > n) {
    console.error(`无效的 --shard=${raw}：应为 i/n，n 为 1..16，i 为 1..n`);
    process.exit(1);
  }
  shard = [i, n];
}

/* ------------------------------------------------------------- 声明面预检 */
// 白名单本身也要可信：条目必须指向真实属性，预算不能偷偷超。

for (const [key, reason] of Object.entries(VISUAL_EXEMPT)) {
  const [tag, name] = key.split('.');
  if (!TAGS[tag]?.attrs?.[name]) {
    console.error(`VISUAL_EXEMPT 指向不存在的属性：${key}`);
    process.exit(1);
  }
  if (!EFFECTS[tag]?.[name]?.skipVisual) {
    console.error(`VISUAL_EXEMPT 登记的属性并没有 skipVisual：${key}`);
    process.exit(1);
  }
  if (!reason || reason.length < 8) {
    console.error(`VISUAL_EXEMPT 缺理由：${key}`);
    process.exit(1);
  }
}

if (EFFECT_ANY.length > EFFECT_ANY_BUDGET) {
  console.error(`effect:any 超预算：${EFFECT_ANY.length} > ${EFFECT_ANY_BUDGET}`);
  process.exit(1);
}
for (const item of EFFECT_ANY) {
  if (!TAGS[item.tag]?.attrs?.[item.attr]) {
    console.error(`effect:any 指向不存在的属性：${item.tag}.${item.attr}`);
    process.exit(1);
  }
  if (!item.reason || item.reason.length < 8) {
    console.error(`effect:any 缺理由：${item.tag}.${item.attr}`);
    process.exit(1);
  }
}

let tags = only.length ? only : TAG_NAMES;
if (only.length) {
  const unknown = tags.filter((t) => !TAGS[t]);
  if (unknown.length) {
    console.error(`不在 registry 的标签：${unknown.join(', ')}`);
    process.exit(1);
  }
}
if (shard) tags = tags.filter((_, idx) => idx % shard[1] === shard[0] - 1);
if (!tags.length) {
  console.error(`没有匹配的标签：${only.join(' ') || '<全部>'}${shard ? `（shard ${shard[0]}/${shard[1]}）` : ''}`);
  process.exit(1);
}

const STYLE_PROPS = [
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'color',
  'background-color',
  'border-top-width',
  'border-bottom-width',
  'border-left-width',
  'border-right-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'opacity',
  'text-align',
  'white-space',
  'display',
  'visibility',
  'transform',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
];

/* ------------------------------------------------------------- 页面内函数 */

function pathInPage(el, root) {
  const parts = [];
  let n = el;
  while (n && n !== root) {
    const p = n.parentElement;
    if (!p) break;
    parts.unshift([...p.children].indexOf(n));
    n = p;
  }
  return parts.join('/');
}

function snapshotInPage(tag) {
  const STYLE = [
    'font-size', 'font-weight', 'font-family', 'line-height', 'color', 'background-color',
    'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top',
    'opacity', 'text-align', 'white-space', 'display', 'visibility', 'transform',
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'box-shadow',
    'border-radius', 'border-left-color', 'border-top-color', 'max-width', 'max-height',
    'width', 'height', 'aspect-ratio', 'object-fit', 'object-position', 'text-decoration-line',
    'grid-template-columns', 'row-gap', 'column-gap', 'list-style-type',
    'flex-wrap', 'align-items', 'align-self', 'justify-content', 'justify-items', 'flex-direction', 'flex-grow', 'grid-template-rows',
    'overflow', 'overflow-x', 'overflow-y', 'left', 'top', 'background-image', 'background-size',
    '--vk-note-line', '--vk-box-line', '--vk-box-bg', '--vk-mark-fill', '--vk-icon-size',
  ];
  const pathOf = (el, root) => {
    const parts = [];
    let n = el;
    while (n && n !== root) {
      const p = n.parentElement;
      if (!p) break;
      parts.unshift([...p.children].indexOf(n));
      n = p;
    }
    return parts.join('/');
  };
  const root = document.querySelector(tag);
  if (!root) return {};
  const out = {};
  const add = (el) => {
    const key = pathOf(el, root);
    const cs = getComputedStyle(el);
    const row = {};
    for (const p of STYLE) row[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    row['rect.w'] = Math.round(r.width * 10) / 10;
    row['rect.h'] = Math.round(r.height * 10) / 10;
    row['rect.x'] = Math.round(r.left * 10) / 10;
    row['rect.y'] = Math.round(r.top * 10) / 10;
    for (const a of ['d', 'stroke', 'stroke-width', 'stroke-dasharray', 'fill', 'data-style']) {
      if (el.hasAttribute(a)) row['@' + a] = el.getAttribute(a);
    }
    // 契约用 data-* 表达结构状态（variant / show / active / group / grid…）。
    // data-vk-* 是运行时内部标记，不参与断言。
    for (const a of el.attributes) {
      if (a.name.startsWith('data-') && !a.name.startsWith('data-vk-')) row['@' + a.name] = a.value;
    }
    if (!el.children.length && el.textContent.trim()) row['#text'] = el.textContent.trim().slice(0, 120);
    out[key] = row;
  };
  add(root);
  for (const el of root.querySelectorAll('*')) add(el);
  return out;
}

function effectTargetPathsInPage({ tag, on }) {
  const root = document.querySelector(tag);
  if (!root) return [];
  const pathOf = (el) => {
    const parts = [];
    let n = el;
    while (n && n !== root) {
      const p = n.parentElement;
      if (!p) break;
      parts.unshift([...p.children].indexOf(n));
      n = p;
    }
    return parts.join('/');
  };
  const nodes = root.matches(on) ? [root] : [...root.querySelectorAll(on)];
  return nodes.map(pathOf);
}

function visualInPage(tag) {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const blend = (f, b) => {
    const a = f.a + b.a * (1 - f.a);
    if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a,
      g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a,
      b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a,
      a,
    };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const bgOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.01) {
        acc = acc ? blend(acc, c) : c;
        if (c.a >= 0.99) break;
      }
      n = n.parentElement;
    }
    const white = { r: 255, g: 255, b: 255, a: 1 };
    return acc ? blend(acc, white) : white;
  };
  const opaque = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      if (parseFloat(getComputedStyle(n).opacity) < 0.5) return false;
      n = n.parentElement;
    }
    return true;
  };

  const root = document.querySelector(tag);
  if (!root) return [{ type: 'missing', what: tag }];
  const stage = document.querySelector('.vk-stage') || document.body;
  const sr = stage.getBoundingClientRect();
  const out = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.katex') || el.closest('.vk-sr') || el.closest('.vk-anno-lines')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && opaque(el)) {
      const fs = parseFloat(cs.fontSize);
      if (fs < 43.5) out.push({ type: 'font', what: (el.className || el.tagName).toString().slice(0, 50), fs });
      const fg = parse(cs.color);
      if (fg) {
        const cr = ratio(fg, bgOf(el));
        const need = fs >= 72 ? 3 : 4.5;
        if (cr < need) out.push({ type: 'contrast', what: (el.className || el.tagName).toString().slice(0, 50), cr: +cr.toFixed(2), need });
      }
    }
    if (r.left < -4 || r.top < -4 || r.right > 1924 || r.bottom > 1084) {
      out.push({ type: 'overflow', what: (el.className || el.tagName).toString().slice(0, 50) });
    }
    if (sr.width && (r.left < sr.left - 2 || r.right > sr.right + 2 || r.top < sr.top - 2 || r.bottom > sr.bottom + 2)) {
      out.push({ type: 'safe', what: (el.className || el.tagName).toString().slice(0, 50) });
    }
    const ox = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const oy = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (ox && el.scrollWidth > el.clientWidth + 3) out.push({ type: 'clip', what: (el.className || el.tagName).toString().slice(0, 50) });
    if (oy && el.scrollHeight > el.clientHeight + 3) out.push({ type: 'clip-y', what: (el.className || el.tagName).toString().slice(0, 50) });
  }
  const uniq = [];
  const seen = new Set();
  for (const i of out) {
    const k = `${i.type}|${i.what}|${i.fs ?? ''}|${i.cr ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(i);
  }
  return uniq.slice(0, 12);
}

/* ------------------------------------------------------------------ 工具 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const paint = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const { base, close } = await startServer({ port: 0, root: SITE, transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const failures = [];
const checked = [];

async function open(tag) {
  // vk-page 没有场景；frame-0 是稳定宿主。
  const pagePath =
    tag === 'vk-page'
      ? fs.existsSync(`${SITE}/frames/frame-0.html`)
        ? 'frames/frame-0.html'
        : 'specimens/vk-page.html'
      : `specimens/${tag}.html`;
  const resp = await page.goto(`${base}/${pagePath}`, { waitUntil: 'load' });
  if (!resp || !resp.ok()) throw new Error(`${tag}: HTTP ${resp?.status()}`);
  await page.evaluate(() => window.vk?.ready?.());
  await page.evaluate(() => window.vk?.freeze?.());
  if (process.env.VK_INJECT_CSS) await page.addStyleTag({ content: process.env.VK_INJECT_CSS });
  await page.waitForTimeout(40);
}

async function setAttr(tag, name, value) {
  await page.evaluate(
    ({ tag, name, value }) => {
      for (const el of document.querySelectorAll(tag)) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      window.vk?.layout?.();
    },
    { tag, name, value }
  );
  await paint();
}

async function restore(tag, attrs) {
  await page.evaluate(
    ({ tag, attrs }) => {
      for (const el of document.querySelectorAll(tag)) {
        for (const a of [...el.attributes]) el.removeAttribute(a.name);
        for (const [k, v] of attrs) el.setAttribute(k, v);
      }
      window.vk?.layout?.();
    },
    { tag, attrs }
  );
  await paint();
}

async function baseAttrs(tag) {
  return page.evaluate((tag) => {
    const el = document.querySelector(tag);
    return el ? [...el.attributes].map((a) => [a.name, a.value]) : [];
  }, tag);
}

async function effectPaths(tag, on) {
  return page.evaluate(
    ({ tag, on }) => {
      const pathOf = (el, root) => {
        const parts = [];
        let n = el;
        while (n && n !== root) {
          const p = n.parentElement;
          if (!p) break;
          parts.unshift([...p.children].indexOf(n));
          n = p;
        }
        return parts.join('/');
      };
      const root = document.querySelector(tag);
      if (!root) return [];
      const els = root.matches(on) ? [root] : [...root.querySelectorAll(on)];
      return els.map((el) => pathOf(el, root));
    },
    { tag, on }
  );
}

async function countSel(tag, sel) {
  return page.evaluate(
    ({ tag, sel }) => document.querySelector(tag)?.querySelectorAll(sel).length ?? 0,
    { tag, sel }
  );
}

try {
  for (const tag of tags) {
    if (!TAGS[tag]) {
      failures.push(`${tag}: 不在 registry`);
      continue;
    }
    await open(tag);
    const attrs = TAGS[tag].attrs || {};
    const original = await baseAttrs(tag);
    const baseSnap = await page.evaluate(snapshotInPage, tag);
    const baseVisual = await page.evaluate(visualInPage, tag);
    if (baseVisual.length) failures.push(`${tag}: 默认态画面问题 ${JSON.stringify(baseVisual.slice(0, 3))}`);
    const visualSeen = new Set(baseVisual.length ? [JSON.stringify(baseVisual.slice(0, 3))] : []);

    const missingEffect = [];
    let attrChecked = 0;

    for (const [name, spec] of Object.entries(attrs)) {
      if (isContent(tag, name) || isHidden(tag, name)) continue;
      const key = `${tag}.${name}`;
      const probe = PROBES[tag]?.[name];
      const effect = EFFECT_OVERRIDES[key] || probe?.effect || EFFECTS[tag]?.[name];
      const any = EFFECT_ANY.find((e) => e.tag === tag && e.attr === name);
      if (!effect && !any) {
        missingEffect.push(name);
        continue;
      }
      const eff = effect || { kind: 'any', reason: any.reason };
      const shared =
        !probe && !spec.values && (spec.type === 'text' || spec.type === 'size' || spec.type === undefined) && SHARED_VALUES[name]
          ? { values: SHARED_VALUES[name] }
          : undefined;
      const values = valuesFor(spec, probe || shared);
      if (!values.length && eff.kind !== 'any') {
        failures.push(`${key}: 有 effect 但没有可测取值（text/lines 请登记 PROBES.values）`);
        continue;
      }

      if (eff.on) {
        const exists = await page.evaluate(
          ({ tag, on }) => {
            const root = document.querySelector(tag);
            if (!root) return false;
            return root.matches(on) || !!root.querySelector(on);
          },
          { tag, on: eff.on }
        );
        if (!exists) failures.push(`${key}: effect.on ${eff.on} 不存在`);
      }
      const targetPaths = eff.on ? await page.evaluate(effectTargetPathsInPage, { tag, on: eff.on }) : null;
      const skipVisual = !!eff.skipVisual;
      const exempt = visualExemptReason(key);
      if (skipVisual && !VISUAL_EXEMPT[key]) failures.push(`${key}: effect.skipVisual 未登记 VISUAL_EXEMPT 白名单`);

      const beforeCount = eff.kind === 'dom' ? await countSel(tag, eff.prop) : 0;
      let best = null;
      for (const raw of values) {
        if (spec.when) {
          for (const [k, allowed] of Object.entries(spec.when)) {
            await setAttr(tag, k, [].concat(allowed)[0]);
          }
        }
        const has = original.some(([k]) => k === name);
        const value = raw === '__toggle__' ? (has ? null : '') : raw;
        await setAttr(tag, name, value);
        const snap = await page.evaluate(snapshotInPage, tag);
        const diffs = diffSnap(baseSnap, snap);
        const visual = exempt ? [] : await page.evaluate(visualInPage, tag);
        const afterCount = eff.kind === 'dom' ? await countSel(tag, eff.prop) : 0;
        const hit = effectHit(eff, diffs, beforeCount, afterCount, targetPaths);
        // dom 类效果不一定产生快照 diff；优先保留命中的那一档。
        if (!best || (hit.ok && !best.hit.ok) || (hit.ok === best.hit.ok && diffs.length > best.diffs.length)) {
          best = { value, diffs, visual, hit };
        }
        if (visual.length) {
          const vk = JSON.stringify(visual.slice(0, 3));
          if (!visualSeen.has(vk)) {
            visualSeen.add(vk);
            failures.push(`${key}=${value}: ${vk}`);
          }
        }
        await restore(tag, original);
      }
      attrChecked++;
      checked.push({ tag, name });
      if (eff.kind === 'any') {
        console.log(`  · ${key} effect:any（${eff.reason}）`);
      } else if (!best.diffs.length) {
        failures.push(`${key}: 所有取值都没有变化（no-op）`);
      } else if (!best.hit.ok) {
        failures.push(`${key}: 没命中声明效果 ${best.hit.detail}`);
      }
    }

    if (missingEffect.length) {
      failures.push(`${tag}: ${missingEffect.length} 个公开属性缺 effect（${missingEffect.join(', ')}）`);
    }
    console.log(`${missingEffect.length ? '✗' : '✓'} ${tag}  ${attrChecked}/${Object.keys(attrs).length} 个公开属性有声明`);

    for (const s of TAGS[tag].states || []) {
      await setAttr(tag, 'state', s);
      const snap = await page.evaluate(snapshotInPage, tag);
      const diffs = diffSnap(baseSnap, snap);
      const visual = await page.evaluate(visualInPage, tag);
      if (!diffs.length) failures.push(`${tag}.state=${s}: 没有变化`);
      if (visual.length) failures.push(`${tag}.state=${s}: ${JSON.stringify(visual.slice(0, 3))}`);
      await restore(tag, original);
      checked.push({ tag, name: `state=${s}` });
      console.log(`  ✓ state=${s}${diffs.length ? `  ${diffs.length} 项变化` : ''}`);
    }
  }
  if (!checked.length) failures.push('契约没有检查任何属性：0 个对象不算通过');
} catch (e) {
  failures.push(`运行失败：${e?.message || e}`);
} finally {
  await browser.close();
  await close();
}

console.log('');
if (failures.length) {
  console.log(`\n契约失败 ${failures.length} 条：`);
  for (const f of failures) console.log('  ✗ ' + f);
  process.exitCode = 1;
} else {
  console.log(`\n契约通过：${checked.length} 个属性 / state，${tags.length} 个标签。`);
}
