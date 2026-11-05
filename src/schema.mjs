/**
 * v17 · 公开 API
 * ----------------------------------------------------------------------------
 * 这份文件定义「哪个标签有哪个属性、默认值、取值范围、子节点怎么写」。
 * 它是唯一来源：构建期校验、vk doc / vk brief、SPEC 表格、运行期默认值都读它。
 *
 * 规矩：
 *   · 属性名与取值只能来自 vocab.mjs；这里不发明数值。
 *   · 每件只做一件事。两件能画同一个东西 = 作者会选错 = 合并。
 *   · 一个概念一个词：tone（语义）/ size（字号）/ gap·pad（间距）/
 *     current（第几项，1 起，-1 = 没有）/ state（当前·标注）。
 *   · 没有时间维度：没有 at / cue / enter / duration。
 */

import { TONE, STATE, SURFACE, INK, SIZE } from './vocab.mjs';

export const LAYERS = [
  { id: 'page', label: 'L0 画布' },
  { id: 'layout', label: 'L1 排布' },
  { id: 'surface', label: 'L2 面与字' },
  { id: 'content', label: 'L3 内容' },
  { id: 'diagram', label: 'L4 图' },
  { id: 'relation', label: 'L5 关系' },
];

/* ------------------------------------------------------------------ 共享 */
/* 每个块级件都有的四件事 + 一个状态。 */
export const COMMON = {
  span: { type: 'int', min: 1, max: 12, default: 1, where: 'grid', group: 'layout', label: '占几份' },
  'row-span': { type: 'int', min: 1, max: 12, default: 1, where: 'grid', group: 'layout', label: '跨几行' },
  grow: { type: 'bool', group: 'layout', label: '吃掉剩余空间' },
  bleed: { type: 'enum', values: ['none', 'x', 'y', 'all'], default: 'none', group: 'layout', label: '出血到画布边' },
  state: { type: 'enum', values: STATE, group: 'state', label: '当前 / 标注' },
};

/* 画布子项：只有 vk-canvas 的直接子节点认。 */
export const CANVAS_ATTRS = {
  x: { type: 'num', min: -4000, max: 4000, default: 0, where: 'canvas', group: 'layout', label: 'X' },
  y: { type: 'num', min: -4000, max: 4000, default: 0, where: 'canvas', group: 'layout', label: 'Y' },
  w: { type: 'num', min: 48, max: 1920, where: 'canvas', group: 'layout', label: '宽' },
  h: { type: 'num', min: 48, max: 1080, where: 'canvas', group: 'layout', label: '高' },
  z: { type: 'int', min: 0, max: 99, default: 0, where: 'canvas', group: 'layout', label: '层级' },
};

/* ------------------------------------------------------------------ 取值 */
const size = (def = 'body') => ({ type: 'enum', values: SIZE, default: def, group: 'type', label: '字号' });
const gap = (def = 'normal') => ({ type: 'space', default: def, group: 'layout', label: '间距（档名或像素）' });
const pad = (def = 'normal') => ({ type: 'space', default: def, group: 'layout', label: '内距（档名或像素）' });
const tone = (def = 'neutral') => ({ type: 'enum', values: TONE, default: def, group: 'appearance', label: '语调' });
const radius = () => ({ type: 'enum', values: ['none', 'md', 'pill'], default: 'md', group: 'appearance', label: '圆角' });
const border = () => ({ type: 'enum', values: ['none', 'hair', 'strong'], default: 'none', group: 'appearance', label: '描边' });
const current = () => ({ type: 'index', default: -1, group: 'state', label: '当前项（1 起；-1 = 没有）' });
const chrome = (def = 'min') => ({ type: 'enum', values: ['min', 'none'], default: def, group: 'appearance', label: '窗头' });
const surface = (values, def) => ({ type: 'enum', values, default: def, group: 'appearance', label: '表面' });

const item = (attrs, hint) => ({ kind: 'item', item: 'li', attrs, hint });
const source = (hint) => ({ kind: 'source', hint });

