/**
 * v26 · 词汇表
 * ----------------------------------------------------------------------------
 * 全库只有这一份「值」。作者写语义（内容 / current / tone / size / theme），
 * 库写视觉（字 / 距 / 面 / 线 / 态）。组件只是这些原语的组合。
 *
 * 观看条件不是审美偏好：画面 1920×1080，手机横屏实际约 693 宽（0.361×）。
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
/** 手机横屏满屏：390×844 的屏幕放 16:9 视频，有效宽度 693（0.361×）。 */
export const PHONE_W = 693;

/** 线宽。8 分隔 / 8 连接 / 8 结构 / 12 焦点；手机 0.361× 之后：2.9 / 2.9 / 4.3px。
    6px 在 540p 压缩后只剩 1.7px，配 .22 的透明度会先消失。 */
export const LINE_W = { hair: 8, connector: 8, rule: 8, strong: 12 };

/* ---------------------------------------------------------------- 字号
   手机 0.361× 之后：56 → 20.2、64 → 23.1、96 → 34.7、144 → 52。 */
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

/* 行宽：单位是 em。中文 1 字 ≈ 1em。
   上限 = 版心 1680 ÷ 字号：caption 30 / body 26 / subhead 17 / headline 11 / display 7 / hero 5。
   取比上限小一档，留一个字的余量。 */
export const MEASURE = {
  caption: 26,
  body: 25,
  subhead: 17,
  headline: 11,
  display: 7,
  hero: 5,
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

/** 作者能写的分栏间距：五档 + 像素值（gap="48"）。 */
export const GAP = { none: 0, close: 16, normal: 32, wide: 64, section: 96 };

/** style 里不许作者碰的 token：字号、间距、线宽、版心、字体、字重、字距。 */
export const STYLE_LOCKED = /^--vk-(fs|lh|line|space|margin|canvas|measure|radius|gap|ann|conn|icon|font|w|track|cols|span)/;

/* ------------------------------------------------------------------ 形 */
/** 圆角只有一种：0。方角 + 细线是这套画面的身份；圆角卡片一出现就会读成
    「网页 / 办公文档」。唯一的例外是没有任何例外。 */
export const RADIUS = { none: 0 };

/* 没有图标：这套画面的语义由字、线、位置承担。装饰性图标在 693 下只剩
   14px 的一团，且和「不加图标」的设计宣言冲突，整条链（lucide 依赖 / vk icons /
   icon 属性 / ICON 错误码）一起删掉。 */

/* ------------------------------------------------------------------ 色
   每一支都是「纸面值 / 暗面值」一对。CSS 侧生成 light-dark()，
   由 color-scheme 决定取哪一支：一个面写一行 color-scheme，整棵子树自动正确。

   ink3 是元信息档：纸面 5.9:1，暗面 7.4:1，都仍是可读的字。
   focus 是全库唯一的强调色；语义色只出现在线、图标、底标上，不写正文。 */
export const PAINT = {
  paper: ['#ffffff', '#0b0f14'],
  raised: ['#ffffff', '#1b2531'],
  soft: ['#f6f7f8', '#121a24'],
  ink1: ['#111418', '#f4f6f9'],
  ink2: ['#3f4652', '#c3ccd9'],
  ink3: ['#5b6472', '#9aa7b8'],
  /* 结构线在手机上要活下来：2.8:1 / 4.2:1。旧的 .32 / .46 在 693 下分别只有
     2.1:1 / 3.1:1，细线会先糊掉，再被视频压缩吃掉。 */
  line: ['rgba(17, 20, 24, 0.42)', 'rgba(255, 255, 255, 0.44)'],
  lineStrong: ['rgba(17, 20, 24, 0.55)', 'rgba(255, 255, 255, 0.62)'],
  focus: ['#1d4ed8', '#7aa2ff'],
  info: ['#475569', '#cbd5e1'],
  ok: ['#0f766e', '#5eead4'],
  warn: ['#b45309', '#fbbf24'],
  err: ['#b91c1c', '#fca5a5'],
  mark: ['#ffe58a', '#5c4614'],
  // 填色块（当前步骤章、指针胶囊）上的字：浅色模式白字，深色模式黑字。
  onFocus: ['#ffffff', '#0b0f14'],
};

/* 语法：四个色相 + 一个灰 + 一个墨。结构词 = 莓红，字面量 = 松绿 / 青铜，注释 = 冷灰。
   每一档都按 paper 上 ≥4.5:1 校准：旧 number #92400e 之外还有 #c18401 那种 3.2:1 的橙，
   小白最该读的数字反而最弱。莓红避开强调蓝：一帧里「蓝」只表示「正在看这里」。 */
export const SYNTAX = {
  string: ['#0b6b7d', '#5eead4'],
  comment: ['#5b6472', '#9aa7b8'],
  number: ['#9a3f00', '#fbbf24'],
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
/* 面材质：auto 跟随页面（浅页 paper / 暗页 raised），其余三种是显式指定。
   「谁声明表面，谁写 color-scheme」，所以没有 theme 与 surface 两套明暗词。 */
export const CARD_SURFACE = ['auto', 'paper', 'soft', 'raised'];
export const INK = ['primary', 'secondary', 'muted'];
export const SIZE = Object.keys(FONT);

/** 索引：一律 1 起。不写 = 没有当前。 */
export const INDEX_RULE = '1 起';
