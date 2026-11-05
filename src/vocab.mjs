/**
 * v17 · 词汇表
 * ----------------------------------------------------------------------------
 * 全库只有这一份「值」：档位名与数值、颜色、字体、规则。别处只能引用它。
 *
 *   · schema.mjs  只引用这里的名字，定义「哪个标签有哪个属性」
 *   · tokens.css  由 tools/css.mjs 从 SCALE / PALETTE / TYPE 生成（不许手改）
 *   · 运行期       spec() 读 schema 的默认值与范围，不再各写一份
 *   · 文档         vk brief / vk doc / SPEC 表格都由 schema 生成
 *
 * 判断一条东西该不该进这里：对所有画面都成立吗？是一个值而不是一种构图吗？
 */

/* ------------------------------------------------------------------ 画面 */
export const CANVAS = {
  w: 1920,
  h: 1080,
  /** 版心：内容不越过的边界。 */
  safeX: 120,
  safeY: 96,
};

/* ---------------------------------------------------------------- 字号
   观看条件：1920×1080 出片，观众在手机横屏上看，实际缩到约 780 宽（0.406×）。
   所以字号不是「1920 上放得下」，而是「缩到 0.4× 还读得动」。

   六档相邻比：1.17 / 1.50 / 1.57 / 1.52 / 1.40。
   caption 与 body 只差 1.17 —— 它们不是视觉对比，是语义分层：
   body 是可读正文的地板，caption 是「不读第二遍的字」。
   caption 以下不存在：48px 在手机上 19.5px，是能读的最小中文。 */
export const FONT = {
  caption: 48,
  body: 56,
  subhead: 84,
  headline: 132,
  display: 200,
  hero: 280,
};

/* 行高：全部落在 4 的倍数上（行盒 = 字号 × 行高，出图不会出现半像素基线）。 */
export const LINE = {
  caption: 64,
  body: 80,
  subhead: 120,
  headline: 176,
  display: 240,
  hero: 300,
};

/* 行宽：单位是 em，所以「一行几个字」随字号自动成立，不随档位写死。
   中文 1 字 ≈ 1em。正文 25 字是长期验证过的阅读宽。 */
export const MEASURE = {
  caption: 32,
  body: 25,
  subhead: 18,
  headline: 12,
  display: 8,
  hero: 4,
};

/* 字距：只在大字上收。中文本来没有西文的字距问题，收多了会粘连。 */
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
   四个角色 + 无边距，加一个像素逃生口（gap="48"）。
   没有 2xs…3xl 这种八档刻度：档位越多，作者越是在猜。 */
export const GAP = {
  none: 0,
  close: 16,
  normal: 32,
  wide: 64,
  section: 128,
};

/* ------------------------------------------------------------------ 形 */
export const RADIUS = { none: 0, md: 12, pill: 999 };

/* 线宽：hair 只用来看见分区，rule 是结构线，strong 是「这一块很重要」。 */
export const LINE_W = { hair: 1, rule: 2, strong: 4 };

/* ------------------------------------------------------------------ 色
   一套纸 + 四档墨 + 一个焦点 + 四个语义 + 一档软底 + 一档深色面。
   没有第二套主题、没有 wash/tint 双层语义底：tint 只有一个浓度。 */
export const PAPER = {
  paper: '#ffffff',
  soft: '#f4f6f9',

  ink1: '#0b0f14', // 主叙述      18.9:1
  ink2: '#333d4b', // 次要        11.0:1
  ink3: '#5c6674', // 元信息       5.8:1（≥4.5，仍是可读的字）

  line: 'rgba(11, 15, 20, 0.10)',
  lineStrong: 'rgba(11, 15, 20, 0.32)',

  focus: '#1b3fd6', // 「正在讲这里」——全库唯一的强调色
  info: '#3a4454', // 作者加的注（圈、下划线、编号）
  ok: '#0a6b57',
  warn: '#8a4b00',
  err: '#b3261e',

  /* 语义淡底（唯一浓度）。文字一律用 ink1，不再有「淡底上的浅字」。 */
  tintInfo: '#eef0f3',
  tintFocus: '#eaeefb',
  tintOk: '#e9f2f0',
  tintWarn: '#f4efe8',
  tintErr: '#f8ebeb',
};

/* 深色面：只给「代码窗可选的反白」用，不是第二套主题。 */
export const DARK = {
  bg: '#0b0f14',
  bg1: '#141a22',
  fg: '#f7f9fc',
  fg2: '#dbe3ee',
  meta: '#9aa7b8',
  rule: 'rgba(255, 255, 255, 0.14)',
  accent: '#7aa2ff',
  ok: '#8fe3c0',
  warn: '#f5c97a',
  err: '#ffb4ad',
  string: '#8fe3c0',
  comment: '#8b97a8',
};

/* 语法：只有三个颜色。关键字靠字重，数字退到墨阶。
   强调蓝不参与语法 —— 一帧里「蓝」只能有一个意思。 */
export const SYNTAX = {
  string: '#0b6b4f',
  comment: '#667085',
};

/* 窗口三点：观众一眼认出「这是窗口」。 */
export const DOTS = { red: '#ff5f57', yellow: '#febc2e', green: '#28c840' };

/* ------------------------------------------------------------------ 字体 */
export const FONT_FAMILY = {
  sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace',
};

/* ------------------------------------------------------------------ 枚举 */
export const TONE = ['neutral', 'info', 'focus', 'ok', 'warn', 'err'];
export const STATE = ['current', 'mark'];
export const SURFACE = ['none', 'paper', 'soft', 'tint', 'dark'];
export const INK = ['primary', 'secondary', 'muted'];
export const SIZE = Object.keys(FONT);
export const SPACE = Object.keys(GAP);

/** 索引：一律 1 起，-1 表示「没有当前」。没有第二种基。 */
export const INDEX_RULE = '1 起；-1 = 没有当前';

/** 三个语义色的深色版：淡底上的字永远是 ink1，深色面上才换档。 */
export const toneVar = (tone) => `--vk-${tone}`;
