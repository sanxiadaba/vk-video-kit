/** 构建期：关系图（row / tree / layered / mesh）与时序。 */
import { attrOf, hasAttr, kids, serialize, esc } from '../shared/dom.mjs';

const labelOf = (li) => (li.childNodes || []).map(serialize).join('');

/* ------------------------------------------------------------------ 关系图 */
export function buildGraph(node) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const isEdge = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
  const nodes = items.filter((li) => !isEdge(li));
  const edges = items.filter(isEdge);

  const nodeHtml = nodes
    .map((li, i) => {
      const id = attrOf(li, 'id') || `n${i + 1}`;
      const note = attrOf(li, 'note');
      const after = (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean).join(' ');
      const lane = attrOf(li, 'lane');
      return `<div class="vk-gnode" data-vk-item="${i + 1}" data-id="${esc(id)}"${attrOf(li, 'id') ? ` id="${esc(attrOf(li, 'id'))}"` : ''} data-after="${esc(after)}"${lane != null ? ` data-lane="${esc(lane)}"` : ''}${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}"><span class="vk-gn-l">${labelOf(li)}</span>${note ? `<span class="vk-gn-n">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');

  const edgeHtml = edges
    .map((li) => `<i class="vk-gedge" data-from="${esc(attrOf(li, 'from') || '')}" data-to="${esc(attrOf(li, 'to') || '')}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}">${labelOf(li)}</i>`)
    .join('');

  /* 边有两条以上不同标签时，自动出一行图例：颜色不再需要猜。 */
  const seen = new Map();
  for (const li of edges) {
    const label = labelOf(li);
    const tone = attrOf(li, 'tone') || 'neutral';
    if (label && !seen.has(label)) seen.set(label, tone);
  }
  const legendHtml =
    seen.size >= 2 ? `<div class="vk-glegend">${[...seen].map(([label, tone]) => `<span data-tone="${esc(tone)}"><i></i>${esc(label)}</span>`).join('')}</div>` : '';

  return `<div class="vk-graph" data-layout="${attrOf(node, 'as') || 'row'}" data-dir="${attrOf(node, 'direction') || 'horizontal'}"><div class="vk-gstage">${nodeHtml}${edgeHtml}</div><svg class="vk-gedges" aria-hidden="true"></svg></div>${legendHtml}`;
}

/* ------------------------------------------------------------------ 时序 */
const seqLane = (v, names) => {
  if (v == null || v === '') return null;
  if (/^\d+$/.test(String(v))) return Number(v) - 1;
  return names.indexOf(String(v));
};

export function buildSeq(node, ctx) {
  const partText = attrOf(node, 'participants');
  let names = partText ? partText.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (!names.length) names = ['A', 'B'];
  if (names.length < 2 || names.length > 4) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_ENUM', message: `时序需要 2–4 个参与者，现在 ${names.length} 个`, fix: '写 participants="客户端,服务端,缓存"' });
    names = names.slice(0, 4);
    while (names.length < 2) names.push(names.length ? 'B' : 'A');
  }
  const n = names.length;
  const x = (i) => (n === 1 ? 50 : 7.14 + (85.72 * i) / (n - 1));
  const items = kids(node).filter((c) => c.tagName === 'li');

  const rows = items.map((li, i) => {
    const from = seqLane(attrOf(li, 'from'), names);
    const to = seqLane(attrOf(li, 'to'), names);
    const dir = attrOf(li, 'direction') || 'right';
    let a = from;
    let b = to;
    if (a == null && b == null) (a = dir === 'left' ? 1 : 0), (b = dir === 'left' ? 0 : 1);
    else if (a == null) a = Math.max(0, b - 1);
    else if (b == null) b = Math.min(n - 1, a + 1);
    if (a < 0 || a >= n || b < 0 || b >= n) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_ENUM', message: `时序的第 ${i + 1} 条消息指向不存在的参与者`, fix: `可用：${names.join(' / ')} 或 1–${n}` });
      a = 0;
      b = Math.min(1, n - 1);
    }
    const x1 = x(a);
    const x2 = x(b);
    const rightward = x2 >= x1;
    const note = attrOf(li, 'note');
    return `<div class="vk-seq-row" data-vk-item="${i + 1}"${hasAttr(li, 'current') ? ' current' : ''} data-dir="${rightward ? 'right' : 'left'}" data-tone="${esc(attrOf(li, 'tone') || 'neutral')}" style="--vk-x1:${x1.toFixed(2)}%;--vk-x2:${x2.toFixed(2)}%;--vk-mid:${((x1 + x2) / 2).toFixed(2)}%"><span class="vk-seq-l">${labelOf(li)}${note ? `<span class="vk-seq-note">${esc(note)}</span>` : ''}</span><span class="vk-seq-arrow"></span></div>`;
  });

  const head = names.map((name, i) => `<span style="--vk-x:${x(i).toFixed(2)}%">${esc(name)}</span>`).join('');
  const lanes = names.map((_, i) => `<span class="vk-seq-lane" style="--vk-x:${x(i).toFixed(2)}%"></span>`).join('');
  return `<div class="vk-seq" style="--vk-lanes:${n}"><div class="vk-seq-head">${head}</div><div class="vk-seq-body">${lanes}${rows.join('')}</div></div>`;
}
