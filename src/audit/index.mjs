/**
 * v26 · 自检（体检单）
 * ----------------------------------------------------------------------------
 * 只陈述事实，不评分、不拦出图。两件事：
 *
 *   硬错（无论怎么画都错）
 *     没有画布 / 画布尺寸不对 / 组件渲染失败 / 资源没加载 / 文字被裁 /
 *     元素出画布 / 块与块重叠 / 标注指空 / 空帧
 *
 *   事实（作者自己判断）
 *     正文带多高、内容多高、超出多少、上下余量、焦点几处、每个块多高、
 *     最小字号、哪些字被裁、哪些图被拉伸
 *
 * 「放不下」只是事实：这里只报「内容 640，正文带 546，超出 94px」。
 * 容量、留白、焦点数都不拦，只报数。
 */
import { CANVAS } from '../vocab.mjs';

const PAGE_W = CANVAS.w;
const PAGE_H = CANVAS.h;
const EPS = 4;

const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const rectOf = (el) => el.getBoundingClientRect();
const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4;

/** 所有「真的在页面上」的元素；绝对定位的标注层不在其中。 */
function visible(root) {
  const out = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('.vk-co, svg, script, style, template, .katex-mathml, math')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    out.push(el);
  }
  return out;
}

/** 横向被裁：元素自己的内容比盒子宽，且它（或中间祖先）会裁掉。取最深的那个，不重复报祖先。 */
function clipped(root) {
  const hits = [];
  const page = root;
  for (const el of visible(root)) {
    if (!textOf(el)) continue;
    const cs = getComputedStyle(el);
    const own =
      cs.overflowX === 'hidden' ||
      cs.overflowX === 'clip' ||
      cs.whiteSpace === 'nowrap' ||
      cs.whiteSpace === 'pre' ||
      /* 正常换行的叶子也可能被一个不可断的长词顶出去。 */
      (cs.overflowX === 'visible' && cs.whiteSpace === 'normal' && !el.children.length);
    /* 只看中间祖先：页面自己的 overflow:hidden 是画布边界，越界交给 outside。 */
    let anc = false;
    for (let p = el.parentElement; p && p !== page; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'hidden' || ps.overflowX === 'clip') {
        anc = true;
        break;
      }
    }
    if (!own && !anc) continue;
    if (el.clientWidth <= 0) continue;
    if (el.scrollWidth <= el.clientWidth + EPS) continue;
    hits.push(el);
  }
  /* 注记是覆盖层，但它的字也会被右边缘裁掉。 */
  for (const el of root.querySelectorAll('.vk-co-note')) {
    if (el.hidden) continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + EPS) hits.push(el);
  }
  return hits
    .filter((el) => !hits.some((other) => other !== el && el.contains(other)))
    .map((el) => ({
      vk: el.closest('[data-as]')?.getAttribute('data-as') || el.closest('[data-vk]')?.getAttribute('data-vk') || el.localName,
      id: el.closest('[id]')?.id || null,
      line: el.closest('[data-vk-line]')?.getAttribute('data-vk-line') || null,
      text: textOf(el).slice(0, 36),
      over: Math.round(el.scrollWidth - el.clientWidth),
    }));
}

/** 出画布：正文块、图节点、时间点、注记，全都量；坐标一律相对画布左上角。 */
function outside(root, body, origin) {
  const out = [];
  const seen = new Set();
  const els = [
    ...(body ? [...body.children] : []),
    ...root.querySelectorAll('[data-vk], .vk-lc, .vk-line, .vk-arow, .vk-gnode, .vk-tl-i, .vk-tl-label, .vk-tl-note, .vk-seq-row, .vk-cell, .vk-bit, .vk-co-note'),
  ];
  for (const el of els) {
    if (el === root || seen.has(el)) continue;
    seen.add(el);
    if (el.matches('vk-callout')) continue;
    if (el.closest('svg, .vk-co-svg, .vk-co-label, [bleed="all"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = rectOf(el);
    if (r.width < 1 && r.height < 1) continue;
    const left = r.left - origin.left;
    const top = r.top - origin.top;
    const right = r.right - origin.left;
    const bottom = r.bottom - origin.top;
    const sides = [];
    if (left < -EPS) sides.push('left');
    if (right > PAGE_W + EPS) sides.push('right');
    if (top < -EPS) sides.push('top');
    if (bottom > PAGE_H + EPS) sides.push('bottom');
    if (!sides.length) continue;
    const id = el.closest('[id]')?.id || null;
    const line = el.closest('[data-vk-line]')?.getAttribute('data-vk-line') || null;
    out.push({
      vk: el.closest('[data-as]')?.getAttribute('data-as') || el.closest('[data-vk]')?.getAttribute('data-vk') || el.localName,
      id,
      item: el.getAttribute('data-vk-item') || null,
      line,
      sides,
      over: Math.round(Math.max(0, -left, right - PAGE_W, -top, bottom - PAGE_H)),
    });
    if (out.length >= 30) break;
  }
  return out;
}

/** 块与块重叠：正文第一层、flow 的子项、注记；绝对定位的标注 host 不算。 */
function overlaps(body, root) {
  const list = body
    ? [...body.children].flatMap((el) => {
        if (el.getAttribute('data-vk') !== 'flow') return [el];
        if (el.hasAttribute('overlay')) return [el]; /* overlay 是有意叠放 */
        return [...el.children];
      })
    : [];
  const notes = [...root.querySelectorAll('.vk-co-note')].filter((n) => !n.hidden);
  const all = [...list, ...notes].filter((el) => {
    if (el.matches('vk-callout')) return false;
    if (el.matches('[bleed="all"]')) return false;
    const cs = getComputedStyle(el);
    return cs.position !== 'fixed' && rectOf(el).height > 1;
  });
  const out = [];
  const name = (el, i) => el.id || el.getAttribute('data-vk-item') || el.getAttribute('data-vk-line') || el.closest('[data-as]')?.getAttribute('data-as') || el.closest('[data-vk]')?.getAttribute('data-vk') || `${el.localName}${i + 1}`;
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].contains(all[j]) || all[j].contains(all[i])) continue;
      const a = rectOf(all[i]);
      const b = rectOf(all[j]);
      if (intersects(a, b)) out.push({ a: name(all[i], i), b: name(all[j], j), over: Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) });
    }
  return out;
}

