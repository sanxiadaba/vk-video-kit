import { resolveAnchor } from './base.mjs';
import { LIMITS } from '../shared/limits.mjs';
import { auditStyle, STYLE_RULES } from './style-preset.mjs';

/**
 * 页面自检：作者页与标本页共用同一份。
 *
 * 只看客观错误：字号地板、对比度、溢出、裁切、遮挡正文、非法值、
 * 空锚点、组件渲染失败、空组件、素材过期。这些都是"无论你画什么，它都错"的事。
 *
 * 审美判断不在这里：强调色 ≤1、深色块 ≤1、图标白名单、页眉只讲工序、
 * 120 边距、字幕句长、孤行、焦点数量都是**项目层**的版面主张，默认不跑；
 * 要跑就显式打开：
 *   vk check --style ...      /  node tools/style-preset.mjs ...
 *   vk.auditPage(root, { style: true })
 * 判定与文案在 runtime/style-preset.mjs（STYLE_RULES 是唯一清单）。
 * 安全区（120 边距）、底部空带、字数、元素数量都不再是默认审计的一部分。
 *
 * 所有数值来自 shared/limits.mjs —— 这里不再有第二份定义。
 * 对比度分两档：正文 7:1，标注（ink="muted"，即 [data-meta] 里）4.5:1。
 */

const MIN_FONT = LIMITS.fontFloor;
const CONTENT_FONT = LIMITS.fontBody;
const MIN_RATIO = LIMITS.contrastText;
const MUTED_RATIO = LIMITS.contrastMuted;
const LARGE_RATIO = LIMITS.contrastLarge;
const DATA_RATIO = LIMITS.contrastData;
const LARGE_FONT = LIMITS.fontLarge;
const OVERLAYS = new Set(['vk-edge', 'vk-annotate', 'vk-note', 'vk-label']);



