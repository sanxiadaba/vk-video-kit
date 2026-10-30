/**
 * 契约：每个公开属性「应该改变什么」。
 *
 * 这是门禁的声明面，不是实现说明。`on` 是组件内部的选择器；`prop` 是
 * 计算样式名、属性名、几何量，或（kind=dom）要计数的选择器。
 */
export const EFFECTS = {
  'vk-list': {
    rule: { on: 'vk-list', kind: 'geometry', prop: 'height' },
    bare: { on: 'vk-list li', kind: 'style', prop: 'padding-left' },
    gap: { on: 'vk-list', kind: 'geometry', prop: 'height' },
  },

  'vk-steps': {
    current: { on: 'vk-steps', kind: 'style', prop: 'color' },
  },

  'vk-cells': {
    cols: { on: 'vk-cells', kind: 'style', prop: 'grid-template-columns' },
  },

  'vk-term': {
    chrome: { on: 'vk-term', kind: 'dom', prop: '.vk-hd' },
    density: { on: '.vk-line', kind: 'style', prop: 'min-height' },
    w: { on: 'vk-term', kind: 'geometry', prop: 'width' },
  },

  'vk-figure': {
    fit: { on: 'vk-figure img', kind: 'style', prop: 'object-fit' },
    position: { on: 'vk-figure img', kind: 'style', prop: 'object-position' },
    crop: { on: '.vk-fig-crop', kind: 'style', prop: 'left' },
    'crop-label': { on: '.vk-fig-crop-label', kind: 'text' },
    chrome: { on: 'vk-figure .vk-hd', kind: 'style', prop: 'display' },
    w: { on: 'vk-figure', kind: 'geometry', prop: 'width' },
  },

  'vk-window': {
    title: { on: '.vk-file', kind: 'text' },
    chrome: { on: '.vk-hd', kind: 'style', prop: 'display' },
    tone: { on: '.vk-win', kind: 'style', prop: 'border-top-color' },
    pad: { on: '.vk-win-bd', kind: 'style', prop: 'padding-top' },
    w: { on: 'vk-window', kind: 'geometry', prop: 'width' },
  },

  'vk-quote': {
    variant: { on: '.vk-quote', kind: 'style', prop: 'border-left-width' },
    size: { on: '.vk-quote', kind: 'style', prop: 'font-size' },
  },

  'vk-panel': {
    variant: { on: '.vk-panel', kind: 'attr', prop: 'data-variant' },
    surface: { on: '.vk-panel', kind: 'style', prop: 'background-color' },
    pad: { on: '.vk-panel', kind: 'style', prop: 'padding-top' },
    border: { on: '.vk-panel', kind: 'style', prop: 'border-top-color' },
    radius: { on: '.vk-panel', kind: 'style', prop: 'border-top-left-radius' },
    n: { on: '.vk-panel-n', kind: 'text' },
  },

  'vk-stat': {
    value: { on: '.vk-stat-v', kind: 'text' },
    unit: { on: '.vk-stat-u', kind: 'text' },
    label: { on: '.vk-stat-l', kind: 'text' },
    size: { on: '.vk-stat-v', kind: 'style', prop: 'font-size' },
    tone: { on: '.vk-stat-v', kind: 'style', prop: 'color' },
    mark: { on: '.vk-stat', kind: 'attr', prop: 'data-mark' },
    align: { on: '.vk-stat', kind: 'style', prop: 'text-align' },
    format: { kind: 'any', reason: '改的是数字写法（千分位/十六进制），要配合 value 才看得出变化' },
  },

  'vk-bits': {
    index: { on: '.vk-bit-i', kind: 'text' },
    group: { kind: 'any', reason: 'group 只改分隔线的粗细/位置，没有单一可比属性' },
    sign: { on: '.vk-bit', kind: 'style', prop: 'background-color' },
    tone: { on: '.vk-bit', kind: 'style', prop: 'color' },
    width: { on: 'vk-bits', kind: 'dom', prop: '.vk-bit' },
    bytes: { on: '.vk-bits', kind: 'style', prop: 'border-bottom-width' },
  },

  'vk-bars': {
    max: { on: '.vk-bar-fill', kind: 'style', prop: 'width' },
    scale: { on: '.vk-bar-fill', kind: 'style', prop: 'width' },
    density: { on: '.vk-bar', kind: 'style', prop: 'min-height' },
    tone: { on: '.vk-bar-fill', kind: 'style', prop: 'background-color' },
  },

  'vk-diff': {
    variant: { on: 'vk-diff', kind: 'geometry', prop: 'height', skipVisual: true },
    chrome: { on: 'vk-diff .vk-hd', kind: 'style', prop: 'display' },
    summary: { on: '.vk-dmeta', kind: 'style', prop: 'display' },
    w: { on: 'vk-diff', kind: 'geometry', prop: 'width' },
    numbers: { on: 'vk-diff', kind: 'dom', prop: '.vk-ln' },
  },

  'vk-math': {
    display: { on: 'vk-math', kind: 'style', prop: 'display' },
    size: { on: 'vk-math .katex', kind: 'style', prop: 'font-size' },
  },

  'vk-stack': {
    gap: { on: 'vk-stack', kind: 'style', prop: 'row-gap' },
    align: { on: 'vk-stack', kind: 'style', prop: 'align-items' },
    justify: { on: 'vk-stack', kind: 'style', prop: 'justify-content' },
  },

  'vk-row': {
    gap: { on: 'vk-row', kind: 'style', prop: 'column-gap' },
    align: { on: 'vk-row', kind: 'style', prop: 'align-items' },
    justify: { on: 'vk-row', kind: 'style', prop: 'justify-content' },
    wrap: { on: 'vk-row', kind: 'style', prop: 'flex-wrap' },
  },

  'vk-grid': {
    cols: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns', skipVisual: true },
    tracks: { on: 'vk-grid', kind: 'style', prop: 'grid-template-columns', skipVisual: true },
    gap: { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-x': { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-y': { on: 'vk-grid', kind: 'style', prop: 'row-gap' },
    align: { on: 'vk-grid', kind: 'style', prop: 'align-items' },
  },

  'vk-canvas': {
    w: { on: 'vk-canvas', kind: 'geometry', prop: 'width', skipVisual: true },
    h: { on: 'vk-canvas', kind: 'geometry', prop: 'height', skipVisual: true },
    'pad-px': { on: 'vk-canvas vk-box', kind: 'geometry', prop: 'x', skipVisual: true },
  },

  'vk-page': {
    align: { on: 'vk-page', kind: 'style', prop: 'justify-content' },
  },

  'vk-text': {
    size: { on: 'vk-text', kind: 'style', prop: 'font-size' },
    weight: { on: 'vk-text', kind: 'style', prop: 'font-weight' },
    ink: { on: 'vk-text', kind: 'style', prop: 'color' },
    mono: { on: 'vk-text', kind: 'style', prop: 'font-family' },
    align: { on: 'vk-text', kind: 'style', prop: 'text-align' },
    measure: { on: 'vk-text', kind: 'style', prop: 'max-width' },
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
    density: { on: '.vk-bytes-row', kind: 'style', prop: 'line-height' },
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

  'vk-callout': {
    tone: { on: '.vk-callout', kind: 'style', prop: 'border-left-color' },
    size: { on: 'vk-callout', kind: 'style', prop: 'font-size' },
    flat: { on: '.vk-callout', kind: 'style', prop: 'background-color' },
  },

  'vk-box': {
    surface: { on: 'vk-box', kind: 'style', prop: 'background-color' },
    tone: { on: 'vk-box', kind: 'style', prop: 'background-color' },
    pad: { on: 'vk-box', kind: 'style', prop: 'padding-top' },
    'pad-x': { on: 'vk-box', kind: 'style', prop: 'padding-left' },
    'pad-y': { on: 'vk-box', kind: 'style', prop: 'padding-top' },
    radius: { on: 'vk-box', kind: 'style', prop: 'border-radius' },
    border: { on: 'vk-box', kind: 'style', prop: 'border-top-width' },
    w: { on: 'vk-box', kind: 'geometry', prop: 'width' },
    h: { on: 'vk-box', kind: 'geometry', prop: 'height', skipVisual: true },
  },

  'vk-title': {
    size: { on: '.vk-title-main', kind: 'style', prop: 'font-size' },
    align: { on: '.vk-title', kind: 'style', prop: 'text-align' },
    level: { on: '.vk-title-main', kind: 'attr', prop: 'aria-level' },
  },

  'vk-table': {
    stripe: { on: 'tbody tr', kind: 'style', prop: 'background-color' },
    mono: { on: 'tbody td', kind: 'style', prop: 'font-family' },
    density: { on: 'tbody td', kind: 'style', prop: 'padding-top' },
    variant: { on: 'tbody td', kind: 'style', prop: 'padding-top' },
  },

  'vk-edge': {
    variant: { on: 'svg path', kind: 'attr', prop: 'd' },
    tension: { on: 'svg path', kind: 'attr', prop: 'd' },
    'from-side': { kind: 'any', reason: '单场景只对部分边几何有效；强制边背对目标时会退回自动选边。' },
    'to-side': { kind: 'any', reason: '单场景只对部分边几何有效；强制边背对目标时会退回自动选边。' },
    'gap-px': { on: 'svg path', kind: 'attr', prop: 'd' },
    bend: { on: 'svg path', kind: 'attr', prop: 'd' },
    tone: { on: 'svg path', kind: 'style', prop: 'stroke' },
    emphasis: { kind: 'any', reason: 'solid 等于默认态；ghost 改用细线，没有可比的单一属性' },
    arrow: { on: 'svg path', kind: 'attr', prop: 'd' },
    'arrow-style': { on: '.vk-edge-tip', kind: 'attr', prop: 'data-style' },
    'arrow-size': { on: 'svg path', kind: 'attr', prop: 'd' },
    dash: { on: 'svg path', kind: 'style', prop: 'stroke-dasharray' },
    label: { on: '.vk-edge-label', kind: 'text' },
    cap: { on: 'svg circle', kind: 'style', prop: 'display' },
    z: { on: 'vk-edge', kind: 'style', prop: 'z-index' },
  },

  'vk-code': {
    highlight: { on: '.vk-line', kind: 'style', prop: 'background-color' },
    focus: { on: '.vk-line', kind: 'style', prop: 'opacity' },
    fold: { on: 'svg', kind: 'dom', prop: '.vk-line' },
    density: { on: '.vk-line', kind: 'style', prop: 'min-height' },
    chrome: { on: 'vk-code', kind: 'dom', prop: '.vk-hd' },
    numbers: { on: 'vk-code', kind: 'dom', prop: '.vk-ln' },
    // fit 是内容相关状态：换行后高度由内容决定，只验证 white-space 变了。
    long: { on: '.vk-src', kind: 'style', prop: 'white-space', skipVisual: true },
    w: { on: 'vk-code', kind: 'geometry', prop: 'width' },
    mark: { on: '.vk-tok', kind: 'style', prop: 'background-color' },
  },
};

/* ---------------------------------------------------------------- v10 共享骨架
   块级组件都拿 Frame 的 w/h/grow/fill/overflow/measure。
   这些是布局契约，不算"每个组件独有的外观"；视觉验收由真实帧负责，
   契约只断言属性确实改了 computed/geometry。 */
const COMMON = {
  w: { on: '@', kind: 'geometry', prop: 'width' },
  h: { on: '@', kind: 'geometry', prop: 'height' },
  grow: { on: '@', kind: 'style', prop: 'flex-grow' },
  fill: { on: '@', kind: 'attr', prop: 'fill' },
  overflow: { on: '@', kind: 'style', prop: 'overflow' },
  measure: { on: '@', kind: 'style', prop: 'max-width' },
};

const COMMON_TAGS = [
  'vk-box', 'vk-text', 'vk-stack', 'vk-row', 'vk-grid', 'vk-rule', 'vk-title',
  'vk-list', 'vk-callout', 'vk-code', 'vk-term', 'vk-diff', 'vk-table',
  'vk-math', 'vk-figure', 'vk-window', 'vk-tree', 'vk-cells', 'vk-bytes',
  'vk-steps', 'vk-quote', 'vk-bits', 'vk-bars', 'vk-asm', 'vk-timeline',
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
  dash: { on: 'vk-rule', kind: 'style', prop: 'background-image' },
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
Object.assign(EFFECTS['vk-callout'], {
  density: { on: '.vk-callout', kind: 'style', prop: 'padding-top' },
});
Object.assign(EFFECTS['vk-steps'], {
  density: { on: '.vk-step-n', kind: 'style', prop: 'width' },
});
Object.assign(EFFECTS['vk-cells'], {
  stride: { kind: 'any', reason: '只在字节模式下改变地址步长' },
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
  grid: { on: 'vk-canvas', kind: 'style', prop: 'background-image' },
});

/* ---------------------------------------------------------- 5.0 新件 / 升级 */

Object.assign((EFFECTS['vk-asm'] ||= {}), {
  title: { on: '.vk-asm-file', kind: 'text' },
  bytes: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-b' },
  address: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-a' },
  density: { on: '.vk-asm-row', kind: 'style', prop: 'min-height' },
  chrome: { on: '.vk-asm-hd', kind: 'style', prop: 'display' },
  highlight: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-row.is-hl' },
  focus: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-row.is-dim' },
  addr: { on: '.vk-asm-range', kind: 'text' },
  lang: { kind: 'any', reason: '语法在构建期确定，运行时只显示产物' },
  order: { on: 'vk-asm', kind: 'dom', prop: '.vk-asm-order' },
  'fence-after': { on: '.vk-asm-fence', kind: 'attr', prop: 'data-fence' },
  'fence-label': { on: '.vk-asm-fence', kind: 'text' },
});

Object.assign((EFFECTS['vk-timeline'] ||= {}), {
  title: { on: '.vk-tl-title', kind: 'text' },
  variant: { on: 'vk-timeline', kind: 'dom', prop: '.vk-tl-lanes' },
  steps: { kind: 'any', reason: '只在 lanes 模式下改变步数' },
  density: { on: '.vk-tl-item', kind: 'style', prop: 'padding-top' },
});

Object.assign((EFFECTS['vk-pin'] ||= {}), {
  tone: { on: '.vk-pin-bd', kind: 'style', prop: 'border-left-color' },
  emphasis: { on: '.vk-pin-bd', kind: 'style', prop: 'background-color' },
  'gap-px': { on: '.vk-pin-bd', kind: 'style', prop: 'left' },
  w: { on: '.vk-pin-bd', kind: 'geometry', prop: 'width' },
  size: { on: '.vk-pin-bd', kind: 'style', prop: 'font-size' },
  n: { on: '.vk-pin-n', kind: 'text' },
  z: { on: 'vk-pin', kind: 'style', prop: 'z-index' },
  leader: { kind: 'any', reason: '引线有无/形状都改 path' },
  side: { kind: 'any', reason: '自动贴边，位置随目标变化' },
  x: { kind: 'any', reason: '作者写死的气泡坐标' },
  y: { kind: 'any', reason: '作者写死的气泡坐标' },
});

Object.assign((EFFECTS['vk-ring'] ||= {}), {
  variant: { kind: 'any', reason: '矩形/椭圆/下划线是不同 SVG 元素' },
  'pad-px': { on: '.vk-ring-shape', kind: 'geometry', prop: 'width' },
  tone: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke' },
  dash: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke-dasharray' },
  width: { on: '.vk-ring-shape', kind: 'style', prop: 'stroke-width' },
  z: { on: 'vk-ring', kind: 'style', prop: 'z-index' },
});

Object.assign((EFFECTS['vk-spotlight'] ||= {}), {
  dim: { on: '.vk-ov-svg > rect', kind: 'style', prop: 'opacity' },
  feather: { kind: 'any', reason: '0 时没有 filter，非 0 才有' },
  variant: { kind: 'any', reason: '矩形/椭圆的 mask 形状不同' },
  z: { on: 'vk-spotlight', kind: 'style', prop: 'z-index' },
});

Object.assign(EFFECTS['vk-cells'], {
  offsets: { on: 'vk-cells', kind: 'dom', prop: '.vk-cell-byte' },
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
});

Object.assign(EFFECTS['vk-asm'], {
  'address-label': { on: '.vk-asm-a', kind: 'text' },
  'bytes-label': { on: '.vk-asm-b', kind: 'text' },
  'mnemonic-label': { on: '.vk-asm-m', kind: 'text' },
  'operands-label': { on: '.vk-asm-o', kind: 'text' },
});