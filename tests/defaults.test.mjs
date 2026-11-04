import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer } from '../cli/serve.mjs';
import { DEFAULTS, TAGS, TAG_NAMES, validate } from '../src/registry.mjs';
import { EFFECTS } from '../src/effects.mjs';
import { PROBES } from '../tools/lib/contract-probes.mjs';

/**
 * 默认值只有一个真源 —— 可执行的那一半。
 *
 * 三件事：
 *   1. 结构：DEFAULTS 的每个键都对应 registry 里的真实标签 / 属性（删属性不删默认 = 红）；
 *   2. 范围：数值默认值必须落在声明的 min..max 内，枚举默认值必须在词表里；
 *      `vk-cells.cols = 0`（声明范围 1..8）就是被这一条抓住的；
 *   3. 行为：在 `_site/specimen/<tag>.html` 里取**第一个实例**，把 DEFAULTS
 *      声明的默认值与「不写这个属性」分别渲染一次，读**该属性在契约里声明的那个
 *      计算样式 / DOM 计数 / 属性 / 文本**（EFFECTS / PROBES），值必须一致；
 *      再用一个非默认值做敏感度对照，确保读到的不是一条恒定的样式。
 *
 * 报红示例：把 vk-steps.current 的默认值从 -1 改成 1，第 3 条会读到
 * 第 1 步从 todo 变成 current（颜色不同），直接报出两个值。
 *
 * 有少数默认值是**上下文相关**的（例如 vk-box.border：surface 本身会带 2px 描边），
 * 不适用「不写 == 写默认值」的等价式；这些在 CONTEXT_SENSITIVE 里逐条写明原因，
 * 仍然受第 1、2 条静态检查保护。
 */

const CONTEXT_SENSITIVE = new Map([
  [
    'vk-box.border',
    'surface="paper" 自己就带 2px 描边；border="none" 是显式撤掉描边，不是默认态的等价写法。',
  ],
  ['vk-label.side', 'side 只在写 for（贴块模式）时有意义；块内标签的 data-side 只是镜像空串。'],
  ['vk-grid.gap-x', 'gap-x 的“默认”由 gap 简写决定（标本 gap="sm"）；它不是独立默认值。'],
  ['vk-grid.gap-y', 'gap-y 的“默认”由 gap 简写决定（标本 gap="sm"）；它不是独立默认值。'],
  [
    'vk-term.mass',
    '基础 .vk-line 是 70，mass="normal" 显式压到 64；这是既有 CSS 的两套值，不属于 DEFAULTS 漂移。',
  ],
  ['vk-term.title-show', '布尔属性按“写没写”生效（title-show="false" 仍是写），默认 false 与 data 镜像不同构。'],
  ['vk-page.theme', '不写 theme = 继承外层 data-theme（可能是 graphite）；固定写 paper 会破坏继承。'],
]);

/**
 * 少数属性在契约里的读法（改一个值必须变）与「默认值对不对」的读法不同。
 * vk-steps.current：契约用第 2 步的颜色证明"改 current 会改状态"；
 * 但默认值 -1 与错误默认 1 在第 2 步上都是 todo——要验默认值，得数
 * "当前步"的个数（-1 → 0，1 → 1）。
 */
const DEFAULT_READERS = new Map([
  ['vk-steps.current', { on: '.vk-step[data-state="current"]', kind: 'dom' }],
]);

test('默认值：DEFAULTS 的每个键都对应 registry 里的真实标签与属性', () => {
  const missing = [];
  for (const [tag, attrs] of Object.entries(DEFAULTS)) {
    if (!TAGS[tag]) {
      missing.push(`标签 ${tag} 不在 registry 里`);
      continue;
    }
    for (const name of Object.keys(attrs)) {
      if (!TAGS[tag].attrs?.[name]) missing.push(`${tag}.${name} 不在 registry 的属性表里`);
    }
  }
  assert.deepEqual(missing, [], `DEFAULTS 指向了不存在的声明：\n${missing.join('\n')}`);
});

