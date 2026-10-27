/**
 * 几何 —— 连线与画布共用的唯一一份实现。
 * （2.1 里 vk-arrow 和 vk-edge 各写了一套，这里是唯一那份。）
 */

/** 视觉 rect → 布局坐标。父级 transform:scale 时，rect 是缩放后的。 */
export function visualToLocal(r, hr, layoutWidth = hr.width) {
  const s = (hr.width / (layoutWidth || hr.width)) || 1;
  return {
    x: (r.left - hr.left) / s,
    y: (r.top - hr.top) / s,
    w: r.width / s,
    h: r.height / s,
  };
}

/** 包含块：最近的定位祖先，连同它的缩放比 */
/** 盒子上某个边的锚点 */
export function pointOn(b, side, off = 0) {
  switch (side) {
    case 'left': return { x: b.x, y: b.cy + off, side };
    case 'right': return { x: b.x + b.w, y: b.cy + off, side };
    case 'top': return { x: b.cx + off, y: b.y, side };
    case 'bottom': return { x: b.cx + off, y: b.y + b.h, side };
    default: return { x: b.cx, y: b.cy, side: 'center' };
  }
}

/**
 * 自动选边：两端在某一轴上重叠就上下连，否则左右连。
 * 2.1 的缺陷是「选中点离视觉路径很远」——这里用重叠量判定，不用中心距。
 */
export function autoSide(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  // 水平方向重叠得比竖直方向多 → 上下叠放，该上下连
  const vertical = ox > oy;
  if (b.cy > a.cy && vertical) return ['bottom', 'top'];
  if (b.cy <= a.cy && vertical) return ['top', 'bottom'];
  if (b.cx > a.cx) return ['right', 'left'];
  return ['left', 'right'];
}

const horiz = (s) => s === 'left' || s === 'right';
const PAD = 28; // 锚点离盒子圆角的最小距离

/**
 * 锚点偏移：竖向连线要对齐到同一个 x，横向连线对齐到同一个 y。
 * 之前两端都用「自己的中心」，导致 b 的下锚点落在 obj-1 的中心顶（差 300px）。
 */
function anchorOffsets(a, b, s1, s2) {
  const clampOff = (v, half) => Math.max(-half + PAD, Math.min(half - PAD, v));
  if (!horiz(s1) && !horiz(s2)) {
    const x = Math.max(b.x + PAD, Math.min(b.x + b.w - PAD, a.cx));
    return [clampOff(x - a.cx, a.w / 2), clampOff(x - b.cx, b.w / 2)];
  }
  if (horiz(s1) && horiz(s2)) {
    const y = Math.max(b.y + PAD, Math.min(b.y + b.h - PAD, a.cy));
    return [clampOff(y - a.cy, a.h / 2), clampOff(y - b.cy, b.h / 2)];
  }
  // 一横一竖：横着出，落在对方的投影上
  const o1 = horiz(s1) ? clampOff(b.cy - a.cy, a.h / 2) : clampOff(b.cx - a.cx, a.w / 2);
  const o2 = horiz(s2) ? clampOff(a.cy - b.cy, b.h / 2) : clampOff(a.cx - b.cx, b.w / 2);
  return [o1, o2];
}

