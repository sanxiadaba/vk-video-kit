import { esc, dedent, textSource, precompiledSource, numAttr, hash32, indexSet, safePosition, VkElement, define, plain, takeSlot, fillSlot } from './base.mjs';
import { formatNumber } from '../shared/format.mjs';
import { iconOf } from './icons.mjs';
import { win, fileHead, DOTS } from './window.mjs';

/* ------------------------------------------------------------------ title */


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
    const items = this._items || [];
    if (!items.length) {
      this.innerHTML = '';
      this.stale('列表还没有条目：把每一项写成 <li>…</li> 子节点（空列表不会画出空框）', { build: false });
      return;
    }
    delete this.dataset.vkStale;
    const variant = this.getAttribute('variant') || 'bullet';
    const ordered = variant === 'ordered';
    const rule = this.hasAttribute('rule');
    const bare = this.hasAttribute('bare');
    // 密度：compact 只改行高与内距；不写 / 写 normal 完全走旧样式。
    const mass = this.getAttribute('mass') === 'compact' ? 'compact' : 'normal';
    const mode = variant === 'ordered' ? 'bullet' : variant;
    const ul = document.createElement(ordered ? 'ol' : 'ul');
    ul.className = 'vk-list';
    ul.dataset.mode = mode;
    ul.dataset.mass = mass;
    if (ordered) ul.dataset.ordered = '';
    if (rule) ul.dataset.rule = '';
    if (bare) ul.dataset.bare = '';
    for (const [i, it] of (this._items || []).entries()) {
      const li = document.createElement('li');
      li.dataset.item = String(i);
      for (const [n, v] of it.attrs || []) {
        try {
          li.setAttribute(n, v);
        } catch {
          /* 非法属性名不阻塞整块渲染 */
        }
      }
      if (li.hasAttribute('state')) li.dataset.state = li.getAttribute('state');
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

const CALLOUT_ICON = { info: 'info', ok: 'circle-check', warn: 'triangle-alert', err: 'circle-x' };


/* ---------------------------------------------------------------- window */

const WIN_CHROME = new Set(['min', 'none', 'plain', 'browser']);
const WIN_PAD = new Set(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
const WIN_TONES = new Set(['info', 'focus', 'ok', 'warn', 'err']);
/** 流程连接线的画法：箭头 / 细线 / 不画。 */
const CONNECTORS = new Set(['arrow', 'line', 'none']);

/**
 * 窗：L1 原子。三点窗头 + 标题 / 地址栏 / 对话框，内容由作者放。
 * 与 code / term / diff 共用同一个 win() 实现，**不嵌套**。
 */
export class VkWindow extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-win-bd';
  static renderedRoot = '.vk-win';

  capture() {}

  render() {
    const chrome = WIN_CHROME.has(this.getAttribute('chrome')) ? this.getAttribute('chrome') : 'min';
    const pad = WIN_PAD.has(this.getAttribute('pad')) ? this.getAttribute('pad') : 'lg';
    const tone = WIN_TONES.has(this.getAttribute('tone')) ? this.getAttribute('tone') : '';
    const title = this.getAttribute('title') || '';
    const url = this.getAttribute('url') || '';

    if (!this._shell) {
      const body = takeSlot(this);
      this.innerHTML = win({
        chrome: 'min',
        cls: 'vk-win-tag',
        head: '<span class="vk-file" data-meta><span class="vk-file-t"></span></span><span class="vk-br-url" data-meta><b class="vk-br-host"></b><span class="vk-br-path"></span></span>',
        inner: '<div class="vk-win-bd" data-vk-part="bd"></div>',
      });
      this._shell = this.querySelector('.vk-win');
      this._file = this.querySelector('.vk-file');
      this._fileT = this.querySelector('.vk-file-t');
      this._url = this.querySelector('.vk-br-url');
      this._host = this.querySelector('.vk-br-host');
      this._path = this.querySelector('.vk-br-path');
      this._slot = this.querySelector('.vk-win-bd');
      fillSlot(this._slot, body);
    }

    this._shell.dataset.chrome = chrome;
    this._shell.dataset.pad = pad;
    if (tone) this._shell.dataset.tone = tone;
    else delete this._shell.dataset.tone;

    this._fileT.textContent = title;
    // 长标题在窗头里省略；title 悬停时还能看到全文。
    this._file.title = title;
    this._file.style.display = title ? '' : 'none';

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

    const label = title || url;
    this._shell.setAttribute('role', 'region');
    if (label) this._shell.setAttribute('aria-label', label);
    else this._shell.removeAttribute('aria-label');

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

export class VkTree extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-tree';

  capture() {
    this._preSrc = precompiledSource(this);
    const tree = this.querySelector(':scope > script[data-vk-tree]');
    this._raw = null;
    if (tree) {
      try {
        const data = JSON.parse(tree.textContent);
        if (data && Array.isArray(data.entries)) this._raw = data;
      } catch {
        /* 损坏的树数据按缺失处理 */
      }
    }
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-tree], script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    if (this.getAttribute('src') && !this._raw && !this._src.trim()) this.stale('缺少预编译树数据');
  }

  _inlineEntries() {
    const lines = (this._src || '').split('\n').filter((l) => l.trim());
    if (!lines.length) return [];
    const leads = lines.map((l) => (l.match(/^ */) || [''])[0].length);
    const minLead = Math.min(...leads);
    const stack = [];
    return lines.map((raw) => {
      const lead = (raw.match(/^ */) || [''])[0].length;
      const depth = Math.max(0, Math.round((lead - minLead) / 2));
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
      const parent = depth > 0 ? stack[depth - 1] || '' : '';
      const p = parent ? `${parent}/${clean}` : clean;
      if (isDir) {
        stack.length = depth;
        stack[depth] = p;
      } else {
        stack.length = depth;
      }
      return {
        name: clean,
        path: p,
        depth,
        type: isDir ? 'dir' : 'file',
        ext: clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : '',
        size: 0,
        flag,
      };
    });
  }

  onAttr(name) {
    if (name === 'collapsed') this._fold = null;
  }

  /** 目录行点一下就能开合：箭头不是装饰。 */
  _toggleFrom(target) {
    const row = target?.closest?.('.vk-tree-row[data-dir="1"]');
    if (!row || !this.contains(row)) return false;
    const path = row.dataset.nodePath;
    if (!path) return false;
    if (!this._fold) this._fold = new Set();
    if (this._fold.has(path)) this._fold.delete(path);
    else this._fold.add(path);
    this.paint();
    return true;
  }

  render() {
    const tree = this._raw;
    const title = this.getAttribute('title') || '';
    const currentSet = new Set((this.getAttribute('current') || '').split(',').map((s) => s.trim()).filter(Boolean));
    const maxDepth = this.hasAttribute('depth')
      ? Math.min(8, Math.max(0, parseInt(this.getAttribute('depth'), 10) || 0))
      : 4;
    const everyEntry = tree?.entries || this._inlineEntries();
    const allEntries = everyEntry.filter((entry) => !Number.isFinite(maxDepth) || entry.depth <= maxDepth);
    // depth 挡掉的那部分要计数：不报出来，这棵树看起来就是"完整的"。
    const depthCut = everyEntry.length - allEntries.length;
    if (!this._fold) {
      this._fold = new Set(
        (this.getAttribute('collapsed') || '')
          .split(',')
          .map((s) => s.trim().replace(/\/+$/, ''))
          .filter(Boolean)
      );
    }
    const fold = this._fold;
    const entries = allEntries.filter((entry) => ![...fold].some((dir) => entry.path.startsWith(dir + '/')));
    const files = everyEntry.filter((e) => e.type === 'file').length;
    const dirs = everyEntry.filter((e) => e.type === 'dir').length;
    const branches = allEntries.filter((e) => e.type === 'dir').length;
    const leaves = allEntries.length - branches;
    const root = tree?.root || '';
    const truncated = !!tree?.truncated;
    const limit = this.hasAttribute('limit') ? Math.min(500, Math.max(1, parseInt(this.getAttribute('limit'), 10) || 1)) : 14;
    const top = entries.filter((e) => e.depth === 0);
    let shownTop = top.slice(0, limit);
    if (currentSet.size) {
      // 多选也要保证"当前"那一支不被 limit 截掉。
      const hits = entries.filter((e) => currentSet.has(e.path) || currentSet.has(e.name));
      const hitTops = hits
        .map((hit) => top.find((t) => hit.path === t.path || hit.path.startsWith(t.path + '/')))
        .filter(Boolean);
      for (const hitTop of hitTops) {
        if (shownTop.includes(hitTop)) continue;
        shownTop = [...shownTop.slice(0, Math.max(0, limit - 1)), hitTop];
      }
    }
    const shown = entries.filter((e) => shownTop.some((t) => e === t || e.path.startsWith(t.path + '/')));
    const hidden = entries.length - shown.length + depthCut + (truncated ? 1 : 0);
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
      const isBranch = isDir;
      const name = entry.name;
      const icon = isDir ? 'folder' : Object.hasOwn(FILE_ICON, entry.ext) ? FILE_ICON[entry.ext] : 'file';
      const flag = entry.flag || '';
      const now = currentSet.has(entry.path) || currentSet.has(entry.name);
      const collapsed = isBranch && fold.has(entry.path);
      const allDesc = isBranch ? allEntries.filter((e) => e.path.startsWith(entry.path + '/')).length : 0;
      const hasChild = node.children.length > 0;
      const row = `<div class="vk-tree-row" data-dir="${isBranch ? '1' : '0'}" data-node-path="${esc(entry.path || name)}" data-depth="${entry.depth}" data-ext="${esc(entry.ext || '')}"${
        entry.kind ? ` data-kind="${esc(entry.kind)}"` : ''
      }${flag ? ` data-flag="${flag}"` : ''}${now ? ' data-current="1"' : ''}${
        collapsed ? ' data-folded="1"' : ''
      }${isBranch && !allDesc ? ' data-empty="1"' : ''} style="--depth:${entry.depth}"${isBranch ? ` role="button" tabindex="0" aria-expanded="${!collapsed}"` : ''}>
        <span class="vk-tree-guides" aria-hidden="true"></span>
        ${isBranch ? '<span class="vk-tree-chevron" aria-hidden="true"></span>' : '<span class="vk-tree-chevron is-file" aria-hidden="true"></span>'}
        <svg class="vk-ic" viewBox="0 0 24 24" aria-hidden="true">${iconOf(icon)}</svg>
        <span class="vk-tree-name" data-ellipsis title="${esc(entry.path || name)}">${esc(name)}</span>
        ${flag === 'add' ? '<span class="vk-tree-tag">新增</span>' : flag === 'mod' ? '<span class="vk-tree-tag">修改</span>' : flag === 'del' ? '<span class="vk-tree-tag">删除</span>' : ''}
        ${entry.size ? `<span class="vk-tree-size">${bytes(entry.size)}</span>` : ''}
      </div>`;
      const children = hasChild && !collapsed
        ? `<ul class="vk-tree-list" role="list">${node.children.map(renderNode).join('')}</ul>`
        : '';
      const folded = collapsed ? `<div class="vk-tree-fold" style="--depth:${entry.depth}">${allDesc} 项已收起</div>` : '';
      return `<li class="vk-tree-item" role="listitem"${now ? ' aria-current="true"' : ''}>${row}${folded}${children}</li>`;
    };

    if (!this._treeBound) {
      this._treeBound = true;
      this.addEventListener('click', (e) => this._toggleFrom(e.target));
      this.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && this._toggleFrom(e.target)) e.preventDefault();
      });
    }

    const label = title || root || '文件树';
    const meta = this.getAttribute('summary') === 'none' ? '' : `${files} 文件 · ${dirs} 目录`;

    this.innerHTML = `
      <div class="vk-tree" data-chrome="${this.getAttribute('chrome') === 'none' ? 'none' : 'min'}">
        <div class="vk-tree-hd" data-vk-part="tree-hd">
        ${DOTS}
          <span class="vk-tree-title">${esc(label)}</span>
          ${meta ? `<span class="vk-tree-meta" data-meta>${meta}</span>` : ''}
        </div>
        <ul class="vk-tree-bd vk-tree-list" role="list" aria-label="${esc(label)}">${roots.map(renderNode).join('')}${
          hidden > 0
            ? `<li class="vk-tree-more" role="listitem">还有 ${hidden}${truncated ? '+' : ''} 项${
                depthCut ? `（其中 ${depthCut} 项在 depth="${maxDepth}" 以下）` : ''
              }${truncated ? '（目录太大，只扫了前 500 条）' : ''}</li>`
            : ''
        }</ul>
      </div>
    `;
  }
}

