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
  density: { label: '密度', group: 'appearance' },
  size: { label: '尺寸', group: 'appearance' },
  level: { label: '标题级别', group: 'appearance' },
  weight: { label: '字重', group: 'appearance' },
  mono: { label: '等宽', group: 'appearance' },
  radius: { label: '圆角', group: 'appearance' },
  border: { label: '描边', group: 'appearance' },
  fit: { label: '填充', group: 'appearance' },
  chrome: { label: '窗头', group: 'appearance' },
  caret: { label: '光标', group: 'state' },
  stripe: { label: '斑马', group: 'appearance' },
  flat: { label: '无底色', group: 'appearance' },
  bare: { label: '无外壳', group: 'appearance' },
  display: { label: '独立成行', group: 'appearance' },
  rule: { label: '条目分隔线', group: 'appearance' },
  dash: { label: '虚线', group: 'appearance' },
  arrow: { label: '箭头', group: 'appearance' },
  shape: { label: '形状', group: 'appearance' },
  cap: { label: '端点', group: 'appearance' },
  current: { label: '当前步', group: 'state' },
  flag: { label: '越界格', group: 'state' },
  highlight: { label: '高亮行', group: 'state' },
  focus: { label: '聚光行', group: 'state' },
  fold: { label: '折叠行', group: 'state' },

  pad: { label: '内距', group: 'layout' },
  'pad-x': { label: '左右内距', group: 'layout' },
  'pad-y': { label: '上下内距', group: 'layout' },
  w: { label: '宽', group: 'layout' },
  h: { label: '高', group: 'layout' },
  x: { label: 'X', group: 'layout' },
  y: { label: 'Y', group: 'layout' },
  align: { label: '对齐', group: 'layout' },
  justify: { label: '主轴', group: 'layout' },
  gap: { label: '间距', group: 'layout' },
  'gap-x': { label: '列间距', group: 'layout' },
  'gap-y': { label: '行间距', group: 'layout' },
  cols: { label: '列数', group: 'layout' },
  inset: { label: '内缩', group: 'layout' },
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
  scale: { label: '图形尺寸', group: 'appearance' },
  emphasis: { label: '墨阶', group: 'appearance' },
  fit: { label: '适配', group: 'appearance' },
  overflow: { label: '溢出', group: 'appearance' },
  fill: { label: '填满', group: 'layout' },
  orientation: { label: '方向', group: 'layout' },
  stride: { label: '步长', group: 'layout' },
  position: { label: '焦点', group: 'appearance' },
  clearance: { label: '留缝', group: 'layout' },
  collapsed: { label: '收起目录', content: true },
  active: { label: '当前文件', content: true },
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
  'vk-text': { size: 'body', weight: 'regular', align: 'left', measure: 'none' },
  'vk-icon': { name: 'circle-help', scale: 'md' },
  'vk-img': { fit: 'cover', position: '50% 50%', radius: 'lg' },
  'vk-rule': { variant: 'thin' },
  'vk-mark': { variant: 'highlight', tone: 'accent' },
  'vk-stack': { gap: 'sm', align: 'stretch', justify: 'start' },
  'vk-row': { gap: 'sm', align: 'stretch', justify: 'start' },
  'vk-grid': { cols: '2', gap: 'sm', align: 'stretch' },
  'vk-canvas': { pad: '0' },
  'vk-edge': { 'from-side': 'auto', 'to-side': 'auto', shape: 'ortho', tone: 'ink', arrow: 'end', cap: 'none' },
  'vk-title': { size: 'title', align: 'left' },
  'vk-list': { variant: 'bullet', gap: 'sm' },
  'vk-tag': { tone: 'neutral', size: 'label' },
  'vk-callout': { tone: 'accent', size: 'body' },
  'vk-code': { surface: 'paper', chrome: 'min', density: 'normal' },
  'vk-term': { prompt: '$', surface: 'paper', chrome: 'min', density: 'normal' },
  'vk-diff': { variant: 'unified', surface: 'paper', chrome: 'min' },
  'vk-table': { variant: 'ledger', density: 'normal' },
  'vk-math': { size: 'body' },
  'vk-figure': { ratio: '16 / 9', fit: 'cover', position: '50% 50%', surface: 'paper', chrome: 'min' },
  'vk-browser': { chrome: 'min', surface: 'paper' },
  'vk-tree': { variant: 'files', depth: '4', summary: 'all' },
  'vk-bytes': { cols: '8', group: '1', ascii: 'all', address: 'all', density: 'normal' },
  'vk-frames': { grows: 'down', show: 'all', summary: 'all', density: 'normal' },
  'vk-cells': { cols: '0' },
  'vk-steps': { current: '1' },
  'vk-page': { align: 'top', surface: 'paper' },
  'vk-annotate': { w: '600' },
  'vk-note': { tone: 'accent', size: 'body' },
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
      'surface': oneOf('none', 'paper', 'soft', 'ink'),
      'tone': oneOf('accent', 'ok', 'warn', 'err'),
      'pad': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'pad-y': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'pad-x': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'radius': oneOf('sm', 'md', 'lg', 'xl', 'pill', 'none'),
      'border': oneOf('none', 'hair', 'strong'),
      'w': num({ min: 48, max: 1680, step: 1 }),
      'h': num({ min: 48, max: 888, step: 1 }),
      'x': { ...num({ min: -1680, max: 1680, step: 1 }), hidden: true },
      'y': { ...num({ min: -1680, max: 1680, step: 1 }), hidden: true },
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
      'size': oneOf('display', 'title', 'heading', 'body', 'label', 'meta'),
      'weight': oneOf('regular', 'medium', 'bold'),
      'mono': bool(),
      'align': oneOf('left', 'center', 'right'),
      'measure': oneOf('body', 'title', 'none'),
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
      'tone': oneOf('accent', 'ok', 'err', 'warn'),
      'label': text(),
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
      'w': num({ min: 48, max: 1680, step: 1 }),
      'h': num({ min: 48, max: 888, step: 1 }),
    },
  },
  'vk-rule': {
    name: '分隔线',
    layer: 'elements',
    summary: '一根线。线宽三档；纯装饰或语义分隔。',
    attrs: {},
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
      'tone': oneOf('accent', 'ok', 'err', 'warn'),
    },
  },

  'vk-stack': {
    name: '竖排',
    layer: 'layout',
    summary: '纵向节奏。只给间距和对齐，不画任何东西。',
    attrs: {
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'align': oneOf('start', 'center', 'end', 'stretch'),
      'justify': { ...oneOf('start', 'center', 'end', 'between'), hidden: true },
      'grow': { ...bool(), hidden: true },
    },
  },
  'vk-row': {
    name: '横排',
    layer: 'layout',
    summary: '横向排列。可换行、可两端推开。',
    attrs: {
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'align': oneOf('top', 'center', 'bottom', 'stretch', 'baseline'),
      'justify': oneOf('start', 'center', 'end', 'between'),
      'wrap': bool(),
    },
  },
  'vk-grid': {
    name: '网格',
    layer: 'layout',
    summary: '二维网格。列数固定，行高按内容。',
    attrs: {
      'cols': oneOf('1', '2', '3', '4', '5', '6'),
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'gap-x': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'gap-y': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
      'align': oneOf('start', 'center', 'end', 'stretch'),
    },
  },
  'vk-canvas': {
    name: '坐标系',
    layer: 'layout',
    summary: '坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。',
    attrs: {
      'w': num({ min: 48, max: 1680, step: 1 }),
      'h': num({ min: 48, max: 888, step: 1 }),
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
      'shape': { ...oneOf('ortho', 'curve', 'line'), default: 'ortho' },
      'tension': num({ min: 5, max: 120, step: 1, when: { shape: ['curve'] } }),
      'label': text(),
      'tone': oneOf('ink', 'accent', 'ok', 'err', 'warn', 'ghost'),
      'arrow': oneOf('end', 'start', 'both', 'none'),
      'arrow-style': oneOf('solid', 'open', 'thin'),
      'arrow-size': num({ min: 8, max: 48, step: 1 }),
      'dash': bool(),
      'gap': num({ min: 0, max: 200, step: 1, when: { shape: ['ortho'] } }),
      'bend': num({ min: -200, max: 200, step: 1, when: { shape: ['ortho'] } }),
      'cap': oneOf('none', 'dot'),
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
      'level': { ...oneOf('1', '2', '3'), hidden: true },
      'size': oneOf('display', 'title', 'heading'),
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
      'gap': oneOf('2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'),
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
      'tone': oneOf('neutral', 'accent', 'ok', 'warn', 'err', 'muted'),
      'size': oneOf('label', 'meta'),
      'state': oneOf('selected', 'current', 'disabled'),
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
      'tone': oneOf('accent', 'ok', 'warn', 'err'),
      'title': text(),
      'size': oneOf('heading', 'body', 'label'),
      'flat': bool(),
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
      'highlight': lines(),
      'focus': lines(),
      'fold': lines(),
      'fold-note': text(),
      'surface': oneOf('ink', 'paper'),
      'chrome': oneOf('min', 'none'),
      'mark': text(),
    },
  },
  'vk-term': {
    name: '终端',
    layer: 'components',
    summary: '终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行、块状光标。',
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
      'lines': text(),
      'title': text(),
      'prompt': text(),
      'surface': oneOf('ink', 'paper'),
      'chrome': oneOf('none', 'min'),
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
      'lang': text(),
      'src': text(),
      'lines': text(),
      'file': text(),
      'surface': oneOf('ink', 'paper'),
      'chrome': oneOf('min', 'none'),
    },
  },
  'vk-table': {
    name: '表格',
    layer: 'components',
    summary: '表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr data-em> 标出重点。',
    content: {
      kind: 'rows',
      target: 'table',
      fields: [
        { name: 'header', label: '表头（列 1 | 列 2 | …）', type: 'line' },
        { name: 'rows', label: '表体（每行：列 1 | 列 2 | …）', type: 'lines' },
      ],
    },
    attrs: {
      'variant': oneOf('ledger', 'compare', 'spec'),
      'stripe': bool(),
      'mono': bool(),
      'density': oneOf('normal', 'compact', 'dense'),
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
      'src': text(),
      'display': bool(),
      'size': oneOf('heading', 'body', 'label'),
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
      'fit': oneOf('cover', 'contain'),
      'surface': oneOf('paper', 'ink'),
      'chrome': oneOf('min', 'none'),
      'w': num({ min: 640, max: 1200, step: 1 }),
      'bare': bool(),
    },
  },
  'vk-browser': {
    name: '浏览器',
    layer: 'components',
    summary: '浏览器窗：地址栏 + 内容槽。',
    content: {
      kind: 'text',
      target: 'vk-browser',
      fields: [{ name: 'url', label: '地址', type: 'text', attr: 'url' }],
    },
    attrs: {
      'url': text(),
      'surface': oneOf('paper', 'ink'),
      'chrome': oneOf('min', 'none'),
      'w': num({ min: 840, max: 1680, step: 1 }),
    },
  },
  'vk-tree': {
    name: '树',
    layer: 'components',
    summary: '树：src 指向真实目录或 JSON。文件树、语法树、普通结构共用一套行渲染。',
    content: {
      kind: 'text',
      target: 'vk-tree',
      fields: [
        { name: 'tree', label: '树数据（JSON）', type: 'textarea', script: 'data-vk-tree', clears: ['src'] },
        { name: 'title', label: '标题', type: 'text', attr: 'title' },
        { name: 'active', label: '当前节点', type: 'text', attr: 'active' },
      ],
    },
    attrs: {
      'src': text(),
      'title': text(),
      'active': text(),
      'collapsed': text(),
      'variant': oneOf('files', 'ast', 'generic'),
      'limit': int({ min: 1, max: 500, step: 1 }),
      'summary': oneOf('all', 'none'),
      'depth': int({ min: 0, max: 8, step: 1 }),
      'hidden': { ...bool(), content: true },
    },
  },
  'vk-keys': {
    name: '键位',
    layer: 'components',
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
    summary: '一行连续的内存格：标签、值、地址；flag 标出越界的那一格。',
    content: {
      kind: 'text',
      target: 'vk-cells',
      fields: [
        { name: 'values', label: '值（用 | 分隔）', type: 'text', attr: 'values' },
        { name: 'labels', label: '标签（用 | 分隔）', type: 'text', attr: 'labels' },
        { name: 'addr', label: '起始地址', type: 'text', attr: 'addr' },
      ],
    },
    attrs: {
      'values': text(),
      'labels': text(),
      'addr': text(),
      'cols': int({ min: 0, max: 24, step: 1 }),
      'flag': int({ min: 1, max: 64, step: 1 }),
    },
  },
  'vk-bytes': {
    name: '字节',
    layer: 'components',
    summary: '字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，highlight 标出一段字节。',
    attrs: {
      'src': text(),
      'addr': text(),
      'offset': text(),
      'length': text(),
      'cols': oneOf('4', '8'),
      'group': oneOf('1', '2', '4', '8'),
      'ascii': oneOf('all', 'none'),
      'address': oneOf('all', 'none'),
      'highlight': text(),
      'density': oneOf('compact', 'normal'),
    },
  },
  'vk-frames': {
    name: '栈帧',
    layer: 'components',
    summary: '栈帧：src 指向真实 JSON；一帧一组槽位，标出当前帧、地址与生长方向。',
    attrs: {
      'src': text(),
      'title': text(),
      'active': int({ min: 1, max: 99, step: 1 }),
      'grows': oneOf('down', 'up'),
      'show': oneOf('all', 'values', 'addresses'),
      'summary': oneOf('all', 'none'),
      'density': oneOf('compact', 'normal'),
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
      'current': int({ min: 1, max: 99, step: 1 }),
    },
  },

  'vk-page': {
    name: '页面',
    layer: 'page',
    summary: '1080p 画布工具：安全区、可选页眉页脚、按容器宽度缩放。',
    slots: [
      { name: 'header', description: '页眉内容；优先级高于 header 属性' },
      { name: 'footer', description: '页脚内容；优先级高于 footer 属性' },
    ],
    content: {
      kind: 'text',
      target: 'vk-page',
      fields: [
        { name: 'header', label: '页眉', type: 'text', attr: 'header' },
        { name: 'footer', label: '页脚', type: 'text', attr: 'footer' },
      ],
    },
    attrs: {
      'header': text(),
      'footer': text(),
      'align': oneOf('top', 'center'),
      'surface': oneOf('paper', 'ink'),
    },
  },
  'vk-annotate': {
    name: '行旁批注',
    layer: 'relations',
    summary: '把批注绑到代码行：按行心对齐、贴在该行右侧；引线只服务非代码目标。',
    attrs: {
    },
  },
  'vk-note': {
    name: '讲解条',
    layer: 'relations',
    summary: '一条讲解：line 指向代码行，for 指向任意元素，由 vk-annotate 组织。',
    content: {
      kind: 'text',
      target: 'vk-note',
      fields: [
        { name: 'text', label: '讲解文字', type: 'textarea', text: true },
        { name: 'n', label: '编号', type: 'text', attr: 'n' },
      ],
    },
    attrs: {
      'n': int({ min: 1, max: 99, step: 1 }),
      'line': int({ min: 1, max: 999, step: 1 }),
      'tone': oneOf('inverse', 'accent', 'ok', 'err'),
      'size': oneOf('heading', 'body', 'label'),
      'for': sel(),
    },
  },
};

