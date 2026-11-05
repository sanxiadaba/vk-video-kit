/**
 * vk-note：边注 / 气泡 / 编号图例。只画覆盖层，不改布局、不占焦点。
 *
 *   variant="margin"  一条 1px 细线从目标引出，文字落在栏间空白，首行与目标基线对齐；
 *                     side="left|right|auto" 选边，leader="dot" 在目标端加圆点。
 *   variant="bubble"  复用 vk-annotate 的 note 形态（泡 + 引线 + 自动避让）。
 *   variant="legend"  目标角上一枚编号点，页角一张编号 + 说明的图例表。
 *
 * margin / legend 的引线 1px、没有箭头；箭头只属于 vk-annotate mode="arrow"。
 */
import { VK, EDGES, VkElement, define, numAttr, resolveAnchor } from './base.mjs';
import { visualToLocal } from './geometry.mjs';
import { VkAnnotate } from './annotate.mjs';

const NS = 'http://www.w3.org/2000/svg';
/** 目标与文字之间的净空。 */
const GAP = 24;
/** 边注最窄宽度：再窄就成"一列字"，读不出句子。 */
const MIN_W = 96;
/** 没写 w 时的宽度上限。 */
const DEFAULT_W = 280;
/** 贴到容器边时的最小留白。 */
const PAD = 8;
/** 编号点直径（CSS 里写 48，几何用同一个数）。 */
const DOT = 48;

/* ------------------------------------------------------------------ 坐标系 */

/** 覆盖层只认一个坐标系：最近的定位祖先（没有就退回 body）。 */
function hostOf(el) {
  let host = el.parentElement;
  while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
  if (!host) host = document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  return host;
}

/** 图例落在 120 版心里；画布里退到 24 的内距。 */
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

/** 边注盒子与目标矩形有没有实质重叠（>2px 才算：贴边不算压住）。 */
function boxHitsRect(box, r) {
  const ox = Math.min(box.left + box.w, r.x + r.w) - Math.max(box.left, r.x);
  const oy = Math.min(box.top + box.h, r.y + r.h) - Math.max(box.top, r.y);
  return ox > 2 && oy > 2;
}

/* ------------------------------------------------------------------ 组件 */

