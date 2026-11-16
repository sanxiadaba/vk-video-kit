/**
 * v26 · 公开契约
 * ----------------------------------------------------------------------------
 * 全库只有这一份契约：哪个标签、哪个变体、有哪些属性、默认值、子节点怎么写。
 * 构建期校验、vk doc / vk brief 全部从这里生成，不许手抄第二份。
 * docs/CONTRACT.md 不再入库；需要机器契约用 vk brief，需要错误表用 vk brief --codes。
 *
 * 十三个标签，两类：
 *   结构件   page / head / flow / text / card / img / callout
 *   机制件   code（文本网格）/ board（条目图）/ graph / dir / seq / math
 * 机制件用 as 选变体；变体名沿用旧件名，没有新词。
 *
 * 规矩：
 *   · 属性名与取值只能来自 vocab.mjs；这里不发明数值。
 *   · 一个概念一个词：theme（页明暗）/ surface（面材质）/ place（整块位置）/
 *     current（当前项）/ tone（语义）/ size（字号）/ gap·span·bleed（排布）。
 *   · 没有时间维度：没有 at / cue / enter / duration（时间线里的 at 是坐标）。
 *   · 可见文字写成元素内容；只有 kicker / counter / lede / note / date / value 走属性。
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
   span / bleed 是 flow 子项能力，不是某个件的属性。 */
