/**
 * vk 注册表 —— 标签 / 层 / 属性 / 一句话说明。
 * 由这里生成 types 与 reference.md；运行时也读 attrs 决定 observed 属性。
 *
 * 15.0 起，四个"长了多套声明"的概念收进 src/shared/vocab.mjs：
 * tone（六值一套）/ fill（none·cover·contain）/ current（1 起的当前项）/
 * size（只表字号，密度写 mass）。这里只引用那一份，不再各写一遍枚举。
 */
import {
  TONES,
  FILLS,
  SIZE_TIERS,
  MASS,
  FILL_TAGS,
  COLUMNS,
  SPACE_TIERS,
  GAP_TIERS,
  DEPRECATED_ATTRS,
} from './shared/vocab.mjs';

const text = () => ({ type: 'text' });
const num = (o = {}) => ({ type: 'num', ...o });
const size = (o = {}) => ({ type: 'size', ...o });
const int = (o = {}) => ({ type: 'int', ...o });
const bool = () => ({ type: 'bool' });
const lines = () => ({ type: 'lines' });
const sel = () => ({ type: 'selector' });
const oneOf = (...values) => ({ values });

/* --------------------------------------------------------------- 共享词表 */
/** 语义色调：全库同一份六值（见 vocab.mjs）。list = 允许 "左,右" 两侧各一个。 */
const tone = (o = {}) => ({ type: 'tone', values: TONES, ...o });
/** 填充：全库同一份三值；只有能填充的组件声明它。 */
const fill = (o = {}) => ({ type: 'fill', values: FILLS, default: 'none', ...o });
/** 字号：语义档名（像素写法由内容组件的 fontsize 承担）。 */
const sizeTier = () => oneOf(...SIZE_TIERS);
/** 内容字号：语义档名或像素数（160）。 */
const fontSize = () => ({ type: 'fontsize', values: SIZE_TIERS });
/** 体量/密度：与字号正交。 */
const massLevel = () => oneOf(...MASS);
/**
 * 列开关：一个 `${tag}.columns` 管该组件的可选列（见 vocab.COLUMNS）。
 * values 只用来生成文档与构建期校验；实际 token 以 COLUMNS[tag].all 为准。
 */
const columns = (tag) => ({ type: 'columns', values: ['all', 'none', ...COLUMNS[tag].all], list: true });
/** 间距：档位（可写 "x y"；像素写法在运行期按数字读）。 */
const space = (values) => ({ type: 'space', values, list: true });

/**
 * 属性元数据：中文名、控件分组、是否属于“内容”（内容不装成控件）。
 * 只在这里写一次；types、属性参考、组件页都从这一份派生。
 */
const ATTR_META = {
  name: { label: '名称', content: true },
  src: { label: '来源', content: true },
  lines: { label: '行段', content: true },
  file: { label: '文件名', content: true },
  lang: { label: '语言', content: true },
  title: { label: '标题', content: true },
  label: { label: '无障碍名', content: true },
  n: { label: '编号', content: true },
  line: { label: '代码行', content: true },
  alt: { label: '替代文字', content: true },
  caption: { label: '图注', content: true },
  fig: { label: '图号', content: true },
  url: { label: '地址', content: true },
  prompt: { label: '提示符', content: true },
  index: { label: '序号（在整条流程里的位置，不是页号）', content: true },
  total: { label: '总步骤数（工序进度的分母）', content: true },
  section: { label: '工序名 / 分区名', content: true },
  eyebrow: { label: '眉题', content: true },
  sub: { label: '副题', content: true },
  ratio: { label: '比例', group: 'appearance' },
  values: { label: '值', content: true },
  labels: { label: '标签（多段用 | 分隔）', content: true },
  addr: { label: '起始地址', content: true },
  offset: { label: '起始字节', content: true },
  length: { label: '字节数', content: true },
  group: { label: '分组', group: 'appearance' },
  ascii: { label: 'ASCII 列', group: 'appearance' },
  address: { label: '地址列', group: 'appearance' },
  grows: { label: '生长方向', group: 'appearance' },
  show: { label: '显示列', group: 'appearance' },
  grid: { label: '栅格', group: 'appearance' },
  kinds: { label: '类型标记', group: 'appearance' },
  mark: { label: '标记词', content: true },
  'fold-note': { label: '折叠说明', content: true },
  for: { label: '目标', content: true },
  from: { label: '起点', content: true },
  to: { label: '终点', content: true },

  tone: { label: '色调', group: 'appearance' },
  theme: { label: '主题（调色板）', group: 'appearance' },
  icon: { label: '图标', content: true },
  kind: { label: '形态', group: 'appearance' },
  place: { label: '位置', group: 'layout' },
  connector: { label: '连接线', group: 'appearance' },
  surface: { label: '表面', group: 'appearance' },
  readable: { label: '可读性保护', group: 'appearance' },
  bleed: { label: '出血（越过版心到画布边）', group: 'layout' },
  variant: { label: '形态', group: 'appearance' },
  mass: { label: '体量', group: 'appearance' },
  size: { label: '字号（语义档或像素）', group: 'appearance' },
  level: { label: '标题级别', group: 'appearance' },
  weight: { label: '字重', group: 'appearance' },
  mono: { label: '等宽', group: 'appearance' },
  radius: { label: '圆角', group: 'appearance' },
  border: { label: '描边', group: 'appearance' },
  fit: { label: '填充', group: 'appearance' },
  'fit-min': { label: '最小字号（像素；fit 的硬地板）', group: 'appearance' },
  'fit-max': { label: '最大字号（像素）', group: 'appearance' },
  'arrow-scale': { label: '箭头缩放（容器高的比例）', group: 'appearance' },
  'arrow-label': { label: '箭头上挂的词', group: 'appearance' },
  split: { label: '占比（%）', group: 'layout' },
  axis: { label: '中轴', group: 'appearance' },
  'axis-width': { label: '轴宽（像素）', group: 'appearance' },
  symbol: { label: '轴上符号', group: 'appearance' },
  chrome: { label: '窗头', group: 'appearance' },
  stripe: { label: '斑马', group: 'appearance' },
  bare: { label: '无外壳', group: 'appearance' },
  display: { label: '独立成行', group: 'appearance' },
  rule: { label: '条目分隔线', group: 'appearance' },
  dash: { label: '虚线', group: 'appearance' },
  arrow: { label: '箭头（end / start / both / none；可写 end:open、size:40、cap:start）', group: 'appearance' },
  columns: { label: '列开关（如 "numbers,summary"；none / all / -name / titles:地址|机器码…）', group: 'appearance' },
  fence: { label: '内存屏障（after:行号,label:文字）', group: 'appearance' },
  counter: { label: '工序进度（i/n；渲染成「工序 i/n」）', content: true },
  cap: { label: '端点', group: 'appearance' },
  current: { label: '当前项（序号 1 起；-1 = 没有当前）', group: 'state' },
  focus: { label: '聚光行', group: 'state' },
  // 视频维度：字幕轨驱动。cue 写在任意元件上；cues / states / transition 写在 vk-page 上。
  cue: { label: '字幕驱动（第 N 条，或 0:06-0:09 时间段）', group: 'state' },
  cues: { label: '字幕轨（cue.json / .srt 路径，也可内联 JSON）', group: 'state' },
  states: { label: '同页状态（逗号分隔，如 a,b,c）', group: 'state' },
  transition: { label: '页间转场（cut / fade / push）', group: 'appearance' },
  'focus-duration': { label: '焦点过渡时长（毫秒；0 = 立即）', group: 'appearance' },
  'focus-transition': { label: '焦点过渡开关（on / off）', group: 'state' },
  fold: { label: '折叠行', group: 'state' },
  span: { label: '占几份', group: 'layout' },
  omit: { label: '字符区间', content: true },
  value: { label: '数值', content: true },
  note: { label: '说明', content: true },
  'ratio-to': { label: '倍率基准行（0 起）', group: 'appearance' },
  unit: { label: '单位', content: true },
  max: { label: '最大值', group: 'appearance' },
  source: { label: '出处', content: true },
  author: { label: '作者', content: true },
  sign: { label: '符号位', group: 'appearance' },
  start: { label: '起点', content: true },
  end: { label: '终点', content: true },
  lanes: { label: '泳道', content: true },
  steps: { label: '步数（轴宽）', group: 'layout' },
  date: { label: '日期', content: true },
  lane: { label: '泳道', content: true },
  at: { label: '所在步', group: 'layout' },
  via: { label: '路径点', group: 'layout' },
  side: { label: '贴边', group: 'layout' },
  leader: { label: '引线', group: 'appearance' },
  dim: { label: '压暗', group: 'appearance' },
  feather: { label: '羽化', group: 'appearance' },
  bytes: { label: '机器码列', group: 'appearance' },
  offsets: { label: '字节偏移', group: 'appearance' },
  direction: { label: '方向', group: 'appearance' },
  marks: { label: '字符标记', content: true },
  row: { label: '行', content: true },
  col: { label: '列', content: true },
  stroke: { label: '描边宽', group: 'appearance' },

  pad: { label: '内距', group: 'layout' },
  'pad-px': { label: '内距（像素）', group: 'layout' },
  'pad-x': { label: '左右内距', group: 'layout' },
  'pad-y': { label: '上下内距', group: 'layout' },
  w: { label: '宽', group: 'layout' },
  h: { label: '高', group: 'layout' },
  x: { label: 'X', group: 'layout' },
  y: { label: 'Y', group: 'layout' },
  align: { label: '对齐', group: 'layout' },
  justify: { label: '主轴', group: 'layout' },
  gap: { label: '间距', group: 'layout' },
  'gap-px': { label: '留缝（像素）', group: 'layout' },
  'gap-x': { label: '列间距', group: 'layout' },
  'gap-y': { label: '行间距', group: 'layout' },
  cols: { label: '列数', group: 'layout' },
  z: { label: '层级', group: 'layout' },
  layout: { label: '布局', group: 'layout' },
  wrap: { label: '换行', group: 'layout' },
  grow: { label: '撑满', group: 'layout' },
  stretch: { label: '铺满父容器（align-self: stretch）', group: 'layout' },
  bend: { label: '拐点', group: 'layout' },
  r: { label: '半径', group: 'layout' },
  as: { label: '标题级别', group: 'appearance' },
  depth: { label: '最大深度', group: 'layout' },
  limit: { label: '最多显示', group: 'layout' },
  measure: { label: '测量宽', group: 'layout' },
  scale: { label: '刻度', group: 'appearance' },
  ink: { label: '墨阶', group: 'appearance' },
  long: { label: '长行', group: 'appearance' },
  filled: { label: '填充格（布尔：写 filled 即填充）', group: 'state' },
  ruler: { label: '字节尺', group: 'appearance' },
  overflow: { label: '溢出', group: 'appearance' },
  fill: { label: '填充（none / cover / contain）', group: 'appearance' },
  orientation: { label: '方向', group: 'layout' },
  stride: { label: '步长', group: 'layout' },
  position: { label: '焦点', group: 'appearance' },
  collapsed: { label: '收起目录', content: true },
  hidden: { label: '显示隐藏文件', group: 'appearance' },
  numbers: { label: '行号', group: 'appearance' },
  summary: { label: '摘要', group: 'appearance' },
  'label-position': { label: '角标位置', group: 'appearance' },
  // 连线标签相对中点的偏移：label-offset="dx,dy"。
  'label-offset': { label: '标签偏移（dx,dy）', group: 'layout' },
  // 关系层（vk-annotate）：一个组件、四种形态，属性名按形态分组。
  mode: { label: '形态', group: 'appearance' },
  shape: { label: '形状', group: 'appearance' },
  head: { label: '端点', group: 'appearance' },
  ring: { label: '圈形', group: 'appearance' },
  double: { label: '内外两圈', group: 'appearance' },
  width: { label: '线宽', group: 'appearance' },
  'mark-label': { label: '差异标签', content: true },
  // 以下三项是「窄容器 / 地图页 / 无壳终端」的显式开关，都只改呈现，不改内容。
  done: { label: '已完成态', group: 'state' },
  'title-show': { label: '显示标题', group: 'appearance' },
  zoom: { label: '差异放大', group: 'appearance' },
  header: { label: '页眉', content: true },
  footer: { label: '页脚', content: true },
};

