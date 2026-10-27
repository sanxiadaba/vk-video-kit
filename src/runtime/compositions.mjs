import { VK, VkElement, define, takeSlot, fillSlot, resolveTarget, numAttr } from './base.mjs';
import { wrapCharRange } from './code-utils.mjs';
import { roundedPath } from './geometry.mjs';

const num = (v, fallback) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------- page */

/**
 * 一页 1080p 的画布工具：固定 1920×1080，按容器宽度等比缩放。
 */
export class VkPage extends VkElement {
  static watchSource = true;
  static frame = false;
  static slot = true;
  static slotHost = '.vk-page-bd';
  static renderedRoot = '.vk-page';

  render() {
    const w = 1920;
    const h = 1080;
    const align = this.getAttribute('align') === 'center' ? 'center' : 'top';
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';

    if (!this._shell) {
      const body = takeSlot(this);
      // 坐标系根：只有 1920×1080 与安全区。页眉页脚与缩放在本层之外。
      this.innerHTML = `<div class="vk-page" data-align="top" style="--pw:${w}px;--ph:${h}px">
        <div class="vk-page-inner"><div class="vk-page-bd" data-vk-part="bd"></div></div>
      </div>`;
      this._shell = this.querySelector('.vk-page');
      this._bd = this.querySelector('.vk-page-bd');
      fillSlot(this._bd, body);
      this.dataset.vkPlace = '';
    }

    this._shell.dataset.surface = surface;
    this._shell.dataset.align = align;
    this._apply();
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this._done) this._watch();
  }

  _watch() {
    if (this._ro || typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => this._apply());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._ro?.disconnect();
    this._ro = null;
  }

  place() {
    this._apply();
  }

  _apply() {
    const inner = this._shell || this.querySelector('.vk-page');
    if (!inner) return;
    // 不缩放：出片尺寸就是设计尺寸，缩放属于预览器（vk shot）而不是组件。
    inner.style.width = '1920px';
    inner.style.height = '1080px';
    inner.style.transform = '';
    if (this.style.height !== '1080px') this.style.height = '1080px';
  }
}

/* --------------------------------------------------------------- annotate */

let ANNO_SEQ = 0;

/**
 * 行旁批注。
 *
 *   <vk-annotate w="600">
 *     <vk-code id="a" …>…</vk-code>
 *     <vk-note line="2">这一行在栈上开了 6 个字节。</vk-note>
 *   </vk-annotate>
 *
 * 绑定代码行的批注：按行心对齐、贴在该行右侧，行号旁出现蓝点。
 * 关系由"对齐"表达，不画长引线。
 * 只有 for="#id" 指向非代码元素时，才画一条短引线（圆点在目标上）。
 */
export class VkAnnotate extends VkElement {
  static watchSource = false;
  static frame = false;

  render() {
    const width = numAttr(this, 'w', { min: 200, max: 800, fallback: 600 });
    if (width > 0) this.style.setProperty('--vk-anno-w', width + 'px');
    else this.style.removeProperty('--vk-anno-w');

    if (!this._built) {
      const notes = [...this.querySelectorAll(':scope > vk-note')];
      notes.sort((a, b) => (parseInt(a.getAttribute('line') || '0', 10) || 0) - (parseInt(b.getAttribute('line') || '0', 10) || 0));

      const col = document.createElement('div');
      col.className = 'vk-anno-notes';
      col.dataset.vkPart = 'notes';
      for (const note of notes) {
        note.id = note.id || `vk-anno-${++ANNO_SEQ}`;
        col.append(note);
      }
      if (notes.length) this.append(col);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'vk-anno-lines');
      svg.setAttribute('aria-hidden', 'true');
      this.append(svg);

      this._svg = svg;
      this._notes = notes;
      this._col = col;
      this._built = true;
      this.dataset.vkPlace = '';
      this._watch();
    }

