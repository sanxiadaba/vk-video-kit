/**
 * L4 注解原语 —— vk-note：边注 / 编号图例。
 *
 * 高级感的注解不是气泡。气泡是"画在内容上的一张纸"，边注是"排进版面的一句话"：
 *
 *   kind="margin"  一条 1px 细线从目标引出，文字落在栏间空白里，
 *                  第一行与目标正文的基线对齐（不是"放在旁边差不多高"）；
 *                  side 自动选有空间的一侧，leader="dot" 在目标端加一枚小圆点。
 *   kind="legend"  目标角上一枚编号点（1 / 2 / 3），页角一张编号 + 说明的图例表。
 *
 * 三条硬规则写在 CSS 与几何里，作者改不了：
 *   · 引线 1px、没有箭头（箭头只属于 vk-annotate mode="arrow" 的"指向关系"）；
 *   · 文字 caption（28）、墨阶 secondary、没有底、没有圆角、没有泡泡；
 *   · 它只画覆盖层：不改布局、不占焦点名额（和 vk-label 一样是辅助信息）。
 *
 * 隐藏的镜头 / 模板没有盒子时直接不画；目标找不到时运行期只警告一次，
 * 真正的拦截在构建期（src/highlight.mjs）。
 */
import { VK, EDGES, VkElement, define, numAttr, resolveAnchor } from './base.mjs';
import { visualToLocal } from './geometry.mjs';

const NS = 'http://www.w3.org/2000/svg';
/** 目标与文字之间的净空。 */
const GAP = 24;
/** 边注最窄宽度：再窄就成"一列字"，读不出句子。 */
const MIN_W = 96;
/** 没写 w 时的宽度上限。 */
const DEFAULT_W = 280;
/** 贴到容器边时的最小留白。 */
const PAD = 8;
/** 编号点直径（CSS 里写 40，几何用同一个数）。 */
const DOT = 40;

/* ------------------------------------------------------------------ 坐标系 */

/** 覆盖层只认一个坐标系：最近的定位祖先（没有就退回 body）。 */
function hostOf(el) {
  let host = el.parentElement;
  while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
  if (!host) host = document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  return host;
}

/** 图例落在页面 120 版心里；画布/标本台里退到 24 的内距。 */
function marginOf(host) {
  // 只有"纸"本身是 120 版心；画布挂在纸里面，但它的坐标是画布自己的。
  if (!host.matches?.('.vk-page')) return 24;
  const v = parseFloat(getComputedStyle(host).getPropertyValue('--vk-margin'));
  return Number.isFinite(v) && v > 0 ? v : 120;
}

/* --------------------------------------------------------------- 基线测量 */

let measureCtx = null;

/** 字体度量：基线是 line box 顶 + fontBoundingBoxAscent（Chrome 的行盒就是内容区）。 */
function fontMetrics(cs) {
  const fs = parseFloat(cs.fontSize) || 28;
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = measureCtx.measureText('国Hg');
  return {
    asc: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || fs * 0.8,
    desc: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || fs * 0.2,
  };
}

/** 元素里第一条文字行的行盒（viewport 坐标）。 */
function firstLine(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (rects.length) return { rect: rects[0], parent: n.parentElement };
  }
  return null;
}

/** 第一条文字行的基线（viewport 坐标）；没有文字时退到盒子中线。 */
function baselineOf(el) {
  const line = firstLine(el);
  if (!line) {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  }
  return line.rect.top + fontMetrics(getComputedStyle(line.parent)).asc;
}