test('默认值：数值 / 枚举默认值都在声明范围内', () => {
  const bad = [];
  for (const [tag, attrs] of Object.entries(DEFAULTS)) {
    const spec = TAGS[tag];
    if (!spec) continue;
    for (const [name, raw] of Object.entries(attrs)) {
      const attr = spec.attrs?.[name];
      if (!attr) continue;
      const value = String(raw);
      if (attr.values && !attr.values.includes(value)) {
        bad.push(`${tag}.${name}="${value}" 不在词表 ${attr.values.join(' / ')} 里`);
      }
      if (attr.type === 'num' || attr.type === 'int') {
        const n = Number(raw);
        if (!Number.isFinite(n)) bad.push(`${tag}.${name}="${raw}" 不是数字`);
        else if ((attr.min != null && n < attr.min) || (attr.max != null && n > attr.max)) {
          bad.push(`${tag}.${name}=${n} 越出声明范围 ${attr.min ?? '-∞'}..${attr.max ?? '∞'}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `默认值越界：\n${bad.join('\n')}`);
  assert.deepEqual(validate(), [], 'registry.validate() 必须没有错误');
});

/**
 * 只审公开标签：别名的标本页在构建期已被改写成新标签（`vk-icon` → `vk-text`），
 * 页面上不会再出现 `<vk-icon>`；别名的默认值由 DEFAULTS 静态检查与迁移测试守。
 */
const tags = TAG_NAMES.filter((tag) => DEFAULTS[tag] && fs.existsSync(`_site/specimen/${tag}.html`));

const { base, close: closeServer } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const skipped = [];
const verified = [];

/** 给一个默认值找「另一个合法值」，用来证明读到的样式确实会随属性变。 */
function otherValue(spec, raw) {
  const value = String(raw);
  if (spec.values) return spec.values.find((v) => v !== value) ?? null;
  if (spec.type === 'bool') return value === 'true' ? 'false' : 'true';
  if (spec.type === 'num' || spec.type === 'int') {
    const min = spec.min ?? Number(raw) - 1;
    const max = spec.max ?? Number(raw) + 1;
    const step = spec.step || 1;
    for (const n of [Number(raw) + step, Number(raw) - step, min, max]) {
      if (Number.isFinite(n) && n !== Number(raw) && n >= min && n <= max) return String(n);
    }
  }
  return null;
}

async function auditTag(tag) {
  await page.goto(`${base}/specimen/${tag}.html`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await window.vk?.ready?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return page.evaluate(
    async ({ tag, entries }) => {
      const host = document.querySelector(tag);
      if (!host) return { missing: true, results: [] };

      const settle = async () => {
        await window.vk?.ready?.();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 16));
      };
      // CSS 里等价的写法：读计算值时统一成一个规范名，避免 normal / start 这类假差异。
      const CANON = {
        'align-items': { normal: 'stretch' },
        'justify-content': { normal: 'flex-start' },
        'text-align': { start: 'left' },
      };
      const canon = (prop, rawValue) => {
        let v = String(rawValue ?? '').trim().toLowerCase();
        const map = CANON[prop];
        if (map && map[v]) v = map[v];
        return v;
      };
      const pick = (selector) => {
        if (!selector) return host;
        if (host.matches(selector)) return host;
        return host.querySelector(selector);
      };
      const read = (effect) => {
        if (!effect || effect.kind === 'any') return { skip: '没有可读的契约断言' };
        if (effect.kind === 'dom') {
          const selector = effect.on;
          const count = selector ? host.querySelectorAll(selector).length + (host.matches(selector) ? 1 : 0) : 1;
          return { value: String(count) };
        }
        const el = pick(effect.on);
        if (!el) return { value: null };
        if (effect.kind === 'style') return { value: canon(effect.prop, getComputedStyle(el).getPropertyValue(effect.prop)) };
        if (effect.kind === 'attr') return { value: el.getAttribute(effect.prop) };
        if (effect.kind === 'text') return { value: (el.textContent || '').replace(/\s+/g, ' ').trim() };
        if (effect.kind === 'geometry') {
          const rect = el.getBoundingClientRect();
          const key = { width: 'width', height: 'height', x: 'left', y: 'top' }[effect.prop] || effect.prop;
          return { value: String(Math.round(rect[key] * 2) / 2) };
        }
        return { skip: `不认识的 effect.kind：${effect.kind}` };
      };

      const results = [];
      for (const { name, value, sentinel, effect, reason } of entries) {
        if (reason) {
          results.push({ attr: name, value, skip: reason });
          continue;
        }
        const had = host.hasAttribute(name);
        const previous = had ? host.getAttribute(name) : null;
        try {
          host.removeAttribute(name);
          await settle();
          const without = read(effect);

          host.setAttribute(name, value);
          await settle();
          const withDefault = read(effect);

          let sensitive = null;
          if (sentinel != null) {
            host.setAttribute(name, sentinel);
            await settle();
            sensitive = read(effect);
          }

          if (without.skip || withDefault.skip) {
            results.push({ attr: name, value, skip: without.skip || withDefault.skip });
          } else if (without.value !== withDefault.value) {
            results.push({
              attr: name,
              value,
              error: `不写=${JSON.stringify(without.value)}，写 ${name}="${value}"=${JSON.stringify(withDefault.value)}`,
            });
          } else if (sensitive && !sensitive.skip && sensitive.value !== withDefault.value) {
            results.push({ attr: name, value, verified: true });
          } else {
            results.push({ attr: name, value, skip: '这个属性在首个实例上不改变契约读数（敏感度对照无差）' });
          }
        } catch (e) {
          results.push({ attr: name, value, error: String(e && e.message ? e.message : e) });
        } finally {
          if (had) host.setAttribute(name, previous);
          else host.removeAttribute(name);
          await settle();
        }
      }
      return { missing: false, results };
    },
    {
      tag,
      entries: Object.entries(DEFAULTS[tag]).map(([name, raw]) => {
        const spec = TAGS[tag].attrs[name];
        const effect =
          DEFAULT_READERS.get(`${tag}.${name}`) || PROBES[tag]?.[name]?.effect || EFFECTS[tag]?.[name];
        return {
          name,
          value: String(raw),
          sentinel: otherValue(spec, raw),
          effect,
          reason: CONTEXT_SENSITIVE.get(`${tag}.${name}`) || null,
        };
      }),
    }
  );
}

for (const tag of tags) {
  test(`默认值：${tag} 的首个标本实例，不写属性 == 显式写 DEFAULTS`, async () => {
    const { missing, results } = await auditTag(tag);
    if (missing) assert.fail(`标本页 _site/specimen/${tag}.html 里没有 <${tag}> 的第一个实例`);
    const failed = results.filter((r) => r.error);
    for (const r of results) {
      if (r.verified) verified.push(`${tag}.${r.attr}`);
      else if (r.skip) skipped.push(`${tag}.${r.attr}=${r.value}：${r.skip}`);
    }
    assert.deepEqual(
      failed,
      [],
      `${tag} 的默认值声明与运行时不一致：\n` +
        failed.map((r) => `  ${tag}.${r.attr}="${r.value}"\n    ${r.error}`).join('\n')
    );
  });
}

test('默认值：行为检查覆盖了足够多的声明（防止整组被跳过）', () => {
  assert.ok(
    verified.length >= 100,
    `只验证了 ${verified.length} 条默认值，跳过 ${skipped.length} 条：\n${skipped.slice(0, 30).join('\n')}`
  );
});

after(async () => {
  console.log(`默认值检查：行为验证 ${verified.length} 条，跳过 ${skipped.length} 条（上下文相关，见 CONTEXT_SENSITIVE）`);
  for (const s of skipped) console.log(`  · 跳过 ${s}`);
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  await closeServer();
});