/* ----------------------------------------------------------------- bytes */

export class VkBytes extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-bytes';

  capture() {
    const data = this.querySelector(':scope > script[data-vk-bytes]');
    this._data = null;
    if (data) {
      try {
        const d = JSON.parse(data.textContent);
        if (d && Array.isArray(d.bytes)) this._data = d;
      } catch {
        /* 损坏的字节数据按缺失处理 */
      }
    }
    if (this.getAttribute('src') && !this._data) this.stale('缺少预编译字节数据');
  }

  render() {
    const d = this._data;
    if (!d) {
      this.innerHTML = '<div class="vk-bytes" data-empty>缺少预编译字节数据</div>';
      return;
    }
    const cols = this.getAttribute('cols') === '4' ? 4 : 8;
    const group = Math.max(1, Math.min(8, parseInt(this.getAttribute('group'), 10) || 1));
    const word = [1, 2, 4, 8].includes(parseInt(this.getAttribute('word'), 10)) ? parseInt(this.getAttribute('word'), 10) : 1;
    const endian = this.getAttribute('endian') === 'big' ? 'big' : 'little';
    const ascii = this.getAttribute('ascii') !== 'none';
    const address = this.getAttribute('address') !== 'none';
    const mass = this.getAttribute('mass') || 'normal';
    const file = d.file || (this.getAttribute('src') || '').split(/[\\/]/).pop() || 'bytes.bin';
    const range = d.end >= d.start ? `${d.start}–${d.end}` : `${d.start}`;
    const live = this.getAttribute('current');
    const liveHl = live == null ? new Set() : new Set([...indexSet(live)].map((i) => d.start + i));
    const rows = [];
    for (let at = 0; at < d.bytes.length; at += cols) {
      const chunk = d.bytes.slice(at, at + cols);
      const flags = (live != null ? Array.from({ length: cols }, (_, i) => liveHl.has(d.start + at + i)) : []).slice(0, chunk.length);
      const addr = '0x' + (d.base + d.start + at).toString(16).padStart(4, '0');
      const units = chunk.map((b, i) => ({ b, i, flag: flags[i] }));
      const ordered = [];
      for (let w = 0; w < units.length; w += word) {
        const part = units.slice(w, w + word);
        ordered.push(...(word > 1 && endian === 'little' ? part.reverse() : part));
      }
      const words = [];
      for (let w = 0; w < ordered.length; w += word) {
        const part = ordered.slice(w, w + word);
        words.push(`<span class="vk-bytes-w">${part
          .map((u) => `<i${group > 1 && u.i % group === 0 ? ' class="is-group"' : ''} data-byte="${at + u.i}" data-hl="${u.flag ? '1' : '0'}">${esc(u.b)}</i>`)
          .join('')}</span>`);
      }
      const text = chunk
        .map((h, i) => {
          const n = parseInt(h, 16);
          const ch = n >= 32 && n < 127 ? String.fromCharCode(n) : '.';
          return `<i class="vk-byte-c"${flags[i] ? ' data-hl="1"' : ''}>${esc(ch)}</i>`;
        })
        .join('');
      rows.push(`<div class="vk-bytes-row">
        ${address ? `<span class="vk-bytes-a">${addr}</span>` : ''}
        <span class="vk-bytes-x" data-group="${group}" data-word="${word}" data-endian="${endian}">${words.join('')}</span>
        ${ascii ? `<span class="vk-bytes-c">${text}</span>` : ''}
      </div>`);
    }
    const rowsHtml = rows.join('');
    this.innerHTML = win({
      chrome: this.getAttribute('chrome') === 'none' ? 'none' : 'min',
      head: fileHead(file, 'bytes', range),
      inner: `<div class="vk-bd" data-vk-part="bd"><div class="vk-bytes" data-mass="${esc(mass)}" data-cols="${cols}" data-word="${word}" data-endian="${endian}">${rowsHtml || '<div class="vk-bytes-row"><span class="vk-bytes-c">（空）</span></div>'}</div></div>`,
    });
  }
}

