/**
 * v19 · 词汇表
 * ----------------------------------------------------------------------------
 * 全库只有这一份「值」：画布、字号、行高、行宽、间距、线宽、颜色、字体。
 *
 * 判断一条东西该不该进这里：对所有画面都成立吗？是一个值，而不是一种构图吗？
 * 容量不是值（它跟着组件和视觉走），所以它在 schema.mjs，按件声明。
 *
 * 两条硬约束来自观看条件，不是审美偏好：
 *   画面 1920×1080 出片，观众在手机横屏上看，实际缩到约 780 宽（0.406×）。
 *   所以像素值按 0.406 折算：4px 线 = 手机 1.6px；44px 字 = 手机 17.9px。
 */

/* ------------------------------------------------------------------ 画面 */
export const CANVAS = {
  w: 1920,
  h: 1080,
  /** 版心：内容不越过的边界。 */
  safeX: 120,
  safeY: 96,
};

/** 自动缩小的下限（手机 17.9px）。自检、组件下限、文档都读这一个。 */
export const FLOOR = 44;

/** 线宽。手机 0.406× 之后 4px 才 1.6px；strong 是「正在看这里」，要压得住。 */
export const LINE_W = { hair: 4, rule: 8, strong: 12 };


/* ---------------------------------------------------------------- 字号
   手机 0.406× 之后：44 → 17.9、56 → 22.7、84 → 34.1、132 → 53.6。
   caption 单独一档（44）是有意的：注脚、行号、单位、表头都得比正文小，
   但不能再小到 19.5px 以下。 */
export const FONT = {
  /* 元信息档：手机 0.406× 之后 19.5px。行号、地址、位序号、表头都读得到。 */
  caption: 48,
  body: 56,
  subhead: 84,
  headline: 132,
  display: 200,
  hero: 280,
};

/* 行高：无单位比例，跟着字号走。代码窗缩字号时行盒跟着缩。 */
export const LINE = {
  caption: 1.45,
  body: 1.43,
  subhead: 1.43,
  headline: 1.33,
  display: 1.2,
  hero: 1.07,
};

/* 行宽：单位是 em，所以「一行几个字」随字号自动成立。
   中文 1 字 ≈ 1em。正文 25 字是长期验证过的阅读宽，右侧正好留出批注带。 */
export const MEASURE = {
  caption: 24,
  body: 25,
  subhead: 18,
  headline: 12,
  display: 8,
  hero: 4,
};

/* 字距：只在大字上收。中文没有西文的字距问题，收多了会粘连。 */
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
   作者能写的五档 + 像素值（gap="48"）。
   档位越少，作者越不需要猜。 */
export const GAP = {
  none: 0,
  close: 16,
  normal: 32,
  wide: 64,
  section: 128,
};

/* 组件内距：只在 CSS 里用，不是作者属性。四档代替散落的 4/8/12/24/40。 */
export const INSET = { sm: 8, md: 16, lg: 24, xl: 40 };

/* ------------------------------------------------------------------ 形 */
export const RADIUS = { none: 0, md: 16, lg: 24, pill: 999 };

/* ------------------------------------------------------------------ 色
   每一支都是「纸面值 / 暗面值」一对。CSS 侧生成 light-dark()，
   由 color-scheme 决定取哪一支：一个面写一行 color-scheme，整棵子树自动正确。

   ink3 是元信息档：纸面 5.8:1，暗面 7.5:1，都仍是可读的字。
   focus 是全库唯一的强调色；语义色只出现在线、图标、底标上，不写正文。
   淡底（tint）只做「当前 / 标注 / 增删」的底，强度必须过得了视频压缩。 */
export const PAINT = {
  paper: ['#ffffff', '#10151c'],
  soft: ['#f2f5f8', '#1a2230'],
  ink1: ['#0b0f14', '#f2f6fb'],
  ink2: ['#333d4b', '#cdd7e4'],
  ink3: ['#5c6674', '#9aa7b8'],
  line: ['rgba(11, 15, 20, 0.55)', 'rgba(255, 255, 255, 0.55)'],
  lineStrong: ['rgba(11, 15, 20, 0.62)', 'rgba(255, 255, 255, 0.65)'],
  focus: ['#1b3fd6', '#7aa2ff'],
  info: ['#3a4454', '#8fa6c8'],
  ok: ['#0a6b57', '#6fdcb2'],
  warn: ['#8a4b00', '#f0b45c'],
  err: ['#b3261e', '#ff9a90'],
  tintInfo: ['#e9edf2', '#1c2634'],
  tintFocus: ['#dfe4f9', '#243a68'],
  tintOk: ['#e3efe9', '#12281f'],
  tintWarn: ['#f6eddc', '#2c2113'],
  tintErr: ['#f8e5e3', '#2d1715'],
  // 填色块（当前步骤章、标出的字节、指针胶囊）上的字：浅色模式白字，深色模式黑字。
  onFocus: ['#ffffff', '#0b0f14'],
};

/* 语法：三个色相 + 一个灰 + 一个墨。结构词 = 莓红，字面量 = 松绿 / 青铜，注释 = 冷灰。
   莓红避开了强调蓝：一帧里「蓝」只表示「正在看这里」。
   函数名与变量名不占色相，靠 600 字重和正文黑分层。 */
export const SYNTAX = {
  string: ['#0a6f5a', '#7fd9b6'],
  // 注释比正文轻（纸面 5.4:1），但仍是可读的字，不靠透明度。
  comment: ['#5f6b7a', '#94a3b8'],
  // 数字/常量给青铜：暖，但比语义 err 的砖红更暗、更低饱和。
  number: ['#8f5200', '#edb96b'],
  // 结构词（关键字/类型/宏）用莓红：C 里出现最多，必须与正文分开。
  keyword: ['#8a3a5e', '#d79ab8'],
  // 算子/标点比正文浅一档：它是噪音层，不能和变量抢黑。
  operator: ['#566173', '#94a3b8'],
  // 函数/类型名：正文黑 + 600，不占色相。
  fn: ['#101826', '#eaf0f8'],
};

/* 窗口三点：观众一眼认出「这是窗口」。两个面共用同一组色。 */
export const DOTS = { red: '#ff5f57', yellow: '#febc2e', green: '#28c840' };

/* ------------------------------------------------------------------ 字体 */
export const FONT_FAMILY = {
  sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace',
};

/* ------------------------------------------------------------------ 枚举 */
/* 语义色只留「对 / 注意 / 错」三种 + 中性的 info（连接线、图标底标）。
   focus 不是语气：它只由 current / 圈选产生，所以不在 tone 里。 */
export const TONE = ['neutral', 'info', 'ok', 'warn', 'err'];
export const STATE = ['current'];
export const SURFACE = ['none', 'paper', 'soft', 'dark'];
export const INK = ['primary', 'secondary', 'muted'];
export const SIZE = Object.keys(FONT);

/** 索引：一律 1 起。不写 = 没有当前。 */
export const INDEX_RULE = '1 起';
