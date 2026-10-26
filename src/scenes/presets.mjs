/**
 * 外观预设 = 结构性形态的入口。
 *
 * 两条硬规则：
 * 1. 每一张卡都必须和"默认态"在 1920 画布 / 手机横屏缩放后看得出区别；换色也算，但不能只换一个看不见的值。
 * 2. 卡名描述"看到的结果"，不写 t3 / s5 / ink 这类 token 名。
 *
 * attrs 只写字面值；null 表示移除该属性。
 * 没有外观变体的元件（keys / cells）不硬造卡，工作台会说明原因；canvas 有布局变体，所以有卡。
 */
export const PRESETS = {
  'vk-box': [
    { label: '灰面', attrs: { surface: 'soft' } },
    { label: '深色', attrs: { surface: 'ink' } },
    { label: '强调', attrs: { tone: 'accent' } },
    { label: '强边', attrs: { border: 'strong', radius: 'md' } },
    { label: '横向内距', attrs: { 'pad-x': 'xl' } },
    { label: '纵向内距', attrs: { 'pad-y': 'xl' } },
  ],
  'vk-text': [
    { label: '次要', attrs: { emphasis: 'tertiary' } },
    { label: '大字', attrs: { size: 'heading' } },
    { label: '居中', attrs: { align: 'center' } },
    { label: '等宽', attrs: { mono: '' } },
    { label: '加粗', attrs: { weight: 'bold' } },
  ],
  'vk-icon': [
    { label: '小', attrs: { scale: 'sm' } },
    { label: '中', attrs: { scale: 'md' } },
    { label: '特大', attrs: { scale: 'xl' } },
    { label: '强调色', attrs: { tone: 'accent' } },
  ],
  'vk-img': [
    { label: '小图', attrs: { w: '720' } },
    { label: '大图', attrs: { w: '1600' } },
    { label: '方图', attrs: { w: '800', ratio: '1 / 1' } },
    { label: '定高', attrs: { h: '600' } },
    { label: '方图完整', attrs: { ratio: '1 / 1', fit: 'contain' } },
    { label: '方图焦点', attrs: { ratio: '1 / 1', fit: 'cover', position: '30% 70%' } },
    { label: '圆图', attrs: { ratio: '1 / 1', radius: 'pill' } },
  ],
  'vk-rule': [
    { label: '强线', attrs: { variant: 'strong' } },
    { label: '强调线', attrs: { variant: 'accent' } },
  ],
  'vk-stack': [
    { label: '紧', attrs: { gap: '2xs' } },
    { label: '松', attrs: { gap: 'xl' } },
  ],
  'vk-row': [
    { label: '紧', attrs: { gap: '2xs' } },
    { label: '松', attrs: { gap: 'xl' } },
  ],
  'vk-grid': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '两列', attrs: { cols: '2' } },
    { label: '单列', attrs: { cols: '1' } },
    { label: '宽列距', attrs: { 'gap-x': 'xl' } },
    { label: '宽行距', attrs: { 'gap-y': 'xl' } },
    { label: '居中', attrs: { align: 'center' } },
  ],
  'vk-mark': [
    { label: '下划线', attrs: { variant: 'underline' } },
    { label: '删除线', attrs: { variant: 'strike' } },
    { label: '圈', attrs: { variant: 'circle' } },
    { label: '错误色', attrs: { tone: 'err' } },
  ],
  'vk-edge': [
    { label: '曲线', attrs: { shape: 'curve' } },
    { label: '直线', attrs: { shape: 'line' } },
    { label: '虚线', attrs: { dash: '', tone: 'accent' } },
    { label: '双向', attrs: { arrow: 'both', tone: 'accent' } },
    { label: '圆点', attrs: { cap: 'dot', tone: 'accent' } },
    { label: '留缝', attrs: { clearance: '32' } },
    { label: '拐点', attrs: { bend: '80' } },
  ],
  'vk-canvas': [
    { label: '内缩', attrs: { inset: '48' } },
  ],
  'vk-title': [
    { label: '更大', attrs: { size: 'display' } },
    { label: '更小', attrs: { size: 'heading' } },
    { label: '居中', attrs: { align: 'center' } },
  ],
  'vk-list': [
    { label: '清单', attrs: { variant: 'check' } },
    { label: '定义', attrs: { variant: 'define' } },
    { label: '有序', attrs: { variant: 'ordered' } },
    { label: '分隔线', attrs: { rule: '' } },
    { label: '无符号', attrs: { bare: '' } },
  ],
  'vk-tag': [
    { label: '小号', attrs: { size: 'meta' } },
    { label: '无边框', attrs: { bare: '' } },
  ],
  'vk-callout': [
    { label: '说明', attrs: { tone: 'accent' } },
    { label: '正确', attrs: { tone: 'ok' } },
    { label: '错误', attrs: { tone: 'err' } },
    { label: '无底', attrs: { flat: '' } },
  ],
  'vk-code': [
    { label: '主镜头', attrs: { density: 'large', chrome: 'none' } },
    { label: '聚光', attrs: { focus: '4', highlight: '4' } },
    { label: '缺口', attrs: { fold: '4' } },
    { label: '深色', attrs: { surface: 'ink' } },
    { label: '标记词', attrs: { mark: 'int,char' } },
    { label: '隐藏行号', attrs: { numbers: 'none' } },
    { label: '折叠说明', attrs: { fold: '4', 'fold-note': '省略 10 行' } },
    { label: '窄窗折行', attrs: { w: '720', fit: 'wrap' } },
  ],
  'vk-term': [
    { label: '大号', attrs: { density: 'large' } },
    { label: '浅色', attrs: { surface: 'paper' } },
    { label: '无头', attrs: { chrome: 'none' } },
  ],
  'vk-diff': [
    { label: '并排', attrs: { variant: 'split', w: '1680' } },
    { label: '深色', attrs: { surface: 'ink' } },
    { label: '无头', attrs: { chrome: 'none' } },
    { label: '无摘要', attrs: { summary: 'none' } },
    { label: '无行号', attrs: { numbers: 'none' } },
  ],
  'vk-table': [
    { label: '斑马', attrs: { stripe: '' } },
    { label: '对照', attrs: { variant: 'compare' } },
    { label: '规格', attrs: { variant: 'spec' } },
    { label: '紧凑', attrs: { density: 'compact' } },
    { label: '等宽', attrs: { mono: '' } },
  ],
  'vk-math': [
    { label: '更小', attrs: { size: 'label' } },
    { label: '行内', attrs: { display: null } },
  ],
  'vk-figure': [
    { label: '方图', attrs: { ratio: '1 / 1' } },
    { label: '4:3', attrs: { ratio: '4 / 3' } },
    { label: '无头', attrs: { chrome: 'none' } },
    { label: '无壳', attrs: { bare: '' } },
    { label: '深色', attrs: { surface: 'ink' } },
    { label: '带来源', attrs: { url: 'zh.wikipedia.org' } },
    { label: '方图完整', attrs: { ratio: '1 / 1', fit: 'contain' } },
    { label: '方图焦点', attrs: { ratio: '1 / 1', fit: 'cover', position: '30% 70%' } },
  ],
  'vk-browser': [
    { label: '无头', attrs: { chrome: 'none' } },
    { label: '深色', attrs: { surface: 'ink' } },
  ],
  'vk-filetree': [
    { label: '只看顶层', attrs: { depth: '0' } },
    { label: '只显示 2 个顶层', attrs: { limit: '2' } },
    { label: '收起 tests', attrs: { collapsed: 'tests' } },
    { label: '隐藏统计', attrs: { summary: 'none' } },
  ],
  'vk-keys': [],
  'vk-cells': [
    { label: '两列', attrs: { cols: '2' } },
    { label: '三列', attrs: { cols: '3' } },
  ],
  'vk-steps': [
    { label: '第一步', attrs: { current: '1' } },
    { label: '第三步', attrs: { current: '3' } },
  ],
  'vk-progress': [
    { label: '20%', attrs: { value: '20' } },
    { label: '50%', attrs: { value: '50' } },
    { label: '80%', attrs: { value: '80' } },
    { label: '完成', attrs: { value: '100', tone: 'ok' } },
    { label: '注意', attrs: { value: '60', tone: 'warn' } },
    { label: '错误', attrs: { value: '30', tone: 'err' } },
  ],
  'vk-annotate': [
    { label: '窄栏', attrs: { w: '520' } },
    { label: '宽栏', attrs: { w: '640' } },
  ],
  'vk-note': [
    { label: '大号', attrs: { size: 'heading' } },
    { label: '编号', attrs: { n: '1' } },
  ],
  'vk-page': [
    { label: '加页眉', attrs: { header: '第 1 章 · 从能跑到讲清楚' } },
    { label: '加页脚', attrs: { footer: 'vk · 一页一个概念' } },
  ],
};
