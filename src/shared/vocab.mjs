/**
 * 词汇与解析 —— 全库只有这一份。
 *
 *   tone     六值：neutral / info / focus / ok / warn / err
 *   fill     三值：none / cover / contain（只在能填充的组件上声明）
 *   current  一个语义：当前项，序号 1 起，-1 = 没有当前
 *   size     只表字号（六档或像素）；密度一律写 mass
 *
 * 公开的属性表在 src/schema.mjs。
 */

/* ------------------------------------------------------------------ tone */

/**
 * 语义色调。**全库唯一一套**：任何组件、任何子条目都只认这六个词。
 *
 * neutral/info、edge 只有 neutral/info/focus、text/label/note/pin 少了 neutral），
 */
export const TONES = ['neutral', 'info', 'focus', 'ok', 'warn', 'err'];

/** 报错文案里那一行：构建期非法值报错必须原样列出这套六值。 */
export const TONE_HINT = TONES.join(' / ');


/**
 * @returns {{ value: string|null, alias: string|null, caseChanged: boolean, bad: string|null }}
 *   value        合法的六值之一（none 不在词表里：它是 vk-pair 表示"这一侧不上色"的写法）
 *   caseChanged  只是大小写不同（OK / Info）→ 合法，运行期静默折成小写，不提示
 *   bad          不认识 → 构建期报错
 */
export function toneValue(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: null, alias: null, caseChanged: false, bad: null };
  const lower = text.toLowerCase();
  if (TONES.includes(lower)) return { value: lower, alias: null, caseChanged: lower !== text, bad: null };
  return { value: null, alias: null, caseChanged: false, bad: text };
}

/* ------------------------------------------------------------------ fill */

/* ------------------------------------------------------------------ size */

/**
 * 字号档。`size` **只**表示字号：语义档名，或像素数（内容组件）。
 * 密度/体量是另一根轴，名字是 `mass`（compact / normal / hero）。
 */
export const SIZE_TIERS = ['caption', 'body', 'headline', 'display', 'hero', 'mega'];


/** 体量（密度）。与 size 正交。 */
export const MASS = ['compact', 'normal', 'hero'];


/**
 * 列开关：一个名字 `columns`。
 *
 *   columns="numbers"            打开这一列（不写 = 该组件的默认列）
 *   columns="numbers,summary"    打开多列
 *   columns="none"               一列可选列都不打开
 *   columns="all"                该组件的全部可选列
 *   columns="-summary"           从当前集合里关掉一列
 *   columns="titles:地址|机器码|指令|操作数"   asm 的列标题
 */
export const COLUMNS = {
  'vk-code': { all: ['numbers'], on: ['numbers'] },
  'vk-diff': { all: ['numbers', 'summary'], on: ['numbers', 'summary'] },
  'vk-tree': { all: ['summary'], on: ['summary'] },
  'vk-cells': { all: ['offsets', 'ruler'], on: [] },
  'vk-bytes': { all: ['address', 'ascii'], on: ['address', 'ascii'] },
  'vk-asm': { all: ['address'], on: ['address'] },
};

/**
 * 读一个 columns 值。
 * @returns {{ on: Set<string>, titles: string[]|'none'|null, explicit: boolean }}
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
function serializeCompareLabels({ a, b, la, lb }) {
  const sources = a || b ? `${a},${b}` : '';
  const caps = [la, lb];
  if (!sources) return caps.filter(Boolean).join('|');
  return [sources, ...caps].join('|').replace(/\|+$/, '');
}

/* ------------------------------------------------------------------ 间距 */

/**
 *
 *   gap="24"        两轴同值（像素写法）
 *   gap="24 48"     先 x（左右）后 y（上下）
 *   pad="md"        档位（2xs…3xl；box / grid 有）
 *   pad="md 2xs"    x = md、y = 2xs
 *   pad="0"         无边距
 *
 */

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
 *
 *   arrow="end"                     终点一个实心箭头（默认）
 *   arrow="end:open"                箭头样式：triangle / open / thin
 *   arrow="end,size:40"             箭头尺寸（像素，8–64）
 *   arrow="none"                    不画箭头
 *   arrow="scale:0.12,label:gcc"    按容器高缩放（vk-flow / vk-annotate）+ 中轴词
 *
 */
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
 * 唯一不是数字的是 vk-tree：它的"项"是节点路径，接受 current="路径"。
 */
export const CURRENT_RULE = '1 起；-1 = 没有当前';
