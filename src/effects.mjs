/**
 * 契约：每个公开属性「应该改变什么」。
 *
 * 这是门禁的声明面，不是实现说明。`on` 是组件内部的选择器；`prop` 是
 * 计算样式名、属性名、几何量，或（kind=dom）要计数的选择器。
 */
export const EFFECTS = {
  'vk-list': {
    rule: { on: 'vk-list', kind: 'geometry', prop: 'height', expect: { not: '0' } },
    bare: { on: 'vk-list li', kind: 'style', prop: 'padding-left', expect: { to: '0px' } },
    gap: { on: 'vk-list', kind: 'geometry', prop: 'height' },
    mass: { on: '.vk-list', kind: 'style', prop: 'line-height' },
  },

  'vk-steps': {
    current: { on: 'vk-steps', kind: 'style', prop: 'color', expect: { not: 'rgb(11, 15, 20)' } },
  },

  'vk-cells': {
    cols: { on: 'vk-cells', kind: 'style', prop: 'grid-template-columns' },
  },

  'vk-term': {
    chrome: { on: 'vk-term', kind: 'dom', prop: '.vk-hd' },
    // 表面换的是 .vk-win 上的一整组材质变量；底色是最直接的证据。
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    mass: { on: '.vk-line', kind: 'style', prop: 'min-height', skipVisual: true },
    // hero 档会把组件撑到整帧，标本台放不下；只验样式变了，不跑视觉审计。
    w: { on: 'vk-term', kind: 'geometry', prop: 'width' },
    // 词法：lang 换一套 token，落到宿主上的 data-lang 是这次切换的证据。
    lang: { on: 'vk-term', kind: 'attr', prop: 'data-lang', expectFromValue: 'raw' },
    // 指一行：整行 focus 底（与 vk-code 的 current 同一条视觉规则）。
    current: { on: '.vk-line', kind: 'style', prop: 'background-color' },
    // 出场：reveal=line 逐行、none 不参与；静态画面不变，data-reveal 是声明的证据。
    reveal: { on: 'vk-term', kind: 'attr', prop: 'data-reveal', expectFromValue: 'raw' },
    // 无壳终端的标题默认只作无障碍名；title-show 是显式打开可见标题的开关。
    'title-show': { on: 'vk-term', kind: 'attr', prop: 'data-title-show', expectFromValue: 'raw' },
  },


  'vk-window': {
    mass: { on: '.vk-hd', kind: 'style', prop: 'padding-top', skipVisual: true },

    title: { on: '.vk-file', kind: 'text' },
    chrome: { on: '.vk-hd', kind: 'style', prop: 'display' },
    tone: { on: '.vk-win', kind: 'style', prop: 'border-top-color' },
    pad: { on: '.vk-win-bd', kind: 'style', prop: 'padding-top' },
    w: { on: 'vk-window', kind: 'geometry', prop: 'width' },
  },




  'vk-bits': {
    mass: { on: '.vk-bit-row', kind: 'style', prop: 'min-height', skipVisual: true },

    index: { on: '.vk-bit-i', kind: 'text' },
    group: { kind: 'any', reason: 'group 只改分隔线的粗细/位置，没有单一可比属性' },
    sign: { on: '.vk-bit', kind: 'style', prop: 'background-color', expect: { not: 'rgba(0, 0, 0, 0)' } },
    tone: { on: '.vk-bit', kind: 'style', prop: 'color' },
    width: { on: 'vk-bits', kind: 'dom', prop: '.vk-bit' },
    bytes: { on: '.vk-bits', kind: 'style', prop: 'border-bottom-width', expect: { not: '0px' } },
  },

  'vk-bars': {
    max: { on: '.vk-bar-fill', kind: 'style', prop: 'width', expect: { not: '0px' } },
    scale: { on: '.vk-bar-fill', kind: 'style', prop: 'width' },
    'ratio-to': { on: 'vk-bars', kind: 'dom', prop: '.vk-bar-x' },
    mass: { on: '.vk-bar', kind: 'style', prop: 'min-height' },
    tone: { on: '.vk-bar-fill', kind: 'style', prop: 'background-color' },
    format: { on: '.vk-bar-v', kind: 'text' },
  },

  'vk-diff': {
    mass: { on: '.vk-dline', kind: 'style', prop: 'min-height', skipVisual: true },

    variant: { on: 'vk-diff', kind: 'geometry', prop: 'height', skipVisual: true },
    chrome: { on: 'vk-diff .vk-hd', kind: 'style', prop: 'display' },
    summary: { on: '.vk-dmeta', kind: 'style', prop: 'display' },
    w: { on: 'vk-diff', kind: 'geometry', prop: 'width' },
    numbers: { on: 'vk-diff', kind: 'dom', prop: '.vk-ln' },
  },

  'vk-math': {
    display: { on: 'vk-math', kind: 'style', prop: 'display', expect: ['block', 'inline-block'] },
    size: { on: 'vk-math .katex', kind: 'style', prop: 'font-size' },
  },

  'vk-stack': {
    direction: { on: 'vk-stack', kind: 'style', prop: 'flex-direction' },
    wrap: { on: 'vk-stack', kind: 'style', prop: 'flex-wrap' },
    gap: { on: 'vk-stack', kind: 'style', prop: 'row-gap' },
    align: { on: 'vk-stack', kind: 'style', prop: 'align-items' },
    justify: { on: 'vk-stack', kind: 'style', prop: 'justify-content' },
  },


  'vk-grid': {
    cols: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns', skipVisual: true },
    tracks: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns', skipVisual: true },
    gap: { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-x': { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-y': { on: 'vk-grid', kind: 'style', prop: 'row-gap' },
    align: { on: 'vk-grid', kind: 'style', prop: 'align-items' },
  },

  'vk-pair': {
    // 左块宽 = (容器宽 - 2×gap) × split；几何断言直接量它。
    split: { on: '.vk-pair-l', kind: 'geometry', prop: 'width', expect: { not: '0px' } },
    axis: { on: 'vk-pair', kind: 'attr', prop: 'data-axis', expectFromValue: 'raw' },
    'axis-width': { on: '.vk-pair-axis', kind: 'style', prop: 'width', expectFromValue: 'px' },
    symbol: { on: 'vk-pair', kind: 'attr', prop: 'data-symbol', expectFromValue: 'raw' },
    'symbol-size': { on: '.vk-pair-sym', kind: 'style', prop: 'font-size', expectFromValue: 'px', skipVisual: true },
    // gap 落在 .vk-pair 的 --vk-pair-gap 上；沟槽是它的两倍。
    gap: { on: '.vk-pair', kind: 'style', prop: '--vk-pair-gap', expectFromValue: 'px' },
    orientation: { on: 'vk-pair', kind: 'attr', prop: 'data-orientation', expectFromValue: 'raw' },
    // 分色：只染左右两块的面；不写就没有 data-tone，保持透明。
    'tone-a': { on: '.vk-pair-l', kind: 'style', prop: 'background-color', expect: { not: 'rgba(0, 0, 0, 0)' } },
    'tone-b': { on: '.vk-pair-r', kind: 'style', prop: 'background-color', expect: { not: 'rgba(0, 0, 0, 0)' } },
  },

  'vk-flow': {
    // gap 是唯一的间距来源：块距与箭头轨道都读它。
    gap: { on: '.vk-flow', kind: 'style', prop: '--vk-flow-gap', expectFromValue: 'px' },
    // 箭头是运行期按属性建的 DOM：开/关镜像到宿主。
    arrow: { on: 'vk-flow', kind: 'attr', prop: 'data-arrow', expectFromValue: 'raw' },
    // 缩放比例镜像到宿主；算出来的尺寸在 data-arrow-size（place() 写）。
    'arrow-scale': { on: 'vk-flow', kind: 'attr', prop: 'data-arrow-scale', expectFromValue: 'raw' },
    // 中轴词落在真正的文字节点上。
    'arrow-label': { on: '.vk-flow-arrow-label .vk-label-t', kind: 'text' },
  },

  'vk-canvas': {
    w: { on: 'vk-canvas', kind: 'geometry', prop: 'width', skipVisual: true, expectFromValue: 'raw' },
    h: { on: 'vk-canvas', kind: 'geometry', prop: 'height', skipVisual: true, expectFromValue: 'raw' },
    'pad-px': { on: 'vk-canvas vk-box', kind: 'geometry', prop: 'x', skipVisual: true },
  },

  'vk-page': {
    align: { on: 'vk-page', kind: 'style', prop: 'justify-content' },
  },

  'vk-text': {
    // display 160 在 888 高的标本台里必然换行超出；字号本身由 tests/batch-ef.test.mjs 四档守。
    size: { on: 'vk-text', kind: 'style', prop: 'font-size', skipVisual: true },
    weight: { on: 'vk-text', kind: 'style', prop: 'font-weight' },
    ink: { on: 'vk-text', kind: 'style', prop: 'color' },
    tone: { on: 'vk-text', kind: 'style', prop: 'color' },
    mono: { on: 'vk-text', kind: 'style', prop: 'font-family', expect: /mono/i },
    align: { on: 'vk-text', kind: 'style', prop: 'text-align' },
    measure: { on: 'vk-text', kind: 'style', prop: 'max-width' },
    // fit="width" 会改写 inline font-size；fit-max / fit-min 是它的两个边界。
    fit: { on: 'vk-text', kind: 'style', prop: 'font-size', expect: { not: '56px' }, skipVisual: true },
    'fit-min': { on: 'vk-text', kind: 'style', prop: 'font-size', expectFromValue: 'px', skipVisual: true },
    'fit-max': { on: 'vk-text', kind: 'style', prop: 'font-size', expectFromValue: 'px', skipVisual: true },
  },

  'vk-label': {
    // 三种形态的差别是「底」：kicker 透明、chip 浅底、badge 实色。
    variant: { on: '.vk-label', kind: 'style', prop: 'background-color' },
    // 语义色落在字上（与 vk-text / vk-icon 同一套 token）。
    tone: { on: 'vk-label', kind: 'style', prop: 'color' },
    ink: { on: 'vk-label', kind: 'style', prop: 'color' },
    // 贴块（原 vk-caption）：for / anchor 先镜像到宿主（块里的标签也镜像，
    // 契约才读得到"改了就变"）；真正的落点由 draw() 的几何算。
    for: { on: 'vk-label', kind: 'attr', prop: 'data-for', expectFromValue: 'raw' },
    anchor: { on: 'vk-label', kind: 'attr', prop: 'data-anchor', expectFromValue: 'raw' },
  },

  'vk-icon': {
    tone: { on: 'vk-icon .vk-icon', kind: 'style', prop: 'color' },
    ink: { on: 'vk-icon .vk-icon', kind: 'style', prop: 'color' },
    size: { on: 'vk-icon svg', kind: 'style', prop: 'width' },
  },

  'vk-img': {
    ratio: { on: 'vk-img', kind: 'style', prop: 'height' },
    fit: { on: 'vk-img img', kind: 'style', prop: 'object-fit' },
    position: { on: 'vk-img img', kind: 'style', prop: 'object-position' },
    radius: { on: 'vk-img .vk-img', kind: 'style', prop: 'border-radius' },
    w: { on: 'vk-img', kind: 'geometry', prop: 'width' },
    h: { on: 'vk-img', kind: 'geometry', prop: 'height' },
  },

  'vk-rule': {
    variant: { on: 'vk-rule', kind: 'style', prop: 'height' },
    tone: { on: 'vk-rule', kind: 'style', prop: 'background-color' },
  },

  'vk-tree': {
    mass: { on: '.vk-tree-row', kind: 'style', prop: 'min-height', skipVisual: true },

    depth: { on: 'vk-tree', kind: 'geometry', prop: 'height' },
    summary: { on: '.vk-tree-meta', kind: 'style', prop: 'display' },
    chrome: { on: '.vk-tree-hd', kind: 'style', prop: 'display' },
  },

  'vk-bytes': {
    cols: { on: '.vk-bytes-row', kind: 'style', prop: 'grid-template-columns' },
    group: { on: '.vk-bytes-x', kind: 'attr', prop: 'data-group' },
    ascii: { on: 'vk-bytes', kind: 'dom', prop: '.vk-bytes-c' },
    address: { on: 'vk-bytes', kind: 'dom', prop: '.vk-bytes-a' },
    highlight: { on: '.vk-bytes-x i', kind: 'style', prop: 'background-color' },
    mass: { on: '.vk-bytes-row', kind: 'style', prop: 'line-height' },
    chrome: { on: 'vk-bytes', kind: 'dom', prop: '.vk-hd' },
  },

  'vk-mark': {
    tone: { on: 'vk-mark', kind: 'style', prop: '--vk-mark-fill' },
    variant: { kind: 'any', reason: '三种形态分别用底色 / 内阴影 / 删除线，没有单一可比属性。' },
  },

  'vk-tag': {
    tone: { on: 'vk-tag', kind: 'style', prop: 'background-color' },
    size: { on: 'vk-tag', kind: 'style', prop: 'font-size' },
    emphasis: { on: 'vk-tag', kind: 'style', prop: 'border-top-color' },
    bare: { on: 'vk-tag', kind: 'style', prop: 'padding-left' },
  },


  'vk-box': {
    surface: { on: 'vk-box', kind: 'style', prop: 'background-color' },
    tone: { on: 'vk-box', kind: 'style', prop: 'background-color' },
    pad: { on: 'vk-box', kind: 'style', prop: 'padding-top' },
    'pad-x': { on: 'vk-box', kind: 'style', prop: 'padding-left' },
    'pad-y': { on: 'vk-box', kind: 'style', prop: 'padding-top' },
    radius: { on: 'vk-box', kind: 'style', prop: 'border-radius' },
    border: { on: 'vk-box', kind: 'style', prop: 'border-top-width' },
    // 描边环（原 vk-ring）：一圈 box-shadow，不占布局。
    ring: { on: 'vk-box', kind: 'style', prop: 'box-shadow', expect: { not: 'none' } },
    w: { on: 'vk-box', kind: 'geometry', prop: 'width' },
    h: { on: 'vk-box', kind: 'geometry', prop: 'height', skipVisual: true },
  },

  'vk-panel': {
    // variant 与 tone 都先落在「这一块的底」上：四种表面 + 五色 wash/tint 是同一套色阶。
    variant: { on: 'vk-panel', kind: 'style', prop: 'background-color' },
    tone: { on: 'vk-panel', kind: 'style', prop: 'background-color' },
    // 标题带是一个 vk-label：title 改了，带里的字必须跟着改。
    title: { on: '.vk-panel-hd .vk-label-t', kind: 'text', expect: 'VKPROBE' },
    // chrome="dots" 长出三点窗头（原 vk-window）：数一数真的有三枚点。
    chrome: { kind: 'dom', prop: '.vk-dots i' },
    pad: { on: '.vk-panel-bd', kind: 'style', prop: 'padding-top' },
    radius: { on: 'vk-panel', kind: 'style', prop: 'border-radius' },
    border: { on: 'vk-panel', kind: 'style', prop: 'border-top-width' },
    // w / h 是 COMMON 的 canvas-child 协议（契约按 context 跳过），不在这里重复声明。
  },


  'vk-table': {
    stripe: { on: 'tbody tr', kind: 'style', prop: 'background-color', expect: { not: 'rgba(0, 0, 0, 0)' } },
    mono: { on: 'tbody td', kind: 'style', prop: 'font-family', expect: /mono/i },
    mass: { on: 'tbody td', kind: 'style', prop: 'padding-top', skipVisual: true },
    variant: { on: 'tbody td', kind: 'style', prop: 'padding-top' },
  },

  'vk-edge': {
    variant: { on: 'svg path', kind: 'attr', prop: 'd' },
    tension: { on: 'svg path', kind: 'attr', prop: 'd' },
    'gap-px': { on: 'svg path', kind: 'attr', prop: 'd' },
    bend: { on: 'svg path', kind: 'attr', prop: 'd' },
    tone: { on: 'svg path', kind: 'style', prop: 'stroke' },
    emphasis: { on: '.vk-edge-path', kind: 'style', prop: 'stroke' },
    'from-side': { kind: 'any', reason: '单场景只对部分边几何有效；强制边背对目标时会退回自动选边。' },
    'to-side': { kind: 'any', reason: '同上：只有目标在那一侧时才生效。' },
    arrow: { on: 'svg path', kind: 'attr', prop: 'd' },
    'arrow-style': { on: '.vk-edge-tip', kind: 'attr', prop: 'data-style' },
    'arrow-size': { on: 'svg path', kind: 'attr', prop: 'd' },
    dash: { on: 'svg path', kind: 'style', prop: 'stroke-dasharray', expect: { not: 'none' } },
    label: { on: '.vk-edge-label', kind: 'text' },
    cap: { on: 'svg circle', kind: 'style', prop: 'display' },
    z: { on: 'vk-edge', kind: 'style', prop: 'z-index', expectFromValue: 'raw' },
  },

  'vk-code': {
    // current 是公开名（line 是它的隐藏别名）；highlight 是旧声明名，保留一版。
    current: { on: '.vk-line', kind: 'style', prop: 'background-color' },
    highlight: { on: '.vk-line', kind: 'style', prop: 'background-color' },
    focus: { on: '.vk-line', kind: 'style', prop: 'opacity' },
    fold: { on: 'svg', kind: 'dom', prop: '.vk-line' },
    // 表面换的是 .vk-win 上的一整组材质变量；底色是最直接的证据。
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    // 逐行浮现 / 不参与出场：静态画面不变，data-reveal 是声明的证据。
    reveal: { on: 'vk-code', kind: 'attr', prop: 'data-reveal', expectFromValue: 'raw' },
    mass: { on: '.vk-line', kind: 'style', prop: 'min-height', skipVisual: true },
    chrome: { on: 'vk-code', kind: 'dom', prop: '.vk-hd' },
    numbers: { on: 'vk-code', kind: 'dom', prop: '.vk-ln' },
    // fit 是内容相关状态：换行后高度由内容决定，只验证 white-space 变了。
    long: { on: '.vk-src', kind: 'style', prop: 'white-space', skipVisual: true },
    w: { on: 'vk-code', kind: 'geometry', prop: 'width' },
    mark: { on: '.vk-tok', kind: 'style', prop: 'background-color' },
    // hero 档会把组件撑到整帧，标本台放不下；只验样式变了，不跑视觉审计。
  },

  'vk-caption': {
    // 换目标：说明框的 x 跟着目标首字符走。
    for: { on: '.vk-caption', kind: 'geometry', prop: 'x', expect: { not: '0px' } },
    // above / below 落在宿主的 data-anchor 上；实际 top 由 draw() 算。
    anchor: { on: 'vk-caption', kind: 'attr', prop: 'data-anchor', expectFromValue: 'raw' },
  },
};

/* ---------------------------------------------------------------- v10 共享骨架
   块级组件都拿 Frame 的 w/h/grow/fill/overflow/measure。
   这些是布局契约，不算"每个组件独有的外观"；视觉验收由真实帧负责，
   契约只断言属性确实改了 computed/geometry。 */
const COMMON = {
  w: { on: '@', kind: 'geometry', prop: 'width' },
  h: { on: '@', kind: 'geometry', prop: 'height' },
  grow: { on: '@', kind: 'style', prop: 'flex-grow', expect: { to: '1' } },
  fill: { on: '@', kind: 'attr', prop: 'fill', expect: { to: '' } },
  overflow: { on: '@', kind: 'style', prop: 'overflow' },
  measure: { on: '@', kind: 'style', prop: 'max-width', expect: { not: 'none' } },
};

const COMMON_TAGS = [
  'vk-box', 'vk-panel', 'vk-text', 'vk-stack', 'vk-grid', 'vk-pair', 'vk-flow', 'vk-rule',
  'vk-list', 'vk-code', 'vk-term', 'vk-diff', 'vk-table',
  'vk-math', 'vk-compare', 'vk-window', 'vk-tree', 'vk-cells', 'vk-bytes',
  'vk-steps', 'vk-bits', 'vk-bars', 'vk-asm', 'vk-timeline',
];
for (const tag of COMMON_TAGS) {
  const own = EFFECTS[tag] || {};
  const merged = {};
  for (const [name, effect] of Object.entries(COMMON)) {
    merged[name] = { ...effect, on: effect.on === '@' ? tag : effect.on };
  }
  EFFECTS[tag] = { ...merged, ...own };
}

/* 组件特有的 v10 属性 */
Object.assign(EFFECTS['vk-text'], {
  emphasis: { on: 'vk-text', kind: 'style', prop: 'color' },
  // 图标槽（原 vk-icon）：写了才出现，改名字只换这一个 span。
  icon: { on: 'vk-text', kind: 'dom', prop: '.vk-text-ic' },
});
Object.assign(EFFECTS['vk-icon'], {
  emphasis: { on: 'vk-icon .vk-icon', kind: 'style', prop: 'color' },
  size: { on: 'vk-icon svg', kind: 'style', prop: 'width' },
});
Object.assign(EFFECTS['vk-img'], {
  border: { on: 'vk-img .vk-img', kind: 'style', prop: 'border-top-width' },
});
Object.assign(EFFECTS['vk-mark'], {
  // variant 与 type 共用同一组 CSS；type 的 border-top-width 已覆盖。
});
Object.assign(EFFECTS['vk-rule'], {
  variant: { on: 'vk-rule', kind: 'style', prop: 'height' },
  dash: { on: 'vk-rule', kind: 'style', prop: 'background-image', expect: { not: 'none' } },
});
Object.assign(EFFECTS['vk-list'], {
  variant: { kind: 'any', reason: '四种形态只换条目标记字形，不改高度；无法用单一几何/样式断言。' },
});
Object.assign(EFFECTS['vk-diff'], {
  variant: { on: 'vk-diff', kind: 'geometry', prop: 'height', skipVisual: true },
  long: { on: '.vk-dsrc', kind: 'style', prop: 'white-space', skipVisual: true },
  numbers: { on: 'vk-diff', kind: 'dom', prop: '.vk-ln' },
  summary: { on: '.vk-dmeta', kind: 'style', prop: 'display' },
});
Object.assign(EFFECTS['vk-code'], {
  long: { on: '.vk-src', kind: 'style', prop: 'white-space', skipVisual: true },
  numbers: { on: 'vk-code', kind: 'dom', prop: '.vk-ln' },
});
Object.assign(EFFECTS['vk-term'], {
  long: { on: '.vk-txt', kind: 'style', prop: 'white-space', skipVisual: true },
});
Object.assign(EFFECTS['vk-table'], {
});
Object.assign(EFFECTS['vk-steps'], {
  mass: { on: '.vk-step-n', kind: 'style', prop: 'width' },
});
Object.assign(EFFECTS['vk-cells'], {
  stride: { kind: 'any', reason: '只在字节模式下改变地址步长' },
  mass: { on: '.vk-cell', kind: 'style', prop: 'min-height', skipVisual: true },
});
Object.assign(EFFECTS['vk-grid'], {
  justify: { on: 'vk-grid', kind: 'style', prop: 'justify-items' },
});
Object.assign(EFFECTS['vk-edge'], {
  'label-size': { on: '.vk-edge-label', kind: 'style', prop: 'font-size' },
  'label-dx': { on: '.vk-edge-label', kind: 'style', prop: 'left' },
  'label-dy': { on: '.vk-edge-label', kind: 'style', prop: 'top' },
});
Object.assign(EFFECTS['vk-tree'], {
  summary: { on: '.vk-tree-meta', kind: 'style', prop: 'display' },
});
Object.assign(EFFECTS['vk-canvas'], {
  overflow: { on: 'vk-canvas', kind: 'style', prop: 'overflow-x', skipVisual: true },
  grid: { on: 'vk-canvas', kind: 'style', prop: 'background-image', expect: { not: 'none' } },
});

/* ---------------------------------------------------------- 5.0 新件 / 升级 */

Object.assign((EFFECTS['vk-asm'] ||= {}), {
  title: { on: '.vk-asm-file', kind: 'text' },
  bytes: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-b', expect: { not: '0' } },
  address: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-a' },
  mass: { on: '.vk-asm-row', kind: 'style', prop: 'min-height', skipVisual: true },
  chrome: { on: '.vk-asm-hd', kind: 'style', prop: 'display' },
  highlight: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-row.is-hl' },
  focus: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-row.is-dim' },
  addr: { on: '.vk-asm-range', kind: 'text' },
  lang: { kind: 'any', reason: '语法在构建期确定，运行时只显示产物' },
  order: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-order' },
  'fence-after': { on: '.vk-asm-fence', kind: 'attr', prop: 'data-fence' },
  'fence-label': { on: '.vk-asm-fence', kind: 'text' },
  // 逐行浮现的声明证据：静态画面不变，data-reveal 说明它参不参与出场。
  reveal: { on: 'vk-asm', kind: 'attr', prop: 'data-reveal', expectFromValue: 'raw' },
});

Object.assign((EFFECTS['vk-timeline'] ||= {}), {
  title: { on: '.vk-tl-title', kind: 'text' },
  variant: { on: 'vk-timeline', kind: 'dom', prop: '.vk-tl-lanes' },
  steps: { kind: 'any', reason: '只在 lanes 模式下改变步数' },
  mass: { on: '.vk-tl-item', kind: 'style', prop: 'padding-top' },
  // 三档：hero 280（默认）/ title 200（display 别名）/ subhead 112（headline 别名）。
  // 标本写的是 subhead，所以契约只探 title 一档（见 contract-probes 的 PROBES）。
  'value-size': { on: '.vk-tl-value', kind: 'style', prop: 'font-size', expect: '200px' },
});



Object.assign((EFFECTS['vk-compare'] ||= {}), {
  // mode=stack 把两张完整图上下叠：总高由 ratio 与容器宽决定，标本台里必然更高。
  // 这是对照的几何，不是事故；split 默认态仍走完整视觉审计。
  mode: { on: '.vk-cmp', kind: 'style', prop: 'display', expect: 'grid', skipVisual: true },
  position: { on: '.vk-cmp > img', kind: 'style', prop: 'object-position' },
  split: { on: '.vk-cmp-a', kind: 'style', prop: 'clip-path', expect: /inset|polygon|circle/ },
  ratio: { on: '.vk-cmp', kind: 'style', prop: 'aspect-ratio' },
  // top 在图上让出一条 64px 的带：这是"角标不压图"的几何证据。
  'label-position': { on: '.vk-cmp', kind: 'style', prop: 'padding-top', expect: '88px' },
  // 差异框：标注是真实 DOM（数量可数），标签是真实文字。
  mark: { on: '.vk-cmp-mark', kind: 'dom', prop: '.vk-cmp-mark' },
  'mark-label': { on: '.vk-cmp-mark-l', kind: 'text' },
  // 差异放大：宿主上的 data-zoom 是作者写法的镜像；放大块本身由测试逐项量。
  // 标本台里追加一块放大视图会超出安全区，视觉审计交给 zoom 用例。
  zoom: { on: 'vk-compare', kind: 'attr', prop: 'data-zoom', expectFromValue: 'raw', skipVisual: true },
});

/**
 * 关系层合并后的本体。arrow 的四个旋钮都真的改 SVG（d / stroke-width /
 * stroke-dasharray / data-head）；circle / note / badge 的旋钮在同一个宿主上
 * 留下一份规范化状态（data-*），由 CSS 与契约共同读 —— 契约宿主只有第一个
 * vk-annotate（arrow 形态）会被快照，所以形态类的旋钮断言落在宿主上。
 */
Object.assign((EFFECTS['vk-annotate'] ||= {}), {
  mode: { on: 'vk-annotate', kind: 'attr', prop: 'data-mode', expectFromValue: 'raw' },
  for: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
  from: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
  to: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
  shape: { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
  dash: { on: '.vk-edge-path', kind: 'style', prop: 'stroke-dasharray', expect: { not: 'none' } },
  width: { on: '.vk-edge-path', kind: 'style', prop: 'stroke-width', expectFromValue: 'px' },
  head: { on: '.vk-edge-svg', kind: 'attr', prop: 'data-head', expectFromValue: 'raw' },
  note: { on: 'vk-annotate', kind: 'attr', prop: 'data-note', expectFromValue: 'raw' },
  ring: { on: 'vk-annotate', kind: 'attr', prop: 'data-ring', expectFromValue: 'raw' },
  double: { on: 'vk-annotate', kind: 'attr', prop: 'data-double', expect: '2' },
  tone: { on: '.vk-edge-path', kind: 'style', prop: 'stroke' },
  label: { on: '.vk-edge-label', kind: 'text' },
  // 中轴词：新写法优先于 label，落在同一个标签节点上。
  'arrow-label': { on: '.vk-edge-label', kind: 'text' },
  // 缩放比例镜像到宿主；尺寸本身写进 data-arrow-size（draw() 按容器高算）。
  'arrow-scale': { on: 'vk-annotate', kind: 'attr', prop: 'data-arrow-scale', expectFromValue: 'raw' },
  n: { on: 'vk-annotate', kind: 'attr', prop: 'data-n', expectFromValue: 'raw' },
  size: { on: '.vk-edge-label', kind: 'style', prop: 'font-size' },
  emphasis: { on: 'vk-annotate', kind: 'attr', prop: 'data-emphasis', expectFromValue: 'raw' },
  'gap-px': { on: '.vk-edge-path', kind: 'attr', prop: 'd' },
  z: { on: 'vk-annotate', kind: 'style', prop: 'z-index', expectFromValue: 'raw' },
  // note 形态的显式落点；arrow 形态也把请求的 side 镜像到宿主上，契约能读到。
  side: { on: 'vk-annotate', kind: 'attr', prop: 'data-side', expectFromValue: 'raw' },
});

Object.assign((EFFECTS['vk-note'] ||= {}), {
  // 注解原语（批次 G1）：宿主上的 data-* 是作者写法的镜像；
  // 真正的落点在 draw() 的几何里，由 tests/batch-gh.test.mjs 逐条量。
  kind: { on: 'vk-note', kind: 'attr', prop: 'data-kind', expectFromValue: 'raw' },
  side: { on: 'vk-note', kind: 'attr', prop: 'data-side', expectFromValue: 'raw' },
  leader: { on: 'vk-note', kind: 'attr', prop: 'data-leader', expectFromValue: 'raw' },
  place: { on: 'vk-note', kind: 'attr', prop: 'data-place', expectFromValue: 'raw' },
  z: { on: 'vk-note', kind: 'style', prop: 'z-index', expectFromValue: 'raw' },
  // bubble（原 vk-pin）的旋钮：同样先镜像到宿主，落点由 vk-annotate 的 note 形态算。
  tone: { on: 'vk-note', kind: 'attr', prop: 'data-tone', expectFromValue: 'raw' },
  emphasis: { on: 'vk-note', kind: 'attr', prop: 'data-emphasis', expectFromValue: 'raw' },
  size: { on: 'vk-note', kind: 'attr', prop: 'data-size', expectFromValue: 'raw' },
  n: { on: 'vk-note', kind: 'attr', prop: 'data-n', expectFromValue: 'raw' },
  'gap-px': { on: 'vk-note', kind: 'attr', prop: 'data-gap', expectFromValue: 'raw' },
  w: { on: 'vk-note', kind: 'attr', prop: 'data-w', expectFromValue: 'raw' },
  x: { on: 'vk-note', kind: 'attr', prop: 'data-x', expectFromValue: 'raw' },
  y: { on: 'vk-note', kind: 'attr', prop: 'data-y', expectFromValue: 'raw' },
  // for 的取值与几何断言在 tools/lib/contract-probes.mjs（要指到标本里的真实目标）。
});

Object.assign((EFFECTS['vk-pin'] ||= {}), {
  tone: { on: '.vk-pin-bd', kind: 'style', prop: 'border-left-color' },
  emphasis: { on: '.vk-pin-bd', kind: 'style', prop: 'background-color' },
  'gap-px': { on: '.vk-pin-bd', kind: 'style', prop: 'left' },
  w: { on: '.vk-pin-bd', kind: 'geometry', prop: 'width' },
  size: { on: '.vk-pin-bd', kind: 'style', prop: 'font-size' },
  n: { on: '.vk-pin-n', kind: 'text' },
  z: { on: 'vk-pin', kind: 'style', prop: 'z-index', expectFromValue: 'raw' },
  leader: { kind: 'any', reason: '引线有无/形状都改 path' },
  side: { kind: 'any', reason: '自动贴边，位置随目标变化' },
  x: { kind: 'any', reason: '作者写死的气泡坐标' },
  y: { kind: 'any', reason: '作者写死的气泡坐标' },
});

Object.assign((EFFECTS['vk-ring'] ||= {}), {
  variant: { kind: 'any', reason: '矩形/椭圆/下划线是不同 SVG 元素' },
  'pad-px': { on: '.vk-ring-shape', kind: 'geometry', prop: 'width' },
  tone: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke' },
  dash: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke-dasharray', expect: { not: 'none' } },
  width: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke-width' },
  z: { on: 'vk-ring', kind: 'style', prop: 'z-index', expectFromValue: 'raw' },
});

Object.assign((EFFECTS['vk-spotlight'] ||= {}), {
  // 聚光不再画东西：它的唯一产物是"兄弟的 opacity"与目标的 data-vk-focus
  dim: { kind: 'any', reason: '只改兄弟的 opacity，元素本身不画任何东西' },
  keep: { kind: 'any', reason: 'keep 里的元素不退后，其余兄弟退' },
  for: { kind: 'any', reason: '只改兄弟的 opacity 与目标的 data-vk-focus，自己的子树是空的' },
  z: { on: 'vk-spotlight', kind: 'style', prop: 'z-index' },
});

Object.assign(EFFECTS['vk-cells'], {
  offsets: { on: 'vk-cells', kind: 'dom', prop: '.vk-cell-byte', expect: { not: '0' } },
  direction: { kind: 'any', reason: '只在字节模式下改变字节尺方向' },
  ruler: { kind: 'any', reason: '只在字节模式下画对齐括号' },
});

Object.assign(EFFECTS['vk-bytes'], {
  word: { on: 'vk-bytes', kind: 'dom', prop: '.vk-bytes-w' },
  endian: { on: '.vk-bytes-x', kind: 'attr', prop: 'data-endian' },
});

Object.assign(EFFECTS['vk-edge'], {
  via: { on: 'svg path', kind: 'attr', prop: 'd' },
});

Object.assign((EFFECTS['vk-rule'] ||= {}), {
  orientation: { on: 'vk-rule', kind: 'style', prop: 'width' },
});

Object.assign((EFFECTS['vk-steps'] ||= {}), {
  orientation: { on: '.vk-steps', kind: 'style', prop: 'flex-direction' },
  // 箭头 / 细线 / 不画：落到 .vk-steps 的 data-connector 上，由一条 CSS 决定。
  connector: { on: '.vk-steps', kind: 'attr', prop: 'data-connector' },
  // 地图页：done="none" 不把前几步画成已完成；data-done 是声明的证据。
  done: { on: 'vk-steps', kind: 'attr', prop: 'data-done', expectFromValue: 'raw' },
  // 只强调某一步：data-mark 记的是 0 起的那一步；状态差异由测试守。
  mark: { on: 'vk-steps', kind: 'attr', prop: 'data-mark', expectFromValue: 'raw' },
});

Object.assign(EFFECTS['vk-asm'], {
  'address-label': { on: '.vk-asm-a', kind: 'text' },
  'bytes-label': { on: '.vk-asm-b', kind: 'text' },
  'mnemonic-label': { on: '.vk-asm-m', kind: 'text' },
  'operands-label': { on: '.vk-asm-o', kind: 'text' },
});