/**
 * 组件默认值：属性参考、组件页的“默认”列与 tests/defaults.test.mjs 都读它。
 *
 * 这是**声明面**，必须与运行时回落一致：`tests/defaults.test.mjs` 会在每个
 * 标本页的第一个实例上做“不写属性 vs 显式写默认值”的行为对比，并检查
 * 数值默认值落在声明的 min..max 内。改这里就要同步改运行时（或反过来），
 * 否则 npm test 报红。
 */
export const DEFAULTS = {
  'vk-box': { surface: 'none', radius: 'lg', border: 'none' },
  // plain 默认无框无底：要框必须显式写 border。
  // chrome="none"：默认仍是"没有标题栏的分区"；写 dots 才长成窗体。
  'vk-panel': { tone: 'neutral', variant: 'plain', pad: 'md', radius: 'lg', border: 'none', chrome: 'none' },
  // fit-min 是硬地板：容器再窄，字号也不再掉到它以下（默认 40，见 vk-text 的 fit）。
  'vk-text': { size: 'body', weight: 'regular', align: 'left', ink: 'primary', 'fit-min': 40, 'fit-max': 240 },
  'vk-label': { variant: 'kicker', ink: 'muted', side: 'top' },
  'vk-inline': { variant: 'code' },
  'vk-icon': { name: 'info', size: 'md', ink: 'primary' },
  // 填充是对外唯一名字：旧 fit 只是别名，DEFAULTS 不再保留第二份。
  'vk-img': { fill: 'cover', position: '50% 50%', radius: 'lg', border: 'none' },
  'vk-rule': { variant: 'thin', orientation: 'horizontal' },
  'vk-stack': { gap: 'sm', align: 'stretch', justify: 'start', direction: 'column' },
  // 12 栏坐标系的沟槽是 32（--vk-grid-gutter），也就是 md；不是间距梯的 sm 24。
  'vk-grid': { cols: '2', gap: 'md', align: 'stretch' },
  // 中轴符号字号不写默认值：像素写法（48）不在语义档枚举里，运行期回落 48。
  'vk-pair': { split: 50, axis: 'line', 'axis-width': 2, symbol: 'none', gap: 24, direction: 'horizontal' },
  // 步距默认 48：三块并排时刚好是「一块小留白」，不是三等分的缝。
  // 箭头默认画（arrow="false" 关掉）；尺寸默认取容器高 × 0.12，夹在 28–64。
  'vk-flow': { gap: 48, arrow: 'true' },
  'vk-canvas': { pad: '0', grid: '0', overflow: 'visible' },
  // 标注文字默认 body（56），与 .vk-edge-label 的基础字号一致。
  'vk-edge': { 'from-side': 'auto', 'to-side': 'auto', variant: 'ortho', tone: 'neutral', strength: 'solid', arrow: 'end', size: 'body', z: 20 },
  'vk-list': { variant: 'bullet', gap: 'sm', mass: 'normal' },
  'vk-code': { chrome: 'min', mass: 'normal', reveal: 'all', surface: 'paper', long: 'clip', columns: 'all' },
  // bytes 是布尔属性：不写 = 不显示机器码；没有“空字符串默认值”这回事。
  'vk-asm': { mass: 'normal', long: 'clip', chrome: 'min', reveal: 'all', columns: 'all' },
  // 主值默认 title（200）：一帧放三个数字时 hero（280）会把整页撑爆。
  'vk-timeline': { variant: 'events', mass: 'normal', size: 'title', current: '-1' },
  'vk-pin': { variant: 'bubble', side: 'auto', leader: 'elbow', tone: 'info', size: 'body', strength: 'soft', z: 60 },
  'vk-ring': { variant: 'rect', tone: 'focus', pad: 8, stroke: 4, dim: 0.45, z: 40 },
  'vk-annotate': {
    mode: 'arrow',
    // 默认一条顺滑的弯：折线是旧 vk-edge 的相貌，新标签不再默认画三个直角。
    shape: 'curve',
    dash: 'solid',
    // 默认终点一个实心箭头；缩放 0.12 见 arrow 的 scale: 段。
    arrow: 'end',
    note: 'bubble',
    ring: 'ellipse',
    tone: 'neutral',
    size: 'body',
    strength: 'soft',
    side: 'auto',
  },
  // 注解原语：默认是"像书页边注"的那一种，不是气泡。
  // kind="bubble" 是原 vk-pin 的泡 + 引线；其余旋钮与气泡共用一套取值。
  'vk-note': { variant: 'margin', side: 'auto', leader: 'line', tone: 'info', strength: 'soft', size: 'body', gap: 24 },
  // 归属说明：默认贴在目标块上方，左边界对齐首字符。
  'vk-caption': { side: 'top' },
  'vk-term': { prompt: '$', chrome: 'min', mass: 'normal', lang: 'sh', reveal: 'all', 'title-show': 'false', surface: 'paper' },
  'vk-diff': { variant: 'unified', chrome: 'min', mass: 'normal', columns: 'all' },
  'vk-table': { variant: 'ledger', mass: 'normal' },
  'vk-math': { size: 'body' },
  'vk-compare': { variant: 'split', ratio: '16 / 9', split: 50, fill: 'cover', position: '50% 50%', 'label-position': 'inside' },
  'vk-tree': { depth: '4', chrome: 'min', mass: 'normal', limit: 14, columns: 'all' },
  'vk-window': { chrome: 'min', pad: 'lg', mass: 'normal' },
  'vk-bits': { index: '7-0', group: '4', tone: 'neutral', mass: 'normal' },
  'vk-bars': { mass: 'normal', tone: 'neutral', scale: 'linear', format: 'thousands' },
  'vk-bytes': { cols: '8', group: '1', mass: 'normal', word: '1', endian: 'little', chrome: 'min', columns: 'all' },
  'vk-cells': { cols: '8', mass: 'normal', current: '-1', columns: 'none' },
  // current 不写 = -1：不替作者宣称「现在停在第 1 步」；要做进度就显式写 current="2"。
  'vk-steps': { current: '-1', mass: 'normal', direction: 'horizontal', connector: 'arrow', done: 'auto' },
  'vk-page': { align: 'top', theme: 'paper' },
  // 图示容器：不写 kind 就是对比；不写 current 就不宣称「现在停在第几步」。
  'vk-scene': { kind: 'compare', current: '-1' },
  // 叠层：不写 tone 就是中性；可读性保护默认开。
  'vk-layer': { tone: 'neutral', readable: 'on' },
};

export const LAYERS = [
  { id: 'tokens', label: 'L0 值', note: '不可再分的决定，只读' },
  { id: 'elements', label: 'L1 原子', note: '屏幕上真实存在的单个物件' },
  { id: 'layout', label: 'L2 排布', note: '只决定在哪、多大' },
  { id: 'components', label: 'L3 器械', note: '渲染一种编程数据的形状' },
  { id: 'relations', label: 'L4 关系', note: '两点之间的关系与批注' },
  { id: 'page', label: 'L5 页面', note: '一整张 1920×1080 的画布' },
];

