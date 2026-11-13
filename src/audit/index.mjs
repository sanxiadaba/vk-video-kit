/**
 * v23 · 自检
 * ----------------------------------------------------------------------------
 * 硬错只有五类（无论怎么画都错）：
 *   1. 没有 <vk-page>，或画布不是 1920×1080
 *   2. 组件自己渲染失败
 *   3. 资源加载失败（图片、字体）
 *   4. 文字被裁 / 内容出界
 *   5. 标注指空
 *
 * 其余（容量、留白、重叠、焦点数、字号、安全区）只报数，不拦。
 * 对比度不在这里逐帧扫：token 级单测已经保证。
 */
const PAGE_W = 1920;
const PAGE_H = 1080;

const textBox = (root) => {
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  const add = (r) => {
    if (r.width < 0.5 || r.height < 0.5) return;
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    if (n.parentElement?.closest('.katex-mathml')) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) add(r);
  }
  return Number.isFinite(top) ? { top, bottom, left, right } : null;
};

const inkBox = (root) => {
  const t = textBox(root);
  let out = t;
  const add = (r) => {
    if (r.width < 1 && r.height < 1) return;
    out = out
      ? { top: Math.min(out.top, r.top), bottom: Math.max(out.bottom, r.bottom), left: Math.min(out.left, r.left), right: Math.max(out.right, r.right) }
      : { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  };
  for (const el of root.querySelectorAll('img, svg.vk-gedges, .vk-co-ring, .vk-co-line, .vk-tl-dot, .vk-bit, .vk-cell, .vk-tl-i, .vk-gnode')) add(el.getBoundingClientRect());
  return out;
};

export function auditPage(stage) {
  const issues = [];
  const advice = [];
  const overlaps = [];
  const small = [];
  const push = (code, message, fix) => issues.push({ code, message, fix });
  const say = (code, message) => advice.push({ code, message });

  const page = stage?.closest?.('vk-page');
  if (!page) return { issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], metrics: null, advice, overlaps, small, counts: {} };

  const pr = page.getBoundingClientRect();
  if (Math.round(pr.width) !== PAGE_W || Math.round(pr.height) !== PAGE_H) {
    push('FRAME', `画布是 ${Math.round(pr.width)}×${Math.round(pr.height)}，不是 1920×1080`, '检查页面样式是否覆盖了 vk-page 的宽高');
  }

  for (const el of page.querySelectorAll('[data-vk-error]')) push('RENDER', `<${el.localName}> 渲染失败`, '看控制台里的 [vk] 错误；这是组件抛的，不是版式问题');

  for (const img of page.querySelectorAll('vk-img img')) {
    if (img.complete && img.naturalWidth === 0) {
      const host = img.closest('vk-img');
      push('ASSET', `图片没加载：${img.getAttribute('src') || '(没有 src)'}`, host?.getAttribute('alt') ? `alt="${host.getAttribute('alt')}"` : '检查路径是否相对页面文件');
    }
  }
  const usedFamily = [...page.querySelectorAll('*')].map((el) => getComputedStyle(el).fontFamily).join(' ');
  for (const f of window.vk?._fonts || []) {
    if (!f.ok && usedFamily.includes(f.family)) push('ASSET', `字体没加载：${f.family}`, '跑一次 vk build 会重建字体；检查 dist/fonts 是否完整');
  }

  for (const el of page.querySelectorAll('vk-callout[data-vk-anchor-missing]')) {
    const target = el.getAttribute('for') || el.getAttribute('to') || el.getAttribute('from') || '';
    push('ANCHOR', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left；@line 是窗口里第几行，1 起');
  }

  /* 文字横向被裁：一行只报一次。 */
  const clipSelectors = '.vk-lc, .vk-dc, .vk-title, .vk-lede, .vk-tl-label, .vk-tl-note, .vk-bar-l, vk-table td, vk-table th, .vk-step-t, .vk-cell-v, .vk-seq-l, .vk-seq-note, .vk-gn-l, .vk-cap, .vk-bhex, .vk-bascii';
  for (const el of page.querySelectorAll(clipSelectors)) {
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      push('CLIPPED', `文字超出容器（宽 ${el.scrollWidth} > ${el.clientWidth}）：${(el.textContent || '').trim().slice(0, 24)}`, '缩短这一行、拆帧，或给这一件更多宽度');
    }
  }
  for (const el of page.querySelectorAll('.vk-lines')) {
    if (el.scrollWidth > el.clientWidth + 4) push('CLIPPED', '代码窗横向被裁：字号已经缩到地板，仍然放不下', '把最长的行改短，或拆成两帧');
  }

  const ink = inkBox(stage);
  if (ink) {
    const bottom = ink.bottom - pr.top;
    const top = ink.top - pr.top;
    if (bottom > PAGE_H + 2) push('CLIPPED', `内容超出画布底部 ${Math.round(bottom - PAGE_H)}px`, '拆帧，或改用更少的内容');
    if (top < -2) push('CLIPPED', `内容超出画布顶部 ${Math.round(-top)}px`, '检查是否用了绝对定位');
  }

  const body = page.querySelector('.vk-body');
  const bodyRect = body?.getBoundingClientRect();
  const bodyInk = body ? inkBox(body) : null;
  const fill = bodyInk && bodyRect?.height ? Math.round(((bodyInk.bottom - bodyInk.top) / bodyRect.height) * 100) : 0;

  /* 安全区：只用文字算，避免整帧图片误报。 */
  const cs = stage ? getComputedStyle(stage) : null;
  const safeRect = cs
    ? {
        left: pr.left + parseFloat(cs.paddingLeft || 0),
        right: pr.right - parseFloat(cs.paddingRight || 0),
        top: pr.top + parseFloat(cs.paddingTop || 0),
        bottom: pr.bottom - parseFloat(cs.paddingBottom || 0),
      }
    : null;
  const tb = textBox(stage);
  const tol = 12;
  const safe = safeRect && tb
    ? {
        ok: tb.left >= safeRect.left - tol && tb.right <= safeRect.right + tol && tb.top >= safeRect.top - tol && tb.bottom <= safeRect.bottom + tol,
        left: Math.round(safeRect.left - tb.left),
        right: Math.round(tb.right - safeRect.right),
        top: Math.round(safeRect.top - tb.top),
        bottom: Math.round(tb.bottom - safeRect.bottom),
      }
    : { ok: true, left: 0, right: 0, top: 0, bottom: 0 };

  /* 焦点：空间上独立的「看这里」的处数；一个件里多处高亮算一处。 */
  const hostBoxes = [];
  const hostSeen = new Set();
  for (const el of page.querySelectorAll('[current], .is-cur')) {
    const host = el.closest('vk-code, vk-cells, vk-bytes, vk-bits, vk-table, vk-list, vk-steps, vk-bars, vk-timeline, vk-graph, vk-seq, vk-dir') || el;
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

  /* 小字：只报「正文级」的，行号/单位/地址这类有意的小字跳过。 */
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const seenSmall = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.replace(/\u200b/g, '').trim()) continue;
    const el = n.parentElement;
    if (!el || seenSmall.has(el)) continue;
    if (el.closest('small, kbd, code, .vk-unit, .vk-fn, .vk-ln, .vk-baddr, .vk-aaddr, .vk-abytes, .vk-co-label, .vk-co-note, .katex-mathml, .vk-gedge, [hidden]')) continue;
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize) || 0);
    if (fs && fs < 39.5) {
      seenSmall.add(el);
      small.push({ text: (n.textContent || '').trim().slice(0, 18), px: fs, mobile: Math.round(fs * 0.406 * 10) / 10 });
    }
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

  /* 容量与结构建议（不是硬错）。 */
  const counts = {};
  for (const el of page.querySelectorAll('vk-page *')) {
    if (!el.localName.startsWith('vk-') || el.closest('vk-callout')) continue;
    counts[el.localName] = (counts[el.localName] || 0) + 1;
  }
  const codeLines = [...page.querySelectorAll('vk-code')].map((c) => c.querySelectorAll('.vk-line:not(.is-fold), .vk-drow, .vk-arow').length);
  const bits = page.querySelectorAll('.vk-bit').length;
  const seqRows = page.querySelectorAll('.vk-seq-row').length;
  const tableRows = [...page.querySelectorAll('vk-table')].map((t) => t.querySelectorAll('tr[current], tr').length);

  if (fill > 0 && fill < 45) say('FILL_LOW', `正文只占 ${fill}%：放大这一件，或把下一帧的内容提前`);
  if (fill > 100) say('FILL_HIGH', `正文区 ${fill}%：这一帧已经塞满，拆帧或减一行`);
  if (focus > 1) say('FOCUS', `焦点 ${focus} 处：一帧只留一处 current`);
  if (small.length) say('SMALL', `${small.length} 处字在手机上 < 16px（${small.slice(0, 3).map((s) => `"${s.text}" ${s.mobile}px`).join('、')}）`);
  if (overlaps.length) say('OVERLAP', `${overlaps.length} 处组件重叠`);
  if (!safe.ok) {
    const sides = [
      safe.left > 12 ? `左 ${safe.left}px` : '',
      safe.right > 12 ? `右 ${safe.right}px` : '',
      safe.top > 12 ? `上 ${safe.top}px` : '',
      safe.bottom > 12 ? `下 ${safe.bottom}px` : '',
    ].filter(Boolean);
    say('SAFE', `文字进了安全区外：${sides.join(' / ')}；手机播放器 UI 会盖住这里`);
  }
  if (codeLines.some((n) => n > 6)) say('CODE_LINES', `代码 ${Math.max(...codeLines)} 行 > 6：拆帧，或只留关键行`);
  if (bits > 16) say('BITS', `这一帧有 ${bits} 位 > 16：拆帧，或只讲其中一段`);
  if (seqRows > 5) say('SEQ', `时序 ${seqRows} 条 > 5：拆帧`);
  if (tableRows.some((n) => n > 5)) say('TABLE', `表格 ${Math.max(...tableRows)} 行（含表头）> 5：拆帧或去掉一行`);
  const longCaption = [...page.querySelectorAll('vk-text[size="caption"], .vk-cap')].filter((el) => {
    const t = (el.textContent || '').trim();
    return t.length > 18 || /[。！？]$/.test(t);
  }).length;
  if (longCaption) say('CAPTION', `${longCaption} 处整句用了 caption（16.2px）：整句用 body / ink2，caption 只做标签`);

  const metrics = ink
    ? {
        contentTop: Math.max(0, Math.round(ink.top - pr.top)),
        contentBottom: Math.round(ink.bottom - pr.top),
        contentLeft: Math.max(0, Math.round(ink.left - pr.left)),
        contentRight: Math.round(ink.right - pr.left),
        bodyTop: bodyInk ? Math.round(bodyInk.top - pr.top) : 0,
        bodyBottom: bodyInk ? Math.round(bodyInk.bottom - pr.top) : 0,
        bodyHeight: bodyRect ? Math.round(bodyRect.height) : 0,
        fill,
        focus,
        safe,
      }
    : { contentTop: 0, contentBottom: 0, contentLeft: 0, contentRight: 0, bodyTop: 0, bodyBottom: 0, bodyHeight: 0, fill: 0, focus, safe };

  return { issues, metrics, advice, overlaps: overlaps.slice(0, 12), small: small.slice(0, 8), counts, codeLines, bits };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vkAudit = { page: auditPage, document: auditDocument };
}
