/**
 * SVG 小工具 —— graph 与 callout 共用。
 *
 * 两个件都要「造 SVG 元素、把数夹进范围、把折线磨圆」，各写一份就会漂：
 * 之前 graph 的圆角是 12、callout 是 16，同一个库里的折角不一样。
 */
const NS = 'http://www.w3.org/2000/svg';

/** 造一个 SVG 元素；null/false 的属性直接跳过。 */
export const mk = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    el.setAttribute(k, String(v));
  }
  return el;
};

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** 圆角折线：每个拐点用 r 的二次曲线收一下。 */
export function roundedPath(points, r) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const next = points[i + 1];
    const v1 = { x: p.x - prev.x, y: p.y - prev.y };
    const v2 = { x: next.x - p.x, y: next.y - p.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = { x: p.x - (v1.x / l1) * rr, y: p.y - (v1.y / l1) * rr };
    const b = { x: p.x + (v2.x / l2) * rr, y: p.y + (v2.y / l2) * rr };
    d += ` L ${a.x} ${a.y} Q ${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  return d + ` L ${last.x} ${last.y}`;
}
