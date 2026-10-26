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
    flag: { on: 'vk-cells', kind: 'style', prop: 'background-color' },
  },

  'vk-term': {
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    caret: { on: 'vk-term', kind: 'dom', prop: '.vk-caret' },
    chrome: { on: 'vk-term', kind: 'dom', prop: '.vk-hd' },
    density: { on: '.vk-bd', kind: 'style', prop: 'font-size' },
    w: { on: 'vk-term', kind: 'geometry', prop: 'width' },
  },

  'vk-figure': {
    fit: { on: 'vk-figure img', kind: 'style', prop: 'object-fit' },
    position: { on: 'vk-figure img', kind: 'style', prop: 'object-position' },
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    chrome: { on: 'vk-figure .vk-hd', kind: 'style', prop: 'display' },
    w: { on: 'vk-figure', kind: 'geometry', prop: 'width' },
    bare: { on: 'vk-figure', kind: 'style', prop: 'background-color' },
  },

  'vk-browser': {
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    chrome: { on: 'vk-browser .vk-hd', kind: 'style', prop: 'display' },
    w: { on: 'vk-browser', kind: 'geometry', prop: 'width' },
  },

  'vk-diff': {
    variant: { on: 'vk-diff', kind: 'geometry', prop: 'height', skipVisual: true },
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
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
    gap: { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-x': { on: 'vk-grid', kind: 'style', prop: 'column-gap' },
    'gap-y': { on: 'vk-grid', kind: 'style', prop: 'row-gap' },
    align: { on: 'vk-grid', kind: 'style', prop: 'align-items' },
  },

  'vk-canvas': {
    w: { on: 'vk-canvas', kind: 'geometry', prop: 'width', skipVisual: true },
    h: { on: 'vk-canvas', kind: 'geometry', prop: 'height', skipVisual: true },
    pad: { on: 'vk-canvas vk-box', kind: 'geometry', prop: 'x', skipVisual: true },
  },

  'vk-page': {
    align: { on: 'vk-page', kind: 'style', prop: 'justify-content' },
  },

  'vk-text': {
    size: { on: 'vk-text', kind: 'style', prop: 'font-size' },
    weight: { on: 'vk-text', kind: 'style', prop: 'font-weight' },
    tone: { on: 'vk-text', kind: 'style', prop: 'color' },
    mono: { on: 'vk-text', kind: 'style', prop: 'font-family' },
    align: { on: 'vk-text', kind: 'style', prop: 'text-align' },
    measure: { on: 'vk-text', kind: 'style', prop: 'max-width' },
  },

  'vk-icon': {
    tone: { on: 'vk-icon .vk-icon', kind: 'style', prop: 'color' },
    emphasis: { on: 'vk-icon .vk-icon', kind: 'style', prop: 'color' },
    scale: { on: 'vk-icon svg', kind: 'style', prop: 'width' },
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
  },

  'vk-tree': {
    depth: { on: 'vk-tree', kind: 'geometry', prop: 'height' },
    summary: { on: '.vk-tree-meta', kind: 'style', prop: 'display' },
    variant: { on: '.vk-tree', kind: 'attr', prop: 'data-variant' },
  },

  'vk-bytes': {
    cols: { on: '.vk-bytes-row', kind: 'style', prop: 'grid-template-columns' },
    group: { on: '.vk-bytes-x', kind: 'attr', prop: 'data-group' },
    ascii: { on: 'vk-bytes', kind: 'dom', prop: '.vk-bytes-c' },
    address: { on: 'vk-bytes', kind: 'dom', prop: '.vk-bytes-a' },
    highlight: { on: '.vk-bytes-x i', kind: 'style', prop: 'background-color' },
    density: { on: '.vk-bytes-row', kind: 'style', prop: 'line-height' },
  },

  'vk-frames': {
    active: { on: '.vk-frame', kind: 'style', prop: 'background-color' },
    grows: { on: 'vk-frames', kind: 'text', prop: '.vk-frame-n' },
    show: { on: 'vk-frames', kind: 'dom', prop: '.vk-frame-sa' },
    density: { on: '.vk-frame-slot', kind: 'style', prop: 'line-height' },
  },

  'vk-mark': {
    tone: { on: 'vk-mark', kind: 'style', prop: '--vk-mark-fill' },
    variant: { on: 'vk-mark', kind: 'style', prop: 'border-top-width' },
  },

  'vk-tag': {
    tone: { on: 'vk-tag', kind: 'style', prop: 'background-color' },
    size: { on: 'vk-tag', kind: 'style', prop: 'font-size' },
    bare: { on: 'vk-tag', kind: 'style', prop: 'padding-left' },
  },

  'vk-callout': {
    tone: { on: '.vk-callout', kind: 'style', prop: 'border-left-color' },
    size: { on: 'vk-callout', kind: 'style', prop: 'font-size' },
    flat: { on: '.vk-callout', kind: 'style', prop: 'background-color' },
  },

  'vk-note': {
    tone: { on: '.vk-note', kind: 'style', prop: '--vk-note-line' },
    size: { on: '.vk-note', kind: 'style', prop: 'font-size' },
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
  },

  'vk-table': {
    stripe: { on: 'tbody tr', kind: 'style', prop: 'background-color' },
    mono: { on: 'tbody td', kind: 'style', prop: 'font-family' },
    density: { on: 'tbody td', kind: 'style', prop: 'padding-top' },
    variant: { on: 'tbody td', kind: 'style', prop: 'padding-top' },
  },

  'vk-edge': {
    shape: { on: 'svg path', kind: 'attr', prop: 'd' },
    tension: { on: 'svg path', kind: 'attr', prop: 'd' },
    'from-side': { on: 'svg path', kind: 'attr', prop: 'd' },
    'to-side': { on: 'svg path', kind: 'attr', prop: 'd' },
    gap: { on: 'svg path', kind: 'attr', prop: 'd' },
    bend: { on: 'svg path', kind: 'attr', prop: 'd' },
    tone: { on: 'svg path', kind: 'style', prop: 'stroke' },
    arrow: { on: 'svg path', kind: 'attr', prop: 'd' },
    'arrow-style': { on: '.vk-edge-tip', kind: 'attr', prop: 'data-style' },
    'arrow-size': { on: 'svg path', kind: 'attr', prop: 'd' },
    dash: { on: 'svg path', kind: 'style', prop: 'stroke-dasharray' },
    label: { on: '.vk-edge-label', kind: 'text' },
    cap: { on: 'svg circle', kind: 'style', prop: 'display' },
  },

  'vk-code': {
    highlight: { on: '.vk-line', kind: 'style', prop: 'background-color' },
    focus: { on: '.vk-line', kind: 'style', prop: 'opacity' },
    fold: { on: 'svg', kind: 'dom', prop: '.vk-line' },
    density: { on: '.vk-bd', kind: 'style', prop: 'font-size' },
    chrome: { on: 'vk-code', kind: 'dom', prop: '.vk-hd' },
    surface: { on: '.vk-win', kind: 'style', prop: 'background-color' },
    numbers: { on: 'vk-code', kind: 'dom', prop: '.vk-ln' },
    // fit 是内容相关状态：换行后高度由内容决定，只验证 white-space 变了。
    fit: { on: '.vk-src', kind: 'style', prop: 'white-space', skipVisual: true },
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
  'vk-math', 'vk-figure', 'vk-browser', 'vk-tree', 'vk-cells', 'vk-bytes',
  'vk-frames', 'vk-steps', 'vk-note',
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
  scale: { on: 'vk-icon svg', kind: 'style', prop: 'width' },
});
Object.assign(EFFECTS['vk-img'], {
  border: { on: 'vk-img .vk-img', kind: 'style', prop: 'border-top-width' },
});
Object.assign(EFFECTS['vk-mark'], {
  // variant 与 type 共用同一组 CSS；type 的 border-top-width 已覆盖。
});
Object.assign(EFFECTS['vk-rule'], {
  variant: { on: 'vk-rule', kind: 'style', prop: 'height' },
});
Object.assign(EFFECTS['vk-list'], {
  variant: { on: 'vk-list', kind: 'geometry', prop: 'height' },
});
Object.assign(EFFECTS['vk-diff'], {
  variant: { on: 'vk-diff', kind: 'geometry', prop: 'height', skipVisual: true },
  fit: { on: '.vk-dsrc', kind: 'style', prop: 'white-space', skipVisual: true },
  numbers: { on: 'vk-diff', kind: 'dom', prop: '.vk-ln' },
  summary: { on: '.vk-dmeta', kind: 'style', prop: 'display' },
});
Object.assign(EFFECTS['vk-code'], {
  fit: { on: '.vk-src', kind: 'style', prop: 'white-space', skipVisual: true },
  numbers: { on: 'vk-code', kind: 'dom', prop: '.vk-ln' },
});
Object.assign(EFFECTS['vk-term'], {
  fit: { on: '.vk-txt', kind: 'style', prop: 'white-space', skipVisual: true },
});
Object.assign(EFFECTS['vk-table'], {
  fit: { on: 'vk-table', kind: 'style', prop: 'overflow-x' },
});
Object.assign(EFFECTS['vk-callout'], {
  density: { on: '.vk-callout', kind: 'style', prop: 'padding-top' },
});
Object.assign(EFFECTS['vk-steps'], {
  orientation: { on: '.vk-steps', kind: 'style', prop: 'flex-direction', skipVisual: true },
  density: { on: '.vk-step-n', kind: 'style', prop: 'width' },
});
Object.assign(EFFECTS['vk-cells'], {
  stride: { on: '.vk-cell-a', kind: 'text' },
});
Object.assign(EFFECTS['vk-grid'], {
  justify: { on: 'vk-grid', kind: 'style', prop: 'justify-items' },
});
Object.assign(EFFECTS['vk-edge'], {
  clearance: { on: 'svg path', kind: 'attr', prop: 'd' },
  'label-size': { on: '.vk-edge-label', kind: 'style', prop: 'font-size' },
  'label-dx': { on: '.vk-edge-label', kind: 'style', prop: 'left' },
  'label-dy': { on: '.vk-edge-label', kind: 'style', prop: 'top' },
});
Object.assign(EFFECTS['vk-tree'], {
  summary: { on: '.vk-tree-meta', kind: 'style', prop: 'display' },
  variant: { on: '.vk-tree', kind: 'attr', prop: 'data-variant' },
});
Object.assign(EFFECTS['vk-note'], {
  emphasis: { on: '.vk-note', kind: 'style', prop: 'color' },
});
Object.assign(EFFECTS['vk-page'], {
  // fit 只在宿主小于 16:9 时有差异；由 EFFECT_ANY 登记，不在这里造一个假的 height 效果。
});
EFFECTS['vk-annotate'] = {
  w: { on: '.vk-anno-notes', kind: 'geometry', prop: 'width', skipVisual: true },
};
Object.assign(EFFECTS['vk-canvas'], {
  inset: { on: 'vk-canvas vk-box', kind: 'geometry', prop: 'x', skipVisual: true },
  overflow: { on: 'vk-canvas', kind: 'style', prop: 'overflow-x', skipVisual: true },
  grid: { on: 'vk-canvas', kind: 'style', prop: 'background-image' },
});