function images(root) {
  const out = [];
  for (const img of root.querySelectorAll('vk-img img')) {
    const box = rectOf(img);
    const fit = getComputedStyle(img).objectFit || 'fill';
    const nw = img.naturalWidth || 0;
    const nh = img.naturalHeight || 0;
    out.push({ src: img.getAttribute('src') || '', natural: [nw, nh], box: [Math.round(box.width), Math.round(box.height)], fit });
  }
  return out;
}

/** 最小的「真在显示的字」；只报事实，不拦。 */
function smallText(root) {
  let min = Infinity;
  const list = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('.vk-co, svg')) continue;
    if (el.children.length) continue;
    const text = textOf(el).replace(/[\s\u200b\u200c\u200d]/g, '');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const size = parseFloat(cs.fontSize) || 0;
    if (!size) continue;
    if (size < min) min = size;
    if (size < 56 - 0.5 && list.length < 8) list.push({ text: text.slice(0, 24), size: Math.round(size) });
  }
  return { min: Number.isFinite(min) ? Math.round(min) : 0, under56: list };
}

/** 焦点：数「当前项」的出现次数，不按宿主去重；标注另记一笔。
    图里「节点 + 它的两条边」是同一个故事，边不重复计数。 */
function focus(root) {
  const cur = [...root.querySelectorAll('[current], .is-cur')].filter((el) => !el.closest('.vk-co'));
  const graphNodes = new Set([...root.querySelectorAll('.vk-gnode[current]')].map((n) => n.dataset.id).filter(Boolean));
  const top = cur.filter((el) => {
    if (el.matches('.vk-gedge') && (graphNodes.has(el.dataset.from) || graphNodes.has(el.dataset.to))) return false;
    return !cur.some((other) => other !== el && other.contains(el));
  });
  return { current: top.length, callout: root.querySelectorAll('vk-callout').length };
}

