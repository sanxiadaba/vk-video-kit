import { esc, dedent, textSource, precompiledSource, numAttr, hash32, safePosition, VkElement, define, plain, takeSlot, fillSlot } from './base.mjs';
import { iconOf } from './icons.mjs';
import { win } from './window.mjs';

/* ------------------------------------------------------------------ title */

export class VkTitle extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-title-main';
  static renderedRoot = '.vk-title';

  capture() {}

  render() {
    const index = this.getAttribute('index') || '';
    const eyebrow = this.getAttribute('eyebrow') || '';
    const sub = this.getAttribute('sub') || '';
    const size = this.getAttribute('size') || 'title';
    const align = this.getAttribute('align') || 'left';

    if (!this._shell) {
      this._eyebrowSlot = this.querySelector(':scope > [slot="eyebrow"]');
      this._subSlot = this.querySelector(':scope > [slot="sub"]');
      this._eyebrowSlot?.remove();
      this._subSlot?.remove();
      const body = takeSlot(this);
      this.innerHTML = `<div class="vk-title" data-align="left" data-size="title">
        <div class="vk-eyebrow"><b></b><i></i><span class="vk-eyebrow-t"></span></div>
        <div class="vk-title-main"></div>
        <p class="vk-title-sub"></p>
      </div>`;
      this._shell = this.querySelector('.vk-title');
      this._eyebrow = this.querySelector('.vk-eyebrow');
      this._eyebrowB = this._eyebrow.querySelector('b');
      this._eyebrowI = this._eyebrow.querySelector('i');
      this._eyebrowT = this._eyebrow.querySelector('.vk-eyebrow-t');
      this._main = this.querySelector('.vk-title-main');
      this._sub = this.querySelector('.vk-title-sub');
      fillSlot(this._main, body);
    }

    const level = ['1', '2', '3'].includes(this.getAttribute('level')) ? this.getAttribute('level') : '2';
    this._main?.setAttribute('role', 'heading');
    this._main?.setAttribute('aria-level', level);
    this._shell.dataset.align = align;
    this._shell.dataset.size = size;

    const showEyebrow = !!(index || eyebrow || this._eyebrowSlot);
    if (showEyebrow) {
      if (!this._eyebrow.parentNode) this._shell.prepend(this._eyebrow);
      this._eyebrowB.textContent = index;
      this._eyebrowB.style.display = index ? '' : 'none';
      this._eyebrowI.style.display = index && (eyebrow || this._eyebrowSlot) ? '' : 'none';
      if (this._eyebrowSlot) this._eyebrowT.replaceChildren(this._eyebrowSlot);
      else this._eyebrowT.textContent = eyebrow;
    } else {
      this._eyebrow.remove();
    }

    if (sub || this._subSlot) {
      if (!this._sub.parentNode) this._shell.append(this._sub);
      if (this._subSlot) this._sub.replaceChildren(this._subSlot);
      else this._sub.textContent = sub;
    } else {
      this._sub.remove();
    }
  }
}

/* ------------------------------------------------------------------- list */

export class VkList extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-list';

  capture() {
    // 保留 <li> 上的 id / class / data-*：for="#id" 的标注与 [data-current] 都靠它。
    this._items = [...this.querySelectorAll(':scope > li')].map((li) => ({
      attrs: [...li.attributes].map((a) => [a.name, a.value]),
      nodes: [...li.childNodes],
    }));
  }

  render() {
    const variant = this.getAttribute('variant') || 'bullet';
    const ordered = variant === 'ordered';
    const rule = this.hasAttribute('rule');
    const bare = this.hasAttribute('bare');
    const mode = variant === 'ordered' ? 'bullet' : variant;
    const ul = document.createElement(ordered ? 'ol' : 'ul');
    ul.className = 'vk-list';
    ul.dataset.mode = mode;
    if (ordered) ul.dataset.ordered = '';
    if (rule) ul.dataset.rule = '';
    if (bare) ul.dataset.bare = '';
    for (const it of this._items || []) {
      const li = document.createElement('li');
      for (const [n, v] of it.attrs || []) {
        try {
          li.setAttribute(n, v);
        } catch {
          /* 非法属性名不阻塞整块渲染 */
        }
      }
      if (mode === 'define') {
        const nodes = it.nodes || [];
        const termIdx = nodes.findIndex((n) => n.nodeType === 1 && n.tagName === 'B');
        if (termIdx >= 0) {
          const term = nodes[termIdx];
          const desc = document.createElement('span');
          desc.className = 'vk-li-d';
          nodes.forEach((n, i) => {
            if (i !== termIdx) desc.append(n);
          });
          li.append(term, desc);
        } else {
          const body = document.createElement('span');
          body.className = 'vk-li-b';
          for (const n of nodes) body.append(n);
          li.append(body);
        }
      } else {
        const body = document.createElement('span');
        body.className = 'vk-li-b';
        for (const n of it.nodes || []) body.append(n);
        li.append(body);
      }
      ul.append(li);
    }
    this.replaceChildren(ul);
  }
}

