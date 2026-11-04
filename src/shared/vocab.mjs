/**
 * 概念词表 —— 全库只有这一份。
 *
 * 15.0 的「概念收敛」把四个概念收成一套：
 *
 *   tone     六值：neutral / info / focus / ok / warn / err（大小写不敏感）
 *   fill     三值：none / cover / contain（只在能填充的组件上声明）
 *   current  一个语义：当前项，序号 1 起，-1 = 没有当前
 *   size     只表字号（语义档或像素）；密度一律写 mass
 *
 * 这里同时是**旧值的唯一登记处**：registry 用取值集合生成枚举与文档，
 * runtime 用别名表把旧页折成新值并提示，highlight 用同一张表给迁移警告。
 * 别名不写进 TAGS[].attrs —— 它们不进类型、不进参考、不进属性名计数。
 */

/* ------------------------------------------------------------------ tone */

/**
 * 语义色调。**全库唯一一套**：任何组件、任何子条目都只认这六个词。
 *
 * 历史页面上的旧词表都是它的子集（box 只有 ok/warn/err、bits/bars 只有
 * neutral/info、edge 只有 neutral/info/focus、text/label/note/pin 少了 neutral），
 * 子集里的每个值合并后仍然合法，所以"旧值 → 新值"是恒等映射，不需要改名。
 * 真正需要映射的是 14.0 删掉的 `accent`，以及历史文案里出现过的同义写法。
 */
export const TONES = ['neutral', 'info', 'focus', 'ok', 'warn', 'err'];

/** 报错文案里那一行：构建期非法值报错必须原样列出这套六值。 */
export const TONE_HINT = TONES.join(' / ');

/** 旧写法 → 六值之一。只在别名层出现，不参与校验的"合法值"。 */
export const TONE_ALIAS = {
  // 14.0 删掉的第五色：当时它就叫 accent，意思就是强调色 → focus。
  // 其余写法（danger / success / warning …）从没进过词表，仍然按非法值报错。
  accent: 'focus',
};

/**
 * 读一个 tone 值：**大小写不敏感**；旧写法折成六值之一。
 * @returns {{ value: string|null, alias: string|null, caseChanged: boolean, bad: string|null }}
 *   value        合法的六值之一（none 不在词表里：它是 vk-pair 表示"这一侧不上色"的写法）
 *   alias        用了登记过的旧写法（accent）→ 值得给一条迁移提示
 *   caseChanged  只是大小写不同（OK / Info）→ 合法，运行期静默折成小写，不提示
 *   bad          不认识 → 构建期报错
 */
export function toneValue(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: null, alias: null, caseChanged: false, bad: null };
  const lower = text.toLowerCase();
  if (TONES.includes(lower)) return { value: lower, alias: null, caseChanged: lower !== text, bad: null };
  const mapped = TONE_ALIAS[lower];
  if (mapped) return { value: mapped, alias: lower, caseChanged: false, bad: null };
  return { value: null, alias: null, caseChanged: false, bad: text };
}

/* ------------------------------------------------------------------ fill */

/**
 * 填充。一个名字一套取值：
 *   none     不填充（默认）
 *   cover    铺满可用区域，超出部分裁掉（object-fit: cover / 吃满宽高）
 *   contain  完整放下，不裁切（object-fit: contain / 吃满宽、高按内容）
 *
 * 只声明在能填充的组件上：vk-img / vk-panel / vk-layer。
 * 其它块级标签的"铺满父容器一条轴"是另一件事，名字是 `stretch`（布尔）。
 * 旧页把 `fill` 裸写（布尔写法）的那个概念，在非填充组件上折成 stretch，
 * 在填充组件上折成 cover —— 前者逐像素不变，后者是本次收敛的语义。
 */
export const FILLS = ['none', 'cover', 'contain'];

/** 布尔写法 → 枚举值。空串是真值（HTML 裸写），"false" 是旧页显式关掉。 */
export const FILL_BOOL = {
  '': 'cover',
  true: 'cover',
  false: 'none',
  on: 'cover',
  off: 'none',
  yes: 'cover',
  no: 'none',
};

/** 能填充的组件。其它组件不声明 fill。 */
export const FILL_TAGS = new Set(['vk-img', 'vk-panel', 'vk-layer', 'vk-compare']);

/* ------------------------------------------------------------------ size */

/**
 * 字号档。`size` **只**表示字号：语义档名，或像素数（内容组件）。
 * 密度/体量是另一根轴，名字是 `mass`（compact / normal / hero）。
 */
export const SIZE_TIERS = [
  'mega',
  'hero',
  'display',
  'headline',
  'title',
  'subhead',
  'body',
  'data',
  'label',
  'caption',
];

