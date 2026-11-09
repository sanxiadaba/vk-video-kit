import {
  inkRect,
  VkElement,
  define,
  attrEnum,
  attrText,
  attrSpace,
  resolveAnchor,
  stageOf,
  stageScale,
  esc,
  warn,
} from './base.mjs';

const NS = 'http://www.w3.org/2000/svg';

/** 件的"看得见的那一块"：窗口类画在 .vk-win 里，宿主本身是 1680 宽的透明块。 */
const visibleBox = (el) => el?.querySelector?.(':scope > .vk-win') || el;

/**
 * 连接件的尺子 —— 四种角色，靠「形状 + 端点」分开，不靠堆颜色。
 *
 *   bar（当前行条，在 components.css）  状态：焦点蓝 · 平头 · 贴行内缘 · 无圆角
 *   arrow  有方向  粗线 + 实心三角头，箭尖离目标 10px
 *   ring   闭合    行级是胶囊、块级是圆角框：贴着字、离开行
 *   leader 开放    细一档 + 端点圆点，点与目标边框相切
 *
 * 颜色只有一个分工：蓝 = 状态，墨 = 关系。语义色（ok/warn/err）不画在线上 ——
 * 一根 500px 长的红线会被读成「出事了」，而它只是「这里有关系」。
 *
 * 手机是 0.406×：12px→4.9px，10px→4.1px，68px 的头→28px。都明显粗于代码字干。
 */
const LINK = {
  arrow: {
    w: 12,
    head: 68, // 头长；半张角 0.40rad ⇒ 头宽 53，稳而不尖
    spread: 0.4,
    start: 14, // 起点离源件边框
    end: 10, // 箭尖离目标边框：指到跟前，不是停在一米外
    bow: 0.3, // 曲线控制点 = 弦长 × 0.3
    bowMin: 56,
    bowMax: 200,
    shaft: 0.62, // 线只画到头长 62% 处，圆头才不会从尖端冒出来
  },
  ring: { w: 5, padX: 8, padY: 2, padXBlock: 24, padYBlock: 16, radius: 8 },
  leader: { w: 10, dot: 12, min: 64 },
};

/**
 * 目标落在一块什么底上？圈画在件上（深色页里的代码窗仍是浅底），
 * 所以圈的墨色跟着**件**走；箭头与引线画在页面上，跟着页面走。
 * 判法：从目标往上找第一块不透明的底色，看它的亮度。
 * 不用 elementFromPoint：帧在页面里是竖排的，取点会落在视口外。
 */
function onDark(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const nums = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
    if (!nums) continue;
    const [r, g, b, a = 1] = nums.map(Number);
    if (a < 0.5) continue;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }
  return false;
}

/** 沿折线从尾巴收掉 dist；最后一段不够就吃掉上一段。箭头要收进头里。 */
function trimTail(pts, dist) {
  const out = pts.map((p) => ({ ...p }));
  let left = dist;
  while (out.length > 2 && left > 0) {
    const b = out[out.length - 1];
    const a = out[out.length - 2];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg > left) {
      const k = (seg - left) / seg;
      out[out.length - 1] = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      left = 0;
    } else {
      out.pop();
      left -= seg;
    }
  }
  return out;
}