/* -------------------------------------------------------------- callout */

const CALLOUT_ICON = { accent: 'info', ok: 'circle-check', warn: 'triangle-alert', err: 'circle-x' };

export class VkCallout extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-callout-bd';
  static renderedRoot = '.vk-callout';

  capture() {}

  render() {
    this.setAttribute('role', 'note');
    const tone = this.getAttribute('tone') || 'accent';
    const title = this.getAttribute('title') || '';
    const flat = this.hasAttribute('flat');

    if (!this._shell) {
      this._titleSlot = this.querySelector(':scope > [slot="title"]');
      this._titleSlot?.remove();
      const body = takeSlot(this);
      this.innerHTML = `<div class="vk-callout" data-tone="accent">
        <div class="vk-callout-hd">
          <svg class="vk-ic" viewBox="0 0 24 24" aria-hidden="true"></svg>
          <span class="vk-callout-t"></span>
        </div>
        <div class="vk-callout-bd"></div>
      </div>`;
      this._shell = this.querySelector('.vk-callout');
      this._icon = this.querySelector('.vk-ic');
      this._title = this.querySelector('.vk-callout-t');
      this._body = this.querySelector('.vk-callout-bd');
      fillSlot(this._body, body);
    }

    this._shell.dataset.tone = tone;
    if (flat) this._shell.dataset.flat = '';
    else delete this._shell.dataset.flat;
    this._icon.innerHTML = iconOf(CALLOUT_ICON[tone] || 'info');
    if (title || this._titleSlot) {
      if (this._titleSlot) this._title.replaceChildren(this._titleSlot);
      else this._title.textContent = title;
      this._title.style.display = '';
      delete this._shell.dataset.title;
    } else {
      this._title.textContent = '';
      this._title.style.display = 'none';
      this._shell.dataset.title = 'none';
    }
  }
}

/* ----------------------------------------------------------------- figure */