/** 正交折线 + 圆角 */
export function orthoPoints(p1, p2, s1, s2, gap = 16, bend = 0) {
  const pts = [];
  const [off1, off2] = anchorOffsets(p1, p2, s1, s2);
  const a = pointOn(p1, s1, off1);
  const b = pointOn(p2, s2, off2);
  const horiz1 = s1 === 'left' || s1 === 'right';
  const horiz2 = s2 === 'left' || s2 === 'right';

  const da = { left: -1, right: 1, top: 0, bottom: 0 }[s1] || 0;
  const db = { left: -1, right: 1, top: 0, bottom: 0 }[s2] || 0;

  // 起点贴节点边框（线本来就从这里长出来）；终点也直接落在边框上，
  // 箭头尖端贴住目标，不再在边缘前留 32px 的空隙。
  pts.push(a);
  const s1out = { x: a.x + da * gap, y: a.y + (s1 === 'top' ? -gap : s1 === 'bottom' ? gap : 0) };
  pts.push(s1out);

  const s2in = b;

  // 两端方向相同 → 中间加一条横/竖的连接段，接缝放在中点
  if (horiz1 && horiz2) {
    const mid = s1out.x + (s2in.x - s1out.x) * 0.5 + bend;
    pts.push({ x: mid, y: s1out.y });
    pts.push({ x: mid, y: s2in.y });
  } else if (!horiz1 && !horiz2) {
    const mid = s1out.y + (s2in.y - s1out.y) * 0.5 + bend;
    pts.push({ x: s1out.x, y: mid });
    pts.push({ x: s2in.x, y: mid });
  }
  // 一横一竖 → 必须插一个直角拐点，否则会画出一条斜线
  if (horiz1 && !horiz2) {
    pts.push({ x: s2in.x, y: s1out.y });
  } else if (!horiz1 && horiz2) {
    pts.push({ x: s1out.x, y: s2in.y });
  }
  pts.push(s2in);
  return dedupe(pts);
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    // 2px 以内的折点并掉：节点中心差 1px 会生成一个假的 1px 拐角
    if (last && Math.abs(last.x - p.x) < 2 && Math.abs(last.y - p.y) < 2) continue;
    out.push(p);
  }
  // 去掉直线上的中间点：三点共线时，中间那个只会多画一个假的圆角
  if (out.length < 3) return out;
  const res = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < 4) continue;
    res.push(b);
  }
  res.push(out[out.length - 1]);
  return res;
}

/** 折线转圆角路径 */
export function roundedPath(pts, r = 16) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const d1 = Math.hypot(p.x - prev.x, p.y - prev.y);
    const d2 = Math.hypot(next.x - p.x, next.y - p.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    if (rr < 1) {
      d += ` L${p.x} ${p.y}`;
      continue;
    }
    const u1 = { x: (p.x - prev.x) / d1, y: (p.y - prev.y) / d1 };
    const u2 = { x: (next.x - p.x) / d2, y: (next.y - p.y) / d2 };
    const a = { x: p.x - u1.x * rr, y: p.y - u1.y * rr };
    const b = { x: p.x + u2.x * rr, y: p.y + u2.y * rr };
    d += ` L${a.x} ${a.y} Q${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last.x} ${last.y}`;
  return d;
}

