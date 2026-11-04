/**
 * 契约门禁的工具侧补充表。
 *
 * 三件事：
 *  1. VALUES —— 7 个公开但类型是 text/lines 的属性，不能靠 valuesFor 自动取值；
 *     这里给显式取值 + 结构/几何/样式断言，不再 continue 跳过。
 *  2. EFFECT_OVERRIDES —— 运行时实际效果和 src/effects.mjs 声明不一致时，在门禁侧
 *     用更准确的 on/prop/expect 覆盖（不改 src/）。
 *  3. VISUAL_EXEMPT —— skipVisual 的白名单。src/effects.mjs 里标了 skipVisual
 *     但没登记在这里 = 契约失败；不允许静默跳过视觉检查。
 */

/** 7 个公开属性：显式取值 + 可断言的 effect。 */
export const PROBES = {
  'vk-page': {
    // 这两个是路径 / 名字型内容，空字符串测不出"改了就变"：给真实可解析的探针值。
    cues: {
      values: ['__vk_cues__.json'],
      effect: { on: 'vk-page', kind: 'attr', prop: 'data-cues', expectFromValue: 'raw' },
      why: '字幕轨路径先镜像到宿主 data-cues；真正的轨道求值由 tests/cues.test.mjs 守。',
    },
    states: {
      values: ['a,b'],
      effect: { on: 'vk-page', kind: 'attr', prop: 'data-states', expectFromValue: 'raw' },
      why: '同页多态的名字表先镜像到宿主 data-states；切态行为由 tests/cues.test.mjs 守。',
    },
  },
  'vk-compare': {
    ratio: {
      values: ['4 / 3'],
      effect: { on: '.vk-cmp', kind: 'style', prop: 'aspect-ratio' },
      why: '比例直接写在 .vk-cmp 的 aspect-ratio 上。',
    },
    position: {
      values: ['0% 0%'],
      effect: { on: '.vk-cmp > img', kind: 'style', prop: 'object-position' },
      why: '两张图共用同一个 object-position。',
    },
    mark: {
      values: ['10,10,20,20;50,50,10,10', '10,10,20,20;50,50,10,10;60,60,10,10'],
      effect: { on: '.vk-cmp-mark', kind: 'dom', prop: '.vk-cmp-mark' },
      why: '差异框是真实 DOM：两组 / 三组必然数出 2 / 3 个框，不是只改一个看不见的属性。',
    },
    'mark-label': {
      values: ['VKPROBE'],
      effect: { on: '.vk-cmp-mark-l', kind: 'text' },
      why: '角标文字直接落在 .vk-cmp-mark-l。',
    },
    zoom: {
      values: ['mark', '2'],
      effect: { on: 'vk-compare', kind: 'attr', prop: 'data-zoom', expectFromValue: 'raw', skipVisual: true },
      why: 'zoom 的一行字有两个合法写法：mark（放大 mark 框）和倍数。宿主上的 data-zoom 两种都要跟手。',
    },
  },
  'vk-annotate': {
    for: {
      values: ['#vka-src@line:3', '#vka-out@side:right'],
      effect: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
      why: 'arrow 形态把 for 当终点用；换一个真实锚点，path 的 d 必须变。',
    },
    from: {
      values: ['#vka-gap@side:left', '#vka-out@side:right'],
      effect: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
      why: '起点换锚点，path 的 d 必须变。',
    },
    to: {
      values: ['#vka-out@side:right', '#vka-gap@side:right'],
      effect: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
      why: '显式 to 覆盖 for；换终点，path 的 d 必须变。',
    },
    tone: {
      values: ['info', 'focus', 'ok', 'warn', 'err'],
      effect: { on: '.vk-edge-path', kind: 'style', prop: 'stroke' },
      why: 'neutral 是默认墨色（不写 tone 时），只断五个语义色。',
    },
    'arrow-label': {
      values: ['gcc'],
      effect: { on: '.vk-edge-label', kind: 'text' },
      why: 'arrow-label 优先于旧 label：换词，标签文本必须跟着换。',
    },
    size: {
      values: ['label', 'subhead'],
      why: 'size 只表字号；mega/display 会把标签挤出安全区，data 与 body 同字号（等宽那一档）。',
    },
  },
  'vk-loupe': {
    point: {
      values: ['10%,10%', '80%,80%'],
      effect: { on: '.vk-loupe', kind: 'style', prop: 'background-position' },
      why: '放大的是哪一点，直接翻成 background-position。',
    },
  },
  'vk-grid': {
    tracks: {
      values: ['1fr 2fr'],
      effect: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns' },
      why: '轨道直接写在 grid-template-columns 上。',
    },
    // 标本宿主是 gap="sm"（24px），所以 gap-x/gap-y 的 sm 与基线相同、测不出变化；
    // 这两条只探真正会改列距/行距的档位。
    'gap-x': {
      values: ['lg', 'xl'],
      effect: { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
      why: '横向沟槽只改 column-gap；sm 与宿主 gap 简写相同，不重复探。',
    },
    'gap-y': {
      values: ['lg', 'xl'],
      effect: { on: 'vk-grid', kind: 'style', prop: 'row-gap' },
      why: '纵向沟槽只改 row-gap；sm 与宿主 gap 简写相同，不重复探。',
    },
  },
  'vk-label': {
    total: {
      values: ['5'],
      effect: { on: '.vk-label-t', kind: 'text' },
      why: 'total 单独写没有分子；registry 的 when 会先放 index="3"，于是文本变成「工序 3/5」。',
    },
    variant: {
      values: ['tag'],
      effect: { on: 'vk-label', kind: 'style', prop: 'font-size', expect: '36px' },
      why: 'tag 是新增的一档（caption × 0.75 = 36）；kicker / chip / badge 的形态由 tests/label.test.mjs 守。',
    },
    for: {
      values: ['#lab-a', '#lab-b'],
      effect: { on: 'vk-label', kind: 'attr', prop: 'data-for', expectFromValue: 'raw' },
      why: '贴块（原 vk-caption）：for 先镜像到宿主（块里的标签也镜像）；真正的落点由 draw() 按目标首字符算，几何由 tests/merged-six.test.mjs 量。',
    },
  },
  'vk-panel': {
    fill: {
      values: ['cover'],
      effect: { on: 'vk-panel', kind: 'style', prop: 'display', expect: 'flex' },
      why: 'cover 才把 panel 变成吃满宽高的 flex；contain 与默认块级是同一个 display，单靠 display 量不出来。',
    },
  },
  'vk-flow': {    arrow: {
      values: ['false'],
      effect: { on: 'vk-flow', kind: 'attr', prop: 'data-arrow', expect: 'false' },
      why: 'arrow 现在默认开，契约探针改成显式关：只有 arrow="false" 才该变成 false。',
    },
    'arrow-label': {
      values: ['gcc'],
      effect: { on: '.vk-flow-arrow-label .vk-label-t', kind: 'text' },
      why: '中轴词是真实文字：换词，标签里的文本必须跟着换。',
    },
  },
  'vk-stat': {
    // thousands 是默认态；只断两个非默认写法。
    format: {
      values: ['none', 'hex'],
      effect: { on: '.vk-stat-v', kind: 'text' },
      why: '数字写法：千分位 / 原样 / 十六进制。',
    },
    measure: {
      values: ['16', 'none'],
      effect: { on: 'vk-stat', kind: 'style', prop: 'max-width' },
      why: '行宽写的是字数，运行期折成 max-width: Nem。',
    },
    wrap: {
      values: ['nowrap', 'balance'],
      effect: { on: '.vk-stat-v', kind: 'style', prop: 'text-wrap' },
      why: '断行策略落在真正装字的那一层。',
    },
    value: {
      values: ['1,024'],
      effect: { on: '.vk-stat-v', kind: 'text' },
      why: '数字直接写进 .vk-stat-v。',
    },
    unit: {
      values: ['字节'],
      effect: { on: '.vk-stat-u', kind: 'text' },
      why: '单位写进 .vk-stat-u。',
    },
  },
  'vk-bars': {
    format: {
      values: ['none'],
      effect: { on: '.vk-bar-v', kind: 'text' },
      why: '数值列的写法（千分位 / 原样）；数字本身不变。',
    },
    'ratio-to': {
      values: ['0', '2'],
      effect: { on: 'vk-bars', kind: 'dom', prop: '.vk-bar-x' },
      why: '倍率基准行必须真的把 ×N 标到条旁；0 与末行是最容易越界的两个端点。',
    },
  },
  'vk-pin': {
    w: {
      values: ['200', '320'],
      effect: { on: '.vk-pin-bd', kind: 'geometry', prop: 'width' },
      why: 'w 只改气泡宽；宿主始终铺满整页，所以量 .vk-pin-bd 才对。',
    },
  },
  'vk-note': {
    for: {
      values: ['#nt-code', '#nt-a'],
      effect: { on: '.vk-note-m', kind: 'geometry', prop: 'x' },
      why: '边注的落点由目标决定：换一个真实目标，.vk-note-m 的 x 必须跟着走（不是只改一个看不见的属性）。',
    },
    w: {
      values: ['200', '320'],
      effect: { on: '.vk-note-m', kind: 'geometry', prop: 'width' },
      why: 'w 是边注的宽度上限；标本目标两侧都有空间，200 与 320 都放得下。',
    },
    size: {
      values: ['label', 'subhead'],
      why: '气泡字号：label 与 subhead 量得到变化；mega 会把气泡撑出安全区。',
    },
  },
  'vk-caption': {
    for: {
      values: ['#cap-a', '#cap-b'],
      effect: { on: '.vk-caption', kind: 'geometry', prop: 'x', expect: { not: '0px' } },
      why: '说明的左边界由目标首字符决定；两个目标横向错开 120px，换一个真实目标 x 必须跟着走。',
    },
  },
  'vk-edge': {
    via: {
      values: ['100,100;300,100'],
      effect: { on: 'svg path', kind: 'attr', prop: 'd' },
      why: '路径点最终改写 path 的 d。',
    },
    'label-offset': {
      values: ['20,20'],
      effect: { on: '.vk-edge-label', kind: 'style', prop: 'left' },
      why: '标签偏移 "dx,dy" 最终落在 span 的 left / top。',
    },
    size: {
      values: ['label', 'subhead'],
      effect: { on: '.vk-edge-label', kind: 'style', prop: 'font-size' },
      why: '连线标签字号：两个非默认档；mega 会把标签挤出安全区。',
    },
  },
  'vk-steps': {
    direction: {
      values: ['vertical'],
      effect: { on: '.vk-steps', kind: 'style', prop: 'flex-direction' },
      why: '横排/竖排的差异最终在 .vk-steps 的 flex-direction。',
    },
    // current 从 1 起；-1 = 不标。读第 2 步的颜色：current=1 时它是 todo，
    // current=3 时它是 done，两个值都会让颜色离开标本基线（current=2）。
    current: {
      values: ['1', '3'],
      effect: { on: '.vk-step[data-step="1"]', kind: 'style', prop: 'color' },
      why: '改 current 会改第 2 步的状态（todo / done / current），颜色必须跟手。',
    },
    mark: {
      values: ['2', '3'],
      effect: { on: 'vk-steps', kind: 'attr', prop: 'data-mark', expectFromValue: 'raw' },
      why: 'mark 是第 N 步（1 起）；两个合法值落到宿主 data-mark 上，改哪个都得跟手。',
    },
  },
  'vk-img': {
    ratio: {
      values: ['2 / 1'],
      effect: { on: 'vk-img .vk-img', kind: 'style', prop: 'aspect-ratio', expect: '2 / 1' },
      why: '比例写在 .vk-img 的 aspect-ratio 上；同时量宿主高度会受 h 影响，直接断样式更准。',
    },
    position: {
      values: ['30% 70%'],
      effect: { on: 'vk-img img', kind: 'style', prop: 'object-position', expect: /30%\s+70%/ },
      why: '焦点偏移落在内部 img 的 object-position。',
    },
    fill: {
      values: ['cover'],
      effect: { on: 'vk-img img', kind: 'style', prop: 'object-fit', expect: 'cover' },
      why: '标本里的 vk-img 已经 fit="contain"；只有 fill="cover" 会改变 object-fit，contain 与默认态相同。',
    },
  },
  'vk-term': {
    current: {
      values: ['3'],
      effect: { on: '.vk-line', kind: 'style', prop: 'background-color' },
      why: '指一行：整行 focus 底，与 vk-code 的 current 同一条视觉规则。标本有 6 行真实 transcript。',
    },
    prompt: {
      values: ['>', 'PS>'],
      effect: { on: '.vk-prompt', kind: 'text' },
      why: 'prompt 决定命令行前缀字符，直接落在 .vk-prompt 的文字上。',
    },
  },
  'vk-code': {
    current: {
      values: ['2'],
      effect: { on: '.vk-line', kind: 'style', prop: 'background-color' },
      why: 'current 指一行：与 vk-term 的 current 同一条视觉规则；标本默认指第 4 行，探针换到第 2 行。',
    },
    highlight: {
      values: ['3'],
      effect: { on: '.vk-line', kind: 'style', prop: 'background-color' },
      why: '高亮行必须真的出现背景色差。',
    },
    focus: {
      values: ['3'],
      effect: { on: '.vk-line', kind: 'style', prop: 'opacity' },
      why: '聚光让非目标行透明度下降，断 opacity。',
    },
    fold: {
      values: ['3'],
      effect: { on: 'vk-code', kind: 'dom', prop: '.vk-line.is-fold' },
      why: '真折叠会多出一条 .is-fold 行；行数不变，不能只数 .vk-line。',
    },
    omit: {
      values: ['4:0-1'],
      effect: { on: 'vk-code', kind: 'dom', prop: '.vk-char' },
      why: 'omit（原 span）只在合法行:列区间上包出字符 span；断 .vk-char 的个数。',
    },
    mark: {
      values: ['s'],
      effect: { on: 'vk-code', kind: 'dom', prop: '.vk-tok' },
      why: 'mark 是代码里真实存在的标识符；断高亮出来的 token 数。',
    },
  },
  'vk-bytes': {
    highlight: {
      values: ['9-12'],
      effect: { on: '.vk-bytes-x i', kind: 'style', prop: 'background-color' },
      why: '高亮字节会换一组 i 的背景色；断言背景而不是 data-hl 标记。',
    },
  },
  'vk-asm': {
    highlight: {
      values: ['2'],
      effect: { on: '.vk-asm-row', kind: 'style', prop: 'background-color' },
      why: '高亮行必须有背景色差。',
    },
    focus: {
      values: ['2'],
      effect: { on: '.vk-asm-row', kind: 'style', prop: 'opacity' },
      why: '聚光让非目标行透明度下降。',
    },
    long: {
      values: ['wrap', 'clip'],
      effect: { on: '.vk-asm', kind: 'attr', prop: 'data-long', expectFromValue: 'raw' },
      why: '长行策略先镜像到 .vk-asm 的 data-long：clip 裁切、wrap 换行、fail 构建期报错。',
    },
  },
  'vk-bits': {},
  'vk-rule': {
    // neutral 就是默认态；只断 info / focus 这两个非默认值。
    tone: {
      values: ['info', 'focus'],
      effect: { on: 'vk-rule', kind: 'style', prop: 'background-color' },
      why: 'neutral 与默认态相同，断 info/focus 即可。',
    },
  },
  'vk-inline': {
    variant: {
      values: ['sup'],
      effect: { on: 'vk-inline', kind: 'style', prop: 'font-size' },
      why: 'code 是 1em；sup 缩到 0.7em，字号一定变。其余形态由标本页看着验。',
    },
  },
  'vk-cells': {
    cols: {
      values: ['5'],
      effect: { on: 'vk-cells', kind: 'style', prop: 'grid-template-columns' },
      why: '标本 10 格、cols=6；只测 5，避免列数太小把帧撑破。',
    },
    current: {
      values: ['3'],
      effect: { on: 'vk-cells', kind: 'dom', prop: '.vk-cell[data-state="current"]' },
      why: 'current 是第 N 格（1 起）：落成那一格的 data-state="current"，与 li 上的 act="focus" 同一条渲染路径。',
    },
  },
  'vk-box': {
    'pad-x': { values: ['xs', 'xl'], effect: { on: 'vk-box', kind: 'style', prop: 'padding-left' }, why: '横向内距只看 left 变化。' },
    'pad-y': { values: ['xs', 'xl'], effect: { on: 'vk-box', kind: 'style', prop: 'padding-top' }, why: '纵向内距只看 top 变化。' },
  },
  'vk-pair': {
    // 5% / 95% 是几何极限：56px 的代码行在 84px 的栏里必然越界，
    // 那不是 split 失效，是"极端比例装不下一行字"。30 / 70 仍能验证分栏，
    // 且不会把文本挤出安全区。
    split: { values: ['30', '70'], why: '分栏看到左右宽度的真实变化；5/95 只测到文本的物理极限。' },
  },
  'vk-stack': {
    // 3xl / plate 的间距在 3 张真实卡片上会超过 888 的安全高度；
    // 这不是 gap 失效，是"间距大到画面装不下"。xs / xl 仍能验证档位。
    gap: { values: ['xs', 'xl'], why: '间距档位看得到变化；3xl 只测到三张卡片的物理极限。' },
  },
  'vk-math': {
    size: {
      values: ['label', 'subhead'],
      effect: { on: 'vk-math .katex', kind: 'style', prop: 'font-size' },
      why: '公式字号落在 .katex 上：label 与 subhead 量得到变化；data 与 body 同字号，mega 会超出标本台。',
    },
  },
  'vk-tree': {
    depth: { values: ['1'], effect: { on: 'vk-tree', kind: 'geometry', prop: 'height' }, why: '标本只有两层，depth=2 与 4 画面上相同。' },
    collapsed: {
      values: ['build'],
      effect: { on: 'vk-tree', kind: 'dom', prop: '.vk-tree-row' },
      why: '收起一个真实存在的目录；断行数。',
    },
    limit: {
      values: ['1', '2'],
      // kind=dom 读的是 prop 这个选择器的个数；limit 只截顶层。
      effect: { on: 'vk-tree', kind: 'dom', prop: '.vk-tree-row[data-depth="0"]' },
      why: 'limit 是顶层显示上限（默认 14）：断顶层行数，而不是整棵树的行数。',
    },
  },
  'vk-timeline': {
    // 标本把 size 定在 subhead（演示"一帧三个数字"的降档用法），
    // 默认 title 200 与 hero 280 由 tests/gaps-kit.test.mjs 逐档测过；
    // 契约只探 title 这一档，免得同一件事在两个地方各断言一次。
    size: {
      values: ['title'],
      effect: { on: '.vk-tl-value', kind: 'style', prop: 'font-size' },
      why: '主值字号落在 .vk-tl-value 上：title 200 / hero 280 / subhead 112。',
    },
    current: {
      values: ['2'],
      effect: { on: 'vk-timeline', kind: 'dom', prop: '.vk-tl-item[data-state="current"]' },
      why: 'current 是第 N 个事件（1 起）：落成那一条的 data-state="current"。',
    },
  },
  'vk-asm': {
    highlight: { values: ['2'], effect: { on: '.vk-asm-row', kind: 'style', prop: 'background-color' }, why: '高亮行必须有背景色差。' },
    focus: { values: ['2'], effect: { on: '.vk-asm-row', kind: 'style', prop: 'opacity' }, why: '聚光让非目标行透明度下降。' },
    order: { values: ['1,2,3'], effect: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-order' }, why: '顺序徽标个数跟着 order 变。' },
    'fence-after': { values: ['7'], effect: { on: '.vk-asm-fence', kind: 'attr', prop: 'data-fence' }, why: '屏障行跟着 fence-after 换位置。' },
    'fence-label': { values: ['屏障'], effect: { on: '.vk-asm-fence', kind: 'text' }, why: '屏障文字在 .vk-asm-fence。' },
    labels: {
      values: ['ADDR|BYTES|OP|ARGS'],
      effect: { on: '.vk-asm-a', kind: 'text' },
      why: '列头文字由 labels="地址|机器码|指令|操作数" 一次覆盖四列。',
    },
    long: {
      values: ['wrap', 'clip'],
      effect: { on: '.vk-asm', kind: 'attr', prop: 'data-long', expectFromValue: 'raw' },
      why: '长行策略先镜像到 .vk-asm 的 data-long：clip 裁切、wrap 换行、fail 构建期报错。',
    },
  },
  'vk-text': {
    size: {
      values: ['display', 'headline', 'caption', 'label', 'subhead', 'title', 'hero', 'mega'],
      why: 'data 是 body 的字号（40）+ 等宽字体，字号本来就不变；等宽由 tests/batch-ef.test.mjs 的旧名用例断言。',
    },
    icon: {
      values: ['check'],
      effect: { on: 'vk-text', kind: 'dom', prop: '.vk-text-ic' },
      why: '图标是一个字形：写 icon 才出现图标槽，没写就没有空槽（原 vk-icon 并进这里）。',
    },
    fit: {
      values: ['width'],
      effect: { on: 'vk-text', kind: 'style', prop: 'font-size', expect: { not: '56px' }, skipVisual: true },
      why: 'fit="width" 把这一行缩放到容器宽；标本里既有长句（会缩）也有 780px 的代码行（会放），两处都不该停在 body 56。',
    },
    'fit-min': {
      values: ['96', '120'],
      effect: { on: 'vk-text', kind: 'style', prop: 'font-size', expectFromValue: 'px', skipVisual: true },
      why: '780px 的代码行自然 fit 约 72，所以 96 / 120 都会把字号抬到恰好等于边界值。',
    },
    'fit-max': {
      values: ['24', '32'],
      effect: { on: 'vk-text', kind: 'attr', prop: 'data-fit-max', expectFromValue: 'raw' },
      why: 'fit-min 现在是硬地板（默认 40），24 / 32 会被地板挡住；契约只断"上限被读到"，字号由 batch-primitives 的 780px 用例守（那里 fit-max=40 > 地板）。',
    },
    measure: {
      values: ['16', 'none'],
      effect: { on: 'vk-text', kind: 'style', prop: 'max-width' },
      why: '行宽写的是字数，运行期折成 max-width: Nem。',
    },
    wrap: {
      values: ['nowrap', 'balance'],
      effect: { on: 'vk-text', kind: 'style', prop: 'text-wrap' },
      why: '断行策略落在真正装字的那一层。',
    },
  },
  'vk-title': {
    measure: {
      values: ['16', 'none'],
      effect: { on: 'vk-title', kind: 'style', prop: 'max-width' },
      why: '行宽写的是字数，运行期折成 max-width: Nem。',
    },
    wrap: {
      values: ['nowrap', 'pretty'],
      effect: { on: '.vk-title-main', kind: 'style', prop: 'text-wrap' },
      why: '断行策略落在真正装字的那一层。',
    },
  },
  'vk-quote': {
    measure: {
      values: ['16', 'none'],
      effect: { on: 'vk-quote', kind: 'style', prop: 'max-width' },
      why: '行宽写的是字数，运行期折成 max-width: Nem。',
    },
    wrap: {
      values: ['nowrap', 'balance'],
      effect: { on: '.vk-quote', kind: 'style', prop: 'text-wrap' },
      why: '断行策略落在真正装字的那一层。',
    },
  },
  'vk-callout': {
    measure: {
      values: ['16', 'none'],
      effect: { on: 'vk-callout', kind: 'style', prop: 'max-width' },
      why: '行宽写的是字数，运行期折成 max-width: Nem。',
    },
    wrap: {
      values: ['nowrap', 'balance'],
      effect: { on: '.vk-callout-bd', kind: 'style', prop: 'text-wrap' },
      why: '断行策略落在真正装字的那一层。',
    },
  },
};

/** 覆盖 src/effects.mjs 里不准确的效果声明；键是 `${tag}.${attr}`。 */
export const EFFECT_OVERRIDES = {
  'vk-img.ratio': { on: 'vk-img .vk-img', kind: 'style', prop: 'aspect-ratio', expect: '2 / 1' },
  'vk-code.fold': { on: 'vk-code', kind: 'dom', prop: '.vk-line.is-fold' },
  // chrome 的四个值改的是三处不同元素（none 藏窗头、min/dialog 藏地址栏），
  // 单一 prop 量不了它。这里只要求"改了就变"，具体行为由 dom.test 的窗头用例守着。
  'vk-window.chrome': { kind: 'any', reason: '四个值改三处元素，单一属性量不了' },
};

/** skipVisual 白名单：必须逐条写理由，否则契约失败。 */
export const VISUAL_EXEMPT = {
  'vk-pair.size': '轴符号是装饰件（aria-hidden / data-meta），12–200 的极端字号会超出并置块的高度；符号大小与中点位置由 tests/batch-primitives.test.mjs 单独守。',
  'vk-text.size': 'display 160 在 888 高的标本台里必然换行并超出安全区；四档字号与行高由 tests/batch-ef.test.mjs 用短文本单独守。',
  'vk-text.fit': 'fit 是为了"单行塞满"，字号可能被压到正文地板以下；填充精度由 tests/batch-primitives.test.mjs 的 780px 用例单独守。',
  'vk-text.fit-min': '边界值会把字号钉在 48 / 56，标本里的长句会因此换行；字号是否恰好等于边界由 tests/batch-primitives.test.mjs 单独守。',
  'vk-text.fit-max': '边界值会把 780px 的代码行压到 64 / 72，视觉审计只关心默认态；边界是否生效由 tests/batch-primitives.test.mjs 单独守。',
  'vk-compare.variant': 'stack 把两张完整图上下叠，总高由 ratio 与容器宽决定；标本台里必然会超出安全区。这是对照本身的几何，split 默认态仍过完整视觉审计。',
  'vk-compare.zoom': '放大块是追加在对照下方的第二块；标本台只有一张对照的位置，追加后会超出安全区。放大块自身的几何与像素由 tests/gaps-six.test.mjs 的 zoom 用例守。',
  'vk-diff.variant': '切 split 整页重排；安全区由作者内容决定，结构差异已由 height 断言覆盖。',
  'vk-code.long': '长行怎么处理与内容相关；只断言 white-space 真的变了。',
  'vk-canvas.pad-px': '画布内缩只改子节点坐标，不产生新文字/颜色。',
  'vk-canvas.overflow': '裁切是作者显式选择；画布内容的安全区由真实帧负责。',
  'vk-grid.cols': '列数变化只改几何；子节点本身的视觉在默认态已检查。',
  'vk-canvas.w': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-canvas.h': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-box.h': '硬高是作者显式选择的裁切；内容溢出不算 h 属性的错。',
  'vk-code.mass': 'hero 档把组件撑到整帧，标本台装不下；只断言行高变了。',
  'vk-cells.mass': 'hero 档把格子撑到 300px，标本台装不下；只断言 min-height 变了。',
  'vk-term.mass': 'hero 档把终端撑到整帧，标本台装不下；只断言行高变了。',
  'vk-table.mass': 'hero 档加内距会把表格撑出标本台；只断言内距变了。',
  'vk-window.mass': 'window 的标本里没有 diff / 代码行，hero 只加高标题栏；行高确实随窗的体量变，由 tests/gaps-kit.test.mjs 覆盖。',
  'vk-diff.mass': 'hero 档把对照行撑高，标本台装不下；只断言行高变了。',
  'vk-tree.mass': 'hero 档把文件树撑到整帧，标本台放不下；只断言行高变了。',
  'vk-bits.mass': 'hero 档把位图行撑高，标本台放不下；只断言行高变了。',
  'vk-asm.mass': 'hero 档把反汇编撑高，标本台装不下；只断言行高变了。',
  'vk-code.size': '160px 的内容字号会把标本台撑高；字号/行高比例由 tests/mechanism.test.mjs 逐项量。',
  'vk-term.size': '160px 的终端会超出标本台；字号/行高比例由 tests/mechanism.test.mjs 逐项量。',
  'vk-asm.size': '160px 的汇编会超出标本台；字号/行高比例由 tests/mechanism.test.mjs 逐项量。',
  'vk-table.size': '160px 的表格会超出标本台；行距与字号由 tests/mechanism.test.mjs 量。',
  'vk-diff.size': '160px 的对比会超出标本台；字号/行高比例由 tests/mechanism.test.mjs 逐项量。',
  'vk-tree.size': '160px 的文件树会超出标本台；行高与字号由 tests/mechanism.test.mjs 量。',
  'vk-code.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；填充精度由 tests/mechanism.test.mjs 的 vk-asm 用例守。',
  'vk-term.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；机制由 tests/mechanism.test.mjs 守。',
  'vk-asm.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；填充精度由 tests/mechanism.test.mjs 的 vk-asm 用例守。',
  'vk-table.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；机制由 tests/mechanism.test.mjs 守。',
  'vk-diff.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；机制由 tests/mechanism.test.mjs 守。',
  'vk-tree.fit': 'fit="width" 按容器宽反算字号，可能大到超出标本台；机制由 tests/mechanism.test.mjs 守。',
};

/**
 * 无法自动测的属性：必须显式登记 `{ tag, attr, reason }`，预算 ≤ 10。
 * 当前 3 条。
 */
export const EFFECT_ANY = [
  { tag: 'vk-window', attr: 'url', reason: 'url 只在 chrome="browser" / "dialog" 时出现；单场景无法同时改两个属性。' },
  { tag: 'vk-timeline', attr: 'lanes', reason: 'lanes 只在 variant="lanes" 时生效；单场景无法同时改两个属性。' },
  { tag: 'vk-code', attr: 'fold-note', reason: 'fold-note 只在 fold 存在时出现；单场景无法同时改两个属性。' },
  {
    tag: 'vk-term',
    attr: 'marks',
    reason:
      '结果 glyph 只在含 ✓/!/✗ 的 transcript 上可见；标本用的是真实采集的 steps.txt（没有结果行），静态画面不变。三种状态由 tests/shell-dom.test.mjs 的 marks 用例覆盖。',
  },

  {
    tag: 'vk-layer',
    attr: 'fill',
    reason: '叠层的高度由父容器与绝对定位的子元素共同决定，标本里 cover / contain 解出同一个盒子；落点由 tests/mechanism.test.mjs 的叠层用例守。',
  },
  {
    tag: 'vk-list',
    attr: 'variant',
    reason: '四种形态只换条目标记字形，不改高度；文字变化无法用单一几何/样式断言。',
  },
  {
    tag: 'vk-tree',
    attr: 'limit',
    reason: '文件树标本只有一个根，limit 的 1/500 都只显示这一个根；顶层截断由「只看顶层」预设覆盖。',
  },
  {
    tag: 'vk-inline',
    attr: 'href',
    reason: 'href 只在点击时导航；静态帧没有视觉变化。',
  },
  {
    tag: 'vk-annotate',
    attr: 'gap-px',
    reason:
      '默认的曲线箭头不吃间隙（曲线两端直接落在盒边上）；gap-px 只作用于 ortho 折线的起步与批注气泡的落点，单场景量不到。折线间隙由 vk-edge 的契约覆盖。',
  },
];
export const EFFECT_ANY_BUDGET = 12;

/** registry 把 w/h 声明成 text（可写数字也可写 fit/full）；给契约一个安全数字。 */
export const SHARED_VALUES = {
  w: ['1200', '1000'],
  h: ['400'],
  size: ['160'],
  cols: ['4'],
  title: ['VKPROBE'],
  url: ['VKPROBE'],
  label: ['VKPROBE'],
  addr: ['0x500000'],
};

/**
 * 视觉豁免的模式表：硬几何属性只改尺寸，是否裁切由 gate 的裁切/安全区检查负责。
 * 与 VISUAL_EXEMPT 一样必须写理由；命中模式也会跳过契约里的 44/对比度检查。
 */
export const VISUAL_PATTERNS = [
  {
    match: /\.(w|h)$/,
    reason: '硬宽/硬高只改几何；内容是否被裁由作者内容与 gate 的裁切检查负责。',
  },
  {
    match: /\.(grow|fill|overflow|measure)$/,
    reason: '布局填充只改几何；真实帧的安全区/裁切由 gate 负责。',
  },
];

export function visualExemptReason(key) {
  if (VISUAL_EXEMPT[key]) return VISUAL_EXEMPT[key];
  for (const p of VISUAL_PATTERNS) if (p.match.test(key)) return p.reason;
  return null;
}