export function auditPage(stage) {
  const issues = [];
  const push = (code, message, fix) => issues.push({ code, message, fix });

  const page = stage?.closest?.('vk-page');
  if (!page) return { ok: false, issues: [{ code: 'FRAME', message: '这一页没有 <vk-page>', fix: '把内容包进 <vk-page>…</vk-page>' }], health: null };

  const pr = rectOf(page);
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
  /* 只有真的渲染了字，才要求字体；空帧/坏块不该报字体。 */
  const textEls = [...page.querySelectorAll('*')].filter((e) => textOf(e) && !e.closest('.vk-missing'));
  const usedFamily = textEls.map((e) => getComputedStyle(e).fontFamily).join(' ');
  for (const f of window.vk?._fonts || []) {
    if (!f.ok && usedFamily.includes(f.family)) push('ASSET', `字体没加载：${f.family}`, '跑一次 vk build 会重建字体；检查 dist/fonts 是否完整');
  }

  for (const el of page.querySelectorAll('vk-callout[data-vk-anchor-missing]')) {
    const target = el.getAttribute('for') || el.getAttribute('to') || el.getAttribute('from') || '';
    push('ANCHOR', `标注指不到东西：${target}`, '锚点只认 #id / #id@line:3 / #id@item:2 / #id@bit:5 / #id@side:left');
  }

  const body = stage.querySelector('.vk-body');
  const clips = clipped(page);
  for (const c of clips) push('CLIPPED', `横向被裁：<${c.vk}>「${c.text}」多出 ${c.over}px`, '缩短这一行、拆帧，或给这一件更多宽度');

  const outs = outside(page, body, rectOf(page));
  for (const o of outs) push('OUTSIDE', `<${o.vk}> 出了画布（${o.sides.join('/')}，${o.over}px）`, '往版心里收；整帧铺满只给 vk-img bleed="all"');

  const head = stage.querySelector('[data-vk="head"]');
  const empty = !(head && textOf(head)) && (body ? !textOf(body) && !body.querySelector('img, vk-img') : true);
  if (empty && !page.querySelector('vk-img[bleed="all"]')) push('EMPTY', '这一帧没有内容', '写内容，或删掉这一帧');
  const overlapList = overlaps(body, page);
  for (const o of overlapList) push('OVERLAP', `<${o.a}> 和 <${o.b}> 叠在一起（${o.over}px）`, '调节间距、换 flow 或拆帧；块与块不该重叠');

  /* ---------------------------------------------------------------- 事实 */
  const bodyRect = body ? rectOf(body) : { top: 0, bottom: 0, left: 0, right: 0, height: 0 };
  const headH = head ? Math.round(rectOf(head).height) : 0;
  const bodyH = body ? Math.round(bodyRect.height) : 0;
  const bodyCs = body ? getComputedStyle(body) : null;
  const bodyWidth = body ? Math.round(body.clientWidth - (parseFloat(bodyCs.paddingLeft) || 0) - (parseFloat(bodyCs.paddingRight) || 0)) : 0;

  const direct = body
    ? [...body.children].filter((el) => {
        if (el.matches('vk-callout')) return false;
        if (el.matches("vk-img[bleed='all']")) return false;
        const pos = getComputedStyle(el).position;
        return pos !== 'absolute' && pos !== 'fixed';
      })
    : [];

  /* flow 里再下一层：否则两个块并排时只报一个 flow 的高度。 */
  const blocks = direct.flatMap((el) => (el.getAttribute('data-vk') === 'flow' ? [...el.children] : [el]));
  const rects = blocks.map(rectOf);
  const contentH = rects.length ? Math.round(Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top))) : 0;
  const overflow = Math.max(0, contentH - bodyH);
  const slackTop = rects.length ? Math.round(Math.min(...rects.map((r) => r.top)) - bodyRect.top) : 0;
  const slackBottom = rects.length ? Math.round(bodyRect.bottom - Math.max(...rects.map((r) => r.bottom))) : 0;

  const blockFacts = blocks.map((el, i) => {
    const r = rects[i];
    /* 不能只量固定类名：list/card 的 text 在 li/span 上，宿主自身是 16px。
       量所有真在显示文字的叶子，取最大字号。 */
    const leaves = [el, ...el.querySelectorAll('*')].filter((n) => {
      if (n.closest('.vk-co')) return false;
      const direct = [...(n.childNodes || [])].some((c) => c.nodeType === 3 && String(c.nodeValue || '').trim());
      if (!direct) return false;
      const cs = getComputedStyle(n);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    const sizes = leaves.map((n) => parseFloat(getComputedStyle(n).fontSize) || 0).filter(Boolean);
    const rowSel = el.getAttribute('data-as') === 'bytes' ? '.vk-brow' : el.getAttribute('data-as') === 'bits' ? '.vk-field' : '[data-vk-line], li, tr';
    return {
      vk: el.getAttribute('data-as') || el.getAttribute('data-vk') || el.localName,
      id: el.id || null,
      h: Math.round(r.height),
      top: Math.round(r.top - bodyRect.top),
      rows: el.querySelectorAll(rowSel).length,
      font: Math.round(Math.max(...sizes, 0)),
      overflow: Math.max(0, Math.round(r.bottom - bodyRect.bottom)),
    };
  });

  const f = focus(page);
  const st = smallText(page);
  const imgs = images(page);
  const anchors = [...page.querySelectorAll('vk-callout[data-vk-anchor-missing]')].length;
  const callouts = [...page.querySelectorAll('vk-callout')].map((el) => {
    const note = el.querySelector('.vk-co-note');
    const nr = note && !note.hidden ? rectOf(note) : null;
    return {
      mode: el.getAttribute('mode') || 'note',
      side: el.getAttribute('data-vk-side') || null,
      tight: el.hasAttribute('data-vk-tight'),
      note: nr ? { left: Math.round(nr.left - pr.left), top: Math.round(nr.top - pr.top), w: Math.round(nr.width), h: Math.round(nr.height) } : null,
    };
  });

  return {
    ok: issues.length === 0,
    fits: overflow === 0,
    issues,
    health: {
      head: headH,
      band: bodyH,
      bodyWidth,
      content: contentH,
      overflow,
      slackTop,
      slackBottom,
      focus: f.current,
      callout: f.callout,
      callouts,
      anchors,
      empty: !!empty,
      minFont: st.min,
      under56: st.under56,
      blocks: blockFacts,
      clipped: clips,
      outside: outs,
      overlaps: overlapList,
      images: imgs,
    },
  };
}

export function auditDocument() {
  return [...document.querySelectorAll('.vk-stage')].map((stage) => auditPage(stage));
}

if (typeof window !== 'undefined') {
  window.vkAudit = { page: auditPage, document: auditDocument };
}
