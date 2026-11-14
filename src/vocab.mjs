/**
 * v24 · 词汇表
 * ----------------------------------------------------------------------------
 * 全库只有这一份「值」。作者写语义（内容 / current / tone / size / theme），
 * 库写视觉（字 / 距 / 面 / 线 / 态）。组件只是这些原语的组合。
 *
 * 观看条件不是审美偏好：画面 1920×1080，手机横屏实际约 780 宽（0.406×）。
 * 所以 4px 线 = 手机 1.6px；64px 字 = 手机 26px；
 * 版心左右 120 / 上下 96（对称），不替任何播放器 UI 预留。
 */

/* ------------------------------------------------------------------ 画面 */
export const CANVAS = {
  w: 1920,
  h: 1080,
  /** 版心：内容不越过的边界。 */
  marginX: 120,
  marginY: 96,
};
export const CONTENT = {
  w: CANVAS.w - CANVAS.marginX * 2,
  h: CANVAS.h - CANVAS.marginY * 2,
};

/** 自动缩小的下限（手机 16.2px）。自检、组件下限、文档都读这一个。 */
export const FLOOR = 40;

/** 线宽。4 分隔 / 6 连接 / 8 结构 / 12 焦点；手机 0.406× 之后仍看得见。 */
export const LINE_W = { hair: 4, connector: 6, rule: 8, strong: 12 };

/* ---------------------------------------------------------------- 字号
   手机 0.406× 之后：56 → 22.7、64 → 26、96 → 39、132 → 53.6。 */
export const FONT = {
  caption: 56,
  body: 64,
  subhead: 96,
  headline: 144,
  display: 216,
  hero: 300,
};

export const LINE = {
  caption: 1.5,
  body: 1.5,
  subhead: 1.35,
  headline: 1.3,
  display: 1.2,
  hero: 1.1,
};

/* 行宽：单位是 em。中文 1 字 ≈ 1em。正文 25 字是阅读宽。 */
export const MEASURE = {
  caption: 26,
  body: 25,
  subhead: 18,
  headline: 13,
  display: 8,
  hero: 4,
};

export const TRACKING = {
  caption: 0,
  body: 0,
  subhead: 0,
  headline: -0.01,
  display: -0.015,
  hero: -0.02,
};

/* 字重：只发 400 / 500 / 600 三档字体文件。 */
export const WEIGHT = { regular: 400, medium: 500, bold: 600 };

/* ------------------------------------------------------------------ 间距
   8 档，4px 基准。组件只用这些值，不再写 10/14/28/44 这种裸数。 */
export const SPACE = { '1': 4, '2': 8, '3': 12, '4': 16, '5': 24, '6': 32, '7': 48, '8': 64, '9': 96 };

/* 作者能写的分栏间距：五档 + 像素值（gap="48"）。 */
export const GAP = { none: 0, close: 16, normal: 32, wide: 64, section: 96 };

/* ------------------------------------------------------------------ 形 */
export const RADIUS = { none: 0, sm: 8, md: 12, pill: 999 };

/* 图标：只发三档，组件不再自己定尺寸。 */
export const ICON = { lg: 28, xl: 40, '2xl': 56 };

/* ------------------------------------------------------------------ 色
   每一支都是「纸面值 / 暗面值」一对。CSS 侧生成 light-dark()，
   由 color-scheme 决定取哪一支：一个面写一行 color-scheme，整棵子树自动正确。

   ink3 是元信息档：纸面 5.9:1，暗面 7.4:1，都仍是可读的字。
   focus 是全库唯一的强调色；语义色只出现在线、图标、底标上，不写正文。 */
export const PAINT = {
  paper: ['#ffffff', '#0b0f14'],
  raised: ['#ffffff', '#161e2a'],
  soft: ['#f6f7f8', '#171e28'],
  ink1: ['#111418', '#f4f6f9'],
  ink2: ['#3f4652', '#c3ccd9'],
  ink3: ['#5b6472', '#9aa7b8'],
  line: ['rgba(17, 20, 24, 0.16)', 'rgba(255, 255, 255, 0.16)'],
  lineStrong: ['rgba(17, 20, 24, 0.28)', 'rgba(255, 255, 255, 0.30)'],
  focus: ['#1d4ed8', '#7aa2ff'],
  info: ['#475569', '#cbd5e1'],
  ok: ['#0f766e', '#5eead4'],
  warn: ['#b45309', '#fbbf24'],
  err: ['#b91c1c', '#fca5a5'],
  tintInfo: ['#f1f5f9', '#1b2430'],
  tintFocus: ['#e2e9ff', '#1b2740'],
  tintOk: ['#ecfdf5', '#10251f'],
  tintWarn: ['#fffbeb', '#2a2113'],
  tintErr: ['#fef2f2', '#2a1515'],
  mark: ['#ffe58a', '#4a3a12'],
  // 填色块（当前步骤章、标出的字节、指针胶囊）上的字：浅色模式白字，深色模式黑字。
  onFocus: ['#ffffff', '#0b0f14'],
};

/* 语法：四个色相 + 一个灰 + 一个墨。结构词 = 莓红，字面量 = 松绿 / 青铜，注释 = 冷灰。
   莓红避开了强调蓝：一帧里「蓝」只表示「正在看这里」。 */
export const SYNTAX = {
  string: ['#0f766e', '#5eead4'],
  comment: ['#5b6472', '#9aa7b8'],
  number: ['#92400e', '#fbbf24'],
  keyword: ['#86198f', '#d8b4fe'],
  operator: ['#4b5563', '#9aa7b8'],
  fn: ['#111418', '#f8fafc'],
};

/* 窗口三点：观众一眼认出「这是窗口」。两个面共用同一组色。 */


/* ------------------------------------------------------------------ 字体 */
export const FONT_FAMILY = {
  sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace',
};

/* ------------------------------------------------------------------ 枚举 */
export const TONE = ['neutral', 'info', 'ok', 'warn', 'err'];
export const THEME = ['light', 'dark'];
export const CARD_SURFACE = ['paper', 'soft', 'dark'];
export const INK = ['primary', 'secondary', 'muted'];
export const SIZE = Object.keys(FONT);

/** 索引：一律 1 起。不写 = 没有当前。 */
export const INDEX_RULE = '1 起';
