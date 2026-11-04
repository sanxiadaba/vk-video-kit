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

/* --------------------------------------------------------------- 列开关 */

/**
 * 15.2 的属性收敛第二步：列开关族。
 *
 * 以前每个组件各写一个开关键（numbers / ascii / address / offsets / ruler /
 * summary），asm 的列标题还有一个 labels。现在只有 `columns` 一个名字：
 *
 *   columns="numbers"            打开这一列（不写 = 该组件的默认列）
 *   columns="numbers,summary"    打开多列
 *   columns="none"               一列可选列都不打开
 *   columns="all"                该组件的全部可选列
 *   columns="-summary"           从当前集合里关掉一列（与上面的写法可混用）
 *   columns="titles:地址|机器码|指令|操作数"   asm 的列标题（titles:none 关掉整行）
 *
 * 默认列（on）是"不写 columns 时"的样子，逐像素等于旧版默认。
 * 旧名都是别名：构建期提示，运行期折叠成 columns。
 */
export const COLUMNS = {
  'vk-code': { all: ['numbers'], on: ['numbers'] },
  'vk-diff': { all: ['numbers', 'summary'], on: ['numbers', 'summary'] },
  'vk-tree': { all: ['summary'], on: ['summary'] },
  'vk-cells': { all: ['offsets', 'ruler'], on: [] },
  'vk-bytes': { all: ['address', 'ascii'], on: ['address', 'ascii'] },
  'vk-asm': { all: ['address'], on: ['address'] },
};

/** 被 `columns` 收编的旧属性名（运行时折叠 + 构建期提示共用）。 */
export const COLUMN_ATTRS = ['numbers', 'ascii', 'address', 'offsets', 'ruler', 'summary'];

/** 列开关的默认集合。 */
export function defaultColumns(tag) {
  return new Set(COLUMNS[tag]?.on || []);
}

/**
 * 读一个 columns 值。
 * @returns {{ on: Set<string>, titles: string[]|'none'|null, explicit: boolean }}
 *   titles  仅 vk-asm 有意义：null = 没写、'none' = 关掉标题行、数组 = 逐列标题
 */
export function parseColumns(tag, raw) {
  const spec = COLUMNS[tag] || { all: [], on: [] };
  if (raw == null) return { on: new Set(spec.on), titles: null, explicit: false };
  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const on = new Set();
  let titles = null;
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower === 'all') {
      for (const name of spec.all) on.add(name);
      continue;
    }
    if (lower === 'none') {
      on.clear();
      continue;
    }
    if (lower.startsWith('titles:')) {
      const value = tok.slice('titles:'.length).trim();
      titles = value.toLowerCase() === 'none' ? 'none' : value.split('|').map((s) => s.trim());
      continue;
    }
    const off = tok.startsWith('-');
    const name = (off ? tok.slice(1) : tok).trim().toLowerCase();
    if (!spec.all.includes(name)) continue; // 构建期会报；运行期不擅自加列
    if (off) on.delete(name);
    else on.add(name);
  }
  return { on, titles, explicit: true };
}

/** 把集合写回一个 columns 值（折叠用）。titles 省略 = 不写标题段。 */
export function serializeColumns(tag, on, titles = null) {
  const all = COLUMNS[tag]?.all || [];
  const names = all.filter((name) => on.has(name));
  const head = names.length ? names.join(',') : 'none';
  if (titles == null) return head;
  const titleText = titles === 'none' ? 'none' : titles.join('|');
  return `${head},titles:${titleText}`;
}

/** 组件读列开关只用这一个入口：不写 columns 时落到该组件的默认列。 */
export function hasColumn(el, tag, name) {
  return parseColumns(tag, el?.getAttribute?.('columns')).on.has(name);
}

/** 拆两张图的地址段：普通路径按逗号；data: URL 里自带逗号，只在第二个 data: 前切。 */
function splitSources(seg) {
  const text = String(seg || '').trim();
  if (!text) return ['', ''];
  if (/^data:/i.test(text)) {
    const parts = text.split(/,(?=data:)/i).map((s) => s.trim());
    if (parts.length === 2) return parts;
    const at = text.lastIndexOf(',');
    if (at > 0) return [text.slice(0, at).trim(), text.slice(at + 1).trim()];
    return [text, ''];
  }
  const at = text.indexOf(',');
  if (at < 0) return [text, ''];
  return [text.slice(0, at).trim(), text.slice(at + 1).trim()];
}