export class VkNote extends VkAnnotate {
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
    const v = this.getAttribute('variant');
    return v === 'legend' || v === 'bubble' ? v : 'margin';
  }

  /** 图例落在哪一角：side 的 bottom-right / bottom-left / bottom（旧名 place 的 br / bl / bottom）。 */
  _place() {
    const v = (this.getAttribute('side') || 'bottom-right').trim();
    return v === 'bottom-left' ? 'bl' : v === 'bottom' ? 'bottom' : 'br';
  }

  /** bubble 形态由 vk-annotate 画（同一个 note 模式）；这里只把 kind 折成 mode。 */
  _mode() {
    return 'note';
  }

  /** 气泡宽：w 写 200 或 200px 都行（旧 vk-pin 的写法）；不写按内容自适。 */
  _noteWidth() {
    const raw = String(this.getAttribute('w') ?? '').trim();
    if (!raw) return null;
    const m = raw.match(/^(\d+(?:\.\d+)?)(?:px)?$/);
    if (!m) {
      this._warnOnce('w', `的 w="${raw}" 不是像素宽（写 200 或 200px），按默认宽处理`);
      return 360;
    }
    const n = Number(m[1]);
    const w = Math.min(900, Math.max(160, n));
    if (w !== n) this._warnOnce('w', `的 w="${raw}" 超出 160…900，按 ${w} 处理`);
    return w;
  }

  /** 状态镜像：两种形态共用一套字段。 */
  _mirror(cfg, kind) {
    const d = this.dataset;
    const attr = (name, fallback) => {
      const v = this.getAttribute(name);
      return v == null || v === '' ? fallback : v;
    };
    d.variant = kind;
    d.tone = attr('tone', cfg.tone || 'info');
    d.strength = attr('strength', cfg.strength || 'soft');
    d.size = attr('size', cfg.size || 'body');
    d.n = attr('n', String(cfg.n ?? 0));
    d.side = attr('side', cfg.side || 'auto');
    d.leader = attr('leader', kind === 'bubble' ? 'elbow' : 'line');
    d.place = this._place();
    d.gap = attr('gap', String(cfg.gap ?? 24));
    d.w = attr('w', cfg.width == null ? '' : String(Math.round(cfg.width)));
    d.x = attr('x', Number.isFinite(cfg.x) ? String(cfg.x) : '');
    d.y = attr('y', Number.isFinite(cfg.y) ? String(cfg.y) : '');
  }

  /** 换形态时，边注 / 图例的壳不是作者内容；把文字从壳里捞回来。 */
  _collectSlot() {
    const keep = [];
    for (const n of this._slotNodes || []) {
      if (n.parentNode) n.parentNode.removeChild(n);
      keep.push(n);
    }
    for (const n of [...this.childNodes]) {
      if (n.nodeType === 3) {
        if (n.textContent.trim()) keep.push(n);
        continue;
      }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'SCRIPT') continue;
      if (n.matches?.('.vk-pin-bd, .vk-ov-svg, .vk-edge-svg')) continue;
      if (n.matches?.('.vk-note-svg, .vk-note-m, .vk-note-legend')) {
        for (const t of [...n.querySelectorAll('.vk-note-t')]) {
          if (t.textContent.trim()) keep.push(document.createTextNode(t.textContent));
        }
        continue;
      }
      if (n.matches?.('.vk-note-dot')) continue;
      keep.push(n);
    }
    for (const n of keep) n.parentNode?.removeChild(n);
    this._slotNodes = keep;
    return keep;
  }

  render() {
    const kind = this._kind();
    if (kind === 'bubble') {
      if (this._kindNow !== 'bubble') this._resetShell();
      this._kindNow = 'bubble';
      // 从边注切过来时，文字还在 _text 里；气泡只有一个槽，把它交回去。
      if (!this._slotNodes?.length && this._text) this._slotNodes = [document.createTextNode(this._text)];
      super.render();
      const cfg = this._noteConfig('note');
      this._mirror(cfg, kind);
      return;
    }
    if (this._kindNow === 'bubble') this._resetShell();
    this._kindNow = kind;

    const leader = this.getAttribute('leader') === 'dot' ? 'dot' : 'line';
    const side = this.getAttribute('side') || 'auto';
    this.dataset.variant = kind;
    // 宿主上的 data-side / data-leader / data-place 是"作者写法的镜像"：
    this.dataset.side = side;
    this.dataset.leader = leader;
    this.dataset.place = this._place();
    this.style.zIndex = String(numAttr(this, 'z', { min: 0, max: 99, fallback: 50 }));
    this._mirror(
      {
        tone: this.getAttribute('tone') || 'info',
        strength: this.getAttribute('strength') || 'soft',
        size: this.getAttribute('size') || 'body',
        n: parseInt(this.getAttribute('n') || '0', 10) || 0,
        side,
        leader,
        gap: numAttr(this, 'gap', { min: 0, max: 240, fallback: 24 }),
        width: null,
        x: NaN,
        y: NaN,
      },
      kind
    );
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
    if (this._kind() === 'bubble') {
      // 气泡的落点 / 避让 / 引线全在 vk-annotate 的 note 形态里。
      super.draw();
      return;
    }
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
    b.cx = b.x + b.w / 2;
    b.cy = b.y + b.h / 2;

    // 纵向 clamp 按错的高度算，多行边注就会被放到画布外面去。
    const want = numAttr(this, 'w', { min: MIN_W, max: 600, fallback: DEFAULT_W });
    const gap = numAttr(this, 'gap', { min: 0, max: 240, fallback: GAP });
    const space = {
      right: W - (b.x + b.w) - gap - PAD,
      left: b.x - gap - PAD,
    };
    const fit = (s) => Math.round(Math.max(MIN_W, Math.min(want, Math.max(MIN_W, space[s]))));
    const measure = (w) => {
      box.style.width = w + 'px';
      return box.offsetHeight || 0;
    };

    // 选边：作者写的一侧优先；那一侧连 MIN_W 都放不下时翻到另一侧
    // （"文字只放在有空间的一侧"——目标贴边时不许把边注挤到画布外）。
    const sideAttr = (this.getAttribute('side') || 'auto').trim();
    const other = (s) => (s === 'right' ? 'left' : 'right');
    const prefer = sideAttr === 'left' || sideAttr === 'right' ? sideAttr : space.right >= space.left ? 'right' : 'left';
    const side =
      space[prefer] >= MIN_W
        ? prefer
        : space[other(prefer)] >= MIN_W
          ? other(prefer)
          : space[other(prefer)] > space[prefer]
            ? other(prefer)
            : prefer;

    // 与目标正文同一个基线：先量目标的基线，再把边注首行的基线对上去。
    const targetBaseline = (baselineOf(t.el) - hr.top) / scale;
    const offset = baselineOffset(box);
    const baselineTop = (h) => clamp(Math.round(targetBaseline - offset), PAD, Math.max(PAD, H - h - PAD));

    // 左右各试一次；两边都会压住目标时退到上方 / 下方（横着没地方就竖着放）。
    const spots = [];
    for (const s of [side, other(side)]) {
      const w = fit(s);
      const h = measure(w);
      const left = clamp(
        Math.round(s === 'right' ? b.x + b.w + gap : b.x - gap - w),
        PAD,
        Math.max(PAD, W - w - PAD)
      );
      spots.push({ side: s, w, h, left, top: baselineTop(h) });
    }
    let spot = spots.find((c) => !boxHitsRect(c, b));
    if (!spot) {
      const w = Math.round(Math.max(MIN_W, Math.min(want, W - PAD * 2)));
      const h = measure(w);
      const above = b.y - gap - h >= PAD || b.y + b.h + gap + h > H - PAD;
      spot = {
        side: above ? 'top' : 'bottom',
        w,
        h,
        left: clamp(Math.round(b.cx - w / 2), PAD, Math.max(PAD, W - w - PAD)),
        top: clamp(
          Math.round(above ? b.y - gap - h : b.y + b.h + gap),
          PAD,
          Math.max(PAD, H - h - PAD)
        ),
      };
    }

    box.style.left = spot.left + 'px';
    box.style.top = spot.top + 'px';
    box.style.width = spot.w + 'px';

    // 引线：两端都落在真实边上。目标端不是"和目标同 x 的空白"，
    // 而是目标边线上的一点（边注被纵向挤开时，靠一段贴边的竖线接回来）。
    const line = firstLine(this._t);
    const mid = line ? (line.rect.top + line.rect.height / 2 - hr.top) / scale : spot.top + offset;
    let pts;
    if (spot.side === 'top' || spot.side === 'bottom') {
      const x = clamp(Math.round(b.cx), Math.round(b.x) + 1, Math.round(b.x + b.w) - 1);
      const edge = spot.side === 'top' ? Math.round(b.y) : Math.round(b.y + b.h);
      const from = spot.side === 'top' ? spot.top + spot.h : spot.top;
      pts = [
        [x, edge],
        [x, from],
      ];
    } else {
      const x1 = Math.round(spot.side === 'right' ? b.x + b.w : b.x);
      const x2 = spot.side === 'right' ? spot.left : spot.left + spot.w;
      const ey = clamp(mid, b.y + 1, b.y + b.h - 1);
      // 终点在边注的纵向范围内 → 一条水平线就够；否则先水平到目标边、再沿边竖一小段。
      pts =
        ey >= spot.top && ey <= spot.top + spot.h
          ? [
              [x1, ey],
              [x2, ey],
            ]
          : [
              [x1, Math.round(ey)],
              [x1, Math.round(mid)],
              [x2, Math.round(mid)],
            ];
    }
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${Math.round(x)} ${Math.round(y)}`).join(' ');
    this._line?.setAttribute('d', d);
    this._line?.setAttribute('data-side', spot.side);
    if (this._mark) {
      const isDot = this.getAttribute('leader') === 'dot';
      this._mark.style.display = isDot ? '' : 'none';
      if (isDot) {
        // 圆点永远落在目标端（pts[0]），不落在文字那一端。
        this._mark.setAttribute('cx', Math.round(pts[0][0]));
        this._mark.setAttribute('cy', Math.round(pts[0][1]));
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