export const FLOW_CHILD = {
  span: { type: 'int', min: 1, max: 12, group: 'layout', label: '跨几栏（只在 flow 子项）' },
  bleed: { type: 'enum', values: ['x', 'all'], group: 'layout', label: '出血到画布边（只在 flow 子项；all 只给 vk-img）' },
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
const currentItem = () => ({ type: 'bool', group: 'state', label: '当前项（写属性名，不写值）' });
const ITEM_TONE = { type: 'enum', values: TONE, default: 'neutral', group: 'appearance', label: '语调' };

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

/* ------------------------------------------------------------------ 标签 */
export const TAGS = {
  /* ---------------------------------------------------------------- 画布 */
  'vk-page': {
    layer: 'page',
    name: '画布',
    summary: '一帧 1920×1080 的坐标系。子项直接写，不用再包一层；place 决定标题带与正文在版心里的纵向位置。',
    attrs: {
      place: enumv(['band', 'top', 'center', 'bottom'], 'band', 'layout', '竖排：band 标题带锁顶、正文居中；center 整块居中'),
      theme: enumv(THEME, 'light', 'appearance', '主题：light / dark'),
    },
    children: blocks('直接写 <vk-head> 与内容；下一层要分栏时写 <vk-flow>。'),
    example: '<vk-page place="band" theme="light"><vk-head>一句标题。</vk-head><vk-text>正文。</vk-text></vk-page>',
  },

  'vk-head': {
    layer: 'page',
    name: '标题带',
    summary: '一帧的起手：眉标 + 标题 +（可选）一句为什么。位置与间距固定，帧与帧的标题不会跳。',
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
    summary: '唯一的排布：列数（或比例、auto）由容器给，子项用 span 跨栏；overlay 叠放；valign 管子项纵向。不画任何东西。',
    attrs: {
      cols: cols('1', '列：1–12、比例 "1 2 1"、或 auto（按内容宽）'),
      gap: space('normal'),
      valign: enumv(['start', 'center', 'end', 'between', 'stretch'], 'stretch', 'layout', '子项纵向对齐'),
      overlay: bool('layout', '叠放：子项落在同一格里'),
    },
    children: blocks('子项直接写；span / bleed 只在这里生效。'),
    example: '<vk-flow cols="2" gap="normal"><vk-text>左栏。</vk-text><vk-text>右栏。</vk-text></vk-flow>',
  },

  /* ------------------------------------------------------------ 面与字 */
  'vk-card': {
    layer: 'surface',
    name: '卡片',
    summary: '一块有材质的面：paper / soft / dark。边框、圆角、内距由库决定；可带标题栏。',
    attrs: {
      surface: enumv(CARD_SURFACE, 'paper', 'appearance', '材质：paper 白纸 / soft 软底 / dark 暗面'),
      title: text('appearance', '标题（写了才有标题带）'),
      tone: enumv(TONE, 'neutral', 'appearance', '语义：给整块面换一档语义色（对照 / 对错示范）'),
    },
    children: blocks('卡片里放块级内容；纯分组用 <vk-flow>，卡片是「一块面」。'),
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
      src: text('content', '图片地址', { required: true }),
      alt: text('content', '替代文字（图坏了会显示）'),
      ratio: text('appearance', '比例，如 "16 / 9"'),
      fill: enumv(['cover', 'contain'], 'contain', 'appearance', '填充（cover 会裁掉超出的部分）'),
      position: text('appearance', '焦点，如 "50% 50%"', { default: '50% 50%' }),
    },
    children: none('图片标签里不写内容。'),
    example: '<vk-img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'9\'%3E%3Crect width=\'16\' height=\'9\' fill=\'%23dbeafe\'/%3E%3C/svg%3E" ratio="16 / 9" alt="示例图"></vk-img>',
  },

  /* ---------------------------------------------------------------- 机制 */
  'vk-code': {
    layer: 'mechanism',
    name: '文本网格',
    summary: '等宽文本的网格：源码、终端、改动、汇编、字节、位。构建期高亮/解析，运行期零依赖。用 as 选一种。',
    attrs: {
      as: enumv(['code', 'term', 'diff', 'asm', 'bytes', 'bits'], 'code', 'content', '内容类型'),
      title: text('content', '标题栏文字（文件名 / 命令行）'),
    },
    variants: {
      code: variant('源码', '真实源码：语法高亮、行号、当前行、折叠、标词。', {
        lang: text('content', '语言，如 c / js / py（必填：不写就没有语法色）', { required: true }),
        src: text('content', '源文件'),
        range: range('源文件行段，如 "4-6"（只接受单段；4- 表示到底）'),
        current: lines('当前行（窗口内第几行，1 起）'),
        fold: lines('折叠行（窗口内第几行）'),
        mark: text('state', '标出的词（窗口里所有出现处，按词边界；每个词就是一个 @item 锚点）'),
        size: enumv(['caption', 'body'], 'body', 'type', '代码字号'),
      }, source('src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。'),
        '<vk-code lang="c" title="a.c" current="2"><script type="text/plain" data-vk-source>\nint a[3] = {1, 2, 3};\na[1]\n</script></vk-code>'),
      term: variant('终端', '命令与输出：提示符、命令、输出各自一色。', {
        src: text('content', '记录文件'),
        range: range('源文件行段，如 "4-6"（只接受单段）'),
        current: lines('当前行（窗口内第几行，1 起）'),
        size: enumv(['caption', 'body'], 'body', 'type', '字号'),
        prompt: text('appearance', '提示符', { default: '$' }),
      }, source('src 指向 .txt/.log，或内联 <script type="text/plain" data-vk-source>。'),
        '<vk-code as="term" title="bash"><script type="text/plain" data-vk-source>\n$ cc hello.c -o hello\n$ ./hello\nhello\n</script></vk-code>'),
      diff: variant('改动', '一段 diff：增删行、hunk 头、标词。', {
        src: text('content', 'diff 文件'),
        range: range('源文件行段，如 "4-6"（只接受单段）'),
        current: lines('当前行（窗口内第几行，1 起）'),
        mark: text('state', '标出的词'),
        size: enumv(['caption', 'body'], 'body', 'type', '字号'),
      }, source('src 指向 .diff，或内联 <script type="text/plain" data-vk-source>。'),
        '<vk-code as="diff" title="a.c"><script type="text/plain" data-vk-source>\n- a[1] = 7;\n+ a[1] = 8;\n</script></vk-code>'),
      asm: variant('汇编', '汇编清单：地址、机器码、助记符、操作数。', {
        src: text('content', '反汇编文件'),
        range: range('源文件行段，如 "4-6"（只接受单段）'),
        current: lines('当前行（窗口内第几行，1 起）'),
        fold: lines('折叠行（窗口内第几行）'),
        hex: bool('appearance', '显示机器码列'),
        'show-addr': enumv(['on', 'off'], 'on', 'appearance', '显示地址列（off 可省 88px）'),
        size: enumv(['caption', 'body'], 'body', 'type', '字号'),
      }, source('src 指向 objdump 输出，或内联 <script type="text/plain" data-vk-source>。'),
        '<vk-code as="asm" hex current="2" size="caption"><script type="text/plain" data-vk-source>\n1004: 48 89 f8 mov %rdi,%rax\n1007: 48 01 f0 add %rsi,%rax\n</script></vk-code>'),
      bytes: variant('字节', '十六进制转储：地址 + 十六进制 + ASCII 三列。', {
        src: text('content', '二进制文件'),
        addr: text('content', '起始地址', { default: '0x0' }),
        offset: int(0, 65535, 0, 'content', '起始字节'),
        length: int(1, 4096, 32, 'content', '字节数'),
        cols: enumv(['4', '6', '8'], '8', 'layout', '每行几列'),
        current: lines('当前字节段，如 "4-7"（1 起）'),
      }, source('src 指向二进制；也可内联十六进制（68 65 6c 6c 6f）。'),
        '<vk-code as="bytes" title="hello.bin" current="1-3"><script type="text/plain" data-vk-source>\n68 65 6c 6c 6f\n</script></vk-code>'),
      bits: variant('位', '一行二进制位：索引、分段、符号位。用 | 分段，field-labels 给每段起名。', {
        value: text('content', '位串（只含 0/1），可含空格；用 | 分段', { required: true }),
        current: lines('当前位段，如 "4-7"（1 起，从左数）'),
        label: text('appearance', '左边一行说明'),
        'field-labels': text('appearance', '各段名，逗号分隔（个数要与 | 的段数一致）'),
        index: enumv(['down', 'up', 'none', 'sparse'], 'down', 'appearance', '位序号：down 按位权；up 从左数；sparse 只标 8 的倍数'),
        sign: bool('appearance', '标出符号位'),
      }, none('位串写在 value 属性里。'),
        '<vk-code as="bits" value="0|01111|0000000000" field-labels="符号,阶码,尾数" current="2-6"></vk-code>'),
    },
  },

  'vk-board': {
    layer: 'mechanism',
    name: '条目图',
    summary: '把条目排成一张图：要点、步骤、条、时间线、表格、内存格。一个 <li> 一项；用 as 选一种。',
    attrs: {
      as: enumv(['list', 'steps', 'bars', 'timeline', 'table', 'cells'], 'list', 'content', '条目形态'),
    },
    variants: {
      list: variant('列表', '要点 / 清单 / 有序。条目写成 <li>，可选右侧小字。', {
        variant: enumv(['bullet', 'check', 'ordered'], 'bullet', 'appearance', '形态'),
      }, items({ tone: ITEM_TONE, note: text('content', '右侧小字（值 / 地址 / 单位）'), current: currentItem() }, '每一项写成 <li>；当前项写 current。'),
        '<vk-board><li note="a">取首地址</li><li current note="a + i × 4">加下标 × 4</li></vk-board>'),
      steps: variant('步骤', '编号 + 连线 + 当前步。容器窄时自动竖排。', {
        direction: enumv(['auto', 'horizontal', 'vertical'], 'auto', 'layout', '方向'),
      }, items({ tone: ITEM_TONE, note: text('content', '小字说明'), icon: text('content', '图标（Lucide 名）'), current: currentItem() }, '每一步写成 <li>；当前步写 current。'),
        '<vk-board as="steps"><li icon="file-code">预处理</li><li icon="cpu" current>编译</li></vk-board>'),
      bars: variant('条', '一组横向条：标签、值、单位。值只写数字。', {
        max: num(1, undefined, 'appearance', '最大值（不写按最大一条）'),
        unit: text('appearance', '单位'),
        scale: enumv(['linear', 'log'], 'linear', 'appearance', '刻度'),
      }, items({ value: { type: 'num', min: 0, group: 'content', label: '数值' }, tone: ITEM_TONE, current: currentItem() }, '<li value="120">hello.o</li>；值写数字，不写单位。'),
        '<vk-board as="bars" unit="ms"><li value="6">解析</li><li value="24" current>链接</li></vk-board>'),
      timeline: variant('时间线', '一条轴上的点：给了 at + start/end 就按比例摆，否则等距。', {
        start: num(undefined, undefined, 'content', '起点（数字，如 1963）'),
        end: num(undefined, undefined, 'content', '终点'),
      }, items({ at: { type: 'num', group: 'content', label: '位置（数字）' }, date: text('content', '日期标签（不写就用 at）'), note: text('content', '小字说明'), icon: text('content', '节点图标（Lucide 名）'), tone: ITEM_TONE, current: currentItem() }, '<li at="1972">C 诞生</li>；当前点写 current。'),
        '<vk-board as="timeline" start="1963" end="2010"><li at="1963">ASCII</li><li at="2010" icon="smile" current>Emoji</li></vk-board>'),
      table: variant('表格', '原生 <table>：数字列自动右对齐、等宽数字；行可写 tone / current。', {
        caption: text('content', '表题（表上方一行小字）'),
      }, table('写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err"、current。'),
        '<vk-board as="table" caption="读一次要多久"><table><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100ns</td></tr></table></vk-board>'),
      cells: variant('内存格', '一格一个 <li>：值、标签、指针、旧值。地址由 addr + 序号 × stride 算出。', {
        addr: text('content', '起始地址，如 "0x1000"'),
        stride: int(1, 16, 1, 'content', '每格占几字节（int 数组写 4）'),
        cols: int(1, 8, 4, 'layout', '每行几格'),
      }, items({ value: text('content', '值'), label: text('content', '标签'), ptr: text('content', '指针名，如 "lo"（一个词）'), was: text('content', '旧值（显示「旧 → 新」）'), tone: ITEM_TONE, current: currentItem() }, '<li value="61" label="s[0]" ptr="lo">；地址自动算。'),
        '<vk-board as="cells" addr="0x1000" stride="4"><li value="1" label="a[0]"></li><li value="2" label="a[1]" current></li></vk-board>'),
    },
  },

  'vk-graph': {
    layer: 'mechanism',
    name: '关系图',
    summary: '节点写成 <li id>文字</li>，边写在节点上（after="父id"）或写成独立子项（from/to，支持环、双向、边标）。',
    attrs: {
      as: enumv(['row', 'tree', 'layered', 'mesh'], 'row', 'layout', '布局：row 横排 / tree 树 / layered 泳道 / mesh 任意'),
      direction: enumv(['horizontal', 'vertical'], 'horizontal', 'layout', '方向（只对 row）', { when: { attr: 'as', values: ['row'] } }),
    },
    children: items(
      { id: text('content', '节点 id（边用它引用）'), note: text('content', '节点下的小字'), after: text('content', '父节点 id（空格分隔多个）'), lane: { ...int(0, 9, undefined, 'layout', 'layered 布局里放第几条泳道'), when: { attr: 'as', values: ['layered'] } }, from: text('content', '显式边的起点'), to: text('content', '显式边的终点'), tone: ITEM_TONE, current: currentItem() },
      '<li id="a">head</li> → <li id="b" after="a">next</li>；不写 after 的节点是根。'
    ),
    example: '<vk-graph><li id="a">head</li><li id="b" after="a">next</li></vk-graph>',
  },

  'vk-dir': {
    layer: 'mechanism',
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
    example: '<vk-dir><script type="text/plain" data-vk-tree>[{"name":"src","children":[{"name":"main.c"}]}]</script></vk-dir>',
  },

  'vk-seq': {
    layer: 'mechanism',
    name: '时序',
    summary: '两条以上生命线之间的往返：一行一条消息，按阅读顺序从上往下。2–4 个参与者。',
    attrs: {
      participants: text('content', '参与者，逗号分隔，如 "客户端,服务端,缓存"（2–4 个）', { required: true }),
    },
    children: items(
      { from: text('content', '起点（参与者名或 1 起的序号）'), to: text('content', '终点'), direction: enumv(['right', 'left'], 'right', 'layout', '方向（两条泳道时用）'), note: text('content', '消息下的小字'), tone: ITEM_TONE, current: currentItem() },
      '<li>SYN</li>；<li direction="left">SYN+ACK</li>；三条以上用 from/to="客户端"。'
    ),
    example: '<vk-seq participants="客户端,服务端"><li>SYN</li><li direction="left">SYN+ACK</li><li>ACK</li></vk-seq>',
  },

  'vk-math': {
    layer: 'mechanism',
    name: '公式',
    summary: '公式：src 指向 .tex 或直接写 TeX，构建期用 KaTeX 排版，运行期零依赖。inline 写在句子里。',
    attrs: {
      src: text('content', '源文件'),
      inline: bool('appearance', '行内（跟在句子里）'),
      align: enumv(['left', 'center'], 'center', 'layout', '对齐'),
    },
    children: source('src 指向 .tex 文件；或把 TeX 直接写在标签里。'),
    example: '<vk-math>T(n) = 2T(n/2) + O(n)</vk-math>',
  },

  /* ---------------------------------------------------------------- 关系 */
  'vk-callout': {
    layer: 'relation',
    name: '标注',
    summary: '画在别人身上的一层：mark 按目标形状划标记（词/块用框、行用一道、行段用括号），note 再在正文右侧的注栏里说一句，arrow 从一处指到另一处，measure 量同一条边到同一条边。note 占的那一列是排版事实，其余形态不改布局。',
    attrs: {
      mode: enumv(['mark', 'note', 'measure', 'arrow'], 'note', 'appearance', '形态'),
      for: selector('target', '目标', { when: { attr: 'mode', values: ['mark', 'note'] }, required: true }),
      from: selector('target', '起点', { when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true }),
      to: selector('target', '终点', { when: { attr: 'mode', values: ['arrow', 'measure'] }, required: true }),
      label: text('target', '连线上的字', { when: { attr: 'mode', values: ['arrow', 'measure'] } }),
    },
    content: 'text',
    children: inline('note 的文字写在这里；label 是连线上的字。'),
    example: '<vk-callout mode="note" for="#c@line:2">这里改了 0 号字节</vk-callout>',
  },
};