/** 两段文本的"图 a / 图 b"：sources 在前（逗号），角标在后（竖线）。 */
export function parseCompareLabels(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { a: '', b: '', la: '', lb: '' };
  const parts = text.split('|').map((s) => s.trim());
  if (parts[0].includes(',')) {
    const [a = '', b = ''] = splitSources(parts[0]);
    return { a, b, la: parts[1] || '', lb: parts[2] || '' };
  }
  return { a: '', b: '', la: parts[0] || '', lb: parts[1] || '' };
}

/** 写回 labels：sources 有值时写 "a,b"，角标接在竖线后面。 */
export function serializeCompareLabels({ a, b, la, lb }) {
  const sources = a || b ? `${a},${b}` : '';
  const caps = [la, lb];
  if (!sources) return caps.filter(Boolean).join('|');
  return [sources, ...caps].join('|').replace(/\|+$/, '');
}

/* ------------------------------------------------------------------ 间距 */

/**
 * 15.2：间距单位族收成两个名字：`gap` / `pad`。
 *
 *   gap="24"        两轴同值（像素写法）
 *   gap="24 48"     先 x（左右）后 y（上下）
 *   pad="md"        档位（2xs…3xl；box / grid 有）
 *   pad="md 2xs"    x = md、y = 2xs
 *   pad="0"         无边距
 *
 * 旧名 gap-px / gap-x / gap-y / pad-px / pad-x / pad-y 都是别名。
 */