/* ----------------------------------------------------------------- frames */

/* ------------------------------------------------------------------ keys */

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
 * 内存格：一格一个 <li>，属性只描述"这一行怎么排"，内容全在子节点里。
 *   <vk-cells cols="4" addr="0x7ffc">
 *     <li value="'h'" label="s[0]"></li>
 *     <li value="'e'" label="s[1]" state="mark"></li>
 *     <li value="'l'" label="s[2]"></li>
 *     <li value="'l'" label="s[3]" state="err"></li>
 *   </vk-cells>
 * 多行：子节点超过 cols 就换行（cols 最多 8）。状态是每格自己的：state / filled。
 */
export class VkCells extends VkElement {
  static watchSource = false;
  static renderedRoot = '.vk-cells';

  capture() {
    this._items = [...this.querySelectorAll(':scope > li, :scope > i')].map((el) => {
      const span = parseInt(el.getAttribute('span') || '1', 10);
      const state = el.getAttribute('state') || '';
      const bad = state === 'err';
      const mark = state === 'mark';
      return {
        value: el.getAttribute('value') ?? (el.textContent || '').trim(),
        label: el.getAttribute('label') || '',
        span: Number.isFinite(span) && span >= 1 && span <= 8 ? span : 1,
        state: state || (bad ? 'err' : mark ? 'mark' : ''),
        bad,
        mark,
        filled: el.hasAttribute('filled'),
        // 姿态属性随行带走：act / strength 是作者写在 <li> 上的，渲染后不能丢。
        act: el.getAttribute('act') || '',
        strength: el.getAttribute('strength') || '',
      };
    });
  }

  render() {
    const items = this._items || [];
    if (!items.length) {
      this.innerHTML = '';
      return;
    }
    const spans = items.map((it) => it.span);
    const total = spans.reduce((a, b) => a + b, 0);
    // 地址是这一块的坐标系：写错了不能悄悄把地址列画成空白。
    const addrRaw = (this.getAttribute('addr') || '').trim();
    const addrOk = !addrRaw || /^(?:0x)?[0-9a-f]+$/i.test(addrRaw);
    if (addrRaw && !addrOk) {
      this._warnOnce('addr', `的 addr="${addrRaw}" 不是十六进制地址（写成 0x7ffc 这样），地址列已关闭`);
    }
    const addr = addrOk ? addrRaw : '';
    const maxSpan = Math.max(...spans);
    let cols = parseInt(this.getAttribute('cols') || String(total), 10);
    if (!Number.isFinite(cols) || cols < 1) cols = total;
    if (cols > total) {
      this._warnOnce('cols', `的 cols="${cols}" 超过 ${total} 格，按 ${total} 列处理`);
      cols = total;
    }
    // 跨格比列数还宽时，隐含轨道会静默出现：抬到 maxSpan 并说一声。
    if (cols < maxSpan) {
      this._warnOnce('cols', `的 cols="${cols}" 小于最宽的跨格 ${maxSpan}，按 ${maxSpan} 列处理`);
      cols = maxSpan;
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
    const byteMode = this.hasAttribute('offsets') || this.hasAttribute('ruler') || this.getAttribute('direction') === 'rtl';
    const direction = this.getAttribute('direction') === 'rtl' ? 'rtl' : 'ltr';

    // 地址按"这个字段从第几个字节开始"算：跨格字段后面的字段要跳过它占的宽度。
    const offsets = [];
    let acc = 0;
    for (let i = 0; i < items.length; i++) {
      offsets.push(acc);
      acc += spans[i];
    }
    const cells = items
      .map((it, i) => {
        const label = it.bad ? `${it.label || `[${i}]`} · 越界` : it.label;
        const span = spans[i];
        const stateAttr = it.state ? ` data-state="${it.state}"` : '';
        const marks = `${it.bad ? ' data-flag="1"' : ''}${it.filled ? ' data-filled="1"' : ''}${it.mark ? ' data-mark="1"' : ''}${stateAttr}`;
        const startOff = offsets[i] * stride;
        const ruler = byteMode
          ? `<span class="vk-cell-bytes" aria-hidden="true">${Array.from({ length: span }, (_, k) => {
              const order = direction === 'rtl' ? span - 1 - k : k;
              const byteOff = startOff + order * stride;
              return `<span class="vk-cell-byte" data-byte="${byteOff}" data-meta>${addr ? fmtAddr(base + byteOff) : `+${byteOff}`}</span>`;
            }).join('')}</span>`
          : '';
        return `<div class="vk-cell" data-vk-part="cell" data-cell="${i}" data-span="${span}"${byteMode ? ' data-bytes="1"' : ''}${this.hasAttribute('ruler') ? ' data-ruler="1"' : ''}${span > 1 ? ` style="grid-column: span ${span}"` : ''}${marks}${it.act ? ` act="${esc(it.act)}"` : ''}${it.strength ? ` strength="${esc(it.strength)}"` : ''} role="listitem">
          ${label ? `<span class="vk-cell-l" data-meta data-ellipsis>${esc(label)}</span>` : ''}
          <span class="vk-cell-v">${esc(it.value)}</span>
          ${ruler}
          ${addr && !byteMode ? `<span class="vk-cell-a" data-meta data-ellipsis>${fmtAddr(base + startOff)}</span>` : ""}
        </div>`;
      })
      .join('');

    this.innerHTML = `<div class="vk-cells" style="--cols:${cols}" data-direction="${direction}" role="list">${cells}</div>`;
  }
}

/* ----------------------------------------------------------------- steps */

/**
 * 步骤条：编号 + 等距连接线 + 当前步。
 *   <vk-steps current="2" connector="arrow"><li>写代码</li><li>编译</li><li>运行</li></vk-steps>
 *
 * 流程的箭头由组件画：每一步等宽、连接线等长、箭头统一指向下一步。
 * 作者不需要（也不能）写坐标或手工连 vk-edge。
 *
 * current="-1"：**不标当前步**。给"纯地图"页用——五步等权，没有"走到哪一步"的暗示；
 * 不写 current 仍是 0（第一步即当前步），旧页一个字不用改。
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
    if (!items.length) {
      this.innerHTML = '';
      this.stale('步骤还没有条目：把每一步写成 <li>…</li> 子节点（空步骤条不会画出空框）', { build: false });
      return;
    }
    delete this.dataset.vkStale;
    // -1 = 不标当前步：地图页要有"五步等权"的写法，否则只能假装站在某一步。
    const rawCurrent = parseInt(this.getAttribute('current') ?? '0', 10);
    let current = Number.isFinite(rawCurrent) ? rawCurrent : 0;
    if (current < -1) current = -1;
    if (current > items.length - 1) {
      this._warnOnce('current', `的 current="${current}" 超过 ${items.length - 1}，按最后一步处理`);
      current = items.length - 1;
    }
    // done="none"：不把 current 之前自动画成已完成。地图页要"五步等权"时，
    // current="-1" 会让整页 0 强调色；这里保留 current 的高亮，只去掉前面的对勾。
    const rawDone = (this.getAttribute('done') || 'auto').trim();
    const doneMode = rawDone === 'none' ? 'none' : 'auto';
    if (rawDone !== 'auto' && rawDone !== 'none') {
      this._warnOnce('done', `的 done="${rawDone}" 不认识，按 auto 处理（可用：auto / none）`);
    }
    // mark="N"（0 起，与 current 同一套坐标）：只强调第 N 步，不给其它步打勾。
    // 这是"地图上指出一处"的写法；有 mark 时不再自动标 done。
    let mark = parseInt(this.getAttribute('mark') ?? '', 10);
    const hasMark = Number.isFinite(mark);
    if (hasMark && (mark < 0 || mark > items.length - 1)) {
      this._warnOnce('mark', `的 mark="${mark}" 不在 0…${items.length - 1}，已忽略`);
      mark = NaN;
    }
    const hasValidMark = Number.isFinite(mark);
    const focusIdx = hasValidMark ? mark : current;
    // 连接线只有三种画法；写错就按默认箭头画，并在控制台说清楚。
    const rawConnector = this.getAttribute('connector');
    const connector = CONNECTORS.has(rawConnector) ? rawConnector : 'arrow';
    if (rawConnector && !CONNECTORS.has(rawConnector)) {
      this._warnOnce('connector', `的 connector="${rawConnector}" 不认识，按 arrow 处理（可用：arrow / line / none）`);
    }
    const root = document.createElement('ol');
    root.className = 'vk-steps';
    root.dataset.connector = connector;
    root.dataset.done = doneMode;
    root.dataset.mark = hasValidMark ? String(mark) : '';
    items.forEach((it, i) => {
      const n = i + 1;
      // current = -1 时三个分支都不命中：五步同为 todo，等权的地图。
      // done="none" / 有 mark 时不再自动把前面几步画成 done。
      const state =
        i === focusIdx ? 'current' : doneMode === 'auto' && !hasValidMark && i < current ? 'done' : 'todo';
      const step = document.createElement('li');
      step.className = 'vk-step';
      step.dataset.step = String(i);
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
      root.append(step);
      // 最后一步后面不画线：连接线只在两步之间，端点因此可数、等距。
      if (i < items.length - 1) {
        const line = document.createElement('li');
        line.className = 'vk-step-line';
        // 线的状态跟「它通向的那一步」走：done 绿、current 钴蓝、todo 灰。
        const next = i + 1;
        const nextState =
          next === focusIdx ? 'current' : doneMode === 'auto' && !hasValidMark && next < current ? 'done' : 'todo';
        line.dataset.conn = nextState;
        line.setAttribute('role', 'presentation');
        line.setAttribute('aria-hidden', 'true');
        root.append(line);
      }
    });
    this.replaceChildren(root);
  }
}

/* ---------------------------------------------------------------- quote */

/* ----------------------------------------------------------------- bits */

export class VkBits extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-bits-wrap';

