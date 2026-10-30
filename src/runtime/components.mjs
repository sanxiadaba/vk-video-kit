import { esc, dedent, textSource, precompiledSource, numAttr, hash32, indexSet, safePosition, VkElement, define, plain, takeSlot, fillSlot } from './base.mjs';
import { iconOf } from './icons.mjs';
import { win, fileHead } from './window.mjs';

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
    this._shell.dataset.overflow = this.getAttribute('overflow') || 'visible';
    this._shell.dataset.grow = this.hasAttribute('grow') ? '1' : '0';
    this._shell.dataset.fill = this.hasAttribute('fill') ? '1' : '0';
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

export class VkCallout extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-callout-bd';
  static renderedRoot = '.vk-callout';

  capture() {}

  render() {
    this.setAttribute('role', 'note');
    // 没有标题也没有正文：画面上不该留一条孤零零的色条。
    if (!this.textContent.trim() && !this.getAttribute('title')) {
      this.innerHTML = '';
      return;
    }
    const tone = this.getAttribute('tone') || 'info';
    const title = this.getAttribute('title') || '';
    const flat = this.hasAttribute('bare');

    if (!this._shell) {
      this._titleSlot = this.querySelector(':scope > [slot="title"]');
      this._titleSlot?.remove();
      const body = takeSlot(this);
      this.innerHTML = `<div class="vk-callout" data-tone="info">
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
    // 终端截图可以很宽（4–6:1），海报可以很高；只拦明显写错的。
    const ratio = rm && Number(rm[1]) / Number(rm[2]) >= 0.25 && Number(rm[1]) / Number(rm[2]) <= 8 ? ratioRaw : '16 / 9';
    if (ratio !== ratioRaw) this._warnOnce('ratio', `的 ratio="${ratioRaw}" 不合法，按 16 / 9 处理`);
    const fit = this.getAttribute('fit') || 'cover';
    const focus = safePosition(this.getAttribute('position') || '50% 50%');
    // 13.0：默认不套窗头。真实截图自带浏览器/终端外壳，再套一层假三点，
    // 观众会先看到"这图贴歪了"。要窗头自己写 chrome="min"。
    const chrome = this.getAttribute('chrome') || 'none';
    const shadow = this.getAttribute('shadow') || 'none';
    const bleed = this.getAttribute('bleed') || 'none';

    if (!this._shell) {
      this._captionSlot = this.querySelector(':scope > figcaption');
      this._captionSlot?.remove();
      const body = takeSlot(this);
      this.innerHTML = win({
        chrome: 'min',
        cls: 'vk-fig-win',
        attrs: ' role="figure"',
        head: '<b class="vk-fig-fig"></b>',
        inner: `<div class="vk-fig-body" data-vk-part="fig-body"><div class="vk-fig-slot"></div><div class="vk-fig-ph" aria-hidden="true">图未加载</div></div><figcaption class="vk-fig-caption"></figcaption><div class="vk-fig-url"></div>`,
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

    this._shell.dataset.chrome = chrome;
    this._shell.dataset.shadow = shadow;
    this._shell.dataset.fit = fit;
    this.dataset.bleed = bleed;

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

    // 裁切框：crop 是"图片的百分比"，不是容器的百分比（cover / contain 下两者不等）。
    if (!this._crop) {
      this._crop = document.createElement('span');
      this._crop.className = 'vk-fig-crop';
      this._crop.setAttribute('aria-hidden', 'true');
      this._cropLabel = document.createElement('span');
      this._cropLabel.className = 'vk-fig-crop-label';
      this._cropLabel.setAttribute('data-meta', '');
      this._body.appendChild(this._crop);
    }
    if (this._cropLabel && this._cropLabel.parentNode !== this._hd) {
      this._fig.after(this._cropLabel);
    }
    const cropLabel = this.getAttribute('crop-label') || '';
    this._cropLabel.textContent = cropLabel;
    this._cropLabel.style.display = cropLabel && this.getAttribute('crop') ? '' : 'none';
    this._placeCrop();

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

  /**
   * crop 用"图片自己"的百分比。cover / contain 下图片的可见矩形与容器不等，
   * 所以先按 object-fit / object-position 求出图片画在哪，再把图片坐标换成容器坐标。
   */
  _placeCrop() {
    const cropEl = this._crop;
    if (!cropEl) return;
    const raw = (this.getAttribute('crop') || '').trim();
    const p = raw.split(',').map((n) => Number(n.trim()));
    const ok =
      p.length === 4 &&
      p.every(Number.isFinite) &&
      p[2] > 0 &&
      p[3] > 0 &&
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] + p[2] <= 100 &&
      p[1] + p[3] <= 100;
    if (!ok) {
      cropEl.hidden = true;
      if (raw) this._warnOnce('crop', `的 crop="${raw}" 不是 0–100 内的 x,y,w,h`);
      return;
    }
    const [x, y, w, h] = p;
    const body = this._body;
    const W = body.clientWidth;
    const H = body.clientHeight;
    const img = body.querySelector('img');
    const nw = img?.naturalWidth || 0;
    const nh = img?.naturalHeight || 0;
    let left = (x / 100) * W;
    let top = (y / 100) * H;
    let width = (w / 100) * W;
    let height = (h / 100) * H;
    if (nw && nh && W && H) {
      const cs = getComputedStyle(img);
      const contain = cs.objectFit === 'contain';
      const scale = contain ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      const pos = (cs.objectPosition || '50% 50%').split(/\s+/);
      const frac = (t) => {
        if (!t) return 0.5;
        if (t.endsWith('%')) return parseFloat(t) / 100;
        if (t === 'left' || t === 'top') return 0;
        if (t === 'right' || t === 'bottom') return 1;
        return 0.5;
      };
      const ox = (W - dw) * frac(pos[0]);
      const oy = (H - dh) * frac(pos[1] ?? pos[0]);
      left = ox + (x / 100) * dw;
      top = oy + (y / 100) * dh;
      width = (w / 100) * dw;
      height = (h / 100) * dh;
      // 只画容器里看得见的那一段；整块都在画面外就不画。
      const x0 = Math.max(0, left);
      const y0 = Math.max(0, top);
      const x1 = Math.min(W, left + width);
      const y1 = Math.min(H, top + height);
      if (x1 - x0 < 2 || y1 - y0 < 2) {
        cropEl.hidden = true;
        return;
      }
      left = x0;
      top = y0;
      width = x1 - x0;
      height = y1 - y0;
    }
    cropEl.hidden = false;
    cropEl.style.left = `${left}px`;
    cropEl.style.top = `${top}px`;
    cropEl.style.width = `${width}px`;
    cropEl.style.height = `${height}px`;
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
    this._img.addEventListener('vk:img-load', () => { this._shell?.removeAttribute('data-error'); setPh(); this._placeCrop(); });
  }
}

/* ---------------------------------------------------------------- window */

const WIN_CHROME = new Set(['min', 'none', 'plain', 'browser']);
const WIN_PAD = new Set(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
const WIN_TONES = new Set(['info', 'focus', 'ok', 'warn', 'err']);

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
        head: '<span class="vk-file" data-meta></span><span class="vk-br-url" data-meta><b class="vk-br-host"></b><span class="vk-br-path"></span></span>',
        inner: '<div class="vk-win-bd" data-vk-part="bd"></div>',
      });
      this._shell = this.querySelector('.vk-win');
      this._file = this.querySelector('.vk-file');
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

    this._file.textContent = title;
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
    const allEntries = (tree?.entries || this._inlineEntries()).filter(
      (entry) => !Number.isFinite(maxDepth) || entry.depth <= maxDepth
    );
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
    const files = allEntries.filter((e) => e.type === 'file').length;
    const dirs = allEntries.filter((e) => e.type === 'dir').length;
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
          <span class="vk-tree-title">${esc(label)}</span>
          ${meta ? `<span class="vk-tree-meta">${meta}</span>` : ''}
        </div>
        <ul class="vk-tree-bd vk-tree-list" role="list" aria-label="${esc(label)}">${roots.map(renderNode).join('')}${hidden > 0 ? `<li class="vk-tree-more" role="listitem">还有 ${hidden}${truncated ? '+' : ''} 项</li>` : ''}</ul>
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
    const addr = this.getAttribute('addr') || '';
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
    let current = parseInt(this.getAttribute('current') ?? '0', 10);
    if (!Number.isFinite(current) || current < 0) current = 0;
    if (items.length && current > items.length - 1) {
      this._warnOnce('current', `的 current="${current}" 超过 ${items.length - 1}，按最后一步处理`);
      current = items.length - 1;
    }
    const root = document.createElement('ol');
    root.className = 'vk-steps';
    items.forEach((it, i) => {
      const n = i + 1;
      const state = i < current ? 'done' : i === current ? 'current' : 'todo';
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
      const line = document.createElement('li');
      line.className = 'vk-step-line';
      line.setAttribute('role', 'presentation');
      line.setAttribute('aria-hidden', 'true');
      root.append(step, line);
    });
    this.replaceChildren(root);
  }
}

/* ---------------------------------------------------------------- quote */

export class VkQuote extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-quote-t';
  static renderedRoot = '.vk-quote';

  capture() {}

  render() {
    // 空引文只剩一条黑竖杠；没有正文就不画。
    if (!this.textContent.trim()) {
      this.innerHTML = '';
      return;
    }
    if (!this._shell) {
      const body = takeSlot(this);
      this.innerHTML = '<blockquote class="vk-quote"><div class="vk-quote-t"></div><cite class="vk-quote-src" data-meta></cite></blockquote>';
      this._shell = this.querySelector('.vk-quote');
      this._t = this.querySelector('.vk-quote-t');
      this._src = this.querySelector('.vk-quote-src');
      fillSlot(this._t, body);
    }
    const source = this.getAttribute('source') || '';
    const author = this.getAttribute('author') || '';
    const origin = source && author ? `${source} · ${author}` : source || author;
    this._src.textContent = origin ? `— ${origin}` : '';
    this._src.style.display = origin ? '' : 'none';
  }
}

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
    const index = ['0-7', 'none'].includes(this.getAttribute('index')) ? this.getAttribute('index') : '7-0';
    const sign = this.hasAttribute('sign');
    const tone = this.getAttribute('tone') === 'info' ? 'info' : 'neutral';
    const bytes = this.hasAttribute('bytes');
    const group = ['1', '4', '8'].includes(this.getAttribute('group')) ? Number(this.getAttribute('group')) : 4;

    const widthAttr = Number(this.getAttribute('bit-width'));
    const width = [8, 16, 32, 64].includes(widthAttr) ? widthAttr : 0;
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
      const bits = String(raw || '').replace(/\s+/g, '').split('').filter((c) => c === '0' || c === '1');
      const bitStr = bits.join('');
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

    this.innerHTML = `<div class="vk-bits-wrap" data-tone="${tone}" data-rows="${rows.length}"${bytes ? ' data-bytes' : ''}${hasLabel ? ' data-label="1"' : ''}${useFields ? ' data-fields="1"' : ''}>${fieldLegend}${rendered || '<div class="vk-bits"><span class="vk-bit">?</span></div>'}</div>`;
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
      .map((r) => {
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
        return `<div class="vk-bar"${neg ? ' data-negative="1"' : ''}${r.value > 0 ? ' data-nonzero="1"' : ''}${r.state ? ' data-state="' + esc(r.state) + '"' : ''}><span class="vk-bar-l">${esc(r.label)}</span><span class="vk-bar-t">${zero}<span class="vk-bar-fill" style="${style}"></span></span><span class="vk-bar-v">${esc(statValue(String(r.value), format))}</span></div>`;
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
export class VkPanel extends VkElement {
  static frame = false;
  static renderedRoot = '.vk-panel';

  capture() {}

  render() {
    const variant = this.getAttribute('variant') || 'card';
    const surface = this.getAttribute('surface') || 'paper';
    const pad = this.getAttribute('pad') || 'lg';
    const border = this.getAttribute('border') || 'hair';
    const radius = this.getAttribute('radius') || 'lg';
    const n = this.getAttribute('n') || '';

    const all = takeSlot(this).filter((x) => x);
    const pick = (name) => all.filter((x) => x.nodeType === 1 && x.getAttribute && x.getAttribute('slot') === name);
    const header = pick('header');
    const footer = pick('footer');
    const body = all.filter((x) => !header.includes(x) && !footer.includes(x));

    if (!this._shell) {
      this.innerHTML = `<section class="vk-panel"><header class="vk-panel-hd" data-vk-part="hd"><span class="vk-panel-n" data-meta></span></header><div class="vk-panel-bd" data-vk-part="bd"></div><footer class="vk-panel-ft" data-vk-part="ft"></footer></section>`;
      this._shell = this.querySelector('.vk-panel');
      this._hd = this.querySelector('.vk-panel-hd');
      this._n = this.querySelector('.vk-panel-n');
      this._bd = this.querySelector('.vk-panel-bd');
      this._ft = this.querySelector('.vk-panel-ft');
    }

    this._shell.dataset.variant = variant;
    this._shell.dataset.surface = surface;
    this._shell.dataset.pad = pad;
    this._shell.dataset.border = border;
    this._shell.dataset.radius = radius;
    this._shell.dataset.elevation = this.getAttribute('elevation') || '0';
    if (this.hasAttribute('elevation')) this.setAttribute('elevation', this.getAttribute('elevation') || '0');
    this._shell.dataset.overflow = this.getAttribute('overflow') || 'visible';
    this._shell.dataset.grow = this.hasAttribute('grow') ? '1' : '0';
    this._shell.dataset.fill = this.hasAttribute('fill') ? '1' : '0';

    this._n.textContent = n;
    this._n.hidden = !n;

    this._hd.append(...header);
    this._bd.append(...body);
    this._ft.append(...footer);
    this._hd.hidden = !header.length && !n;
    this._ft.hidden = !footer.length;
  }
}

/* ----------------------------------------------------------------- stat */

/**
 * 指标：一帧里「一个数字当家」的那个数字。
 * 只负责怎么显示（大小/单位/图例/千分位），不负责数字从哪来。
 */
export class VkStat extends VkElement {
  static frame = false;

  render() {
    const value = this.getAttribute('value') || '';
    const unit = this.getAttribute('unit') || '';
    const label = this.getAttribute('label') || '';
    const size = this.getAttribute('size') || 'display-xl';
    const tone = this.getAttribute('tone') || 'none';
    const mark = this.getAttribute('mark') || 'none';
    const format = this.getAttribute('format') || 'none';
    const align = this.getAttribute('align') || 'left';

    if (!this._shell) {
      this.innerHTML = `<div class="vk-stat" role="group">
        <span class="vk-stat-l" data-meta></span>
        <span class="vk-stat-row"><span class="vk-stat-m" aria-hidden="true"></span><span class="vk-stat-v"></span><span class="vk-stat-u" data-meta></span></span>
      </div>`;
      this._shell = this.querySelector('.vk-stat');
      this._l = this.querySelector('.vk-stat-l');
      this._v = this.querySelector('.vk-stat-v');
      this._u = this.querySelector('.vk-stat-u');
    }
    this._shell.dataset.size = size;
    this._shell.dataset.tone = tone;
    this._shell.dataset.mark = mark;
    this._shell.dataset.align = align;
    this._shell.dataset.overflow = this.getAttribute('overflow') || 'visible';
    this._shell.dataset.grow = this.hasAttribute('grow') ? '1' : '0';
    this._shell.dataset.fill = this.hasAttribute('fill') ? '1' : '0';
    this._l.textContent = label;
    this._v.textContent = statValue(value, format);
    this._u.textContent = unit;
    if (!label) this._l.remove();
    if (!unit) this._u.remove();
  }
}

/** 只改写法，不改数值：千分位 / 字节 / 十六进制。 */
function statValue(raw, format) {
  if (format === 'none') return raw;
  const n = Number(String(raw).replace(/[^0-9.eE+-]/g, ''));
  if (!Number.isFinite(n)) return raw;
  if (format === 'thousands' || format === 'bytes') return n.toLocaleString('en-US');
  if (format === 'hex') return '0x' + Math.round(n).toString(16).toUpperCase();
  return raw;
}

export function defineComponents() {
  define('vk-panel', VkPanel);
  define('vk-stat', VkStat);
  define('vk-title', VkTitle);
  define('vk-list', VkList);
  define('vk-callout', VkCallout);
  define('vk-figure', VkFigure);
  define('vk-window', VkWindow);
  define('vk-tree', VkTree);
  define('vk-keys', VkKeys);
  define('vk-math', VkMath);
  define('vk-cells', VkCells);
  define('vk-bytes', VkBytes);
  define('vk-steps', VkSteps);
  define('vk-quote', VkQuote);
  define('vk-bits', VkBits);
  define('vk-bars', VkBars);
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

/** 原生 <table> 的宿主：内容不动，Frame 只负责 w；给每格写锚点。 */
export class VkTable extends VkElement {
  static watchSource = false;
  render() {
    this.querySelectorAll('tr').forEach((tr, r) => {
      tr.dataset.row = String(r);
      [...tr.children].forEach((cell, c) => {
        if (cell.tagName === 'TD' || cell.tagName === 'TH') cell.dataset.cell = `${r},${c}`;
      });
    });
  }
}



