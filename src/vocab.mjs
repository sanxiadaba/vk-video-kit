/**
 * v18 · 词汇表
 * ----------------------------------------------------------------------------
 * 全库只有这一份「值」：档位名与数值、颜色、字体、线宽、容量。别处只能引用它。
 *
 *   · schema.mjs   只引用这里的名字，定义「哪个标签有哪个属性」
 *   · tokens.css   由 tools/css.mjs 生成（不许手改）
 *   · 运行期       spec() 读 schema 的默认值与范围，不再各写一份
 *   · 文档         CONTRACT.md / vk brief / vk doc 都由 schema + 这份值生成
 *
 * 判断一条东西该不该进这里：对所有画面都成立吗？是一个值而不是一种构图吗？
 *
 * v18 的两条硬约束来自观看条件，不是审美偏好：
 *   画面 1920×1080 出片，观众在手机横屏上看，实际缩到约 780 宽（0.406×）。
 *   所以像素值要按 0.406 折算：线宽 2px = 手机 0.8px（1px 会被编码吃掉），
 *   字号 44px = 手机 17.9px（再小就不是「给小白看」的字了）。
 */

/* ------------------------------------------------------------------ 画面 */
export const CANVAS = {
  w: 1920,
  h: 1080,
  /** 版心：内容不越过的边界。 */
  safeX: 120,
  safeY: 96,
};

/** 最小可读字号（手机 0.406× 后 17.9px）。自检、文档、组件下限都读这一个。 */
export const FONT_FLOOR = 44;

/** 线宽。手机 0.406× 之后，2px 只有 0.8px、视频编码一压就没了；最细取 3。
 *  strong 是「正在看这里」和箭头用的，宁可重一点也不要不明显。 */
export const LINE_W = { hair: 4, rule: 8, strong: 10 };

/* 一帧只有三档宽度：满版 / 三分之二 / 半版（半版两列 + gap = 满版）。 */
export const BLOCK = { full: 1680, 'two-thirds': 1120, half: 824 };

/* ---------------------------------------------------------------- 字号
   手机 0.406× 之后，48 只剩 19.5px —— 不再有「小字」这一档。
   caption 与 body 同号（56），层级靠颜色/字重；只有行号允许 44 的下限。 */
export const FONT = {
  caption: 56,
  body: 56,
  subhead: 84,
  headline: 132,
  display: 200,
  hero: 280,
};

/* 行高：无单位比例，跟着字号走。
   代码窗会把字号往下缩，px 行高不会跟着缩，行盒就散了。 */