  capture() {
    // 同一层 <i> 有两种角色：带 from 的是"字段"，其余是"一行位串"。
    const nodes = [...this.querySelectorAll(':scope > li, :scope > i')];
    this._fields = nodes
      .filter((el) => el.hasAttribute('from'))
      .map((el, i) => {
        const hiRaw = el.getAttribute('from');
        const loRaw = el.getAttribute('to');
        const hi = Number(hiRaw);
        const lo = loRaw === null ? hi : Number(loRaw);
        if (!Number.isFinite(hi)) return null;
        return {
          i,
          hi: Math.max(hi, Number.isFinite(lo) ? lo : hi),
          lo: Math.min(hi, Number.isFinite(lo) ? lo : hi),
          label: el.getAttribute('label') || (el.textContent || '').trim(),
          state: el.getAttribute('state') || '',
        };
      })
      .filter(Boolean);
    this._rows = nodes
      .filter((el) => !el.hasAttribute('from'))
      .map((el) => {
        const state = el.getAttribute('state') || '';
        return {
          label: el.getAttribute('label') || '',
          value: el.getAttribute('value') || el.textContent.trim(),
          state,
          mark: state === 'mark',
        };
      });
  }

  render() {
    const rows = this._rows && this._rows.length
      ? this._rows
      : [{ label: this.getAttribute('label') || '', value: this.getAttribute('value') || '', mark: false }];
    // 没有可画的位就不要画问号：那既不是数据也不是错误，只是一句"我也不知道"。
    // 位数据要么写成 <li value="0100 1000">，要么给宿主写 value="0100 1000"。
    //
    // 这里按"解析结果"判断，不按"有没有 rows"判断：rows 永远至少有一条
    // （没有子节点时默认取宿主的 value），所以空块、只写 label、value 里混进
    // 非 0/1 字符，以前都会掉到下面那个 ? 占位里。
    const bitsOf = (raw) => String(raw || '').replace(/\s+/g, '');
    const bad = rows.find((r) => bitsOf(r.value) && !/^[01]+$/.test(bitsOf(r.value)));
    if (bad) {
      this.stale(`的 value="${String(bad.value).slice(0, 24)}" 不是二进制：只能写 0/1（空格可以随便加）`, {
        build: false,
      });
      this.innerHTML = '';
      return;
    }
    if (!rows.some((r) => /^[01]+$/.test(bitsOf(r.value)))) {
      this.stale('缺少位数据：写成 <li value="0100 1000">，或给宿主写 value="0100 1000"', { build: false });
      this.innerHTML = '';
      return;
    }
    // 位数据补上之后要把上一轮的 stale 清掉：错误状态不能粘住。
    delete this.dataset.vkStale;
    const index = ['0-7', 'none'].includes(this.getAttribute('index')) ? this.getAttribute('index') : '7-0';
    const sign = this.hasAttribute('sign');
    const tone = this.getAttribute('tone') === 'info' ? 'info' : 'neutral';
    const bytes = this.hasAttribute('bytes');
    const group = ['1', '4', '8'].includes(this.getAttribute('group')) ? Number(this.getAttribute('group')) : 4;

    const widthAttr = Number(this.getAttribute('bit-width'));
    const width = [8, 16, 32, 64].includes(widthAttr) ? widthAttr : 0;
    // 位串比声明的位宽长时只画最后 width 位：这是截断，不是排版，得说一声。
    const overWide = width ? rows.find((r) => bitsOf(r.value).length > width) : null;
    if (overWide) {
      this._warnOnce(
        'bit-width',
        `的位串有 ${bitsOf(overWide.value).length} 位，超过 bit-width="${width}"：只画最后 ${width} 位`
      );
    }
    // 字段写成子节点：<li from="30" to="23" label="指数"></li>。一个字段一段，可单独锚定。
    const fieldSpecs = this._fields || []
      .map((el, i) => {
        const hiRaw = el.getAttribute('from');
        const loRaw = el.getAttribute('to');
        const hi = Number(hiRaw);
        const lo = loRaw === null ? hi : Number(loRaw);
        if (!Number.isFinite(hi)) return null;
        const label = el.getAttribute('label') || (el.textContent || '').trim();
        return { i, hi: Math.max(hi, Number.isFinite(lo) ? lo : hi), lo: Math.min(hi, Number.isFinite(lo) ? lo : hi), label };
      })
      .filter(Boolean);
    const useFields = fieldSpecs.length && rows.length === 1 && (!width || width <= 32);
    const hasLabel = rows.some((r) => r.label);
    const fieldN = width || (rows[0]?.value.replace(/\s+/g, '').length || 32);
    const fieldStarts = new Set(fieldSpecs.map((f) => f.hi));

    const chunksOf = (raw) => {
      const bitStr = bitsOf(raw);
      const total = width || bitStr.length;
      if (!total) return [];
      let padded = bitStr;
      if (width) {
        if (bitStr.length > width) padded = bitStr.slice(bitStr.length - width);
        else padded = '0'.repeat(width - bitStr.length) + bitStr;
      }
      if (total > 32) return [padded.slice(0, 32), padded.slice(32)].filter((c) => c.length);
      return [padded];
    };

    const fieldLegend = useFields
      ? `<div class="vk-bit-legend" data-meta style="--n:${fieldN}">${fieldSpecs
          .map((f) => {
            const start = Math.max(0, fieldN - 1 - f.hi);
            const span = Math.min(fieldN - start, f.hi - f.lo + 1);
            return `<span class="vk-bit-legend-f" data-field-label="${f.i}"${f.state ? ' data-state="' + esc(f.state) + '"' : ''} style="grid-column:${start + 1} / span ${span}" title="${esc(f.label)} · ${f.hi - f.lo + 1} 位"><b>${esc(f.label)}</b>${span >= 2 ? `<i>${f.hi - f.lo + 1} 位</i>` : ''}</span>`;
          })
          .join('')}</div>`
      : '';

    const multi = rows.length > 1;
    const rendered = rows
      .map((row, r) => {
        const chunks = chunksOf(row.value);
        if (!chunks.length) return '';
        const totalBits = width || chunks.reduce((n, c) => n + c.length, 0);
        const bitRow = multi ? r : 0;
        const parts = chunks
          .map((chunk, ci) => {
            const hi = totalBits - 1 - ci * 32;
            const lo = hi - (chunk.length - 1);
            const cols = chunk
              .split('')
              .map((b, i) => {
                const abs = hi - i;
                const n = index === 'none' ? null : index === '0-7' ? lo + i : abs;
                const isSign = sign && r === 0 && ci === 0 && i === 0;
                const byteGap = bytes && abs % 8 === 0 && abs !== 0;
                const groupGap = group > 1 && abs % group === 0 && abs !== 0;
                const fieldStart = useFields && fieldStarts.has(abs);
                const bitId = multi || chunks.length > 1 ? `${bitRow}:${abs}` : String(abs);
                return `<div class="vk-bit-col"${byteGap || groupGap ? ' data-gap' : ''}${byteGap ? ' data-byte' : ''}${fieldStart ? ' data-field-start' : ''}>${n === null ? '' : `<span class="vk-bit-i" data-meta>${n}</span>`}<span class="vk-bit${isSign ? ' is-sign' : ''}" data-bit="${bitId}">${b}</span></div>`;
              })
              .join('');

            let brackets = '';
            if (useFields) {
              const segs = fieldSpecs
                .map((f) => {
                  const from = Math.max(f.lo, lo);
                  const to = Math.min(f.hi, hi);
                  if (from > to) return '';
                  const start = hi - to;
                  const span = to - from + 1;
                  return `<span class="vk-bit-field" data-field="${f.i}" style="grid-column:${start + 1} / span ${span}" title="${esc(f.label)}"></span>`;
                })
                .join('');
              if (segs) brackets = `<div class="vk-bit-brackets" style="--n:${chunk.length}">${segs}</div>`;
            }

            return `<div class="vk-bit-chunk">
              ${brackets}
              <div class="vk-bits" data-group="${group}" style="--n:${chunk.length}">${cols}</div>
            </div>`;
          })
          .join('');
        return `<div class="vk-bit-row" data-row="${r}"${row.mark ? ' data-mark' : ''}${row.state ? ` data-state="${row.state}"` : ''}>${row.label ? `<span class="vk-bit-label" data-meta>${esc(row.label)}</span>` : ''}<div class="vk-bit-chunks">${parts}</div></div>`;
      })
      .join('');

    // 位数据已经在上面校验过：至少有 0/1 可画，所以这里不再需要占位分支。
    this.innerHTML = `<div class="vk-bits-wrap" data-tone="${tone}" data-rows="${rows.length}"${bytes ? ' data-bytes' : ''}${hasLabel ? ' data-label="1"' : ''}${useFields ? ' data-fields="1"' : ''}>${fieldLegend}${rendered}</div>`;
  }
}

