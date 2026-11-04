/**
 * 五个讲解动作 —— 「图示语汇」的唯一内容源。
 *
 * 每一个动作都是一层**组合**（vk-scene 的一个 kind），不是新标签：
 *   compare  改前 / 改后、A / B      pair + tone + labels
 *   steps    一步一步来              steps + flow + cue
 *   locate   在哪儿（内存 / 文件 / 屏幕）cells / bytes + annotate + img
 *   measure  多大、差多少            bars / table + text
 *   cause    为什么会这样            annotate + note + pair
 *
 * 内容只用 hello.c 编译链（./corpus.mjs），不写占位词。
 * 标本页与契约宿主都从这里取，改一处就全对。
 */

import { C } from './corpus.mjs';

const s = String.raw;

/** 两块「改前 / 改后」：同一段 hello.c，聚光行不同。 */
const A = s`<vk-code slot="a" lang="c" file="${C.file}" src="../code/hello.c" lines="1-8" current="4" chrome="min" size="48" columns="none"></vk-code>`;
const B = s`<vk-code slot="b" lang="c" file="${C.file}" src="../code/hello.c" lines="1-8" current="5" chrome="min" size="48" columns="none"></vk-code>`;

/** 四步编译链：命令、产物、尺寸都来自 corpus。 */
const STEPS = C.stages
  .map(
    (st) => s`<vk-stack slot="step" gap="2xs">
  <vk-text size="body" mono>${st.step}</vk-text>
  <vk-label variant="tag" ink="secondary">${st.out}</vk-label>
  <vk-label variant="tag" ink="muted">${st.size.replace(' 字节', ' B')}</vk-label>
</vk-stack>`
  )
  .join('\n');

/** locate：地址大字 + 内存格；地址就是 s[0] 的家。 */
const WHERE = s`<vk-text slot="where" size="display" mono weight="bold">${C.address}</vk-text>`;
const MAP = s`<vk-cells slot="map" cols="6" addr="${C.address}" current="1">
  <li value="'h'" label="s[0]"></li>
  <li value="'e'" label="s[1]"></li>
  <li value="'l'" label="s[2]"></li>
  <li value="'l'" label="s[3]"></li>
  <li value="'o'" label="s[4]"></li>
  <li value="\0" label="s[5]" filled></li>
</vk-cells>`;

/** measure：一个数字 + 一条对比条 + 右侧倍数牌。 */
const VALUE = s`<vk-text slot="value" size="hero" weight="bold" mono>${C.bytes.preprocessed.replace(' 字节', '')}</vk-text>`;
const CHART = s`<vk-bars slot="chart" max="${C.size.preprocessed}" unit="B">
  <li value="${C.size.source}" label="${C.file}"></li>
  <li value="${C.size.preprocessed}" label="${C.stages[0].out}"></li>
  <li value="${C.size.executable}" label="${C.stages[3].out}"></li>
</vk-bars>`;
const RATIO = s`<vk-stack slot="ratio" gap="2xs" align="center">
  <vk-text size="headline" weight="bold" mono>×457</vk-text>
  <vk-label variant="tag" ink="secondary">相对 ${C.file}</vk-label>
</vk-stack>`;

/** cause：一句「因为」，箭头两端是现象与结果。 */
const WHY = s`<vk-label slot="why" variant="tag" tone="info">因为 include</vk-label>`;

/** 因果页自己的两端（对比页的 A / B 也继续用来当契约宿主的槽）。 */
const CAUSE_A = s`<vk-box slot="a" border="hair" radius="lg" pad="md" surface="paper">
  <vk-stack gap="2xs">
    <vk-text size="body" mono>#include &lt;stdio.h&gt;</vk-text>
    <vk-label variant="tag" ink="muted">${C.file} · 第 1 行</vk-label>
  </vk-stack>
</vk-box>`;
const CAUSE_B = s`<vk-box slot="b" border="hair" radius="lg" pad="md" surface="paper">
  <vk-stack gap="2xs">
    <vk-text size="headline" weight="bold" mono>${C.bytes.preprocessed.replace(' 字节', '')}</vk-text>
    <vk-label variant="tag" ink="secondary">字节 · ${C.stages[0].out}</vk-label>
    <vk-label variant="tag" ink="muted">include 把 stdio.h 抄了进来</vk-label>
  </vk-stack>
</vk-box>`;

/** 一个 kind 的标本正文。 */
const scene = (attrs, slots) => `<vk-scene ${attrs}>\n${slots}\n</vk-scene>`;

export const COMBOS = [
  {
    kind: 'compare',
    title: '对比',
    what: '改前 / 改后、A / B：左右两块等宽，中轴留 48，上方各一枚标签。',
    body: scene(`kind="compare" labels="改前|改后" tone="info,ok"`, `  ${A}\n  ${B}`),
  },
  {
    kind: 'steps',
    title: '分步',
    what: '一步一步来：横向 N 步，当前步高亮，其余降墨，底部一条进度轨。',
    body: scene(`kind="steps" current="2" labels="预处理|编译|汇编|链接"`, STEPS),
  },
  {
    kind: 'locate',
    title: '定位',
    what: '在哪儿：上方地址大字，下方一块容器，中央一条指向线。',
    body: scene(`kind="locate"`, `  ${WHERE}\n  ${MAP}`),
  },
  {
    kind: 'measure',
    title: '数量',
    what: '多大、差多少：一个 ≥240px 的数字，下方对比条，右侧倍数牌。',
    body: scene(`kind="measure"`, `  ${VALUE}\n  ${CHART}\n  ${RATIO}`),
  },
  {
    kind: 'cause',
    title: '因果',
    what: '为什么会这样：左现象、右结果，中间一条带词的箭头。',
    body: scene(
      `kind="cause" labels="现象|结果" tone="warn,info" arrow="label:因为 include"`,
      `  ${CAUSE_A}\n  ${CAUSE_B}\n  ${WHY}`
    ),
  },
];

/**
 * 契约宿主：一次把所有槽都放进同一个 vk-scene。
 *
 * 契约会把 kind 的五个值逐个试一遍；只有每个值需要的槽都在，才能量到
 * 那一种排布。多出来的槽不会被渲染（vk-scene 只搬当前 kind 的槽），
 * 但它们必须留在 DOM 里，切 kind 时才有东西可搬。
 */
export const ALL_SLOTS_BODY = scene(
  `kind="compare" labels="改前|改后" tone="info,ok" arrow="label:因为 include"`,
  `  ${CAUSE_A}\n  ${CAUSE_B}\n${STEPS}\n  ${WHERE}\n  ${MAP}\n  ${VALUE}\n  ${CHART}\n  ${RATIO}\n  ${WHY}`
);

export const COMBO_BY_KIND = Object.fromEntries(COMBOS.map((c) => [c.kind, c]));
