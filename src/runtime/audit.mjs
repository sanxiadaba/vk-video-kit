/**
 * 页面自检：作者页与标本页共用同一份。
 *
 * 只看作者最容易踩的六件事：字号、对比度、安全区、溢出、裁切、重叠、空锚点。
 * 不是"像素基线"，也不需要截图；CLI 的 `vk check`、`vk shot` 自检都调它。
 */

/**
 * 13.0 尺度梯的两个门槛（观看条件：手机横屏 0.38×）：
 * - 36 是硬地板（行号 / 单位 / 刻度 / 出处），0.38× 下 13.7px。
 * - 48 是"要读懂的内容"的门槛：一整句中文落在 36 或 40，就是排错了。
 *   用"含汉字 + 长于 12 字"判定"一整句"，短标签不算。
 * - 等宽数据（代码 / 表格数字 / 地址）走 40，x-height 比汉字大，可读性接近 48。
 */
const MIN_FONT = 36;
const CONTENT_FONT = 48;
const MIN_RATIO = 4.5;
const LARGE_RATIO = 3;
const LARGE_FONT = 96;
const DATA_FONT = 40;
const OVERLAYS = new Set(['vk-edge', 'vk-pin', 'vk-ring', 'vk-spotlight']);

export function auditPage(root = document) {
  const out = [];
  const stage = root.matches?.('.vk-page, .vk-stage') ? root : root.querySelector?.('.vk-page') || root.querySelector?.('.vk-stage') || root;
  const safe = safeBox(stage);
  const pageRect = stage.getBoundingClientRect();
  const safeRect = safe?.getBoundingClientRect();

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
  const safeSeen = new Set();
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
    const inOverlay = !!el.closest('vk-edge, vk-pin, vk-ring, vk-spotlight');
    const inSideNav = !!el.closest('[data-side-nav]');
    const inPageChrome = !!el.closest('.vk-page-hd, .vk-page-ft');
    const inBleed = !!el.closest('.vk-page-bleed');
    const pageScaffold = el.matches('.vk-page-inner, .vk-page-bd, .vk-page-hd, .vk-page-ft, .vk-page-bleed');

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // 出血层只收图/面：正文放进去会绕过安全区，直接报。
    if (hasText && inBleed) out.push({ type: 'bleed-text', what: clip(el.textContent || el.tagName) });
    const isMeta = !!(el.closest && el.closest('[data-meta]'));
    const isSup = !!(el.closest && el.closest('vk-inline[variant="sup"], vk-inline[variant="sub"]'));
    if (hasText && opaque(el) && !isSup && !inOverlay) {
      const fs = parseFloat(cs.fontSize);
      // 40 是硬地板，data-meta 也不能破：元数据只放宽对比度与句长，不放宽字号。
      if (fs < MIN_FONT) out.push({ type: 'font', what: clip(el.className || el.tagName), fs });
      if (!isMeta && fs < CONTENT_FONT) {
        const text = (el.textContent || '').replace(/\s+/g, '');
        const isSentence = /[\u4e00-\u9fff]/.test(text) && text.length > 12;
        if (isSentence) out.push({ type: 'font-content', what: clip(text.slice(0, 18)), fs });
      }
      const fg = parse(cs.color);
      if (fg) {
        const cr = ratio(fg, bgOf(el));
        const need = fs >= LARGE_FONT ? LARGE_RATIO : MIN_RATIO;
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

    if (safeRect && !inOverlay && !inSideNav && !inPageChrome && !pageScaffold && !inBleed) {
      if (
        (r.left < safeRect.left - 2 ||
          r.right > safeRect.right + 2 ||
          r.top < safeRect.top - 2 ||
          r.bottom > safeRect.bottom + 2) &&
        !covered(el, safeSeen)
      ) {
        safeSeen.add(el);
        out.push({
          type: 'safe',
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

  // 底部空带：这一页下半空了多少。
  //
  // 只测量，不判定：一整集里"每帧下半空一半"是分镜问题，不是组件问题，
  // 但作者需要一个数字才会去改。量的是「最低的一点墨到安全区底边」，
  // 不是"最大空块"——标题右侧的空白也会算成空块，那是正常版面，
  // 而这里要回答的是一个具体问题：内容到底沉到多高就没东西了。
  //
  // 跳过的两种页：vk-stage（组件标本台，只摆一个元件）与
  // 标了 data-allow-void 的纸（文献页/图版，空白是版式的一部分）。
  const voidExempt = stage.classList?.contains('vk-stage') || stage.hasAttribute?.('data-allow-void') || stage.closest?.('[data-allow-void]');
  if (safeRect && safeRect.height > 0 && !voidExempt) {
    const band = bottomGap(safe || stage, safeRect);
    if (band >= safeRect.height * 0.25) {
      out.push({
        type: 'void',
        what: `底部空 ${band}px（安全区 ${Math.round((band / safeRect.height) * 100)}%）`,
        box: [0, Math.round(safeRect.height - band), Math.round(safeRect.width), band],
        fix: '主角再大一档 / vk-page align="center" / 补一条撑住下半页的物证',
      });
    }
  }

  // 组件级溢出（Frame 原语）：内容比盒子宽/高。
  if (typeof window !== 'undefined' && typeof window.vk?.auditOverflow === 'function') {
    for (const a of window.vk.auditOverflow(stage)) {
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
  for (const el of stage.querySelectorAll('[w]')) {
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

  // 孤行：多行文本的最后一行少于 4 个汉字宽，读起来像排版事故。
  for (const el of stage.querySelectorAll('vk-text, .vk-title-sub, .vk-callout-bd, .vk-list li, .vk-quote-bd')) {
    if (el.closest('[data-meta]') || el.closest('svg')) continue;
    const text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length < 12) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 40;
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2);
    if (rects.length < 2) continue;
    const rows = [];
    for (const r of rects) {
      const row = rows.find((x) => Math.abs(x.top - r.top) < fs * 0.6);
      if (row) {
        row.left = Math.min(row.left, r.left);
        row.right = Math.max(row.right, r.right);
      } else rows.push({ top: r.top, left: r.left, right: r.right });
    }
    if (rows.length < 2) continue;
    const last = rows[rows.length - 1];
    const chars = (last.right - last.left) / fs;
    if (chars < 3.2) out.push({ type: 'orphan', what: clip(text.slice(0, 18)), chars: +chars.toFixed(1) });
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

  // 一帧最多一处焦点蓝：current 行 / 聚光 / focus 覆盖层合计。
  const focusNodes = new Set(
    stage.querySelectorAll(
      '.vk-line.is-hl, .vk-asm-row.is-hl, .vk-byte.is-hl, .vk-cell.is-hl, .vk-step[data-state="current"], .vk-tree-row[data-current], .vk-spotlight-ring, [tone="focus"]'
    )
  );
  if (focusNodes.size > 1) out.push({ type: 'blue', count: focusNodes.size, what: '一帧出现多处焦点蓝' });

  // 预编译/素材状态。
  const special = [];
  if (stage.querySelector('[data-vk-unknown]')) special.push(`未知图标：${stage.querySelector('[data-vk-unknown]').dataset.vkUnknown}`);
  if (stage.querySelector('[data-vk-stale]')) special.push('有预编译数据过期');
  if (stage.querySelector('[data-vk-parsed]')) special.push('源码被浏览器解析（漏转义）');
  if (stage.querySelector('[data-vk-error]')) special.push('有元件渲染失败');
  if (stage.querySelector('vk-img[data-error], vk-figure[data-error], .vk-fig-win[data-error]')) special.push('图片加载失败');

  // 容量类问题：父级的 safe / overflow 往往只是子级裁切连带出来的。
  // 只报最里层根因，并给一个可执行的改法；不要让人先去修一个不存在的裁切。
  const CAP = new Set(['safe', 'overflow', 'clip', 'clip-y', 'content-clip', 'audit-overflow']);
  const capIssues = out.filter((x) => x.el && CAP.has(x.type));
  for (const x of capIssues) {
    const child = capIssues.find((y) => y !== x && x.el !== y.el && x.el.contains(y.el));
    if (child) x.cascadeOf = child.what || child.type;
  }
  const issues = out
    .filter((x) => !x.cascadeOf)
    .map(({ el, ...rest }) => {
      const fix = fixFor(rest, safeRect);
      return fix ? { ...rest, fix } : rest;
    });

  return { issues, special };
}

/** 容量问题的下一步：只给可执行的旋钮，不替作者做审美判断。 */
function fixFor(x, safeRect) {
  if (x.type === 'content-clip') return `差 ${x.sh - x.ch}px：先试 gap 降一档 / density="compact" / 删 1 条`;
  if (x.type === 'clip-y') return `差 ${x.sh - x.ch}px：先试 long="wrap" / density="compact"`;
  if (x.type === 'clip') return `差 ${x.sw - x.cw}px：先试 long="wrap" / 删字符`;
  if (x.type === 'audit-overflow') return `差 ${Math.max(x.sw - x.cw, x.sh - x.ch)}px：先试 long="wrap" / density="compact" / 删 1 行`;
  if (x.type === 'overflow') return '先删内容或降一档间距；不要缩字';
  if (x.type === 'safe' && x.box && safeRect) {
    const [l, t, r, b] = x.box;
    const over = Math.max(safeRect.left - l, t - safeRect.top, r - safeRect.right, b - safeRect.bottom);
    return `超出 ${Math.round(over)}px：先试 title 降一档 / gap 降一档 / 删 1 行`;
  }
  return null;
}

/**
 * 多页审计：一个文档里有 N 张 vk-page 时逐页查。
 *
 * `auditPage` 只看第一张 page —— 审阅页（16 帧拼一页）因此只测了第 1 帧。
 * 这里给每页带 index / id，CLI 才能把问题归因到具体帧。
 */
export function auditPages(root = document) {
  const stages = [...(root.querySelectorAll?.('.vk-page, .vk-stage') || [])];
  if (!stages.length) return { pages: [], issues: [], special: [] };
  const pages = stages.map((stage, i) => {
    const r = auditPage(stage);
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
    // 内容 = 标题块之后的第一个可见块（标题块通常在 vk-stack 里）
    const title = safe.querySelector('vk-title');
    let first = null;
    if (title) {
      let n = title.nextElementSibling;
      while (n && !n.getBoundingClientRect().height) n = n.nextElementSibling;
      first = n;
    }
    if (!first) first = kids.find((el) => !el.matches?.('vk-title')) || kids[0];
    const fr = first?.getBoundingClientRect();
    // 覆盖层不算内容：vk-edge 的 svg 铺满整页，把它算进来"内容底"永远是 1080。
    const rects = [...safe.querySelectorAll('*')]
      .filter((el) => !el.closest('svg') && !el.closest('vk-edge, vk-pin, vk-ring, vk-spotlight, [data-vk-overlay]'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.width > 0);
    const maxBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : sr.bottom;
    const maxRight = rects.length ? Math.max(...rects.map((r) => r.right)) : sr.right;
    const focus = stage.querySelectorAll(
      '.vk-line.is-hl, .vk-asm-row.is-hl, .vk-byte.is-hl, .vk-cell.is-hl, .vk-step[data-state="current"], .vk-tree-row[data-current], .vk-spotlight-ring, [tone="focus"]'
    ).length;
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

const PARSE_RGB = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
};

/**
 * 底部空带：内容最低的一点墨到安全区底边还有多少。
 *
 * 只量一件事——"这页是不是一半空着"。什么算墨：
 *   · 文字（用 Range 取行盒，不看块级盒子；段落不会因为盒子高就算满）
 *   · 替换元素（img / canvas / video / svg）
 *   · 有面的块（背景色或背景图）
 *   · 只有边框的块（按边框算，框里是空的不算墨）
 * 覆盖层（聚光/圈选/连线）不算：那是"压暗"，不是内容。
 */
function bottomGap(holder, sr) {
  let inkBottom = 0;
  const mark = (left, top, right, bottom) => {
    if (right - left < 0.5 || bottom - top < 0.5) return;
    const b = Math.min(bottom, sr.bottom) - sr.top;
    if (b > inkBottom) inkBottom = b;
  };

  for (const el of holder.querySelectorAll('*')) {
    if (el.hasAttribute?.('data-vk-overlay')) continue;
    if (el.closest?.('vk-edge, vk-pin, vk-ring, vk-spotlight')) continue;
    if (el.closest?.('svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) < 0.15) continue;

    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) mark(r.left, r.top, r.right, r.bottom);
    }

    const tag = el.tagName;
    const replaced = tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'svg';
    const bg = PARSE_RGB(cs.backgroundColor);
    const hasBg = (bg && bg.a > 0.06) || (cs.backgroundImage && cs.backgroundImage !== 'none');
    const bw = (s) => parseFloat(cs[s]) || 0;
    const hasBorder = bw('borderBottomWidth') >= 1 && (PARSE_RGB(cs.borderBottomColor)?.a || 0) > 0.05;

    if (replaced || hasBg || hasBorder) {
      const r = el.getBoundingClientRect();
      mark(r.left, r.top, r.right, r.bottom);
    }
  }

  return Math.round(Math.max(0, sr.height - inkBottom));
}

export function installAudit(VK) {
  VK.auditPage = auditPage;
  VK.auditPages = auditPages;
  VK.metrics = metrics;
}