/* ----------------------------------------------------------------- bars */

export class VkBars extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-bars';

  capture() {
    this._rows = [...this.querySelectorAll(':scope > li, :scope > i')].map((el) => ({
      label: el.getAttribute('label') || el.textContent.trim(),
      value: Number(el.getAttribute('value') ?? el.textContent.trim()),
      state: el.getAttribute('state') || '',
    }));
    if (this._rows.some((r) => !Number.isFinite(r.value))) {
      this._warnOnce('value', '子节点 <i> 的 value 必须是数字');
      this._rows = this._rows.filter((r) => Number.isFinite(r.value));
    }
  }

  render() {
    const rows = this._rows || [];
    if (!rows.length) {
      this.innerHTML = '<div class="vk-bars"><span class="vk-bar-l">（没有条目）</span></div>';
      return;
    }
    const unit = this.getAttribute('unit') || '';
    // 数值列的写法和 vk-stat 同一套：默认千分位，format="none" 才是原样。
    // 同一帧里 52,980（大数字）和 52980（条尾）并排，观众会以为是两个数。
    const format = this.getAttribute('format') || 'thousands';
    const log = this.getAttribute('scale') === 'log';
    const hasNegative = rows.some((r) => r.value < 0);
    if (hasNegative && log) {
      this._warnOnce('scale', '的对数刻度不支持负值：负值按 0 画，改用 scale="linear" 才能画在零线左边');
    }
    /**
     * ratio-to：把「差了几倍」直接写出来。
     *
     * 两条刻度都不能同时讲清 106 / 52,980：log 把三根压成一样长，linear 让 106 只剩 6px。
     * 倍率不是刻度问题，而是一条独立的标注——所以条长照旧，旁边多一个 ×500。
     * 行号 0 起，和 #id@item:0 是同一套编号；指空 / 基数为 0 都不静默吞掉。
     */
    const ratioRaw = this.getAttribute('ratio-to');
    let baseIndex = null;
    let ratioBase = null;
    if (ratioRaw != null && ratioRaw.trim() !== '') {
      const idx = Number(ratioRaw);
      if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) {
        this._warnOnce('ratio-to', `的 ratio-to="${ratioRaw}" 指不到任何一行（共 ${rows.length} 行，0 起）：不标倍率`);
      } else if (!(rows[idx].value > 0)) {
        this._warnOnce('ratio-to', `的基准行 ${idx} 的值不是正数（${rows[idx].value}）：倍率没有意义，不标倍率`);
      } else {
        baseIndex = idx;
        ratioBase = rows[idx].value;
      }
    }
    const ratioTextOf = (row, i) => {
      if (ratioBase == null) return '';
      if (!(row.value > 0)) {
        this._warnOnce(`ratio-to:row:${i}`, `第 ${i} 行的值不是正数（${row.value}）：不标它的倍率`);
        return '';
      }
      const q = row.value / ratioBase;
      const text = q >= 10 ? String(Math.round(q)) : String(Number(q.toFixed(q >= 1 ? 1 : 2)));
      return `<span class="vk-bar-x" data-meta${i === baseIndex ? ' data-ratio-base=""' : ''}>×${esc(text)}</span>`;
    };
    const attrMax = Number(this.getAttribute('max'));
    // 有负值时值域自动包含 0，零线才有地方放。
    const dataMax = Math.max(...rows.map((r) => r.value), 0);
    const dataMin = Math.min(...rows.map((r) => r.value), 0);
    const max = Number.isFinite(attrMax) && attrMax > 0 ? attrMax : dataMax || 1;
    const min = hasNegative && !log ? dataMin : 0;
    const range = max - min || 1;
    const zeroPct = ((0 - min) / range) * 100;
    const denom = log ? Math.log1p(Math.max(0, max)) : max;
    const split = hasNegative && !log;
    const items = rows
      .map((r, ri) => {
        let pct;
        if (log) {
          const raw = Math.log1p(Math.max(0, r.value));
          pct = denom > 0 ? Math.max(0, Math.min(1, raw / denom)) * 100 : 0;
        } else {
          pct = Math.max(0, Math.min(100, ((r.value - min) / range) * 100));
        }
        const neg = split && r.value < 0;
        // 有负值时用"零线两侧"的绝对定位；没有负值就保持从左往右长。
        const style = split
          ? `left:${Math.min(pct, zeroPct).toFixed(2)}%;width:${Math.abs(pct - zeroPct).toFixed(2)}%`
          : `width:${pct.toFixed(2)}%`;
        const zero = split ? `<span class="vk-bar-zero" style="left:${zeroPct.toFixed(2)}%"></span>` : '';
        return `<div class="vk-bar"${neg ? ' data-negative="1"' : ''}${r.value > 0 ? ' data-nonzero="1"' : ''}${r.state ? ' data-state="' + esc(r.state) + '"' : ''}><span class="vk-bar-l">${esc(r.label)}</span><span class="vk-bar-t">${zero}<span class="vk-bar-fill" style="${style}"></span></span><span class="vk-bar-v">${esc(formatNumber(String(r.value), format))}${ratioTextOf(r, ri)}</span></div>`;
      })
      .join('');
    this.innerHTML = `<div class="vk-bars"${split ? ' data-has-negative="1"' : ''}>${items}</div>${unit ? `<p class="vk-bars-unit" data-meta>单位：${esc(unit)}</p>` : ''}`;
  }
}