export const LINE = {
  caption: 1.43,
  body: 1.43,
  subhead: 1.43,
  headline: 1.33,
  display: 1.2,
  hero: 1.07,
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
   作者能写的五档 + 像素值（gap="48"）。
   没有 2xs…3xl 这种八档刻度：档位越多，作者越是在猜。 */
export const GAP = {
  none: 0,
  close: 16,
  normal: 32,
  wide: 64,
  section: 128,
};

/* 组件内距：只在 CSS 里用，不是作者属性。
   四档代替散落的 4/8/12/24/40 手写 px。 */
export const INSET = { xs: 4, sm: 8, md: 12, lg: 24, xl: 40 };

/* ------------------------------------------------------------------ 形 */
export const RADIUS = { none: 0, md: 16, pill: 999 };

/* ------------------------------------------------------------------ 色
   每一支都是「纸面值 / 暗面值」一对。CSS 侧生成 light-dark()，
   由 color-scheme 决定取哪一支：一个面写一行 color-scheme，整棵子树自动正确。
   不再有第二套主题、也不再有「钉回纸面」的快照。

   ink3 是元信息档：纸面 5.8:1，暗面 7.4:1，都仍是可读的字。
   focus 是全库唯一的强调色；语义色只出现在线、图标、底标上，不写正文。 */
export const PAINT = {
  paper: ['#ffffff', '#10151c'],
  soft: ['#f4f6f9', '#171e28'],
  ink1: ['#0b0f14', '#f2f6fb'],
  ink2: ['#333d4b', '#cdd7e4'],
  ink3: ['#5c6674', '#9aa7b8'],
  line: ['rgba(11, 15, 20, 0.45)', 'rgba(255, 255, 255, 0.50)'],
  lineStrong: ['rgba(11, 15, 20, 0.55)', 'rgba(255, 255, 255, 0.60)'],
  focus: ['#1b3fd6', '#7aa2ff'],
  info: ['#3a4454', '#8fa6c8'],
  ok: ['#0a6b57', '#6fdcb2'],
  warn: ['#8a4b00', '#f0b45c'],
  err: ['#b3261e', '#ff9a90'],
  tintInfo: ['#eef0f3', '#1a2029'],
  tintFocus: ['#eaeefb', '#1b2540'],
  tintOk: ['#e9f2f0', '#12241f'],
  tintWarn: ['#f4efe8', '#2a2115'],
  tintErr: ['#f8ebeb', '#2b1717'],
  // 填色块（当前步骤章、标出的字节、指针胶囊）上的字：浅色模式白字，深色模式黑字。
  onFocus: ['#ffffff', '#0b0f14'],
};

/* 语法：三个色相 + 一个灰。结构词 = 莓红，字面量 = 松绿 / 青铜，注释 = 冷灰。
   莓红避开了强调蓝（#1b3fd6）：一帧里「蓝」只表示「正在看这里」。
   三支色的 OKLCH 色相约 356° / 173° / 65°，在 780 宽下仍分得开；
   函数名与变量名不占色相，靠 600 字重和正文黑分层。 */
export const SYNTAX = {
  string: ['#0b7a63', '#7fd9b6'],
  // 注释比正文轻（纸面 4.6:1），但仍是可读的字，不靠透明度。
  comment: ['#6a7686', '#94a3b8'],
  // 数字/常量给青铜：暖，但比语义 err 的砖红更暗、更低饱和。
  number: ['#8f5200', '#edb96b'],
  // 结构词（关键字/类型/宏）用莓红：C 里出现最多，必须与正文分开。
  keyword: ['#8a3a5e', '#d79ab8'],
  // 算子/标点比正文浅一档：它是噪音层，不能和变量抢黑。
  operator: ['#566173', '#94a3b8'],
};

/* 窗口三点：观众一眼认出「这是窗口」。两个面共用同一组色。 */
export const DOTS = { red: '#ff5f57', yellow: '#febc2e', green: '#28c840' };

/* ------------------------------------------------------------------ 字体 */
export const FONT_FAMILY = {
  sans: '"Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Noto Sans SC", "PingFang SC", monospace',
};

/* ---------------------------------------------------------------- 容量
   一帧 888 版心的预算：标题块（label 64 + gap 32 + subhead 120 + gap 32）≈ 248，
   剩下 640 给内容。这些是「再多就一定放不下」的行数，写进契约和文档；
   构建期只提示，不拦 —— 拆不拆帧是作者的判断。 */
export const CAPACITY = {
  rows: 8, // 版心能放几个行级单元（正文 80px 一行）
  // 下面这些是「还带一个标题块（label + 一句话）」时的真实上限，实测出来的。
  code: 6, // 代码行（窗口头 64 + 上下内距 64 之外）
  term: 7,
  diff: 5,
  asm: 5,
  table: 4, // 数据行（表头另算）
  tree: 5,
  cells: 2, // 行（cols 列一行）
  bits: 16, // 位；32 位请用 index="sparse"
  steps: 5, // 横排
  bars: 6,
  timeline: 4,
};

/* ------------------------------------------------------------------ 枚举 */
export const TONE = ['neutral', 'info', 'focus', 'ok', 'warn', 'err'];
export const STATE = ['current', 'mark'];
export const SURFACE = ['none', 'paper', 'soft', 'tint', 'dark'];
export const INK = ['primary', 'secondary', 'muted'];
export const SIZE = Object.keys(FONT);
export const SPACE = Object.keys(GAP);

/** 索引：一律 1 起，-1 表示「没有当前」。锚点也一样（@cell:1 是第一个）。 */
export const INDEX_RULE = '1 起；-1 = 没有当前';
