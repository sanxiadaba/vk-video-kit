/* vk 标本册 · 显示引擎
   只做四件事：镜头切换、变体现场改、解剖量测、页码。
   不写样式；帧内可见元素全部是 vk 组件。 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const vk = () => window.vk;
  const page = $('vk-page');

  const LENSES = ['plate', 'variants', 'anatomy', 'usage', 'api'];

  /* ------------------------------------------------------------- 镜头 */

  function showLens(name, push = true) {
    const lens = LENSES.includes(name) ? name : 'plate';
    for (const section of $$('[data-lens]')) {
      const on = section.dataset.lens === lens;
      if (on && section.dataset.filled !== '1') {
        const tpl = $(`template[data-lens-template="${lens}"]`);
        if (tpl) {
          section.append(tpl.content.cloneNode(true));
          section.dataset.filled = '1';
        }
      }
      section.hidden = !on;
    }
    for (const tag of $$('[data-lens-tag]')) tag.setAttribute('tone', tag.dataset.lensTag === lens ? 'accent' : 'muted');
    if (push && location.hash !== `#${lens}`) history.replaceState(null, '', `#${lens}`);
    const info = $('[data-pageinfo]');
    if (info) info.textContent = '';
    if (lens === 'variants') {
      rememberBase();
      for (const tag of $$('[data-attr]')) markControl(tag.dataset.attr);
    }
    if (lens === 'api') updateApiPage(0, false);
    vk()?.layout?.();
    if (lens === 'anatomy') requestAnimationFrame(() => requestAnimationFrame(buildAnatomy));
  }

  /* ------------------------------------------------------------- 变体 */

  let presets = [];
  try {
    const raw = $('#vk-presets')?.textContent;
    presets = raw ? JSON.parse(raw) : [];
  } catch {
    presets = [];
  }

  const target = () => $('[data-variant-target]');
  const baseAttrs = new Map();
  let baseReady = false;

  function rememberBase() {
    const t = target();
    if (!t || baseReady) return;
    for (const a of t.attributes) if (!a.name.startsWith('data-vk')) baseAttrs.set(a.name, a.value);
    baseReady = true;
  }

  function resetTarget(t) {
    for (const a of [...t.attributes]) {
      if (a.name === 'data-variant-target' || a.name === 'id') continue;
      t.removeAttribute(a.name);
    }
    for (const [k, v] of baseAttrs) t.setAttribute(k, v);
  }

  function applyPreset(index) {
    const t = target();
    const p = presets[index];
    if (!t || !p) return;
    rememberBase();
    resetTarget(t);
    for (const [k, v] of Object.entries(p.attrs || {})) {
      if (v === null) t.removeAttribute(k);
      else t.setAttribute(k, v);
    }
    for (const tag of $$('[data-preset]')) tag.setAttribute('tone', Number(tag.dataset.preset) === index ? 'accent' : 'muted');
    for (const tag of $$('[data-attr]')) markControl(tag.dataset.attr);
    vk()?.layout?.();
  }

  function markControl(name) {
    const t = target();
    if (!t) return;
    const now = t.getAttribute(name);
    for (const tag of $$(`[data-attr="${name}"]`)) {
      tag.setAttribute('tone', tag.dataset.value === now ? 'accent' : 'muted');
    }
  }

  function applyControl(name, value) {
    const t = target();
    if (!t) return;
    rememberBase();
    t.setAttribute(name, value);
    for (const p of $$('[data-preset]')) p.setAttribute('tone', 'muted');
    markControl(name);
    vk()?.layout?.();
  }

  /* ----------------------------------------------------------- API 分页 */

  let apiPage = 0;
  const apiRows = () => $$('[data-api-page]');
  const apiMax = () => (apiRows().length ? Math.max(...apiRows().map((r) => Number(r.dataset.apiPage))) : 0);

  function updateApiPage(next, push = true) {
    apiPage = Math.max(0, Math.min(apiMax(), next));
    for (const row of apiRows()) row.hidden = Number(row.dataset.apiPage) !== apiPage;
    const info = $('[data-pageinfo]');
    if (info) info.textContent = `${apiPage + 1} / ${apiMax() + 1}`;
    if (push) vk()?.layout?.();
  }

  // 表格行不是 vk 组件，但它们的显示由引擎控制；[hidden] 的 !important
  // 在 showcase.css，tr 上是 display:table-row，需要单独处理。
  function syncApiRows() {
    for (const row of apiRows()) row.style.display = Number(row.dataset.apiPage) === apiPage ? '' : 'none';
  }

  const _updateApiPage = updateApiPage;
  updateApiPage = (next, push = true) => {
    _updateApiPage(next, push);
    syncApiRows();
  };

  /* ----------------------------------------------------------- 索引分页 */

  const docPages = () => $$('[data-docpage]');
  let docPage = 0;

  function showDocPage(next, push = true) {
    const max = Math.max(0, docPages().length - 1);
    docPage = Math.max(0, Math.min(max, next));
    for (const section of docPages()) section.hidden = Number(section.dataset.docpage) !== docPage;
    for (const tag of $$('[data-docpage-tag]')) tag.setAttribute('tone', Number(tag.dataset.docpageTag) === docPage ? 'accent' : 'muted');
    if (push && location.hash !== `#p${docPage + 1}`) history.replaceState(null, '', `#p${docPage + 1}`);
    vk()?.layout?.();
  }

  /* ------------------------------------------------------------- 复制 */

  function snippetOf(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script').forEach((n) => n.remove());
    clone.querySelectorAll('*').forEach((n) => {
      for (const a of [...n.attributes]) {
        if (a.name === 'data-variant-target' || a.name.startsWith('data-vk')) n.removeAttribute(a.name);
      }
      n.removeAttribute?.('style');
    });
    clone.removeAttribute('data-variant-target');
    clone.removeAttribute('style');
    return clone.outerHTML.replace(/></g, '>\n<');
  }

  let baseSnippet = '';
  try {
    const raw = $('[data-base-snippet]')?.textContent;
    baseSnippet = raw ? JSON.parse(raw).html || '' : '';
  } catch {
    baseSnippet = '';
  }

  async function copySnippet(tag) {
    const t = target();
    const text = t ? snippetOf(t) : baseSnippet;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      document.execCommand?.('copy');
      area.remove();
    }
    const old = tag.textContent;
    tag.textContent = '已复制';
    setTimeout(() => (tag.textContent = old), 1200);
  }

  /* ------------------------------------------------------------- 解剖 */

  function designRect(el, canvas) {
    const cr = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const scale = canvas.offsetWidth ? cr.width / canvas.offsetWidth : 1;
    return {
      x: (r.left - cr.left) / scale,
      y: (r.top - cr.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  }

  function addBox(canvas, r, { border = 'hair', tone = '' } = {}) {
    const box = document.createElement('vk-box');
    box.setAttribute('x', String(Math.round(r.x)));
    box.setAttribute('y', String(Math.round(r.y)));
    box.setAttribute('w', String(Math.max(48, Math.round(r.w))));
    box.setAttribute('h', String(Math.max(48, Math.round(r.h))));
    box.setAttribute('surface', 'none');
    box.setAttribute('border', border);
    box.setAttribute('radius', 'none');
    if (tone) box.setAttribute('tone', tone);
    box.setAttribute('data-anno', '');
    box.style.pointerEvents = 'none';
    box.style.zIndex = '4';
    canvas.append(box);
    return box;
  }

  const PART_NAME = {
    hd: '窗头',
    tab: '文件名',
    bd: '正文',
    ln: '行号',
    line: '行',
    src: '代码',
    'tree-hd': '树头',
    'frame': '帧',
    'fig-body': '图体',
    cell: '格',
  };

  function addChip(canvas, index) {
    const chip = document.createElement('vk-tag');
    chip.id = `anno-${index}`;
    chip.setAttribute('size', 'meta');
    chip.setAttribute('tone', 'accent');
    chip.setAttribute('x', '8');
    chip.setAttribute('y', String(80 + (index - 1) * 64));
    chip.setAttribute('data-anno', '');
    chip.style.pointerEvents = 'none';
    chip.style.zIndex = '6';
    chip.textContent = String(index);
    canvas.append(chip);
    return chip;
  }

  function addLead(canvas, index) {
    const edge = document.createElement('vk-edge');
    edge.setAttribute('from', `#anno-${index}`);
    edge.setAttribute('to', `#part-${index}`);
    edge.setAttribute('tone', 'accent');
    edge.setAttribute('arrow', 'none');
    edge.setAttribute('shape', 'ortho');
    edge.setAttribute('clearance', '8');
    edge.setAttribute('dash', '');
    edge.setAttribute('data-anno', '');
    edge.style.pointerEvents = 'none';
    edge.style.zIndex = '3';
    canvas.append(edge);
    return edge;
  }

  function addLegend(canvas, r, rows) {
    const box = document.createElement('vk-box');
    box.setAttribute('x', '1300');
    box.setAttribute('y', '80');
    box.setAttribute('w', '340');
    box.setAttribute('surface', 'paper');
    box.setAttribute('border', 'hair');
    box.setAttribute('pad', 'sm');
    box.setAttribute('radius', 'md');
    box.setAttribute('data-anno', '');
    box.style.zIndex = '5';
    const title = document.createElement('vk-text');
    title.setAttribute('size', 'heading');
    title.setAttribute('weight', 'bold');
    title.textContent = '解剖';
    const dim = document.createElement('vk-text');
    dim.setAttribute('size', 'meta');
    dim.setAttribute('mono', '');
    dim.setAttribute('emphasis', 'muted');
    dim.textContent = `${Math.round(r.w)}×${Math.round(r.h)}`;
    const list = document.createElement('vk-stack');
    list.setAttribute('gap', '2xs');
    list.append(title, dim);
    for (const row of rows) {
      const t = document.createElement('vk-text');
      t.setAttribute('size', 'meta');
      t.setAttribute('mono', '');
      t.textContent = row;
      list.append(t);
    }
    box.append(list);
    canvas.append(box);
    return box;
  }

  function buildAnatomy() {
    const canvas = $('[data-anatomy]');
    const t = $('[data-anatomy-target]', canvas || document);
    if (!canvas || !t || t.offsetParent === null) return;
    for (const n of $$('[data-anno]', canvas)) n.remove();
    vk()?.layout?.();
    const r = designRect(t, canvas);
    addBox(canvas, r, { border: 'strong' });
    const wanted = ['vk-hd', 'vk-tab', 'vk-bd', 'vk-ln', 'vk-cell', 'vk-frame', 'vk-fig-body', 'vk-tree-hd'];
    const parts = wanted.map((c) => t.querySelector(`.${c}`)).filter(Boolean).slice(0, 4);
    const rows = [];
    parts.forEach((p, i) => {
      const pr = designRect(p, canvas);
      if (pr.w < 80 || pr.h < 48) return;
      const n = i + 1;
      p.id = `part-${n}`;
      addBox(canvas, pr);
      addChip(canvas, n);
      addLead(canvas, n);
      const cls = [...p.classList].find((c) => c.startsWith('vk-'))?.replace(/^vk-/, '') || 'part';
      rows.push(`${n} ${PART_NAME[cls] || cls} ${Math.round(pr.h)}`);
    });
    addLegend(canvas, r, rows);
    vk()?.layout?.();
  }

  /* ------------------------------------------------------------- 导航 */

  function go(delta) {
    const to = delta < 0 ? document.body.dataset.prev : document.body.dataset.next;
    if (to) location.href = to;
  }

  /* ------------------------------------------------------------- 启动 */

  function boot() {
    rememberBase();
    for (const tag of $$('[data-attr]')) markControl(tag.dataset.attr);
    const hash = location.hash.replace(/^#/, '');
    if (docPages().length) {
      const m = hash.match(/^p(\d+)$/);
      showDocPage(m ? Number(m[1]) - 1 : 0, false);
    } else {
      showLens(hash || 'plate', false);
    }

    document.addEventListener('click', (e) => {
      const preset = e.target.closest('[data-preset]');
      if (preset) {
        e.preventDefault();
        applyPreset(Number(preset.dataset.preset));
        return;
      }
      const control = e.target.closest('[data-attr]');
      if (control) {
        e.preventDefault();
        applyControl(control.dataset.attr, control.dataset.value);
        return;
      }
      const copy = e.target.closest('[data-copy]');
      if (copy) {
        e.preventDefault();
        copySnippet(copy);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (docPages().length) return;
        location.href = 'index.html';
        return;
      }
      if (/^[1-5]$/.test(e.key) && !docPages().length) {
        e.preventDefault();
        showLens(LENSES[Number(e.key) - 1]);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (docPages().length) {
          e.preventDefault();
          showDocPage(docPage + dir);
        } else if ($('[data-lens="api"]') && !$('[data-lens="api"]').hidden) {
          e.preventDefault();
          updateApiPage(apiPage + dir);
        } else {
          e.preventDefault();
          go(dir);
        }
        return;
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        go(e.key === ']' ? 1 : -1);
      }
    });

    window.addEventListener('hashchange', () => {
      const h = location.hash.replace(/^#/, '');
      if (docPages().length) {
        const m = h.match(/^p(\d+)$/);
        if (m) showDocPage(Number(m[1]) - 1, false);
      } else if (LENSES.includes(h)) {
        showLens(h, false);
      }
    });
  }

  // vk.ready 之后再量；否则字体/预编译数据可能还没到位。
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  const ready = () => vk()?.ready?.();
  Promise.resolve().then(ready).then(() => {
    if (document.body.dataset.page === 'specimen' && !$('[data-lens="anatomy"]')?.hidden) {
      requestAnimationFrame(buildAnatomy);
    }
  });
})();