/* ---------------------------------------------------------------- panel */

/**
 * 区域：一张卡片或一条章节带。
 * 只提供「底 + 边 + 三个槽」，不规定里面怎么排 —— 排法是作者的事。
 *   slot="header" / slot="footer" / 其余进 body
 */

/* ----------------------------------------------------------------- stat */

/**
 * 指标：一帧里「一个数字当家」的那个数字。
 * 只负责怎么显示（大小/单位/图例/千分位），不负责数字从哪来。
 */


/* ----------------------------------------------------------------- compare */

/**
 * 前后对照：两张图叠在同一个框里，上面那张按 split 裁掉一部分。
 * 静态就是「改到一半」的那一帧；要动起来就交给导演层（enter="wipe" 正好是划开）。
 * 增删只用语义色：divider 与角标只用石墨，不抢注意力。
 */
const CMP_LABEL_POSITIONS = new Set(['inside', 'top']);

/**
 * 差异框：`10,20,40,60;55,70,30,15` —— 相对百分比坐标。
 *
 * 每段是 x1,y1,x2,y2；不要求左上角在前，两个角可以任意顺序。
 * 坐标是相对"对照取景框"的，不是相对原图：split 裁掉的部分不参与。
 */
function parseMarks(raw, warn) {
  const out = [];
  for (const part of String(raw || '').split(';')) {
    const text = part.trim();
    if (!text) continue;
    const nums = text.split(',').map((s) => parseFloat(s.trim()));
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
      warn?.(`的 mark="${text}" 不是 x1,y1,x2,y2；这一段已忽略`);
      continue;
    }
    const [x1, y1, x2, y2] = nums.map((n) => Math.max(0, Math.min(100, n)));
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 0.5 || h < 0.5) {
      warn?.(`的 mark="${text}" 宽或高为 0；这一段已忽略`);
      continue;
    }
    out.push({ x, y, w, h });
  }
  return out;
}

/**
 * object-position → 图像在盒子里的偏移（与 CSS 的百分比定位同一套算法）。
 * free 是「盒子 - 图像渲染尺寸」：cover 时是负数（图比盒子大），contain 时是正数。
 */
function parseObjectPosition(value, freeX, freeY) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const one = (v, free) => {
    const raw = v ?? '50%';
    if (raw.endsWith('%')) return (free * parseFloat(raw)) / 100;
    if (raw.endsWith('px')) return parseFloat(raw);
    return free / 2;
  };
  return { x: one(parts[0], freeX), y: one(parts[1] || parts[0], freeY) };
}


export class VkCompare extends VkElement {
  static watchSource = false;