export const TAG_NAMES = Object.keys(TAGS);

/** 当前节点的变体名：有 as 用 as，没写用默认；没有变体的标签返回 null。 */
export function variantOf(tag, as) {
  const v = TAGS[tag]?.variants;
  if (!v) return null;
  return as && v[as] ? as : TAGS[tag].attrs.as.default;
}

/** 一个标签（某变体）自己的属性表；span / bleed 不在里面，见 FLOW_CHILD。 */
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
  '一帧一件事：一个 current（或一次标注）说清“正在看这里”。',
  '可见文字写成元素内容；kicker / counter / lede / note / date / value / label / 窗口标题 / 表题 / 单位 / 目录名 / alt 才走属性。',
  'current 写在项上（布尔）；code 的 code/term/diff/asm/bytes 与 bits 用行段；dir 用路径。',
  '用 lede 写“为什么看这里”，正文里的重点用 mark。',
  'src 载体：code/term/diff/asm 用 data-vk-source，math 写 TeX，bytes 写十六进制，dir 用 data-vk-tree。',
  '主题：page theme="light|dark"；card surface="paper|soft|dark"。',
  'span / bleed 只写在 <vk-flow> 的直接子项上；bleed="all" 只给 <vk-img>。',
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
  head: { withLede: 398, withoutLede: 278, subhead: 221 },
  note: { gutter: ANN.gutter, width: ANN.gutter - ANN.standoff - 8, standoffY: ANN.standoffY },
  halfColumnChars: { body: 20, caption: 24, withNote: 11 },
  cellsCompact: '半栏 2×2；值 64、标签/地址 56；不要放 ptr（+152）',
  tableWithLede: '4 个数据行 + caption 在带导语的正文带里放不下',
  oneNotePerFrame: true,
};
export const CAPACITY = [
  { what: '代码窗', max: '3 行（带导语）/ 4 行（不带）', note: '每行 64×1.5，窗口头 80' },
  { what: '表格', max: '4 个数据行 + 表头', note: '行高约 103；带 caption 再减一行' },
  { what: '内存格', max: '1 行 4 格 + 一句注', note: '半栏并排时用紧凑档（2×2）' },
  { what: '时序', max: '2 条（带导语）/ 4 条（subhead）/ 6 条（无标题带）', note: '一条 108' },
  { what: '关系图', max: '3 层 / 环上 4 节点', note: '超了压行距，不缩字；row 不换行' },
  { what: '步骤', max: '4 步横排', note: '容器窄时自动竖排' },
  { what: '条', max: '4–6 条', note: '' },
  { what: '时间线', max: '3 点', note: '带区间时 2 段' },
  { what: '位', max: '16 位', note: '32 位只标 8 的倍数' },
  { what: '字节', max: '2 行 × 8 字节 + 一句注', note: '' },
];

