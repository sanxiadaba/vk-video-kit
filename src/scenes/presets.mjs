/**
 * 外观预设 = 状态带里的第二层信息。
 *
 * 三条硬规则：
 * 1. 每个组件最多 3 档：首屏主镜头已经回答"它长什么样、用来干什么"，
 *    状态带只补"换一档会变成什么"，不再把属性表平铺出来。
 * 2. 每一档都必须和默认态在 1920 画布 / 手机横屏缩放后看得出区别；换色也算，
 *    但不能只换一个看不见的值。
 * 3. 卡名描述"看到的结果"，不写 t3 / s5 / ink 这类 token 名。
 *
 * 其余属性在 docs/reference.md（由 registry 自动生成）里查，不在标本页重复。
 * attrs 只写字面值；null 表示移除该属性。
 */
import { C } from './corpus.mjs';

export const PRESETS = {
  'vk-box': [
    { label: '灰面', attrs: { surface: 'soft' } },
    { label: '正确面', attrs: { tone: 'ok' } },
    { label: '描边环', attrs: { ring: '', tone: 'warn' } },
  ],
  'vk-panel': [
    { label: '抬起', attrs: { variant: 'raised' } },
    { label: '语义分区', attrs: { tone: 'ok' } },
    { label: '窗体', attrs: { chrome: 'dots', title: `${C.stages[0].title} · 分区` } },
  ],
  'vk-text': [
    { label: '次要', attrs: { ink: 'tertiary' } },
    { label: '大字', attrs: { size: 'subhead' } },
    { label: '塞满一行', attrs: { fit: 'width', 'fit-min': '8', 'fit-max': '120' } },
  ],
  'vk-label': [
    { label: '标签', attrs: { variant: 'chip' } },
    { label: '实色序号', attrs: { variant: 'badge', tone: 'focus' } },
    { label: '贴在上方', attrs: { for: '#lab-a', side: 'top' } },
  ],
  'vk-img': [
    { label: '竖幅', attrs: { ratio: '3 / 4' } },
    { label: '方图完整', attrs: { ratio: '1 / 1', fill: 'contain' } },
    { label: '圆图', attrs: { ratio: '1 / 1', radius: 'pill' } },
  ],
  'vk-stack': [
    { label: '紧', attrs: { gap: '2xs' } },
    { label: '松', attrs: { gap: 'xl' } },
  ],
  'vk-grid': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '两列', attrs: { cols: '2' } },
    { label: '居中', attrs: { align: 'center' } },
  ],
  'vk-pair': [
    { label: '等号', attrs: { symbol: '=' } },
    { label: '上下并置', attrs: { direction: 'vertical' } },
    { label: '偏左 30%', attrs: { split: '30' } },
  ],
  'vk-edge': [
    { label: '直线', attrs: { variant: 'line' } },
    { label: '虚线', attrs: { dash: '', tone: 'info' } },
    { label: '双向', attrs: { arrow: 'both', tone: 'info' } },
  ],
  'vk-canvas': [{ label: '内缩', attrs: { pad: '48' } }],
  'vk-list': [
    { label: '清单', attrs: { variant: 'check' } },
    { label: '定义', attrs: { variant: 'define' } },
    { label: '有序', attrs: { variant: 'ordered' } },
  ],
  'vk-code': [
    { label: '深色表面', attrs: { surface: 'dark' } },
    { label: '聚光', attrs: { focus: '4', current: '4' } },
    { label: '缺口', attrs: { fold: '4' } },
  ],
  'vk-term': [
    { label: '白纸', attrs: { surface: 'paper' } },
    { label: '凹面', attrs: { surface: 'inset' } },
    { label: '不上色', attrs: { lang: 'none' } },
  ],
  'vk-diff': [
    { label: '并排', attrs: { variant: 'split' } },
    { label: '无摘要', attrs: { columns: 'numbers' } },
    { label: '无行号', attrs: { columns: 'summary' } },
  ],
  'vk-table': [
    { label: '斑马', attrs: { stripe: '' } },
    { label: '对照', attrs: { variant: 'compare' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
  ],
  'vk-math': [
    { label: '更小', attrs: { size: 'label' } },
    { label: '行内', attrs: { display: null } },
  ],
  'vk-tree': [
    { label: '收起 build', attrs: { collapsed: 'build' } },
    { label: '只看顶层', attrs: { depth: '0' } },
    { label: '隐藏统计', attrs: { columns: 'none' } },
  ],
  'vk-bytes': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '大端', attrs: { word: '4', endian: 'big' } },
    { label: '不要 ASCII', attrs: { columns: 'address' } },
  ],
  'vk-cells': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '字节尺', attrs: { columns: 'offsets,ruler' } },
  ],
  'vk-steps': [
    { label: '第一步', attrs: { current: '1' } },
    { label: '第三步', attrs: { current: '3' } },
  ],
  'vk-page': [],
  'vk-bits': [
    { label: '索引反向', attrs: { index: '0-7' } },
    { label: '16 位', attrs: { 'bit-width': '16', value: '1111 1111 0000 0001' } },
    { label: '字节界', attrs: { bytes: '' } },
  ],
  'vk-bars': [
    { label: '强调当前', attrs: { tone: 'info' } },
    { label: '线性刻度', attrs: { scale: 'linear' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
  ],
  'vk-asm': [
    { label: '无机器码', attrs: { bytes: null } },
    { label: '无地址列', attrs: { columns: 'none' } },
    { label: '无屏障', attrs: { fence: null } },
  ],
  'vk-timeline': [
    { label: '正常体量', attrs: { mass: null } },
    { label: '无标题', attrs: { title: null } },
  ],
  'vk-annotate': [
    { label: '折线', attrs: { shape: 'ortho' } },
    { label: '直线', attrs: { shape: 'straight' } },
    { label: '虚线', attrs: { dash: 'dashed', tone: 'info' } },
  ],
  'vk-note': [
    { label: '贴左侧', attrs: { side: 'left' } },
    { label: '气泡批注', attrs: { variant: 'bubble', for: '#nt-a', side: 'right', n: '1' } },
    { label: '气泡编号 3', attrs: { variant: 'bubble', for: '#nt-a', side: 'bottom', n: '3' } },
  ],
};
