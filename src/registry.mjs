/**
 * vk 注册表 —— 标签 / 层 / 属性 / 一句话说明。
 * 由这里生成 types 与 reference.md；运行时也读 attrs 决定 observed 属性。
 */

const text = () => ({ type: 'text' });
const num = (o = {}) => ({ type: 'num', ...o });
const size = (o = {}) => ({ type: 'size', ...o });
const int = (o = {}) => ({ type: 'int', ...o });
const bool = () => ({ type: 'bool' });
const lines = () => ({ type: 'lines' });
const sel = () => ({ type: 'selector' });
const oneOf = (...values) => ({ values });

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
  labels: { label: '标签', content: true },
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
  icon: { label: '图标', content: true },
  kind: { label: '形态', group: 'appearance' },
  place: { label: '位置', group: 'layout' },
  connector: { label: '连接线', group: 'appearance' },
  surface: { label: '表面', group: 'appearance' },
  variant: { label: '形态', group: 'appearance' },
  mass: { label: '体量', group: 'appearance' },
  size: { label: '尺寸', group: 'appearance' },
  level: { label: '标题级别', group: 'appearance' },
  weight: { label: '字重', group: 'appearance' },
  mono: { label: '等宽', group: 'appearance' },
  radius: { label: '圆角', group: 'appearance' },
  border: { label: '描边', group: 'appearance' },
  fit: { label: '填充', group: 'appearance' },
  chrome: { label: '窗头', group: 'appearance' },
  stripe: { label: '斑马', group: 'appearance' },
  bare: { label: '无外壳', group: 'appearance' },
  display: { label: '独立成行', group: 'appearance' },
  rule: { label: '条目分隔线', group: 'appearance' },
  dash: { label: '虚线', group: 'appearance' },
  arrow: { label: '箭头', group: 'appearance' },
  cap: { label: '端点', group: 'appearance' },
  current: { label: '当前', group: 'state' },
  focus: { label: '聚光行', group: 'state' },
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
  bend: { label: '拐点', group: 'layout' },
  r: { label: '半径', group: 'layout' },
  as: { label: '标题级别', group: 'appearance' },
  depth: { label: '最大深度', group: 'layout' },
  limit: { label: '最多显示', group: 'layout' },
  measure: { label: '测量宽', group: 'layout' },
  scale: { label: '刻度', group: 'appearance' },
  emphasis: { label: '强度', group: 'appearance' },
  ink: { label: '墨阶', group: 'appearance' },
  long: { label: '长行', group: 'appearance' },
  filled: { label: '填充格（布尔：写 filled 即填充）', group: 'state' },
  ruler: { label: '字节尺', group: 'appearance' },
  overflow: { label: '溢出', group: 'appearance' },
  fill: { label: '填满', group: 'layout' },
  orientation: { label: '方向', group: 'layout' },
  stride: { label: '步长', group: 'layout' },
  position: { label: '焦点', group: 'appearance' },
  collapsed: { label: '收起目录', content: true },
  hidden: { label: '显示隐藏文件', group: 'appearance' },
  numbers: { label: '行号', group: 'appearance' },
  summary: { label: '摘要', group: 'appearance' },
  'label-size': { label: '标签字号', group: 'appearance' },
  'label-position': { label: '角标位置', group: 'appearance' },
  'value-size': { label: '主值字号', group: 'appearance' },
  'label-dx': { label: '标签 X', group: 'layout' },
  'label-dy': { label: '标签 Y', group: 'layout' },
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