/** 旧档名 → 现在的名字。13.0 改过一次，14.0 起 display 恢复为正式档。 */
export const SIZE_ALIAS = {
  'display-2xl': 'hero',
  'display-xl': 'hero',
  heading: 'subhead',
  meta: 'label',
};

/** 体量（密度）。与 size 正交。 */
export const MASS = ['compact', 'normal', 'hero'];

/** 旧词 density 的映射：loose 是「更松」，对应 hero。 */
export const MASS_ALIAS = { compact: 'compact', normal: 'normal', loose: 'hero' };

/* --------------------------------------------------------------- current */

/**
 * `current` 只有一个意思：**当前项**。
 *
 *   current="N"     第 N 项，**1 起**（行号、步序号、格序号、字节序号、事件序号）
 *   current="N-M"   第 N 到第 M 项（行段 / 字节段）
 *   current="-1"    没有当前（纯地图、不标当前行）
 *
 * 坐标一律 1 起：行号本来就是 1 起；步/格/事件以前 0 起，15.0 统一加一。
 * 唯一不是数字的是 vk-tree：它的"项"是节点路径，接受 current="路径"。
 * 旧名 `line`（code / term / asm）与 `active`（tree）保留为别名。
 */
export const CURRENT_RULE = '1 起；-1 = 没有当前';

/* ------------------------------------------------------ 属性改名（旧页） */

/**
 * 属性级改名：旧名 → 新名。
 *
 * 旧名不再进 `TAGS[].attrs`（因此不进类型、参考、属性名计数），但**不拦构建**：
 * highlight 见到旧名只提示；runtime 在元素连上 DOM 的第一刻折成新名。
 * `note` 是迁移提示的正文，`map` 是值变换（缺省恒等）。
 */
export const ATTR_ALIAS = {
  line: { to: 'current', note: 'current 是同一个意思（当前项，1 起）' },
  'value-size': { to: 'size', note: 'size 只表字号，时间线的主值字号也是字号' },
  'label-size': { to: 'size', note: 'size 只表字号' },
  'symbol-size': { to: 'size', note: 'size 只表字号；中轴符号的字号用它' },
  emphasis: { to: 'strength', note: 'strength 是"多响"，emphasis 是同一个东西的旧名' },
  anchor: { to: 'side', note: 'side 是"贴哪一侧"的唯一名字（top / bottom）' },
  place: { to: 'side', note: 'side 的 bottom-right / bottom-left / bottom 就是旧 place 的 br / bl / bottom' },
  orientation: { to: 'direction', note: 'direction 是横/竖的唯一名字' },
  fit: { to: 'fill', note: '图片取景只认 fill="none|cover|contain"；fit 只保留 fit="width"（内容字号铺满）' },
  kind: { to: 'variant', note: 'variant 是"这一个组件长成哪种形态"的唯一名字（旧名 kind）' },
  'mode': { to: 'variant', tag: 'vk-compare', note: 'variant 是形态名（旧名 mode）' },
  'label-a': { to: 'labels', note: 'labels="左|右" 一次写两个角标' },
  'label-b': { to: 'labels', note: 'labels="左|右" 一次写两个角标' },
  'address-label': { to: 'labels', note: 'labels="地址|机器码|指令|操作数" 一次写四列标题' },
  'bytes-label': { to: 'labels', note: 'labels="地址|机器码|指令|操作数" 一次写四列标题' },
  'mnemonic-label': { to: 'labels', note: 'labels="地址|机器码|指令|操作数" 一次写四列标题' },
  'operands-label': { to: 'labels', note: 'labels="地址|机器码|指令|操作数" 一次写四列标题' },
  'label-dx': { to: 'label-offset', note: 'label-offset="dx,dy" 一次写两个偏移' },
  'label-dy': { to: 'label-offset', note: 'label-offset="dx,dy" 一次写两个偏移' },
  'from-side': { to: 'side', note: 'side="起点侧 终点侧"，两个词用空格分隔' },
  'to-side': { to: 'side', note: 'side="起点侧 终点侧"，两个词用空格分隔' },
  'tone-a': { to: 'tone', note: 'tone="左,右" 一次写两侧色调；none 表示这一侧不上色' },
  'tone-b': { to: 'tone', note: 'tone="左,右" 一次写两侧色调；none 表示这一侧不上色' },
  numbering: { to: null, note: '行号只有一种基准：源文件的真实行号' },
};

/** 旧名列表（构建期提示用）。 */
export const DEPRECATED_ATTRS = Object.keys(ATTR_ALIAS);
