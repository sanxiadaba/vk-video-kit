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
  'vk-grid': {
    tracks: {
      values: ['1fr 2fr'],
      effect: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns' },
      why: '轨道直接写在 grid-template-columns 上。',
    },
  },
  'vk-panel': {
    n: {
      values: ['3'],
      effect: { on: '.vk-panel-n', kind: 'text' },
      why: '编号写进 .vk-panel-n。',
    },
  },
  'vk-stat': {
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
  },
  'vk-edge': {
    via: {
      values: ['100,100;300,100'],
      effect: { on: 'svg path', kind: 'attr', prop: 'd' },
      why: '路径点最终改写 path 的 d。',
    },
    'label-dx': {
      values: ['20'],
      effect: { on: '.vk-edge-label', kind: 'style', prop: 'left' },
      why: '标签 X 偏移最终落在 span 的 left。',
    },
    'label-dy': {
      values: ['20'],
      effect: { on: '.vk-edge-label', kind: 'style', prop: 'top' },
      why: '标签 Y 偏移最终落在 span 的 top。',
    },
  },
  'vk-steps': {
    orientation: {
      values: ['vertical'],
      effect: { on: '.vk-steps', kind: 'style', prop: 'flex-direction' },
      why: '横排/竖排的差异最终在 .vk-steps 的 flex-direction。',
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
  },
  'vk-code': {
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
  },
  'vk-figure': {
    ratio: {
      values: ['2 / 1'],
      effect: { on: 'vk-figure .vk-fig-body', kind: 'style', prop: 'aspect-ratio', expect: '2 / 1' },
      why: '比例写在 .vk-fig-body 的 aspect-ratio 上。',
    },
    position: {
      values: ['30% 70%'],
      effect: { on: 'vk-figure img', kind: 'style', prop: 'object-position', expect: /30%\s+70%/ },
      why: '焦点由内部 vk-img 的 object-position 表达。',
    },
    crop: {
      values: ['20,20,30,30'],
      effect: { on: '.vk-fig-crop', kind: 'style', prop: 'left' },
      why: '裁切框是 .vk-fig-crop 覆盖层；标本已经有框，换个矩形就是 left/top/width/height 的变化。',
    },
    'crop-label': {
      values: ['s[5]'],
      effect: { on: '.vk-fig-crop-label', kind: 'text' },
      why: '标签是裁切框里的一个覆盖元素；没有标签时整块不渲染。',
    },
  },
  'vk-bits': {},
  'vk-tag': {
    // meta 就是默认态；只断 body 这一个非默认值。
    size: {
      values: ['body'],
      effect: { on: 'vk-tag', kind: 'style', prop: 'font-size' },
      why: '默认 meta 是 40，body 是 52。',
    },
  },
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
  },
  'vk-box': {
    'pad-x': { values: ['xs', 'xl'], effect: { on: 'vk-box', kind: 'style', prop: 'padding-left' }, why: '横向内距只看 left 变化。' },
    'pad-y': { values: ['xs', 'xl'], effect: { on: 'vk-box', kind: 'style', prop: 'padding-top' }, why: '纵向内距只看 top 变化。' },
  },
  'vk-tree': {
    depth: { values: ['1'], effect: { on: 'vk-tree', kind: 'geometry', prop: 'height' }, why: '标本只有两层，depth=2 与 4 画面上相同。' },
    collapsed: {
      values: ['src'],
      effect: { on: 'vk-tree', kind: 'dom', prop: '.vk-tree-row' },
      why: '收起一个真实存在的目录；断行数。',
    },
  },
  'vk-asm': {
    highlight: { values: ['2'], effect: { on: '.vk-asm-row', kind: 'style', prop: 'background-color' }, why: '高亮行必须有背景色差。' },
    focus: { values: ['2'], effect: { on: '.vk-asm-row', kind: 'style', prop: 'opacity' }, why: '聚光让非目标行透明度下降。' },
    order: { values: ['1,2,3'], effect: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-order' }, why: '顺序徽标个数跟着 order 变。' },
    'fence-after': { values: ['7'], effect: { on: '.vk-asm-fence', kind: 'attr', prop: 'data-fence' }, why: '屏障行跟着 fence-after 换位置。' },
    'fence-label': { values: ['屏障'], effect: { on: '.vk-asm-fence', kind: 'text' }, why: '屏障文字在 .vk-asm-fence。' },
    'address-label': { values: ['ADDR'], effect: { on: '.vk-asm-a', kind: 'text' }, why: '列头文字由属性覆盖。' },
    'bytes-label': { values: ['BYTES'], effect: { on: '.vk-asm-b', kind: 'text' }, why: '列头文字由属性覆盖。' },
    'mnemonic-label': { values: ['OP'], effect: { on: '.vk-asm-m', kind: 'text' }, why: '列头文字由属性覆盖。' },
    'operands-label': { values: ['ARGS'], effect: { on: '.vk-asm-o', kind: 'text' }, why: '列头文字由属性覆盖。' },
  },
};