export class VkFigure extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-fig-slot';
  static renderedRoot = '.vk-win';

  render() {
    const src = this.getAttribute('src') || '';
    const alt = this.getAttribute('alt') || '';
    const caption = this.getAttribute('caption') || '';
    const fig = this.getAttribute('fig') || '';
    const url = this.getAttribute('url') || '';
    const ratioRaw = this.getAttribute('ratio') || '16 / 9';
    const rm = ratioRaw.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    const ratio = rm && Number(rm[1]) / Number(rm[2]) >= 0.4 && Number(rm[1]) / Number(rm[2]) <= 4 ? ratioRaw : '16 / 9';
    if (ratio !== ratioRaw) this._warnOnce('ratio', `的 ratio="${ratioRaw}" 不合法，按 16 / 9 处理`);
    const fit = this.getAttribute('fit') || 'cover';
    const focus = safePosition(this.getAttribute('position') || '50% 50%');
    const chrome = this.getAttribute('chrome') || 'min';
    const bare = this.hasAttribute('bare');
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';

    if (!this._shell) {
      this._captionSlot = this.querySelector(':scope > figcaption');
      this._captionSlot?.remove();
      const body = takeSlot(this);
      this.innerHTML = win({
        surface,
        chrome: 'min',
        cls: 'vk-fig-win',
        attrs: ' role="figure"',
        head: '<b class="vk-fig-fig"></b>',
        inner: `<div class="vk-fig-body"><div class="vk-fig-slot"></div><div class="vk-fig-ph" aria-hidden="true">图未加载</div></div><figcaption class="vk-fig-caption"></figcaption><div class="vk-fig-url"></div>`,
      });
      this._shell = this.querySelector('.vk-win');
      this._hd = this.querySelector('.vk-hd');
      this._fig = this.querySelector('.vk-fig-fig');
      this._cap = this.querySelector('.vk-fig-caption');
      this._body = this.querySelector('.vk-fig-body');
      this._slot = this.querySelector('.vk-fig-slot');
      this._ph = this.querySelector('.vk-fig-ph');
      this._url = this.querySelector('.vk-fig-url');
      fillSlot(this._slot, body);
    }

    this._shell.dataset.chrome = bare ? 'none' : chrome;
    this._shell.dataset.material = surface;
    if (surface === 'ink') this._shell.dataset.surface = 'ink';
    else delete this._shell.dataset.surface;
    if (bare) this._shell.dataset.bare = '';
    else delete this._shell.dataset.bare;

    this._fig.textContent = fig ? `FIG ${fig}` : '';
    this._fig.style.display = fig ? '' : 'none';
    if (this._captionSlot) this._cap.replaceChildren(...this._captionSlot.childNodes);
    else this._cap.textContent = caption;
    this._cap.style.display = caption || this._captionSlot ? '' : 'none';
    this._body.style.aspectRatio = ratio;
    this._shell.setAttribute('role', 'figure');
    const label = caption || alt || '';
    if (label) this._shell.setAttribute('aria-label', label);
    else this._shell.removeAttribute('aria-label');

    if (src) {
      if (!this._img) {
        this._img = document.createElement('vk-img');
        this._img.className = 'vk-fig-img';
        this._body.insertBefore(this._img, this._slot);
        this._bindImg();
      }
      this._img.setAttribute('src', src);
      this._img.setAttribute('alt', alt);
      this._img.setAttribute('fit', fit);
      this._img.setAttribute('position', focus);
      if (this._img.hasAttribute('data-error')) this._shell.setAttribute('data-error', '');
    } else if (this._img) {
      this._img.remove();
      this._img = null;
      this._shell.removeAttribute('data-error');
    }
    if (src) this._shell.removeAttribute('data-empty');
    else this._shell.setAttribute('data-empty', '');
    this._ph.textContent = this._shell.hasAttribute('data-error')
      ? '图未加载 · 检查路径'
      : src ? '图未加载' : '还没有图片';

    if (url) {
      this._url.textContent = url;
      this._url.style.display = '';
    } else {
      this._url.textContent = '';
      this._url.style.display = 'none';
    }

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1680, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '100%';
  }

  _bindImg() {
    if (!this._img || this._img._vkFigureBound) return;
    this._img._vkFigureBound = true;
    const setPh = () => {
      if (!this._ph) return;
      this._ph.textContent = this._shell?.hasAttribute('data-error')
        ? '图未加载 · 检查路径'
        : this.hasAttribute('src') ? '图未加载' : '还没有图片';
    };
    this._img.addEventListener('vk:img-error', () => { this._shell?.setAttribute('data-error', ''); setPh(); });
    this._img.addEventListener('vk:img-load', () => { this._shell?.removeAttribute('data-error'); setPh(); });
  }
}

/* ---------------------------------------------------------------- browser */

