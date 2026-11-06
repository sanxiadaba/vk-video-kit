/**
 * 看板：把一批验收帧排成一页。
 *
 * 它不是第二个产品，也不是模板库：输入是 `vk showcase` 刚渲染出来的那批 PNG，
 * 输出是一张 HTML 和一张整页截图。没有状态、没有交互、没有构建步骤。
 *
 * 分组由「这一帧最稀有的那个件」决定：vk-cells 只出现一次，那一帧就归 cells；
 * 于是看板永远跟着 schema 的分层走，不需要手写「哪帧演示哪个件」。
 */

import { TAGS } from '../src/schema.mjs';

const LAYER_LABEL = {
  page: 'L0 · 画布',
  layout: 'L1 · 排布',
  surface: 'L2 · 面与字',
  content: 'L3 · 内容',
  diff: 'L3 · 内容',
  diagram: 'L4 · 图',
  relation: 'L5 · 关系',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {{entries: {id:string,caption:string,tags:string[],png:string,issues:{message:string}[]}[], source:string}} input
 * @returns {string} 完整 HTML
 */
export function buildShowcase({ entries, source }) {
  // 每个件出现几次：越少越是这一帧的主角。
  const freq = new Map();
  for (const e of entries) for (const t of e.tags) freq.set(t, (freq.get(t) || 0) + 1);
  const short = (t) => t.replace(/^vk-/, '');
  // 主件：先看帧 id 里点到了谁（作者自己写的「这帧演示什么」），
  // 没有就取这一帧里最稀有、且不是标注的件。两种都比"手写映射表"稳。
  const primaryOf = (e) => {
    const id = String(e.id || '').toLowerCase();
    const named = e.tags.filter((t) => short(t).length > 2 && id.includes(short(t)));
    const pool = named.length ? named : e.tags.filter((t) => TAGS[t]?.layer !== 'relation');
    return [...pool].sort((a, b) => (freq.get(a) || 0) - (freq.get(b) || 0) || short(b).length - short(a).length)[0] || 'vk-text';
  };

  const groups = new Map();
  for (const e of entries) {
    const tag = primaryOf(e);
    const layer = TAGS[tag]?.layer || 'content';
    const key = LAYER_LABEL[layer] || LAYER_LABEL.content;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, primary: tag });
  }
  const order = ['L0 · 画布', 'L1 · 排布', 'L2 · 面与字', 'L3 · 内容', 'L4 · 图', 'L5 · 关系'];
  const sections = order.filter((k) => groups.has(k));

  const cards = sections
    .map((key) => {
      const rows = groups
        .get(key)
        .map((e) => {
          // 每帧都有 stack/label/text，列出来只是噪声：只显示这一帧的「个性」。
          const chips = e.tags.filter((t) => !['vk-stack', 'vk-label', 'vk-text', 'vk-page'].includes(t)).slice(0, 5).map((t) => `<span class="chip">${esc(t)}</span>`).join('');
          const bad = e.issues.length ? `<p class="bad">${esc(e.issues.map((x) => x.message).join('；'))}</p>` : '';
          return `<a class="card${e.issues.length ? ' is-bad' : ''}" href="${esc(e.png)}" target="_blank" rel="noopener">
  <span class="shot"><img src="${esc(e.png)}" alt="${esc(e.caption || e.id)}" loading="lazy"></span>
  <span class="meta"><b>${esc(e.id)}</b><em>${esc(e.caption)}</em></span>
  <span class="chips">${chips}</span>${bad}
</a>`;
        })
        .join('\n');
      return `<section><h2>${esc(key)} <small>${groups.get(key).length}</small></h2><div class="grid">${rows}</div></section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>vk · 组件看板</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 48px 64px; background: #eef0f4; color: #0b0f14;
         font: 15px/1.5 -apple-system, "Segoe UI", "Noto Sans SC", "Microsoft YaHei", sans-serif; }
  header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
  header p { margin: 0; color: #5c6674; }
  h2 { margin: 36px 0 14px; font-size: 15px; font-weight: 600; color: #333d4b; }
  h2 small { font-weight: 400; color: #8b95a3; margin-left: 6px; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
  .card { display: block; text-decoration: none; color: inherit; background: #fff; border-radius: 10px;
          overflow: hidden; border: 1px solid rgba(11,15,20,.10); }
  .card.is-bad { border-color: #b3261e; box-shadow: 0 0 0 1px #b3261e inset; }
  .shot { display: block; aspect-ratio: 16/9; background: #fff; border-bottom: 1px solid rgba(11,15,20,.08); }
  .shot img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .meta { display: flex; align-items: baseline; gap: 8px; padding: 10px 12px 2px; }
  .meta b { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .meta em { font-style: normal; font-size: 12px; color: #5c6674; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px 12px 12px; }
  .chip { font: 11px/1.6 ui-monospace, "JetBrains Mono", monospace; color: #3a4454;
          background: #eef0f3; border-radius: 999px; padding: 0 7px; }
  .bad { margin: 0; padding: 0 12px 12px; font-size: 12px; color: #b3261e; }
  footer { margin-top: 40px; color: #8b95a3; font-size: 12px; }
</style></head>
<body>
<header>
  <h1>vk · 组件看板</h1>
  <p>${entries.length} 帧 · 来自 ${esc(source)} · 点任意一帧看 1920 原图</p>
</header>
${cards}
<footer>生成物：vk showcase。改画面请改页面本身，不要改这里。</footer>
</body></html>
`;
}
