/* vk · 展示站交互
   只做四件事：搜索、复制、组件预览的 preset tabs、文档 TOC。
   没有 router，没有 workbench，没有自由属性面板。 */
(() => {
  const base = document.documentElement.dataset.base || '';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ------------------------------------------------------------ toast / copy */

  let toastTimer = 0;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('is-on'), 1800);
  }

  async function copyText(text, okMessage = '已复制') {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMessage);
      return true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (ok) {
          toast(okMessage);
          return true;
        }
      } catch {
        /* 继续报错 */
      }
      toast('复制失败：浏览器拒绝了剪贴板请求');
      return false;
    }
  }

  /* ---------------------------------------------------------------- 搜索 */

  const searchData = window.VK_SEARCH || { components: [], examples: [], docs: [] };
  const searchInput = $('#siteSearch');
  const searchPop = $('#searchPop');
  const groups = [
    ['components', '组件'],
    ['examples', '示例'],
    ['docs', '文档'],
  ];
  const searchItems = [];
  for (const [kind, label] of groups) {
    for (const item of searchData[kind] || []) {
      searchItems.push({
        kind,
        kindLabel: label,
        title: item.name || item.title || '',
        sub: item.summary || item.note || '',
        tag: item.tag || item.no || '',
        href: item.href || '',
        hay: [item.name, item.title, item.tag, item.no, item.summary, item.note, item.keywords]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      });
    }
  }

  let searchHits = [];
  let searchActive = -1;

  function findItems(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const item of searchItems) {
      let score = 0;
      for (const term of terms) {
        if (!item.hay.includes(term)) {
          score = -1;
          break;
        }
        if (item.title.toLowerCase() === term) score += 12;
        else if (item.title.toLowerCase().startsWith(term)) score += 8;
        else if (item.title.toLowerCase().includes(term)) score += 5;
        if (item.tag.toLowerCase() === term) score += 7;
        else if (item.tag.toLowerCase().includes(term)) score += 3;
        score += 1;
      }
      if (score >= 0) scored.push([score, item]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title, 'zh'));
    return scored.slice(0, 9).map((entry) => entry[1]);
  }

  function closeSearch() {
    if (!searchPop) return;
    searchPop.hidden = true;
    searchActive = -1;
  }

  function go(href) {
    if (href) location.href = base + href;
  }

  function renderSearch(query) {
    if (!searchPop || !searchInput) return;
    if (!query.trim()) {
      closeSearch();
      return;
    }
    searchHits = findItems(query);
    searchActive = searchHits.length ? 0 : -1;
    const byKind = new Map();
    for (const item of searchHits) {
      if (!byKind.has(item.kind)) byKind.set(item.kind, []);
      byKind.get(item.kind).push(item);
    }
    if (!searchHits.length) {
      searchPop.innerHTML = `<div class="search-empty">没有匹配“${escapeHtml(query.trim())}”。试试标签名、名称或“代码”。</div>`;
    } else {
      let index = -1;
      searchPop.innerHTML = groups
        .filter(([kind]) => byKind.has(kind))
        .map(([kind, label]) => {
          const hits = byKind
            .get(kind)
            .map((item) => {
              index += 1;
              return `<button type="button" class="search-hit" data-href="${escapeAttr(item.href)}" data-index="${index}">
                <b>${item.tag ? `<em>${escapeHtml(item.tag)}</em>` : ''}${escapeHtml(item.title)}</b>
                <span>${escapeHtml(item.sub)}</span>
              </button>`;
            })
            .join('');
          return `<div class="search-group">${label}</div>${hits}`;
        })
        .join('');
    }
    searchPop.hidden = false;
    paintSearchActive();
  }

  function paintSearchActive() {
    if (!searchPop) return;
    for (const hit of $$('.search-hit', searchPop)) {
      hit.dataset.active = Number(hit.dataset.index) === searchActive ? '1' : '0';
    }
    const active = searchPop.querySelector('.search-hit[data-active="1"]');
    if (active && searchPop.scrollHeight > searchPop.clientHeight) {
      const top = active.offsetTop;
      const bottom = top + active.offsetHeight;
      if (top < searchPop.scrollTop) searchPop.scrollTop = top - 6;
      else if (bottom > searchPop.scrollTop + searchPop.clientHeight) {
        searchPop.scrollTop = bottom - searchPop.clientHeight + 6;
      }
    }
  }

  if (searchInput && searchPop) {
    searchInput.addEventListener('input', () => {
      renderSearch(searchInput.value);
      filterComponents(searchInput.value);
    });
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) renderSearch(searchInput.value);
    });
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeSearch();
        searchInput.blur();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!searchHits.length) return;
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        searchActive = (searchActive + delta + searchHits.length) % searchHits.length;
        paintSearchActive();
        return;
      }
      if (event.key === 'Enter') {
        if (!searchHits.length) return;
        event.preventDefault();
        go(searchHits[Math.max(0, searchActive)].href);
      }
    });
    searchPop.addEventListener('click', (event) => {
      const hit = event.target.closest('[data-href]');
      if (hit) go(hit.dataset.href);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.searchbox')) closeSearch();
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const el = event.target;
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    if (event.key === '/' && !typing && searchInput) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  /* ------------------------------------------------------------- 组件索引过滤 */

  const filterGrid = $('[data-filter-grid]');
  const cardItems = filterGrid ? $$('[data-search-item]', filterGrid) : [];
  const layerGroups = filterGrid ? $$('[data-layer-group]', filterGrid) : [];
  const emptyNote = $('#searchEmpty');
  const countNote = $('#searchCount');

  function filterComponents(query) {
    if (!filterGrid) return;
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const card of cardItems) {
      const hay = card.dataset.searchItem || '';
      const match = !q || hay.includes(q);
      card.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of layerGroups) {
      group.hidden = !$$('[data-search-item]', group).some((card) => !card.hidden);
    }
    if (emptyNote) emptyNote.hidden = shown !== 0;
    if (countNote) countNote.textContent = q ? `${shown} / ${cardItems.length}` : `${cardItems.length} 个标签`;
  }

  const indexSearch = $('#indexSearch');
  if (indexSearch) {
    indexSearch.addEventListener('input', () => {
      filterComponents(indexSearch.value);
      if (searchInput) searchInput.value = indexSearch.value;
    });
  }

  /* ---------------------------------------------------------------- 复制 */

  function sourceText() {
    const el = $('#specSource');
    if (!el) return '';
    try {
      return JSON.parse(el.textContent).source || '';
    } catch {
      return '';
    }
  }

  function presetData() {
    const el = $('#presets');
    if (!el) return [];
    try {
      return JSON.parse(el.textContent);
    } catch {
      return [];
    }
  }

  let currentPreset = 0;

  function variantHtml() {
    const raw = sourceText();
    if (currentPreset <= 0) return raw;
    const presets = presetData();
    const preset = presets[currentPreset];
    if (!preset) return raw;
    const tag = $('[data-preview-tag]')?.dataset.previewTag || '';
    if (!tag) return raw;
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const targets = [...doc.body.querySelectorAll(tag)];
    if (!targets.length) return raw;
    for (const target of targets) {
      for (const [name, value] of Object.entries(preset.attrs || {})) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, String(value));
      }
    }
    return doc.body.innerHTML.trim();
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-copy]');
    if (trigger) {
      event.preventDefault();
      const selector = trigger.dataset.copyTarget;
      const target = selector ? $(selector) : null;
      const text = target ? target.textContent.trim() : trigger.dataset.copyValue || '';
      copyText(text, trigger.dataset.copyMessage || '已复制');
      return;
    }

    const mode = event.target.closest('[data-copy-mode]');
    if (mode) {
      event.preventDefault();
      const kind = mode.dataset.copyMode;
      copyText(kind === 'source' ? sourceText() : variantHtml(), kind === 'source' ? '已复制原始片段' : '已复制当前变体');
      closeCopyMenu();
      return;
    }

    const main = event.target.closest('#copyMain');
    if (main) {
      event.preventDefault();
      copyText(variantHtml(), '已复制当前变体');
      closeCopyMenu();
      return;
    }

    const caret = event.target.closest('#copyCaret');
    if (caret) {
      event.preventDefault();
      const menu = $('#copyMenu');
      if (menu) {
        const open = menu.hidden;
        menu.hidden = !open;
        caret.setAttribute('aria-expanded', String(open));
      }
      return;
    }

    if (!event.target.closest('.copy-split')) closeCopyMenu();
  });

  function closeCopyMenu() {
    const menu = $('#copyMenu');
    const caret = $('#copyCaret');
    if (menu) menu.hidden = true;
    if (caret) caret.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------- 组件预览 + preset */

  const previewFrame = $('#previewFrame');
  const previewStage = $('#previewStage');

  if (previewFrame && previewStage) {
    const tag = previewStage.dataset.previewTag || previewFrame.dataset.previewTag || '';
    const tabs = $$('[data-preset]');
    const presets = presetData();
    let baseEls = null;

    const fit = () => {
      const width = previewStage.clientWidth;
      if (!width) return;
      const scale = width / 1920;
      previewFrame.style.transform = `scale(${scale})`;
      const label = $('#previewScale');
      if (label) label.textContent = `${Math.round(scale * 100)}%`;
    };

    const capture = () => {
      const doc = previewFrame.contentDocument;
      const roots = doc && tag ? [...doc.querySelectorAll(tag)] : [];
      quietStale(doc);
      baseEls = roots.length
        ? roots.map((root) => ({ root, attrs: new Map([...root.attributes].map((attr) => [attr.name, attr.value])) }))
        : null;
      return !!baseEls;
    };

    // 展示站不展示构建期的 stale 角标：它是作者构建门禁的信号，不是公开预览的一部分。
    const quietStale = (doc) => {
      if (!doc || !doc.head || doc.getElementById('vk-site-preview-style')) return;
      const style = doc.createElement('style');
      style.id = 'vk-site-preview-style';
      style.textContent = '[data-vk-stale]::after{display:none!important}';
      doc.head.append(style);
    };

    const apply = (index) => {
      if (!baseEls && !capture()) return;
      const attrs = presets[index]?.attrs || {};
      for (const { root, attrs: base } of baseEls) {
        for (const name of root.getAttributeNames()) {
          if (!base.has(name)) root.removeAttribute(name);
        }
        for (const [name, value] of base) root.setAttribute(name, value);
        for (const [name, value] of Object.entries(attrs)) {
          if (value === null) root.removeAttribute(name);
          else root.setAttribute(name, String(value));
        }
      }
      try {
        previewFrame.contentWindow.vk?.layout?.();
      } catch {
        /* 预览文档跨域或尚未就绪：保持当前画面 */
      }
    };

    const select = (index, focus = false) => {
      currentPreset = index;
      for (const tab of tabs) {
        const on = Number(tab.dataset.preset) === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      }
      apply(index);
    };

    for (const tab of tabs) {
      tab.addEventListener('click', () => select(Number(tab.dataset.preset)));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const next = (Number(tab.dataset.preset) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(next, true);
      });
    }

    previewFrame.addEventListener('load', () => {
      capture();
      fit();
      select(currentPreset);
      try {
        previewFrame.contentWindow.vk?.freeze?.();
      } catch {
        /* 忽略 */
      }
    });

    try {
      if (previewFrame.contentDocument?.readyState === 'complete') {
        capture();
        fit();
        select(currentPreset);
      }
    } catch {
      /* 等 load */
    }

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(fit).observe(previewStage);
    } else {
      addEventListener('resize', fit);
    }
    addEventListener('resize', fit);

    const win = previewFrame.contentWindow;
    const ready = win?.vk?.ready?.();
    if (ready && typeof ready.then === 'function') {
      ready.then(() => {
        capture();
        fit();
        apply(currentPreset);
        win?.vk?.freeze?.();
      });
    }
  }

  /* ---------------------------------------------------------------- TOC */

  const toc = $('[data-toc]');
  if (toc) {
    const links = $$('a[href^="#"]', toc);
    const pairs = links
      .map((link) => {
        const id = decodeURIComponent(link.getAttribute('href').slice(1));
        const target = id ? document.getElementById(id) : null;
        return target ? { link, target } : null;
      })
      .filter(Boolean);

    let ticking = false;
    const spy = () => {
      ticking = false;
      if (!pairs.length) return;
      let current = pairs[0];
      for (const pair of pairs) {
        if (pair.target.getBoundingClientRect().top <= 128) current = pair;
      }
      for (const pair of pairs) pair.link.setAttribute('aria-current', pair === current ? 'true' : 'false');
    };
    const requestSpy = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(spy);
    };
    addEventListener('scroll', requestSpy, { passive: true });
    addEventListener('resize', requestSpy);
    spy();
  }

  /* ------------------------------------------------------------- 代码块滚动 */

  for (const block of $$('.codeblock pre')) {
    block.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const delta = event.key === 'ArrowRight' ? 48 : -48;
        if (block.scrollWidth > block.clientWidth) {
          event.preventDefault();
          block.scrollLeft += delta;
        }
      }
    });
  }
})();
