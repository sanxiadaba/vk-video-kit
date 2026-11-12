/**
 * v19 · 自检与度量
 * ----------------------------------------------------------------------------
 * 硬错只有五类（无论怎么画都错）：
 *   1. 没有 <vk-page>，或画布不是 1920×1080
 *   2. 组件自己渲染失败
 *   3. 资源加载失败（图片、字体）
 *   4. 文字被裁 / 内容出界
 *   5. 锚点指空
 *
 * 其余（容量、留白、重叠、焦点数、对比度、字号）只报数，不拦。
 * 这不是门禁，是让作者看见。
 */

const PAGE_W = 1920;
const PAGE_H = 1080;

const rgb = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map((x) => parseFloat(x));
  return { r, g, b, a };
};

const lum = ({ r, g, b }) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

function bgOf(el) {
  let n = el;
  while (n && n.nodeType === 1) {
    const c = rgb(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c;
    n = n.parentElement;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** 真正有字/有图的那一块：用文本 Range 与图片矩形量，不用容器盒子（容器会被 grid 拉高）。 */
function inkBoxOf(stage) {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  const add = (r) => {
    if (r.width < 1 && r.height < 1) return;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  };
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    if (n.parentElement?.closest('.vk-sr')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) add(r);
  }
  for (const el of stage.querySelectorAll('img, svg.vk-gedges, .vk-co-ring, .vk-co-line, .vk-tl-dot, .vk-bit, .vk-cell, .vk-tl-i')) add(el.getBoundingClientRect());
  return Number.isFinite(top) ? { top, bottom, left, right } : null;
}

export function auditPage(stage) {
  const issues = [];
  const elements = [];
  const overlaps = [];
  const contrast = [];
  const push = (code, message, fix) => issues.push({ code, message, fix });

  const page = stage?.closest?.('vk-page');
  if (!page) {
    return { issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], metrics: null, elements, overlaps, contrast };
  }
  const pr = page.getBoundingClientRect();
  if (Math.round(pr.width) !== PAGE_W || Math.round(pr.height) !== PAGE_H) {
    push('FRAME', `画布是 ${Math.round(pr.width)}×${Math.round(pr.height)}，不是 1920×1080`, '检查页面样式是否覆盖了 vk-page 的宽高');
  }

  /* 2. 渲染失败 */
  for (const el of page.querySelectorAll('[data-vk-error]')) push('RENDER', `<${el.localName}> 渲染失败`, '看控制台里的 [vk] 错误；这是组件抛的，不是版式问题');

  /* 3. 资源 */
  for (const img of page.querySelectorAll('vk-img img')) {
    if (img.complete && img.naturalWidth === 0) {
      const host = img.closest('vk-img');
      push('ASSET', `图片没加载：${img.getAttribute('src') || '(没有 src)'}`, host?.getAttribute('alt') ? `alt="${host.getAttribute('alt')}"` : '检查路径是否相对页面文件');
    }
  }
  /* 只报「这一页真的用到、但没加载成功」的字体。没被用到的字体 check() 也会是 false。 */
  const usedFamily = [...page.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily).join(' ');
  for (const f of window.vk?._fonts || []) {
    if (!f.ok && usedFamily.includes(f.family)) push('ASSET', `字体没加载：${f.family}`, '跑一次 vk render 会重建字体；检查 assets/fonts 是否完整');
  }

  /* 5. 锚点 */
  for (const el of page.querySelectorAll('vk-callout[data-vk-anchor-missing]')) {
    const target = el.getAttribute('for') || el.getAttribute('to') || el.getAttribute('from') || '';
    push('ANCHOR', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@side:left；@line 是窗口里第几行，1 起');
  }

  /* 4. 文字超出容器（横向） */
  for (const el of page.querySelectorAll('.vk-lc, .vk-dc, .vk-title, .vk-lede, .vk-tl-label, .vk-tl-note, .vk-bar-l, vk-table td, vk-table th, .vk-step-t, .vk-cell-v')) {
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      push('CLIPPED', `<${el.localName} class="${String(el.className).split(' ')[0]}"> 的文字超出容器（宽 ${el.scrollWidth} > ${el.clientWidth}）`, '缩短这一行、拆帧，或让代码窗换行（long="wrap"）');
    }
  }
  for (const el of page.querySelectorAll('.vk-lines')) {
    if (el.scrollWidth > el.clientWidth + 4) push('CLIPPED', '代码窗横向被裁：字号已经缩到地板，仍然放不下', '把最长的行改短，或拆成两帧');
  }
  for (const el of page.querySelectorAll('.vk-lc, .vk-dc, .vk-aops, .vk-arow, .vk-brow')) {
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      push('CLIPPED', `这一行被裁掉了 ${el.scrollWidth - el.clientWidth}px：${(el.textContent || '').trim().slice(-32)}`, '改短这一行，或给这一件更多宽度 / 拆帧');
    }
  }

  /* 4. 墨迹出界 */
  const ink = inkBoxOf(stage);
  if (ink) {
    const bottom = ink.bottom - pr.top;
    const top = ink.top - pr.top;
    if (bottom > PAGE_H + 2) push('CLIPPED', `内容超出画布底部 ${Math.round(bottom - PAGE_H)}px`, '拆帧，或改用更少的内容');
    if (top < -2) push('CLIPPED', `内容超出画布顶部 ${Math.round(-top)}px`, '检查是否用了绝对定位');
  }

  /* 正文区密度：标题带是固定的，把它算进去会让空帧也显得满。 */
  const body = page.querySelector('.vk-body');
  const bodyInk = body ? inkBoxOf(body) : null;
  const bodyRect = body?.getBoundingClientRect();
  const bodyH = bodyRect?.height || 0;
  const fill = bodyInk && bodyH ? Math.round(((bodyInk.bottom - bodyInk.top) / bodyH) * 100) : 0;

  const metrics = ink
    ? {
        contentTop: Math.max(0, Math.round(ink.top - pr.top)),
        contentBottom: Math.round(ink.bottom - pr.top),
        contentLeft: Math.max(0, Math.round(ink.left - pr.left)),
        contentRight: Math.round(ink.right - pr.left),
        bodyTop: bodyInk ? Math.round(bodyInk.top - pr.top) : 0,
        bodyBottom: bodyInk ? Math.round(bodyInk.bottom - pr.top) : 0,
        fill,
        focus: 0,
      }
    : { contentTop: 0, contentBottom: 0, contentLeft: 0, contentRight: 0, bodyTop: 0, bodyBottom: 0, fill: 0, focus: 0 };

  /* 焦点 = 空间上独立的「看这里」的处数：当前行 + 圈在同一行上算一处。
     <em> 是正文强调，不是焦点，不能算进来。 */
  /* 一个件里多处高亮（字节的十六进制列 + ASCII 列）算一处；
     圈选如果落在已经是 current 的件上，也算同一处。 */
  const hostBoxes = [];
  const hostSeen = new Set();
  for (const el of page.querySelectorAll('[data-state="current"], [state="current"], .is-cur')) {
    const host = el.closest('vk-code, vk-cells, vk-bytes, vk-table, vk-list, vk-steps, vk-bars, vk-timeline, vk-graph, vk-seq, vk-tree, .vk-gnode') || el;
    if (hostSeen.has(host)) continue;
    hostSeen.add(host);
    hostBoxes.push(host.getBoundingClientRect());
  }
  let focus = hostBoxes.length;
  for (const ring of page.querySelectorAll('.vk-co-ring')) {
    const r = ring.getBoundingClientRect();
    const onCurrent = hostBoxes.some((b) => b.left < r.right + 24 && r.left < b.right + 24 && b.top < r.bottom + 24 && r.top < b.bottom + 24);
    if (!onCurrent) focus++;
  }
  metrics.focus = focus;

  /* 手机上小于 16px 的字：现在只报数，不拦。 */
  const small = [];
  const seenSmall = new Set();
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.replace(/\u200b/g, '').trim()) continue;
    const el = n.parentElement;
    if (!el || seenSmall.has(el)) continue;
    if (el.closest('.vk-sr')) continue;
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize) || 0);
    if (fs && fs < 39.5) {
      seenSmall.add(el);
      small.push({ text: (n.textContent || '').trim().slice(0, 18), px: fs, mobile: Math.round(fs * 0.406 * 10) / 10 });
    }
  }

  const counts = {};
  for (const el of page.querySelectorAll('vk-page *')) {
    if (!el.localName.startsWith('vk-') || el.closest('vk-callout')) continue;
    counts[el.localName] = (counts[el.localName] || 0) + 1;
  }
  const codeLines = [...page.querySelectorAll('vk-code')].map((c) => c.querySelectorAll('.vk-line, .vk-drow, .vk-arow').length);

  /* 只给建议，不改退出码。 */
  const advice = [];
  if (fill > 0 && fill < 45) advice.push(`正文只占 ${fill}%：放大这一件，或把下一帧的内容提前`);
  if (fill > 100) advice.push(`正文区 ${fill}%：这一帧已经塞满，拆帧或减一行`);
  if (metrics.focus > 1) advice.push(`焦点 ${metrics.focus} 处：一帧只留一处 current`);
  if (small.length) advice.push(`${small.length} 处字在手机上 < 16px（${small.slice(0, 3).map((s) => `"${s.text}" ${s.mobile}px`).join('、')}）`);
  if (overlaps.length) advice.push(`${overlaps.length} 处组件重叠`);
  if (contrast.length) advice.push(`${contrast.length} 处对比度 < 4.5`);
  if (codeLines.some((n) => n > 6)) advice.push(`代码 ${Math.max(...codeLines)} 行 > 6：拆帧，或只留关键行`);
  const bits = page.querySelectorAll('.vk-bit').length;
  if (bits > 16) advice.push(`这一帧有 ${bits} 位 > 16：拆帧，或只讲其中一段`);

  /* 元素清单（frame.json）：只列 vk-* 与标题行，坐标相对页面。 */
  for (const el of page.querySelectorAll('vk-page *')) {
    if (el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!el.localName.startsWith('vk-') && !el.classList.contains('vk-title')) continue;
    elements.push({
      tag: el.localName,
      id: el.id || '',
      x: Math.round(r.left - pr.left),
      y: Math.round(r.top - pr.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      fs: Math.round(parseFloat(getComputedStyle(el).fontSize) || 0),
    });
  }

  /* 重叠：同一层相邻块之间有明显相交才报。 */
  const groups = [page.querySelector('.vk-body'), ...page.querySelectorAll('vk-flow')].filter(Boolean);
  for (const g of groups) {
    const kids = [...g.children].filter((c) => c.localName.startsWith('vk-') && !c.closest('vk-callout'));
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w <= 2 || h <= 2) continue;
        const area = w * h;
        const min = Math.min(a.width * a.height, b.width * b.height);
        if (min > 0 && area / min > 0.06) overlaps.push({ a: kids[i].localName, b: kids[j].localName, area: Math.round(area) });
      }
    }
  }

  /* 对比度：文字元素的实际颜色 vs 最近的实底。 */
  for (const el of page.querySelectorAll('vk-text, .vk-title, .vk-lede, vk-code, vk-table, vk-tree, vk-cells, vk-bars, vk-timeline, vk-steps, vk-list, .vk-co-note')) {
    const cs = getComputedStyle(el);
    const fg = rgb(cs.color);
    if (!fg) continue;
    const r = ratio(fg, bgOf(el));
    if (r < 4.5) contrast.push({ text: (el.textContent || '').trim().slice(0, 24), ratio: Number(r.toFixed(2)), size: Math.round(parseFloat(cs.fontSize) || 0) });
  }

  return { issues, metrics, elements, overlaps, contrast, small, counts, advice };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vk ||= {};
  window.vk.auditPage = auditPage;
  window.vk.auditDocument = auditDocument;
}