export function auditPage(root = document, options = {}) {
  const out = [];
  const stage = root.matches?.('.vk-page, .vk-stage') ? root : root.querySelector?.('.vk-page') || root.querySelector?.('.vk-stage') || root;
  const limits = { floor: MIN_FONT, body: CONTENT_FONT, large: LARGE_FONT };
  const safe = safeBox(stage);
  const pageRect = stage.getBoundingClientRect();

  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const blend = (f, b) => {
    const a = f.a + b.a * (1 - f.a);
    if (a <= 0.0001) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a,
      g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a,
      b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a,
      a,
    };
  };
  const bgOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.01) {
        acc = acc ? blend(acc, c) : c;
        if (c.a >= 0.99) break;
      }
      n = n.parentElement;
    }
    return acc ? blend(acc, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const opaque = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      if (parseFloat(getComputedStyle(n).opacity) < 0.5) return false;
      n = n.parentElement;
    }
    return true;
  };
  const clip = (s) => (s || '').toString().slice(0, 60);
  const overSeen = new Set();
  const covered = (el, set) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return true;
    return false;
  };

  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('.katex')) continue;
    if (el.hasAttribute?.('data-ellipsis')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.closest('svg') || el.closest('.vk-sr')) continue;
    const inOverlay = !!el.closest('vk-edge, vk-annotate, vk-note, vk-label[for]');
    const inSideNav = !!el.closest('[data-side-nav]');
    const inBleed = !!el.closest('.vk-page-bleed');

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isMeta = !!(el.closest && (el.closest('[data-meta]') || el.closest('[ink="muted"]')));
    // 窗头 / 窗脚是「窗自己的字」：它有独立的尺寸表（点、窗头高、chip 一起缩放），
    // 不受正文地板约束。页面的四档字号只管内容，不管一扇窗的标题栏。
    const inChrome = !!(el.closest && el.closest('.vk-hd, .vk-ft'));
    // 数据区 = 等宽字体。颜色在这里是编码（字符串绿、运算符蓝、地址灰），
    // 全推到 7:1 会让代码块变成一片深灰；所以按 AA 4.5 走。
    const inData = /mono/i.test(cs.fontFamily);
    const isSup = !!(el.closest && el.closest('vk-inline[variant="sup"], vk-inline[variant="sub"]'));
    // tag 是「块的名字」：caption × 0.75（36），不是正文。它的地板跟着 caption 走，
    // 但不参与正文的 body 门槛——否则 36px 的步骤标签会被判成"正文太小"。
    const inTag = !!(el.closest && el.closest('vk-label[variant="tag"]'));
    const fontFloor = inTag ? limits.floor * 0.75 : limits.floor;
    if (hasText && opaque(el) && !isSup && !inOverlay) {
      const fs = parseFloat(cs.fontSize);
      // caption 是硬地板，data-meta 也不能破：元数据只放宽对比度与句长，不放宽字号。
      if (!inChrome && fs < fontFloor) out.push({ type: 'font', what: clip(el.className || el.tagName), fs });
      const fg = parse(cs.color);
      if (fg) {
        const cr = ratio(fg, bgOf(el));
        // 分档：标注 4.5 / 数据区 4.5 / 大字 4.5 / 正文 7。
        const need = isMeta ? MUTED_RATIO : inData ? DATA_RATIO : fs >= limits.large ? LARGE_RATIO : MIN_RATIO;
        if (cr < need) out.push({ type: 'contrast', what: clip(el.className || el.tagName), cr: +cr.toFixed(2), need });
      }
    }

    if (!inSideNav && !inOverlay && (r.left < -4 || r.top < -4 || r.right > pageRect.right + 4 || r.bottom > pageRect.bottom + 4)) {
      if (!covered(el, overSeen)) {
        overSeen.add(el);
        out.push({
          type: 'overflow',
          el,
          what: clip(el.className || el.tagName),
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        });
      }
    }

    const ox = !inOverlay && !inBleed && (cs.overflowX === 'hidden' || cs.overflowX === 'clip');
    const oy = !inOverlay && !inBleed && (cs.overflowY === 'hidden' || cs.overflowY === 'clip');
    if (ox && el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'clip', el, what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
    }
    if (oy && el.scrollHeight > el.clientHeight + 3) {
      out.push({ type: 'clip-y', el, what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
    }
    // 组件宿主的内容溢出：即使 overflow 是 visible，也意味着"盒子被压扁、内容被盖住"。
    //
    // 但字形墨迹天然比行盒高一点点（120px 字 132 盒 / 138 墨迹），那不是被压扁。
    // 只有"溢出超过盒高 20% 且至少 6px"才算真的塞不下。
    const isHost = el.tagName.startsWith('VK-') && !OVERLAYS.has(el.tagName.toLowerCase());
    const explicitClip = el.getAttribute('overflow') === 'clip' || el.hasAttribute('data-allow-overflow');
    const slack = Math.max(6, el.clientHeight * 0.2);
    if (isHost && !inOverlay && !inBleed && !explicitClip && cs.overflowY === 'visible' && el.scrollHeight - el.clientHeight > slack) {
      out.push({ type: 'content-clip', el, what: clip(el.className || el.tagName), sh: el.scrollHeight, ch: el.clientHeight });
    }
  }

  // 行号不能压到代码正文上。
  for (const line of stage.querySelectorAll('.vk-line, .vk-dline')) {
    const num = line.querySelector('.vk-dnums') || line.querySelector('.vk-ln');
    const src = line.querySelector('.vk-src, .vk-dsrc');
    if (!num || !src) continue;
    const nr = num.getBoundingClientRect();
    const sr = src.getBoundingClientRect();
    if (nr.width < 1 || sr.width < 1) continue;
    if (nr.right > sr.left + 0.5) {
      out.push({ type: 'ln-overlap', what: clip(line.className), gap: +(nr.right - sr.left).toFixed(1) });
    }
  }

  // 同级块重叠：覆盖层（edge/pin/ring/spotlight）是显式覆盖，不算；
  // 手摆的绝对定位块也算——canvas 里的坐标是作者写的，重叠要报。
  const box = safe || stage;
  const containers = [box, ...box.querySelectorAll('vk-canvas')];
  for (const container of containers) {
    const kids = [...container.children].filter((el) => {
      if (OVERLAYS.has(el.tagName.toLowerCase())) return false;
      if (el.hasAttribute('data-vk-overlay')) return false;
      if (el.getClientRects().length === 0) return false;
      if (getComputedStyle(el).display === 'none') return false;
      return true;
    });
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 4 && h > 4) {
          // 声明了 elevation 的元素之间允许叠层，但每次放行都记账，回归时能看见。
          const elevated = kids[i].closest('[elevation]') || kids[j].closest('[elevation]');
          if (elevated) {
            out.push({
              type: 'layer',
              what: `已豁免：${clip(kids[i].className || kids[i].tagName)} 压在 ${clip(
                kids[j].className || kids[j].tagName
              )} 上（elevation）`,
            });
            continue;
          }
          out.push({
            type: 'overlap',
            what: `${clip(kids[i].className || kids[i].tagName)} × ${clip(kids[j].className || kids[j].tagName)}`,
            size: [Math.round(w), Math.round(h)],
          });
        }
      }
    }
  }

  // 对照的两张图必须同比例：不同比例时"一半对一半"是假的。
  for (const cmp of stage.querySelectorAll('vk-compare[data-mismatch]')) {
    out.push({ type: 'compare-mismatch', what: clip(cmp.className || 'vk-compare') });
  }

  // 覆盖层压住正文：批注泡这类"画在别人身上"的东西，压住字就是错。
  // 13.x 把 pin/ring/edge 当"显式覆盖"整体排除了，于是第 10 站的批注泡盖住标题，
  // 门禁仍然说"干净"——这条就是补那个盲区。只查真正有底的泡，线条类不算。
  for (const pin of stage.querySelectorAll('vk-note[variant="bubble"], vk-annotate[data-mode="note"]')) {
    const bubble = pin.querySelector('.vk-pin-bd') || pin;
    const pr = bubble.getBoundingClientRect();
    if (pr.width < 4 || pr.height < 4) continue;
    for (const t of stage.querySelectorAll('vk-text, p, h1, h2, h3, li')) {
      if (pin.contains(t)) continue;
      if (!(t.textContent || '').trim()) continue;
      const b = t.getBoundingClientRect();
      if (b.width < 4 || b.height < 4) continue;
      const w = Math.min(pr.right, b.right) - Math.max(pr.left, b.left);
      const h = Math.min(pr.bottom, b.bottom) - Math.max(pr.top, b.top);
      if (w <= 4 || h <= 4) continue;
      const cover = (w * h) / (b.width * b.height);
      if (h > b.height * 0.4 && w > 60) {
        out.push({ type: 'overlay-text', what: clip(bubble.className || 'vk-note'), target: clip(t.className || t.tagName), cover: +cover.toFixed(2) });
      }
    }
  }

  // 空帧：一个组件都没渲染出来、或整页只剩背景时，上面所有检查都会沉默——
  // 因为没有任何东西可以不合格。这一条把"没画面"从"没问题"里分出来。
  //
  // 例外是"故意空"的页：标本台（.vk-stage）、文献页/图版（data-allow-void）。
  // 它们本来就只有一个元件或大片留白，拿空帧去拦它是错的。
  const voidExempt = stage.classList?.contains('vk-stage') || stage.hasAttribute?.('data-allow-void') || stage.closest?.('[data-allow-void]');
  if (!voidExempt) {
    const body = stage.querySelector('.vk-page-bd') || stage;
    const chars = (body.innerText || '').replace(/\s+/g, '').length;
    const media = [...body.querySelectorAll('img, svg, canvas, vk-img, vk-canvas, vk-figure')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 80 && r.height > 80;
    }).length;
    if (chars < 12 && media === 0) {
      out.push({
        type: 'empty',
        what: `可见文字 ${chars} 字、没有图`,
        chars,
        fix: '组件没渲染出来？检查脚本是否加载、预编译是否过期',
      });
    }
  }

  // 空数据组件：列表 / 步骤 / 表格没有条目时是 0 高度，整页检查都会沉默——
  // 画面上看起来"这里没东西"，观众不知道是漏写还是本来如此。
  const EMPTY_COMPONENTS = {
    'vk-table': ['tr', '这个表还没有行：在 <table> 里写 <tr><td>…</td></tr>'],
    'vk-list': ['li', '列表还没有条目：把每一项写成 <li>…</li> 子节点'],
    'vk-steps': ['li', '步骤还没有条目：把每一步写成 <li>…</li> 子节点'],
  };
  for (const [tag, [child, fix]] of Object.entries(EMPTY_COMPONENTS)) {
    for (const el of stage.querySelectorAll(tag)) {
      if (el.closest('template')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (!el.querySelector(child)) out.push({ type: 'empty-component', what: tag, fix });
    }
  }

  // 组件级溢出（Frame 原语）：内容比盒子宽/高。
  if (typeof window !== 'undefined' && typeof window.vk?.auditOverflow === 'function') {
    for (const a of window.vk.auditOverflow(stage)) {
      // vk-bytes 的十六进制是逐格排的：整块 .vk-bd 的宽度溢出不等于"文本超出单元格"。
      // 它由下面的逐格测量单独判（真放不下时报"格太窄"），这里不重复报。
      if (a.tag === 'vk-bytes') continue;
      let host = null;
      try {
        host = a.sel ? stage.querySelector(a.sel) : null;
      } catch {
        /* 选择器可能只是描述性的 */
      }
      out.push({ type: 'audit-overflow', el: host, what: `${a.tag} ${a.sel}`, sw: a.sw, cw: a.cw, sh: a.sh, ch: a.ch });
    }
  }

  // w 是硬宽：量出来必须等于写的数字（容忍 1.5px）。
  // 覆盖层除外：气泡的 w 量的是气泡 .vk-pin-bd，宿主本身铺满整页。
  for (const el of stage.querySelectorAll('[w]')) {
    if (el.closest('vk-edge, vk-annotate, vk-note, vk-label[for]')) continue;
    const raw = (el.getAttribute('w') || '').trim();
    if (!/^\d+(?:\.\d+)?$/.test(raw)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const want = Number(raw);
    const got = el.offsetWidth;
    if (got < 1) continue;
    if (Math.abs(got - want) > 1.5) out.push({ type: 'w', what: clip(el.className || el.tagName), want, got, tag: el.tagName.toLowerCase() });
  }

  // 空锚点：连线/批注会指向空气。
  for (const el of stage.querySelectorAll('[id]')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) out.push({ type: 'zero', what: `#${el.id}` });
  }

  // 内容比单元格宽、又没有裁切：这是"撞字"的普遍形态，比盒子越界更隐蔽。
  for (const el of stage.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.vk-page-bleed') || el.closest('.katex')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.display === 'inline') continue;
    if (cs.whiteSpace !== 'nowrap' || cs.overflowX !== 'visible') continue;
    if (el.clientWidth < 8) continue;
    if (el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'collision', what: clip(el.className || el.tagName), sw: el.scrollWidth, cw: el.clientWidth });
    }
  }

  // 条本身放不下时，值列其实仍是完整的：不要再报"文本超出单元格"。
  // 作者能做的是换行（每行一条）或者改 ratio——把这句直接写进报告。
  for (const el of stage.querySelectorAll('.vk-bars')) {
    if (el.closest('.vk-page-bleed')) continue;
    if (el.clientWidth < 8) continue;
    if (el.scrollWidth > el.clientWidth + 3) {
      out.push({ type: 'narrow', el, what: 'vk-bars', sw: el.scrollWidth, cw: el.clientWidth });
    }
  }

  // 字节窗按「行」量，但行内是逐格排的：只有真的连半行都放不下（或行比容器宽）
  // 才报"格太窄"。400px 的窄卡里字节会自己换行，不该被当成撞字。
  for (const el of stage.querySelectorAll('vk-bytes')) {
    if (el.closest('.vk-page-bleed')) continue;
    let hit = null;
    for (const row of el.querySelectorAll('.vk-bytes-row')) {
      if (row.clientWidth < 8) continue;
      const cell = row.querySelector('.vk-bytes-x i');
      const cols = el.getAttribute('cols') === '4' ? 4 : 8;
      const cellW = cell ? cell.getBoundingClientRect().width : 0;
      // 8 列至少放得下 4 格、4 列至少 2 格：再窄就成"标签列"了，读不出字节行。
      const need = cellW ? Math.ceil(cols / 2) * cellW : 0;
      if (row.scrollWidth > row.clientWidth + 3 || (need > 0 && need > row.clientWidth + 1)) {
        hit = row;
        break;
      }
    }
    if (hit) out.push({ type: 'narrow', el, what: 'vk-bytes', sw: Math.round(hit.scrollWidth), cw: hit.clientWidth });
  }

  // pin 之间互相压住：auto 只选边，不承诺避让。
  const pinBoxes = [...stage.querySelectorAll('.vk-pin-bd')].map((el) => el.getBoundingClientRect());
  for (let i = 0; i < pinBoxes.length; i++) {
    for (let j = i + 1; j < pinBoxes.length; j++) {
      const a = pinBoxes[i];
      const b = pinBoxes[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) {
        out.push({ type: 'pin-overlap', what: '两个 pin 气泡重叠' });
      }
    }
  }

  /* ------------------------------------------------- 项目层 preset（可选）
     强调色 / 深色块 / 图标白名单 / 页眉 / 120 边距都是版面上的主张，不是事故。
     默认不跑；只有显式要（`vk check --style`、auditPage(root, {style:true})）才跑。
     判定本身在 runtime/style-preset.mjs，这里只负责"要不要问它"。 */
  if (options.style) {
    for (const x of auditStyle(stage)) out.push(x);
  }

  // 预编译/素材状态。
  const special = [];
  if (stage.querySelector('[data-vk-unknown]')) special.push(`未知图标：${stage.querySelector('[data-vk-unknown]').dataset.vkUnknown}`);
  if (stage.querySelector('[data-vk-stale]')) special.push('有组件缺少数据或数据已过期（data-vk-stale）');
  if (stage.querySelector('[data-vk-parsed]')) special.push('源码被浏览器解析（漏转义）');
  if (stage.querySelector('[data-vk-error]')) special.push('有元件渲染失败');
  if (
    stage.querySelector(
      'vk-img[data-error], vk-compare[data-error], vk-figure[data-error], .vk-fig-win[data-error]'
    )
  )
    special.push('图片加载失败');

  // 容量类问题：父级的 safe / overflow 往往只是子级裁切连带出来的。
  // 只报最里层根因，并给一个可执行的改法；不要让人先去修一个不存在的裁切。
  const CAP = new Set(['overflow', 'clip', 'clip-y', 'content-clip', 'audit-overflow']);
  const capIssues = out.filter((x) => x.el && CAP.has(x.type));
  for (const x of capIssues) {
    const child = capIssues.find((y) => y !== x && x.el !== y.el && x.el.contains(y.el));
    if (child) x.cascadeOf = child.what || child.type;
  }
  const issues = out
    .filter((x) => !x.cascadeOf)
    .map(({ el, ...rest }) => {
      const fix = fixFor(rest);
      return fix ? { ...rest, fix } : rest;
    });

  return { issues, special };
}