/* 数据行的子项属性：tone 表语义、state 表当前/标注。 */
const ITEM_TONE = () => tone('neutral');

/* ------------------------------------------------------------------ 标签 */
export const TAGS = {
  /* ---------------------------------------------------------------- 画布 */
  'vk-page': {
    layer: 'page',
    name: '画布',
    summary: '一帧 1920×1080 的坐标系。align 决定内容在版心（1680×888）里的纵向位置。',
    attrs: {
      align: { type: 'enum', values: ['top', 'center', 'bottom'], default: 'center', group: 'layout', label: '纵向对齐' },
    },
    children: { kind: 'slot' },
  },

  /* ---------------------------------------------------------------- 排布 */
  'vk-stack': {
    layer: 'layout',
    name: '竖排',
    summary: '把子项按一条轴排开，只给间距、对齐和份数。不画任何东西。',
    attrs: {
      gap: gap('normal'),
      direction: { type: 'enum', values: ['column', 'row'], default: 'column', group: 'layout', label: '方向' },
      align: { type: 'enum', values: ['start', 'center', 'end', 'stretch'], default: 'stretch', group: 'layout', label: '交叉轴' },
      justify: { type: 'enum', values: ['start', 'center', 'end', 'between'], default: 'start', group: 'layout', label: '主轴' },
      weights: { type: 'list', group: 'layout', label: '按份数分剩余高度，如 "1 2 1"' },
    },
    children: { kind: 'slot' },
  },

  'vk-grid': {
    layer: 'layout',
    name: '网格',
    summary: '12 栏网格。子项用 span / row-span 占份；列宽由份数算出，不能手写像素。',
    attrs: {
      cols: { type: 'int', min: 1, max: 12, default: 2, group: 'layout', label: '列数' },
      gap: gap('normal'),
      align: { type: 'enum', values: ['start', 'center', 'end', 'stretch'], default: 'stretch', group: 'layout', label: '纵向对齐' },
    },
    children: { kind: 'slot' },
  },

  'vk-canvas': {
    layer: 'layout',
    name: '坐标画布',
    summary: '坐标空间：子项用 x / y 明确摆放。只有这里认 x / y / w / h / z。',
    attrs: {
      w: { type: 'num', min: 48, max: 1920, group: 'layout', label: '宽（不写按内容）' },
      h: { type: 'num', min: 48, max: 1080, group: 'layout', label: '高（不写按内容）' },
      pad: pad('none'),
    },
    children: { kind: 'slot' },
  },

  'vk-layer': {
    layer: 'layout',
    name: '叠层',
    summary: '叠放：第一个子项铺满当底，其余按顺序叠上去。',
    attrs: {
      surface: surface(['none', 'paper', 'soft', 'tint', 'dark'], 'none'),
      tone: tone('neutral'),
    },
    children: { kind: 'slot' },
  },

  'vk-pair': {
    layer: 'layout',
    name: '并置',
    summary: '两块并置对照：左右（或上下）两块，中间一条轴，轴上可放 → / = / vs。',
    attrs: {
      split: { type: 'num', min: 20, max: 80, default: 50, group: 'layout', label: '左块占比（%）' },
      direction: { type: 'enum', values: ['horizontal', 'vertical'], default: 'horizontal', group: 'layout', label: '方向' },
      symbol: { type: 'enum', values: ['none', '→', '=', 'vs', '+'], default: 'none', group: 'appearance', label: '轴上符号' },
      gap: gap('wide'),
    },
    children: { kind: 'slot', exactly: 2 },
  },

  /* ------------------------------------------------------------ 面与字 */
  'vk-box': {
    layer: 'surface',
    name: '面',
    summary: '一块面：底、描边、圆角、内距，可带标题带与窗头。它只描述这一块，不排别人。',
    attrs: {
      surface: surface(['none', 'paper', 'soft', 'tint', 'dark'], 'none'),
      tone: tone('neutral'),
      pad: pad('normal'),
      radius: radius(),
      border: border(),
      title: { type: 'text', group: 'appearance', label: '标题（写了才有标题带）' },
      chrome: { type: 'enum', values: ['none', 'dots'], default: 'none', group: 'appearance', label: '窗头三点' },
      ring: { type: 'bool', group: 'appearance', label: '强调环（不占布局）' },
    },
    children: { kind: 'slot' },
  },

  'vk-text': {
    layer: 'surface',
    name: '文字',
    summary: '一段文字：字号、字重、墨阶、对齐、行宽。行内可用 <em> 标注、<strong> 加重。',
    attrs: {
      size: size('body'),
      weight: { type: 'enum', values: ['regular', 'medium', 'bold'], default: 'regular', group: 'type', label: '字重' },
      ink: { type: 'enum', values: INK, default: 'primary', group: 'appearance', label: '墨阶' },
      tone: { type: 'enum', values: TONE, group: 'appearance', label: '语调' },
      align: { type: 'enum', values: ['left', 'center', 'right'], default: 'left', group: 'layout', label: '对齐' },
      measure: { type: 'measure', group: 'layout', label: '行宽（字数；none = 铺满）' },
      icon: { type: 'text', group: 'appearance', label: '图标（Lucide 名）' },
      mono: { type: 'bool', group: 'appearance', label: '等宽' },
    },
    content: 'text',
  },

  'vk-label': {
    layer: 'surface',
    name: '标签',
    summary: '一行小字：分类、编号、状态。kicker 纯字 / chip 浅底 / badge 实色。',
    attrs: {
      variant: { type: 'enum', values: ['kicker', 'chip', 'badge'], default: 'kicker', group: 'appearance', label: '形态' },
      tone: tone('neutral'),
      icon: { type: 'text', group: 'appearance', label: '图标（Lucide 名）' },
      counter: { type: 'text', group: 'appearance', label: '序号，如 "3/5"' },
    },
    content: 'text',
  },

  'vk-inline': {
    layer: 'surface',
    name: '行内',
    summary: '句子里的行内元素：代码、公式、上下标、键位。字号跟着所在文本走。',
    attrs: {
      variant: { type: 'enum', values: ['code', 'math', 'sup', 'sub', 'keys'], default: 'code', group: 'appearance', label: '形态' },
    },
    content: 'text',
  },

  'vk-img': {
    layer: 'surface',
    name: '图片',
    summary: '一张图：比例、填充方式、焦点。加载失败有可见占位。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '图片地址' },
      alt: { type: 'text', content: true, group: 'content', label: '替代文字' },
      ratio: { type: 'text', group: 'appearance', label: '比例，如 "16 / 9"' },
      fill: { type: 'enum', values: ['cover', 'contain'], default: 'cover', group: 'appearance', label: '填充' },
      radius: radius(),
      position: { type: 'text', default: '50% 50%', group: 'appearance', label: '焦点' },
    },
    content: 'none',
  },

  /* ---------------------------------------------------------------- 内容 */
  'vk-code': {
    layer: 'content',
    name: '代码',
    summary: '代码窗。构建期高亮；可截取真实文件的行段，标当前行、聚光、折叠。宽度默认按内容，不铺满。',
    attrs: {
      lang: { type: 'text', content: true, group: 'content', label: '语言' },
      src: { type: 'text', content: true, group: 'content', label: '源文件' },
      lines: { type: 'text', content: true, group: 'content', label: '行段，如 "4-6"' },
      file: { type: 'text', content: true, group: 'content', label: '窗头文件名' },
      current: { type: 'lines', group: 'state', label: '当前行（1 起）' },
      focus: { type: 'lines', group: 'state', label: '聚光行' },
      fold: { type: 'lines', group: 'state', label: '折叠行（缺口）' },
      size: size('body'),
      long: { type: 'enum', values: ['clip', 'wrap'], default: 'clip', group: 'appearance', label: '长行' },
      chrome: chrome('min'),
      mark: { type: 'text', group: 'state', label: '标出的词（窗口里所有出现处）' },
    },
    children: source('src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。构建期高亮，运行期零依赖。'),
  },

  'vk-term': {
    layer: 'content',
    name: '终端',
    summary: '终端 transcript：提示符、命令、输出、报错各自一色。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '源文件' },
      title: { type: 'text', content: true, group: 'content', label: '窗头标题' },
      prompt: { type: 'text', default: '$', group: 'appearance', label: '提示符' },
      current: { type: 'lines', group: 'state', label: '当前行（1 起）' },
      size: size('body'),
      surface: surface(['paper', 'dark'], 'paper'),
      chrome: chrome('min'),
    },
    children: source('src 指向真实 transcript，或内联 <script type="text/plain" data-vk-source>；每行一条命令或一段输出。'),
  },

  'vk-diff': {
    layer: 'content',
    name: '改动',
    summary: 'diff：上下对照或左右两窗并排，词级标记 + 一句改了几行。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '源文件' },
      lines: { type: 'text', content: true, group: 'content', label: '行段' },
      file: { type: 'text', content: true, group: 'content', label: '窗头文件名' },
      lang: { type: 'text', content: true, group: 'content', label: '语言' },
      current: { type: 'lines', group: 'state', label: '当前行（1 起）' },
      size: size('body'),
    },
    children: source('src 指向真实 diff 文本，或内联 <script type="text/plain" data-vk-source>。必须有 lang。'),
  },

  'vk-table': {
    layer: 'content',
    name: '表格',
    summary: '表格：原生 <table>，数字列自动右对齐、单位列自动挂靠。行可写 tone / state。',
    attrs: {
      variant: { type: 'enum', values: ['ledger', 'spec', 'matrix'], default: 'ledger', group: 'appearance', label: '形态' },
      mono: { type: 'bool', group: 'appearance', label: '等宽' },
      size: size('body'),
      caption: { type: 'text', content: true, group: 'content', label: '表题（表下方一行小字）' },
    },
    children: { kind: 'table', hint: '写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err" state="current"。' },
  },

  'vk-list': {
    layer: 'content',
    name: '列表',
    summary: '列表：要点 / 清单 / 定义 / 有序。条目写成 <li>。',
    attrs: {
      variant: { type: 'enum', values: ['bullet', 'check', 'ordered', 'define'], default: 'bullet', group: 'appearance', label: '形态' },
      gap: gap('close'),
      size: size('body'),
    },
    children: item({ tone: ITEM_TONE(), state: COMMON.state }, '每一项写成 <li>；可写 tone 标语义、state="current" 标当前。'),
  },

  'vk-math': {
    layer: 'content',
    name: '公式',
    summary: '公式：src 指向真实 .tex，构建期用 KaTeX 排版，运行期零依赖。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '源文件' },
      display: { type: 'bool', group: 'appearance', label: '独立成行' },
      size: size('body'),
    },
    children: source('src 指向 .tex 文件，或内联 <script type="text/plain" data-vk-source> 写 TeX。'),
  },

  'vk-tree': {
    layer: 'content',
    name: '文件树',
    summary: '文件树：src 指向真实目录，构建期扫描层级；缩进与树线是真的，不是列表。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '目录' },
      title: { type: 'text', content: true, group: 'content', label: '窗头标题' },
      depth: { type: 'int', min: 1, max: 6, default: 3, group: 'layout', label: '最大深度' },
      current: { type: 'text', group: 'state', label: '当前节点路径' },
      size: size('body'),
    },
    children: source('src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。'),
  },

  'vk-asm': {
    layer: 'content',
    name: '汇编',
    summary: '汇编清单：地址 / 机器码 / 指令 / 操作数四列。行与地址都能被锚定。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '源文件（objdump 文本）' },
      lines: { type: 'text', content: true, group: 'content', label: '行段' },
      file: { type: 'text', content: true, group: 'content', label: '窗头文件名' },
      current: { type: 'lines', group: 'state', label: '当前行（1 起）' },
      size: size('body'),
      chrome: chrome('min'),
      bytes: { type: 'bool', group: 'appearance', label: '显示机器码列（默认不显示）' },
    },
    children: source('src 指向 objdump 文本，或内联 <script type="text/plain" data-vk-source>。'),
  },

  'vk-cells': {
    layer: 'content',
    name: '内存格',
    summary: '一格一个 <li>：标签、值、地址。地址由 addr + 序号算出，不手写。',
    attrs: {
      addr: { type: 'text', content: true, group: 'content', label: '起始地址，如 "0x1000"' },
      cols: { type: 'int', min: 1, max: 8, default: 4, group: 'layout', label: '每行几格' },
      current: current(),
      size: size('body'),
    },
    children: item({ value: { type: 'text', label: '值' }, label: { type: 'text', label: '标签' }, tone: ITEM_TONE(), state: COMMON.state }, '<li value="61" label="s[0]">；地址自动按 addr + 序号算。'),
  },

  'vk-bytes': {
    layer: 'content',
    name: '字节',
    summary: '字节窗：src 指向真实二进制；十六进制 + ASCII + 地址，current 标出一段。',
    attrs: {
      src: { type: 'text', content: true, group: 'content', label: '二进制文件' },
      addr: { type: 'text', default: '0x0', group: 'content', label: '起始地址' },
      offset: { type: 'int', min: 0, default: 0, group: 'content', label: '起始字节' },
      length: { type: 'int', min: 1, max: 4096, default: 32, group: 'content', label: '字节数' },
      cols: { type: 'enum', values: ['4', '8'], default: '8', group: 'layout', label: '每行几列' },
      current: { type: 'text', group: 'state', label: '当前字节段，如 "4-7"' },
    },
    children: source('src 指向真实二进制文件。数值是读出来的，不是手写的。'),
  },

  'vk-bits': {
    layer: 'content',
    name: '位',
    summary: '一行二进制位：索引、分组、符号位。用来讲位域与浮点布局。',
    attrs: {
      value: { type: 'text', content: true, group: 'content', label: '位串，可含空格' },
      index: { type: 'enum', values: ['down', 'up', 'none', 'sparse'], default: 'down', group: 'appearance', label: '位序号方向' },
      group: { type: 'enum', values: ['1', '4', '8'], default: '4', group: 'appearance', label: '分组' },
      sign: { type: 'bool', group: 'appearance', label: '标出符号位' },
    },
    content: 'text',
  },

  /* ---------------------------------------------------------------- 图 */
  'vk-steps': {
    layer: 'diagram',
    name: '步骤',
    summary: '步骤条：编号 + 连线 + 当前步。条目写成 <li>；容器窄时自动竖排，不压字。',
    attrs: {
      current: current(),
      direction: { type: 'enum', values: ['auto', 'horizontal', 'vertical'], default: 'auto', group: 'layout', label: '方向' },
      connector: { type: 'enum', values: ['arrow', 'line', 'none'], default: 'arrow', group: 'appearance', label: '连接线' },
      size: size('body'),
    },
    children: item({ tone: ITEM_TONE() }, '每一步写成 <li>；可写 tone 标语义。'),
  },

  'vk-bars': {
    layer: 'diagram',
    name: '条',
    summary: '一组横向条：标签、值、单位。用来讲大小对比。',
    attrs: {
      max: { type: 'num', min: 1, group: 'appearance', label: '最大值（不写按最大一条）' },
      unit: { type: 'text', content: true, group: 'appearance', label: '单位' },
      tone: tone('neutral'),
      scale: { type: 'enum', values: ['linear', 'log'], default: 'linear', group: 'appearance', label: '刻度' },
    },
    children: item({ label: { type: 'text', label: '标签' }, value: { type: 'num', label: '数值' }, tone: ITEM_TONE() }, '<li value="120" label="hello.o">；值写数字，不写单位。'),
  },

  'vk-timeline': {
    layer: 'diagram',
    name: '时间线',
    summary: '时间线：等距事件（不按年份比例）或多泳道。一条事项一个 <li>。',
    attrs: {
      variant: { type: 'enum', values: ['events', 'lanes'], default: 'events', group: 'appearance', label: '形态' },
      start: { type: 'text', content: true, group: 'content', label: '起点' },
      end: { type: 'text', content: true, group: 'content', label: '终点' },
      lanes: { type: 'text', content: true, group: 'content', label: '泳道名（逗号分隔）' },
      current: current(),
    },
    children: item({ date: { type: 'text', label: '日期' }, label: { type: 'text', label: '标题' }, note: { type: 'text', label: '小字说明' }, lane: { type: 'text', label: '泳道' }, tone: ITEM_TONE(), state: COMMON.state }, '<li date="1972" label="C 诞生" note="小字说明">；lanes 形态写 lane="名字"。'),
  },

  'vk-compare': {
    layer: 'diagram',
    name: '对照',
    summary: '两张图对照：默认左右并排（每张完整、不裁），也可上下或叠放对照；可标差异框并放大。',
    attrs: {
      labels: { type: 'text', content: true, group: 'content', label: '两张图与角标："a.png,b.png|改前|改后"' },
      split: { type: 'num', min: 20, max: 80, default: 50, group: 'layout', label: 'split 模式左图占比（%）' },
      variant: { type: 'enum', values: ['side', 'stack', 'split'], default: 'side', group: 'appearance', label: '形态' },
      mark: { type: 'text', content: true, group: 'appearance', label: '差异框：x1,y1,x2,y2（%；多组用 ;）' },
    },
    content: 'none',
  },

  /* ---------------------------------------------------------------- 关系 */
  'vk-callout': {
    layer: 'relation',
    name: '标注',
    summary:
      '画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标（按字的墨迹，不按整行盒子），note 是带引线的注释气泡，badge 是编号点。它不改布局。',
    attrs: {
      mode: { type: 'enum', values: ['arrow', 'ring', 'note', 'badge'], default: 'arrow', group: 'appearance', label: '形态' },
      for: { type: 'selector', content: true, group: 'target', label: '目标（ring / note / badge）' },
      from: { type: 'selector', content: true, group: 'target', label: '起点（arrow）' },
      to: { type: 'selector', content: true, group: 'target', label: '终点（arrow）' },
      side: { type: 'enum', values: ['auto', 'top', 'right', 'bottom', 'left'], default: 'auto', group: 'layout', label: '贴哪一侧' },
      gap: gap('normal'),
      shape: { type: 'enum', values: ['straight', 'ortho', 'curve'], default: 'curve', group: 'appearance', label: '连线形状' },
      label: { type: 'text', group: 'target', label: '连线上的字（arrow）' },
      tone: tone('info'),
    },
    content: 'text',
  },
};