export const TAGS = {
  'vk-box': {
    name: '面',
    layer: 'elements',
    summary: '一个面：背景、描边、圆角、内距。不认识兄弟，不排别人。',
    attrs: {
      'surface': oneOf('none', 'paper', 'soft', 'sf-1', 'sf-2', 'sf-3', 'sf-4'),
      // 色调：与全库同一套六值（以前只有 ok/warn/err，focus 得绕道 vk-rule）。
      'tone': tone(),
      'pad': space(SPACE_TIERS),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
      // 描边强调：一圈不占布局的环（原 vk-ring 的那层"看这里"）。
      // 环色跟 tone 走；不写 tone 时是焦点色。
      'ring': bool(),
      'w': num({ min: 48, max: 1920, step: 1 }),
      'h': num({ min: 48, max: 1080, step: 1 }),
      'x': { ...num({ min: -1920, max: 1920, step: 1 }), hidden: true },
      'y': { ...num({ min: -1080, max: 1080, step: 1 }), hidden: true },
    },
  },
  'vk-panel': {
    name: '分区',
    layer: 'elements',
    summary:
      '一块内容分区：底色、可选标题带、内距、圆角；chrome="dots" 会长出窗头，于是它也能当窗用。它只描述这一块，不认识兄弟、不排别人；排布归 vk-stack / vk-grid。',
    attrs: {
      // 语义色只用来染「面」：plain / raised 上落 wash，inset 上落 tint，dark 上落深色 wash。
      'tone': tone(),
      // 四档表面：白纸 / 抬起 / 凹下 / 深色。三档浅色靠明度分开，不是四种主题。
      'variant': oneOf('plain', 'raised', 'inset', 'dark'),
      // 有标题才有标题带；标题带里放 vk-label（kicker）。
      'title': text(),
      // 窗头：dots = 三点 + 标题（原 vk-window 的 min / browser）；none = 干净的分区（默认）。
      'chrome': oneOf('dots', 'none'),
      // 填充：与 img / layer 同一套三值（coverage：吃满宽高 / 只吃宽）。
      'fill': fill(),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
    },
  },
  'vk-text': {
    name: '文字',
    layer: 'elements',
    summary: '一段文字：字阶、字重、墨阶、等宽、对齐、测量宽；可带一个语义图标（文字与图标共存）。',
    content: {
      kind: 'text',
      target: 'vk-text',
      fields: [{ name: 'text', label: '文字', type: 'textarea', text: true }],
    },
    attrs: {
      // 字阶：全库同一套十个语义档（用哪一档由组件实现，档名不许各写各的）。
      'size': sizeTier(),
      'weight': oneOf('regular', 'medium', 'bold'),
      'mono': bool(),
      'align': oneOf('left', 'center', 'right'),
      // 行宽：none 不限；8–60 是一行几个字（1em ≈ 一个汉字），不写就按字号档的默认行宽。
      'measure': { ...text(), layout: true },
      // 断行：balance 让标题两行等长，pretty 避免孤行，nowrap 不折。
      'wrap': { ...oneOf('balance', 'pretty', 'nowrap'), layout: true },
      // 数值写法（原 vk-stat 的唯一机制）：52980 → 52,980。排版归配方。
      'format': oneOf('none', 'thousands', 'bytes', 'hex'),
      // 单行塞满：字号自动缩放到「这一行文本恰好填满容器宽」，只给单行等宽文本。
      // 不写 fit 时行为与旧版逐像素一致（字号仍只由 size 档决定）。
      'fit': oneOf('width'),
      // fit 的边界；只在 fit="width" 时生效。fit-min 是硬地板：容器再窄，
      // 字号也不再往下缩，改为给宿主 data-fit-overflow 并提醒（默认 40）。
      'fit-min': { ...num({ min: 8, max: 240, step: 1 }), default: 40, when: { fit: ['width'] } },
      'fit-max': { ...num({ min: 8, max: 400, step: 1 }), when: { fit: ['width'] } },
      // 图标：Lucide 名，构建期校验（语义白名单外报错）；图标与文字共存，
      // 因为它本来就是一个字形，不是另一个标签。原 <vk-icon> 的整块形态由别名转发。
      'icon': text(),
    },
  },
  'vk-label': {
    name: '标签',
    layer: 'elements',
    summary: '一行小字：分类、进度、状态。四种墨阶 + 五种语义色，三种形态（kicker / chip / badge），可带一个图标；写 for 就贴到目标块上（原 vk-caption）。',
    content: {
      kind: 'text',
      target: 'vk-label',
      fields: [{ name: 'text', label: '文字', type: 'textarea', text: true }],
    },
    attrs: {
      // tag 是「流程步骤 / 块名」专用的一档：36px（caption 的 0.75）、.08em 字距、
      // 只上色不加底不加框。kicker / chip / badge 仍是页眉、状态、序号。
      'variant': oneOf('kicker', 'chip', 'badge', 'tag'),
      // 色调：全库六值（以前少 neutral；neutral = 不上色，与不写同效）。
      'tone': tone(),
      'ink': oneOf('primary', 'secondary', 'tertiary', 'muted'),
      // 列开关只有一个名字：index/total 已并成 counter。
      'counter': { ...text(), content: true },
      'section': { ...text(), content: true },
      // 内联图标：只收 Lucide 名字，构建期校验；不写就没有图标槽。
      'icon': text(),
      // 归属说明（原 vk-caption）：写 for 就把这一行贴到目标块上方/下方，
      // 左边界对齐目标块的首字符；不写就是块里的一枚标签。
      'for': sel(),
      // 贴在哪一侧：top 上方 / bottom 下方（旧名 anchor 的 above / below）。
      'side': oneOf('top', 'bottom'),
      // 贴块时的净空。默认 16；地板 12 是硬的——再近，标签的墨就碰到正文了。
      'gap': int({ min: 12, max: 240, step: 4, default: 16 }),
    },
  },
  'vk-inline': {
    name: '行内',
    layer: 'elements',
    summary: '行内文字：代码、公式、上下标、链接。字号跟随所在文本行。',
    content: {
      kind: 'text',
      target: 'vk-inline',
      fields: [{ name: 'text', label: '文字 / TeX', type: 'textarea', text: true }],
    },
    attrs: {
      'variant': oneOf('code', 'math', 'sup', 'sub', 'link', 'keys'),
      'href': text(),
    },
  },
  'vk-icon': {
    name: '图标',
    layer: 'elements',
    // 减法第一波：图标本质是一个字形，并回 vk-text。旧标签继续可用，构建期提示迁移。
    aliasOf: 'vk-text',
    aliasNote: '图标本质是一个字形：改用 <vk-text icon="check">，文字与图标可以共存。',
    summary:
      '已合并到 vk-text（旧名保留）：图标本质是一个字形，用 <vk-text icon="名称">。语义图标可用 check / circle-check / triangle-alert / info / x / circle-x / arrow-up / arrow-down / arrow-right。',
    content: {
      kind: 'text',
      target: 'vk-icon',
      fields: [{ name: 'name', label: '图标名（只能取语义白名单里的名字）', type: 'text', attr: 'name' }],
    },
    attrs: {
      'name': text(),
      'tone': oneOf('info', 'focus', 'ok', 'err', 'warn'),
      'label': text(),
      'src': { ...text(), build: true },
    },
  },
  'vk-img': {
    name: '图片',
    layer: 'elements',
    summary: '一张图：比例、填充方式、焦点。加载失败有可见占位。',
    content: {
      kind: 'text',
      target: 'vk-img',
      fields: [
        { name: 'src', label: '图片地址', type: 'text', attr: 'src' },
        { name: 'alt', label: '替代文字', type: 'text', attr: 'alt' },
      ],
    },
    attrs: {
      'src': text(),
      'alt': text(),
      'ratio': text(),
      // 填充：全库同一套三值。旧 fit 是同义的第二个写法，已并进 fill。
      'fill': fill(),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
      // 出血：page 直系图/面铺到 1920 边。vk-img 是 CUSTOM（不拿 COMMON），
      // 但 bleed 是通用几何属性，类型、属性参考与构建期校验都该认识它。
      'bleed': { ...oneOf('x', 'y', 'all', 'none'), default: 'none', layout: true },
      'w': { ...size({ min: 48, max: 1920, step: 1 }), context: 'canvas-child', layout: true },
      'h': { ...size({ min: 48, max: 1080, step: 1 }), context: 'canvas-child', layout: true },
      'span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
      'row-span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
    },
  },
  'vk-rule': {
    name: '分隔线',
    layer: 'elements',
    aliasOf: 'vk-box',
    aliasNote: '一条线就是一块 1px 高的面：用 <vk-box border="hair">（或 vk-box 的 h + surface）。',
    summary: '已合并到 vk-box（旧名保留）：线是 1px 高的 box，渲染与旧版一致。',
    attrs: {
      'orientation': oneOf('horizontal', 'vertical'),
    },
  },
  'vk-window': {
    name: '窗',
    layer: 'elements',
    aliasOf: 'vk-panel',
    aliasNote: '窗就是带窗头的分区：用 <vk-panel chrome="dots" title="…">，窗头与内距是同一套属性。',
    summary: '已合并到 vk-panel（旧名保留）：chrome="dots|none" 决定有没有三点窗头。',
    attrs: {
      'mass': oneOf('compact', 'normal', 'hero'),
      'title': text(),
      'url': text(),
      'chrome': oneOf('min', 'none', 'plain', 'browser'),
      'tone': tone(),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
    },
  },

  'vk-stack': {
    name: '竖排',
    layer: 'layout',
    summary:
      '纵向节奏。只给间距和对齐，不画任何东西。默认等距；写 weights="1 2 1" 时按权重分剩余高度（ratio 是它的别名）。',
    attrs: {
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'group', 'section', 'plate'),
      // direction: 竖排（默认）或横排。14.0 把 vk-row 并了进来——
      // 它们本来就是同一个空类，差别只有一条 flex-direction。
      'direction': oneOf('column', 'row'),
      'align': oneOf('start', 'center', 'end', 'stretch', 'baseline'),
      'justify': oneOf('start', 'center', 'end', 'between'),
      'wrap': { ...bool(), context: 'direction-row' },
      'grow': { ...bool(), hidden: true },
      // 权重分的是「剩余高度」：按顺序对应前 N 个直接子项；列表之外的孩子
      // 保持内容高（96px 字幕带就是这么留白的）。容器要有确定高度。
      'weights': { type: 'text', context: 'bounded-height' },
      'ratio': { type: 'text', context: 'bounded-height' },
    },
  },
  'vk-grid': {
    name: '网格',
    layer: 'layout',
    summary: '分份容器。cols/rows 切几份，子项用 span 占几份；行高按内容。',
    attrs: {
      // 1–12 等分；12 是版面默认坐标系（--vk-grid-cols），默认沟槽 32（--vk-grid-gutter）。
      'cols': oneOf('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'),
      'tracks': text(),
      'rows': { ...oneOf('1', '2', '3', '4', '5', '6'), context: 'bounded-height' },
      // 间距只有一个名字：gap="md" 或 gap="sm lg"（先 x 后 y）。
      'gap': space(GAP_TIERS),
      'align': oneOf('start', 'center', 'end', 'stretch'),
    },
  },
  /**
   * 叠层：子元素绝对定位叠放，第一个铺底、其余按顺序叠上。
   *
   * 它不排内容（排布归 stack / grid），只回答"谁压在谁上面"。
   * vk-text 放在上面时默认加一圈纸色描边（readable="off" 关掉）；
   * surface 是这一层的底色，跟 vk-panel / vk-box 共用同一套五档。
   */
  'vk-layer': {
    name: '叠层',
    layer: 'layout',
    summary:
      '叠放容器：第一个子元素铺满当底，其余按顺序绝对定位叠在上面；vk-text 放在最上面时默认加纸色描边（readable="off" 关），surface 给这一层上五档底色。',
    attrs: {
      // 五档底：纸 / 极淡 / 稍深 / 深色 / 实色强调（tone 决定强调色）。
      'surface': oneOf('paper', 'wash', 'tint', 'dark', 'accent'),
      'tone': tone(),
      // 这一层怎么铺在父容器里：none / cover / contain（与 img、panel 同一套）。
      'fill': fill(),
      // 叠在照片/深色块上的字默认加保护；显式 off 才关。
      'readable': { ...oneOf('on', 'off'), default: 'on' },
      'grow': bool(),
      // 通用出血：让这一层越过版心到画布边。
      'bleed': { ...oneOf('x', 'y', 'all', 'none'), default: 'none', layout: true },
    },
  },
  /**
   * 并置对照：两块内容左右（或上下）并置，中间一条轴。
   *
   * 它不是 vk-grid 的特例：grid 解决"分几份"，pair 解决"两块对着看"，
   * 轴是两者的关系（一个可选的符号），不是第三块内容。
   * 子节点顺序即位置：第一个在左 / 上，第二个在右 / 下。
   * 不写 symbol 时，轴只是一条线；axis="none" 时连线和符号都不画。
   */
  'vk-pair': {
    name: '并置',
    layer: 'layout',
    summary: '两块并置对照：左右（或上下）两块，中间一条轴；轴上可放 → / = / vs，也可只留一条线。tone="左,右" 可给两侧各上一种语义淡底。',
    attrs: {
      // 左块占内容区的百分比；右块自动吃掉剩下的。上下并置时是上块占比。
      'split': num({ min: 5, max: 95, step: 1 }),
      // line = 画一条 1–4px 的轴；none = 不画轴（也不画符号）。
      'axis': oneOf('line', 'none'),
      'axis-width': num({ min: 1, max: 4, step: 1 }),
      // 轴上的符号：→ / = / vs；none 就是一条干净的线。
      'symbol': oneOf('→', '=', 'vs', 'none'),
      // 中轴符号的字号：像素数或语义档（size 只表字号，见 vocab）。
      'size': fontSize(),
      // 块与轴之间的留白（像素）；沟槽总宽 = 2 × gap。
      'gap': num({ min: 8, max: 200, step: 1 }),
      // 横 / 竖：与 vk-stack / vk-steps 同一个名字（旧名 orientation）。
      'direction': oneOf('horizontal', 'vertical'),
      // 两侧分色：tone="左,右"（第二段可省；none = 这一侧不上色）。
      // 只染「面」（wash 底 + 1px 同色系 tint 描边）；不写就不改现状（透明）。
      'tone': tone({ list: true }),
    },
  },
  /**
   * 流程：N 步 + N-1 根箭头。
   *
   * 它不是 vk-steps 的另一种形态：steps 是"工序到哪了"的进度地图，
   * flow 是"东西怎么变的"——每一步一块，块之间用箭头连接。
   * 子节点顺序即流程顺序：<li label="…" tone="…">…</li>；
   * 每步等宽，窄于 1100px 自动竖排（箭头朝下）。
   */
  'vk-flow': {
    name: '流程',
    layer: 'layout',
    summary:
      '多步流程：每步一块（上方小标签 + 内容块），等宽排开，块之间画箭头；gap 控制步距（默认 48），箭头尺寸 = 容器高 × scale（arrow="true,scale:0.12"，夹在 28–64），容器窄于 1100px 自动竖排。',
    attrs: {
      // 步距（像素）：既是块距，也是箭头占的轨道宽/高。
      'gap': num({ min: 8, max: 200, step: 1 }),
      // 箭头默认画：不写 arrow 也画；arrow="false" 关掉。
      // 尺寸 = 容器高 × scale（默认 0.12，夹 28–64），中轴词写 label:…。
      'arrow': text(),
    },
  },
  'vk-canvas': {
    name: '坐标画布',
    layer: 'layout',
    summary: '坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。',
    attrs: {
      'w': num({ min: 48, max: 1920, step: 1 }),
      'h': num({ min: 48, max: 1080, step: 1 }),
      'pad': num({ min: 0, max: 200, step: 1 }),
      'grid': num({ min: 0, max: 192, step: 8 }),
    },
  },
  'vk-edge': {
    name: '连线',
    layer: 'relations',
    summary: '两点之间的连线。自己算锚点，三种形状。',
    attrs: {
      'from': sel(),
      'to': sel(),
      'from-side': oneOf('left', 'right', 'top', 'bottom', 'auto'),
      'to-side': oneOf('left', 'right', 'top', 'bottom', 'auto'),
      'variant': { ...oneOf('ortho', 'curve', 'line'), default: 'ortho' },
      'tension': num({ min: 5, max: 120, step: 1, when: { variant: ['curve'] } }),
      'label': text(),
      // 连线色调：全库六值（以前只有 neutral/info/focus）。
      'tone': tone(),
      // 强度：与标注 / 注解同一个名字（旧名 emphasis）。
      'strength': oneOf('solid', 'soft', 'ghost'),
      // 连线标签的字号：与全库同一个名字（旧名 label-size）。
      'size': sizeTier(),
      // 箭头：一个词管端点 / 样式 / 尺寸 / 端点圆点（旧 arrow-style / arrow-size / cap 已并进来）。
      'arrow': text(),
      'dash': bool(),
      'gap': num({ min: 0, max: 200, step: 1, when: { variant: ['ortho'] } }),
      'bend': num({ min: -200, max: 200, step: 1, when: { variant: ['ortho'] } }),
      // 标签相对连线中点的偏移：label-offset="dx,dy"（旧名 label-dx / label-dy）。
      'label-offset': text(),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },

  'vk-list': {
    name: '列表',
    layer: 'components',
    summary: '列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。',
    content: {
      kind: 'items',
      target: 'vk-list',
      fields: [{ name: 'items', label: '条目（一行一个）', type: 'lines', item: 'li' }],
    },
    attrs: {
      'rule': bool(),
      'bare': bool(),
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'group', 'section', 'plate'),
      // 密度：compact 只压行高与内距（1.2 / s2），默认 normal 与引入前逐像素一致。
      'mass': oneOf('compact', 'normal'),
    },
  },
  'vk-code': {
    name: '代码窗',
    layer: 'components',
    summary: '代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮；reveal="line" 逐行浮现。',
    content: {
      kind: 'rebuild',
      note: '代码文本由 Shiki 在构建期编译；改文本请改 src 文件并运行 npm run build。这里仍然可以调高亮行、聚光、折叠、密度、窗头。',
    },
    attrs: {
      'lang': text(),
      'src': text(),
      'lines': text(),
      'file': text(),
      // 当前行：与全库同一个语义（第 N 行，1 起；-1 = 不标）。旧名 line 已并进来。
      'current': lines(),
      'focus': lines(),
      'fold': lines(),
      'omit': text(),
      'fold-note': text(),
      'chrome': oneOf('min', 'none'),
      'mark': text(),
      // 列开关：行号（numbers）用 columns 表达；不写 = 显示。
      'columns': columns('vk-code'),
      // 体量：compact / normal / hero。密度只认这个名字（size 只管字号）。
      'mass': massLevel(),
      // 内容字号：像素数（160）或语义档（body / headline / caption …）。
      // 行高、行号、内距、语法下划线都从同一个 --vk-cs 派生，不设上限。
      'size': fontSize(),
      // 自动铺满容器宽：按内容自然宽反算字号（复用 vk-text 的 fit 规矩）。
      'fit': oneOf('width'),
      // 表面：paper = 白纸（默认，旧行为）；inset = 浅灰凹面；dark = 深色底 + 反白。
      // 深色不是"只把背景刷黑"：窗头、行号、语法、提示符、当前行都在同一层适配。
      'surface': oneOf('paper', 'dark', 'inset'),
      // all = 整块出现（默认，和以前一样）；line = 按 at + stagger 逐行浮现；none = 不参与出场。
      'reveal': { ...oneOf('all', 'line', 'none'), default: 'all' },
    },
  },
  'vk-term': {
    name: '终端',
    layer: 'components',
    summary: '终端。src 指向真实 transcript；命令 / 参数 / 路径 / 输出 / 报错各自一色；逐行浮现。',
    content: {
      kind: 'text',
      target: 'vk-term',
      fields: [
        { name: 'text', label: 'transcript 文本', type: 'textarea', text: true, raw: true, clears: ['src'] },
        { name: 'src', label: 'transcript 文件', type: 'text', attr: 'src' },
        { name: 'title', label: '窗头标题', type: 'text', attr: 'title' },
        { name: 'prompt', label: '提示符', type: 'text', attr: 'prompt' },
      ],
    },
    attrs: {
      'src': text(),
      'lines': { ...text(), build: true },
      'title': text(),
      'prompt': text(),
      'marks': text(),
      // sh = 认提示符后按 shell 切；powershell 同一套词法；asm = 非命令行按汇编切；none = 纯文本不上色。
      'lang': { ...oneOf('sh', 'powershell', 'asm', 'none'), default: 'sh' },
      // 当前行：与 vk-code / vk-asm 同一个语义（第 N 行，1 起）。旧名 line 已并进来。
      'current': lines(),
      'reveal': { ...oneOf('all', 'line', 'none'), default: 'all' },
      'chrome': oneOf('none', 'min'),
      // 无壳终端（chrome="none"）默认不显示标题：标题只留给 panel 的标题带，
      // 这里只把 title 留作无障碍名。确实要在无壳终端上再显示一次，才写 title-show。
      'title-show': bool(),
      'mass': massLevel(),
      // 与 vk-code 同一套内容字号 / 铺满（行高、提示符、内距一起缩放）。
      'size': fontSize(),
      'fit': oneOf('width'),
      // 表面：paper = 白纸（默认）；inset = 浅灰凹面；dark = 深色底 + 反白。
      'surface': oneOf('paper', 'dark', 'inset'),
    },
  },
  'vk-diff': {
    name: '对比',
    layer: 'components',
    summary: '对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。',
    content: {
      kind: 'rebuild',
      note: 'diff 文本由 Shiki + tokenDiff 在构建期编译；改文本请改 src 文件并运行 npm run build。variant / chrome / w 仍然 live。',
    },
    attrs: {
      'mass': massLevel(),
      'lang': { ...text(), build: true },  // diff 的词级高亮在构建期编译，运行期改 lang 不重新着色
      'src': { ...text(), build: true },
      'lines': text(),
      'file': text(),
      'chrome': oneOf('min', 'none'),
      // 列开关：行号 / 摘要一句话（numbers / summary 的旧名是别名）。
      'columns': columns('vk-diff'),
      // 内容字号 / 铺满（行号、增删色块、内距一起缩放）。
      'size': fontSize(),
      'fit': oneOf('width'),
    },
  },
  'vk-table': {
    name: '表格',
    layer: 'components',
    summary: '表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr state="mark"> 标出重点。',
    content: {
      kind: 'rows',
      target: 'table',
      fields: [
        { name: 'header', label: '表头（列 1 | 列 2 | …）', type: 'line' },
        { name: 'rows', label: '表体（每行：列 1 | 列 2 | …）', type: 'lines' },
      ],
    },
    attrs: {
      'variant': oneOf('ledger', 'compare', 'spec', 'matrix'),
      'stripe': bool(),
      'mono': bool(),
      'mass': massLevel(),
      // 内容字号 / 铺满（表头、行距、内距一起缩放）。
      'size': fontSize(),
      'fit': oneOf('width'),
    },
  },
  'vk-math': {
    name: '公式',
    layer: 'components',
    summary: '公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。',
    content: {
      kind: 'rebuild',
      note: '公式由 KaTeX 在构建期排版；改 .tex 后运行 npm run build。size / display 仍然 live。',
    },
    attrs: {
      'src': { ...text(), build: true },
      'display': bool(),
      // 字号：全库同一套语义档（以前只有 label / body / subhead 三档）。
      'size': sizeTier(),
    },
  },
  'vk-compare': {
    name: '对照',
    layer: 'components',
    summary:
      '前后对照：mode="split"（默认）时左边 split% 显示 labels 的第一张、右边显示第二张（labels="a,b"），上面那张按 split 裁掉右侧；mode="side" 左右并排、mode="stack" 上下排列，两张图各自完整、都不裁切。角标接在竖线后（labels="a,b|左|右"），默认叠在图上（label-position="inside"）；label-position="top" 会为角标单独让出一条带，不压图像。mark 在图上标出差异（x1,y1,x2,y2 百分比；多组用 ;），mark-label 给角标；split 下每处只标在框心所属的那一半，side/stack 下只标在 a 图（b 是参照物）。zoom="mark" 在下方生成一块差异放大（默认 ×2），也可以写 x1,y1,x2,y2 或只写倍数。',
    attrs: {
      'alt': text(),
      // 形态：split 叠图裁切 / side 并排 / stack 上下（旧名 mode，已并进 variant）。
      'variant': oneOf('split', 'side', 'stack'),
      'ratio': text(),
      'split': num({ min: 0, max: 100, step: 1 }),
      // 填充：与 img / panel / layer 同一套（旧名 fit，已并进 fill）。
      'fill': fill({ default: 'cover' }),
      'position': text(),
      // 两张图：labels="a,b"（源图）或 labels="a,b|左角标|右角标"（旧名 a / b / label-a / label-b）。
      'labels': text(),
      // 角标默认叠在图上（inside，保持旧样子）；top 在图上腾一条带，不压任何像素。
      'label-position': oneOf('inside', 'top'),
      // 差异框：相对百分比坐标，多组用 ";"。split 下只画在所属的那一半。
      'mark': text(),
      'mark-label': text(),
      // 差异放大：zoom="mark" 放大 mark 框住的那块；也可以写 x1,y1,x2,y2，
      // 或只写倍数（2）。默认 ×2，块与小标题由组件给。
      'zoom': text(),
    },
  },
  'vk-tree': {
    name: '文件树',
    layer: 'components',
    summary: '文件树：src 指向真实目录，构建期扫描层级、类型、大小。',
    content: {
      kind: 'text',
      target: 'vk-tree',
      fields: [
        { name: 'tree', label: '树数据（JSON）', type: 'textarea', script: 'data-vk-tree', clears: ['src'] },
        { name: 'title', label: '标题', type: 'text', attr: 'title' },
        { name: 'current', label: '当前节点', type: 'text', attr: 'current' },
      ],
    },
    attrs: {
      'mass': massLevel(),
      'src': { ...text(), build: true },
      'title': text(),
      // 当前项：1 起的节点序号，或节点路径（树是唯一按路径寻址的列表）。
      'current': text(),
      'collapsed': text(),
      'limit': int({ min: 1, max: 500, step: 1 }),
      // 列开关：顶部统计（旧名 summary）。不写 = 显示。
      'columns': columns('vk-tree'),
      'depth': int({ min: 0, max: 8, step: 1 }),
        'chrome': oneOf('min', 'none'),
      // 内容字号 / 铺满（行高、图标、缩进一起缩放）。
      'size': fontSize(),
      'fit': oneOf('width'),
    },
  },
  'vk-cells': {
    name: '内存格',
    layer: 'components',
    summary: '一格一个 <li>：标签、值、地址；state="err" 标出越界的那一格，act="focus" 标出当前格，超过 cols 自动换行。',
    content: {
      kind: 'children',
      target: 'vk-cells',
      item: 'li',
      fields: [
        { name: 'value', label: '值', type: 'text', attr: 'value' },
        { name: 'label', label: '标签', type: 'text', attr: 'label' },
        { name: 'span', label: '跨几格', type: 'int', attr: 'span' },
        { name: 'state', label: '状态', type: 'text', attr: 'state' },
        { name: 'filled', label: '填充格（布尔）', type: 'bool', attr: 'filled' },
      ],
    },
    attrs: {
      'addr': text(),
      'cols': int({ min: 0, max: 24, step: 1 }),
      'stride': int({ min: 1, max: 8, step: 1 }),
      // 列开关：字节偏移（offsets）与对齐括号（ruler）；不写 = 都不开。
      'columns': columns('vk-cells'),
      'direction': oneOf('ltr', 'rtl'),
      'mass': massLevel(),
      // 当前格：第 N 格（1 起）；-1 = 不标（与 li 上的 act="focus" 等效，二者取一）。
      'current': int({ min: -1, max: 99, step: 1 }),
    },
  },
  'vk-bytes': {
    name: '字节',
    layer: 'components',
    summary: '字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，current 标出一段字节。',
    attrs: {
      'src': { ...text(), build: true },
      'addr': { ...text(), build: true },
      'offset': { ...text(), build: true },
      'length': { ...text(), build: true },
      'cols': oneOf('4', '8'),
      'group': oneOf('1', '2', '4', '8'),
      // 列开关：地址列 / ASCII 列（旧名 address / ascii）；不写 = 都显示。
      'columns': columns('vk-bytes'),
      'current': text(),
      'mass': oneOf('compact', 'normal', 'hero'),
      'chrome': oneOf('min', 'none'),
    },
  },
  'vk-steps': {
    name: '步骤',
    layer: 'components',
    summary: '步骤条：编号 + 连线 + 当前步。条目写成 <li>；current="-1" = 不标当前步（纯地图，五步等权）；done="none" 连前面也不打勾，mark="N" 只强调第 N 步。',
    content: {
      kind: 'items',
      target: 'vk-steps',
      fields: [{ name: 'items', label: '步骤（一行一个）', type: 'lines', item: 'li' }],
    },
    attrs: {
      // -1 是合法值：地图页要"五步等权、不站在任何一步"，0 做不到。
      'current': int({ min: -1, max: 99, step: 1 }),
      // done="none"：前面不再自动打勾；地图页五步等权，只有 current（或 mark）强调。
      'done': { ...oneOf('auto', 'none'), default: 'auto' },
      // mark="N"：只强调第 N 步（0 起，和 current 同一套坐标），不给别的步打勾。
      'mark': int({ min: 0, max: 99, step: 1 }),
      'mass': oneOf('compact', 'normal', 'hero'),
    },
  },
  'vk-bits': {
    name: '位',
    layer: 'components',
    summary: '一行二进制位：索引、分组、符号位。',
    content: {
      kind: 'text',
      target: 'vk-bits',
      fields: [
        { name: 'value', label: '二进制（可含空格）', type: 'text', attr: 'value' },
        { name: 'label', label: '说明', type: 'text', attr: 'label' },
      ],
    },
    attrs: {
      'mass': massLevel(),
      'value': text(),
      'index': oneOf('7-0', '0-7', 'none', 'sparse'),
      'group': oneOf('1', '4', '8'),
      'sign': bool(),
      'label': text(),
      'tone': tone(),
      'bit-width': oneOf('8', '16', '32', '64'),
      'bytes': bool(),
    },
  },
  'vk-bars': {
    name: '条',
    layer: 'components',
    summary: '一组横向条：标签、数值条、单位；ratio-to 指向基准行（0 起）时，每条旁直接标出相对它的倍率（×500）。子节点写成 <li value label>。',
    content: {
      kind: 'items',
      target: 'vk-bars',
      fields: [{ name: 'items', label: '条目（一行一个：标签|数值）', type: 'lines', item: 'i' }],
    },
    attrs: {
      'max': num({ min: 1, max: 1000000000, step: 1 }),
      'scale': oneOf('linear', 'log'),
      'ratio-to': int({ min: 0, max: 999, step: 1 }),
      'unit': text(),
      'format': oneOf('thousands', 'none'),
      'mass': massLevel(),
      'tone': tone(),
    },
  },

  'vk-asm': {
    name: '汇编',
    layer: 'components',
    summary: '汇编清单：地址 / 机器码 / 指令 / 操作数四列；行与地址都能被连线锚定。',
    content: {
      kind: 'rebuild',
      note: '汇编文本由构建期解析与高亮；改文本请改 src 文件并运行 npm run build。',
    },
    attrs: {
      'lang': { ...text(), build: true },  // 汇编文本构建期解析，运行期改 lang 不重新着色
      'src': { ...text(), build: true },
      'lines': text(),
      'file': { ...text(), build: true },
      // 当前行：与 vk-code / vk-term 同一个语义（第 N 行，1 起）。旧名 line 已并进来。
      'current': lines(),
      'reveal': { ...oneOf('all', 'line', 'none'), default: 'all' },
      'focus': lines(),
      'addr': { ...text(), build: true },
      'title': text(),
      'bytes': bool(),
      // 列开关：地址列；列标题写 columns="titles:地址|机器码|指令|操作数"。
      'columns': columns('vk-asm'),
      'mass': massLevel(),
      'long': oneOf('fail', 'wrap', 'clip'),
      'chrome': oneOf('min', 'none'),
      'order': text(),
      // 内存屏障：fence="after:4,label:编译器屏障"（旧 fence-after / fence-label）。
      'fence': text(),
      // 内容字号 / 铺满（列宽、行高、内距一起缩放）。
      'size': fontSize(),
      'fit': oneOf('width'),
    },
  },
  'vk-timeline': {
    name: '时间线',
    layer: 'components',
    summary: '时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <li>，li 可写 value（大数字主值）与 note（小说明）；主值字号写在 size（title 200 默认 / hero 280 / subhead 112 …），当前项写在 current（1 起，-1 = 不标）。',
    content: {
      kind: 'items',
      target: 'vk-timeline',
      fields: [{ name: 'items', label: '事件（一行一个：日期|标题|说明）', type: 'lines', item: 'i' }],
    },
    attrs: {
      'start': text(),
      'end': text(),
      'variant': oneOf('events', 'lanes'),
      'steps': int({ min: 1, max: 16, step: 1 }),
      'lanes': text(),
      'title': text(),
      'mass': massLevel(),
      // 当前项：第 N 个事件（1 起）；-1 = 不标（旧写法是 li 上写 state="current"）。
      'current': int({ min: -1, max: 99, step: 1 }),
      // 主值的字号：title 200（默认，一帧三个数字也不撑爆）/ hero 280 / subhead 112 …
      // size 只表字号，旧名 value-size 已并进来。
      'size': sizeTier(),
    },
  },
  'vk-page': {
    name: '页面',
    layer: 'page',
    summary:
      '坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。theme 换整套调色板（只换颜色，不动尺寸）。',
    attrs: {
      'align': oneOf('top', 'center', 'bottom'),
      /* 主题：三套内置调色板，见 src/tokens/themes.css。运行期镜像到 data-theme，
         所以写在祖先上的 data-theme 也一样生效；不写 = paper。 */
      'theme': oneOf('paper', 'graphite', 'blueprint'),
      /* 场次：一页 = 一段时间。dur 为 0 时就是一张静帧。 */
      'dur': { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
      'beat': { ...num({ min: 0.1, max: 4, step: 0.05 }), motion: true },
      'poster': { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
      /* ---- 视频维度：字幕 / 焦点 / 多态 / 页间转场 ---- */
      // 字幕轨：cue.json / .srt 的路径；也接受直接写 JSON 数组。
      'cues': { ...text(), content: true },
      // 同页多态：声明名字；每一态的 DOM 属性 / 内联样式写在
      // <script type="application/json" data-vk-states> 里。
      'states': { ...text(), content: true },
      // 页间转场：cut 是视频里最常用的默认值（不拖泥带水）。
      'transition': { ...oneOf('cut', 'fade', 'push'), default: 'cut' },
      // 焦点跟随的过渡：默认 200ms；写 0 就是立即，写 none 连过渡属性都不挂。
      'focus-duration': { ...num({ min: 0, max: 2000, step: 1 }), default: 200 },
      'focus-transition': { ...oneOf('on', 'off'), default: 'on' },
    },
  },
  /**
   * 图示语汇：五个「讲解动作」的组合容器。
   *
   * 它不新增任何图形原语：compare 用 pair，steps 用 flow + steps，
   * locate 用 cells/bytes/img，measure 用 bars/table，cause 用 pair + 标签。
   * 作者只填 slot 内容；默认版式由 scene.css 给，分段出现由全库同一套 cue 给。
   */
  'vk-scene': {
    name: '图示',
    layer: 'page',
    summary:
      '五种讲解动作的组合容器：kind="compare|steps|locate|measure|cause"，按 kind 自动排布命名槽位（a/b、step、where/map、value/chart/ratio、a/b/why），作者只填内容。',
    slots: [
      { name: 'a', note: 'compare 左块 / cause 现象' },
      { name: 'b', note: 'compare 右块 / cause 结果' },
      { name: 'label-a', note: 'compare / cause 左侧标签（可选）' },
      { name: 'label-b', note: 'compare / cause 右侧标签（可选）' },
      { name: 'step', note: 'steps 的每一步（可重复 N 次）' },
      { name: 'where', note: 'locate 的地址 / 坐标' },
      { name: 'map', note: 'locate 下方的 cells / bytes / img' },
      { name: 'value', note: 'measure 的主数字' },
      { name: 'chart', note: 'measure 下方的 bars / table' },
      { name: 'ratio', note: 'measure 右侧的倍数牌' },
      { name: 'why', note: 'cause 箭头上的词（富内容写法）' },
    ],
    attrs: {
      'kind': { ...oneOf('compare', 'steps', 'locate', 'measure', 'cause'), default: 'compare' },
      // 步骤条 / 进度轨的当前项：1 起；-1 = 不标（五步等权）。
      'current': int({ min: -1, max: 99, step: 1 }),
      // 两侧标签：compare / cause 用 "左|右"；steps 用它兜底每一步的名字。
      'labels': { ...text(), content: true },
      // 两侧分色：与 vk-pair 同一套写法 "左,右"；labels 的 tone 也读它。
      'tone': tone({ list: true }),
      // 因果页中间箭头上的词：arrow="label:因为 include"；槽 why 是它的富内容写法。
      'arrow': { ...text(), content: true },
      // 整块出场：与全库所有元件同一条字幕维度（槽上也可以写 cue）。
      'cue': { ...text(), motion: true },
    },
  },
  'vk-pin': {
    name: '批注泡',
    layer: 'relations',
    aliasOf: 'vk-note',
    aliasNote: '批注泡是 vk-note 的一种形态：用 <vk-note variant="bubble">（泡 + 引线，属性同旧版）。',
    summary: '已合并到 vk-note（旧名保留）：variant="bubble" 就是原来的气泡 + 引线。',
    content: {
      kind: 'text',
      target: 'vk-pin',
      fields: [
        { name: 'text', label: '批注文字', type: 'textarea', text: true },
        { name: 'for', label: '目标', type: 'text', attr: 'for' },
      ],
    },
    attrs: {
      'for': sel(),
      'side': oneOf('top', 'right', 'bottom', 'left', 'auto'),
      'x': num({ min: -4000, max: 4000, step: 1 }),
      'y': num({ min: -4000, max: 4000, step: 1 }),
      'n': int({ min: 1, max: 99, step: 1 }),
      'tone': tone(),
      'variant': oneOf('bubble', 'dot'),
      'strength': oneOf('solid', 'soft', 'ghost'),
      'leader': oneOf('elbow', 'straight', 'none'),
      'gap': num({ min: 0, max: 240, step: 1 }),
      'w': size({ min: 160, max: 900, step: 1 }),
      'size': oneOf('label', 'body', 'subhead'),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },
  'vk-ring': {
    name: '圈选',
    layer: 'relations',
    aliasOf: 'vk-box',
    aliasNote: '圈选是一块带环的面：用 <vk-box ring>（不占布局）；overlay 圈选用 vk-annotate mode="circle"。',
    summary: '已合并到 vk-box（旧名保留）：ring 是描边强调，不占布局。',
    attrs: {
      'for': sel(),
      'variant': oneOf('ellipse', 'rect', 'underline', 'bracket', 'dim'),
      // 只在 variant="dim"（压暗）时有意义：光一个 ring 无法判断"其余退后"的效果。
      'dim': { ...num({ min: 0, max: 1, step: 0.01 }), context: 'variant-dim' },
      'keep': { ...text(), context: 'variant-dim' },
      'pad': num({ min: 0, max: 80, step: 1 }),
      'tone': tone(),
      'dash': bool(),
      'stroke': num({ min: 1, max: 12, step: 1 }),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },
  /**
   * 关系层：一个组件，四种形态。vk-edge / vk-pin / vk-ring 是它的旧名字，
   * 只是把 mode 固定成 arrow / note / circle，并在构建期提示迁移。
   */
  'vk-annotate': {
    name: '标注',
    layer: 'relations',
    summary:
      '关系与图示：mode="arrow"（从一个元素/坐标指向另一个）、mode="circle"（圈出目标，可双圈）、mode="note"（批注泡 / 引线标签 / 编号点，自动避开正文）、mode="badge"（编号点）。只画覆盖层，不改布局。',
    content: {
      kind: 'text',
      target: 'vk-annotate',
      fields: [
        { name: 'text', label: '批注文字（note 形态）', type: 'textarea', text: true },
        { name: 'for', label: '目标（circle / note / badge，或 arrow 的终点）', type: 'text', attr: 'for' },
      ],
    },
    attrs: {
      'mode': { ...oneOf('arrow', 'circle', 'note', 'badge'), default: 'arrow' },
      // 目标 / 两端：支持 #id@part:arg、CSS 选择器，以及 arrow 的 "x,y" 坐标。
      'for': sel(),
      'from': sel(),
      'to': sel(),
      // arrow：走线与端点。
      'shape': { ...oneOf('straight', 'ortho', 'curve'), default: 'ortho' },
      'dash': { ...oneOf('solid', 'dashed'), default: 'solid' },
      'width': num({ min: 1, max: 24, step: 1 }),
      // 箭头一个词：端点 / 样式 / 尺寸 / 缩放 / 中轴词（旧 head / arrow-scale / arrow-label）。
      'arrow': text(),
      // circle：椭圆或矩形；double 再画一圈内环。
      'ring': { ...oneOf('ellipse', 'rect'), default: 'ellipse' },
      'double': bool(),
      // note：泡 / 引线标签 / 编号点；badge 形态固定编号点。
      'note': { ...oneOf('bubble', 'label', 'badge'), default: 'bubble' },
      'n': int({ min: 1, max: 99, step: 1 }),
      // 字号：与全库共用十档（旧写法只有 label / body / subhead，仍合法）。
      'size': { ...sizeTier(), default: 'body' },
      // 强度：与 vk-edge / vk-note 同一个名字（旧名 emphasis）。
      'strength': { ...oneOf('solid', 'soft', 'ghost'), default: 'soft' },
      'tone': { ...tone(), default: 'neutral' },
      'label': text(),
      // 箭头缩放与中轴词并进 arrow：arrow="scale:0.12,label:gcc"。
      'gap': num({ min: 0, max: 240, step: 1 }),
      'z': int({ min: 0, max: 99, step: 1 }),
      // note 形态的显式落点：side 指定气泡在哪一侧，x/y 直接给覆盖层坐标（同旧 vk-pin）。
      'side': { ...oneOf('auto', 'top', 'right', 'bottom', 'left'), default: 'auto' },
      'x': { ...num({ min: -4000, max: 4000, step: 1 }), context: 'mode-note' },
      'y': { ...num({ min: -4000, max: 4000, step: 1 }), context: 'mode-note' },
    },
  },
  /**
   * 注解原语（批次 G1）：两种"不像气泡"的注解。
   *
   * 气泡是"画在内容上的东西"；边注与图例是"排进版面里的注解"：
   *   margin —— 一条 1px 细线把目标与栏间空白里的一句话连起来，文字与正文基线对齐；
   *   legend —— 目标角上一枚编号点，页角一张编号 + 说明的图例表。
   *
   * 它只画覆盖层，不改布局；也不占焦点名额（和 vk-label 一样是辅助信息）。
   * 细线没有箭头：箭头只留给 vk-annotate mode="arrow" 的"指向关系"。
   */
  'vk-note': {
    name: '注解',
    layer: 'relations',
    summary:
      '三种注解：variant="margin" 用 1px 细线引到栏间空白（与正文基线对齐，自动选有空间的一侧）；variant="bubble" 是泡 + 引线（原 vk-pin）；variant="legend" 在目标角上放编号点，页角给编号 + 说明。不占布局，也不占焦点名额。',
    content: {
      kind: 'text',
      target: 'vk-note',
      fields: [
        { name: 'text', label: '注解文字（margin / bubble 形态）', type: 'textarea', text: true },
        { name: 'items', label: '图例条目（legend 形态，一行一条 <li>）', type: 'lines', item: 'li' },
      ],
    },
    attrs: {
      // 三种形态：边注 / 气泡 / 编号图例。默认边注——它才是"高级注解"的默认长相。
      // bubble 就是原 vk-pin：同一个泡、同一套类名，属性名也照旧（w / n / leader / strength…）。
      'variant': { ...oneOf('margin', 'bubble', 'legend'), default: 'margin' },
      // 目标：支持 #id@part:arg 与 CSS 选择器；legend 的多个目标用 ; 分隔，按顺序对应条目。
      'for': sel(),
      // 贴哪侧：margin 只认 left / right；bubble 四个方向都认；默认 auto = 自动选有空间的一侧。
      // 贴哪侧：margin 只认 left / right；bubble 四向 + auto；
      // legend 用 bottom-right / bottom-left / bottom（旧名 place 的 br / bl / bottom）。
      'side': {
        ...oneOf('left', 'right', 'top', 'bottom', 'bottom-right', 'bottom-left', 'auto'),
        default: 'auto',
      },
      // 引线：margin 用 line / dot；bubble 用 elbow / straight / none。
      'leader': { ...oneOf('line', 'dot', 'elbow', 'straight', 'none'), default: 'line' },
      // 图例落在页面哪一角：右下 / 左下 / 下方居中（side 的 bottom-right 等值）。
      // 旧名 place（br / bl / bottom）已并进 side。
      // 注解宽（像素上限）。margin 不会超过那一侧的空间；bubble 是气泡宽（160–900，可写 200px）。
      'w': size({ min: 96, max: 900, step: 1 }),
      'z': int({ min: 0, max: 99, step: 1 }),
      // bubble 形态的旋钮（与 vk-annotate mode="note" 同一套取值）；margin / legend 忽略它们。
      'tone': { ...tone(), default: 'info' },
      'strength': { ...oneOf('solid', 'soft', 'ghost'), default: 'soft' },
      'size': { ...sizeTier(), default: 'body' },
      'n': int({ min: 1, max: 99, step: 1 }),
      'gap': num({ min: 0, max: 240, step: 1 }),
      'x': num({ min: -4000, max: 4000, step: 1 }),
      'y': num({ min: -4000, max: 4000, step: 1 }),
    },
  },
  /**
   * 归属说明：贴在某个块上方（或下方）的一行小字。
   *
   * 减法第一波：它不是 vk-label 的另一种形态。
   * 位置由目标块决定，左边界对齐目标的首字符（不是容器左边）。
   * 只画覆盖层，不参与正文布局；字号/墨色固定 caption + ink secondary。
   */
  'vk-caption': {
    name: '归属说明',
    layer: 'relations',
    aliasOf: 'vk-label',
    aliasNote: '归属说明就是贴到目标块上的一枚标签：用 <vk-label for="#id" side="top|bottom">。',
    summary: '已合并到 vk-label（旧名保留）：label 写 for / side 就是原来的归属说明。',
    content: {
      kind: 'text',
      target: 'vk-caption',
      fields: [{ name: 'text', label: '说明文字', type: 'textarea', text: true }],
    },
    attrs: {
      // 目标块：支持 #id（含 @part）与 CSS 选择器。
      'for': sel(),
      // top = 目标上方；bottom = 目标下方（旧名 anchor）。
      'side': oneOf('top', 'bottom'),
    },
  },
};

/* ----------------------------------------------------------------- v10 共享语法
   块级组件统一拿 Frame 的 w/h/grow/fill/overflow/measure；
   行内组件（icon/tag/mark/keys）不拿 w；
   自定义几何（page/annotate/edge/canvas/img）自己声明。 */
const INLINE = new Set(['vk-icon', 'vk-inline', 'vk-label']);
const CUSTOM = new Set([
  'vk-page',
  'vk-scene',
  'vk-edge',
  'vk-canvas',
  'vk-img',
  'vk-pin',
  'vk-ring',
  'vk-annotate',
  'vk-note',
  'vk-caption',
  'vk-layer',
]);
const COMMON = {
  w: { ...size({ min: 48, max: 1920, step: 1 }), context: 'canvas-child', layout: true },
  h: { ...size({ min: 48, max: 1080, step: 1 }), context: 'canvas-child', layout: true },
  // 12 栏网格：一个子项最多占满 12 份。
  span: { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
  'row-span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
  z: { ...int({ min: 0, max: 99, step: 1 }), context: 'canvas-child', layout: true },
  grow: { ...bool(), layout: true },
  // 铺满父容器的一条轴（align-self: stretch）。旧页把它写成裸的 fill —— 见 vocab 的 ATTR_ALIAS：
  // 非填充组件上的 fill 会折成 stretch（逐像素不变），填充组件上的 fill 折成 cover。
  stretch: { ...bool(), layout: true },
  // 出血：负 margin 把这一块推到画布边（与 vk-page 的版心内距配合）。
  // x / y / all / none；none 是默认，旧页不写时逐像素不变。
  bleed: { ...oneOf('x', 'y', 'all', 'none'), default: 'none', layout: true },
  overflow: { ...oneOf('visible', 'clip'), default: 'visible', layout: true },
  /* L6 导演层：时刻 → 姿态。不进布局、不改尺寸，所以不参与几何审计。 */
  at: { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
  dur: { ...num({ min: 0, max: 60, step: 0.01 }), motion: true },
  enter: { ...oneOf('rise', 'fade', 'scale', 'wipe', 'none'), default: 'none', motion: true },
  ease: { ...oneOf('linear', 'out-cubic', 'out-quint', 'out-expo', 'in-cubic', 'in-out-sine'), motion: true },
  stagger: { ...num({ min: 0, max: 2, step: 0.01 }), motion: true },
  /* 视频维度：cue="3" / cue="0:06-0:09" 让元件跟着字幕出现、高亮；
     它只改 data-vk-cue-state，不改布局，所以契约不逐条探针（由 cues 测试覆盖）。 */
  cue: { ...text(), motion: true },
  /* L5 姿态层：act 是「做什么动作」，strength 是「多响」。两者都由运行期一遍写成
     data-act / data-strength，不改变子树结构，所以不进契约的子树探针，由 pose 测试覆盖。 */
  act: { ...oneOf('focus', 'context', 'mark'), pose: true },
  strength: { ...oneOf('solid', 'soft', 'ghost'), default: 'solid', pose: true },
};
/** 布局协议：由 Frame 基类统一实现，不属于组件自己的 API；`vk doc` 默认折叠。 */
export const LAYOUT_ATTRS = new Set(Object.keys(COMMON));
for (const [tag, def] of Object.entries(TAGS)) {
  if (INLINE.has(tag) || CUSTOM.has(tag)) continue;
  def.attrs = def.attrs || {};
  Object.assign(def.attrs, COMMON);
}
/* 竖线要长度：vk-rule 保留 COMMON 的 h；横线的 h 组件自己忽略（线不是面）。 */

const EXTRA = {
  'vk-box': {
    surface: oneOf(
      'none',
      'paper',
      'soft',
      'sf-1',
      'sf-2',
      'sf-3',
      'sf-4',
      'wash',
      'tint',
      'dark',
      'accent'
    ),
  },
  'vk-text': {
    ink: oneOf('primary', 'secondary', 'tertiary', 'muted'),
    // 语义色：全库同一套六值（以前这里少 neutral）。
    tone: tone(),
  },
  'vk-panel': {
    // 五档底：纸 / 极淡 / 稍深 / 深色 / 实色强调。tone 只给 accent（和 wash/tint）上色。
    surface: oneOf('paper', 'wash', 'tint', 'dark', 'accent'),
  },
  'vk-icon': {
    ink: oneOf('primary', 'secondary', 'tertiary', 'muted'),
    size: oneOf('sm', 'md', 'lg', 'xl', 'inherit'),
  },
  'vk-list': { variant: oneOf('bullet', 'check', 'define', 'ordered') },
  'vk-diff': {
    variant: oneOf('unified', 'split'),
    fit: oneOf('width'),
  },
  'vk-rule': { variant: oneOf('thin', 'strong'), tone: tone(), dash: bool() },
  'vk-code': {
    long: oneOf('clip', 'wrap'),
    mass: massLevel(),
    fit: oneOf('width'),
  },
  'vk-term': {
    mass: massLevel(),
    fit: oneOf('width'),
  },
  'vk-table': {
    fit: oneOf('width'),
  },
  'vk-asm': {
    fit: oneOf('width'),
  },
  'vk-steps': {
    mass: massLevel(),
    // 横 / 竖：与 vk-pair 同一个名字（旧名 orientation）。
    direction: oneOf('horizontal', 'vertical'),
    // 流程的箭头由组件画：作者只写步骤名，不再一根根手连。
    connector: oneOf('arrow', 'line', 'none'),
  },
  'vk-cells': {
    stride: oneOf('1', '2', '4', '8'),
    cols: int({ min: 1, max: 8, step: 1 }),
    direction: oneOf('ltr', 'rtl'),
  },
  'vk-bytes': {
    word: oneOf('1', '2', '4', '8'),
    endian: oneOf('little', 'big'),
  },
  'vk-img': {
    position: text(),
    border: oneOf('none', 'hair', 'strong'),
  },
  'vk-tree': {
    collapsed: text(),
    fit: oneOf('width'),
  },
  'vk-edge': {
    // 连线的途经点：像素坐标 "x,y" 或选择器（旧 vk-edge 的写法）。
    via: text(),
  },
  'vk-page': {},
  'vk-grid': {
    justify: oneOf('start', 'center', 'end', 'stretch'),
  },
  'vk-canvas': {
    overflow: oneOf('visible', 'clip'),
  },
};
/* 关系覆盖层也要能被编排：at / enter 同样作用于 ring / spotlight / pin / edge。 */
const MOTION_ATTRS = {
  at: { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
  dur: { ...num({ min: 0, max: 60, step: 0.01 }), motion: true },
  enter: { ...oneOf('fade', 'wipe', 'none'), default: 'none', motion: true },
  ease: { ...oneOf('linear', 'out-cubic', 'out-quint', 'out-expo', 'in-cubic', 'in-out-sine'), motion: true },
};
/* 关系类各自只有一个动作：线是 trace、批注是 badge、对照是 compare。
   它们是组件，不是元素上的形容词——所以 act 的词表在这里只开一个值。 */
for (const [tag, value] of [['vk-edge', 'trace'], ['vk-pin', 'badge'], ['vk-diff', 'compare']]) {
  if (TAGS[tag]) TAGS[tag].attrs = { ...(TAGS[tag].attrs || {}), act: { ...oneOf(value), default: value, pose: true } };
}
for (const tag of ['vk-ring', 'vk-pin', 'vk-edge', 'vk-annotate']) {
  if (TAGS[tag]) TAGS[tag].attrs = { ...(TAGS[tag].attrs || {}), ...MOTION_ATTRS };
}
for (const [tag, attrs] of Object.entries(EXTRA)) {
  const def = TAGS[tag];
  if (!def) continue;
  def.attrs = def.attrs || {};
  Object.assign(def.attrs, attrs);
}


/**
 * 公开标签：别名不再单列。
 *
 * 旧名（aliasOf 指向新标签）仍留在 TAGS 里：构建期继续校验它们的属性、
 * 运行期继续注册同名自定义元素——只是 `vk tags` / 类型 / 属性参考 / 标本索引
 * 不再把它们当成"又一个标签"。这就是"减法"：数量减，旧页不减。
 */
export const ALL_TAG_NAMES = Object.keys(TAGS);
export const TAG_NAMES = ALL_TAG_NAMES.filter((t) => !TAGS[t].aliasOf);

/** 旧名 → 新标签的转发表：构建期提示、运行期注册、标本页的别名说明都读这一份。 */
export const ALIASES = Object.fromEntries(
  ALL_TAG_NAMES.filter((t) => TAGS[t].aliasOf).map((tag) => [
    tag,
    { to: TAGS[tag].aliasOf, note: TAGS[tag].aliasNote || '', name: TAGS[tag].name },
  ])
);

/**
 * 结构化子节点 <li> 的合法属性：父标签 → 允许的名字。
 * 它们不是宿主属性，但仍然要被构建期校验；拼错会静默不生效。
 */
export const CHILD_ATTRS = {
  // vk-timeline 的 value 是主值（大数字，压过 label），note 是说明（label 级，压过正文）；
  // 它们和 date / label 共存，旧条目一个字不用改。
  'vk-timeline': ['date', 'label', 'value', 'note', 'lane', 'at', 'span', 'tone', 'state'],
  'vk-bits': ['label', 'value', 'from', 'to', 'state'],
  // act 和宿主一样是姿态词：state="current" 退役后，焦点格写在 <li act="focus">。
  'vk-cells': ['value', 'label', 'span', 'state', 'filled', 'act'],
  'vk-bars': ['label', 'value', 'state'],
  'vk-list': ['state'],
  'vk-steps': [],
  // 流程的每一步是「标签 + 内容」：label 是块上方那行小字，tone 只染这一块。
  'vk-flow': ['label', 'tone'],
  'vk-table': [],
  // 图例的每一条说明就是一项，不带任何属性；编号从 1 起按顺序生成。
  'vk-note': [],
};

/**
 * 子节点契约：每个组件允许的子节点形态。
 * - item：条目写成 <li>
 * - wrapper：必须包一层（table）
 * - source：内容来自 src / <script data-vk-source>，不写元素子节点
 * - text：裸文本 / 嵌套结构由组件自己解析
 * 由 src/highlight.mjs 在构建期校验。
 */
export const CHILDREN = {
  'vk-list': { kind: 'item', item: 'li' },
  'vk-steps': { kind: 'item', item: 'li' },
  // 一步一个 <li>：顺序就是流程顺序，内容写在 <li> 里。
  'vk-flow': { kind: 'item', item: 'li' },
  'vk-cells': { kind: 'item', item: 'li' },
  'vk-bars': { kind: 'item', item: 'li' },
  'vk-bits': { kind: 'item', item: 'li' },
  'vk-timeline': { kind: 'item', item: 'li' },
  // vk-note 两种形态的子节点不同（边注是裸文本、图例是 <li>），不登记单一模型；
  // 图例的条目数与目标数由构建期单独校验（src/highlight.mjs）。
  'vk-table': { kind: 'wrapper', wrapper: 'table' },
  'vk-code': { kind: 'source' },
  'vk-diff': { kind: 'source' },
  'vk-term': { kind: 'source' },
  'vk-math': { kind: 'source' },
  'vk-bytes': { kind: 'source' },
  'vk-asm': { kind: 'source' },
  'vk-tree': { kind: 'source', inline: 'text/JSON', item: 'li' },
};

/** 作者手写条目的 state 词汇；生成行（code/asm/bytes/tree）仍用 current 选择器。 */
export const STATES = {
  'vk-cells': { where: ['item'], values: ['current', 'mark', 'ok', 'warn', 'err'] },
  'vk-bars': { where: ['item'], values: ['current', 'mark', 'ok', 'warn', 'err'] },
  'vk-bits': { where: ['item'], values: ['current', 'mark', 'ok', 'warn', 'err'] },
  'vk-timeline': { where: ['item'], values: ['current', 'mark', 'ok', 'warn', 'err'] },
  'vk-list': { where: ['item'], values: ['ok', 'warn', 'err'] },
  'vk-table': { where: ['row', 'cell'], values: ['current', 'mark', 'ok', 'warn', 'err'] },
};
export const STATE_VALUES = ['current', 'mark', 'ok', 'warn', 'err'];

/** 同名属性在不同标签上含义不同时，在这里覆盖。 */
const ATTR_META_BY_TAG = {
  'vk-bytes': {
    current: { label: '当前字节段', group: 'state' },
  },
  'vk-cells': {
    filled: { label: '填充格（布尔：写 filled 即填充）', group: 'state' },
    },
  'vk-compare': {
    mode: { label: '对照方式（split 叠图裁切 / side 并排 / stack 上下；后两者完整显示）', group: 'appearance' },
    split: { label: 'split 模式左侧 a 的占比（%，side/stack 下无效）', group: 'appearance' },
    labels: { label: '两张图（labels="a,b"）与角标（labels="a,b|左|右"）', content: true },
    'label-position': { label: '角标位置（inside 叠在图上 / top 在图上另起一条带，不压图像）', group: 'appearance' },
    mark: { label: '差异框（x1,y1,x2,y2；多组用 ;，相对百分比）', content: true },
    'mark-label': { label: '差异框角标（多组用 ; 与 mark 一一对应）', content: true },
  },
  'vk-annotate': {
    mode: { label: '形态（arrow 连线 / circle 圈选 / note 批注 / badge 编号点）', group: 'appearance' },
    shape: { label: '连线形状（straight 直线 / ortho 折线 / curve 曲线）', group: 'appearance' },
    dash: { label: '虚实（solid 实线 / dashed 虚线）', group: 'appearance' },
    head: { label: '端点（arrow 箭头 / dot 圆点 / none 无）', group: 'appearance' },
    ring: { label: '圈形（ellipse 椭圆 / rect 矩形）', group: 'appearance' },
    double: { label: '内外两圈', group: 'appearance' },
    note: { label: '批注形态（bubble 泡 / label 引线标签 / badge 编号点）', group: 'appearance' },
    label: { label: '连线标签', content: true },
    n: { label: '编号（badge 形态）', content: true },
  },
  'vk-pin': {
    w: { label: '气泡宽（像素，可写 200 或 200px）', group: 'layout' },
  },
  'vk-text': {
    icon: { label: '图标（Lucide 名；语义白名单外构建期报错）', group: 'appearance' },
  },
  'vk-box': {
    ring: { label: '描边环（强调，不占布局；环色跟 tone）', group: 'appearance' },
  },
  'vk-label': {
    for: { label: '目标（写 #id 就贴到那块上方/下方）', content: true },
    side: { label: '贴哪一侧（top 上方 / bottom 下方；旧名 anchor 的 above / below）', group: 'appearance' },
  },
  'vk-panel': {
    chrome: { label: '窗头（dots 三点 + 标题 / none 干净分区）', group: 'appearance' },
  },
  'vk-stack': {
    weights: { label: '高度权重（如 "1 2 1"：按顺序分给前 N 个直接子项；其余保持内容高）', group: 'layout' },
    ratio: { label: '高度权重（weights 的别名）', group: 'layout' },
  },
  'vk-note': {
    variant: { label: '形态（margin 边注 / bubble 气泡 / legend 编号图例）', group: 'appearance' },
    for: { label: '目标（多个用 ; 分隔，图例按顺序一一对应）', content: true },
    side: { label: '贴哪侧（margin 只认 left / right；bubble 四向 + auto）', group: 'layout' },
    leader: { label: '引线（line 细线 / dot 细线 + 圆点；bubble：elbow / straight / none）', group: 'appearance' },
    side: { label: '贴哪侧（margin 只认 left / right；bubble 四向 + auto；legend 用 bottom-right / bottom-left / bottom）', group: 'layout' },
    w: { label: '注解宽（margin 是像素上限；bubble 可写 200 或 200px）', group: 'layout' },
    tone: { label: '气泡色调（bubble）', group: 'appearance' },
    strength: { label: '气泡强度（bubble：solid / soft / ghost；旧名 emphasis）', group: 'appearance' },
    size: { label: '气泡字号档（bubble）', group: 'appearance' },
    n: { label: '气泡编号（bubble）', content: true },
    gap: { label: '气泡与目标的间距（bubble；像素）', group: 'layout' },
    x: { label: '气泡落点 X（bubble，覆盖层坐标）', group: 'layout' },
    y: { label: '气泡落点 Y（bubble，覆盖层坐标）', group: 'layout' },
  },
  'vk-timeline': {
    value: { label: '主值（value 条目：大数字，压过 label）', content: true },
    note: { label: '说明（value 条目：主值下的小字，压过正文）', content: true },
  },
  'vk-bits': {
    'bit-width': { label: '位宽', group: 'layout' },
    fields: { label: '字段区间', content: true },
    bytes: { label: '字节界', group: 'appearance' },
    index: { label: '位序号', group: 'appearance' },
  },
  'vk-figure': {
    crop: { label: '裁切框', group: 'appearance' },
    'crop-label': { label: '裁切标签', group: 'appearance' },
  },
};

// 把元数据与默认值合进每个属性描述：types / reference / 组件页都读同一份。
for (const [tag, def] of Object.entries(TAGS)) {
  for (const [name, spec] of Object.entries(def.attrs || {})) {
    const meta = ATTR_META_BY_TAG[tag]?.[name] || ATTR_META[name];
    if (meta) Object.assign(spec, meta);
    const d = DEFAULTS[tag]?.[name];
    if (d !== undefined) spec.default = d;
  }
}

export const isContent = (tag, name) => !!TAGS[tag]?.attrs?.[name]?.content;
export const isHidden = (tag, name) => !!TAGS[tag]?.attrs?.[name]?.hidden;

export const byLayer = (layer) => TAG_NAMES.filter((t) => TAGS[t].layer === layer);
/**
 * 观察列表 = 声明面 + 旧的别名。
 *
 * 别名也要被观察：运行期第一次读属性时会把旧名折成新名，但作者在页面加载后
 * 动态改旧名（setAttribute('pad-px', '40')）也得生效——不观察就静默失效。
 */
export const observedOf = (tag) => [...Object.keys(TAGS[tag].attrs || {}), ...DEPRECATED_ATTRS];

export function validate() {
  const errors = [];
  const layers = new Set(LAYERS.map((l) => l.id));
  for (const [tag, def] of Object.entries(TAGS)) {
    if (!/^vk-[a-z0-9-]+$/.test(tag)) errors.push(`${tag}: 标签名必须是 vk-小写`);
    if (!layers.has(def.layer)) errors.push(`${tag}: 未知层 ${def.layer}`);
    if (!def.summary) errors.push(`${tag}: 缺少一句话说明`);
    if (def.aliasOf) {
      // 别名只能指向一个公开标签：别名链条会让"合并到了谁"说不清。
      if (!TAGS[def.aliasOf]) errors.push(`${tag}: aliasOf 指向不存在的 ${def.aliasOf}`);
      else if (TAGS[def.aliasOf].aliasOf) errors.push(`${tag}: aliasOf 不能指向另一个别名 ${def.aliasOf}`);
      if (!def.aliasNote) errors.push(`${tag}: 别名缺少迁移说明（aliasNote）`);
    }
    // 15.0 概念收敛的结构性保证：四个概念各一套词表，公开标签不许再写自己的子集。
    // （别名标签保留旧词表：它们不再是公开 API，转发到的新标签才是。）
    if (!def.aliasOf) {
      for (const [name, spec] of Object.entries(def.attrs || {})) {
        if (name === 'tone' && (spec.type !== 'tone' || spec.values.join('/') !== TONES.join('/'))) {
          errors.push(`${tag}.tone: 必须用共享的六值词表（vocab.TONES）`);
        }
        if (name === 'fill') {
          if (!FILL_TAGS.has(tag)) errors.push(`${tag}.fill: 只有 vk-img / vk-panel / vk-layer 声明 fill`);
          else if (spec.type !== 'fill' || spec.values.join('/') !== FILLS.join('/')) {
            errors.push(`${tag}.fill: 必须用共享的三值词表（vocab.FILLS）`);
          }
        }
        if (name === 'size' && spec.values && spec.values.join('/') !== SIZE_TIERS.join('/')) {
          errors.push(`${tag}.size: size 只表字号，必须用共享的十档（vocab.SIZE_TIERS）`);
        }
      }
    }
    for (const [name, spec] of Object.entries(def.attrs || {})) {
      if (!spec.type && !spec.values) errors.push(`${tag}.${name}: 属性缺少 type 或 values`);
      if (spec.values && !spec.values.length) errors.push(`${tag}.${name}: 枚举为空`);
      if (spec.default !== undefined && spec.values && !spec.values.includes(spec.default)) {
        errors.push(`${tag}.${name}: 默认值 ${spec.default} 不在枚举里`);
      }
    }
  }
  for (const [tag, spec] of Object.entries(CHILDREN)) {
    if (!TAGS[tag]) errors.push(`CHILDREN.${tag}: 标签不存在`);
    if (!['item', 'wrapper', 'source', 'text'].includes(spec.kind)) errors.push(`CHILDREN.${tag}: 未知 kind ${spec.kind}`);
  }
  for (const [tag, spec] of Object.entries(STATES)) {
    if (!TAGS[tag]) errors.push(`STATES.${tag}: 标签不存在`);
    for (const v of spec.values) if (!STATE_VALUES.includes(v)) errors.push(`STATES.${tag}: 未知 state ${v}`);
    for (const w of spec.where) if (!['item', 'row', 'cell'].includes(w)) errors.push(`STATES.${tag}: 未知位置 ${w}`);
  }
  return errors;
}