/** 容量问题的下一步：只给可执行的旋钮，不替作者做审美判断。 */
function fixFor(x) {
  if (x.type === 'content-clip') return `差 ${x.sh - x.ch}px：先试 gap 降一档 / mass="compact" / 删 1 条`;
  if (x.type === 'clip-y') return `差 ${x.sh - x.ch}px：先试 long="wrap" / mass="compact"`;
  if (x.type === 'clip') return `差 ${x.sw - x.cw}px：先试 long="wrap" / 删字符`;
  if (x.type === 'audit-overflow') return `差 ${Math.max(x.sw - x.cw, x.sh - x.ch)}px：先试 long="wrap" / mass="compact" / 删 1 行`;
  if (x.type === 'narrow') {
    if (x.what === 'vk-bytes') {
      return '格太窄：减少 cols（改用 4 列）或关掉 ascii / 换宽容器；不要继续压字';
    }
    return '格太窄：改成每行一条（换行），或改 ratio / 缩短标签；不要继续压值列';
  }
  if (x.type === 'overflow') return '先删内容或降一档间距；不要缩字';
  return null;
}

/**
 * 多页审计：一个文档里有 N 张 vk-page 时逐页查。
 *
 * `auditPage` 只看第一张 page —— 审阅页（16 帧拼一页）因此只测了第 1 帧。
 * 这里给每页带 index / id，CLI 才能把问题归因到具体帧。
 */
