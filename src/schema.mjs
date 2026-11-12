/**
 * v19 · 公开契约
 * ----------------------------------------------------------------------------
 * 这份文件定义「哪个标签有哪个属性、默认值、取值范围、子节点怎么写、一帧放几行」。
 * 它是唯一来源：构建期校验、vk doc / vk brief、CONTRACT.md、运行期默认值都读它。
 *
 * 规矩：
 *   · 属性名与取值只能来自 vocab.mjs；这里不发明数值。
 *   · 每件只做一件事；两件能画同一个东西 = 作者会选错 = 合并。
 *   · 一个概念一个词：tone（语义）/ size（字号）/ gap·pad（间距）/
 *     current（第几项，1 起）/ state（当前·标注）/ span（跨几栏）。
 *   · 没有时间维度：没有 at / cue / enter / duration（时间线里的 at 是坐标，不是时间轴播放）。
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

/* ------------------------------------------------------------------ 共享
   块级件都是 flow 的子项：span 跨栏、bleed 出血。两件事各只有一个词。 */
export const FLOW_CHILD = {
  span: { type: 'int', min: 1, max: 12, default: 1, group: 'layout', label: '跨几栏' },
  bleed: { type: 'enum', values: ['x', 'all'], group: 'layout', label: '出血到画布边' },
};

/* ------------------------------------------------------------------ 取值 */
const size = (values = SIZE, def = 'body') => ({ type: 'enum', values, default: def, group: 'type', label: '字号' });
const sizeData = (def = 'body') => size(['caption', 'body', 'subhead'], def);
const gap = (def = 'normal') => ({ type: 'space', default: def, group: 'layout', label: '间距（档名或像素）' });
const pad = (def = 'none') => ({ type: 'space', default: def, group: 'layout', label: '内距（档名或像素）' });
const tone = (values = TONE, def = 'neutral') => ({ type: 'enum', values, default: def, group: 'appearance', label: '语调' });
const radius = () => ({ type: 'enum', values: ['none', 'md', 'lg', 'pill'], default: 'md', group: 'appearance', label: '圆角' });
const border = () => ({ type: 'enum', values: ['none', 'hair', 'strong'], default: 'none', group: 'appearance', label: '描边' });
const chrome = (def = 'none') => ({ type: 'enum', values: ['none', 'dots'], default: def, group: 'appearance', label: '窗口标题栏（三点 + 标题）' });
const current = () => ({ type: 'index', default: undefined, group: 'state', label: '第几项（1 起；不写 = 没有当前）' });
const surface = () => ({ type: 'enum', values: ['paper', 'dark'], default: 'paper', group: 'appearance', label: '表面' });

const item = (attrs, hint) => ({ kind: 'item', item: 'li', attrs, hint });
const source = (hint) => ({ kind: 'source', hint });

/* 数据行的子项属性：tone 表语义、state 表当前/标注。 */
const ITEM_STATE = { type: 'enum', values: STATE, group: 'state', label: '当前 / 标注' };
const ITEM_TONE = { type: 'enum', values: TONE, default: 'neutral', group: 'appearance', label: '语调' };