export class VkBrowser extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-br-body';
  static renderedRoot = '.vk-br';

  capture() {}

  render() {
    const url = this.getAttribute('url') || '';
    const chrome = this.getAttribute('chrome') || 'min';
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';

    if (!this._shell) {
      const body = takeSlot(this);
      this.innerHTML = win({
        surface,
        chrome: 'min',
        cls: 'vk-br',
        head: '<span class="vk-br-url"><b class="vk-br-host"></b><span class="vk-br-path"></span></span>',
        inner: '<div class="vk-br-body"></div>',
      });
      this._shell = this.querySelector('.vk-win');
      this._host = this.querySelector('.vk-br-host');
      this._path = this.querySelector('.vk-br-path');
      this._body = this.querySelector('.vk-br-body');
      fillSlot(this._body, body);
    }

    this._shell.dataset.chrome = chrome;
    this._shell.dataset.material = surface;
    if (surface === 'ink') this._shell.dataset.surface = 'ink';
    else delete this._shell.dataset.surface;
    this._shell.setAttribute('role', 'region');
    if (url) this._shell.setAttribute('aria-label', `浏览器 · ${url}`);
    else this._shell.removeAttribute('aria-label');

    // 只突出"在哪"：域名是主体，路径淡化；解析失败也不把整段 URL 塞进 host。
    let host = '';
    let path = '';
    if (url) {
      try {
        const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `http://${url}`);
        host = u.host;
        path = u.pathname + u.search + u.hash;
      } catch {
        host = url;
      }
    }
    this._host.textContent = host || '未设置地址';
    this._host.classList.toggle('is-empty', !host);
    this._path.textContent = path;
    this._path.style.display = path ? '' : 'none';

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1680, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '100%';
  }
}

/* --------------------------------------------------------------- filetree */

const FILE_ICON = {
  py: 'file-code', c: 'file-code', h: 'file-code', cpp: 'file-code', js: 'file-code', mjs: 'file-code', cjs: 'file-code',
  ts: 'file-code', jsx: 'file-code', tsx: 'file-code', html: 'file-code', css: 'file-code',
  json: 'file-json', md: 'file-text', txt: 'file-text', yml: 'file-text', yaml: 'file-text', toml: 'file-text',
  sh: 'file-terminal', bash: 'file-terminal', zsh: 'file-terminal',
};

