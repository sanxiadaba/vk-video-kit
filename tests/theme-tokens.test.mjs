import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS } from '../src/shared/limits.mjs';
import {
  THEME_NAMES,
  TONES,
  THEME_FILES,
  readTokenCss,
  readBlocks,
  readVariables,
  readColorTokens,
  resolveVar,
  parseColor,
  mixHex,
  contrast,
  hueDistance,
  rgbCss,
} from './lib/surface-tokens.mjs';

/**
 * L0 · 主题（theme）
 *
 * 主题是一张表：一套主题 = 98 个 --vk-theme-*。这一组测试只读 CSS，不启动浏览器，
 * 锁五件事：
 *   1. 三套主题各自完整（不是靠继承别的主题）；
 *   2. 每个最终名（--vk-paper-ink-1 …）在三套主题下都解得出颜色；
 *   3. 淡底 / 影 / 弱色由实色按同一条公式派生，不新增色相；
 *   4. 正文对比度 ≥ 7:1，标注 ≥ 4.5:1（与 LIMITS 同一条线）；
 *   5. 默认主题仍然是 15.x 的 20 个淡底 + 纸墨值。
 *
 * 默认主题零像素变化由 .tmp 里的截图逐像素比对给出（31 页 / 64,281,600 像素），
 * 这里锁的是"token 级"的同一件事：值错了，像素一定会变。
 */

const css = readTokenCss();
const blocks = readBlocks(css);

/** 一套主题自己声明的 token（不含从 :root 继承来的）。 */
const ownTokens = (theme) =>
  blocks.find((b) => b.selectors.some((s) => s === `[data-theme="${theme}"]`))?.decls || new Map();

const union = new Set();
for (const theme of THEME_NAMES) for (const k of ownTokens(theme).keys()) union.add(k);

const palette = Object.fromEntries(THEME_NAMES.map((t) => [t, readColorTokens(css, { theme: t })]));
const value = (theme, name) => {
  const v = palette[theme][name];
  assert.ok(v, `${theme} 缺少 ${name}`);
  return v;
};

/* ------------------------------------------------------------- 1. 完整性 */

test('主题 · 三套主题都完整（98 个 --vk-theme-*，不靠继承）', () => {
  assert.deepEqual(THEME_NAMES, ['paper', 'graphite', 'blueprint'], '内置主题就是这三套');
  assert.equal(union.size, 98, `一套主题应该是 98 个 --vk-theme-*，实际 ${union.size}`);
  for (const theme of THEME_NAMES) {
    const own = [...ownTokens(theme).keys()].sort();
    assert.deepEqual(
      own,
      [...union].sort(),
      `${theme} 少声明或多声明了主题 token——三套必须各自完整，不能继承别的主题`
    );
    for (const k of own) assert.match(k, /^--vk-theme-[a-z0-9-]+$/, `主题 token 必须叫 --vk-theme-*：${k}`);
  }
  // 纸与 surface-0 是同一个值；scrim 就是墨 1；代码面的正文是纸色反白。
  for (const theme of THEME_NAMES) {
    assert.equal(value(theme, '--vk-theme-surface-0'), value(theme, '--vk-theme-paper'), `${theme}：surface-0 必须就是纸`);
    assert.equal(value(theme, '--vk-theme-scrim'), value(theme, '--vk-theme-ink-1'), `${theme}：遮罩色就是墨 1`);
    assert.equal(value(theme, '--vk-theme-code-fg'), value(theme, '--vk-theme-paper'), `${theme}：深色代码面的正文用纸色反白`);
    assert.equal(value(theme, '--vk-theme-on-accent'), '#ffffff', `${theme}：实色块上的字是白`);
  }
});