export function auditPages(root = document, options = {}) {
  const stages = [...(root.querySelectorAll?.('.vk-page, .vk-stage') || [])];
  if (!stages.length) return { pages: [], issues: [], special: [] };
  const pages = stages.map((stage, i) => {
    const r = auditPage(stage, options);
    return { index: i, id: stage.id || '', issues: r.issues, special: r.special };
  });
  return {
    pages,
    issues: pages.flatMap((p) => p.issues.map((x) => ({ ...x, page: p.index, pageId: p.id }))),
    special: pages.flatMap((p) => p.special.map((s) => `#${p.index + 1} ${p.id ? '#' + p.id + ' ' : ''}${s}`)),
  };
}

/**
 * 镜头度量：给「这一帧作为一张图是否成立」提供数字。
 *
 * 只测量、不判定 —— 阈值要等一整集/一整册的分布出来再定。
 *   contentTop    第一块内容（标题块之后）的 ink 顶
 *   contentBottom 内容 ink 底
 *   focus         焦点元素数（钴蓝/聚光/当前行）
 *   inkRatio      非白像素占比（需要截图，这里给不到，由 CLI 补）
 */
export function metrics(root = document) {
  const stages = [...(root.querySelectorAll?.('.vk-page, .vk-stage') || [])];
  return stages.map((stage, i) => {
    const safe = safeBox(stage);
    const sr = safe.getBoundingClientRect();
    const kids = [...(safe.children || [])].filter((el) => el.getBoundingClientRect().height > 0);
    // 内容底 = 最后一个可见块；14.0 没有 vk-title 了，标题就是普通的块。
    let first = kids.find((el) => !el.matches?.('[data-vk-overlay]')) || kids[0];
    const fr = first?.getBoundingClientRect();
    // 覆盖层不算内容：vk-edge 的 svg 铺满整页，把它算进来"内容底"永远是 1080。
    const rects = [...safe.querySelectorAll('*')]
      .filter((el) => !el.closest('svg') && !el.closest('vk-edge, vk-annotate, vk-note, vk-label[for], [data-vk-overlay]'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.width > 0);
    const maxBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : sr.bottom;
    const maxRight = rects.length ? Math.max(...rects.map((r) => r.right)) : sr.right;
    const focus = focusRegions(stage).length;
    return {
      index: i,
      id: stage.id || '',
      safeH: Math.round(sr.height),
      contentTop: fr ? Math.round(fr.top - sr.top) : null,
      contentBottom: Math.round(maxBottom - sr.top),
      contentLeft: fr ? Math.round(fr.left - sr.left) : null,
      contentRight: Math.round(maxRight - sr.left),
      focus,
      blocks: kids.length,
    };
  });
}

function safeBox(stage) {
  return stage.querySelector?.('.vk-page-bd') || stage.querySelector?.('.vk-stage') || stage;
}

/**
 * 焦点 = 一组「现在讲这里」的 region，不是一串 CSS 类。
 *
 * 同一个意思今天有十余种写法（current / state=current / data-hl / tone=focus / ring /
 * spotlight / tree-row[data-current] …），每种由各自的组件实现。这里把它们收进一份
 * 可数的清单，让审计与跨帧度量说同一种话。
 *
 * 三条归一规则：
 *   · 连续的高亮字节（一段 0–4）算 1 个 region，不是 5 个；
 *   · 被另一个 region 包住的元素不重复计数（格子套在圈里）；
 *   · 聚光的目标算 1 个 focus，其余退后算 context（context 不计数）。
 */
export function focusRegions(stage) {
  const found = new Set();
  const add = (el) => {
    if (el) found.add(el);
  };
  // 覆盖层自己身上的 data-tone（ring 的 SVG 默认 tone="focus"）不是"画面上的焦点"，
  // 它是画法。只数作者/姿态落在内容上的标记。
  const inOverlay = (el) => !!el?.closest?.('[data-vk-overlay]');
  // 标签（kicker/chip/badge）是导航，不是"看这里"：它说明这页讲什么，
  // 不该占本帧的注意力。否则给 kicker 上一层语义色就会被算成第二个焦点，
  // 和真正的答案抢位置——作者只好要么不给标签上色、要么把答案的颜色去掉。
  const inLabel = (el) => !!el?.closest?.('vk-label');
  const addInk = (el) => {
    if (el && !inOverlay(el) && !inLabel(el)) found.add(el);
  };

  for (const el of stage.querySelectorAll('[data-vk-focus]')) addInk(el);
  // 注意力只有两个来源：作者写的 act="focus"，以及运行期落到元素上的 data-act / data-tone。
  // 13.0 这里只认 [tone="focus"]，于是 pose 给块级元素上的焦点（data-tone）永远数不到——
  // CSS 把字涂蓝、审计说"只有一处焦点"。
  for (const el of stage.querySelectorAll('[data-act="focus"], [tone="focus"], [data-tone="focus"]')) addInk(el);
  for (const el of stage.querySelectorAll('.vk-line.is-hl, .vk-asm-row.is-hl')) add(el);
  // 一段高亮字节 = 一个 region：按容器归一，而不是按字节
  for (const el of stage.querySelectorAll('.vk-byte[data-hl="1"], .vk-byte-c[data-hl="1"]')) {
    add(el.closest('.vk-bytes-row') || el.closest('.vk-bytes') || el);
  }
  for (const el of stage.querySelectorAll(
    '.vk-cell[data-state="current"], .vk-tree-row[data-current], .vk-step[data-state="current"], .vk-tl-item[data-state="current"], .vk-bit-row[data-state="current"], .vk-bar[data-state="current"], tr[data-state="current"], li[data-state="current"]'
  ))
    addInk(el);
  // 圈选本身就是「看这里」：一个 ring 算一个焦点 region。
  // 但如果它圈的就是已经算过的焦点（聚光目标 / 高亮行），不再重复计数。
  for (const el of stage.querySelectorAll('vk-box[ring], vk-annotate[data-mode="circle"]')) {
    const expr = el.getAttribute('for') || '';
    const anchor = expr ? resolveAnchor(stage, expr, el) : null;
    if (anchor?.el && found.has(anchor.el)) continue;
    add(el);
  }

  // 相邻同款行合成一个 region：两行表格、五个高亮字节都只算「一处」。
  for (const el of [...found]) {
    if (!(el instanceof HTMLElement)) continue;
    const prev = el.previousElementSibling;
    if (prev && found.has(prev) && prev.className === el.className) found.delete(el);
  }

  // 去掉被更外层 region 包含的重复项
  const out = [];
  for (const el of found) {
    let dup = false;
    for (const other of found) {
      if (other === el) continue;
      if (other.contains(el)) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(el);
  }
  return out;
}

export function installAudit(VK) {
  // 阈值表也给出去：门禁在浏览器里跑时读它，而不是各自抄一份数字。
  VK.limits = LIMITS;
  VK.auditPage = auditPage;
  VK.auditPages = auditPages;
  // 项目层 preset：默认不跑，显式打开（vk check --style）才用。
  VK.auditStyle = auditStyle;
  VK.styleRules = STYLE_RULES;
  VK.metrics = metrics;
  VK.focusRegions = focusRegions;
}