export class VkFiletree extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-tree';

  capture() {
    this._preSrc = precompiledSource(this);
    const tree = this.querySelector(':scope > script[data-vk-tree]');
    this._tree = null;
    if (tree) {
      try {
        const data = JSON.parse(tree.textContent);
        if (data && Array.isArray(data.entries)) this._tree = data;
      } catch {
        /* 损坏的树数据按缺失处理 */
      }
    }
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-tree], script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    if (this.getAttribute('src') && !this._tree && !this._src.trim()) this.stale('缺少预编译文件树');
  }

  _inlineEntries() {
    return (this._src || '')
      .split('\n')
      .filter((l) => l.trim())
      .map((raw) => {
        const lead = (raw.match(/^ */) || [''])[0].length;
        let name = raw.trim();
        let flag = '';
        if (name.startsWith('+ ')) {
          flag = 'add';
          name = name.slice(2);
        } else if (name.startsWith('* ')) {
          flag = 'mod';
          name = name.slice(2);
        } else if (name.startsWith('- ')) {
          flag = 'del';
          name = name.slice(2);
        }
        const isDir = name.endsWith('/');
        const clean = isDir ? name.slice(0, -1) : name;
        return {
          name: clean,
          path: clean,
          depth: Math.floor(lead / 2),
          type: isDir ? 'dir' : 'file',
          ext: clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : '',
          size: 0,
          flag,
        };
      });
  }

  render() {
    const title = this.getAttribute('title') || '';
    const current = this.getAttribute('active') || '';
    const maxDepth = this.hasAttribute('depth')
      ? Math.min(8, Math.max(0, parseInt(this.getAttribute('depth'), 10) || 0))
      : 4;
    const allEntries = (this._tree?.entries || this._inlineEntries()).filter(
      (entry) => !Number.isFinite(maxDepth) || entry.depth <= maxDepth
    );
    const fold = new Set(
      (this.getAttribute('collapsed') || '')
        .split(',')
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    );
    const entries = allEntries.filter((entry) => ![...fold].some((dir) => entry.path.startsWith(dir + '/')));
    const files = allEntries.filter((e) => e.type !== 'dir').length;
    const dirs = allEntries.filter((e) => e.type === 'dir').length;
    const root = this._tree?.root || '';
    const truncated = !!this._tree?.truncated;
    const limit = this.hasAttribute('limit') ? Math.min(500, Math.max(1, parseInt(this.getAttribute('limit'), 10) || 1)) : 14;
    const top = entries.filter((e) => e.depth === 0);
    let shownTop = top.slice(0, limit);
    if (current) {
      const hit = entries.find((e) => e.path === current || e.name === current);
      const hitTop = hit ? top.find((t) => hit.path === t.path || hit.path.startsWith(t.path + '/')) : null;
      if (hitTop && !shownTop.includes(hitTop)) shownTop = [...shownTop.slice(0, Math.max(0, limit - 1)), hitTop];
    }
    const shown = entries.filter((e) => shownTop.some((t) => e === t || e.path.startsWith(t.path + '/')));
    const hidden = entries.length - shown.length + (truncated ? 1 : 0);
    const roots = [];
    const stack = [];
    for (const entry of shown) {
      const node = { entry, children: [] };
      while (stack.length && stack[stack.length - 1].entry.depth >= entry.depth) stack.pop();
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
    }

    const bytes = (n) => {
      if (!n) return '';
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
      return (n / 1024 / 1024).toFixed(1) + ' MB';
    };

    const renderNode = (node) => {
      const entry = node.entry;
      const isDir = entry.type === 'dir';
      const name = entry.name;
      const icon = isDir ? 'folder' : Object.hasOwn(FILE_ICON, entry.ext) ? FILE_ICON[entry.ext] : 'file';
      const flag = entry.flag || '';
      const now = current && (entry.path === current || entry.name === current);
      const collapsed = isDir && fold.has(entry.path);
      const allDesc = isDir ? allEntries.filter((e) => e.path.startsWith(entry.path + '/')).length : 0;
      const hasChild = node.children.length > 0;
      const row = `<div class="vk-tree-row" data-dir="${isDir ? '1' : '0'}" data-depth="${entry.depth}" data-ext="${esc(entry.ext || '')}"${flag ? ` data-flag="${flag}"` : ''}${
        now ? ' data-current="1"' : ''
      }${collapsed ? ' data-folded="1"' : ''}${isDir && !allDesc ? ' data-empty="1"' : ''} style="--depth:${entry.depth}">
        <span class="vk-tree-guides" aria-hidden="true"></span>
        ${isDir ? '<span class="vk-tree-chevron" aria-hidden="true"></span>' : '<span class="vk-tree-chevron is-file" aria-hidden="true"></span>'}
        <svg class="vk-ic" viewBox="0 0 24 24" aria-hidden="true">${iconOf(icon)}</svg>
        <span class="vk-tree-name">${esc(name)}</span>
        ${flag === 'add' ? '<span class="vk-tree-tag">新增</span>' : flag === 'mod' ? '<span class="vk-tree-tag">修改</span>' : flag === 'del' ? '<span class="vk-tree-tag">删除</span>' : ''}
        ${entry.size ? `<span class="vk-tree-size">${bytes(entry.size)}</span>` : ''}
      </div>`;
      const children = hasChild && !collapsed
        ? `<ul class="vk-tree-list" role="list">${node.children.map(renderNode).join('')}</ul>`
        : '';
      const folded = collapsed ? `<div class="vk-tree-fold" style="--depth:${entry.depth}">${allDesc} 项已收起</div>` : '';
      return `<li class="vk-tree-item" role="listitem"${now ? ' aria-current="true"' : ''}>${row}${folded}${children}</li>`;
    };

    this.innerHTML = `
      <div class="vk-tree">
        <div class="vk-tree-hd">
          <span class="vk-tree-title">${esc(title || root || '文件树')}</span>
          ${this.getAttribute('summary') === 'none' ? '' : `<span class="vk-tree-meta">${files} 文件 · ${dirs} 目录</span>`}
        </div>
        <ul class="vk-tree-bd vk-tree-list" role="list" aria-label="${esc(title || root || '文件树')}">${roots.map(renderNode).join('')}${hidden > 0 ? `<li class="vk-tree-more" role="listitem">还有 ${hidden}${truncated ? '+' : ''} 项</li>` : ''}</ul>
      </div>
    `;
  }
}

/* ------------------------------------------------------------------ keys */

export class VkKeys extends VkElement {
  static watchSource = true;
  static frame = false;
  static renderedRoot = '.vk-keys';

  capture() {
    this._src = dedent(textSource(this));
  }