  render() {
    const a = this.getAttribute('a') || '';
    const b = this.getAttribute('b') || '';
    const modeRaw = (this.getAttribute('mode') || 'split').trim();
    const mode = modeRaw === 'side' || modeRaw === 'stack' ? modeRaw : 'split';
    if (modeRaw !== mode) {
      this._warnOnce('mode', `的 mode="${modeRaw}" 不认识，按 mode="split" 叠图裁切；可用：split / side / stack`);
    }
    // side / stack 是"两张完整的图并排/上下"，没有分割线可裁。
    // 写了 split 不能装没看见：构建期也会提示一次（见 src/highlight.mjs）。
    if (mode !== 'split' && this.hasAttribute('split')) {
      this._warnOnce(
        'split',
        `的 mode="${mode}" 下 split 不起作用（${mode === 'side' ? '左右并排' : '上下排列'}不裁切）：删掉 split，或改用 mode="split"`
      );
    }
    // side / stack 的唯一承诺是"两张图都完整"，所以按 contain 画；显式写 cover 要说清楚。
    if (mode !== 'split' && this.getAttribute('fit') === 'cover') {
      this._warnOnce('fit', `的 mode="${mode}" 下 fit="cover" 不起作用：并排/上下按 contain 完整显示`);
    }
    const ratioRaw = this.getAttribute('ratio') || '16 / 9';
    const rm = ratioRaw.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    const ratio = rm && Number(rm[1]) / Number(rm[2]) >= 0.25 && Number(rm[1]) / Number(rm[2]) <= 8 ? ratioRaw : '16 / 9';
    // split 允许写 "42%" 或 42；numAttr 只认纯数字，所以先剥掉百分号。
    const splitNum = parseFloat(String(this.getAttribute('split') ?? '').replace('%', ''));
    const split = Math.min(100, Math.max(0, Number.isFinite(splitNum) ? splitNum : 50));
    const fit = this.getAttribute('fit') || 'cover';
    const pos = safePosition(this.getAttribute('position') || '50% 50%');
    // 角标两档：inside（默认，叠在图上）与 top（在图上另起一条带，不压像素）。
    const labelPosRaw = (this.getAttribute('label-position') || 'inside').trim();
    const labelPosition = CMP_LABEL_POSITIONS.has(labelPosRaw) ? labelPosRaw : 'inside';
    if (labelPosRaw !== labelPosition) {
      this._warnOnce('label-position', `的 label-position="${labelPosRaw}" 不认识，按 inside 画；可用：inside / top`);
    }

    if (!this._shell) {
      this.innerHTML = `<div class="vk-cmp" role="img">
        <img class="vk-cmp-b" alt="">
        <img class="vk-cmp-a" alt="">
        <div class="vk-cmp-div" aria-hidden="true"></div>
        <span class="vk-cmp-la"></span>
        <span class="vk-cmp-lb"></span>
        <div class="vk-cmp-marks" aria-hidden="true">
          <div class="vk-cmp-marks-a"></div>
          <div class="vk-cmp-marks-b"></div>
        </div>
      </div>`;
      this._shell = this.querySelector('.vk-cmp');
      this._imgA = this.querySelector('.vk-cmp-a');
      this._imgB = this.querySelector('.vk-cmp-b');
      this._div = this.querySelector('.vk-cmp-div');
      this._la = this.querySelector('.vk-cmp-la');
      this._lb = this.querySelector('.vk-cmp-lb');
      this._marksA = this.querySelector('.vk-cmp-marks-a');
      this._marksB = this.querySelector('.vk-cmp-marks-b');
    }

    const alt = this.getAttribute('alt') || this.getAttribute('label') || '';
    this._shell.dataset.mode = mode;
    this._shell.style.setProperty('--vk-cmp-ratio', ratio);
    // split 才有"一个框里的两张叠图"；side / stack 的高度由每张图自己的比例撑开。
    this._shell.style.aspectRatio = mode === 'split' ? ratio : '';
    this._shell.dataset.fit = fit;
    this._shell.dataset.labelPosition = labelPosition;
    // 两张图缺一张时，画面上只剩一块空灰板：看起来像"对照"，其实什么都没有。
    // 状态要留在 DOM 上（audit / vk check 能报），并且写进角标（人能看到）。
    const failed = (this._failed = this._failed || { a: false, b: false });
    const current = (this._srcs = this._srcs || { a: null, b: null });
    const paintLabels = () => {
      // 每次现读属性：监听器是绑一次的，标签可能后来才改。
      const la = this.getAttribute('label-a') || '';
      const lb = this.getAttribute('label-b') || '';
      const la2 = failed.a ? `${la || '图 A'} · 未加载` : la;
      const lb2 = failed.b ? `${lb || '图 B'} · 未加载` : lb;
      this._la.textContent = la2;
      this._lb.textContent = lb2;
      this._la.style.display = la2 ? '' : 'none';
      this._lb.style.display = lb2 ? '' : 'none';
    };
    const markError = (side) => {
      failed[side] = true;
      const bad = failed.a || failed.b;
      this._shell.toggleAttribute('data-error', bad);
      this.toggleAttribute('data-error', bad);
      paintLabels();
    };
    for (const [side, img, src] of [['b', this._imgB, b], ['a', this._imgA, a]]) {
      if (current[side] !== src) {
        current[side] = src;
        failed[side] = false;
      }
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      img.style.objectPosition = pos;
      img.alt = alt;
      if (!img._vkErrBound) {
        img._vkErrBound = true;
        img.addEventListener('error', () => {
          markError(side);
          this._warnOnce(`img:${side}`, `的 ${side} 图加载失败（${img.getAttribute('src') || '没写 src'}）`);
        });
        img.addEventListener('load', () => {
          if (!img.naturalWidth) {
            markError(side);
            this._warnOnce(`img:${side}`, `的 ${side} 图是空的（${img.getAttribute('src') || '没写 src'}）`);
          }
        });
      }
      if (!src) {
        markError(side);
        this._warnOnce(`pair:${side}`, `的 ${side} 图没有 src：对照需要 a 和 b 两张图，缺的一侧会空着`);
      }
    }
    if (failed.a || failed.b) {
      this._shell.toggleAttribute('data-error', true);
      this.toggleAttribute('data-error', true);
    } else {
      this._shell.removeAttribute('data-error');
      this.removeAttribute('data-error');
    }

    // 对照的前提是两张图同尺寸：不同尺寸时"一半对一半"没有意义，
    // 画面会一边被拉伸、一边被裁掉，观众却以为看到的是同一个取景框。
    const checkPair = () => {
      const A = this._imgA;
      const B = this._imgB;
      if (!A.naturalWidth || !B.naturalWidth) return;
      const ra = A.naturalWidth / A.naturalHeight;
      const rb = B.naturalWidth / B.naturalHeight;
      const mismatch = Math.abs(ra - rb) / Math.max(ra, rb) > 0.02;
      this._shell.toggleAttribute('data-mismatch', mismatch);
      // audit 查的是宿主上的 data-mismatch：只标内部壳等于没报。
      this.toggleAttribute('data-mismatch', mismatch);
      if (mismatch) {
        this._warnOnce(
          'pair',
          `两张图尺寸比例不同（${A.naturalWidth}×${A.naturalHeight} vs ${B.naturalWidth}×${B.naturalHeight}）：对照会一边拉伸一边裁切`
        );
      }
      // 图解码完成后才有 naturalWidth，放大块要等这一步才能算背景几何。
      if (this._zoom) this._paintZoom(this._lastMode || 'split', this._lastSplit ?? 50);
    };
    for (const img of [this._imgA, this._imgB]) {
      if (img.complete) checkPair();
      else img.addEventListener('load', checkPair, { once: true });
    }
    // a 在左、b 在右：裁掉 a 的右半边，让底下那张 b 从分割线往右露出来。
    // 之前写的是 inset(0 0 0 split%)——那是"只留 a 的右半边"，
    // 于是左半边显示的是 b，和左角的 label-a 正好错位。
    if (mode === 'split') {
      this._imgA.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
      this._div.style.left = split + '%';
    } else {
      // side / stack：两张图各自完整，不裁切，也没有分割线。
      this._imgA.style.clipPath = '';
      this._div.style.left = '';
    }

    paintLabels();
    this._paintMarks(mode, split);
    this._lastMode = mode;
    this._lastSplit = split;
    // zoom 只多画一块，不改对照本身的几何。
    this.dataset.zoom = (this.getAttribute('zoom') || '').trim();
    this._paintZoom(mode, split);
    if (!this._zoomResize) {
      this._zoomResize = () => this._paintZoom(this._lastMode || 'split', this._lastSplit ?? 50);
      window.addEventListener('resize', this._zoomResize);
    }
  }