/* ------------------------------------------------------------------ 标签 */
export const TAGS = {
  /* ---------------------------------------------------------------- 画布 */
  'vk-page': {
    layer: 'page',
    name: '画布',
    summary: '一帧 1920×1080 的坐标系。子项就是流：直接写 head 与内容，不用再包一层。align 决定内容在版心里的纵向位置。',
    attrs: {
      id: { type: 'text', group: 'content', label: '帧名（出图文件名）' },
      align: { type: 'enum', values: ['band', 'center', 'top', 'bottom'], default: 'band', group: 'layout', label: '纵向对齐' },
      surface: surface(),
      gap: gap('normal'),
    },
    children: { kind: 'slot', hint: '直接写 <vk-head> 与内容；下一层要分栏时写 <vk-flow>。' },
  },

  'vk-head': {
    layer: 'page',
    name: '标题带',
    summary: '一帧的起手：眉标 + 标题 +（可选）一句导语。它把标题带的位置与间距固定下来，帧与帧的标题不会跳。',
    attrs: {
      kicker: { type: 'text', group: 'content', label: '眉标（集数 / 分类）' },
      counter: { type: 'text', group: 'appearance', label: '序号，如 "3 / 8"（等宽，跟在眉标后）' },
      lede: { type: 'text', group: 'content', label: '导语（标题下一句）' },
      size: { type: 'enum', values: ['subhead', 'headline', 'display'], default: 'headline', group: 'type', label: '标题字号' },
      align: { type: 'enum', values: ['left', 'center'], default: 'left', group: 'layout', label: '对齐' },
    },
    content: 'text',
    children: { kind: 'none', hint: '标签里的文字就是标题，可以写 <em> / <mark> / <code>。' },
  },

  /* ---------------------------------------------------------------- 排布 */
  'vk-flow': {
    layer: 'layout',
    name: '流',
    summary: '唯一的排布：列数（或比例、auto）由容器给，子项用 span 跨栏；overlay 让子项叠放。不画任何东西。',
    attrs: {
      cols: { type: 'cols', default: '1', group: 'layout', label: '列：数字 1–12、比例 "1 2 1"、或 auto（按内容宽）' },
      gap: gap('normal'),
      pad: pad('none'),
      align: { type: 'enum', values: ['start', 'center', 'end', 'between', 'stretch'], default: 'stretch', group: 'layout', label: '纵向' },
      justify: { type: 'enum', values: ['start', 'center', 'end', 'between'], default: 'start', group: 'layout', label: '横向' },
      overlay: { type: 'bool', group: 'layout', label: '叠放：子项落在同一格里' },
      span: FLOW_CHILD.span,
      bleed: FLOW_CHILD.bleed,
    },
    children: { kind: 'slot' },
  },

  /* ------------------------------------------------------------ 面与字 */
  'vk-surface': {
    layer: 'surface',
    name: '面',
    summary: '一块面：底、描边、圆角、内距，可带标题栏。它是全库唯一的「窗口」，代码/终端/树共用同一套皮。',
    attrs: {
      surface: { type: 'enum', values: ['none', 'paper', 'soft', 'dark'], default: 'none', group: 'appearance', label: '表面' },
      pad: pad('normal'),
      radius: radius(),
      border: border(),
      title: { type: 'text', group: 'appearance', label: '标题（写了才有标题带）' },
      chrome: chrome('none'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: { kind: 'slot' },
  },

  'vk-text': {
    layer: 'surface',
    name: '文字',
    summary: '一段文字：字号、字重、墨阶、对齐、行宽。行内可用 <em> 强调、<strong> 加重、<mark> 标原文、<code> 行内代码、<kbd> 键位。',
    attrs: {
      size: size(),
      weight: { type: 'enum', values: ['regular', 'medium', 'bold'], default: 'regular', group: 'type', label: '字重' },
      ink: { type: 'enum', values: INK, default: 'primary', group: 'appearance', label: '墨阶' },
      align: { type: 'enum', values: ['left', 'center', 'right'], default: 'left', group: 'layout', label: '对齐' },
      measure: { type: 'measure', group: 'layout', label: '行宽（字数；none = 铺满）' },
      mono: { type: 'bool', group: 'appearance', label: '等宽' },
      icon: { type: 'text', group: 'appearance', label: '行首图标（Lucide 名）' },
      variant: { type: 'enum', values: ['body', 'kicker'], default: 'body', group: 'appearance', label: '形态' },
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    content: 'text',
  },

  'vk-img': {
    layer: 'surface',
    name: '图片',
    summary: '一张图：比例、填充方式、焦点。默认完整显示（contain），要裁切得明说；bleed="all" 可整帧铺满当底。',
    attrs: {
      src: { type: 'text', group: 'content', label: '图片地址' },
      alt: { type: 'text', group: 'content', label: '替代文字（图坏了会显示）' },
      ratio: { type: 'text', group: 'appearance', label: '比例，如 "16 / 9"' },
      fill: { type: 'enum', values: ['cover', 'contain'], default: 'contain', group: 'appearance', label: '填充（cover 会裁掉超出的部分）' },
      radius: radius(),
      position: { type: 'text', default: '50% 50%', group: 'appearance', label: '焦点' },
      span: FLOW_CHILD.span,
      bleed: FLOW_CHILD.bleed,
    },
    children: { kind: 'none' },
  },

  /* ---------------------------------------------------------------- 内容 */
  'vk-code': {
    layer: 'content',
    name: '源码窗',
    summary: '唯一的「源码窗」：as 选内容类型（源码 / 终端 / 改动 / 汇编）。构建期高亮或解析，运行期零依赖。',
    attrs: {
      as: { type: 'enum', values: ['code', 'term', 'diff', 'asm'], default: 'code', group: 'content', label: '内容类型' },
      lang: { type: 'text', group: 'content', label: '语言（as="code" / "diff" 用）' },
      src: { type: 'text', group: 'content', label: '源文件' },
      lines: { type: 'text', group: 'content', label: '行段，如 "4-6"（按源文件算）' },
      title: { type: 'text', group: 'content', label: '标题栏文字（文件名 / 命令行）' },
      current: { type: 'lines', group: 'state', label: '当前行（窗口内第几行，1 起）' },
      fold: { type: 'lines', group: 'state', label: '折叠行（窗口内第几行）' },
      mark: { type: 'text', group: 'state', label: '标出的词（窗口里所有出现处）' },
      size: sizeData('body'),
      long: { type: 'enum', values: ['clip', 'wrap'], default: 'clip', group: 'appearance', label: '长行' },
      chrome: chrome('none'),
      surface: { type: 'enum', values: ['auto', 'paper', 'dark'], default: 'auto', group: 'appearance', label: '表面（auto = 跟随页面）' },
      prompt: { type: 'text', default: '$', group: 'appearance', label: '终端提示符（as="term"）' },
      bytes: { type: 'bool', group: 'appearance', label: '显示机器码列（as="asm"）' },
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    example: '<vk-code lang="c" title="a.c" current="2"><script type="text/plain" data-vk-source>\nint a[3] = {1, 2, 3};\na[1]\n</script></vk-code>',
    children: source('src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。'),
    capacity: { max: 6, unit: '行', by: { term: 6, diff: 5, asm: 5 } },
  },

  'vk-table': {
    layer: 'content',
    name: '表格',
    summary: '原生 <table>：数字列自动右对齐、等宽数字；行与单元格都可写 tone / state。',
    attrs: {
      size: sizeData('body'),
      caption: { type: 'text', group: 'content', label: '表题（表上方一行小字）' },
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    example: '<vk-table caption="读一次要多久"><table><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100ns</td></tr><tr><td>L1</td><td>1ns</td></tr></table></vk-table>',
    children: { kind: 'table', hint: '写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err" state="current"，单元格可写 state="current"。' },
    capacity: { max: 4, unit: '数据行' },
  },

  'vk-list': {
    layer: 'content',
    name: '列表',
    summary: '列表：要点 / 清单 / 有序。条目写成 <li>；顺序本身就是信息时用 ordered。',
    attrs: {
      variant: { type: 'enum', values: ['bullet', 'check', 'ordered'], default: 'bullet', group: 'appearance', label: '形态' },
      gap: gap('close'),
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item({ tone: ITEM_TONE, state: ITEM_STATE }, '每一项写成 <li>；可写 tone 标语义、state="current" 标当前。'),
    capacity: { max: 6, unit: '项' },
  },

  'vk-tree': {
    layer: 'content',
    name: '文件树',
    summary: '层级树：src 指向真实目录，构建期扫描；缩进与树线是真的。也可用内联 JSON 描述任意层级。',
    attrs: {
      src: { type: 'text', group: 'content', label: '目录' },
      title: { type: 'text', group: 'content', label: '标题栏文字' },
      depth: { type: 'int', min: 1, max: 6, default: 3, group: 'layout', label: '最大深度' },
      max: { type: 'int', min: 1, max: 40, default: 6, group: 'appearance', label: '最多显示几行（超了会留一行说明）' },
      current: { type: 'text', group: 'state', label: '当前节点路径' },
      size: sizeData('body'),
      icons: { type: 'enum', values: ['auto', 'none'], default: 'auto', group: 'appearance', label: '图标' },
      'icon-dir': { type: 'text', group: 'appearance', label: '目录图标（Lucide 名）' },
      'icon-file': { type: 'text', group: 'appearance', label: '文件图标' },
      chrome: chrome('none'),
      surface: { type: 'enum', values: ['auto', 'paper', 'dark'], default: 'auto', group: 'appearance', label: '表面' },
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: source('src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。'),
    capacity: { max: 6, unit: '行' },
  },

  'vk-math': {
    layer: 'content',
    name: '公式',
    summary: '公式：src 指向 .tex 或内联写 TeX，构建期用 KaTeX 排版，运行期零依赖。inline 写在句子里。',
    attrs: {
      src: { type: 'text', group: 'content', label: '源文件' },
      inline: { type: 'bool', group: 'appearance', label: '行内（跟在句子里）' },
      align: { type: 'enum', values: ['left', 'center'], default: 'center', group: 'layout', label: '对齐' },
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: source('src 指向 .tex 文件；或把 TeX 直接写在标签里；或用 <script type="text/plain" data-vk-source>。'),
  },

  'vk-cells': {
    layer: 'content',
    name: '内存格',
    summary: '一格一个 <li>：值、标签、指针。地址由 addr + 序号 × stride 算出，不手写。',
    attrs: {
      addr: { type: 'text', group: 'content', label: '起始地址，如 "0x1000"' },
      stride: { type: 'int', min: 1, default: 1, group: 'content', label: '每格占几字节（int 数组写 4）' },
      cols: { type: 'int', min: 1, max: 8, default: 4, group: 'layout', label: '每行几格' },
      current: current(),
      size: sizeData('body'),
      gap: gap('close'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item(
      { value: { type: 'text', label: '值' }, label: { type: 'text', label: '标签' }, ptr: { type: 'text', label: '指针名，如 "lo"（空格分隔多个）' }, tone: ITEM_TONE, state: ITEM_STATE },
      '<li value="61" label="s[0]" ptr="lo">；地址自动按 addr + 序号 × stride 算。'
    ),
    capacity: { max: 2, unit: '行（cols 列一行）' },
  },

  'vk-bytes': {
    layer: 'content',
    name: '字节',
    summary: '字节窗：src 指向真实二进制；地址 + 十六进制 + ASCII 三列，current 标出一段。',
    attrs: {
      src: { type: 'text', group: 'content', label: '二进制文件' },
      addr: { type: 'text', default: '0x0', group: 'content', label: '起始地址' },
      offset: { type: 'int', min: 0, default: 0, group: 'content', label: '起始字节' },
      length: { type: 'int', min: 1, max: 4096, default: 32, group: 'content', label: '字节数' },
      cols: { type: 'enum', values: ['4', '8', '16'], default: '8', group: 'layout', label: '每行几列' },
      current: { type: 'text', group: 'state', label: '当前字节段，如 "4-7"（1 起）' },
      header: { type: 'bool', group: 'appearance', label: '列头（地址 / 十六进制 / ASCII）' },
      title: { type: 'text', group: 'content', label: '标题栏文字' },
      chrome: chrome('none'),
      surface: { type: 'enum', values: ['auto', 'paper', 'dark'], default: 'auto', group: 'appearance', label: '表面' },
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: source('src 指向真实二进制文件；也可以内联十六进制（68 65 6c 6c 6f），适合草稿。'),
    capacity: { max: 4, unit: '行（cols=8 时）' },
  },

  'vk-bits': {
    layer: 'content',
    name: '位',
    summary: '一行二进制位：索引、分组、符号位。用 | 分段（符号 | 阶码 | 尾数），field-labels 给每段起名。',
    attrs: {
      value: { type: 'text', group: 'content', label: '位串，可含空格；用 | 分段' },
      current: { type: 'lines', group: 'state', label: '当前位段，如 "4-7"（1 起，从左数）' },
      label: { type: 'text', group: 'appearance', label: '左边一行说明' },
      'field-labels': { type: 'text', group: 'appearance', label: '各段名，逗号分隔（个数要与 | 的段数一致）' },
      index: { type: 'enum', values: ['down', 'up', 'none', 'sparse'], default: 'down', group: 'appearance', label: '位序号：down 按位权；up 从左数；sparse 只标 8 的倍数' },
      group: { type: 'enum', values: ['1', '4', '8'], default: '4', group: 'appearance', label: '分组' },
      sign: { type: 'bool', group: 'appearance', label: '标出符号位' },
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    content: 'text',
    capacity: { max: 16, unit: '位' },
  },

  /* ---------------------------------------------------------------- 图 */
  'vk-steps': {
    layer: 'diagram',
    name: '步骤',
    summary: '步骤条：编号 + 连线 + 当前步。容器窄时自动竖排，不压字。',
    attrs: {
      current: current(),
      direction: { type: 'enum', values: ['auto', 'horizontal', 'vertical'], default: 'auto', group: 'layout', label: '方向' },
      connector: { type: 'enum', values: ['arrow', 'line', 'none'], default: 'arrow', group: 'appearance', label: '连接线' },
      size: sizeData('body'),
      gap: gap('normal'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item({ tone: ITEM_TONE, state: ITEM_STATE, note: { type: 'text', label: '小字说明' } }, '每一步写成 <li>；可写 tone 标语义。'),
    capacity: { max: 5, unit: '步（横排）' },
  },

  'vk-bars': {
    layer: 'diagram',
    name: '条',
    summary: '一组横向条：标签、值、单位。用来讲大小对比；值只写数字。',
    attrs: {
      max: { type: 'num', min: 1, group: 'appearance', label: '最大值（不写按最大一条）' },
      unit: { type: 'text', group: 'appearance', label: '单位' },
      scale: { type: 'enum', values: ['linear', 'log'], default: 'linear', group: 'appearance', label: '刻度' },
      size: sizeData('body'),
      gap: gap('close'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item({ label: { type: 'text', label: '标签' }, value: { type: 'num', label: '数值' }, tone: ITEM_TONE, state: ITEM_STATE }, '<li value="120" label="hello.o">；值写数字，不写单位。'),
    capacity: { max: 6, unit: '条' },
  },

  'vk-timeline': {
    layer: 'diagram',
    name: '时间线',
    summary: '时间线：给了 at + start/end 就按比例摆，否则等距。一条事项一个 <li>。',
    attrs: {
      start: { type: 'num', group: 'content', label: '起点（数字，如 1963）' },
      end: { type: 'num', group: 'content', label: '终点' },
      current: current(),
      size: sizeData('body'),
      gap: gap('normal'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item(
      {
        at: { type: 'number', label: '位置（数字；配 start/end 按比例摆）' },
        date: { type: 'text', label: '日期标签（不写就用 at）' },
        label: { type: 'text', label: '标题' },
        note: { type: 'text', label: '小字说明' },
        tone: ITEM_TONE,
        state: ITEM_STATE,
      },
      '<li at="1972" label="C 诞生" note="小字说明">。'
    ),
    capacity: { max: 4, unit: '点' },
  },

  'vk-graph': {
    layer: 'diagram',
    name: '关系图',
    summary: '关系图：节点写成 <li id label>，边可以写在节点上（after="父id"），也可以写成独立子项（from/to，支持环、双向、边标）。row 链表/队列，tree 递归树/堆，layered DAG（git），mesh 环图（BFS/死锁/事件循环）。',
    attrs: {
      layout: { type: 'enum', values: ['row', 'tree', 'layered', 'mesh'], default: 'row', group: 'layout', label: '布局' },
      direction: { type: 'enum', values: ['horizontal', 'vertical'], default: 'horizontal', group: 'layout', label: '方向（只对 row）' },
      edge: { type: 'enum', values: ['arrow', 'line', 'none'], default: 'arrow', group: 'appearance', label: '连线' },
      gap: gap('normal'),
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item(
      {
        id: { type: 'text', label: '节点 id（边用它引用）' },
        label: { type: 'text', label: '节点文字；边上是边标' },
        note: { type: 'text', label: '节点下的小字' },
        after: { type: 'text', label: '父节点 id（空格分隔多个）' },
        lane: { type: 'int', min: 0, max: 9, label: 'layered 布局里放第几条泳道' },
        from: { type: 'text', label: '显式边的起点 id' },
        to: { type: 'text', label: '显式边的终点 id' },
        tone: ITEM_TONE,
        state: ITEM_STATE,
      },
      '<li id="a" label="head"> → <li id="b" label="next" after="a">；不写 after 的节点是根。显式边写成 <li from="a" to="b" label="next">，可以有环、双向、边标。'
    ),
    example: '<vk-graph layout="row"><li id="a" label="head"></li><li id="b" label="next" after="a"></li></vk-graph>',
    capacity: { max: 6, unit: '节点（一行）' },
  },

  'vk-seq': {
    layer: 'diagram',
    name: '时序',
    summary: '两条生命线之间的往返：一行一条消息，按阅读顺序从上往下。适合握手、请求/响应、缓存往返。',
    attrs: {
      a: { type: 'text', group: 'content', label: '左侧名称', required: true },
      b: { type: 'text', group: 'content', label: '右侧名称', required: true },
      current: current(),
      gap: gap('close'),
      size: sizeData('body'),
      span: FLOW_CHILD.span,
      bleed: { ...FLOW_CHILD.bleed, values: ['x'] },
    },
    children: item(
      {
        label: { type: 'text', label: '消息' },
        note: { type: 'text', label: '消息下的小字' },
        dir: { type: 'enum', values: ['right', 'left'], default: 'right', label: '方向' },
        tone: ITEM_TONE,
        state: ITEM_STATE,
      },
      '<li label="SYN" note="seq=x">（向右）；<li dir="left" label="SYN+ACK">（向左）。不写 label 就用标签里的文字。'
    ),
    example: '<vk-seq a="客户端" b="服务端"><li label="SYN"></li><li dir="left" label="SYN+ACK"></li><li label="ACK"></li></vk-seq>',
    capacity: { max: 4, unit: '条' },
  },

  /* ---------------------------------------------------------------- 关系 */
  'vk-callout': {
    layer: 'relation',
    name: '标注',
    summary: '画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标，note 是带引线的气泡，badge 是编号点。它不改布局。',
    attrs: {
      mode: { type: 'enum', values: ['arrow', 'ring', 'note', 'measure'], default: 'arrow', group: 'appearance', label: '形态' },
      for: { type: 'selector', group: 'target', label: '目标', when: { attr: 'mode', values: ['ring', 'note'] }, required: true },
      from: { type: 'selector', group: 'target', label: '起点', when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true },
      to: { type: 'selector', group: 'target', label: '终点', when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true },
      side: { type: 'enum', values: ['auto', 'top', 'right', 'bottom', 'left'], default: 'auto', group: 'layout', label: '优先贴哪一侧', when: { attr: 'mode', values: ['note'] } },
      gap: { type: 'space', default: 'normal', group: 'layout', label: '离目标的距离', when: { attr: 'mode', values: ['note'] } },
      shape: { type: 'enum', values: ['straight', 'ortho', 'curve'], default: 'curve', group: 'appearance', label: '连线形状', when: { attr: 'mode', values: ['arrow'] } },
      label: { type: 'text', group: 'target', label: '连线上的字', when: { attr: 'mode', values: ['arrow', 'measure'] } },
      tone: tone(TONE, 'info'),
    },
    content: 'text',
  },
};

export const TAG_NAMES = Object.keys(TAGS);

/** 一个标签自己的属性表：flow 子项属性 + 它自己声明的。 */
export function attrsOf(tag) {
  const t = TAGS[tag];
  if (!t) return {};
  if (tag === 'vk-page' || tag === 'vk-head' || tag === 'vk-callout') return { ...t.attrs };
  return { ...FLOW_CHILD, ...t.attrs };
}



/** 锚点只认三种部件：窗口里的第 N 行、第 N 个单元、某个元素的某一边。 */
export const ANCHOR_PARTS = ['line', 'item', 'bit', 'side'];

/** 一帧的最小骨架：AI 第一次写帧从这里抄。 */
export const SKELETON = `<vk-page>
  <vk-head kicker="第 1 集 · 主题" counter="1 / 8" size="subhead">一句<em>结论</em>。</vk-head>
  <vk-code lang="c" title="a.c">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
    </script>
  </vk-code>
  <vk-text size="body" ink="secondary">一句解释。</vk-text>
</vk-page>`;