const at = (p) => `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;

/**
 * vk-callout —— 画在别人身上的一层。
 *
 *   arrow  从一个锚点连到另一个锚点（直线 / 折线 / 曲线）
 *   ring   圈住目标：按**字的墨迹**取框，不按整行盒子
 *   note   带引线的注释气泡：自动选边、自动避让、保底宽度
 *   badge  目标角上的一枚编号点
 *
 * 它不改布局、不搬节点、不占焦点名额。
 */
export class VkCallout extends VkElement {
  render() {
    const raw = (attrText(this, 'label') || this.textContent || '').trim();
    if (raw) this._text = raw;
    if (!this._root) {
      const root = document.createElement('div');
      root.className = 'vk-callout';
      root.setAttribute('aria-hidden', 'true');
      this.replaceChildren(root);
      this._root = root;
    }
    const mode = attrEnum(this, 'mode', 'arrow');
    this.dataset.mode = mode;
    this._root.dataset.mode = mode;
    this._label = null;
    this._svg = this._root.querySelector('.vk-callout-svg');
    this.registerEdge();
    this.style.display = 'contents';
  }

  draw() {
    const stage = stageOf(this);
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const scale = stageScale(stage);
    const W = stage.offsetWidth;
    const H = stage.offsetHeight;
    const local = (r) => ({
      x: (r.left - sr.left) / scale,
      y: (r.top - sr.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    });

    if (!this._svg) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'vk-callout-svg');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this._root.prepend(svg);
      this._svg = svg;
    }
    const svg = this._svg;
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    this._root.querySelectorAll('.vk-callout-bd').forEach((n) => n.remove());

    const mode = this.dataset.mode;
    const tone = attrEnum(this, 'tone', 'info');

    // 颜色在 callout.css（.vk-arrow / .vk-ring / .vk-note-leader），不在这里写死：
    // 墨色要跟着 color-scheme 走，深色页才换得动。
    if (mode === 'arrow') this._arrow(svg, local);
    else if (mode === 'ring') this._ring(svg, local);
    else if (mode === 'note') this._note(local, W, H, tone);
    else if (mode === 'badge') this._badge(local);
  }

  _target() {
    const expr = attrText(this, 'for') || attrText(this, 'to');
    const stage = stageOf(this);
    if (!expr) {
      warn(this, '缺 for（要指向哪里）');
      return null;
    }
    const a = resolveAnchor(stage, expr, this);
    if (!a) warn(this, `找不到目标 ${expr}`);
    return a;
  }

  _arrow(svg, local) {
    const stage = stageOf(this);
    const fromExpr = attrText(this, 'from');
    const toExpr = attrText(this, 'to');
    if (!fromExpr || !toExpr) {
      warn(this, 'arrow 需要 from 和 to 两个锚点');
      return;
    }
    const a = resolveAnchor(stage, fromExpr, this);
    const b = resolveAnchor(stage, toExpr, this);
    if (!a || !b) return;
    // @side 锚点是零尺寸点；法线要用「盒子」算，不能拿点算。
    const boxOf = (anchor) => {
      const r = anchor.rect;
      if (r.width >= 4 && r.height >= 4) return local(r);
      const el = anchor.el;
      if (el) return local(visibleBox(el).getBoundingClientRect());
      return local(r);
    };
    const A = boxOf(a);
    const B = boxOf(b);
    const p1 = this._borderPoint(A, B);
    const p2 = this._borderPoint(B, A);
    const shape = attrEnum(this, 'shape', 'curve');
    const L = LINK.arrow;
    const trim = L.head * L.shaft;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    let d = '';
    let tip = { x: p2.x - ux * L.end, y: p2.y - uy * L.end };
    let dir = { x: ux, y: uy };
    let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let tangent = { x: ux, y: uy };

    if (shape === 'straight') {
      const s = { x: p1.x + ux * L.start, y: p1.y + uy * L.start };
      const end = { x: tip.x - ux * trim, y: tip.y - uy * trim };
      d = `M${at(s)} L${at(end)}`;
      mid = { x: (s.x + tip.x) / 2, y: (s.y + tip.y) / 2 };
      tangent = { x: tip.x - s.x, y: tip.y - s.y };
    } else if (shape === 'ortho') {
      // 折线：从源件法线方向出去，横竖各走一半，再贴着目标法线方向进。
      const s = { x: p1.x + ux * L.start, y: p1.y + uy * L.start };
      tip = { x: p2.x - ux * L.end, y: p2.y - uy * L.end };
      const horizontal = Math.abs(ux) >= Math.abs(uy);
      const knee = horizontal ? (s.x + tip.x) / 2 : (s.y + tip.y) / 2;
      const pts = horizontal
        ? [s, { x: knee, y: s.y }, { x: knee, y: tip.y }, tip]
        : [s, { x: s.x, y: knee }, { x: tip.x, y: knee }, tip];
      const trimmed = trimTail(pts, trim);
      d = trimmed.map((p, i) => `${i ? 'L' : 'M'}${at(p)}`).join(' ');
      dir = { x: tip.x - pts[2].x, y: tip.y - pts[2].y };
      const dl = Math.hypot(dir.x, dir.y) || 1;
      dir = { x: dir.x / dl, y: dir.y / dl };
      mid = { x: (s.x + tip.x) / 2, y: (s.y + tip.y) / 2 };
      tangent = { x: tip.x - s.x, y: tip.y - s.y };
    } else {
      // 曲线要「贴着边出、贴着边进」：控制点沿边的法线走，而不是沿弦垂直偏移。
      const normal = (rect, p) => {
        const dx = p.x - (rect.x + rect.w / 2);
        const dy = p.y - (rect.y + rect.h / 2);
        return Math.abs(dx) / Math.max(rect.w / 2, 1) >= Math.abs(dy) / Math.max(rect.h / 2, 1)
          ? { x: Math.sign(dx) || 1, y: 0 }
          : { x: 0, y: Math.sign(dy) || 1 };
      };
      const n1 = normal(A, p1);
      const n2 = normal(B, p2);
      const s = { x: p1.x + n1.x * L.start, y: p1.y + n1.y * L.start };
      tip = { x: p2.x + n2.x * L.end, y: p2.y + n2.y * L.end };
      const room = Math.abs(n1.x) ? Math.abs(tip.x - s.x) : Math.abs(tip.y - s.y);
      const bow = Math.max(L.bowMin, Math.min(L.bowMax, len * L.bow, room * 0.45));
      const c1 = { x: s.x + n1.x * bow, y: s.y + n1.y * bow };
      // 终点控制点在目标外侧：线段从那一侧「顶」进边框，箭尖才正对目标。
      const c2 = { x: tip.x + n2.x * bow, y: tip.y + n2.y * bow };
      dir = { x: tip.x - c2.x, y: tip.y - c2.y };
      const dl = Math.hypot(dir.x, dir.y) || 1;
      dir = { x: dir.x / dl, y: dir.y / dl };
      // 终点连同控制点一起往回收 trim：切线方向不变，但线端藏进头里。
      const c2t = { x: c2.x - dir.x * trim, y: c2.y - dir.y * trim };
      const et = { x: tip.x - dir.x * trim, y: tip.y - dir.y * trim };
      d = `M${at(s)} C${at(c1)} ${at(c2t)} ${at(et)}`;
      mid = {
        x: (s.x + 3 * c1.x + 3 * c2.x + tip.x) / 8,
        y: (s.y + 3 * c1.y + 3 * c2.y + tip.y) / 8,
      };
      // t=0.5 的切线：3/4 · (tip + c2 − c1 − s)
      tangent = { x: tip.x + c2.x - c1.x - s.x, y: tip.y + c2.y - c1.y - s.y };
    }

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'vk-arrow');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', String(L.w));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    // 实心三角头：底边平、半张角 0.40rad。线已经收进头里，尖端是尖的。
    const ang = Math.atan2(dir.y, dir.x);
    const hw = L.head * Math.sin(L.spread);
    const bx = tip.x - Math.cos(ang) * L.head;
    const by = tip.y - Math.sin(ang) * L.head;
    const px = Math.cos(ang + Math.PI / 2) * hw;
    const py = Math.sin(ang + Math.PI / 2) * hw;
    const head = document.createElementNS(NS, 'path');
    head.setAttribute('d', `M${at(tip)} L${at({ x: bx + px, y: by + py })} L${at({ x: bx - px, y: by - py })} Z`);
    head.setAttribute('class', 'vk-arrow-head');
    svg.appendChild(head);

    if (this._text) {
      const box = document.createElement('div');
      box.className = 'vk-callout-bd vk-callout-label';
      box.textContent = this._text;
      this._root.appendChild(box);
      // 标签整块退到线的一侧：按文字的实际宽高 + 切线法线算距离，
      // 而不是「垂直上移一个常数」——斜线/曲线上那个常数会被吃掉。
      const bw = box.offsetWidth || 0;
      const bh = box.offsetHeight || 0;
      const tl = Math.hypot(tangent.x, tangent.y) || 1;
      let nx = -tangent.y / tl;
      let ny = tangent.x / tl;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const support = (Math.abs(nx) * bw + Math.abs(ny) * bh) / 2;
      const gap = LINK.arrow.labelGap ?? 16;
      box.style.left = `${mid.x + nx * (support + gap)}px`;
      box.style.top = `${mid.y + ny * (support + gap)}px`;
    }
  }

  /** 从盒子中心向外，取边框上的交点。 */
  _borderPoint(box, toward) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = toward.x + toward.w / 2 - cx;
    const dy = toward.y + toward.h / 2 - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const sx = dx ? (box.w / 2) / Math.abs(dx) : Infinity;
    const sy = dy ? (box.h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  _ring(svg, local) {
    const a = this._target();
    if (!a) return;
    const r = local(a.rect);
    const R = LINK.ring;
    // 行级的圈：淡底 + 细蓝框，读作「划重点」；块级只描边，不盖住内容。
    const isLine = !!a.el?.closest?.('.vk-line, .vk-diff-row, .vk-arow');
    if (this._ringLine) {
      this._ringLine.classList.remove('vk-ring-line');
      this._ringLine = null;
    }
    if (isLine) {
      const row = a.el.closest('.vk-line, .vk-diff-row, .vk-arow');
      row.classList.add('vk-ring-line');
      this._ringLine = row;
      return;
    }
    const padX = isLine ? R.padX : R.padXBlock;
    const padY = isLine ? R.padY : R.padYBlock;
    const w = r.w + padX * 2;
    const h = r.h + padY * 2;
    const el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', String(r.x - padX));
    el.setAttribute('y', String(r.y - padY));
    el.setAttribute('width', String(w));
    el.setAttribute('height', String(h));
    el.setAttribute('rx', String(Math.min(isLine ? R.radius : 24, Math.min(w, h) / 2)));
    el.setAttribute('class', isLine ? 'vk-ring is-line' : 'vk-ring is-block');
    el.setAttribute('stroke-width', String(R.w));
    // 圈压在件上：墨色跟着件走。深色页里的代码窗仍是浅底，圈必须是深墨。
    el.style.colorScheme = onDark(a.el) ? 'dark' : 'light';
    svg.appendChild(el);
  }

  _note(local, W, H, tone) {
    const a = this._target();
    if (!a) return;
    const stage = stageOf(this);
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const scale = stageScale(stage);
    const r = local(a.rect);
    const text = this._text;
    if (!text) {
      warn(this, 'note 没有文字');
      return;
    }

    const box = document.createElement('div');
    box.className = 'vk-callout-bd vk-callout-note';
    box.dataset.tone = tone;
    box.textContent = text;
    this._root.appendChild(box);

    // 保底宽度：一行至少 5 个汉字。8 个太宽——短注解会撑成一大块，
    // 挤压它自己的落位空间（右侧、左侧就放不下了）。
    const minW = 5 * 48;
    const maxW = Math.min(720, W - 48);
    box.style.maxWidth = `${maxW}px`;
    box.style.minWidth = `${Math.min(minW, maxW)}px`;
    const bw = Math.min(maxW, Math.max(minW, box.offsetWidth));
    const bh = box.offsetHeight;

    // 引线要有「一段」的长度：气泡离目标 112，点再吃掉 12，剩下的才是看得见的那根线。
    const gap = this.hasAttribute('gap') ? Number.parseFloat(attrSpace(this, 'gap', 'normal')) || 112 : 112;
    const sideAttr = attrEnum(this, 'side', 'auto');
    // 版心（画布减去外边距）：气泡要落在版心里，跟内容一个边界。
    const scs = getComputedStyle(stage);
    const safe = {
      x: Number.parseFloat(scs.paddingLeft) || 0,
      y: Number.parseFloat(scs.paddingTop) || 0,
      r: stage.offsetWidth - (Number.parseFloat(scs.paddingRight) || 0),
      b: stage.offsetHeight - (Number.parseFloat(scs.paddingBottom) || 0),
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    /**
     * 气泡贴着**目标所属的那一块**放，引线指向具体的那一行。
     * 否则目标是一行代码时，四个候选位置全在代码窗里面。
     */
    const owner = a.el.closest('vk-code, vk-box, vk-cells, vk-table, vk-tree, vk-term, vk-diff, vk-img, vk-list, vk-steps') || a.el;
    const ob = local(visibleBox(owner).getBoundingClientRect());

    // 障碍物只算"看得见"的件：stack / grid / canvas 是透明容器，把它们算进去会把整帧封死。
    const obstacles = [...stage.querySelectorAll(
      'vk-code, vk-box, vk-cells, vk-text, vk-label, vk-table, vk-list, vk-term, vk-diff, vk-tree, vk-steps, vk-bars, vk-timeline, vk-img, vk-math, vk-asm, vk-compare'
    )]
      .filter((el) => !el.contains(this) && !this.contains(el) && !owner.contains(el) && el !== owner)
      .map((el) => {
        // 文字是满宽块但墨迹只占左边一小段：障碍物按墨迹算。
        const q = /^vk-(text|label)$/.test(el.tagName.toLowerCase()) ? inkRect(el) || el.getBoundingClientRect() : el.getBoundingClientRect();
        return { x: (q.left - sr.left) / scale, y: (q.top - sr.top) / scale, w: q.width / scale, h: q.height / scale };
      });

    const overlap = (a) =>
      obstacles.reduce((sum, b) => {
        const w = Math.min(a.left + a.bw, b.x + b.w) - Math.max(a.left, b.x);
        const h = Math.min(a.top + a.bh, b.y + b.h) - Math.max(a.top, b.y);
        return sum + (w > 0 && h > 0 ? w * h : 0);
      }, 0);

    /**
     * 固定顺序 + 硬约束：先放目标下方，其次右侧、左侧、上方；
     * 第一个"既不压内容也不出界"的位置就赢。全都不满足时取压得最少的。
     * 不打分：打分会在极端情况下把气泡塞回目标身上。
     */
    const space = {
      bottom: { left: ob.x + ob.w / 2 - bw / 2, top: ob.y + ob.h + gap },
      right: { left: ob.x + ob.w + gap, top: ob.y + ob.h / 2 - bh / 2 },
      left: { left: ob.x - gap - bw, top: ob.y + ob.h / 2 - bh / 2 },
      top: { left: ob.x + ob.w / 2 - bw / 2, top: ob.y - gap - bh },
    };
    const order = sideAttr === 'auto' ? ['bottom', 'right', 'left', 'top'] : [sideAttr, ...['bottom', 'right', 'left', 'top'].filter((s) => s !== sideAttr)];

    let spot = null;
    let fallback = null;
    for (const side of order) {
      const c0 = space[side];
      const fit = {
        left: clamp(c0.left, safe.x + 4, Math.max(safe.x + 4, safe.r - bw - 4)),
        top: clamp(c0.top, safe.y + 8, Math.max(safe.y + 8, safe.b - bh - 8)),
        side,
        bw,
        bh,
      };
      const clean = Math.abs(fit.left - c0.left) < 2 && Math.abs(fit.top - c0.top) < 2;
      const cost = overlap(fit);
      if (!fallback || cost < fallback.cost) fallback = { ...fit, cost };
      if (clean && cost === 0) {
        spot = fit;
        break;
      }
    }
    if (!spot) spot = fallback;

    box.style.left = `${spot.left}px`;
    box.style.top = `${spot.top}px`;

    // 引线：从气泡边缘连到目标的**容器**边缘（不是字的中间），
    // 否则线会横穿正在讲的那行代码。
    // 端点外推到「刚好相切」：圆心离边框一个半径，圆和边框相切、谁也不压谁。
    // 这样引线整根都活在同一块底上（页面），深色页不会出现半白半黑的点。
    const D = LINK.leader.dot;
    const from = { x: spot.left, y: spot.top, w: bw, h: bh };
    const p1 = this._borderPoint(from, ob);
    let p2;
    if (owner === a.el) {
      const on = this._borderPoint(r, from);
      const vx = on.x - p1.x;
      const vy = on.y - p1.y;
      const vl = Math.hypot(vx, vy) || 1;
      p2 = { x: on.x + (vx / vl) * D, y: on.y + (vy / vl) * D };
    } else {
      // 目标在窗口里：引线落在窗口边缘「对齐那一行」的位置，不穿进正文。
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const below = from.y > ob.y + ob.h / 2;
      const right = from.x > ob.x + ob.w / 2;
      const vertical = Math.abs(from.y + from.h / 2 - (ob.y + ob.h / 2)) > Math.abs(from.x + from.w / 2 - (ob.x + ob.w / 2));
      p2 = vertical
        ? { x: Math.min(Math.max(cx, ob.x + D + 4), ob.x + ob.w - D - 4), y: below ? ob.y + ob.h + D : ob.y - D }
        : { x: right ? ob.x + ob.w + D : ob.x - D, y: Math.min(Math.max(cy, ob.y + D + 4), ob.y + ob.h - D - 4) };
    }
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    // 太短的引线不如不画：一颗孤零零的点会被当成标点符号。
    if (dist >= LINK.leader.min) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(p1.x));
      line.setAttribute('y1', String(p1.y));
      line.setAttribute('x2', String(p2.x));
      line.setAttribute('y2', String(p2.y));
      line.setAttribute('class', 'vk-note-leader');
      line.setAttribute('stroke-width', String(LINK.leader.w));
      line.setAttribute('stroke-linecap', 'round');
      this._svg.appendChild(line);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', String(p2.x));
      dot.setAttribute('cy', String(p2.y));
      dot.setAttribute('r', String(D));
      dot.setAttribute('class', 'vk-note-dot');
      this._svg.appendChild(dot);
    }
  }

  _badge(local) {
    const a = this._target();
    if (!a) return;
    const r = local(a.rect);
    const stage = stageOf(this);
    if (!stage) return;
    const W = stage.clientWidth;
    // 编号点贴着**目标本身**：贴窗口会把"第 2 格"标到整块的边上。
    // 圆点是 44px、以锚点为中心，所以要再让半个点。
    const owner = a.el.closest('vk-code, vk-term, vk-diff, vk-box, vk-cells, vk-tree, vk-asm, vk-bytes') || a.el;
    const ob = r;
    const dot = document.createElement('div');
    dot.className = 'vk-callout-bd vk-callout-badge';
    dot.textContent = this._text || '1';
    // 圆点是 44px 且以锚点为中心：锚点要再往外让半个点，否则会压在字上。
    const half = 22;
    const right = ob.x + ob.w + half + 8;
    const left = ob.x - half - 8;
    const fitRight = right + half <= W - 4;
    dot.style.left = `${fitRight ? right : left}px`;
    dot.style.top = `${r.y + r.h / 2}px`;
    this._root.appendChild(dot);
    void esc;
  }
}

export function defineCallout() {
  define('vk-callout', VkCallout);
}

