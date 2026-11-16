/**
 * v26 · 连接件与标注的唯一几何模型
 * ----------------------------------------------------------------------------
 * 箭头只有一个描述，所有消费者（关系图、时序、标注、测试、文档）都从这里取：
 *   杆 8 ｜ 头长 52 ｜ 头底 38 ｜ 尖端留 2 ｜ 出线净空 12 ｜ 最短跑道 24 ｜ 拐角 16
 *
 * 端口模型：
 *   port(rect, side, clear) → 出线点（边框 ± 净空）
 *   tip(rect, side, gap)    → 入线尖（边框 ∓ 尖端留白）
 *   headPolygon(tip, ux, uy) → 箭头三角形
 *
 * 标注：
 *   标记按目标选形：词/块用 focus 色描边框，行用 14px 实心横条，行段用右侧括号。
 *   形状由库决定，作者只写 for 和一句话。
 */
export const ARROW = {
  length: 52,
  base: 38,
  back: 18, // 凹底缺口深度：后缘两角收尖，中间 V 形收进去
  shaft: 8,
  tipGap: 2, // 指盒子：尖贴边
  textGap: 32, // 指文字：尖要退开，不然像贴在字上
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
  minEdge: ARROW.length + ARROW.tipGap + 34, // 短于这个就不画箭头，改「线 + 点」
  arrowGap: ARROW.length + ARROW.tipGap + 40,
  sibling: 48,
};

export const ANN = {
  bar: 12, // 标记条厚
  barGap: 8, // 条顶离墨迹底（给 p/g/y 的下伸笔画留空气）
  over: 10, // 行条两端出头（词条不出头）
  bracket: 40, // 行段括号离字右缘
  arm: 32, // 括号上下两只脚
  boxPad: 16, // 块框左右外扩
  boxPadY: 12, // 块框上下外扩
  box: 12, // 块框线宽
  boxR: 8, // 块框圆角（sm）
  standoff: 112, // 右注栏：箭头长 + 文字净空 + 分栏余量
  standoffY: 160, // 上/下注记：箭头 + 文字 + 框线余量；竖向要更长才不挤
  gutter: 560, // 有注记的页，右侧让出的注栏宽（408 时一行只有 6.4 字）
  dot: 20,
  lead: 8,
  tick: 10,
  badge: 96,
  pin: 56,
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

/** 凹底箭头：前尖，后缘收成两个尖角 + 中间一个 V 形缺口。
    平底三角形在 693 下会像一个钝楔子，尤其是水平时序箭头。 */
export function headPolygon(t, ux, uy, len = ARROW.length, base = ARROW.base) {
  const back = (ARROW.back * len) / ARROW.length;
  const tail = { x: t.x - ux * len, y: t.y - uy * len };
  const notch = { x: t.x - ux * (len - back), y: t.y - uy * (len - back) };
  const hx = -uy * (base / 2);
  const hy = ux * (base / 2);
  return `${t.x},${t.y} ${tail.x + hx},${tail.y + hy} ${notch.x},${notch.y} ${tail.x - hx},${tail.y - hy}`;
}


