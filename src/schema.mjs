/**
 * v27 · 公开契约
 * ----------------------------------------------------------------------------
 * 全库只有这一份契约：哪个标签、哪个变体、有哪些属性、默认值、子节点怎么写。
 * 构建期校验、vk doc / vk brief 全部从这里生成，不许手抄第二份。
 *
 * 十三个标签，两类：
 *   结构件   page / head / flow / text / card / img / callout
 *   机制件   code / board / graph / dir / seq / math
 * 机制件用 as 选变体——as 是全库唯一的「选一种画法」。
 *
 * 规矩：
 *   · 一个概念一个词：theme（页明暗）/ surface（面材质）/ place（整块位置）/
 *     band（标题带锁）/ current（源码行或数据段）/ tone（语义）/ size（字号）/
 *     span·bleed（排布）。
 *   · 默认值负责「不静默错」：写错的形状由库兜成最接近的正确形状，并报一条可读事实。
 *   · 可见文字写成元素内容；属性只放元信息（kicker / counter / lede / note / date /
 *     value / label / 窗口标题 / 表题 / 单位 / 目录名 / alt）。
 *   · 没有时间维度：不做 at / cue / enter / duration（时间线里的 at 是坐标）。
 */

import { TONE, THEME, CARD_SURFACE, INK, SIZE, CANVAS, CONTENT, PHONE_W } from './vocab.mjs';
import { ANN } from './shared/connector.mjs';

export const LAYERS = [
  { id: 'page', label: 'L0 画布' },
  { id: 'layout', label: 'L1 排布' },
  { id: 'surface', label: 'L2 面与字' },
  { id: 'mechanism', label: 'L3 机制' },
  { id: 'relation', label: 'L4 标注' },
];

/* ------------------------------------------------------------------ 共享
   span 是 flow 子项能力，不是某个件的属性；bleed 只属于 vk-img。 */
