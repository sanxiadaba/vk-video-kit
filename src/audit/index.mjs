/**
 * v25 · 自检（体检单）
 * ----------------------------------------------------------------------------
 * 只陈述事实，不评分、不拦出图：
 *
 *   硬错（无论怎么画都错）  没有画布 / 画布尺寸不对 / 组件渲染失败 / 资源没加载 / 文字被裁 / 标注指空
 *   事实（作者自己判断）    正文带多高、内容多高、超出多少、焦点几处、每个块的实际字号
 *
 * 「放不下」不再被偷偷缩字掩盖：这里只报「内容 640，正文带 546，超出 94px」。
 */
const PAGE_W = 1920;
const PAGE_H = 1080;
const CLIENTS = '.vk-lc, .vk-dc, .vk-ftitle, .vk-tname, .vk-cap, .vk-bhex, .vk-bascii, .vk-tl-label, .vk-tl-note, .vk-bar-l, .vk-cell-v, .vk-step-t, .vk-seq-l, .vk-seq-note, .vk-gn-l, .vk-grn-l';

export function auditPage(stage) {
  const issues = [];
  const push = (code, message, fix) => issues.push({ code, message, fix });

  const page = stage?.closest?.('vk-page');
  if (!page) return { ok: false, issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], health: null };

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
    push('ANCHOR', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left');
  }

  for (const el of page.querySelectorAll(CLIENTS)) {
    if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
      push('CLIPPED', `文字超出容器（宽 ${el.scrollWidth} > ${el.clientWidth}）：${(el.textContent || '').trim().slice(0, 24)}`, '缩短这一行、拆帧，或给这一件更多宽度');
    }
  }
  for (const el of page.querySelectorAll('.vk-lines')) {
    if (el.scrollWidth > el.clientWidth + 4) push('CLIPPED', '代码窗横向被裁：最长的行放不下', '把最长的行改短，或拆帧');
  }

  /* ---------------------------------------------------------------- 事实 */
  const head = stage.querySelector('[data-vk="head"]');
  const body = stage.querySelector('.vk-body');
  const bodyH = body ? Math.round(body.getBoundingClientRect().height) : 0;
  const headH = head ? Math.round(head.getBoundingClientRect().height) : 0;
  const blocks = body
    ? [...body.children].filter((el) => {
        if (el.matches('vk-callout')) return false;
        if (el.matches("vk-img[bleed='all']")) return false;
        const pos = getComputedStyle(el).position;
        return pos !== 'absolute' && pos !== 'fixed';
      })
    : [];
  const rects = blocks.map((el) => el.getBoundingClientRect());
  const contentH = rects.length ? Math.round(Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))) : 0;
  const overflow = Math.max(0, contentH - bodyH);

  const hosts = new Set();
  for (const el of page.querySelectorAll('[current], .is-cur')) {
    const host = el.closest('[data-vk]');
    if (host && !host.matches('vk-page')) hosts.add(host);
  }

  const blockFacts = blocks.map((el) => {
    const leaves = el.querySelectorAll('td, th, .vk-lc, .vk-dc, .vk-step-l, .vk-tl-label, .vk-bar-v, .vk-cell-v, .vk-seq-l, .vk-gn-l, .vk-field-l, .vk-bit-v, .vk-tname, .vk-ftitle, .vk-lede');
    const sizes = [...(leaves.length ? leaves : [el])].map((n) => parseFloat(getComputedStyle(n).fontSize) || 0);
    return {
      vk: el.getAttribute('data-as') || el.getAttribute('data-vk') || el.localName,
      h: Math.round(el.getBoundingClientRect().height),
      font: Math.round(Math.max(...sizes, 0)),
    };
  });

  return {
    ok: issues.length === 0 && overflow === 0,
    issues,
    health: {
      head: headH,
      band: bodyH,
      content: contentH,
      overflow,
      focus: hosts.size,
      blocks: blockFacts,
    },
  };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vkAudit = { page: auditPage, document: auditDocument };
}
