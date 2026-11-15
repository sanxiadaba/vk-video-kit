/**
 * v25 · 连接件与标注的唯一几何模型
 * ----------------------------------------------------------------------------
 * 箭头只有一个描述，所有消费者（关系图、时序、标注、测试、文档）都从这里取：
 *   杆 8 ｜ 头长 44 ｜ 头底 32 ｜ 尖端留 2 ｜ 出线净空 12 ｜ 最短跑道 24 ｜ 拐角 16
 *   最短跑道 = 44 + 24 + 2 = 70；有箭头的边最小间隙取 88。
 *
 * 端口模型：
 *   port(rect, side, clear) → 出线点（边框 ± 净空）
 *   tip(rect, side, gap)    → 入线尖（边框 ∓ 尖端留白）
 *   headPolygon(tip, ux, uy) → 箭头三角形（底边全宽 32）
 *
 * 标注（点、杆、括号、圈、针脚、徽标）：
 *   点 ⌀20 ｜ 杆最短 88 ｜ 圈 8 ｜ 括号 8/10 ｜ 针脚 56 ｜ 徽标 96
 */
export const ARROW = {
  length: 52,
  base: 38,
  shaft: 8,
  tipGap: 2,
  clear: 12,
  minRun: 24,
  corner: 16,
};

export const CONN = {
  clear: ARROW.clear,
  tip: ARROW.tipGap,
  head: ARROW.length,
  headW: ARROW.base,
  corner: ARROW.corner,
  shaft: ARROW.shaft,
  minGap: 64,
  arrowGap: ARROW.length + ARROW.tipGap + 40,
  sibling: 48,
};

export const ANN = {
  dot: 20,
  rod: 88,
  standoff: 88,
  ring: 8,
  ringR: 24,
  bracket: 8,
  lead: 8,
  tick: 10,
  bracketGap: 4,
  pin: 56,
  badge: 96,
};

/** 侧面的外法线。 */
export function portNormal(side) {
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

/** 出线点：中心 + 法线 × (半宽/半高 + 净空)。 */
export function port(rect, side, gap = ARROW.clear) {
  const n = portNormal(side);
  const x = (rect.left + rect.right) / 2 + n.x * (rect.width / 2 + gap);
  const y = (rect.top + rect.bottom) / 2 + n.y * (rect.height / 2 + gap);
  return { x, y, n };
}

/** 入线尖：目标边退回尖端留白；u 是行进方向。 */
export function tip(rect, side, gap = ARROW.tipGap) {
  const u = portNormal(side); // 进入目标的方向与「该侧外法线」相反
  const x = (rect.left + rect.right) / 2 - u.x * (rect.width / 2 + gap);
  const y = (rect.top + rect.bottom) / 2 - u.y * (rect.height / 2 + gap);
  return { x, y, u: { x: -u.x, y: -u.y } };
}

/** 箭头三角形：尖端 tip，方向单位 (ux,uy)，底边全宽 base。 */
export function headPolygon(t, ux, uy) {
  const bx = t.x - ux * ARROW.length;
  const by = t.y - uy * ARROW.length;
  const hx = -uy * (ARROW.base / 2);
  const hy = ux * (ARROW.base / 2);
  return `${t.x},${t.y} ${bx + hx},${by + hy} ${bx - hx},${by - hy}`;
}
