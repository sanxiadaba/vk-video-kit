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
  'vk-edge': {
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
  },
  'vk-bytes': {
    highlight: {
      values: ['9-12'],
      effect: { on: '.vk-bytes-x i', kind: 'style', prop: 'background-color' },
      why: '高亮字节会换一组 i 的背景色；断言背景而不是 data-hl 标记。',
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
  },
  'vk-cells': {
    spans: {
      values: ['1|1|1'],
      effect: { on: '.vk-cell', kind: 'geometry', prop: 'width' },
      why: '跨格通过 grid-column: span 改变格子宽度，断宽度而不是断 data-*。',
    },
    pad: {
      values: ['0'],
      effect: { on: '.vk-cell', kind: 'style', prop: 'background-image' },
      why: '填充格是斜纹底图，断 background-image。',
    },
    mark: {
      values: ['1'],
      effect: { on: '.vk-cell', kind: 'style', prop: 'border-top-color' },
      why: '高亮格底和边一起亮；断边框色，才是在断"框"。',
    },
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
  'vk-code.fit': '换行/滚动是内容相关状态，长行按作者内容变高；只断言 white-space 真的变了。',
  'vk-annotate.w': '只改批注栏宽这一条几何，不产生新文字/颜色。',
  'vk-steps.orientation': '竖排会改变整块高度，安全区由作者内容决定；结构差异已由 flex-direction 断言覆盖。',
  'vk-canvas.inset': '画布内缩只改子节点坐标，不产生新文字/颜色。',
  'vk-canvas.overflow': '裁切是作者显式选择；画布内容的安全区由真实帧负责。',
  'vk-grid.cols': '列数变化只改几何；子节点本身的视觉在默认态已检查。',
  'vk-canvas.w': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-canvas.h': '坐标画布只改几何，不产生新文字/颜色。',
  'vk-canvas.pad': '画布内缩只改子节点坐标，不产生新文字/颜色。',
  'vk-box.h': '硬高是作者显式选择的裁切；内容溢出不算 h 属性的错。',
};

/**
 * 无法自动测的属性：必须显式登记 `{ tag, attr, reason }`，预算 ≤ 10。
 * 当前 3 条。
 */
export const EFFECT_ANY = [
  {
    tag: 'vk-page',
    attr: 'fit',
    reason: 'fit=contain 只在宿主小于 16:9 时产生缩放差；1920 契约宿主正好 16:9，行为由 page fixture 覆盖。',
  },
  {
    tag: 'vk-mark',
    attr: 'variant',
    reason: 'variant 与 type 共用同一组 CSS；type 已有 border-top-width 断言。',
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
];
export const EFFECT_ANY_BUDGET = 10;

/** registry 把 w/h 声明成 text（可写数字也可写 fit/full）；给契约一个安全数字。 */
export const SHARED_VALUES = {
  w: ['1200', '1000'],
  h: ['400'],
  cols: ['4'],
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