  render() {
    const raw = (this._src || '').trim();
    // 只按"空格 + 加号 + 空格"分键，`+` 本身可以是一枚键。
    const keys = raw.split(/\s+\+\s+/).filter(Boolean);
    this.innerHTML = `<span class="vk-keys" role="group" aria-label="${esc(raw)}">${keys
      .map((k, i) => `${i ? '<span class="vk-keyplus" aria-hidden="true">+</span>' : ''}<kbd class="vk-key">${esc(k)}</kbd>`)
      .join('')}</span>`;
  }
}

/* ------------------------------------------------------------------ math */

export class VkMath extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-math';

  capture() {
    const data = this.querySelector(':scope > script[data-vk-math]');
    this._html = data ? data.textContent : null;
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-math], script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.trim();
    const src = precompiledSource(this);
    if (!this._src && src != null) this._src = src;

    if (!this._html) this.stale('没有预编译公式');
    else {
      const tex = (data.getAttribute('data-vk-tex') || '').trim();
      const hash = data.getAttribute('data-vk-math') || '';
      if (tex && tex !== this._src) this.stale('的公式已过期（源码改过但没重新构建）');
      else if (hash && hash !== hash32(this._src)) this.stale('的公式 hash 不匹配（构建数据被改过）');
      else delete this.dataset.vkStale;
    }
  }

  render() {
    const display = this.hasAttribute('display');
    if (this._html) {
      this.innerHTML = `<span class="vk-math"${display ? ' data-display' : ''}>${this._html}</span>`;
    } else {
      this.innerHTML = `<span class="vk-math"${display ? ' data-display' : ''} data-raw>${esc(this._src || '')}</span>`;
    }
  }
}

/* ----------------------------------------------------------------- cells */

/**
 * 内存格：一行连续的格子，每个格子有标签、值、地址。
 *   <vk-cells values="h|e|l|l|o|\0" labels="s[0]|s[1]|s[2]|s[3]|s[4]|\\0"
 *             addr="0x7ffc" flag="6"></vk-cells>
 * 越界的那一格用 flag（1-based）+ 红色"越界"角标。
 */
export class VkCells extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-cells';

  capture() {
    this._src = dedent(textSource(this));
  }

  render() {
    const parse = (name) =>
      (this.getAttribute(name) || '')
        .split('|')
        .map((s) => s.trim());

    let values = parse('values');
    if (!values.length || values.join('') === '') {
      values = (this._src || '').split(/\s+/).filter(Boolean);
    }
    const labels = parse('labels');
    const addr = this.getAttribute('addr') || '';
    let flag = parseInt(this.getAttribute('flag') || '0', 10);
    if (!Number.isFinite(flag) || flag < 1) flag = 0;
    else if (flag > values.length) {
      this._warnOnce('flag', `的 flag="${flag}" 超过 ${values.length} 格，按最后一格处理`);
      flag = values.length;
    }
    let cols = parseInt(this.getAttribute('cols') || String(values.length), 10);
    if (!Number.isFinite(cols) || cols < 1) cols = values.length;
    if (cols > values.length) {
      this._warnOnce('cols', `的 cols="${cols}" 超过 ${values.length} 格，按 ${values.length} 列处理`);
      cols = values.length;
    }
    // 视频帧不做横向滚动：最多 8 列，超出自动换行。
    if (cols > 8) {
      this._warnOnce('cols', `的 cols="${cols}" 超过 8 列，按 8 列换行处理`);
      cols = 8;
    }
    let stride = parseInt(this.getAttribute('stride') || '1', 10);
    if (![1, 2, 4, 8].includes(stride)) {
      this._warnOnce('stride', `的 stride="${this.getAttribute('stride')}" 不在 1/2/4/8 内，按 1 处理`);
      stride = 1;
    }

    const base = addr ? parseInt(addr, 16) : NaN;
    const pad = addr && addr.startsWith('0x') ? Math.max(4, addr.length - 2) : 0;
    const fmtAddr = (n) => (Number.isFinite(n) ? '0x' + n.toString(16).padStart(pad, '0') : '');

    const cells = values
      .map((v, i) => {
        const isFlag = flag === i + 1;
        const label = isFlag ? `${labels[i] || `[${i}]`} · 越界` : labels[i];
        return `<div class="vk-cell"${isFlag ? ' data-flag="1"' : ''} role="listitem">
          ${label ? `<span class="vk-cell-l">${esc(label)}</span>` : ''}
          <span class="vk-cell-v">${esc(v)}</span>
          ${addr ? `<span class="vk-cell-a">${fmtAddr(base + i * stride)}</span>` : ''}
        </div>`;
      })
      .join('');

    this.innerHTML = `<div class="vk-cells" style="--cols:${cols}" role="list">${cells}</div>`;
  }
}