/* ----------------------------------------------------------------- v10 共享语法
   块级组件统一拿 Frame 的 w/h/grow/fill/overflow/measure；
   行内组件（icon/tag/mark/keys）不拿 w；
   自定义几何（page/annotate/edge/canvas/img）自己声明。 */
const INLINE = new Set(['vk-icon', 'vk-tag', 'vk-mark', 'vk-keys']);
const CUSTOM = new Set(['vk-page', 'vk-annotate', 'vk-edge', 'vk-canvas', 'vk-img']);
const COMMON = {
  w: size({ min: 48, max: 1920, step: 1 }),
  h: size({ min: 48, max: 1080, step: 1 }),
  grow: bool(),
  fill: bool(),
  overflow: oneOf('visible', 'clip'),
  measure: oneOf('body', 'title', 'none'),
};
for (const [tag, def] of Object.entries(TAGS)) {
  if (INLINE.has(tag) || CUSTOM.has(tag)) continue;
  def.attrs = def.attrs || {};
  Object.assign(def.attrs, COMMON);
}

const EXTRA = {
  'vk-box': { surface: oneOf('none', 'paper', 'soft', 'inverse', 'ink') },
  'vk-text': { emphasis: oneOf('primary', 'secondary', 'tertiary', 'muted') },
  'vk-icon': {
    emphasis: oneOf('primary', 'secondary', 'tertiary', 'muted'),
    scale: oneOf('sm', 'md', 'lg', 'xl', 'inherit'),
  },
  'vk-list': { variant: oneOf('bullet', 'check', 'define', 'ordered') },
  'vk-diff': {
    variant: oneOf('unified', 'split'),
    numbers: oneOf('all', 'none'),
    summary: oneOf('all', 'none'),
  },
  'vk-mark': { variant: oneOf('highlight', 'underline', 'strike', 'circle') },
  'vk-rule': { variant: oneOf('thin', 'strong', 'accent') },
  'vk-code': {
    fit: oneOf('clip', 'wrap', 'scroll'),
    numbers: oneOf('all', 'none'),
    numbering: oneOf('slice', 'file'),
    density: oneOf('compact', 'normal', 'large'),
  },
  'vk-term': {
    caret: text(),
    density: oneOf('compact', 'normal', 'large'),
  },
  'vk-table': { fit: oneOf('wrap', 'scroll') },
  'vk-callout': { density: oneOf('compact', 'normal') },
  'vk-steps': {
    orientation: oneOf('horizontal', 'vertical'),
    density: oneOf('compact', 'normal'),
  },
  'vk-cells': {
    stride: oneOf('1', '2', '4', '8'),
    cols: int({ min: 1, max: 8, step: 1 }),
  },
  'vk-img': {
    position: text(),
    border: oneOf('none', 'hair', 'strong'),
  },
  'vk-figure': { position: text() },
  'vk-tree': {
    collapsed: text(),
    active: text(),
    hidden: { ...bool(), content: true },
    summary: oneOf('all', 'none'),
  },
  'vk-edge': {
    clearance: num({ min: 0, max: 200, step: 1 }),
    'label-size': oneOf('label', 'meta'),
    'label-dx': num({ min: -400, max: 400, step: 1 }),
    'label-dy': num({ min: -200, max: 200, step: 1 }),
  },
  'vk-annotate': { w: num({ min: 320, max: 800, step: 1 }) },
  'vk-page': { fit: oneOf('width', 'contain') },
  'vk-grid': {
    cols: text(),
    justify: oneOf('start', 'center', 'end', 'stretch'),
  },
  'vk-canvas': {
    inset: num({ min: 0, max: 200, step: 1 }),
    overflow: oneOf('visible', 'clip'),
  },
  'vk-note': { emphasis: oneOf('primary', 'secondary', 'tertiary', 'muted') },
};
for (const [tag, attrs] of Object.entries(EXTRA)) {
  const def = TAGS[tag];
  if (!def) continue;
  def.attrs = def.attrs || {};
  Object.assign(def.attrs, attrs);
}


export const TAG_NAMES = Object.keys(TAGS);

/** 同名属性在不同标签上含义不同时，在这里覆盖。 */
const ATTR_META_BY_TAG = {
  'vk-bytes': {
    highlight: { label: '高亮字节', group: 'state' },
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
  return errors;
}