  /**
   * 差异放大：在对照下方画一块放大视图。
   *
   *   zoom="mark"            放大 mark 框住的第一块（最常用）
   *   zoom="x1,y1,x2,y2"     放大任意百分比框
   *   zoom="2"               倍数（框取 mark，没有 mark 就取整张）
   *   zoom="mark@3"          框 + 非默认倍数
   *
   * 放大块只是同一张图的背景，用 background-size / background-position 把
   * 框内区域放大 N 倍显示；不要求作者写任何 CSS。
   */
  _paintZoom(mode, split) {
    const raw = (this.getAttribute('zoom') || '').trim();
    if (!raw) {
      this._zoom?.remove();
      this._zoom = null;
      return;
    }
    const spec = this._zoomSpec(raw);
    if (!spec) {
      this._zoom?.remove();
      this._zoom = null;
      return;
    }
    const { box, scale } = spec;
    const center = box.x + box.w / 2;
    const which = mode === 'split' ? (center < split ? 'a' : 'b') : 'a';
    const img = which === 'a' ? this._imgA : this._imgB;
    if (!this._zoom) {
      const fig = document.createElement('figure');
      fig.className = 'vk-cmp-zoom';
      fig.setAttribute('role', 'img');
      const view = document.createElement('div');
      view.className = 'vk-cmp-zoom-v';
      const cap = document.createElement('figcaption');
      cap.className = 'vk-cmp-zoom-c';
      cap.setAttribute('data-meta', '');
      fig.append(view, cap);
      this.append(fig);
      this._zoom = fig;
      this._zoomV = view;
      this._zoomC = cap;
    }
    const title = `差异放大 ×${Number.isInteger(scale) ? scale : scale.toFixed(1)}`;
    this._zoomC.textContent = title;
    this._zoom.setAttribute('aria-label', title);

    const nr = img.getBoundingClientRect();
    if (!img.naturalWidth || nr.width < 1 || nr.height < 1) {
      // 图还没解码出来：load 监听器会再调一次。
      return;
    }
    const W = nr.width;
    const H = nr.height;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const fit = getComputedStyle(img).objectFit === 'contain' ? 'contain' : 'cover';
    // 与 <img> 的 object-fit 用同一套缩放：放大块才能和取景框逐像素对齐。
    const s = fit === 'contain' ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh);
    const RW = nw * s;
    const RH = nh * s;
    const cs = getComputedStyle(img);
    const pos = parseObjectPosition(cs.objectPosition, W - RW, H - RH);
    const rx = (W * box.x) / 100;
    const ry = (H * box.y) / 100;
    const rw = (W * box.w) / 100;
    const rh = (H * box.h) / 100;
    const v = this._zoomV;
    v.style.aspectRatio = `${rw} / ${rh}`;
    v.style.backgroundImage = `url("${(img.currentSrc || img.src).replace(/"/g, '%22')}")`;
    v.style.backgroundSize = `${RW * scale}px ${RH * scale}px`;
    v.style.backgroundPosition = `${-(rx - pos.x) * scale}px ${-(ry - pos.y) * scale}px`;
    v.dataset.source = which;
    v.dataset.scale = String(scale);
    v.dataset.zoomBox = `${box.x},${box.y},${box.w},${box.h}`;
    this.dataset.zoom = raw;
  }

  /** zoom 的写法解析：mark / x1,y1,x2,y2 / 倍数 / 前两者 @倍数。 */
  _zoomSpec(raw) {
    let token = raw;
    let scale = 2;
    const numeric = /^\d+(?:\.\d+)?$/.test(raw);
    const at = raw.lastIndexOf('@');
    if (at > 0) {
      const n = parseFloat(raw.slice(at + 1));
      if (Number.isFinite(n)) {
        scale = Math.max(1, Math.min(8, n));
        token = raw.slice(0, at).trim();
      }
    } else if (numeric) {
      scale = Math.max(1, Math.min(8, parseFloat(raw)));
      token = 'mark';
    }
    const marks = this._marks || [];
    if (token === 'mark') {
      if (!marks.length) {
        // 只写倍数时拿整张对照当框，不逼作者先写 mark。
        if (numeric) return { box: { x: 0, y: 0, w: 100, h: 100 }, scale };
        this._warnOnce('zoom', '的 zoom="mark" 没有对应的 mark 框：先写 mark="x1,y1,x2,y2"');
        return null;
      }
      return { box: marks[0], scale };
    }
    const nums = token.split(',').map((s) => parseFloat(s.trim()));
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
      this._warnOnce('zoom', `的 zoom="${raw}" 不是 mark、倍数或 x1,y1,x2,y2；已忽略`);
      return null;
    }
    const [x1, y1, x2, y2] = nums.map((n) => Math.max(0, Math.min(100, n)));
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 0.5 || h < 0.5) {
      this._warnOnce('zoom', `的 zoom="${raw}" 框宽或高为 0；已忽略`);
      return null;
    }
    return { box: { x, y, w, h }, scale };
  }

  /**
   * 差异标注：细框 + 角标。
   *
   * split 下的取舍（写进 docs/reference.md）：每一处差异只标在它所属的那一侧 ——
   * 框心在分割线左边就裁到左半（A 可见），右边就裁到右半（B 可见），
   * 绝不跨到另一张图的地盘上。side / stack 下两张图各自完整，坐标相对 a 图，
   * 标注只画在 a 上（b 是参照物）。
   */
  _paintMarks(mode, split) {
    const a = this._marksA;
    const b = this._marksB;
    if (!a || !b) return;
    a.replaceChildren();
    b.replaceChildren();
    this._shell.style.setProperty('--vk-cmp-split', split + '%');
    const marks = parseMarks(this.getAttribute('mark'), (msg) => this._warnOnce('mark', msg));
    // zoom="mark" 读同一份框，避免两处解析规则漂移。
    this._marks = marks;
    if (!marks.length) return;
    const labels = String(this.getAttribute('mark-label') || '')
      .split(';')
      .map((s) => s.trim());
    for (const [i, m] of marks.entries()) {
      const box = document.createElement('div');
      box.className = 'vk-cmp-mark';
      box.style.left = m.x + '%';
      box.style.top = m.y + '%';
      box.style.width = m.w + '%';
      box.style.height = m.h + '%';
      const label = labels[i] || '';
      if (label) {
        const s = document.createElement('span');
        s.className = 'vk-cmp-mark-l';
        s.textContent = label;
        box.append(s);
      }
      if (mode === 'split') {
        // 框心落在哪一半，就属于哪一张图。
        const center = m.x + m.w / 2;
        (center < split ? a : b).append(box);
      } else {
        a.append(box);
      }
    }
  }
}

export function defineComponents() {
  define('vk-list', VkList);
  define('vk-window', VkWindow);
  define('vk-tree', VkTree);
  define('vk-math', VkMath);
  define('vk-cells', VkCells);
  define('vk-bytes', VkBytes);
  define('vk-steps', VkSteps);
  define('vk-bits', VkBits);
  define('vk-bars', VkBars);
  define('vk-table', VkTable);
  define('vk-compare', VkCompare);
}

/** 标签：把裸文本包进 span，才能真的 ellipsis；图标保持固定宽。 */

/** 原生 <table> 的宿主：内容不动，Frame 只负责 w；给每格写锚点。 */
export class VkTable extends VkElement {
  static watchSource = false;
  render() {
    const rows = this.querySelectorAll('tr');
    if (!rows.length) {
      // 空表在画面上是 0 高度：看起来像"这里没东西"，其实是漏了行。
      // 不画空框，直接说清楚怎么补。
      this.innerHTML = '';
      this.stale('这个表还没有行：在 <table> 里写 <tr><td>…</td></tr>（表头也算行）', { build: false });
      return;
    }
    delete this.dataset.vkStale;
    rows.forEach((tr, r) => {
      tr.dataset.row = String(r);
      [...tr.children].forEach((cell, c) => {
        if (cell.tagName === 'TD' || cell.tagName === 'TH') cell.dataset.cell = `${r},${c}`;
      });
    });
  }
}



