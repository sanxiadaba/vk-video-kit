/** 构建期：关系图（row / tree / layered / mesh）与时序。 */
import { attrOf, hasAttr, kids, serialize, textOf, esc } from '../shared/dom.mjs';
import { TAGS } from '../schema.mjs';

const labelOf = (li) => (li.childNodes || []).map(serialize).join('');

/* 属性写回：同名只留一个（as / data-as 要给运行期看）。 */
const setAttr = (node, name, value) => {
  node.attrs = [...(node.attrs || []).filter((a) => a.name !== name), { name, value: String(value) }];
};

/* ------------------------------------------------------------------ 关系图 */
export function buildGraph(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const isEdge = (li) => hasAttr(li, 'from') || hasAttr(li, 'to');
  const nodes = items.filter((li) => !isEdge(li));
  const edges = items.filter(isEdge);

  /* 布局推断：显式 as 优先；否则 lane → layered，from/to → mesh，after → tree，其余 row。
     推断结果写回 as + data-as，运行期与 CSS 都从这两个词走。 */
  const variants = TAGS['vk-graph'].variants;
  const declared = attrOf(node, 'as');
  const hasLane = items.some((li) => hasAttr(li, 'lane'));
  const hasFromTo = items.some(isEdge);
  const hasAfter = items.some((li) => hasAttr(li, 'after'));
  const layout = declared && variants[declared] ? declared : hasLane ? 'layered' : hasFromTo ? 'mesh' : hasAfter ? 'tree' : 'row';
  setAttr(node, 'as', layout);
  setAttr(node, 'data-as', layout);

  /* 层级：只按 after 边算（根 0，取最长路径）；from/to 显式边不参与。
     运行期已删 BFS，只读 data-depth。 */
  const idIndex = new Map(nodes.map((li, i) => [attrOf(li, 'id') || `n${i + 1}`, i]));
  const parents = nodes.map((li) =>
    (attrOf(li, 'after') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((ref) => idIndex.get(ref))
      .filter((i) => i != null)
  );
  const depth = new Array(nodes.length).fill(0);
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (let i = 0; i < nodes.length; i++) {
      for (const p of parents[i]) {
        const d = depth[p] + 1;
        if (d > depth[i]) {
          depth[i] = d;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const nodeHtml = nodes
    .map((li, i) => {
      const id = attrOf(li, 'id') || `n${i + 1}`;
      const note = attrOf(li, 'note');
      const after = (attrOf(li, 'after') || '').split(/\s+/).filter(Boolean);
      const lane = attrOf(li, 'lane');
      /* edge 是 after 边的标签：只有一条 after 时才有地方挂；其余写空。 */
      let edgeLabel = '';
      const edgeAttr = attrOf(li, 'edge');
      if (edgeAttr) {
        if (after.length > 1) {
          if (!ctx.diag.has(li, 'EDGE_MULTI')) ctx.diag(li, { code: 'EDGE_MULTI', message: `<vk-graph> 的节点有 ${after.length} 个 after，edge="${edgeAttr}" 只能标一条边`, fix: '拆成两个节点，或删掉 edge' });
        } else if (after.length === 1) edgeLabel = edgeAttr;
      }
      return `<div class="vk-gnode" data-vk-item="${i + 1}" data-id="${esc(id)}"${attrOf(li, 'id') ? ` id="${esc(attrOf(li, 'id'))}"` : ''} data-depth="${depth[i]}" data-after="${esc(after.join(' '))}"${lane != null ? ` data-lane="${esc(lane)}"` : ''}${after.length ? ` data-edge="${esc(edgeLabel)}"` : ''}${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}">${labelOf(li)}${note ? `<span class="vk-gn-n">${esc(note)}</span>` : ''}</div>`;
    })
    .join('');

  const edgeHtml = edges
    .map((li) => {
      const label = (attrOf(li, 'edge') || textOf(li)).trim();
      /* data-edge 是运行期读的标签；元素文字留给旧读法（.vk-gedge 是 display:none）。 */
      return `<i class="vk-gedge" data-from="${esc(attrOf(li, 'from') || '')}" data-to="${esc(attrOf(li, 'to') || '')}" data-edge="${esc(label)}"${hasAttr(li, 'current') ? ' current' : ''} data-tone="${esc(attrOf(li, 'tone') || 'neutral')}">${esc(label)}</i>`;
    })
    .join('');

  /* 边有两条以上不同标签时，自动出一行图例：颜色不再需要猜。 */
  const seen = new Map();
  for (const li of edges) {
    const label = (attrOf(li, 'edge') || textOf(li)).trim();
    const tone = attrOf(li, 'tone') || 'neutral';
    if (label && !seen.has(label)) seen.set(label, tone);
  }
  const legendHtml =
    seen.size >= 2 ? `<div class="vk-glegend">${[...seen].map(([label, tone]) => `<span data-tone="${esc(tone)}"><i></i>${esc(label)}</span>`).join('')}</div>` : '';

  /* 宿主与内层都写 data-as；row 只支持横排，data-dir 固定 horizontal。
     data-layout 留给仍在用它的样式做过渡。 */
  return `<div class="vk-graph" data-as="${layout}" data-dir="horizontal" data-layout="${layout}"><div class="vk-gstage">${nodeHtml}${edgeHtml}</div><svg class="vk-gedges" aria-hidden="true"></svg></div>${legendHtml}`;
}

/* ------------------------------------------------------------------ 时序
   participants 可省：从所有 from/to 按首次出现收集，再不行用 A/B；
   两条消息都没写 from/to 时按阅读顺序左右交替。 */
const seqLane = (v, names) => {
  if (v == null || v === '') return null;
  if (/^\d+$/.test(String(v))) return Number(v) - 1;
  return names.indexOf(String(v));
};

export function buildSeq(node, ctx) {
  const items = kids(node).filter((c) => c.tagName === 'li');
  const declared = (attrOf(node, 'participants') || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  let names = declared.slice();
  if (!names.length) {
    for (const li of items) {
      for (const key of ['from', 'to']) {
        const v = attrOf(li, key);
        if (v == null || v === '') continue;
        const s = String(v).trim();
        if (/^\d+$/.test(s) || names.includes(s)) continue;
        names.push(s);
      }
    }
    if (names.length === 1) names.push('B');
    if (!names.length) names = ['A', 'B'];
  }
  if (names.length < 2 || names.length > 4) {
    ctx.diag(node, { code: 'VALUE_ENUM', message: `时序需要 2–4 个参与者，现在 ${names.length} 个`, fix: '写 participants="客户端,服务端,缓存"' });
    names = names.slice(0, 4);
    while (names.length < 2) names.push(names.length ? 'B' : 'A');
  }
  const n = names.length;
  const x = (i) => (n === 1 ? 50 : 7.14 + (85.72 * i) / (n - 1));

  const rows = items.map((li, i) => {
    const from = seqLane(attrOf(li, 'from'), names);
    const to = seqLane(attrOf(li, 'to'), names);
    let a = from;
    let b = to;
    if (a == null && b == null) {
      /* 左右交替：请求往右，应答往左。 */
      if (i % 2 === 0) (a = 0), (b = n - 1);
      else (a = n - 1), (b = 0);
    } else if (a == null) a = b > 0 ? b - 1 : Math.min(1, n - 1);
    else if (b == null) b = a < n - 1 ? a + 1 : Math.max(0, a - 1);
    if (a < 0 || a >= n || b < 0 || b >= n) {
      ctx.diag(li, { code: 'VALUE_ENUM', message: `时序的第 ${i + 1} 条消息指向不存在的参与者`, fix: `可用：${names.join(' / ')} 或 1–${n}` });
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
  /* 一条消息 160 是舒服的阅读节奏；3 条以上按条数收紧，4 条能进 subhead 的正文带。
     这是排版事实，不是门禁：挤不下就报 overflow，照样出图。 */
  const msgH = items.length <= 3 ? 160 : items.length === 4 ? 120 : items.length === 5 ? 120 : 120;
  return `<div class="vk-seq" style="--vk-msg-h:${msgH}px"><div class="vk-seq-head">${head}</div><div class="vk-seq-body">${lanes}${rows.join('')}</div></div>`;
}