/** 曲线：三次贝塞尔，沿两端法线拉出的控制点；tension 控制控制点长度。 */
export function curvePath(p1, p2, s1, s2, tension = 0.42) {
  const a = pointOn(p1, s1, 0);
  const b = pointOn(p2, s2, 0);
  const n = (s) => ({ left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[s] || [0, 1]);
  const [ax, ay] = n(s1);
  const [bx, by] = n(s2);
  const dist = Math.hypot(b.x - a.x, b.y - a.y) * tension;
  return {
    d: `M${a.x} ${a.y} C${a.x + ax * dist} ${a.y + ay * dist} ${b.x + bx * dist} ${b.y + by * dist} ${b.x} ${b.y}`,
    a,
    b,
    // 末端切线方向
    angle: Math.atan2(b.y - (b.y + by * dist), b.x - (b.x + bx * dist)),
  };
}

/** 直线 */
export function linePath(p1, p2, s1, s2) {
  const a = pointOn(p1, s1, 0);
  const b = pointOn(p2, s2, 0);
  return { d: `M${a.x} ${a.y} L${b.x} ${b.y}`, a, b, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** 箭头三角：尖端在 (x,y)，两条后边按半角张开，长度 size。
    尺寸/夹角来自令牌，和线宽成比例——1:1 好看不够，0.36× 还得能认出是箭头。 */
export function tipPath(x, y, angle, size = 18, half = 0.42) {
  const p1 = { x: x - Math.cos(angle - half) * size, y: y - Math.sin(angle - half) * size };
  const p2 = { x: x - Math.cos(angle + half) * size, y: y - Math.sin(angle + half) * size };
  return `M${x} ${y} L${p1.x} ${p1.y} L${p2.x} ${p2.y} Z`;
}

/** 开口箭头：只画两条边，不封底。 */
export function tipOpenPath(x, y, angle, size = 18, half = 0.42) {
  const p1 = { x: x - Math.cos(angle - half) * size, y: y - Math.sin(angle - half) * size };
  const p2 = { x: x - Math.cos(angle + half) * size, y: y - Math.sin(angle + half) * size };
  return `M${p1.x} ${p1.y} L${x} ${y} L${p2.x} ${p2.y}`;
}

/**
 * 一条连线的完整几何。
 * 返回 { d, tip, label, points } —— 画图、描边动画、标签定位共用这一份。
 */
export function connectorGeometry({ from, to, s1, s2, shape = 'ortho', gap = 32, bend = 0, r = 16, tension = 0.42 }) {
  if (shape === 'line') {
    const rl = linePath(from, to, s1, s2);
    return { d: rl.d, tip: { ...rl.b, angle: rl.angle }, label: mid(rl.a, rl.b, rl.angle), points: [rl.a, rl.b] };
  }
  if (shape === 'curve') {
    const rc = curvePath(from, to, s1, s2, tension);
    return { d: rc.d, tip: { ...rc.b, angle: rc.angle }, label: mid(rc.a, rc.b, rc.angle), points: [rc.a, rc.b] };
  }
  const pts = orthoPoints(from, to, s1, s2, gap, bend);
  const a = pts[pts.length - 2] || pts[0];
  const b = pts[pts.length - 1];
  return {
    d: roundedPath(pts, r),
    tip: { ...b, angle: Math.atan2(b.y - a.y, b.x - a.x) },
    label: labelSpot(pts),
    points: pts,
  };
}

/** 中点 + 方向。dir 决定标签放线的上方（h）还是右侧（v）。 */
const mid = (a, b, angle) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    dir: Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v',
    angle: angle ?? Math.atan2(dy, dx),
  };
};

/** 折线总长：用来判断「这段距离够不够画一个箭头」 */
export function pathLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return total;
}

/**
 * 标签放哪：先合并共线段（折线在中点接缝处会把一条长横线切成两半），
 * 再只在「装得下标签」的段里挑离路径中点最近的那条。
 * 这样「预处理」不会骑到 hello.i 的边框上，「同一个对象」也不会压住节点。
 */
export function labelSpot(pts, lw = 120, lh = 44) {
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    const last = segs[segs.length - 1];
    if (last && last.dir === dir && Math.abs((dir === 'h' ? a.y : a.x) - (dir === 'h' ? last.b.y : last.b.x)) < 2) {
      last.b = b;
      last.len += len;
    } else {
      segs.push({ a, b, len, dir });
    }
  }
  if (!segs.length) return null;

  const total = segs.reduce((s, x) => s + x.len, 0);
  let acc = 0;
  let midX = pts[0].x;
  let midY = pts[0].y;
  for (const s of segs) {
    if (acc + s.len >= total / 2) {
      const t = s.len ? (total / 2 - acc) / s.len : 0;
      midX = s.a.x + (s.b.x - s.a.x) * t;
      midY = s.a.y + (s.b.y - s.a.y) * t;
      break;
    }
    acc += s.len;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const s of segs) {
    // 标签要在线旁边，还得装得下（左右各留 16px）
    const need = (s.dir === 'h' ? lw : lh) + 32;
    if (s.len < need) continue;
    const c = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, dir: s.dir };
    const d = Math.hypot(c.x - midX, c.y - midY);
    const score = Math.min(s.len, 600) * 0.3 - d;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (best) return best;

  // 装不下：退回最长段的中点（并标记，让 audit 能看到）
  let longest = segs[0];
  for (const s of segs) if (s.len > longest.len) longest = s;
  return {
    x: (longest.a.x + longest.b.x) / 2,
    y: (longest.a.y + longest.b.y) / 2,
    dir: longest.dir,
    tight: true,
  };
}