export const TAG_NAMES = Object.keys(TAGS);

/** 一个标签自己的属性表：共享属性 + 它自己声明的。 */
export function attrsOf(tag) {
  if (tag === 'vk-page') return { ...TAGS[tag].attrs };
  return { ...COMMON, ...TAGS[tag].attrs };
}

/**
 * 运行期要观察的属性名。
 * x / y / w / h / z 只在 vk-canvas 的子节点上成立（构建期按父级判定），
 * 但运行期一律观察：属性出现在别处时由构建期报错，不靠静默忽略。
 */
export function observedOf(tag) {
  const names = Object.keys(attrsOf(tag));
  if (tag !== 'vk-page') names.push(...Object.keys(CANVAS_ATTRS));
  return [...new Set(names)];
}

/** 每个标签的默认值表（运行期 spec() 读它，不再各写一份）。 */
export const DEFAULTS = Object.fromEntries(
  TAG_NAMES.map((tag) => {
    const out = {};
    for (const [name, spec] of Object.entries(attrsOf(tag))) if (spec.default !== undefined) out[name] = spec.default;
    return [tag, out];
  })
);

/** 结构化子节点的合法属性：父标签 → 名字列表。 */
export const CHILD_ATTRS = Object.fromEntries(
  TAG_NAMES.filter((t) => TAGS[t].children?.kind === 'item').map((t) => [
    t,
    Object.keys(TAGS[t].children.attrs || {}),
  ])
);
