/**
 * 项目层的「审美 preset」——默认不启用。
 *
 * 库只判客观错误：溢出、遮挡正文、非法枚举、锚点解析失败、组件渲染异常、
 * 空组件、素材哈希不符、运行崩溃。这些是"无论画什么都错"的事。
 *
 * 下面这五条不是那种事，它们是**版面主张**：
 *   一页只有一个答案（强调色 ≤1）、一页只砸一块重（深色块 ≤1）、
 *   页眉只讲工序（不含文件名 / 页号）、内容落在 120 边距里。
 * 换一个项目、换一套片子，这些数字都该重定。所以它们被移出 audit.mjs 的
 * 默认路径，做成一个显式打开的 preset：
 *
 *   vk check --style <pages...>          # CLI
 *   node tools/style-preset.mjs <pages>  # 同一个 preset 的独立入口
 *   vk.auditStyle()                      # 运行期，返回这一组判定
 *
 * 图标白名单降级为**提醒**（level="warn"）：写一个装饰图标不再让页面变红，
 * 只在 --style 下提示一次。构建期也不再拒绝白名单外的图标（同样只提醒）。
 */

import { cumulativeScaleX } from './geometry.mjs';
import { ICON_WHITELIST_HINT, isSemanticIcon } from '../shared/icons.mjs';

const PAGE_MARGIN = 120;
/** 深色判定：相对亮度低于它、且有 160×60 以上的可见面。 */
const DARK_LUM = 0.05;
/** 页眉里不该出现的文件后缀（与构建期 highlight.mjs 同一张表）。 */
const KICKER_FILE_EXT = /\.(?:c|s|exe|o|i)\b/i;
/** 「第 3 页 / 3 帧」这类页号。 */
const KICKER_PAGE_NO = /第\s*[0-9一二三四五六七八九十]+\s*[页帧]|\d+\s*\/\s*\d+\s*[页帧]/;
/** 覆盖层：只画在内容上，不参与"内容边距"与深色块计数。 */
const OVERLAY_SEL = 'vk-edge, vk-pin, vk-ring, vk-annotate, vk-note, [data-vk-overlay]';

/**
 * 这一组规则的清单：CLI / 文档 / 测试读同一份，不各自抄文案。
 * level 是"这条规则有多硬"：error = preset 打开时算问题；warn = 只提醒。
 */
export const STYLE_RULES = [
  {
    id: 'accent',
    level: 'error',
    name: '强调色 ≤1',
    why: '一页只有一个答案：强调色留给"本页唯一要记住的那一处"',
  },
  {
    id: 'dark',
    level: 'error',
    name: '深色块 ≤1',
    why: '一页只砸一块"重"：第二块深色会把第一块的重心稀释掉',
  },
  {
    id: 'icon',
    level: 'warn',
    name: '图标白名单（提醒，不是错误）',
    why: '装饰图标不再是错误；这一条只提醒"图标可以表达语义，也可以只是装饰"',
  },
  {
    id: 'header',
    level: 'error',
    name: '页眉只讲工序',
    why: '页眉回答"这是第几道工序"，文件名与页号属于内容块',
  },
  {
    id: 'margin',
    level: 'error',
    name: '内容落在 120 边距内',
    why: '项目约定的交付边距；换项目可以换成 96 / 100 / 无',
  },
];

const PARSE_RGB = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
};

const relLum = (c) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};

const labelOf = (el) => {
  const cls = String(el.className || '')
    .trim()
    .split(/\s+/)[0];
  const base = cls || String(el.tagName || '').toLowerCase();
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return text && !base.includes(text) ? `${base}「${text}」` : base;
};

/** 行内 / 文字宿主：文字在子 span 里，宿主自己才是"那一行字"。 */
const INLINE_HOSTS = new Set(['VK-LABEL', 'VK-INLINE', 'VK-ICON', 'VK-TEXT']);

const visibleBox = (el) => {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
  const tag = el.tagName;
  if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'svg' || tag === 'SVG') return true;
  // 文字宿主（kicker / chip / 行内代码 / 图标 / 文字块）：字可能全在子 span 里，
  // 但越界的是整行——报宿主比报它内部的 4px 色条有用得多。
  if (INLINE_HOSTS.has(tag) && (el.textContent || '').trim()) return true;
  const cs = getComputedStyle(el);
  const bg = PARSE_RGB(cs.backgroundColor);
  if (bg && bg.a > 0.06) return true;
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
  return ['borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth'].some((k) => parseFloat(cs[k]) >= 1);
};