/** 元素首行基线相对自己盒子顶部的偏移（layout px）。 */
function baselineOffset(el) {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const { asc, desc } = fontMetrics(cs);
  return (lh - (asc + desc)) / 2 + asc;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ 组件 */

export class VkNote extends VkElement {
  static watchSource = false;
  static frame = false;

  connectedCallback() {
    super.connectedCallback?.();
    // 画布与审计都靠这个标记把覆盖层排除在摆位/几何检查之外。
    this.dataset.vkOverlay = '';
    EDGES.add(this);
  }

  /**
   * 作者内容只在第一次渲染时取一次。
   *
   * 边注取纯文本，图例取 <li> 条目；之后换 kind / side 只换壳，
   * 不会把渲染产物当成"作者内容"再读一遍（气泡组件踩过这个坑）。
   */
  capture() {
    if (this._captured) return;
    this._captured = true;
    this._items = [...this.querySelectorAll(':scope > li')]
      .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    this._text = (this.textContent || '').replace(/\s+/g, ' ').trim();
  }

  _kind() {
    return this.getAttribute('kind') === 'legend' ? 'legend' : 'margin';
  }

  _place() {
    const v = this.getAttribute('place') || 'br';
    return v === 'bl' || v === 'bottom' ? v : 'br';
  }

  render() {
    const kind = this._kind();
    const leader = this.getAttribute('leader') === 'dot' ? 'dot' : 'line';
    const side = this.getAttribute('side') || 'auto';
    this.dataset.kind = kind;
    // 宿主上的 data-side / data-leader / data-place 是"作者写法的镜像"：
    // 实际落点由几何算，契约只断言请求值真的被读到。
    this.dataset.side = side;
    this.dataset.leader = leader;
    this.dataset.place = this._place();
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 50 }));
    if (kind === 'legend') this._renderLegend();
    else this._renderMargin(leader);
    this.dataset.vkOverlay = '';
    EDGES.add(this);
    VK._invalidate();
  }

  _renderMargin(leader) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'vk-note-svg');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('class', 'vk-note-line');
    line.setAttribute('fill', 'none');
    const mark = document.createElementNS(NS, 'circle');
    mark.setAttribute('class', 'vk-note-mark');
    mark.setAttribute('r', '4');
    svg.append(line, mark);

    const box = document.createElement('div');
    box.className = 'vk-note-m';
    const text = document.createElement('span');
    text.className = 'vk-note-t';
    text.textContent = this._text || '';
    box.append(text);

    this.replaceChildren(svg, box);
    this._svg = svg;
    this._line = line;
    this._mark = mark;
    this._m = box;
    this._t = text;
    this._legend = null;
    this._dots = [];
  }

  _renderLegend() {
    const wrap = document.createElement('div');
    wrap.className = 'vk-note-legend';
    const list = document.createElement('ul');
    list.className = 'vk-note-list';
    for (const [i, item] of this._items.entries()) {
      const li = document.createElement('li');
      li.className = 'vk-note-item';
      const n = document.createElement('span');
      n.className = 'vk-note-n';
      n.textContent = String(i + 1);
      const t = document.createElement('span');
      t.className = 'vk-note-t';
      t.textContent = item;
      li.append(n, t);
      list.append(li);
    }
    wrap.append(list);

    const dots = this._items.map((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'vk-note-dot';
      dot.dataset.n = String(i + 1);
      dot.textContent = String(i + 1);
      return dot;
    });

    this.replaceChildren(wrap, ...dots);
    this._svg = null;
    this._line = null;
    this._mark = null;
    this._m = null;
    this._t = null;
    this._legend = wrap;
    this._dots = dots;
  }

  /** 一个 for 目标；@side 这类零尺寸锚点退回目标自己的盒子。 */
  _targets(host) {
    return (this.getAttribute('for') || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((expr) => {
        const a = resolveAnchor(host, expr, this);
        if (!a || !a.el) return null;
        const r = a.rect && a.rect.width > 1 && a.rect.height > 1 ? a.rect : a.el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return null;
        return { el: a.el, rect: r };
      })
      .filter(Boolean);
  }

  draw() {
    if (!this.isConnected) return;
    const host = hostOf(this);
    if (!host) return;
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) return;
    const W = host.offsetWidth || Math.round(hr.width);
    const H = host.offsetHeight || Math.round(hr.height);
    const scale = hr.width / (W || hr.width) || 1;
    const local = (r) => visualToLocal(r, hr, W);

    if (this._kind() === 'legend') this._drawLegend(host, hr, W, H, scale, local);
    else this._drawMargin(host, hr, W, H, scale, local);
  }

  _drawMargin(host, hr, W, H, scale, local) {
    const box = this._m;
    if (!box) return;
    const t = this._targets(host)[0];
    if (!t || !this._text) {
      box.style.display = 'none';
      this._svg?.replaceChildren();
      if (!t) this._warnOnce('target', '找不到 for 目标，边注没有画；构建期会先拦一次');
      return;
    }
    box.style.display = '';
    const b = local(t.rect);

    // 边注宽度：不超过那一侧真正空出来的地方；显式 side 无空间时夹回容器内。
    const sideAttr = this.getAttribute('side') || 'auto';
    const spaceRight = W - (b.x + b.w) - GAP - PAD * 2;
    const spaceLeft = b.x - GAP - PAD * 2;
    const side = sideAttr === 'left' || sideAttr === 'right' ? sideAttr : spaceRight >= spaceLeft ? 'right' : 'left';
    const want = numAttr(this, 'w', { min: MIN_W, max: 600, fallback: DEFAULT_W });
    const width = Math.round(Math.max(MIN_W, Math.min(want, Math.max(MIN_W, side === 'right' ? spaceRight : spaceLeft))));

    let left = side === 'right' ? b.x + b.w + GAP : b.x - GAP - width;
    left = clamp(Math.round(left), PAD, Math.max(PAD, W - width - PAD));

    // 与目标正文同一个基线：先量目标的基线，再把边注首行的基线对上去。
    const targetBaseline = (baselineOf(t.el) - hr.top) / scale;
    const offset = baselineOffset(box);
    let top = Math.round(targetBaseline - offset);
    const boxH = box.offsetHeight || 0;
    top = clamp(top, PAD, Math.max(PAD, H - boxH - PAD));

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';

    // 引线画在边注首行的中线：不是基线，也不是盒子中心。
    const line = firstLine(this._t);
    const y = line ? Math.round(((line.rect.top + line.rect.height / 2 - hr.top) / scale) * 10) / 10 : top + Math.round(offset);
    const x1 = side === 'right' ? Math.round(b.x + b.w) : Math.round(b.x);
    const x2 = side === 'right' ? left : left + width;
    this._line?.setAttribute('d', `M ${x1} ${y} L ${x2} ${y}`);
    this._line?.setAttribute('data-side', side);
    if (this._mark) {
      const isDot = this.getAttribute('leader') === 'dot';
      this._mark.style.display = isDot ? '' : 'none';
      if (isDot) {
        // 圆点永远落在目标端（x1），不落在文字那一端。
        this._mark.setAttribute('cx', x1);
        this._mark.setAttribute('cy', y);
      }
    }
  }

  _drawLegend(host, hr, W, H, scale, local) {
    const targets = this._targets(host);
    const dots = this._dots || [];
    for (const [i, dot] of dots.entries()) {
      const t = targets[i];
      if (!t) {
        dot.style.display = 'none';
        continue;
      }
      dot.style.display = '';
      const b = local(t.rect);
      // 编号点钉在目标右上角：一半在外，不压住内容的第一行。
      dot.style.left = Math.round(clamp(b.x + b.w - DOT / 2, 0, Math.max(0, W - DOT))) + 'px';
      dot.style.top = Math.round(clamp(b.y - DOT / 2, 0, Math.max(0, H - DOT))) + 'px';
    }

    const legend = this._legend;
    if (!legend) return;
    if (!dots.length) {
      legend.style.display = 'none';
      return;
    }
    legend.style.display = '';
    legend.style.left = '0px';
    legend.style.top = '0px';
    const lw = legend.offsetWidth || 0;
    const lh = legend.offsetHeight || 0;
    const margin = marginOf(host);
    const place = this._place();
    const left = clamp(
      Math.round(place === 'bl' ? margin : place === 'bottom' ? (W - lw) / 2 : W - margin - lw),
      PAD,
      Math.max(PAD, W - lw - PAD)
    );
    const top = clamp(Math.round(H - margin - lh), PAD, Math.max(PAD, H - lh - PAD));
    legend.style.left = left + 'px';
    legend.style.top = top + 'px';
  }
}

export function defineNote() {
  define('vk-note', VkNote);
}
