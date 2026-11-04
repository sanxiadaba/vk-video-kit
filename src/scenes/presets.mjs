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
    { label: '正确面', attrs: { tone: 'ok' } },
    { label: '强边', attrs: { border: 'strong', radius: 'md' } },
    // 描边环（原 vk-ring）：不占布局的强调，邻居的位置不动。
    { label: '描边环', attrs: { ring: '', tone: 'warn' } },
    { label: '横向内距', attrs: { 'pad-x': 'xl' } },
    { label: '纵向内距', attrs: { 'pad-y': 'xl' } },
  ],
  'vk-panel': [
    { label: '抬起', attrs: { variant: 'raised' } },
    { label: '语义分区', attrs: { tone: 'ok' } },
    { label: '强边', attrs: { border: 'strong', radius: 'md' } },
    // 窗体（原 vk-window）：chrome="dots" 长出三点窗头。
    { label: '窗体', attrs: { chrome: 'dots', title: '示例分区' } },
    { label: '大内距', attrs: { pad: 'xl' } },
  ],
  'vk-text': [
    { label: '次要', attrs: { ink: 'tertiary' } },
    { label: '大字', attrs: { size: 'subhead' } },
    { label: '居中', attrs: { align: 'center' } },
    { label: '加粗', attrs: { weight: 'bold' } },
    { label: '语义色', attrs: { tone: 'ok' } },
    // 图标是一个字形（原 vk-icon）：文字与图标共存。
    { label: '带图标', attrs: { icon: 'check' } },
    // fit="width"：标本里的长句会被缩到容器宽；780px 的代码行会放大到接近上限。
    // 标本台演示的是「能缩多小」，所以显式把地板放到 8（库默认 40 是给交付页的；
    // 不写明 fit-min 的话，长句会停在地板 40 并正确报 data-fit-overflow）。
    { label: '塞满一行', attrs: { fit: 'width', 'fit-min': '8', 'fit-max': '120' } },
    { label: '封顶 64', attrs: { fit: 'width', 'fit-min': '8', 'fit-max': '64' } },
  ],
  'vk-label': [
    { label: '标签', attrs: { variant: 'chip' } },
    { label: '实色序号', attrs: { variant: 'badge', tone: 'focus' } },
    { label: '正确', attrs: { tone: 'ok' } },
    { label: '警告', attrs: { tone: 'warn' } },
    { label: '错误', attrs: { tone: 'err' } },
    // 贴块（原 vk-caption）：换目标 / 换方向，说明跟着块走。
    { label: '贴在上方', attrs: { for: '#lab-a', anchor: 'above' } },
    { label: '贴在下方', attrs: { for: '#lab-b', anchor: 'below' } },
  ],
  'vk-img': [
    /* 图片的尺寸由容器决定（frame=false，w/h 从来就没生效过）。
       预设改成真正影响画面的四个维度：比例、填充、焦点、圆角。 */
    { label: '竖幅', attrs: { ratio: '3 / 4' } },
    { label: '方图', attrs: { ratio: '1 / 1' } },
    { label: '方图完整', attrs: { ratio: '1 / 1', fit: 'contain' } },
    { label: '方图焦点', attrs: { ratio: '1 / 1', fit: 'cover', position: '30% 70%' } },
    { label: '圆图', attrs: { ratio: '1 / 1', radius: 'pill' } },
  ],
  'vk-stack': [
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
  'vk-pair': [
    { label: '等号', attrs: { symbol: '=' } },
    { label: '对置', attrs: { symbol: 'vs' } },
    { label: '只留一条线', attrs: { symbol: 'none' } },
    { label: '偏左 30%', attrs: { split: '30' } },
    { label: '上下并置', attrs: { orientation: 'vertical' } },
  ],
  'vk-edge': [
    { label: '曲线', attrs: { variant: 'curve' } },
    { label: '直线', attrs: { variant: 'line' } },
    { label: '虚线', attrs: { dash: '', tone: 'info' } },
    { label: '双向', attrs: { arrow: 'both', tone: 'info' } },
    { label: '圆点', attrs: { cap: 'dot', tone: 'info' } },
    { label: '留缝', attrs: { 'gap-px': '32' } },
    { label: '拐点', attrs: { bend: '80' } },
  ],
  'vk-canvas': [
    { label: '内缩', attrs: { 'pad-px': '48' } },
  ],
  'vk-list': [
    { label: '清单', attrs: { variant: 'check' } },
    { label: '定义', attrs: { variant: 'define' } },
    { label: '有序', attrs: { variant: 'ordered' } },
    { label: '分隔线', attrs: { rule: '' } },
    { label: '无符号', attrs: { bare: '' } },
  ],
  'vk-code': [
    { label: '主镜头', attrs: { mass: 'hero', chrome: 'none' } },
    { label: '聚光', attrs: { focus: '4', current: '4' } },
    { label: '缺口', attrs: { fold: '4' } },
    { label: '标记词', attrs: { mark: 'int,char' } },
    { label: '隐藏行号', attrs: { numbers: 'none' } },
    { label: '深色表面', attrs: { surface: 'dark' } },
    { label: '凹面', attrs: { surface: 'inset' } },
    { label: '折叠说明', attrs: { fold: '4-7', 'fold-note': '省略 4 行' } },
  ],
  'vk-term': [
    { label: '大号', attrs: { mass: 'hero' } },
    { label: '无头', attrs: { chrome: 'none' } },
    // 同一段 transcript 的对照：不上色时命令、参数、路径、输出全在墨阶里。
    { label: '不上色', attrs: { lang: 'none' } },
    // 讲解时指一行：整行 focus 底 + 左缘一条蓝（与 vk-code 的 current 同一条规则）。
    { label: '指第 3 行', attrs: { current: '3' } },
    // 默认标本是深色；这两张把同一段 transcript 放回白纸 / 灰凹面。
    { label: '白纸', attrs: { surface: 'paper' } },
    { label: '凹面', attrs: { surface: 'inset' } },
  ],
  'vk-diff': [
    { label: '并排', attrs: { variant: 'split' } },
    { label: '无头', attrs: { chrome: 'none' } },
    { label: '无摘要', attrs: { summary: 'none' } },
    { label: '无行号', attrs: { numbers: 'none' } },
  ],
  'vk-table': [
    { label: '斑马', attrs: { stripe: '' } },
    { label: '对照', attrs: { variant: 'compare' } },
    { label: '规格', attrs: { variant: 'spec' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
    { label: '等宽', attrs: { mono: '' } },
  ],
  'vk-math': [
    { label: '更小', attrs: { size: 'label' } },
    { label: '行内', attrs: { display: null } },
  ],
  'vk-tree': [
    { label: '收起 tests', attrs: { collapsed: 'tests' } },
    { label: '只看 src', attrs: { collapsed: 'tests', depth: '2' } },
    { label: '只看顶层', attrs: { depth: '0' } },
    { label: '隐藏统计', attrs: { summary: 'none' } },
  ],
  'vk-bytes': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '两字节分组', attrs: { group: '2' } },
    { label: '按 4 字节分组', attrs: { group: '4' } },
    { label: '4 字节一组', attrs: { word: '4', group: '4' } },
    { label: '大端', attrs: { word: '4', endian: 'big' } },
    { label: '不要 ASCII', attrs: { ascii: 'none' } },
    { label: '不要地址', attrs: { address: 'none' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
  ],
  'vk-cells': [
    { label: '四列', attrs: { cols: '4' } },
    { label: '八列', attrs: { cols: '8' } },
    { label: '字节尺', attrs: { offsets: '', ruler: '' } },
    { label: '大端视角', attrs: { offsets: '', direction: 'rtl' } },
  ],
  'vk-steps': [
    { label: '第一步', attrs: { current: '0' } },
    { label: '第三步', attrs: { current: '2' } },
  ],
  'vk-page': [
  ],
  'vk-bits': [
    { label: '索引反向', attrs: { index: '0-7' } },
    { label: '无索引', attrs: { index: 'none' } },
    { label: '强调色', attrs: { tone: 'info' } },
    { label: '16 位', attrs: { 'bit-width': '16', value: '1111 1111 0000 0001' } },
    { label: '字节界', attrs: { bytes: '' } },
  ],
  'vk-bars': [
    { label: '强调当前', attrs: { tone: 'info' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
    { label: '线性刻度', attrs: { scale: 'linear' } },
  ],
  'vk-asm': [
    { label: '无机器码', attrs: { bytes: null } },
    { label: '无地址列', attrs: { address: 'none' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
    { label: '去窗头', attrs: { chrome: 'none' } },
    { label: '无顺序', attrs: { order: null } },
    { label: '无屏障', attrs: { 'fence-after': null } },
  ],
  'vk-timeline': [
    { label: '泳道', attrs: { variant: 'lanes' } },
    { label: '紧凑', attrs: { mass: 'compact' } },
    { label: '从 1989 起', attrs: { start: '1989' } },
  ],
  'vk-annotate': [
    { label: '直线', attrs: { shape: 'straight' } },
    { label: '曲线', attrs: { shape: 'curve' } },
    { label: '虚线', attrs: { dash: 'dashed', tone: 'info' } },
    { label: '圆点端点', attrs: { head: 'dot', tone: 'info' } },
    { label: '圈选', attrs: { mode: 'circle', for: '#pst-b', ring: 'ellipse', double: '' } },
    { label: '编号点', attrs: { mode: 'badge', for: '#pst-a', n: '2' } },
  ],
  'vk-note': [
    // 不造"编号图例"预设：图例的条目是 <li>，换形态等于换内容形状，不是外观预设。
    { label: '贴左侧', attrs: { side: 'left' } },
    { label: '圆点引线', attrs: { leader: 'dot' } },
    { label: '更窄', attrs: { w: '160' } },
    // 气泡（原 vk-pin）：泡 + 引线，属性名照旧。
    { label: '气泡批注', attrs: { kind: 'bubble', for: '#nt-a', side: 'right', n: '1' } },
    { label: '气泡编号 3', attrs: { kind: 'bubble', for: '#nt-a', side: 'bottom', n: '3' } },
  ],
};