export const SPACE_TIERS = ['0', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
export const GAP_TIERS = [...SPACE_TIERS, 'group', 'section', 'plate'];

/** 档位 → 间距令牌。 */
export const SPACE_VARS = {
  '2xs': '--vk-s1',
  xs: '--vk-s2',
  sm: '--vk-s3',
  md: '--vk-s4',
  lg: '--vk-s5',
  xl: '--vk-s6',
  '2xl': '--vk-s7',
  '3xl': '--vk-s8',
  group: '--vk-gap-group',
  section: '--vk-gap-section',
  plate: '--vk-gap-plate',
};

/** 读 "x" / "x y"；不认识返回 null（调用方保留默认）。 */
export function parseSpace(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parts = text.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 1 ? { x: parts[0], y: parts[1] } : { x: parts[0], y: parts[0] };
}

/** 档位或像素 → 可写进 inline style 的 CSS 值。 */
export function spaceCss(token) {
  const text = String(token ?? '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'none') return '0px';
  const v = SPACE_VARS[text];
  if (v) return `var(${v})`;
  const n = Number(text.replace(/px$/, ''));
  return Number.isFinite(n) ? `${n}px` : '';
}

/* ------------------------------------------------------------------ 箭头 */

/**
 * 15.2：vkid 的箭头词表收成一个 `arrow`。
 *
 *   arrow="end"                     终点一个实心箭头（默认）
 *   arrow="both"                    两端箭头（旧 arrow="both" 原样可写）
 *   arrow="end:open"                箭头样式：triangle / open / thin
 *   arrow="end,size:40"             箭头尺寸（像素，8–64）
 *   arrow="end,cap:start"           端点圆点（旧 cap="dot" = 起点一个点）
 *   arrow="none"                    不画箭头
 *   arrow="scale:0.12,label:gcc"    按容器高缩放（vk-flow / vk-annotate）+ 中轴词
 *
 * 旧名 arrow-style / arrow-size / cap / arrow-scale / arrow-label / head 都是别名。
 */
export const ARROW_STYLES = ['solid', 'open', 'thin'];
export const ARROW_STYLE_ALIAS = { triangle: 'solid', solid: 'solid', open: 'open', thin: 'thin' };

/** 读 arrow；不写 = 终点实心箭头（与旧 vk-edge 默认一致）。 */
export function parseArrow(raw) {
  const out = { end: false, start: false, dot: null, style: 'solid', size: null, scale: null, label: null };
  const text = String(raw ?? '').trim();
  if (!text) {
    out.end = true;
    return out;
  }
  for (const piece of text.split(',')) {
    const tok = piece.trim();
    if (!tok) continue;
    const at = tok.indexOf(':');
    if (at < 0) {
      const value = tok.toLowerCase();
      if (value === 'end') out.end = true;
      else if (value === 'start') out.start = true;
      else if (value === 'both') {
        out.end = true;
        out.start = true;
      }
      continue;
    }
    const key = tok.slice(0, at).trim().toLowerCase();
    const value = tok.slice(at + 1).trim();
    if (key === 'end' || key === 'start' || key === 'both') {
      if (key !== 'start') out.end = true;
      if (key !== 'end') out.start = true;
      const style = ARROW_STYLE_ALIAS[value.toLowerCase()];
      if (style) out.style = style;
    } else if (key === 'style') {
      const style = ARROW_STYLE_ALIAS[value.toLowerCase()];
      if (style) out.style = style;
    } else if (key === 'size') {
      const n = Number(value.replace(/px$/i, ''));
      if (Number.isFinite(n)) out.size = n;
    } else if (key === 'scale') {
      const n = Number(value);
      if (Number.isFinite(n)) out.scale = n;
    } else if (key === 'label') {
      out.label = value || null;
    } else if (key === 'cap') {
      const v = value.toLowerCase();
      if (v === 'none') out.dot = null;
      else if (v === 'dot') out.dot = 'start';
      else if (v === 'both') out.dot = 'both';
      else if (v === 'start' || v === 'end') out.dot = v;
    }
  }
  return out;
}

/** 把箭头配置写回一个 arrow 值（折叠用）。 */
export function serializeArrow({ end, start, dot, style, size, scale, label }) {
  const head = end && start ? 'both' : end ? 'end' : start ? 'start' : 'none';
  const styled = head === 'none' || !style || style === 'solid' ? head : `${head}:${style}`;
  const parts = [styled];
  if (size != null) parts.push(`size:${size}`);
  if (scale != null) parts.push(`scale:${scale}`);
  if (label) parts.push(`label:${label}`);
  if (dot) parts.push(`cap:${dot}`);
  return parts.join(',');
}

/** vk-flow 的 arrow 仍然是"画不画"，后面可以接 scale / label。 */
export function serializeFlowArrow({ on, scale, label }) {
  const parts = [on ? 'true' : 'false'];
  if (scale != null) parts.push(`scale:${scale}`);
  if (label) parts.push(`label:${label}`);
  return parts.join(',');
}

/* ------------------------------------------------------------------ 屏障 */

/** 汇编的屏障：fence="after:4,label:编译器屏障"（label 省略 = 内存屏障）。 */
export function parseFence(raw) {
  const out = { after: '', label: '内存屏障' };
  const text = String(raw ?? '').trim();
  if (!text) return out;
  for (const piece of text.split(',')) {
    const tok = piece.trim();
    if (!tok) continue;
    const at = tok.indexOf(':');
    if (at < 0) {
      if (/^\d+$/.test(tok)) out.after = tok;
      else if (tok.toLowerCase() === 'none' || tok.toLowerCase() === 'off') out.after = '';
      continue;
    }
    const key = tok.slice(0, at).trim().toLowerCase();
    const value = tok.slice(at + 1).trim();
    if (key === 'after') out.after = /^\d+$/.test(value) ? value : '';
    else if (key === 'label') out.label = value || '内存屏障';
  }
  return out;
}

/** 屏障值（折叠用）。label 是默认值时省略。 */
export function serializeFence({ after, label }) {
  if (!after) return '';
  return `after:${after}${label && label !== '内存屏障' ? `,label:${label}` : ''}`;
}

/* ------------------------------------------------------------------ 计数 */

/** 工序进度：counter="3/5"（也可以只写 "3"）。 */
export function parseCounter(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { index: NaN, total: NaN };
  const [a, b] = text.split('/').map((s) => s.trim());
  return {
    index: /^\d+$/.test(a || '') ? Number(a) : NaN,
    total: /^\d+$/.test(b || '') ? Number(b) : NaN,
  };
}

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
  /* ---- 15.2 · 列开关：七个名字并成 columns（asm 的 labels 是标题段） ---- */
  numbers: { to: 'columns', tag: ['vk-code', 'vk-diff'], note: '列开关只写 columns="numbers"；不写 = 默认列' },
  summary: { to: 'columns', tag: ['vk-diff', 'vk-tree'], note: '列开关只写 columns；关掉摘要写 columns="none"（或 "-summary"）' },
  ascii: { to: 'columns', tag: 'vk-bytes', note: '列开关只写 columns；不要 ASCII 写 columns="address"' },
  address: { to: 'columns', tag: ['vk-bytes', 'vk-asm'], note: '列开关只写 columns；不要地址列写 columns="none"' },
  offsets: { to: 'columns', tag: 'vk-cells', note: '字节尺写 columns="offsets"（可和 ruler 一起写）' },
  ruler: { to: 'columns', tag: 'vk-cells', note: '对齐括号写 columns="ruler"（可和 offsets 一起写）' },
  labels: { to: 'columns', tag: 'vk-asm', note: '汇编的列标题写 columns="titles:地址|机器码|指令|操作数"；关掉标题行写 titles:none' },
  /* ---- 15.2 · 间距：六个名字并成 gap / pad ---- */
  'gap-px': { to: 'gap', tag: ['vk-edge', 'vk-note', 'vk-annotate', 'vk-label', 'vk-pin'], note: '像素间距也写 gap（数字就是像素）' },
  'gap-x': { to: 'gap', tag: 'vk-grid', note: 'gap="x y" 先左右后上下；只写一列间距写 gap="sm md"' },
  'gap-y': { to: 'gap', tag: 'vk-grid', note: 'gap="x y" 先左右后上下；只写一行间距写 gap="md sm"' },
  'pad-px': { to: 'pad', tag: ['vk-canvas', 'vk-ring'], note: '内距也写 pad（数字就是像素）' },
  'pad-x': { to: 'pad', tag: 'vk-box', note: 'pad="x y" 先左右后上下；只写左右写 pad="md 0"' },
  'pad-y': { to: 'pad', tag: 'vk-box', note: 'pad="x y" 先左右后上下；只写上下写 pad="0 md"' },
  /* ---- 15.2 · 箭头：cap / arrow-style / arrow-size 并进 arrow ---- */
  'arrow-style': { to: 'arrow', tag: 'vk-edge', note: '箭头样式写 arrow="end:open"（triangle / open / thin）' },
  'arrow-size': { to: 'arrow', tag: 'vk-edge', note: '箭头尺寸写 arrow="end,size:40"（8–64）' },
  cap: { to: 'arrow', tag: 'vk-edge', note: '端点圆点写 arrow="end,cap:start"（旧 cap="dot"）' },
  'arrow-scale': { to: 'arrow', tag: ['vk-flow', 'vk-annotate'], note: '缩放也并进 arrow：arrow="end,scale:0.12"' },
  'arrow-label': { to: 'arrow', tag: ['vk-flow', 'vk-annotate'], note: '中轴词写 arrow="end,label:gcc"' },
  head: { to: 'arrow', tag: 'vk-annotate', note: '端点写进 arrow：arrow="end"（箭头）/ arrow="end,cap:end"（圆点）/ arrow="none"' },
  /* ---- 15.2 · 一次性属性 ---- */
  'fence-after': { to: 'fence', tag: 'vk-asm', note: '屏障写 fence="after:4,label:编译器屏障"' },
  'fence-label': { to: 'fence', tag: 'vk-asm', note: '屏障文字并进 fence 的 label 段' },
  a: { to: 'labels', tag: 'vk-compare', note: '两张图写 labels="a,b"（角标接在竖线后：labels="a,b|左|右"）' },
  b: { to: 'labels', tag: 'vk-compare', note: '两张图写 labels="a,b"（角标接在竖线后：labels="a,b|左|右"）' },
  index: { to: 'counter', tag: 'vk-label', note: '工序进度写 counter="3/5"' },
  total: { to: 'counter', tag: 'vk-label', note: '工序进度写 counter="3/5"' },

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
