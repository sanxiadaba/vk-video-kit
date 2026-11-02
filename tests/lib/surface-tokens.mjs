/**
 * 表面色阶的测试侧读数（不启动浏览器）。
 *
 * 只做两件事：
 *  1. 从 src/tokens/tokens.css 读「语义淡底」的实色值；
 *  2. 把 vk-panel 的 variant × tone → 底色的规范写在这里。
 *
 * 第 2 条故意与 CSS 分开写：如果 CSS 改错了，测试读的是规范而不是实现。
 * 改映射必须同时改 src/elements/elements.css 与本文件——两边不一致就红。
 */

export const TONES = ['info', 'focus', 'ok', 'err', 'warn'];

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

/** @returns {Record<string,string>} 自定义属性名 → 6 位 hex */
export function readHexTokens(css) {
  const out = {};
  const re = /(--vk-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m;
  while ((m = re.exec(css))) out[m[1]] = m[2].toLowerCase();
  return out;
}

/** 所有 --vk-*wash* / --vk-*tint* 自定义属性（用来抓「野生色」）。 */
export function surfaceTokenNames(css) {
  const names = new Set();
  const re = /(--vk-(?:dark-)?(?:wash|tint)-[a-z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(css))) names.add(m[1]);
  return names;
}

export const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const rgbCss = (hex) => `rgb(${rgb(hex).join(', ')})`;

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
