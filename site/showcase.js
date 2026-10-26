/* vk 标本册 · 显示引擎
   只做四件事：镜头切换、变体现场改、解剖量测、页码。
   不写样式；帧内可见元素全部是 vk 组件。 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const vk = () => window.vk;
  const page = $('vk-page');

  const LENSES = ['plate', 'variants', 'anatomy', 'usage', 'api'];

  // 镜头的 id 与 hash 同名；浏览器会滚到 section，把页眉页脚顶出画布。
  function resetScroll() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    for (const el of $$('.vk-page, vk-page')) el.scrollTop = 0;
  }

  /* ------------------------------------------------------------- 镜头 */

  function prefixIds(root, lens) {
    const map = new Map();
    for (const el of $$('[id]', root)) {
      const old = el.id;
      if (!old) continue;
      const id = `${lens}-${old}`;
      map.set(old, id);
      el.id = id;
    }
    for (const el of $$('[from], [to], [for]', root)) {
      for (const attr of ['from', 'to', 'for']) {
        const v = el.getAttribute(attr);
        if (v && v.startsWith('#') && map.has(v.slice(1))) el.setAttribute(attr, `#${map.get(v.slice(1))}`);
      }
    }
  }

  function showLens(name, push = true) {
    const lens = LENSES.includes(name) ? name : 'plate';
    for (const section of $$('[data-lens]')) {
      const on = section.dataset.lens === lens;
      if (on && section.dataset.filled !== '1') {
        const tpl = $(`template[data-lens-template="${lens}"]`);
        if (tpl) {
          const clone = tpl.content.cloneNode(true);
          prefixIds(clone, lens);
          section.append(clone);
          section.dataset.filled = '1';
        }
      }
      section.hidden = !on;
    }
    for (const tag of $$('[data-lens-tag]')) {
      const on = tag.dataset.lensTag === lens;
      if (on) tag.setAttribute('state', 'selected'); else tag.removeAttribute('state');
      tag.setAttribute('tone', 'muted');
      tag.setAttribute('aria-selected', String(on));
      tag.closest('a')?.setAttribute('aria-selected', String(on));
    }
    if (push && location.hash !== `#${lens}`) history.pushState(null, '', `#${lens}`);
    resetScroll();
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
    for (const tag of $$('[data-preset]')) {
      const on = Number(tag.dataset.preset) === index;
      tag.setAttribute('tone', 'muted');
      tag.setAttribute('aria-pressed', String(on));
      if (on) tag.setAttribute('state', 'selected');
      else tag.removeAttribute('state');
    }
    for (const tag of $$('[data-attr]')) markControl(tag.dataset.attr);
    vk()?.layout?.();
  }

  function markControl(name) {
    const t = target();
    if (!t) return;
    const now = t.getAttribute(name);
    for (const tag of $$(`[data-attr="${name}"]`)) {
      const on = tag.dataset.value === now;
      tag.setAttribute('tone', 'muted');
      tag.setAttribute('aria-pressed', String(on));
      if (on) tag.setAttribute('state', 'selected');
      else tag.removeAttribute('state');
    }
  }

  function applyControl(name, value) {
    const t = target();
    if (!t) return;
    rememberBase();
    t.setAttribute(name, value);
    for (const p of $$('[data-preset]')) {
      p.setAttribute('tone', 'muted');
      p.setAttribute('aria-pressed', 'false');
      p.removeAttribute('state');
    }
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
    for (const tag of $$('[data-docpage-tag]')) {
      const on = Number(tag.dataset.docpageTag) === docPage;
      if (on) tag.setAttribute('state', 'selected'); else tag.removeAttribute('state');
      tag.setAttribute('tone', 'muted');
      tag.setAttribute('aria-current', on ? 'page' : 'false');
    }
    if (push && location.hash !== `#p${docPage + 1}`) history.pushState(null, '', `#p${docPage + 1}`);
    resetScroll();
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
    ft: '页脚',
  };

  function addChip(canvas, index) {
    const chip = document.createElement('vk-tag');
    chip.id = `anno-${index}`;
    chip.setAttribute('size', 'meta');
    chip.setAttribute('tone', 'accent');
    chip.setAttribute('x', '0');
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
    // 宽目标放不下右栏图例：改成目标下方的一条横向图例带，像制图的 key。
    const wide = r.x + r.w + 40 + 340 > 1680;
    const box = document.createElement('vk-box');
    box.setAttribute('x', '120');
    box.setAttribute('y', wide ? String(Math.min(888 - 84, r.y + r.h + 4)) : '80');
    box.setAttribute('w', wide ? '1400' : '340');
    if (wide) box.setAttribute('h', '80');
    box.setAttribute('surface', 'paper');
    box.setAttribute('border', 'hair');
    box.setAttribute('pad', wide ? 'xs' : 'sm');
    box.setAttribute('radius', 'md');
    box.setAttribute('data-anno', '');
    box.style.zIndex = '5';
    const title = document.createElement('vk-text');
    title.setAttribute('size', 'meta');
    title.setAttribute('weight', wide ? 'medium' : 'bold');
    title.textContent = '解剖';
    const dim = document.createElement('vk-text');
    dim.setAttribute('size', 'meta');
    dim.setAttribute('mono', '');
    dim.setAttribute('emphasis', 'muted');
    dim.textContent = `${Math.round(r.w)}×${Math.round(r.h)}`;
    const list = document.createElement(wide ? 'vk-row' : 'vk-stack');
    list.setAttribute('gap', wide ? 'md' : '2xs');
    if (wide) list.setAttribute('align', 'center');
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
    // 嵌套页面的页眉/页脚是运行时创建的，补一次显式 part。
    if (t.tagName === 'VK-PAGE') {
      for (const [sel, key] of [['.vk-page-hd', 'hd'], ['.vk-page-bd', 'bd'], ['.vk-page-ft', 'ft']]) {
        const el = t.querySelector(sel);
        if (el && !el.dataset.vkPart) el.dataset.vkPart = key;
      }
    }
    const parts = [];
    const seen = new Set();
    for (const p of $$('[data-vk-part]', t)) {
      const key = p.dataset.vkPart;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      parts.push(p);
    }
    const rows = [];
    parts.slice(0, 4).forEach((p) => {
      const pr = designRect(p, canvas);
      if (pr.w < 80 || pr.h < 48 || pr.x < 0 || pr.y < 0 || pr.x + pr.w > 1680 || pr.y + pr.h > 888) return;
      const n = rows.length + 1;
      p.id = `part-${n}`;
      addBox(canvas, pr);
      addChip(canvas, n);
      const key = p.dataset.vkPart;
      rows.push(`${n} ${PART_NAME[key] || key} ${Math.round(pr.h)}`);
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
      const lensLink = e.target.closest('[data-lens-link]');
      if (lensLink) {
        e.preventDefault();
        showLens(lensLink.hash.replace(/^#/, ''));
        return;
      }
      const docLink = e.target.closest('[data-docpage-tag]')?.closest('a');
      if (docLink) {
        e.preventDefault();
        showDocPage(Number(docLink.hash.replace(/^#p/, '')) - 1);
        return;
      }
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
      const actionable = e.target.closest?.('[data-preset], [data-attr], [data-copy]');
      if (actionable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        actionable.click();
        return;
      }
      if (e.key === 'Escape') {
        if (docPages().length) return;
        location.href = new URL('../index.html', location.href).href;
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

    const onHash = () => {
      const h = location.hash.replace(/^#/, '');
      if (docPages().length) {
        const m = h.match(/^p(\d+)$/);
        if (m) showDocPage(Number(m[1]) - 1, false);
      } else if (LENSES.includes(h)) {
        showLens(h, false);
      }
      resetScroll();
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    setTimeout(resetScroll, 60);
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