/** 覆盖 src/effects.mjs 里不准确的效果声明；键是 `${tag}.${attr}`。 */
export const EFFECT_OVERRIDES = {
  'vk-img.ratio': { on: 'vk-img .vk-img', kind: 'style', prop: 'aspect-ratio', expect: '2 / 1' },
  'vk-code.fold': { on: 'vk-code', kind: 'dom', prop: '.vk-line.is-fold' },
  'vk-figure.ratio': { on: 'vk-figure .vk-fig-body', kind: 'style', prop: 'aspect-ratio', expect: '2 / 1' },
};

/** skipVisual 白名单：必须逐条写理由，否则契约失败。 */
export const VISUAL_EXEMPT = {
  'vk-diff.variant': '切 split 整页重排；安全区由作者内容决定，结构差异已由 height 断言覆盖。',
  'vk-code.long': '长行怎么处理与内容相关；只断言 white-space 真的变了。',
  'vk-canvas.pad-px': '画布内缩只改子节点坐标，不产生新文字/颜色。',
  'vk-canvas.overflow': '裁切是作者显式选择；画布内容的安全区由真实帧负责。',
  'vk-grid.cols': '列数变化只改几何；子节点本身的视觉在默认态已检查。',
  'vk-canvas.w': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-canvas.h': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-box.h': '硬高是作者显式选择的裁切；内容溢出不算 h 属性的错。',
  'vk-code.size': 'hero 档把组件撑到整帧，标本台装不下；只断言行高变了。',
  'vk-cells.size': 'hero 档把格子撑到 300px，标本台装不下；只断言 min-height 变了。',
  'vk-term.size': 'hero 档把终端撑到整帧，标本台装不下；只断言行高变了。',
  'vk-table.size': 'hero 档加内距会把表格撑出标本台；只断言内距变了。',
  'vk-figure.bleed': '出血是负边距，只改几何不改墨；越界由真实帧负责。',
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
    tag: 'vk-mark',
    attr: 'variant',
    reason: 'variant 与 type 共用同一组 CSS；三种形态分别用底色/内阴影/删除线，没有单一可比属性。',
  },
  {
    tag: 'vk-list',
    attr: 'variant',
    reason: '四种形态只换条目标记字形，不改高度；文字变化无法用单一几何/样式断言。',
  },
  {
    tag: 'vk-edge',
    attr: 'from-side',
    reason: '单场景只对部分边几何有效；强制边背对目标时会退回自动选边。',
  },
  {
    tag: 'vk-edge',
    attr: 'to-side',
    reason: '单场景只对部分边几何有效；强制边背对目标时会退回自动选边。',
  },
  {
    tag: 'vk-code',
    attr: 'numbering',
    reason: 'specimen 没有 lines 区间，slice/file 都从 1 开始；有 lines 时由 frame-6 验证。',
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
];
export const EFFECT_ANY_BUDGET = 12;

/** registry 把 w/h 声明成 text（可写数字也可写 fit/full）；给契约一个安全数字。 */
export const SHARED_VALUES = {
  w: ['1200', '1000'],
  h: ['400'],
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


