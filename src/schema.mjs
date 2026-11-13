/**
 * v24 · 公开契约
 * ----------------------------------------------------------------------------
 * 这份文件定义「哪个标签有哪个属性、默认值、取值范围、子节点怎么写、一帧放几行」。
 * 它是唯一来源：构建期校验、vk doc / vk brief、运行期默认值都读它。
 *
 * 规矩：
 *   · 属性名与取值只能来自 vocab.mjs；这里不发明数值。
 *   · 每件只做一件事；两件能画同一个东西 = 作者会选错 = 合并。
 *   · 一个概念一个词：theme（页明暗）/ surface（卡片材质）/ place（整块位置）/
 *     current（当前项，写在项上）/ tone（语义）/ size（字号）/ gap·span·bleed（排布）。
 *   · 没有时间维度：没有 at / cue / enter / duration（时间线里的 at 是坐标，不是播放）。
 *   · 可见文字写成元素内容；只有 kicker / counter / lede / note / date / value 走属性。
 */

import { TONE, THEME, CARD_SURFACE, INK, SIZE } from './vocab.mjs';

export const LAYERS = [
  { id: 'page', label: 'L0 画布' },
  { id: 'layout', label: 'L1 排布' },
  { id: 'surface', label: 'L2 面与字' },
  { id: 'content', label: 'L3 内容' },
  { id: 'diagram', label: 'L4 图' },
  { id: 'relation', label: 'L5 关系' },
];

/* ------------------------------------------------------------------ 共享
   span / bleed 是 flow 子项能力，不是某个件的属性。
   它们不出现在每个 tag 的 attrs 里，只在 flowChild 里声明一次。 */
export const FLOW_CHILD = {
  span: { type: 'int', min: 1, max: 12, group: 'layout', label: '跨几栏（只在 flow 子项）' },
  bleed: { type: 'enum', values: ['x'], group: 'layout', label: '出血到画布边（只在 flow 子项）' },
};

/* ------------------------------------------------------------------ 取值 */
const text = (group, label, extra = {}) => ({ type: 'text', group, label, ...extra });
const bool = (group, label, extra = {}) => ({ type: 'bool', group, label, ...extra });
const enumv = (values, def, group, label, extra = {}) => ({ type: 'enum', values, default: def, group, label, ...extra });
const int = (min, max, def, group, label, extra = {}) => ({ type: 'int', min, max, default: def, group, label, ...extra });
const num = (min, def, group, label, extra = {}) => ({ type: 'num', min, default: def, group, label, ...extra });
const space = (def, label = '分栏间距（档名或像素）') => ({ type: 'space', default: def, group: 'layout', label });
const lines = (label, extra = {}) => ({ type: 'lines', group: 'state', label, ...extra });
const range = (label, extra = {}) => ({ type: 'range', group: 'content', label, ...extra });
const selector = (group, label, extra = {}) => ({ type: 'selector', group, label, ...extra });
const cols = (def, label) => ({ type: 'cols', default: def, group: 'layout', label });
const tone = (values = TONE, def = 'neutral') => ({ type: 'enum', values, default: def, group: 'appearance', label: '语调' });
const currentItem = () => ({ type: 'bool', group: 'state', label: '当前项（写属性名，不写值）' });

const ITEM_TONE = { type: 'enum', values: TONE, default: 'neutral', group: 'appearance', label: '语调' };

/* ------------------------------------------------------------------ 子节点 */
const blocks = (hint) => ({ kind: 'blocks', hint });
const inline = (hint) => ({ kind: 'inline', hint });
const items = (attrs, hint) => ({ kind: 'items', item: 'li', attrs, hint });
const source = (hint) => ({ kind: 'source', hint });
const table = (hint) => ({ kind: 'table', hint });
const none = (hint) => ({ kind: 'none', hint });