/** 组件默认值：属性参考与组件页的“默认”列都读它。 */
const DEFAULTS = {
  'vk-box': { surface: 'none', radius: 'lg', border: 'none' },
  // plain 默认无框无底：要框必须显式写 border。
  'vk-panel': { tone: 'neutral', variant: 'plain', pad: 'md', radius: 'lg', border: 'none' },
  'vk-text': { size: 'body', weight: 'regular', align: 'left', ink: 'primary' },
  'vk-label': { variant: 'kicker', ink: 'muted' },
  'vk-inline': { variant: 'code' },
  'vk-icon': { name: 'info', size: 'md', ink: 'primary' },
  'vk-img': { fit: 'cover', position: '50% 50%', radius: 'lg', border: 'none' },
  'vk-rule': { variant: 'thin', orientation: 'horizontal' },
  'vk-stack': { gap: 'sm', align: 'stretch', justify: 'start', direction: 'column' },
  'vk-grid': { cols: '2', gap: 'sm', align: 'stretch', 'gap-x': 'sm', 'gap-y': 'sm' },
  'vk-canvas': { 'pad-px': '0', grid: '0', overflow: 'visible' },
  'vk-edge': { 'from-side': 'auto', 'to-side': 'auto', variant: 'ortho', tone: 'neutral', emphasis: 'solid', arrow: 'end', cap: 'none', 'label-size': 'label', z: 20 },
  'vk-list': { variant: 'bullet', gap: 'sm', mass: 'normal' },
  'vk-code': { chrome: 'min', mass: 'normal', numbers: 'all', reveal: 'all' },
  'vk-asm': { bytes: '', address: 'all', mass: 'normal', long: 'fail', chrome: 'min', reveal: 'all' },
  'vk-timeline': { variant: 'events', mass: 'normal', 'value-size': 'hero' },
  'vk-pin': { variant: 'bubble', side: 'auto', leader: 'elbow', tone: 'info', size: 'body', emphasis: 'soft', z: 60 },
  'vk-ring': { variant: 'rect', tone: 'focus', 'pad-px': 8, stroke: 4, dim: 0.45, z: 40 },
  'vk-annotate': {
    mode: 'arrow',
    shape: 'ortho',
    dash: 'solid',
    head: 'arrow',
    note: 'bubble',
    ring: 'ellipse',
    tone: 'neutral',
    size: 'body',
    emphasis: 'soft',
    side: 'auto',
  },
  // 注解原语：默认是"像书页边注"的那一种，不是气泡。
  'vk-note': { kind: 'margin', side: 'auto', leader: 'line', place: 'br' },
  'vk-term': { prompt: '$', chrome: 'min', mass: 'normal', lang: 'sh', reveal: 'all', 'title-show': 'false' },
  'vk-diff': { variant: 'unified', chrome: 'min', numbers: 'all', summary: 'all', mass: 'normal' },
  'vk-table': { variant: 'ledger', mass: 'normal' },
  'vk-math': { size: 'body' },
  'vk-compare': { mode: 'split', ratio: '16 / 9', split: 50, fit: 'cover', position: '50% 50%', 'label-position': 'inside' },
  'vk-tree': { depth: '4', summary: 'all', chrome: 'min', mass: 'normal' },
  'vk-window': { chrome: 'min', pad: 'lg', mass: 'normal' },
  'vk-bits': { index: '7-0', group: '4', tone: 'neutral', mass: 'normal' },
  'vk-bars': { mass: 'normal', tone: 'neutral', scale: 'linear', format: 'thousands' },
  'vk-bytes': { cols: '8', group: '1', ascii: 'all', address: 'all', mass: 'normal', word: '1', endian: 'little', chrome: 'min' },
  'vk-cells': { cols: '0', mass: 'normal' },
  'vk-steps': { current: '0', mass: 'normal', orientation: 'horizontal', connector: 'arrow', done: 'auto' },
  'vk-page': { align: 'top' },
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
      'tone': oneOf('ok', 'warn', 'err'),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'pad-y': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'pad-x': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
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
      '一块内容分区：底色、可选标题带、内距、圆角。它只描述这一块，不认识兄弟、不排别人；排布归 vk-stack / vk-grid。',
    attrs: {
      // 语义色只用来染「面」：plain / raised 上落 wash，inset 上落 tint，dark 上落深色 wash。
      'tone': oneOf('neutral', 'info', 'focus', 'ok', 'err', 'warn'),
      // 四档表面：白纸 / 抬起 / 凹下 / 深色。三档浅色靠明度分开，不是四种主题。
      'variant': oneOf('plain', 'raised', 'inset', 'dark'),
      // 有标题才有标题带；标题带里放 vk-label（kicker）。
      'title': text(),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
    },
  },
  'vk-text': {
    name: '文字',
    layer: 'elements',
    summary: '一段文字：字阶、字重、墨阶、等宽、对齐、测量宽。',
    content: {
      kind: 'text',
      target: 'vk-text',
      fields: [{ name: 'text', label: '文字', type: 'textarea', text: true }],
    },
    attrs: {
      // 四档主对比 + 旧名（别名到新档）；hero / mega 是补充档。
      'size': oneOf('display', 'headline', 'body', 'caption', 'label', 'data', 'subhead', 'title', 'hero', 'mega'),
      'weight': oneOf('regular', 'medium', 'bold'),
      'mono': bool(),
      'align': oneOf('left', 'center', 'right'),
      // 行宽：none 不限；8–60 是一行几个字（1em ≈ 一个汉字），不写就按字号档的默认行宽。
      'measure': { ...text(), layout: true },
      // 断行：balance 让标题两行等长，pretty 避免孤行，nowrap 不折。
      'wrap': { ...oneOf('balance', 'pretty', 'nowrap'), layout: true },
      // 数值写法（原 vk-stat 的唯一机制）：52980 → 52,980。排版归配方。
      'format': oneOf('none', 'thousands', 'bytes', 'hex'),
    },
  },
  'vk-label': {
    name: '标签',
    layer: 'elements',
    summary: '一行小字：分类、进度、状态。四种墨阶 + 五种语义色，三种形态（kicker / chip / badge），可带一个图标。',
    content: {
      kind: 'text',
      target: 'vk-label',
      fields: [{ name: 'text', label: '文字', type: 'textarea', text: true }],
    },
    attrs: {
      'variant': oneOf('kicker', 'chip', 'badge'),
      'tone': oneOf('info', 'focus', 'ok', 'err', 'warn'),
      'ink': oneOf('primary', 'secondary', 'tertiary', 'muted'),
      // 工序进度：index/total 是在整条流程里的位置，不是页号；section 是工序名。
      // 写 index/total 时 kicker 渲染成「工序 3/5 · 汇编」，左侧带 4px 焦点色条。
      'index': { ...int({ min: 1, max: 99, step: 1 }), content: true },
      // total 单独写不改变画面（没有 index 就没有分子）；契约探针先放一个 index。
      'total': { ...int({ min: 1, max: 99, step: 1 }), content: true, when: { index: ['3'] } },
      'section': { ...text(), content: true },
      // 内联图标：只收 Lucide 名字，构建期校验；不写就没有图标槽。
      'icon': text(),
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
    summary:
      '一个符号：语义图标可用 check / circle-check / triangle-alert / info / x / circle-x / arrow-up / arrow-down / arrow-right。白名单外的名字构建期只提醒、不拦构建（装饰图标不是错误）；运行期要提醒就在 --style preset 里看。四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。',
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
      'fit': oneOf('cover', 'contain'),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
      'w': { ...size({ min: 48, max: 1920, step: 1 }), context: 'canvas-child', layout: true },
      'h': { ...size({ min: 48, max: 1080, step: 1 }), context: 'canvas-child', layout: true },
      'span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
      'row-span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
    },
  },
  'vk-rule': {
    name: '分隔线',
    layer: 'elements',
    summary: '一根线。线宽三档；纯装饰或语义分隔。',
    attrs: {
      'orientation': oneOf('horizontal', 'vertical'),
    },
  },
  'vk-window': {
    name: '窗',
    layer: 'elements',
    summary: '一个窗：三点窗头、标题、地址栏或对话框；内容由作者放。',
    attrs: {
      'mass': oneOf('compact', 'normal', 'hero'),
      'title': text(),
      'url': text(),
      'chrome': oneOf('min', 'none', 'plain', 'browser'),
      'tone': oneOf('info', 'focus', 'ok', 'warn', 'err'),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
    },
  },

  'vk-stack': {
    name: '竖排',
    layer: 'layout',
    summary: '纵向节奏。只给间距和对齐，不画任何东西。',
    attrs: {
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'group', 'section', 'plate'),
      // direction: 竖排（默认）或横排。14.0 把 vk-row 并了进来——
      // 它们本来就是同一个空类，差别只有一条 flex-direction。
      'direction': oneOf('column', 'row'),
      'align': oneOf('start', 'center', 'end', 'stretch', 'baseline'),
      'justify': oneOf('start', 'center', 'end', 'between'),
      'wrap': { ...bool(), context: 'direction-row' },
      'grow': { ...bool(), hidden: true },
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
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'group', 'section', 'plate'),
      'gap-x': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'gap-y': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'align': oneOf('start', 'center', 'end', 'stretch'),
    },
  },
  'vk-canvas': {
    name: '坐标画布',
    layer: 'layout',
    summary: '坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。',
    attrs: {
      'w': num({ min: 48, max: 1920, step: 1 }),
      'h': num({ min: 48, max: 1080, step: 1 }),
      'pad-px': num({ min: 0, max: 200, step: 1 }),
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
      'tone': oneOf('neutral', 'info', 'focus'),
      'emphasis': oneOf('solid', 'ghost'),
      'arrow': oneOf('end', 'start', 'both', 'none'),
      'arrow-style': oneOf('solid', 'open', 'thin'),
      'arrow-size': num({ min: 8, max: 48, step: 1 }),
      'dash': bool(),
      'gap-px': num({ min: 0, max: 200, step: 1, when: { variant: ['ortho'] } }),
      'bend': num({ min: -200, max: 200, step: 1, when: { variant: ['ortho'] } }),
      'cap': oneOf('none', 'dot'),
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
      'current': lines(),
      // 与 current 同义：讲解时指一行。current 优先；两个是同一个概念，只留一版别名。
      'line': { ...lines(), hidden: true },
      'focus': lines(),
      'fold': lines(),
      'omit': text(),
      'fold-note': text(),
      'chrome': oneOf('min', 'none'),
      'mark': text(),
      'mass': oneOf('compact', 'normal', 'hero'),
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
      // 指一行：与 vk-code / vk-asm 同一个名字。line 是同义别名。
      'current': lines(),
      'line': { ...lines(), hidden: true },
      'reveal': { ...oneOf('all', 'line', 'none'), default: 'all' },
      'chrome': oneOf('none', 'min'),
      // 无壳终端（chrome="none"）默认不显示标题：标题只留给 panel 的标题带，
      // 这里只把 title 留作无障碍名。确实要在无壳终端上再显示一次，才写 title-show。
      'title-show': bool(),
      'mass': oneOf('compact', 'normal', 'hero'),
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
      'mass': oneOf('compact', 'normal', 'hero'),
      'lang': { ...text(), build: true },  // diff 的词级高亮在构建期编译，运行期改 lang 不重新着色
      'src': { ...text(), build: true },
      'lines': text(),
      'file': text(),
      'chrome': oneOf('min', 'none'),
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
      'mass': oneOf('compact', 'normal', 'hero'),
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
      'size': oneOf('label', 'body', 'subhead'),
    },
  },
  'vk-compare': {
    name: '对照',
    layer: 'components',
    summary:
      '前后对照：mode="split"（默认）时左边 split% 显示 a、右边显示 b，上面那张按 split 裁掉右侧；mode="side" 左右并排、mode="stack" 上下排列，两张图各自完整、都不裁切。角标默认叠在图上（label-position="inside"）；label-position="top" 会为角标单独让出一条带，不压图像。mark 在图上标出差异（x1,y1,x2,y2 百分比；多组用 ;），mark-label 给角标；split 下每处只标在框心所属的那一半，side/stack 下只标在 a 图（b 是参照物）。zoom="mark" 在下方生成一块差异放大（默认 ×2），也可以写 x1,y1,x2,y2 或只写倍数。',
    attrs: {
      'a': text(),
      'b': text(),
      'alt': text(),
      'mode': oneOf('split', 'side', 'stack'),
      'ratio': text(),
      'split': num({ min: 0, max: 100, step: 1 }),
      'fit': oneOf('cover', 'contain'),
      'position': text(),
      'label-a': text(),
      'label-b': text(),
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
      'mass': oneOf('compact', 'normal', 'hero'),
      'src': { ...text(), build: true },
      'title': text(),
      'current': text(),
      'collapsed': text(),
      'limit': int({ min: 1, max: 500, step: 1 }),
      'summary': oneOf('all', 'none'),
      'depth': int({ min: 0, max: 8, step: 1 }),
        'chrome': oneOf('min', 'none'),
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
      'offsets': bool(),
      'direction': oneOf('ltr', 'rtl'),
      'ruler': bool(),
      'mass': oneOf('compact', 'normal', 'hero'),
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
      'ascii': oneOf('all', 'none'),
      'address': oneOf('all', 'none'),
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
      'mass': oneOf('compact', 'normal', 'hero'),
      'value': text(),
      'index': oneOf('7-0', '0-7', 'none'),
      'group': oneOf('1', '4', '8'),
      'sign': bool(),
      'label': text(),
      'tone': oneOf('neutral', 'info'),
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
      'mass': oneOf('compact', 'normal', 'hero'),
      'tone': oneOf('neutral', 'info'),
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
      'current': lines(),
      // 与 current 同义：讲解时指一行。current 优先。
      'line': { ...lines(), hidden: true },
      'reveal': { ...oneOf('all', 'line', 'none'), default: 'all' },
      'focus': lines(),
      'addr': { ...text(), build: true },
      'title': text(),
      'bytes': bool(),
      'address': oneOf('all', 'none'),
      'mass': oneOf('compact', 'normal', 'hero'),
      'long': oneOf('fail', 'wrap', 'clip'),
      'chrome': oneOf('min', 'none'),
      'order': text(),
      'fence-after': text(),
      'fence-label': text(),
      'labels': oneOf('all', 'none'),
      'address-label': text(),
      'bytes-label': text(),
      'mnemonic-label': text(),
      'operands-label': text(),
    },
  },
  'vk-timeline': {
    name: '时间线',
    layer: 'components',
    summary: '时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <li>，li 可写 value（大数字主值）与 note（小说明）；value 的字号用 value-size 统一降档（hero 280 / title 200 / subhead 112，默认 hero）。',
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
      'mass': oneOf('compact', 'normal', 'hero'),
      // value 是"主值"（大数字）。一帧放三个数字时 hero 会把整页撑爆，
      // 所以给一档可选的体量：hero 280（默认，和引入前完全一致）/ title 200 / subhead 112。
      'value-size': oneOf('hero', 'title', 'subhead'),
    },
  },
  'vk-page': {
    name: '页面',
    layer: 'page',
    summary: '坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。',
    attrs: {
      'align': oneOf('top', 'center', 'bottom'),
      /* 场次：一页 = 一段时间。dur 为 0 时就是一张静帧。 */
      'dur': { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
      'beat': { ...num({ min: 0.1, max: 4, step: 0.05 }), motion: true },
      'poster': { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
    },
  },
  'vk-pin': {
    name: '批注泡',
    layer: 'relations',
    summary: '自由批注：气泡 + 引线绑到任意锚点，不改布局；放在 canvas 或 page 里。',
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
      'tone': oneOf('info', 'focus', 'ok', 'warn', 'err'),
      'variant': oneOf('bubble', 'dot'),
      'emphasis': oneOf('solid', 'soft', 'ghost'),
      'leader': oneOf('elbow', 'straight', 'none'),
      'gap-px': num({ min: 0, max: 240, step: 1 }),
      'w': size({ min: 160, max: 900, step: 1 }),
      'size': oneOf('label', 'body', 'subhead'),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },
  'vk-ring': {
    name: '圈选',
    layer: 'relations',
    summary: '圈选/框选/下划线/压暗：绑到任意锚点，只画覆盖层，不改布局。',
    attrs: {
      'for': sel(),
      'variant': oneOf('ellipse', 'rect', 'underline', 'bracket', 'dim'),
      // 只在 variant="dim"（压暗）时有意义：光一个 ring 无法判断"其余退后"的效果。
      'dim': { ...num({ min: 0, max: 1, step: 0.01 }), context: 'variant-dim' },
      'keep': { ...text(), context: 'variant-dim' },
      'pad-px': num({ min: 0, max: 80, step: 1 }),
      'tone': oneOf('info', 'focus', 'ok', 'warn', 'err'),
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
      'head': { ...oneOf('arrow', 'dot', 'none'), default: 'arrow' },
      // circle：椭圆或矩形；double 再画一圈内环。
      'ring': { ...oneOf('ellipse', 'rect'), default: 'ellipse' },
      'double': bool(),
      // note：泡 / 引线标签 / 编号点；badge 形态固定编号点。
      'note': { ...oneOf('bubble', 'label', 'badge'), default: 'bubble' },
      'n': int({ min: 1, max: 99, step: 1 }),
      'size': { ...oneOf('label', 'body', 'subhead'), default: 'body' },
      'emphasis': { ...oneOf('solid', 'soft', 'ghost'), default: 'soft' },
      'tone': { ...oneOf('neutral', 'info', 'focus', 'ok', 'warn', 'err'), default: 'neutral' },
      'label': text(),
      'gap-px': num({ min: 0, max: 240, step: 1 }),
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
      '边注与编号图例：kind="margin" 用 1px 细线引到栏间空白（与正文基线对齐，自动选有空间的一侧）；kind="legend" 在目标角上放编号点，页角给编号 + 说明。不占布局，也不占焦点名额。',
    content: {
      kind: 'text',
      target: 'vk-note',
      fields: [
        { name: 'text', label: '边注文字（margin 形态）', type: 'textarea', text: true },
        { name: 'items', label: '图例条目（legend 形态，一行一条 <li>）', type: 'lines', item: 'li' },
      ],
    },
    attrs: {
      // 两种形态：边注 / 编号图例。默认边注——它才是"高级注解"的默认长相。
      'kind': { ...oneOf('margin', 'legend'), default: 'margin' },
      // 目标：支持 #id@part:arg 与 CSS 选择器；legend 的多个目标用 ; 分隔，按顺序对应条目。
      'for': sel(),
      // 边注贴哪侧：默认 auto = 自动选有空间的一侧。
      'side': { ...oneOf('left', 'right', 'auto'), default: 'auto' },
      // 引线：line = 只有 1px 细线；dot = 细线 + 目标端一枚小圆点（没有箭头）。
      'leader': { ...oneOf('line', 'dot'), default: 'line' },
      // 图例落在页面哪一角：右下 / 左下 / 下方居中。
      'place': { ...oneOf('br', 'bl', 'bottom'), default: 'br' },
      // 边注宽（像素上限）；实际宽不会超过那一侧的空间。
      'w': size({ min: 96, max: 600, step: 1 }),
      'z': int({ min: 0, max: 99, step: 1 }),
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
  'vk-edge',
  'vk-canvas',
  'vk-img',
  'vk-pin',
  'vk-ring',
  'vk-annotate',
  'vk-note',
]);
const COMMON = {
  w: { ...size({ min: 48, max: 1920, step: 1 }), context: 'canvas-child', layout: true },
  h: { ...size({ min: 48, max: 1080, step: 1 }), context: 'canvas-child', layout: true },
  // 12 栏网格：一个子项最多占满 12 份。
  span: { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
  'row-span': { ...int({ min: 1, max: 12, step: 1 }), context: 'grid-child', layout: true },
  z: { ...int({ min: 0, max: 99, step: 1 }), context: 'canvas-child', layout: true },
  grow: { ...bool(), layout: true },
  fill: { ...bool(), layout: true },
  overflow: { ...oneOf('visible', 'clip'), default: 'visible', layout: true },
  /* L6 导演层：时刻 → 姿态。不进布局、不改尺寸，所以不参与几何审计。 */
  at: { ...num({ min: 0, max: 600, step: 0.01 }), motion: true },
  dur: { ...num({ min: 0, max: 60, step: 0.01 }), motion: true },
  enter: { ...oneOf('rise', 'fade', 'scale', 'wipe', 'none'), default: 'none', motion: true },
  ease: { ...oneOf('linear', 'out-cubic', 'out-quint', 'out-expo', 'in-cubic', 'in-out-sine'), motion: true },
  stagger: { ...num({ min: 0, max: 2, step: 0.01 }), motion: true },
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
  'vk-box': { surface: oneOf('none', 'paper', 'soft', 'sf-1', 'sf-2', 'sf-3', 'sf-4') },
  'vk-text': {
    ink: oneOf('primary', 'secondary', 'tertiary', 'muted'),
    // 语义色：与 vk-icon 同一套词表（info / focus / ok / err / warn），不写就是纯墨阶。
    tone: oneOf('info', 'focus', 'ok', 'err', 'warn'),
  },
  'vk-icon': {
    ink: oneOf('primary', 'secondary', 'tertiary', 'muted'),
    size: oneOf('sm', 'md', 'lg', 'xl', 'inherit'),
  },
  'vk-list': { variant: oneOf('bullet', 'check', 'define', 'ordered') },
  'vk-diff': {
    variant: oneOf('unified', 'split'),
    numbers: oneOf('all', 'none'),
    summary: oneOf('all', 'none'),
  },
  'vk-mark': { variant: oneOf('highlight', 'underline', 'strike', 'circle') },
  'vk-rule': { variant: oneOf('thin', 'strong'), tone: oneOf('neutral', 'info', 'focus'), dash: bool() },
  'vk-code': {
    long: oneOf('clip', 'wrap'),
    numbers: oneOf('all', 'none'),
    numbering: oneOf('slice', 'file'),
    mass: oneOf('compact', 'normal', 'hero'),
  },
  'vk-term': {
    mass: oneOf('compact', 'normal', 'hero'),
  },
  'vk-table': {},
  'vk-callout': { mass: oneOf('compact', 'normal', 'hero') },
  'vk-steps': {
    mass: oneOf('compact', 'normal', 'hero'),
    orientation: oneOf('horizontal', 'vertical'),
    // 流程的箭头由组件画：作者只写步骤名，不再一根根手连。
    connector: oneOf('arrow', 'line', 'none'),
  },
  'vk-cells': {
    stride: oneOf('1', '2', '4', '8'),
    cols: int({ min: 1, max: 8, step: 1 }),
    offsets: bool(),
    direction: oneOf('ltr', 'rtl'),
    ruler: bool(),
  },
  'vk-bytes': {
    word: oneOf('1', '2', '4', '8'),
    endian: oneOf('little', 'big'),
  },
  'vk-img': {
    position: text(),
    border: oneOf('none', 'hair', 'strong'),
  },
  'vk-figure': { position: text() },
  'vk-tree': {
    collapsed: text(),
    current: text(),
    summary: oneOf('all', 'none'),
  },
  'vk-edge': {
    'label-size': oneOf('label', 'meta'),
    'label-dx': num({ min: -400, max: 400, step: 1 }),
    'label-dy': num({ min: -200, max: 200, step: 1 }),
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


export const TAG_NAMES = Object.keys(TAGS);

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
    a: { label: 'a 图（split 左半 / side 左侧 / stack 上方）', content: true },
    b: { label: 'b 图（split 右半 / side 右侧 / stack 下方）', content: true },
    mode: { label: '对照方式（split 叠图裁切 / side 并排 / stack 上下；后两者完整显示）', group: 'appearance' },
    split: { label: 'split 模式左侧 a 的占比（%，side/stack 下无效）', group: 'appearance' },
    'label-a': { label: 'a 的角标（inside 时左下 / top 时左上）', content: true },
    'label-b': { label: 'b 的角标（inside 时右下 / top 时右上）', content: true },
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
  'vk-note': {
    kind: { label: '形态（margin 边注 / legend 编号图例）', group: 'appearance' },
    for: { label: '目标（多个用 ; 分隔，图例按顺序一一对应）', content: true },
    side: { label: '边注贴哪侧（left / right / auto 自动选有空间的一侧）', group: 'layout' },
    leader: { label: '引线（line 只有 1px 细线 / dot 细线 + 圆点）', group: 'appearance' },
    place: { label: '图例位置（br 右下 / bl 左下 / bottom 下方居中）', group: 'layout' },
    w: { label: '边注宽（像素上限；实际不会超过那一侧的空间）', group: 'layout' },
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
export const observedOf = (tag) => Object.keys(TAGS[tag].attrs || {});

export function validate() {
  const errors = [];
  const layers = new Set(LAYERS.map((l) => l.id));
  for (const [tag, def] of Object.entries(TAGS)) {
    if (!/^vk-[a-z0-9-]+$/.test(tag)) errors.push(`${tag}: 标签名必须是 vk-小写`);
    if (!layers.has(def.layer)) errors.push(`${tag}: 未知层 ${def.layer}`);
    if (!def.summary) errors.push(`${tag}: 缺少一句话说明`);
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















