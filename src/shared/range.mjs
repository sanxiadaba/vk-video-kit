/** 行段解析：构建期与运行期共用同一份。 */

/** "3" / "3-7" / "3,7,9" / "4-" → [[3,3],[7,7],[9,9]] / [[4,Infinity]]；非法返回 null。 */
export function parseLines(value) {
  const out = [];
  for (const piece of String(value ?? '').split(',')) {
    const tok = piece.trim();
    if (!tok) continue;
    const m = tok.match(/^(\d+)\s*(?:-\s*(\d+)?)?$/);
    if (!m) return null;
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]) || Infinity;
    if (from < 1 || to < from) return null;
    out.push([from, to]);
  }
  return out.length ? out : null;
}

/** 只接受单段：range="4-6" / "4-" / "4"。 */
export function parseRange(value) {
  const ranges = parseLines(value);
  if (!ranges || ranges.length !== 1) return null;
  return ranges[0];
}

/** 展开成 1 起的行号集合（Infinity 用 limit 截）。 */
export function lineSet(value, limit = 4000) {
  const ranges = parseLines(value);
  if (!ranges) return null;
  const set = new Set();
  for (const [a, b] of ranges) for (let i = a; i <= Math.min(b, a + limit); i++) set.add(i);
  return set;
}

export function inRanges(n, ranges) {
  return ranges?.some(([a, b]) => n >= a && n <= b) ?? false;
}