/* ------------------------------------------------------------------ 标签 */
export const TAGS = {
  /* ---------------------------------------------------------------- 画布 */
  'vk-page': {
    layer: 'page',
    name: '画布',
    summary: '一帧 1920×1080 的坐标系。子项直接写，不用再包一层；place 决定标题带与正文在版心里的纵向位置。',
    attrs: {
      id: text('content', '帧名（出图文件名）'),
      place: enumv(['band', 'top', 'center', 'bottom'], 'band', 'layout', '竖排位置：band 标题带锁顶、正文居中；center 整块居中'),
      theme: enumv(THEME, 'light', 'appearance', '主题：light / dark'),
    },
    children: blocks('直接写 <vk-head> 与内容；下一层要分栏时写 <vk-flow>。'),
    example: '<vk-page place="band" theme="light">…</vk-page>',
  },

  'vk-head': {
    layer: 'page',
    name: '标题带',
    summary: '一帧的起手：眉标 + 标题 +（可选）一句为什么。它把标题带的位置与间距固定下来，帧与帧的标题不会跳。',
    attrs: {
      kicker: text('content', '眉标（集数 / 分类）'),
      counter: text('appearance', '序号，如 "3 / 8"（等宽，跟在眉标后）'),
      lede: text('content', '导语：这一帧的「为什么」'),
      size: enumv(['subhead', 'headline', 'display'], 'headline', 'type', '标题字号'),
      align: enumv(['left', 'center'], 'left', 'layout', '对齐'),
    },
    content: 'text',
    children: inline('标签里的文字就是标题，可以写 <mark> / <code> / <vk-math inline>。'),
    example: '<vk-head kicker="第 1 集 · 指针" counter="1 / 8" lede="一句为什么。">标题<mark>重点</mark></vk-head>',
  },

  /* ---------------------------------------------------------------- 排布 */
  'vk-flow': {
    layer: 'layout',
    name: '流',
    summary: '唯一的排布：列数（或比例、auto）由容器给，子项用 span 跨栏；overlay 让子项叠放；valign 管子项纵向对齐。不画任何东西。',
    attrs: {
      cols: cols('1', '列：1–12、比例 "1 2 1"、或 auto（按内容宽）'),
      gap: space('normal'),
      valign: enumv(['start', 'center', 'end', 'between', 'stretch'], 'stretch', 'layout', '子项纵向对齐'),
      overlay: bool('layout', '叠放：子项落在同一格里'),
    },
    children: blocks('子项直接写；span / bleed 只在这里生效。'),
    example: '<vk-flow cols="7 5" gap="wide"><vk-code …></vk-code><vk-text>右侧批注</vk-text></vk-flow>',
  },

  /* ------------------------------------------------------------ 面与字 */
  'vk-card': {
    layer: 'surface',
    name: '卡片',
    summary: '一块有材质的面：paper / soft / dark，边框、圆角、内距由库决定；可带标题栏。代码/终端/目录共用窗口皮。',
    attrs: {
      surface: enumv(CARD_SURFACE, 'paper', 'appearance', '材质：paper 白纸 / soft 软底 / dark 暗面'),
      title: text('appearance', '标题（写了才有标题带）'),
    },
    children: blocks('卡片里放块级内容；不要用卡片只为了分组，纯分组用 <vk-flow>。'),
    example: '<vk-card surface="paper" title="输出"><vk-text>一行说明。</vk-text></vk-card>',
  },

  'vk-text': {
    layer: 'surface',
    name: '文字',
    summary: '一段文字：字号、墨阶、对齐、行首图标。行内可用 <em> 强调、<strong> 加重、<mark> 标原文、<code> 行内代码、<kbd> 键位。',
    attrs: {
      size: { type: 'enum', values: SIZE, default: 'body', group: 'type', label: '字号' },
      ink: enumv(INK, 'primary', 'appearance', '墨阶'),
      align: enumv(['left', 'center', 'right'], 'left', 'layout', '对齐'),
      icon: text('appearance', '行首图标（Lucide 名）'),
    },
    content: 'text',
    children: inline('文字写在这里；块级内容请包 <vk-flow>。'),
    example: '<vk-text size="body" ink="secondary">一句解释。</vk-text>',
  },

  'vk-img': {
    layer: 'surface',
    name: '图片',
    summary: '一张图：比例、填充方式、焦点。默认完整显示（contain），要裁切得明说；bleed="all" 可整帧铺满当底。',
    attrs: {
      src: text('content', '图片地址'),
      alt: text('content', '替代文字（图坏了会显示）'),
      ratio: text('appearance', '比例，如 "16 / 9"'),
      fill: enumv(['cover', 'contain'], 'contain', 'appearance', '填充（cover 会裁掉超出的部分）'),
      position: text('appearance', '焦点', { default: '50% 50%' }),
    },
    children: none('图片标签里不写内容。'),
    example: '<vk-img src="shot.png" ratio="16 / 9" fill="cover" alt="截图"></vk-img>',
  },

  /* ---------------------------------------------------------------- 内容 */
  'vk-code': {
    layer: 'content',
    name: '源码窗',
    summary: '唯一的「源码窗」：as 选内容类型（源码 / 终端 / 改动 / 汇编）。构建期高亮或解析，运行期零依赖。',
    attrs: {
      as: enumv(['code', 'term', 'diff', 'asm'], 'code', 'content', '内容类型'),
      lang: text('content', '语言（as="code" / "diff" 用）', { when: { attr: 'as', values: ['code', 'diff'] } }),
      src: text('content', '源文件'),
      range: range('源文件行段，如 "4-6"（只接受单段；4- 表示到底）'),
      title: text('content', '标题栏文字（文件名 / 命令行）'),
      current: lines('当前行（窗口内第几行，1 起）'),
      fold: lines('折叠行（窗口内第几行）', { when: { attr: 'as', values: ['code'] } }),
      mark: text('state', '标出的词（窗口里所有出现处）', { when: { attr: 'as', values: ['code', 'diff'] } }),
      size: enumv(['caption', 'body'], 'body', 'type', '代码字号'),
      prompt: text('appearance', '终端提示符（as="term"）', { default: '$', when: { attr: 'as', values: ['term'] } }),
      hex: bool('appearance', '显示机器码列（as="asm"）', { when: { attr: 'as', values: ['asm'] } }),
    },
    example: '<vk-code lang="c" title="a.c" current="2"><script type="text/plain" data-vk-source>\nint a[3] = {1, 2, 3};\na[1]\n</script></vk-code>',
    children: source('src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。'),
  },

  'vk-table': {
    layer: 'content',
    name: '表格',
    summary: '原生 <table>：数字列自动右对齐、等宽数字；行可写 tone / current，单元格可写 current。',
    attrs: {
      caption: text('content', '表题（表上方一行小字）'),
    },
    example: '<vk-table caption="读一次要多久"><table><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100ns</td></tr><tr><td>L1</td><td>1ns</td></tr></table></vk-table>',
    children: table('写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err"，行/格可写 current。'),
  },

  'vk-list': {
    layer: 'content',
    name: '列表',
    summary: '列表：要点 / 清单 / 有序。条目写成 <li>；顺序本身就是信息时用 ordered。',
    attrs: {
      variant: enumv(['bullet', 'check', 'ordered'], 'bullet', 'appearance', '形态'),
    },
    children: items({ tone: ITEM_TONE, current: currentItem() }, '每一项写成 <li>；当前项写 current。'),
    example: '<vk-list><li>取首地址</li><li current>加下标 × 4</li></vk-list>',
  },

  'vk-dir': {
    layer: 'content',
    name: '目录树',
    summary: '目录层级：src 指向真实目录，构建期扫描；缩进与树线是真的。也可用内联 JSON 描述任意层级。',
    attrs: {
      src: text('content', '目录'),
      title: text('content', '标题栏文字'),
      depth: int(1, 6, 3, 'layout', '最大深度'),
      limit: int(1, 40, 6, 'layout', '最多显示几行（超了会留一行说明）'),
      current: text('state', '当前节点路径，如 "src/main.c"'),
    },
    children: source('src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。'),
    example: '<vk-dir><script type="text/plain" data-vk-tree>["src","README.md"]</script></vk-dir>',
  },

  'vk-math': {
    layer: 'content',
    name: '公式',
    summary: '公式：src 指向 .tex 或直接写 TeX，构建期用 KaTeX 排版，运行期零依赖。inline 写在句子里。',
    attrs: {
      src: text('content', '源文件'),
      inline: bool('appearance', '行内（跟在句子里）'),
      align: enumv(['left', 'center'], 'center', 'layout', '对齐'),
    },
    children: source('src 指向 .tex 文件；或把 TeX 直接写在标签里；或用 <script type="text/plain" data-vk-source>。'),
    example: '<vk-math>T(n) = 2T(n/2) + O(n)</vk-math>',
  },

  'vk-cells': {
    layer: 'content',
    name: '内存格',
    summary: '一格一个 <li>：值、标签、指针、旧值。地址由 addr + 序号 × stride 算出，不手写。',
    attrs: {
      addr: text('content', '起始地址，如 "0x1000"'),
      stride: int(1, 16, 1, 'content', '每格占几字节（int 数组写 4）'),
      cols: int(1, 8, 4, 'layout', '每行几格'),
    },
    children: items(
      {
        value: text('content', '值'),
        label: text('content', '标签'),
        ptr: text('content', '指针名，如 "lo"（空格分隔多个）'),
        was: text('content', '旧值（显示「旧 → 新」）'),
        tone: ITEM_TONE,
        current: currentItem(),
      },
      '<li value="61" label="s[0]" ptr="lo">；地址自动按 addr + 序号 × stride 算。'
    ),
    example: '<vk-cells addr="0x1000" stride="4"><li value="1" label="a[0]"></li><li value="2" label="a[1]" current></li></vk-cells>',
  },

  'vk-bytes': {
    layer: 'content',
    name: '字节',
    summary: '字节窗：src 指向真实二进制；地址 + 十六进制 + ASCII 三列，current 标出一段。',
    attrs: {
      src: text('content', '二进制文件'),
      addr: text('content', '起始地址', { default: '0x0' }),
      offset: int(0, 65535, 0, 'content', '起始字节'),
      length: int(1, 4096, 32, 'content', '字节数'),
      cols: enumv(['4', '8'], '8', 'layout', '每行几列'),
      current: lines('当前字节段，如 "4-7"（1 起）'),
      title: text('content', '标题栏文字'),
    },
    children: source('src 指向真实二进制文件；也可以内联十六进制（68 65 6c 6c 6f）。'),
    example: '<vk-bytes><script type="text/plain" data-vk-source>68 65 6c 6c 6f</script></vk-bytes>',
  },

  'vk-bits': {
    layer: 'content',
    name: '位',
    summary: '一行二进制位：索引、分段、符号位。用 | 分段（符号 | 阶码 | 尾数），field-labels 给每段起名。',
    attrs: {
      value: text('content', '位串，可含空格；用 | 分段'),
      current: lines('当前位段，如 "4-7"（1 起，从左数）'),
      label: text('appearance', '左边一行说明'),
      'field-labels': text('appearance', '各段名，逗号分隔（个数要与 | 的段数一致）'),
      index: enumv(['down', 'up', 'none', 'sparse'], 'down', 'appearance', '位序号：down 按位权；up 从左数；sparse 只标 8 的倍数'),
      sign: bool('appearance', '标出符号位'),
    },
    children: none('位串写在 value 属性里。'),
    example: '<vk-bits value="0|01111|0000000000" field-labels="符号,阶码,尾数" current="2-6"></vk-bits>',
  },

  /* ---------------------------------------------------------------- 图 */
  'vk-steps': {
    layer: 'diagram',
    name: '步骤',
    summary: '步骤条：编号 + 连线 + 当前步。容器窄时自动竖排，不压字。',
    attrs: {
      direction: enumv(['auto', 'horizontal', 'vertical'], 'auto', 'layout', '方向'),
    },
    children: items({ tone: ITEM_TONE, note: text('content', '小字说明'), icon: text('content', '步骤图标（Lucide 名）'), current: currentItem() }, '每一步写成 <li>；当前步写 current。'),
    example: '<vk-steps><li icon="file-code">预处理</li><li icon="cpu" current>编译</li><li icon="link">链接</li></vk-steps>',
  },

  'vk-bars': {
    layer: 'diagram',
    name: '条',
    summary: '一组横向条：标签、值、单位。用来讲大小对比；值只写数字。',
    attrs: {
      max: num(1, undefined, 'appearance', '最大值（不写按最大一条）'),
      unit: text('appearance', '单位'),
      scale: enumv(['linear', 'log'], 'linear', 'appearance', '刻度'),
    },
    children: items({ value: { type: 'num', min: 0, group: 'content', label: '数值' }, tone: ITEM_TONE, current: currentItem() }, '<li value="120">hello.o</li>；值写数字，不写单位。当前条写 current。'),
    example: '<vk-bars unit="ms"><li value="6">解析</li><li value="24" current>链接</li></vk-bars>',
  },

  'vk-timeline': {
    layer: 'diagram',
    name: '时间线',
    summary: '时间线：给了 at + start/end 就按比例摆，否则等距。一条事项一个 <li>。',
    attrs: {
      start: num(undefined, undefined, 'content', '起点（数字，如 1963）'),
      end: num(undefined, undefined, 'content', '终点'),
    },
    children: items(
      {
        at: { type: 'num', group: 'content', label: '位置（数字；配 start/end 按比例摆）' },
        date: text('content', '日期标签（不写就用 at）'),
        note: text('content', '小字说明'),
        icon: text('content', '节点图标（Lucide 名）'),
        tone: ITEM_TONE,
        current: currentItem(),
      },
      '<li at="1972">C 诞生</li>；当前点写 current。'
    ),
    example: '<vk-timeline start="1963" end="2010"><li at="1963">ASCII</li><li at="2010" icon="smile" current>Emoji</li></vk-timeline>',
  },

  'vk-graph': {
    layer: 'diagram',
    name: '关系图',
    summary: '关系图：节点写成 <li id>文字</li>，边可以写在节点上（after="父id"），也可以写成独立子项（from/to，支持环、双向、边标）。row 链表/队列，tree 递归树/堆，layered DAG（git），mesh 环图（BFS/死锁/事件循环）。',
    attrs: {
      layout: enumv(['row', 'tree', 'layered', 'mesh'], 'row', 'layout', '布局'),
      direction: enumv(['horizontal', 'vertical'], 'horizontal', 'layout', '方向（只对 row）', { when: { attr: 'layout', values: ['row'] } }),
    },
    children: items(
      {
        id: text('content', '节点 id（边用它引用）'),
        note: text('content', '节点下的小字'),
        after: text('content', '父节点 id（空格分隔多个）'),
        lane: int(0, 9, undefined, 'layout', 'layered 布局里放第几条泳道'),
        from: text('content', '显式边的起点 id'),
        to: text('content', '显式边的终点 id'),
        tone: ITEM_TONE,
        current: currentItem(),
      },
      '<li id="a">head</li> → <li id="b" after="a">next</li>；不写 after 的节点是根。显式边写成 <li from="a" to="b">next</li>。'
    ),
    example: '<vk-graph layout="row"><li id="a">head</li><li id="b" after="a">next</li></vk-graph>',
  },

  'vk-seq': {
    layer: 'diagram',
    name: '时序',
    summary: '两条以上生命线之间的往返：一行一条消息，按阅读顺序从上往下。2–4 个参与者，适合握手、请求/响应、缓存往返。',
    attrs: {
      participants: text('content', '参与者，逗号分隔，如 "客户端,服务端,缓存"（2–4 个）'),
      a: text('content', '左端名称（只有两条泳道时用）'),
      b: text('content', '右端名称（只有两条泳道时用）'),
    },
    children: items(
      {
        from: text('content', '起点（参与者名或 1 起的序号）'),
        to: text('content', '终点（参与者名或 1 起的序号）'),
        direction: enumv(['right', 'left'], 'right', 'layout', '方向（两条泳道时用）'),
        note: text('content', '消息下的小字'),
        tone: ITEM_TONE,
        current: currentItem(),
      },
      '<li>SYN</li>；<li direction="left">SYN+ACK</li>；三条以上用 from/to="客户端" / "服务端"。'
    ),
    example: '<vk-seq a="客户端" b="服务端"><li>SYN</li><li direction="left">SYN+ACK</li><li>ACK</li></vk-seq>',
  },

  /* ---------------------------------------------------------------- 关系 */
  'vk-callout': {
    layer: 'relation',
    name: '标注',
    summary: '画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标，note 是带引线的气泡，measure 量两点之间。它不改布局。',
    attrs: {
      mode: enumv(['arrow', 'ring', 'note', 'measure'], 'arrow', 'appearance', '形态'),
      for: selector('target', '目标', { when: { attr: 'mode', values: ['ring', 'note'] }, required: true }),
      from: selector('target', '起点', { when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true }),
      to: selector('target', '终点', { when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true }),
      label: text('target', '连线上的字', { when: { attr: 'mode', values: ['arrow', 'measure'] } }),
      tone: tone(TONE, 'info'),
    },
    content: 'text',
    children: inline('note 的文字写在这里；label 是连线上的字。'),
    example: '<vk-callout mode="note" for="#c@line:2">这里改了 0 号字节</vk-callout>',
  },
};

