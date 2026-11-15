/**
 * v25 · 连接件几何（全库唯一一套）
 * ----------------------------------------------------------------------------
 * 箭头、净空、拐角只有这一组数：关系图、时序、标注都从这里取。
 * 布局的最小间距也从这里推：
 *
 *   净空 12 ｜ 箭头 28 ｜ 箭头宽 16 ｜ 尖端留 4 ｜ 拐角 16
 *   最小间隙 = 杆最短 20 + 箭头 28 + 尖端 4 + 净空 12 = 64
 *
 * 任何布局不得让相邻节点小于这个间隙；放不下就减节点、减内距、换更矮的标题带，
 * 不许压缩间距——压到 64 以下，箭头就会贴脸。
 */
export const CONN = {
  clear: 12,
  tip: 4,
  head: 28,
  headW: 16,
  corner: 16,
  shaft: 20,
  minGap: 64,
  sibling: 48,
};

/** 箭头三角形：尖端 tip，方向单位 (ux,uy)。 */
export function headPolygon(tip, ux, uy) {
  const bx = tip.x - ux * CONN.head;
  const by = tip.y - uy * CONN.head;
  const hx = -uy * (CONN.headW / 2);
  const hy = ux * (CONN.headW / 2);
  return `${tip.x},${tip.y} ${bx + hx},${by + hy} ${bx - hx},${by - hy}`;
}

/** 把两点之间留出尖端净空，返回真正的尖端。 */
export function tipAt(p, ux, uy) {
  return { x: p.x - ux * CONN.tip, y: p.y - uy * CONN.tip };
}
