/**
 * v25 · 标注与连接件几何（全库唯一一套）
 * ----------------------------------------------------------------------------
 * 标注不是排版：尺寸是常数，位置才是变量。
 *
 * 连接件（边、箭头）：
 *   净空 12 ｜ 箭头 40×32 ｜ 尖端留 4 ｜ 拐角 16 ｜ 杆 12 ｜ 最小间隙 64
 *   最小间隙 = 杆最短 20 + 箭头 40 + 尖端 4 = 64
 *
 * 标注（点、杆、括号、圈、针脚、徽标）：
 *   点 ⌀20 ｜ 杆最短 88 ｜ 标签离目标 ≥88 ｜ 圈 8 ｜ 括号 8/10 ｜ 针脚 40 ｜ 徽标 96
 *
 * 任何布局不得让相邻节点小于 64；任何标签都要有落点、杆不得短于 88。
 * 放不下就换位置（换边、挑到组件外），不许缩尺寸。
 */
export const CONN = {
  clear: 12,
  tip: 4,
  head: 40,
  headW: 32,
  corner: 16,
  shaft: 12,
  shaftMin: 20,
  minGap: 64,
  sibling: 48,
};

export const ANN = {
  dot: 20,
  rod: 88,
  standoff: 88,
  ring: 8,
  ringR: 24,
  bracket: 8,
  tick: 10,
  bracketGap: 4,
  pin: 56,
  badge: 96,
};

/** 箭头三角形：尖端 tip，方向单位 (ux,uy)。 */
export function headPolygon(tip, ux, uy) {
  const bx = tip.x - ux * CONN.head;
  const by = tip.y - uy * CONN.head;
  const hx = -uy * (CONN.headW / 2);
  const hy = ux * (CONN.headW / 2);
  return `${tip.x},${tip.y} ${bx + hx},${by + hy} ${bx - hx},${by - hy}`;
}

/** 把两端留出尖端净空，返回真正的尖端。 */
export function tipAt(p, ux, uy) {
  return { x: p.x - ux * CONN.tip, y: p.y - uy * CONN.tip };
}