    VK._invalidate();
  }

  _watch() {
    if (this._ro || typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => this.place());
    this._ro.observe(this);
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this._done) this._watch();
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._ro?.disconnect();
    this._ro = null;
  }

  place() {
    if (!this._built) return;
    // 作者在首次渲染后追加的 <vk-note>：下一次 layout 时接入，而不是静默丢在宿主下。
    const extras = [...this.querySelectorAll(':scope > vk-note')];
    if (extras.length) {
      for (const note of extras) {
        note.id = note.id || `vk-anno-${++ANNO_SEQ}`;
        this._notes.push(note);
        this._col.append(note);
      }
      this._notes.sort(
        (a, b) => (parseInt(a.getAttribute('line') || '0', 10) || 0) - (parseInt(b.getAttribute('line') || '0', 10) || 0)
      );
      this._sig = '';
    }
    if (!this._notes?.length) return;
    const host = this;
    const hr = host.getBoundingClientRect();
    if (!hr.width) return;
    const k = hr.width / (host.offsetWidth || hr.width);

    const code = host.querySelector('vk-code');
    const lineOf = (note) => {
      const n = parseInt(note.getAttribute('line') || '', 10);
      if (!n) return null;
      const forSel = note.getAttribute('for');
      const scope = forSel ? resolveTarget(host, forSel, this) : code;
      return (scope || code || host).querySelector(`.vk-line[data-line="${n}"], .vk-dline[data-line="${n}"], .vk-asm [data-line="${n}"]`);
    };

    const items = [];
    for (const note of this._notes) {
      const line = lineOf(note);
      const forSel = note.getAttribute('for');
      const target = line || (forSel ? resolveTarget(host, forSel, this) : null);
      if (!target) {
        note.hidden = true;
        note.style.display = 'none';
        this._warnOnce(
          'missing:' + (note.id || note.getAttribute('line') || note.getAttribute('for')),
          `找不到 ${note.hasAttribute('line') ? '第 ' + note.getAttribute('line') + ' 行' : 'for 目标'}，这条批注没有落点`
        );
        continue;
      }
      note.hidden = false;
      note.style.display = '';
      // 批注指向行内一段字符：把那段包出来，读者才知道说的是哪几个字。
      if (line && note.hasAttribute('span')) {
        const m = (note.getAttribute('span') || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
        if (m) {
          const src = line.querySelector('.vk-src');
          wrapCharRange(src, Number(m[1]), Number(m[2]), 'vk-anno-hl', `n${note.getAttribute('line')}:${m[1]}-${m[2]}`);
        } else {
          this._warnOnce(`span:${note.getAttribute('line')}`, `的 span="${note.getAttribute('span')}" 不是 起-止，已忽略`);
        }
      }
      const h = note.offsetHeight || 0;
      if (!h) continue;
      const noteBody = note.querySelector('.vk-note');
      const lineHeight = noteBody ? parseFloat(getComputedStyle(noteBody).lineHeight) || 68 : 68;
      items.push({ note, target, line: !!line, h, firstLine: Math.min(h, lineHeight), y: 0 });
    }
    if (!items.length) return;

    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return (r.top + r.height / 2 - hr.top) / k;
    };

    items.sort((a, b) => centerOf(a.target) - centerOf(b.target));
    const gap = 2;
    let cursor = -Infinity;
    for (const it of items) {
      // 多行批注：第一行对齐行心；只有真重叠时才下推，并标出“被移动过”。
      const wanted = Math.max(0, centerOf(it.target) - it.firstLine / 2);
      it.y = Math.max(wanted, cursor + gap);
      it.shifted = it.y - wanted > 2;
      cursor = it.y + it.h;
    }

    const sig = items.map((it) => Math.round(it.y)).join(',') + `:${host.offsetWidth}`;
    if (sig === this._sig) return;
    this._sig = sig;

    for (const it of items) it.note.style.top = Math.round(it.y) + 'px';

    // 被下推的批注失去“对齐”这一唯一的行关系：在正文开头补一个行号钉，不让读者猜。
    for (const it of items) {
      const lineNo = it.note.getAttribute('line');
      const body = it.note.querySelector('.vk-note-b') || it.note;
      let pin = body.querySelector(':scope > .vk-anno-pin');
      if (it.shifted && lineNo) {
        if (!pin) {
          pin = document.createElement('span');
          pin.className = 'vk-anno-pin';
          body.prepend(pin);
        }
        pin.textContent = `L${lineNo}`;
      } else if (pin) {
        pin.remove();
      }
    }

    const codeH = code?.offsetHeight || 0;
    const last = items[items.length - 1];
    host.style.minHeight = Math.max(codeH, last.y + last.h) + 'px';

    // 只有 for 目标画引线：一条正交折线 + 目标处一个圆点。
    const svg = this._svg;
    if (svg) {
      const hr2 = host.getBoundingClientRect();
      const k2 = hr2.width / (host.offsetWidth || hr2.width);
      svg.setAttribute('viewBox', `0 0 ${host.offsetWidth} ${host.offsetHeight}`);
      const out = [];
      for (const it of items) {
        if (it.line) continue;
        const nr = it.note.getBoundingClientRect();
        const tr = it.target.getBoundingClientRect();
        const nx = (nr.left - hr2.left) / k2 - 8;
        const ny = (nr.top + nr.height / 2 - hr2.top) / k2;
        const tx = (tr.right - hr2.left) / k2 + 8;
        const ty = (tr.top + tr.height / 2 - hr2.top) / k2;
        const mid = tx + Math.max(24, (nx - tx) / 2);
        out.push(`<path class="vk-anno-path" d="${roundedPath([{ x: tx, y: ty }, { x: mid, y: ty }, { x: mid, y: ny }, { x: nx, y: ny }], 12)}"/>`);
        out.push(`<circle class="vk-anno-dot" cx="${tx}" cy="${ty}" r="5"/>`);
      }
      svg.innerHTML = out.join('');
    }
  }
}

export class VkNote extends VkElement {
  static watchSource = true;
  static slot = true;
  static slotHost = '.vk-note-b';
  static renderedRoot = '.vk-note';

  render() {
    const tone = this.getAttribute('tone') || 'accent';
    const n = this.getAttribute('n') || '';
    if (!this._shell) {
      const body = takeSlot(this);
      this.innerHTML = '<div class="vk-note" data-tone="accent"><span class="vk-note-b"></span></div>';
      this._shell = this.querySelector('.vk-note');
      this._body = this.querySelector('.vk-note-b');
      fillSlot(this._body, body);
    }
    this._shell.dataset.tone = tone;
    this._shell.dataset.emphasis = this.getAttribute('emphasis') || 'solid';
    this._shell.dataset.surface = this.getAttribute('surface') || 'paper';
    let num = this._body.querySelector(':scope > .vk-anno-n');
    if (n) {
      if (!num) {
        num = document.createElement('span');
        num.className = 'vk-anno-n';
        this._body.prepend(num);
      }
      num.textContent = n;
    } else if (num) {
      num.remove();
    }
  }
}

export function defineCompositions() {
  define('vk-page', VkPage);
  // 先定义 vk-note：annotate 升级时要能拿到已经渲染好的批注体。
  define('vk-note', VkNote);
  define('vk-annotate', VkAnnotate);
}