/**
 * 强调色：只数「答案级」元素 —— vk-text 与 vk-panel 上的 tone="focus"。
 *
 * vk-label 是导航、vk-icon 是符号，都不占强调名额；err / warn 是反例/警告，
 * 也不在这里计数（它们不是"第二个答案"）。嵌套时只算最外层一次。
 */
function accentAnswers(stage) {
  const hits = [];
  for (const el of stage.querySelectorAll('vk-text[tone="focus"], vk-panel[tone="focus"]')) {
    if (el.closest('template')) continue;
    if (el.closest('vk-label, vk-icon') || el.closest(OVERLAY_SEL)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    hits.push(el);
  }
  return hits.filter((el) => !hits.some((o) => o !== el && o.contains(el)));
}

/**
 * 深色区域：按底色亮度识别，不靠类名。
 *
 * vk-panel variant="dark"、深色终端 / 字节窗、作者自己的 .vk-bg-dark 或内联深底
 * 都会落进同一个判定。小于 160×60 的深色件（编号点、badge）不算"一块区域"。
 */
function darkRegions(stage) {
  const found = [];
  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('template') || el.closest('svg')) continue;
    if (el.closest(OVERLAY_SEL)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.2) continue;
    const explicit = el.matches('vk-panel[variant="dark"], .vk-bg-dark, [data-vk-dark], [data-theme="dark"]');
    const bg = PARSE_RGB(cs.backgroundColor);
    const ownDark = !!bg && bg.a > 0.5 && relLum(bg) < DARK_LUM;
    if (!explicit && !ownDark) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 60) continue;
    found.push(el);
  }
  // 嵌在另一块深色里的子块不重复计数（深色分区的标题带也是深色）。
  return found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
}

/**
 * 图标白名单（提醒）。
 *
 * 构建期已经不再拒绝白名单外的 <vk-icon name>；这里也只是提醒：
 * "图标可以表达语义，也可以只是装饰——知道自己在用装饰就行"。
 * 自定义 src 的内联 SVG 不算——它是作者自己的图。
 */
function iconNotes(stage) {
  const out = [];
  for (const host of stage.querySelectorAll('vk-icon')) {
    if (host.closest('template')) continue;
    const inline = host.querySelector(':scope > .vk-icon[data-vk-inline]');
    if (inline?.dataset.vkSrc) continue;
    const name = (host.getAttribute('name') || inline?.dataset.vkName || '').trim();
    if (!name) continue;
    // 只按名字判：名字在白名单里就是合法语义图标（图标表没注入是另一件事，
    // 由 data-vk-unknown 的 special 报）。
    if (isSemanticIcon(name)) continue;
    out.push({ type: 'icon', el: host, what: `「${name}」不在语义图标白名单里（装饰图标可以留，知道就行）` });
  }
  return out;
}

/** 页眉：kicker 只讲工序，不讲文件名，也不讲页号。 */
function headerIssues(stage) {
  const out = [];
  // kicker 是 vk-label 的默认变体：没写 variant 的也是页眉。
  for (const el of stage.querySelectorAll('vk-label')) {
    if (el.closest('template')) continue;
    const variant = el.getAttribute('variant') || 'kicker';
    if (variant !== 'kicker') continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const hit = KICKER_FILE_EXT.exec(text);
    if (hit) {
      out.push({ type: 'header', el, what: `页眉（kicker）"${text}" 里出现了文件名 ${hit[0]}` });
    } else if (KICKER_PAGE_NO.test(text)) {
      out.push({ type: 'header', el, what: `页眉（kicker）"${text}" 写的是页号 / 帧号` });
    }
  }
  return out;
}

/**
 * 内容必须在 120 边距内（项目约定的交付边距）。
 *
 * 只查交付页（1920×1080、未缩放）：审阅页把帧缩小排在一起，坐标不是画布坐标；
 * 标本台（.vk-stage）与图版页（data-allow-void）是目录版式，页骨架的 96 顶带
 * 本来就是版式的一部分。
 *
 * 覆盖层（annotate / ring / edge / note）与出血层不属内容；容器本身不算"可见"，
 * 只报真正有字、有面、有边或替换元素的那一层，并只报最外层。
 */
