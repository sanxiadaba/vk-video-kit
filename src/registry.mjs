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
  index: { label: '序号', content: true },
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
  unit: { label: '单位', content: true },
  max: { label: '最大值', group: 'appearance' },
  source: { label: '出处', content: true },
  author: { label: '作者', content: true },
  sign: { label: '符号位', group: 'appearance' },
  start: { label: '起点', content: true },
  end: { label: '终点', content: true },
  lanes: { label: '泳道', content: true },
  steps: { label: '步数', group: 'layout' },
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
  'from-side': { label: '起点边', group: 'layout' },
  'to-side': { label: '终点边', group: 'layout' },
  scale: { label: '刻度', group: 'appearance' },
  emphasis: { label: '强度', group: 'appearance' },
  ink: { label: '墨阶', group: 'appearance' },
  long: { label: '长行', group: 'appearance' },
  filled: { label: '填充格（序号，0 起）', group: 'state' },
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
  'label-dx': { label: '标签 X', group: 'layout' },
  'label-dy': { label: '标签 Y', group: 'layout' },
  header: { label: '页眉', content: true },
  footer: { label: '页脚', content: true },
};

/** 组件默认值：属性参考与组件页的“默认”列都读它。 */
const DEFAULTS = {
  'vk-box': { surface: 'none', radius: 'lg', border: 'none' },
  'vk-text': { size: 'body', weight: 'regular', align: 'left', ink: 'primary' },
  'vk-inline': { variant: 'code' },
  'vk-icon': { name: 'circle-help', size: 'md', ink: 'primary' },
  'vk-img': { fit: 'cover', position: '50% 50%', radius: 'lg', border: 'none' },
  'vk-rule': { variant: 'thin', orientation: 'horizontal' },
  'vk-mark': { variant: 'highlight', tone: 'info' },
  'vk-stack': { gap: 'sm', align: 'stretch', justify: 'start' },
  'vk-row': { gap: 'sm', align: 'stretch', justify: 'start' },
  'vk-grid': { cols: '2', gap: 'sm', align: 'stretch', 'gap-x': 'sm', 'gap-y': 'sm' },
  'vk-canvas': { 'pad-px': '0', grid: '0', overflow: 'visible' },
  'vk-edge': { 'from-side': 'auto', 'to-side': 'auto', variant: 'ortho', tone: 'neutral', emphasis: 'solid', arrow: 'end', cap: 'none', 'label-size': 'label', z: 20 },
  'vk-title': { size: 'title', align: 'left', level: '2' },
  'vk-list': { variant: 'bullet', gap: 'sm' },
  'vk-tag': { tone: 'neutral', size: 'label', emphasis: 'solid' },
  'vk-callout': { tone: 'info', size: 'body', mass: 'normal' },
  'vk-code': { chrome: 'min', mass: 'normal', numbers: 'all' },
  'vk-asm': { bytes: '', address: 'all', mass: 'normal', long: 'fail', chrome: 'min' },
  'vk-timeline': { variant: 'events', mass: 'normal' },
  'vk-pin': { variant: 'bubble', side: 'auto', leader: 'elbow', tone: 'info', size: 'body', emphasis: 'soft', z: 60 },
  'vk-ring': { variant: 'rect', tone: 'focus', 'pad-px': 8, stroke: 4, z: 40 },
  'vk-spotlight': { dim: 0.45, z: 30 },
  'vk-term': { prompt: '$', chrome: 'min', mass: 'normal' },
  'vk-diff': { variant: 'unified', chrome: 'min', numbers: 'all', summary: 'all', mass: 'normal' },
  'vk-table': { variant: 'ledger', mass: 'normal' },
  'vk-math': { size: 'body' },
  'vk-figure': { ratio: '16 / 9', fit: 'cover', position: '50% 50%', chrome: 'none', shadow: 'none', bleed: 'none' },
  'vk-tree': { depth: '4', summary: 'all', chrome: 'min', mass: 'normal' },
  'vk-window': { chrome: 'min', pad: 'lg', mass: 'normal' },
  'vk-quote': { variant: 'rule', size: 'body' },
  'vk-bits': { index: '7-0', group: '4', tone: 'neutral', mass: 'normal' },
  'vk-bars': { mass: 'normal', tone: 'neutral', scale: 'linear', format: 'thousands' },
  'vk-bytes': { cols: '8', group: '1', ascii: 'all', address: 'all', mass: 'normal', word: '1', endian: 'little', chrome: 'min' },
  'vk-cells': { cols: '0', mass: 'normal' },
  'vk-steps': { current: '0', mass: 'normal', orientation: 'horizontal' },
  'vk-panel': { variant: 'card', surface: 'paper', pad: 'lg', border: 'hair', radius: 'lg', elevation: '0' },
  'vk-stat': { size: 'hero', tone: 'none', mark: 'none', format: 'none', align: 'left' },
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
      'size': oneOf('label', 'data', 'body', 'subhead', 'title', 'hero', 'mega'),
      'weight': oneOf('regular', 'medium', 'bold'),
      'mono': bool(),
      'align': oneOf('left', 'center', 'right'),
      'measure': { ...oneOf('label', 'body', 'subhead', 'title', 'none'), layout: true },
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
      'variant': oneOf('code', 'math', 'sup', 'sub', 'link'),
      'href': text(),
    },
  },
  'vk-icon': {
    name: '图标',
    layer: 'elements',
    summary: '一个符号。全量 Lucide 名字；四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。',
    content: {
      kind: 'text',
      target: 'vk-icon',
      fields: [{ name: 'name', label: '图标名', type: 'text', attr: 'name' }],
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
      'span': { ...int({ min: 1, max: 6, step: 1 }), context: 'grid-child', layout: true },
      'row-span': { ...int({ min: 1, max: 6, step: 1 }), context: 'grid-child', layout: true },
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
  'vk-mark': {
    name: '标记',
    layer: 'elements',
    summary: '行内标注：高亮、下划线、删除线、圈。只包文字，不改布局。',
    content: {
      kind: 'text',
      target: 'vk-mark',
      fields: [{ name: 'text', label: '标记文字', type: 'textarea', text: true }],
    },
    attrs: {
      'tone': oneOf('info', 'ok', 'err', 'warn'),
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
      'align': oneOf('start', 'center', 'end', 'stretch'),
      'justify': oneOf('start', 'center', 'end', 'between'),
      'grow': { ...bool(), hidden: true },
    },
  },
  'vk-row': {
    name: '横排',
    layer: 'layout',
    summary: '横向排列。可换行、可两端推开。',
    attrs: {
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'group', 'section', 'plate'),
      'align': oneOf('top', 'center', 'bottom', 'stretch', 'baseline'),
      'justify': oneOf('start', 'center', 'end', 'between'),
      'wrap': bool(),
    },
  },
  'vk-grid': {
    name: '网格',
    layer: 'layout',
    summary: '分份容器。cols/rows 切几份，子项用 span 占几份；行高按内容。',
    attrs: {
      'cols': oneOf('1', '2', '3', '4', '5', '6'),
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

  'vk-title': {
    name: '标题',
    layer: 'components',
    summary: '标题：一句话主张 + 可选副题。',
    slots: [
      { name: 'eyebrow', description: '眉题；也可用 eyebrow 属性' },
      { name: 'sub', description: '副题；也可用 sub 属性' },
    ],
    content: {
      kind: 'text',
      target: 'vk-title',
      fields: [
        { name: 'text', label: '标题文字', type: 'textarea', text: true },
        { name: 'eyebrow', label: '眉题', type: 'text', attr: 'eyebrow' },
        { name: 'sub', label: '副题', type: 'text', attr: 'sub' },
      ],
    },
    attrs: {
      'index': text(),
      'eyebrow': text(),
      'sub': text(),
      'level': oneOf('1', '2', '3'),
      'size': oneOf('body', 'subhead', 'title', 'hero', 'mega'),
      'align': oneOf('left', 'center'),
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
    },
  },
  'vk-tag': {
    name: '标签',
    layer: 'components',
    summary: '一个小标签：状态、分类、元信息。两档尺寸，可带图标。',
    content: {
      kind: 'text',
      target: 'vk-tag',
      fields: [{ name: 'text', label: '标签文字', type: 'text', text: true }],
    },
    attrs: {
      'tone': oneOf('neutral', 'info', 'focus', 'ok', 'warn', 'err'),
      'size': oneOf('label', 'body', 'subhead'),
      'emphasis': oneOf('solid', 'soft', 'ghost'),
      'bare': bool(),
        },
  },
  'vk-callout': {
    name: '提示框',
    layer: 'components',
    summary: '提示块：说明、正确、注意、错误。色条 + 淡底 + 图标，正文仍是墨色。',
    slots: [{ name: 'title', description: '标题；也可用 title 属性' }],
    content: {
      kind: 'text',
      target: 'vk-callout',
      fields: [
        { name: 'text', label: '正文', type: 'textarea', text: true },
        { name: 'title', label: '标题', type: 'text', attr: 'title' },
      ],
    },
    attrs: {
      'tone': oneOf('info', 'ok', 'warn', 'err'),
      'title': text(),
      'size': oneOf('label', 'body', 'subhead'),
      'bare': bool(),
    },
  },
  'vk-code': {
    name: '代码窗',
    layer: 'components',
    summary: '代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮。',
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
      'focus': lines(),
      'fold': lines(),
      'omit': text(),
      'fold-note': text(),
      'chrome': oneOf('min', 'none'),
      'mark': text(),
      'mass': oneOf('compact', 'normal', 'hero'),
    },
  },
  'vk-term': {
    name: '终端',
    layer: 'components',
    summary: '终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行。',
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
      'chrome': oneOf('none', 'min'),
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
  'vk-figure': {
    name: '图窗',
    layer: 'components',
    summary: '画框里的图：标题栏、比例、说明、来源。',
    content: {
      kind: 'text',
      target: 'vk-figure',
      fields: [
        { name: 'src', label: '图片地址', type: 'text', attr: 'src' },
        { name: 'alt', label: '替代文字', type: 'text', attr: 'alt' },
        { name: 'caption', label: '图注', type: 'text', attr: 'caption' },
        { name: 'fig', label: '图号', type: 'text', attr: 'fig' },
        { name: 'url', label: '来源', type: 'text', attr: 'url' },
      ],
    },
    attrs: {
      'src': text(),
      'alt': text(),
      'caption': text(),
      'fig': text(),
      'url': text(),
      'ratio': text(),
      'crop': text(),
      'crop-label': text(),
      'fit': oneOf('cover', 'contain', 'none'),
      'chrome': oneOf('none', 'min', 'plain'),
      'shadow': oneOf('none', 'sm', 'md', 'lg'),
      'bleed': oneOf('none', 'left', 'right', 'full', 'y'),
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
  'vk-panel': {
    name: '区域',
    layer: 'elements',
    summary: '一块区域：卡片或章节带。只提供底、边和三个槽（header / footer / 其余进 body），不规定里面怎么排。',
    attrs: {
      'variant': oneOf('card', 'band'),
      'surface': oneOf('paper', 'sf-1', 'sf-2', 'sf-3'),
      'pad': oneOf('sm', 'md', 'lg', 'xl'),
      'border': oneOf('none', 'hair', 'strong'),
      'radius': oneOf('none', 'md', 'lg'),
      'n': text(),
      'elevation': oneOf('0', '1', '2'),
    },
  },
  'vk-stat': {
    name: '指标',
    layer: 'elements',
    summary: '一个指标：大数字 + 单位 + 标签，可选色点/色条做图例。数字用 tabular-nums，多个指标能对齐。',
    attrs: {
      'value': text(),
      'unit': text(),
      'label': text(),
      'size': oneOf('subhead', 'title', 'hero', 'mega'),
      'tone': oneOf('none', 'focus', 'info', 'ok', 'warn', 'err'),
      'mark': oneOf('none', 'dot', 'bar'),
      'format': oneOf('none', 'thousands', 'bytes', 'hex'),
      'align': oneOf('left', 'center'),
    },
  },
  'vk-keys': {
    name: '键位',
    layer: 'elements',
    summary: '键位：把 A + B 写成两枚键帽。',
    content: {
      kind: 'text',
      target: 'vk-keys',
      fields: [{ name: 'text', label: '键位（用 + 分隔）', type: 'text', text: true }],
    },
    attrs: {},
  },
  'vk-cells': {
    name: '内存格',
    layer: 'components',
    summary: '一格一个 <li>：标签、值、地址；state="err" 标出越界的那一格，超过 cols 自动换行。',
    content: {
      kind: 'children',
      target: 'vk-cells',
      item: 'li',
      fields: [
        { name: 'value', label: '值', type: 'text', attr: 'value' },
        { name: 'label', label: '标签', type: 'text', attr: 'label' },
        { name: 'span', label: '跨几格', type: 'int', attr: 'span' },
        { name: 'state', label: '状态', type: 'text', attr: 'state' },
        { name: 'filled', label: '填充格', type: 'bool', attr: 'filled' },
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
    summary: '步骤条：编号 + 连线 + 当前步。条目写成 <li>。',
    content: {
      kind: 'items',
      target: 'vk-steps',
      fields: [{ name: 'items', label: '步骤（一行一个）', type: 'lines', item: 'li' }],
    },
    attrs: {
      'current': int({ min: 0, max: 99, step: 1 }),
      'mass': oneOf('compact', 'normal', 'hero'),
    },
  },
  'vk-quote': {
    name: '引文',
    layer: 'components',
    summary: '一段引文：出处、作者；左侧竖线或压角引号。',
    content: {
      kind: 'text',
      target: 'vk-quote',
      fields: [
        { name: 'text', label: '引文', type: 'textarea', text: true },
        { name: 'source', label: '出处', type: 'text', attr: 'source' },
        { name: 'author', label: '作者', type: 'text', attr: 'author' },
      ],
    },
    attrs: {
      'source': text(),
      'author': text(),
      'variant': oneOf('rule', 'mark'),
      'size': oneOf('body', 'subhead', 'title', 'hero'),
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
    summary: '一组横向条：标签、数值条、单位。子节点写成 <li value label>。',
    content: {
      kind: 'items',
      target: 'vk-bars',
      fields: [{ name: 'items', label: '条目（一行一个：标签|数值）', type: 'lines', item: 'i' }],
    },
    attrs: {
      'max': num({ min: 1, max: 1000000000, step: 1 }),
      'scale': oneOf('linear', 'log'),
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
      'lang': text(),
      'src': { ...text(), build: true },
      'lines': text(),
      'file': { ...text(), build: true },
      'current': lines(),
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
    summary: '时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <li>。',
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
    summary: '圈选/框选/下划线：绑到任意锚点，只画覆盖层，不改布局。',
    attrs: {
      'for': sel(),
      'variant': oneOf('ellipse', 'rect', 'underline', 'bracket'),
      'pad-px': num({ min: 0, max: 80, step: 1 }),
      'tone': oneOf('info', 'focus', 'ok', 'warn', 'err'),
      'dash': bool(),
      'stroke': num({ min: 1, max: 12, step: 1 }),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },
  'vk-spotlight': {
    name: '聚光',
    layer: 'relations',
    summary: '聚光：目标保持原样，其余逐层退后。不画遮罩、不画描边；可多目标，keep 里的东西不退。',
    attrs: {
      'for': sel(),
      'dim': num({ min: 0, max: 1, step: 0.01 }),
      'keep': text(),
      'z': int({ min: 0, max: 99, step: 1 }),
    },
  },
};

/* ----------------------------------------------------------------- v10 共享语法
   块级组件统一拿 Frame 的 w/h/grow/fill/overflow/measure；
   行内组件（icon/tag/mark/keys）不拿 w；
   自定义几何（page/annotate/edge/canvas/img）自己声明。 */
const INLINE = new Set(['vk-icon', 'vk-tag', 'vk-mark', 'vk-keys', 'vk-inline']);
const CUSTOM = new Set([
  'vk-page',
  'vk-edge',
  'vk-canvas',
  'vk-img',
  'vk-pin',
  'vk-ring',
  'vk-spotlight',
]);
const COMMON = {
  w: { ...size({ min: 48, max: 1920, step: 1 }), context: 'canvas-child', layout: true },
  h: { ...size({ min: 48, max: 1080, step: 1 }), context: 'canvas-child', layout: true },
  span: { ...int({ min: 1, max: 6, step: 1 }), context: 'grid-child', layout: true },
  'row-span': { ...int({ min: 1, max: 6, step: 1 }), context: 'grid-child', layout: true },
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
  'vk-text': { ink: oneOf('primary', 'secondary', 'tertiary', 'muted') },
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
for (const tag of ['vk-ring', 'vk-spotlight', 'vk-pin', 'vk-edge']) {
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
  'vk-timeline': ['date', 'label', 'lane', 'at', 'span', 'tone', 'state'],
  'vk-bits': ['label', 'value', 'from', 'to', 'state'],
  'vk-cells': ['value', 'label', 'span', 'state', 'filled'],
  'vk-bars': ['label', 'value', 'state'],
  'vk-list': ['state'],
  'vk-steps': [],
  'vk-table': [],
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
    filled: { label: '填充格（序号，0 起）', group: 'state' },
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