const COLOR = /^(#[0-9a-f]{6}|rgba?\([^)]+\))$/i;

test('主题 · 每个最终名在三套主题下都解得出颜色', () => {
  const tokensOnly = fs.readFileSync(THEME_FILES[1], 'utf8');
  const names = [...tokensOnly.matchAll(/^\s*(--vk-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
  const paperVars = readVariables(css, 'paper');
  // 只挑"默认主题下解成颜色"的名字：尺寸 / 字体 / 影不在这一组里。
  const colorNames = names.filter((n) => COLOR.test(resolveVar(paperVars, n) || ''));
  assert.ok(colorNames.length >= 90, `最终的颜色变量应该有 90+ 个，实际 ${colorNames.length}`);
  for (const theme of THEME_NAMES) {
    const vars = readVariables(css, theme);
    const missing = colorNames.filter((n) => !COLOR.test(resolveVar(vars, n) || '')).map((n) => `${n}=${resolveVar(vars, n)}`);
    assert.deepEqual(missing, [], `${theme} 下这些最终名解不出颜色（主题里缺 token，或别名链断了）`);
  }
});

/* --------------------------------------------------------- 2. 零野生色 */

test('主题 · 最终名全部由 --vk-theme-* 派生（tokens.css 零野生色）', () => {
  const stripped = fs.readFileSync(THEME_FILES[1], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [...stripped.matchAll(/(--vk-[a-z0-9-]+)\s*:\s*([^;]+);/g)];
  const wild = decls.filter(([, , v]) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(v)).map(([, k, v]) => `${k}: ${v.trim()}`);
  assert.deepEqual(wild, [], '值层不许出现 hex / rgba：颜色只有主题层一个来源');
  // 颜色类最终名只能写成 var(--vk-…)：值来自主题层，或另一层别名。
  const paperVars = readVariables(css, 'paper');
  const bad = decls
    .filter(([, k]) => COLOR.test(resolveVar(paperVars, k) || ''))
    .filter(([, , v]) => !/^var\(--vk-/.test(v.trim()))
    .map(([, k, v]) => `${k}: ${v.trim()}`);
  assert.deepEqual(bad, [], '颜色变量只能写成 var(--vk-…)：值来自主题或另一层别名');
});

test('主题 · 组件 CSS 不写死颜色', () => {
  const dirs = ['src/elements', 'src/layout', 'src/components', 'src/compositions'];
  const files = dirs.flatMap((d) =>
    fs
      .readdirSync(d)
      .filter((f) => f.endsWith('.css'))
      .map((f) => path.join(d, f))
  );
  const wild = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g)) wild.push(`${file}: ${m[1]}`);
  }
  assert.deepEqual(wild, [], '组件层只读语义变量：颜色写进组件，换主题就会漏一块');
});

/* ------------------------------------------------------- 3. 派生与对比度 */

test('主题 · 淡底与影由同一支实色混出（9% / 22% / 16% / 36%）', () => {
  for (const theme of THEME_NAMES) {
    const paper = value(theme, '--vk-theme-paper');
    const ink1 = value(theme, '--vk-theme-ink-1');
    for (const tone of TONES) {
      const solid = value(theme, `--vk-theme-${tone === 'focus' ? 'accent' : tone}`);
      assert.equal(
        value(theme, `--vk-theme-wash-${tone}`),
        mixHex(paper, solid, 0.09),
        `${theme}.wash-${tone} 必须是纸与 ${tone} 混 9%`
      );
      assert.equal(
        value(theme, `--vk-theme-tint-${tone}`),
        mixHex(paper, solid, 0.22),
        `${theme}.tint-${tone} 必须是纸与 ${tone} 混 22%`
      );
      assert.equal(
        value(theme, `--vk-theme-dark-wash-${tone}`),
        mixHex(ink1, solid, 0.16),
        `${theme}.dark-wash-${tone} 必须是墨 1 与 ${tone} 混 16%`
      );
      assert.equal(
        value(theme, `--vk-theme-dark-tint-${tone}`),
        mixHex(ink1, solid, 0.36),
        `${theme}.dark-tint-${tone} 必须是墨 1 与 ${tone} 混 36%`
      );
    }
    // 影 = 墨 1 的 rgb + 固定 alpha：换纸不会让影子发蓝。
    const inkRgb = parseColor(ink1).rgb;
    for (const [name, a] of [
      ['hair', 0.04],
      ['soft', 0.06],
      ['mid', 0.12],
      ['deep', 0.24],
    ]) {
      const shadow = parseColor(value(theme, `--vk-theme-shadow-${name}`));
      assert.deepEqual(shadow.rgb, inkRgb, `${theme}.shadow-${name} 的 rgb 必须等于墨 1`);
      assert.equal(shadow.a, a, `${theme}.shadow-${name} 的 alpha 必须是 ${a}`);
    }
  }
});

test('主题 · 弱色与实色同色相，alpha 只有一份表', () => {
  /** [弱色 token, 它的实色, alpha]——alpha 是全库唯一的一张表。 */
  const TRANSLUCENT = [
    ['accent-soft', 'accent', 0.16],
    ['accent-mark', 'accent', 0.24],
    ['accent-hl', 'accent', 0.12],
    ['info-soft', 'info', 0.1],
    ['info-mark', 'info', 0.22],
    ['ok-weak', 'ok', 0.08],
    ['ok-mark', 'ok', 0.22],
    ['err-weak', 'err', 0.08],
    ['err-mark', 'err', 0.2],
    ['warn-weak', 'warn', 0.08],
    ['warn-mark', 'warn', 0.22],
    ['add-weak', 'add', 0.1],
    ['add-mark', 'add', 0.22],
    ['del-weak', 'del', 0.09],
    ['del-mark', 'del', 0.2],
    ['mod-weak', 'mod', 0.1],
    ['mod-mark', 'mod', 0.22],
    ['code-accent-soft', 'code-accent', 0.22],
  ];
  for (const theme of THEME_NAMES) {
    for (const [name, solidName, alpha] of TRANSLUCENT) {
      const c = parseColor(value(theme, `--vk-theme-${name}`));
      assert.ok(c, `${theme}.${name} 必须是 rgba()`);
      assert.equal(c.a, alpha, `${theme}.${name} 的 alpha 必须是 ${alpha}`);
      const solid = value(theme, `--vk-theme-${solidName}`);
      const d = hueDistance(c.rgbHex, solid);
      // paper 的 mod 两档历史上是 (138, 90, 0)，比实色偏 6.5°；三套都用同一支棕，≤8° 都算同一色相。
      assert.ok(d <= 8, `${theme}.${name} 与 ${solidName} 的色相偏了 ${d.toFixed(1)}°（应 ≤8°）`);
    }
  }
});

test('主题 · 三套主题的正文对比度 ≥ 7:1', () => {
  const pairs = [];
  for (const theme of THEME_NAMES) {
    const paper = value(theme, '--vk-theme-paper');
    const ink1 = value(theme, '--vk-theme-ink-1');
    for (const i of [1, 2, 3]) pairs.push([theme, `ink-${i} / paper`, value(theme, `--vk-theme-ink-${i}`), paper, LIMITS.contrastText]);
    pairs.push([theme, 'ink-4 / paper', value(theme, '--vk-theme-ink-4'), paper, LIMITS.contrastMuted]);
    for (const s of [2, 3]) pairs.push([theme, `ink-1 / surface-${s}`, ink1, value(theme, `--vk-theme-surface-${s}`), LIMITS.contrastText]);
    for (const tone of ['accent', 'info', 'ok-ink', 'err-ink', 'warn-ink']) {
      pairs.push([theme, `${tone} / paper`, value(theme, `--vk-theme-${tone}`), paper, LIMITS.contrastText]);
    }
    for (const tone of TONES) {
      pairs.push([theme, `ink-1 / wash-${tone}`, ink1, value(theme, `--vk-theme-wash-${tone}`), LIMITS.contrastText]);
      pairs.push([theme, `ink-1 / tint-${tone}`, ink1, value(theme, `--vk-theme-tint-${tone}`), LIMITS.contrastText]);
      pairs.push([theme, `paper / dark-wash-${tone}`, paper, value(theme, `--vk-theme-dark-wash-${tone}`), LIMITS.contrastText]);
      pairs.push([theme, `paper / dark-tint-${tone}`, paper, value(theme, `--vk-theme-dark-tint-${tone}`), LIMITS.contrastText]);
    }
    // 实色块上的反白字：大字/图标档，按 4.5:1。
    for (const tone of ['accent', 'info', 'ok', 'err', 'warn']) {
      pairs.push([theme, `on-accent / ${tone}`, value(theme, '--vk-theme-on-accent'), value(theme, `--vk-theme-${tone}`), LIMITS.contrastMuted]);
    }
    // 深色代码面：正文 ≥7，元信息与语法 ≥4.5（颜色在这里是编码）。
    const codeBg = value(theme, '--vk-theme-code-bg');
    pairs.push([theme, 'code-fg / code-bg', value(theme, '--vk-theme-code-fg'), codeBg, LIMITS.contrastText]);
    for (const name of ['code-fg-2', 'code-meta', 'code-meta-2', 'code-accent', 'code-info', 'code-ok', 'code-err', 'code-warn']) {
      pairs.push([theme, `${name} / code-bg`, value(theme, `--vk-theme-${name}`), codeBg, LIMITS.contrastMuted]);
    }
  }
  const bad = [];
  for (const [theme, what, fg, bg, min] of pairs) {
    const c = contrast(fg, bg);
    if (c < min) bad.push(`${theme} ${what}: ${c.toFixed(2)}:1 < ${min}:1（${fg} on ${bg}）`);
  }
  assert.deepEqual(bad, [], `对比度不达标：\n${bad.join('\n')}`);
  assert.ok(pairs.length > 60, `应该逐条量 60+ 组，实际 ${pairs.length}`);
});

/* ------------------------------------------------------ 4. 默认主题 = 15.x */

test('主题 · 默认主题仍是 15.x 的配色（纸 / 墨 / 淡底 / 线）', () => {
  /** 15.x 的 20 个淡底 + 纸墨 + 线 + 强调。默认主题动了任何一个，这里就红。 */
  const PAPER_15 = {
    '--vk-theme-paper': '#ffffff',
    '--vk-theme-ink-1': '#0b0f14',
    '--vk-theme-ink-2': '#333d4b',
    '--vk-theme-ink-3': '#4b5563',
    '--vk-theme-ink-4': '#5c6674',
    '--vk-theme-surface-1': '#f7f9fc',
    '--vk-theme-surface-2': '#eef2f7',
    '--vk-theme-surface-3': '#e2e9f2',
    '--vk-theme-surface-4': '#cfd9e6',
    '--vk-theme-accent': '#1b3fd6',
    '--vk-theme-line-1': '#d8e2ee',
    '--vk-theme-line-2': '#edf2f8',
    '--vk-theme-line-3': '#b9c7d7',
    '--vk-theme-line-strong': '#8b97a8',
    '--vk-theme-wash-info': '#edeef0',
    '--vk-theme-tint-info': '#d4d6d9',
    '--vk-theme-wash-focus': '#eaeefb',
    '--vk-theme-tint-focus': '#cdd5f6',
    '--vk-theme-wash-ok': '#e9f2f0',
    '--vk-theme-tint-ok': '#c9deda',
    '--vk-theme-wash-err': '#f8ebeb',
    '--vk-theme-tint-err': '#eecfce',
    '--vk-theme-wash-warn': '#f4efe8',
    '--vk-theme-tint-warn': '#e5d7c7',
    '--vk-theme-dark-wash-info': '#13171e',
    '--vk-theme-dark-tint-info': '#1c222b',
    '--vk-theme-dark-wash-focus': '#0e1733',
    '--vk-theme-dark-tint-focus': '#11205a',
    '--vk-theme-dark-wash-ok': '#0b1e1f',
    '--vk-theme-dark-tint-ok': '#0b302c',
    '--vk-theme-dark-wash-err': '#261316',
    '--vk-theme-dark-tint-err': '#471718',
    '--vk-theme-dark-wash-warn': '#1f1911',
    '--vk-theme-dark-tint-warn': '#39250d',
    '--vk-theme-code-bg': '#0b0f14',
    '--vk-theme-code-fg': '#ffffff',
    '--vk-theme-code-accent': '#7aa2ff',
  };
  const got = Object.fromEntries(Object.keys(PAPER_15).map((k) => [k, value('paper', k)]));
  assert.deepEqual(got, PAPER_15, '默认主题必须与 15.x 逐字相同（像素回归的前提）');
  assert.equal(rgbCss(value('paper', '--vk-theme-paper')), 'rgb(255, 255, 255)', '纸还是纯白');
});