function marginIssues(stage, pageRect, scale) {
  if (!pageRect || Math.abs((scale || 1) - 1) > 0.02) return [];
  if (pageRect.width < PAGE_MARGIN * 2 + 200 || pageRect.height < PAGE_MARGIN * 2 + 200) return [];
  if (stage.classList?.contains('vk-stage') || stage.hasAttribute?.('data-allow-void') || stage.closest?.('[data-allow-void]')) return [];
  const out = [];
  const seen = new Set();
  const covered = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (seen.has(p)) return true;
    return false;
  };
  const W = pageRect.width;
  const H = pageRect.height;
  for (const el of stage.querySelectorAll('*')) {
    if (el === stage) continue;
    if (el.closest('template, svg, .katex, .vk-page-bleed')) continue;
    if (el.closest(OVERLAY_SEL)) continue;
    if (el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!visibleBox(el)) continue;
    const box = [r.left - pageRect.left, r.top - pageRect.top, r.right - pageRect.left, r.bottom - pageRect.top];
    const over = Math.max(
      PAGE_MARGIN - box[0],
      PAGE_MARGIN - box[1],
      box[2] - (W - PAGE_MARGIN),
      box[3] - (H - PAGE_MARGIN)
    );
    if (over <= 1) continue;
    if (covered(el)) continue;
    seen.add(el);
    out.push({
      type: 'margin',
      el,
      what: `内容越出 ${PAGE_MARGIN} 边距 ${Math.round(over)}px：${labelOf(el)}`,
      box: box.map((v) => Math.round(v)),
    });
  }
  return out;
}

/** 每条规则的"下一步"：只说改法，不替作者做审美判断。 */
const FIX = {
  accent:
    '强调色只留给唯一的答案：其余改成 ink="secondary" 或去掉 tone；反例/警告用 tone="err" / tone="warn"（它们不算第二处强调色）',
  dark: '只留一块深色：其余改成 variant="inset" / plain，或把那一块移到下一页；深色是"重"，一页只能砸一次',
  icon: `图标只表达"成立 / 注意 / 不成立 / 方向"时最省事；可用：${ICON_WHITELIST_HINT}`,
  header:
    '页眉讲"工序到哪了"：用 index/total/section（工序 3/5 · 汇编）；文件名放进内容块，页号交给帧编号',
  margin: '内缩到 120 边距：删内容 / 降一档间距；页眉页脚也要落在 120 以内（覆盖层不受此限）',
};

/**
 * 跑这一组项目层规则。
 *
 * 返回数组（与 auditPage().issues 同形），每项多三个字段：
 *   style=true  表示"这条来自可选的审美 preset"
 *   rule        规则 id（见 STYLE_RULES）
 *   level       "error"（preset 打开时算问题）或 "warn"（只提醒）
 */
export function auditStyle(root = document) {
  const stage = root.matches?.('.vk-page, .vk-stage') ? root : root.querySelector?.('.vk-page') || root.querySelector?.('.vk-stage') || root;
  const pageRect = stage.getBoundingClientRect();
  const out = [];

  const accents = accentAnswers(stage);
  for (const accent of accents.slice(1)) {
    out.push({
      type: 'accent',
      el: accent,
      count: accents.length,
      what: `一页出现 ${accents.length} 处强调色（tone="focus" 的答案级元素）`,
      rule: 'accent',
      level: 'error',
      style: true,
      fix: FIX.accent,
    });
  }

  const darks = darkRegions(stage);
  if (darks.length > 1) {
    out.push({
      type: 'dark',
      el: darks[1],
      count: darks.length,
      what: `一页最多一块深色区域，它应该是本页唯一的"重"（本页 ${darks.length} 块）`,
      rule: 'dark',
      level: 'error',
      style: true,
      fix: FIX.dark,
    });
  }

  for (const icon of iconNotes(stage)) {
    out.push({ ...icon, rule: 'icon', level: 'warn', style: true, fix: FIX.icon });
  }

  for (const h of headerIssues(stage)) {
    out.push({ ...h, rule: 'header', level: 'error', style: true, fix: FIX.header });
  }

  for (const m of marginIssues(stage, pageRect, cumulativeScaleX(stage))) {
    out.push({ ...m, rule: 'margin', level: 'error', style: true, fix: FIX.margin });
  }

  return out;
}