export const TAG_NAMES = Object.keys(TAGS);

/** 一个标签自己的属性表；span / bleed 不在里面，见 FLOW_CHILD。 */
export function attrsOf(tag) {
  const t = TAGS[tag];
  return t ? { ...t.attrs } : {};
}

/** 可以作为 flow 子项的标签（page / head / callout 除外）。 */
export const FLOW_CHILD_TAGS = TAG_NAMES.filter((t) => t !== 'vk-page' && t !== 'vk-head' && t !== 'vk-callout');

/** 锚点只认四种部件：窗口里的第 N 行、第 N 个单元、第 N 位、某个元素的某一边。 */
export const ANCHOR_PARTS = ['line', 'item', 'bit', 'side'];

/** 一帧的最小骨架：AI 第一次写帧从这里抄。 */
export const SKELETON = `<vk-page>
  <vk-head kicker="第 1 集 · 主题" counter="1 / 8">一句<mark>结论</mark>。</vk-head>
  <vk-code lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
    </script>
  </vk-code>
  <vk-text ink="secondary">一句解释。</vk-text>
</vk-page>`;

/** 契约顶部印的几条硬规则；不再只藏在 GUIDE 里。 */
export const RULES = [
  '可见文字写成元素内容；kicker / counter / lede / note / date / value 才是属性。',
  'current 写在项上（布尔）；code / bytes / bits 用行段，dir 用路径。',
  '用 lede 写“为什么看这里”，正文里的重点用 mark。',
  'src 载体：code 用 data-vk-source，math 写 TeX，bytes 写十六进制，dir 用 data-vk-tree。',
  '主题：page theme="light|dark"；card surface="paper|soft|dark"。',
  'span / bleed 只写在 <vk-flow> 的直接子项上；bleed="all" 只给 <vk-img>。',
];
