/**
 * 表面色阶的测试侧读数（不启动浏览器）。
 *
 * 做三件事：
 *  1. 从 src/tokens/themes.css + src/tokens/tokens.css 读颜色；
 *  2. 把 var() 别名链解开（最终名 → 主题 token），默认主题 = paper；
 *  3. 把 vk-panel 的 variant × tone → 底色的规范写在这里。
 *
 * 第 3 条故意与 CSS 分开写：如果 CSS 改错了，测试读的是规范而不是实现。
 * 改映射必须同时改 src/elements/elements.css 与本文件——两边不一致就红。
 *
 * 为什么现在要解 var()：15.x 之前颜色是写死的 hex，直接正则抓；
 * 现在最终名全部 = var(--vk-theme-*)，literal 只在主题层。
 * 解链用的是「最终计算值」的语义：:root 给默认，[data-theme] 覆盖。
 */
import fs from 'node:fs';

export const TONES = ['info', 'focus', 'ok', 'err', 'warn'];

/** 三套内置主题：名字必须与 src/tokens/themes.css 的 [data-theme] 一致。 */
export const THEME_NAMES = ['paper', 'graphite', 'blueprint'];

/** 两个文件是一层：主题（literal）+ 值（别名）。读的时候按这个顺序拼。 */
export const THEME_FILES = ['src/tokens/themes.css', 'src/tokens/tokens.css'];

export function readTokenCss() {
  return THEME_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

/** 语义色的实色：文字/图标用文字档，面用这一组原色。 */
export const SOLID_TOKENS = {
  info: '--vk-paper-info',
  focus: '--vk-paper-focus',
  ok: '--vk-ok-paper',
  err: '--vk-err-paper',
  warn: '--vk-warn-paper',
};

export const WASH_TOKENS = Object.fromEntries(TONES.map((t) => [t, `--vk-wash-${t}`]));
export const TINT_TOKENS = Object.fromEntries(TONES.map((t) => [t, `--vk-tint-${t}`]));
export const DARK_WASH_TOKENS = Object.fromEntries(TONES.map((t) => [t, `--vk-dark-wash-${t}`]));
export const DARK_TINT_TOKENS = Object.fromEntries(TONES.map((t) => [t, `--vk-dark-tint-${t}`]));

/**
 * vk-panel 的底色规范（与 CSS 同义）：
 *   plain / raised + tone → wash
 *   inset        + tone → tint
 *   dark         + tone → 深色 wash
 * 没有 tone（neutral）时回到四档表面本身的明度。
 */
export const PANEL_BASE_TOKEN = {
  plain: '--vk-sf-0',
  raised: '--vk-sf-1',
  inset: '--vk-sf-2',
  dark: '--vk-ink-1',
};

/** 标题带：有 tone 时抬一档（浅色 → tint，深色 → 深色 tint）。 */
export const PANEL_HEADER_BASE_TOKEN = {
  plain: '--vk-sf-1',
  raised: '--vk-sf-2',
  inset: '--vk-sf-3',
  dark: '--vk-ink-2',
};

/* --------------------------------------------------------------- 解析 */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** 选择器块：[{ selectors: string[], decls: Map }]。token 文件里没有嵌套规则。 */
export function readBlocks(css) {
  const out = [];
  const text = stripComments(css);
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const decls = new Map();
    for (const d of m[2].matchAll(/(--vk-[\w-]+)\s*:\s*([^;]+);/g)) decls.set(d[1], d[2].trim());
    if (decls.size) out.push({ selectors, decls });
  }
  return out;
}

const isDefault = (sel) => sel === ':root' || sel === '[data-theme="paper"]';
const isTheme = (sel, theme) => sel === `[data-theme="${theme}"]`;

/**
 * 一套主题的最终声明表：:root（默认 = paper）+ 该主题的覆盖块。
 * @returns {Map<string,string>} 未解 var() 的原始值
 */
export function readVariables(css, theme = 'paper') {
  const blocks = readBlocks(css);
  const map = new Map();
  for (const b of blocks) {
    if (!b.selectors.some(isDefault)) continue;
    for (const [k, v] of b.decls) map.set(k, v);
  }
  if (theme !== 'paper') {
    for (const b of blocks) {
      if (!b.selectors.some((s) => isTheme(s, theme))) continue;
      for (const [k, v] of b.decls) map.set(k, v);
    }
  }
  return map;
}

/** 解开 var() 链；解不开（缺 token）时返回 null，让测试报红而不是静默。 */
export function resolveVar(map, name, depth = 0) {
  const raw = map.get(name);
  if (raw === undefined) return null;
  const alias = raw.match(/^var\(\s*(--vk-[\w-]+)\s*(?:,[^)]*)?\)$/);
  if (alias) {
    if (depth > 8) throw new Error(`var() 链太深：${name}`);
    return resolveVar(map, alias[1], depth + 1);
  }
  return raw;
}

/** 所有能解成 hex 的自定义属性（旧接口：测试只关心最终色值）。 */
export function readHexTokens(css, { theme = 'paper' } = {}) {
  const map = readVariables(css, theme);
  const out = {};
  for (const name of map.keys()) {
    const v = resolveVar(map, name);
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) out[name] = v.toLowerCase();
  }
  return out;
}

/** 所有颜色（hex + rgba），给主题测试用。 */
export function readColorTokens(css, { theme = 'paper' } = {}) {
  const map = readVariables(css, theme);
  const out = {};
  for (const name of map.keys()) {
    const v = resolveVar(map, name);
    if (v && /^(#[0-9a-fA-F]{6}|rgba?\([^)]+\))$/.test(v)) out[name] = v;
  }
  return out;
}

/* --------------------------------------------------------------- 色值 */

/** 所有 --vk-*wash* / --vk-*tint* 自定义属性（用来抓「野生色」）。 */
export function surfaceTokenNames(css) {
  const names = new Set();
  const re = /(--vk-(?:dark-)?(?:wash|tint)-[a-z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(stripComments(css)))) names.add(m[1]);
  return names;
}

export const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const rgbCss = (hex) => `rgb(${rgb(hex).join(', ')})`;

/** 读 rgba(...) 的 { rgb: [r,g,b], rgbHex, a }；hex 也行（a=1）。 */
export function parseColor(value) {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return { rgb: rgb(value), rgbHex: value.toLowerCase(), a: 1 };
  const m = String(value).match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = p;
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return { rgb: [r, g, b], rgbHex: hex, a };
}

/** 在 sRGB 里把 color 按 t 混进 base（与主题层的派生公式同一个写法）。 */
export function mixHex(base, color, t) {
  const b = rgb(base);
  const c = rgb(color);
  return '#' + b.map((v, i) => Math.round(Math.max(0, Math.min(255, v + (c[i] - v) * t))).toString(16).padStart(2, '0')).join('');
}

export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function hue(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** 两个色相的夹角（0–180）。 */
export function hueDistance(a, b) {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** 每档语义淡底的用例表：[名字, token 名, 对应实色 token]。 */
export function tintTable(tokens) {
  return TONES.map((tone) => ({
    tone,
    solid: tokens[SOLID_TOKENS[tone]],
    wash: tokens[WASH_TOKENS[tone]],
    tint: tokens[TINT_TOKENS[tone]],
    darkWash: tokens[DARK_WASH_TOKENS[tone]],
    darkTint: tokens[DARK_TINT_TOKENS[tone]],
  }));
}