export const FLOW_CHILD = {
  span: { type: 'int', min: 1, max: 12, group: 'layout', label: '跨几栏（只在 flow 子项）' },
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
const colsType = (def, label) => ({ type: 'cols', default: def, group: 'layout', label });
const currentItem = () => ({ type: 'bool', group: 'state', label: '当前项（写属性名，不写值）' });
const ITEM_TONE = { type: 'enum', values: TONE, default: 'neutral', group: 'appearance', label: '语义' };

/* ------------------------------------------------------------------ 子节点 */
const blocks = (hint) => ({ kind: 'blocks', hint });
const inline = (hint) => ({ kind: 'inline', hint });
const items = (attrs, hint) => ({ kind: 'items', item: 'li', attrs, hint });
const source = (hint) => ({ kind: 'source', hint });
const table = (hint) => ({
  kind: 'table',
  hint,
  /* <tr> 能写的属性 */
  attrs: { tone: ITEM_TONE, current: { type: 'bool', group: 'state', label: '当前行（写属性名）' } },
  /* <td>/<th> 能写的属性；单元格 tone 让 DP 表、哈希桶、流水线矩阵能上色 */
  cellAttrs: {
    tone: ITEM_TONE,
    align: enumv(['left', 'center', 'right'], 'left', 'layout', '单元格对齐'),
    current: { type: 'bool', group: 'state', label: '当前格（写属性名）' },
    colspan: int(1, 12, undefined, 'layout', '跨几列'),
    rowspan: int(1, 12, undefined, 'layout', '跨几行'),
  },
});
const none = (hint) => ({ kind: 'none', hint });

/* ------------------------------------------------------------------ 变体 */
const variant = (label, summary, attrs, children, example) => ({ label, summary, attrs, children, example });
const asEnum = (variants, def, extra = {}) =>
  enumv(Object.keys(variants), def, 'content', '画法（全库唯一的调度词）', extra);

/* 文本网格共用的一组窗口属性：只写一次，六个变体只写自己的 delta。 */
const WIN = {
  src: text('content', '源文件（相对页面）'),
  range: range('源文件行段，如 "4-6"；只接受单段，4- 表示到底'),
  current: lines('当前：源码行号，1 起（可写 "4-6"）'),
  size: enumv(['caption', 'body'], 'body', 'type', '字号'),
};
const MARK = { mark: text('state', '标出的词；逗号分隔多个，按词边界匹配') };

/* ------------------------------------------------------------------ 标签 */
const CODE_VARIANTS = {
  code: variant('源码', '真实源码：语法高亮、行号、当前行、折叠、标词。', {
    ...WIN,
    ...MARK,
    lang: text('content', '语言，如 c / js / py；src= 时从扩展名推断'),
    fold: lines('折叠行（源码行号，1 起）'),
  }, source('src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。'),
    '<vk-code lang="c" title="a.c" current="2"><script type="text/plain" data-vk-source>\nint a[3] = {1, 2, 3};\na[1] = 7;\n</script></vk-code>'),
  term: variant('终端', '命令与输出：提示符、命令、输出各自一色。', {
    ...WIN,
    prompt: text('appearance', '提示符', { default: '$' }),
  }, source('src 指向 .txt/.log，或内联 <script type="text/plain" data-vk-source>。'),
    '<vk-code as="term" title="bash"><script type="text/plain" data-vk-source>\n$ cc hello.c -o hello\n$ ./hello\nhello\n</script></vk-code>'),
  diff: variant('改动', '一段 diff：增删行、hunk 头、标词。', {
    ...WIN,
    ...MARK,
  }, source('src 指向 .diff，或内联 <script type="text/plain" data-vk-source>。'),
    '<vk-code as="diff" title="a.c"><script type="text/plain" data-vk-source>\n- a[1] = 7;\n+ a[1] = 8;\n</script></vk-code>'),
  asm: variant('汇编', '汇编清单：地址、机器码、助记符、操作数。', {
    ...WIN,
    ...MARK,
    fold: lines('折叠行（源码行号，1 起）'),
    hex: bool('appearance', '显示机器码列（写属性名即开）'),
    addr: enumv(['on', 'off'], 'on', 'appearance', '地址列（off 可省一列）'),
  }, source('src 指向 objdump 输出，或内联 <script type="text/plain" data-vk-source>。'),
    '<vk-code as="asm" hex current="2" size="caption"><script type="text/plain" data-vk-source>\n1004: 48 89 f8 mov %rdi,%rax\n1007: 48 01 f0 add %rsi,%rax\n</script></vk-code>'),
  bytes: variant('字节', '十六进制转储：地址 + 十六进制 + ASCII 三列。', {
    src: text('content', '二进制文件'),
    addr: text('content', '起始地址', { default: '0x0' }),
    offset: int(0, 65535, 0, 'content', '起始字节'),
    length: int(1, 4096, 16, 'content', '字节数'),
    cols: enumv(['4', '6', '8'], '8', 'layout', '每行几列'),
    current: lines('当前字节段，如 "4-7"（字节序号，1 起）'),
  }, source('src 指向二进制；也可内联十六进制（68 65 6c 6c 6f）。'),
    '<vk-code as="bytes" title="hello.bin" current="1-3"><script type="text/plain" data-vk-source>\n68 65 6c 6c 6f\n</script></vk-code>'),
  bits: variant('位', '一行二进制位：索引、分段、符号位。用 | 分段，fields 给每段起名。', {
    value: text('content', '位串（只含 0/1），可含空格；用 | 分段', { required: true }),
    current: lines('当前位段，如 "4-7"（1 起，从左数）'),
    caption: text('appearance', '左边一行说明'),
    fields: text('appearance', '各段名，逗号分隔（个数要与 | 的段数一致）'),
    index: enumv(['weight', 'order', 'none', 'sparse'], 'weight', 'appearance', '位序号：weight 按位权（右起 0）；order 从左数'),
    sign: bool('appearance', '标出符号位'),
  }, none('位串写在 value 属性里。'),
    '<vk-code as="bits" value="0|01111|0000000000" fields="符号,阶码,尾数" current="2-6"></vk-code>'),
};

const BOARD_VARIANTS = {
  list: variant('列表', '要点 / 清单：一项一个 <li>，可带右侧小字。', {},
    items({ tone: ITEM_TONE, note: text('content', '右侧小字（值 / 地址 / 单位）'), current: currentItem() }, '每一项写成 <li>；当前项写 current。'),
    '<vk-board><li note="a">取首地址</li><li current note="a + i × 4">加下标 × 4</li></vk-board>'),
  steps: variant('步骤', '编号 + 连线 + 当前步。容器窄时自动竖排。', {
    direction: enumv(['auto', 'horizontal', 'vertical'], 'auto', 'layout', '方向'),
  }, items({ tone: ITEM_TONE, note: text('content', '小字说明'), current: currentItem() }, '每一步写成 <li>；当前步写 current。'),
    '<vk-board as="steps"><li>预处理</li><li current>编译</li></vk-board>'),
  bars: variant('条', '一组横向条：标签、值、单位。值只写数字。', {
    max: num(1, undefined, 'appearance', '最大值（不写按最大一条）'),
    unit: text('appearance', '单位'),
    scale: enumv(['linear', 'log'], 'linear', 'appearance', '刻度'),
  }, items({ value: { type: 'num', min: 0, group: 'content', label: '数值' }, tone: ITEM_TONE, current: currentItem() }, '<li value="120">hello.o</li>；值写数字，不写单位。'),
    '<vk-board as="bars" unit="ms"><li value="6">解析</li><li value="24" current>链接</li></vk-board>'),
  timeline: variant('时间线', '一条轴上的点：给了 at + start/end 就按比例摆，否则等距。', {
    start: num(undefined, undefined, 'content', '起点（数字，如 1963）'),
    end: num(undefined, undefined, 'content', '终点'),
  }, items({ at: { type: 'num', group: 'content', label: '位置（数字）' }, date: text('content', '日期标签（不写就用 at）'), note: text('content', '小字说明'), tone: ITEM_TONE, current: currentItem() }, '<li at="1972">C 诞生</li>；当前点写 current。'),
    '<vk-board as="timeline" start="1963" end="2010"><li at="1963">ASCII</li><li at="2010" current>Emoji</li></vk-board>'),
  table: variant('表格', '原生 <table>：数字列自动右对齐、等宽数字；行可写 tone / current。', {},
    table('写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err"、current；表题用 <caption>。'),
    '<vk-board as="table"><table><caption>读一次要多久</caption><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100ns</td></tr></table></vk-board>'),
  cells: variant('内存格', '一格一个 <li>：值、标签、指针、旧值。地址由 addr + 序号 × stride 算出。', {
    addr: text('content', '起始地址，如 "0x1000"（写了就必须写 stride）'),
    stride: int(1, 16, undefined, 'content', '每格占几字节（int 数组写 4）'),
    cols: int(1, 8, 4, 'layout', '每行几格'),
  }, items({ value: text('content', '值'), label: text('content', '标签'), ptr: text('content', '指针名，如 "lo"（一个词）'), was: text('content', '旧值（显示「旧 → 新」）'), tone: ITEM_TONE, current: currentItem() }, '<li value="61" label="s[0]" ptr="lo">；地址自动算。'),
    '<vk-board as="cells" addr="0x1000" stride="4"><li value="1" label="a[0]"></li><li value="2" label="a[1]" current></li></vk-board>'),
  band: variant('区间', '一条轴上的有起止的横条：时间片、ELF 段、地址空间、流水线。', {
    start: num(undefined, undefined, 'content', '数据域起点'),
    end: num(undefined, undefined, 'content', '数据域终点'),
    unit: text('appearance', '单位'),
    lane: bool('layout', '按下标分泳道（一条一条上下排）'),
  }, items({
    start: { type: 'num', group: 'content', label: '起点（数字）' },
    end: { type: 'num', group: 'content', label: '终点（数字）' },
    label: text('content', '条上/条左的字（不写就用正文）'),
    note: text('content', '右侧小字'),
    tone: ITEM_TONE,
    current: currentItem(),
  }, '一条 <li> 一段：start / end 写数字；正文是这一段的名字。'),
    '<vk-board as="band" start="0" end="16" unit="ms"><li start="0" end="3">读文件</li><li start="3" end="9" current>计算</li></vk-board>'),
  frames: variant('栈帧', '一摞栈帧，每帧一行字段；direction="up" 表示向低地址生长。', {
    direction: enumv(['down', 'up'], 'down', 'layout', '栈的生长方向（up 画「向下长」的轴）'),
    'top-label': text('appearance', '栈顶那一行说明，如「栈顶（低地址）」'),
  }, items({ title: text('content', '帧名，如 f(2)（不写就用正文首行）'), note: text('content', '右侧小字（返回地址 / 说明）'), tone: ITEM_TONE, current: currentItem() }, '一帧一个 <li>；正文写 1–2 个字段，用 <br> 分行。'),
    '<vk-board as="frames" direction="up" top-label="栈顶（低地址）"><li title="f(2)" note="返回 0x4012" current>n = 2</li><li title="main" note="返回 0">argc = 1</li></vk-board>'),
};

const GRAPH_VARIANTS = {
  row: variant('横排', '一条链：节点横着排，边从左到右。', {},
    items({ id: text('content', '节点 id（边用它引用）'), note: text('content', '节点下的小字'), after: text('content', '父节点 id（空格分隔多个）'), from: text('content', '显式边的起点'), to: text('content', '显式边的终点'), edge: text('content', '边标签（配合单个 after）'), tone: ITEM_TONE, current: currentItem() }, '<li id="a">head</li> → <li id="b" after="a">next</li>；不写 after 的节点是根。'),
    '<vk-graph><li id="a">head</li><li id="b" after="a">next</li></vk-graph>'),
  tree: variant('树', '按 after 分层：父在上，子在下，宽了压行距不缩字。', {},
    items({ id: text('content', '节点 id'), note: text('content', '节点下的小字'), after: text('content', '父节点 id（空格分隔多个）'), edge: text('content', '边标签（配合单个 after）'), tone: ITEM_TONE, current: currentItem() }, '用 after 指父节点；没有 after 的是根。'),
    '<vk-graph as="tree"><li id="a">f(4)</li><li id="b" after="a">f(2)</li><li id="c" after="a">f(2)</li></vk-graph>'),
  layered: variant('泳道', '按 lane 分泳道、按 after 分层：流水线、协议栈、分支。', {},
    items({ id: text('content', '节点 id'), note: text('content', '节点下的小字'), after: text('content', '父节点 id'), lane: int(0, 9, undefined, 'layout', '第几条泳道（0 起）'), edge: text('content', '边标签'), tone: ITEM_TONE, current: currentItem() }, 'lane 定上下、after 定左右。'),
    '<vk-graph as="layered"><li id="a" lane="0">提交</li><li id="b" after="a" lane="1">构建</li></vk-graph>'),
  mesh: variant('环', '任意有向边：持有/等待、死锁、状态机；环上均匀摆放。', {},
    items({ id: text('content', '节点 id'), note: text('content', '节点下的小字'), from: text('content', '边的起点'), to: text('content', '边的终点'), edge: text('content', '边标签'), tone: ITEM_TONE, current: currentItem() }, '用独立 <li from to edge> 写边；节点自身写 id。'),
    '<vk-graph as="mesh"><li id="p1">P1</li><li id="p2">P2</li><li id="r1">R1</li><li from="p1" to="r1" edge="等待"></li></vk-graph>'),
};

const CALLOUT_VARIANTS = {
  note: variant('注记', '在正文右侧的注栏里说一句，并画标记 + 连接。', {
    target: selector('target', '目标', { required: true }),
  }, inline('注记的文字写在这里；一句话，尽量 15 字以内。'),
    '<vk-callout target="#c@line:2">写进第二个 int。</vk-callout>'),
  mark: variant('标记', '只画标记，不写字：词用框、行用一道、块用框。', {
    target: selector('target', '目标', { required: true }),
  }, none('标记不带文字。'),
    '<vk-callout as="mark" target="#c@line:2"></vk-callout>'),
  arrow: variant('指针', '从一个件指到另一个件，可带一句标签。', {
    from: selector('target', '起点', { required: true }),
    to: selector('target', '终点', { required: true }),
    label: text('target', '线上的字'),
  }, none('箭头不带正文文字，标签写 label。'),
    '<vk-callout as="arrow" from="#c@line:2" to="#m@item:2" label="写进这里"></vk-callout>'),
  measure: variant('量度', '量两个目标的同一条边，标出距离。', {
    from: selector('target', '起点', { required: true }),
    to: selector('target', '终点', { required: true }),
    label: text('target', '量出来的字，如 "4 字节"'),
  }, none('量度不带正文文字。'),
    '<vk-callout as="measure" from="#m@item:1" to="#m@item:4" label="12 字节"></vk-callout>'),
  jump: variant('跳转', '同一段代码里从一行跳到另一行：回边、if、break。最多 3 条。', {
    from: selector('target', '起点行', { required: true }),
    to: selector('target', '终点行', { required: true }),
    label: text('target', '线上的字，如 "i++"'),
  }, none('跳转不带正文文字。'),
    '<vk-callout as="jump" from="#c@line:2" to="#c@line:6" label="下一轮"></vk-callout>'),
};

export const TAGS = {
  /* ---------------------------------------------------------------- 画布 */
  'vk-page': {
    layer: 'page',
    name: '画布',
    summary: '一帧 1920×1080 的坐标系。子项直接写，不用再包一层；place 决定纵向位置，band 让同一文件里的多帧共用一条标题带。',
    attrs: {
      place: enumv(['band', 'top', 'center', 'bottom'], 'band', 'layout', '整块位置：band 标题带锁顶、正文居中；center 整块居中（封面）'),
      theme: enumv(THEME, 'light', 'appearance', '主题：light / dark'),
      band: enumv(['auto', 'lock'], 'auto', 'layout', 'lock：同一文件里所有帧的标题带对齐到最高那一帧（视频不跳）'),
    },
    children: blocks('直接写 <vk-head> 与内容；下一层要分栏时写 <vk-flow>。'),
    example: '<vk-page place="band" theme="light"><vk-head>一句标题。</vk-head><vk-text>正文。</vk-text></vk-page>',
  },

  'vk-head': {
    layer: 'page',
    name: '标题带',
    summary: '一帧的起手：眉标 + 标题 +（可选）一句为什么。位置与间距固定。',
    attrs: {
      kicker: text('content', '眉标（集数 / 分类）'),
      counter: text('content', '序号，如 "3 / 8"（等宽，跟在眉标后）'),
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
    summary: '唯一的排布：列数用 cols，比例用 split，子项用 span 跨栏；overlay 叠放；valign 管子项纵向。不画任何东西。',
    attrs: {
      cols: colsType('1', '列数：1–12，或 auto（按内容宽）'),
      split: text('layout', '比例，如 "7 5"（等价 7fr 5fr）；和 cols 二选一'),
      gap: space('normal'),
      valign: enumv(['start', 'center', 'end', 'distribute', 'stretch'], 'stretch', 'layout', '子项纵向对齐'),
      overlay: bool('layout', '叠放：子项落在同一格里'),
    },
    children: blocks('子项直接写；span 只在这里生效。'),
    example: '<vk-flow split="7 5" gap="wide" valign="start"><vk-text>左栏。</vk-text><vk-text>右栏。</vk-text></vk-flow>',
  },

  /* ------------------------------------------------------------ 面与字 */
  'vk-card': {
    layer: 'surface',
    name: '卡片',
    summary: '一块有材质的面。边框、内距由库决定；可带标题栏。',
    attrs: {
      surface: enumv(CARD_SURFACE, 'auto', 'appearance', '材质：auto 跟随页面 / paper 白纸 / soft 软底 / raised 抬起面'),
      title: text('appearance', '标题（写了才有标题带）'),
      tone: enumv(TONE, 'neutral', 'appearance', '语义：8px 左规 + 语义色标题/描边'),
    },
    children: blocks('卡片里放块级内容；纯分组用 <vk-flow>，卡片是「一块面」。'),
    example: '<vk-card surface="paper" title="输出"><vk-text>一行说明。</vk-text></vk-card>',
  },

  'vk-text': {
    layer: 'surface',
    name: '文字',
    summary: '一段文字：字号、墨阶、对齐。行内可用 <em> 强调、<strong> 加重、<mark> 标原文、<code> 行内代码、<kbd> 键位。',
    attrs: {
      size: { type: 'enum', values: SIZE, default: 'body', group: 'type', label: '字号' },
      ink: enumv(INK, 'primary', 'appearance', '墨阶'),
      align: enumv(['left', 'center', 'right'], 'left', 'layout', '对齐'),
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
      src: text('content', '图片地址', { required: true }),
      alt: text('content', '替代文字（图坏了会显示）'),
      aspect: text('appearance', '比例，如 "16 / 9" 或 "16:9"'),
      fit: enumv(['contain', 'cover'], 'contain', 'appearance', '填充（cover 会裁掉超出的部分）'),
      focus: text('appearance', '焦点，如 "50% 50%"', { default: '50% 50%' }),
      bleed: enumv(['x', 'all'], undefined, 'layout', '出血：x 横向出血（只在 flow 子项）；all 整帧铺满（只在 page 第一层）'),
    },
    children: none('图片标签里不写内容。'),
    example: '<vk-img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'9\'%3E%3Crect width=\'16\' height=\'9\' fill=\'%23dbeafe\'/%3E%3C/svg%3E" aspect="16 / 9" alt="示例图"></vk-img>',
  },

  /* ---------------------------------------------------------------- 机制 */
  'vk-code': {
    layer: 'mechanism',
    name: '文本网格',
    summary: '等宽文本的网格：源码、终端、改动、汇编、字节、位。构建期高亮/解析，运行期零依赖。用 as 选一种。',
    attrs: {
      as: asEnum(CODE_VARIANTS, 'code'),
      title: text('content', '标题栏文字（文件名 / 命令行）'),
    },
    variants: CODE_VARIANTS,
  },

  'vk-board': {
    layer: 'mechanism',
    name: '条目图',
    summary: '把条目排成一张图：要点、步骤、条、时间线、表格、内存格、区间、栈帧。一个 <li> 一项；用 as 选一种。',
    attrs: {
      as: asEnum(BOARD_VARIANTS, 'list'),
    },
    variants: BOARD_VARIANTS,
  },

  'vk-graph': {
    layer: 'mechanism',
    name: '关系图',
    summary: '节点写成 <li id>文字</li>，边写在节点上（after="父id"）或写成独立子项（from/to，支持环、双向、边标）。写 after 自动按树排，写 lane 自动按泳道排，写 from/to 自动按环排。',
    attrs: {
      as: asEnum(GRAPH_VARIANTS, 'row', { infer: true }),
    },
    variants: GRAPH_VARIANTS,
  },

  'vk-dir': {
    layer: 'mechanism',
    name: '目录树',
    summary: '目录层级：src 指向真实目录，构建期扫描；也可用内联 JSON 描述任意层级。',
    attrs: {
      src: text('content', '目录'),
      title: text('content', '标题栏文字'),
      limit: int(1, 40, 8, 'layout', '最多显示几行（超了留一行「还有 N 项」）'),
      current: text('state', '当前节点路径，如 "src/main.c"'),
    },
    children: source('src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。'),
    example: '<vk-dir><script type="text/plain" data-vk-tree>[{"name":"src","children":[{"name":"main.c"}]}]</script></vk-dir>',
  },

  'vk-seq': {
    layer: 'mechanism',
    name: '时序',
    summary: '两条以上生命线之间的往返：一行一条消息，按阅读顺序从上往下。2–4 个参与者；不写 participants 时从下标推断。',
    attrs: {
      participants: text('content', '参与者，逗号分隔，如 "客户端,服务端,缓存"（不写则从 from/to 推断；两条默认 A/B）'),
    },
    children: items(
      { from: text('content', '起点（参与者名或 1 起的序号；不写按上一条的方向交替）'), to: text('content', '终点（同上）'), note: text('content', '消息下的小字'), tone: ITEM_TONE, current: currentItem() },
      '<li>SYN</li>；<li from="服务端" to="客户端">SYN+ACK</li>；两条泳道时省略 from/to 即左右交替。'
    ),
    example: '<vk-seq participants="客户端,服务端"><li>SYN</li><li>S​YN+ACK</li><li>ACK</li></vk-seq>',
  },

  'vk-math': {
    layer: 'mechanism',
    name: '公式',
    summary: '公式：src 指向 .tex 或直接写 TeX，构建期用 KaTeX 排版，运行期零依赖。放在文字里自动行内。',
    attrs: {
      src: text('content', '源文件'),
      align: enumv(['left', 'center'], 'center', 'layout', '对齐（块公式）'),
    },
    children: source('src 指向 .tex 文件；或把 TeX 直接写在标签里。'),
    example: '<vk-math>T(n) = 2T(n/2) + O(n)</vk-math>',
  },

  /* ---------------------------------------------------------------- 关系 */
  'vk-callout': {
    layer: 'relation',
    name: '标注',
    summary: '画在别人身上的一层：标记（按目标形状画框/线/括号）、注记（右侧注栏说一句）、指针（件到件）、量度（两点之间）、跳转（代码行到行）。',
    attrs: {
      as: asEnum(CALLOUT_VARIANTS, 'note', { infer: true }),
    },
    variants: CALLOUT_VARIANTS,
    content: 'text',
  },
};

export const TAG_NAMES = Object.keys(TAGS);

/** 当前节点的变体名：有 as 用 as，没写用默认；没有变体的标签返回 null。 */
export function variantOf(tag, as) {
  const v = TAGS[tag]?.variants;
  if (!v) return null;
  return as && v[as] ? as : TAGS[tag].attrs.as.default;
}

/** 一个标签（某变体）自己的属性表；span 不在里面，见 FLOW_CHILD。 */
export function attrsOf(tag, as) {
  const t = TAGS[tag];
  if (!t) return {};
  const v = variantOf(tag, as);
  return { ...t.attrs, ...(v ? t.variants[v].attrs : {}) };
}

/** 子节点模型：变体优先，其次标签。 */
export function childrenOf(tag, as) {
  const t = TAGS[tag];
  if (!t) return null;
  const v = variantOf(tag, as);
  return (v && t.variants[v].children) || t.children || null;
}

/** 可以作为 flow 子项的标签（page / head / callout 除外）。 */
export const FLOW_CHILD_TAGS = TAG_NAMES.filter((t) => t !== 'vk-page' && t !== 'vk-head' && t !== 'vk-callout');

/** 锚点部件：源码第 N 行、第 N 个单元、第 N 位、某个元素的某一边、某个词。 */
export const ANCHOR_PARTS = ['line', 'item', 'bit', 'side', 'text'];

/** 一帧的最小骨架：AI 第一次写帧从这里抄。 */
export const SKELETON = `<vk-page>
  <vk-head kicker="第 1 集 · 主题" counter="1 / 8">一句<mark>结论</mark>。</vk-head>
  <vk-code lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1] = 7;
    </script>
  </vk-code>
  <vk-text ink="secondary">一句解释。</vk-text>
</vk-page>`;

/** 契约顶部印的几条硬规则；不再只藏在 GUIDE 里。 */
export const RULES = [
  '一帧一件事：一个 current（或一次标注）说清「正在看这里」。',
  '可见文字写成元素内容；kicker / counter / lede / note / date / value / label / 标题 / 表题 / 单位 / 目录名 / alt 才走属性。',
  'current 是源码行号（1 起，可写 "4-6"）；bytes 是字节序号、bits 是位序号；dir 是路径。',
  '用 lede 写「为什么看这里」，正文里的重点用 mark。',
  'src 载体：code/term/diff/asm 用 data-vk-source，math 写 TeX，bytes 写十六进制，dir 用 data-vk-tree。',
  '主题：page theme="light|dark"；card surface="auto|paper|soft|raised"（auto 跟随页面）。',
  'span 只写在 <vk-flow> 的直接子项上；bleed="x" 也在那里，bleed="all" 只给 page 第一层的 <vk-img>。',
  '标注只挂 page 或 flow；一帧一条 note，要标两处用 as="mark" 的多个目标。',
];

/** 作者可写的全局属性；不属于某一个标签。 */
export const AUTHOR_GLOBALS = {
  id: '所有件都可写；同一帧唯一，锚点用它；只能字母/数字/下划线/短横线/汉字',
  style: '只写颜色 token（--vk-focus / --vk-syn-* / --vk-ink-* / --vk-tone）；字号、间距、线宽、版心不归作者',
};

/** 排版事实：不是门禁，是写帧前要先算的几何。 */
export const LAYOUT_FACTS = {
  canvas: { w: CANVAS.w, h: CANVAS.h },
  content: { w: CONTENT.w, h: CONTENT.h },
  phoneWidth: PHONE_W,
  head: { withLede: 398, withoutLede: 278, subhead: 221, twoLineHeadline: 585 },
  band: { withLede: 426, withoutLede: 546, subhead: 603 },
  note: { gutter: ANN.gutter, width: ANN.gutter - ANN.standoff - 8, standoffY: ANN.standoffY },
  halfColumnChars: { body: 20, caption: 24, withNote: 11 },
  cellsCompact: '半栏 2×2；值 64、标签/地址 56；不要放 ptr（+152）',
  tableWithLede: '4 个数据行 + 表题在带导语的正文带里放不下',
  oneNotePerFrame: true,
};
export const CAPACITY = [
  { what: '代码窗', max: '3 行（带导语）/ 4 行（不带）', note: '每行 64×1.5，窗口头 80；半栏用 size="caption"' },
  { what: '表格', max: '4 个数据行 + 表头', note: '行高约 103；带表题再减一行' },
  { what: '内存格', max: '1 行 4 格 + 一句注', note: '半栏并排时用紧凑档（2×2）' },
  { what: '时序', max: '2 条（带导语）/ 4 条（subhead）/ 6 条（无标题带）', note: '一条 108' },
  { what: '关系图', max: '3 层 / 环上 4 节点', note: '超了压行距，不缩字；row 不换行' },
  { what: '步骤', max: '4 步横排', note: '容器窄时自动竖排' },
  { what: '条', max: '4–6 条', note: '' },
  { what: '时间线', max: '3 点', note: '区间用 as="band"' },
  { what: '区间', max: '3–4 段', note: '同一条轴上不要超过 4 段' },
  { what: '栈帧', max: '4 帧', note: '一帧 2–3 个字段' },
  { what: '位', max: '16 位', note: '32 位放不下' },
  { what: '字节', max: '2 行 × 8 字节 + 一句注', note: '' },
];