/* ----------------------------------------------------------------- steps */

/**
 * 步骤条：编号 + 连线 + 当前步。
 *   <vk-steps current="2"><li>写代码</li><li>编译</li><li>运行</li></vk-steps>
 */
export class VkSteps extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-steps';

  capture() {
    this._items = [...this.querySelectorAll(':scope > li')].map((li) => ({
      attrs: [...li.attributes].map((a) => [a.name, a.value]),
      nodes: [...li.childNodes],
    }));
  }

  render() {
    const items = this._items || [];
    let current = parseInt(this.getAttribute('current') || '1', 10);
    if (!Number.isFinite(current) || current < 1) current = 1;
    if (items.length && current > items.length) {
      this._warnOnce('current', `的 current="${current}" 超过 ${items.length} 步，按最后一步处理`);
      current = items.length;
    }
    const root = document.createElement('ol');
    root.className = 'vk-steps';
    items.forEach((it, i) => {
      const n = i + 1;
      const state = n < current ? 'done' : n === current ? 'current' : 'todo';
      const step = document.createElement('li');
      step.className = 'vk-step';
      step.dataset.state = state;
      if (state === 'current') step.setAttribute('aria-current', 'step');
      for (const [name, value] of it.attrs || []) {
        try {
          step.setAttribute(name, value);
        } catch {
          /* ignore invalid attr */
        }
      }
      const num = document.createElement('span');
      num.className = 'vk-step-n';
      num.textContent = String(n).padStart(2, '0');
      const text = document.createElement('span');
      text.className = 'vk-step-t';
      for (const node of it.nodes || []) text.append(node);
      step.append(num, text);
      const line = document.createElement('li');
      line.className = 'vk-step-line';
      line.setAttribute('role', 'presentation');
      line.setAttribute('aria-hidden', 'true');
      root.append(step, line);
    });
    this.replaceChildren(root);
  }
}

/* --------------------------------------------------------------- progress */

export class VkProgress extends VkElement {
  static watchSource = false;

  render() {
    const value = Math.round(numAttr(this, 'value', { min: 0, max: 100, fallback: 0 }));
    const label = this.getAttribute('label') || '';
    const tone = this.getAttribute('tone') || 'accent';
    this.innerHTML = `<div class="vk-progress" data-tone="${esc(tone)}">
      <div class="vk-progress-hd"><span class="vk-progress-label">${esc(label)}</span><span class="vk-progress-val">${value}%</span></div>
      <div class="vk-progress-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div>
    </div>`;
  }
}

export function defineComponents() {
  define('vk-title', VkTitle);
  define('vk-list', VkList);
  define('vk-callout', VkCallout);
  define('vk-figure', VkFigure);
  define('vk-browser', VkBrowser);
  define('vk-filetree', VkFiletree);
  define('vk-keys', VkKeys);
  define('vk-math', VkMath);
  define('vk-cells', VkCells);
  define('vk-steps', VkSteps);
  define('vk-progress', VkProgress);
  define('vk-tag', VkTag);
  define('vk-table', VkTable);
}

/** 标签：把裸文本包进 span，才能真的 ellipsis；图标保持固定宽。 */
export class VkTag extends VkElement {
  static watchSource = true;
  static frame = false;

  render() {
    for (const n of [...this.childNodes]) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const span = document.createElement('span');
      span.className = 'vk-tag-t';
      this.replaceChild(span, n);
      span.appendChild(n);
    }
  }
}

/** 原生 <table> 的宿主：内容不动，Frame 只负责 w。 */
export class VkTable extends VkElement {
  static watchSource = false;
  render() {}
}
