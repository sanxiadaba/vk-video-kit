/**
 * v24 · 自检
 * ----------------------------------------------------------------------------
 * 只报「画不出来 / 确实坏了」：
 *   1. 没有 <vk-page>，或画布不是 1920×1080
 *   2. 组件自己渲染失败
 *   3. 资源加载失败（图片、字体）
 *   4. 文字被裁 / 内容出界
 *   5. 标注指空
 *
 * 不报容量、留白、焦点数、字号、安全区、重叠、对比度——那是作者和视觉设计的事。
 * 默认也不拦出图：issues 写进 JSON，页面照样出。
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
  let out = textBox(root);
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
  const push = (code, message, fix) => issues.push({ code, message, fix });

  const page = stage?.closest?.('vk-page');
  if (!page) return { issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }] };

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

  return { issues };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vkAudit = { page: auditPage, document: auditDocument };
}
