import {
  esc, dedent, warnIfParsed, fetchSource, hash32, langKey, langLabel, lineSet,
  precompiledSource, numAttr, VkElement, define,
} from './base.mjs';
import { sliceLines } from '../shared/code.mjs';
import { markTerms, wrapCharRange } from './code-utils.mjs';
import { win, fileHead } from './window.mjs';

/* ------------------------------------------------------------------- code */

export class VkCode extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-win';

  capture() {
    delete this.dataset.vkParsed;
    warnIfParsed(this);
    this._preSrc = precompiledSource(this);
    const hl = this.querySelector(':scope > script[data-vk-hl]');
    this._hl = null;
    this._hlHash = null;
    this._hlLang = null;
    if (hl) {
      try {
        this._hl = JSON.parse(hl.textContent);
      } catch {
        /* 损坏的预编译数据按缺失处理 */
      }
      this._hlHash = hl.getAttribute('data-vk-hash');
      this._hlLang = hl.getAttribute('data-vk-lang');
    }
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-hl], script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    this._raw = null;
    this._fetched = false;
    if (!this._src.trim() && this.getAttribute('src')) fetchSource(this);
  }

  /** 作者运行时改 src：旧源码、旧高亮都必须作废，不能继续显示上一份。 */
  onAttr(name) {
    if (name === 'src') {
      this._src = '';
      this._raw = null;
      this._preSrc = null;
      this._fetched = false;
      this._hl = null;
      this._hlHash = null;
      this._hlLang = null;
      if (this.getAttribute('src')) fetchSource(this);
      return;
    }
    if (name === 'lines') {
      // 有完整原文（运行时 fetch）时 lines 可以重切片；预编译/内联片段在构建期
      // 已经切好，没有完整原文，不能把现有内容擦掉。
      if (!this._raw) this._warnOnce('lines', '的 lines 对已内联/预编译片段无效，请重新构建或改用 src');
    }
  }

  onFetched(text) {
    this._raw = text;
    this._src = text;
    this._fetched = true;
  }

  render() {
    const full = dedent(this._raw ?? this._src ?? '');
    const source = this._raw ? sliceLines(full, this.getAttribute('lines')) : full;
    const lang = (this.getAttribute('lang') || this._hlLang || 'text').toLowerCase();
    const label = langLabel(lang);
    // 没有显式 file 时从 src 取文件名：窗头有 chip，读者才知道这段代码从哪来。
    const srcPath = this.getAttribute('src') || '';
    const file = this.getAttribute('file') || (srcPath ? srcPath.split(/[\\/]/).pop() : '');
    const chrome = this.getAttribute('chrome') || 'min';
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';
    const density = ['large', 'compact'].includes(this.getAttribute('density')) ? this.getAttribute('density') : 'normal';
    const showNums = this.getAttribute('numbers') !== 'none';
    const marks = (this.getAttribute('mark') || '').split(',').map((s) => s.trim()).filter(Boolean);

    const parsed = source.split('\n').map((text) => ({ text, sign: '' }));
    const hash = hash32(source);
    const langOk = this._hlLang ? this._hlLang === langKey(lang) : false;
    const valid = this._hl && this._hlHash === hash && this._hl.length === parsed.length && langOk;

    if (valid) delete this.dataset.vkStale;
    else if (lang !== 'text') {
      this.stale(
        this._hl
          ? this._hlLang && !langOk
            ? '与本块的 lang 不一致'
            : '的高亮数据已过期（源码改过但没重新构建）'
          : '缺少预编译高亮数据'
      );
    }

    const lines = valid ? this._hl : parsed.map((p) => esc(p.text) || ' ');
    const hl = lineSet(this.getAttribute('highlight'));
    const focus = lineSet(this.getAttribute('focus'));
    // 真折叠：区间内的行不渲染；只在区间开头留一条"几行已折叠"。
    const foldSet = new Set();
    const foldStarts = new Map();
    for (const part of (this.getAttribute('fold') || '').split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = Math.min(Math.max(a, parseInt(m[2] || m[1], 10)), lines.length);
      if (a > lines.length) continue;
      foldStarts.set(a, b);
      for (let n = a; n <= b; n++) foldSet.add(n);
    }
    const digits = String(
      Math.max(
        this.getAttribute('numbering') !== 'slice'
          ? (Number((this.getAttribute('lines') || '').match(/^\s*(\d+)/)?.[1]) || 1) + lines.length - 1
          : lines.length,
        1
      )
    ).length;
    this.style.setProperty('--vk-digits', String(digits));
    const numbering = this.getAttribute('numbering') === 'slice' ? 'slice' : 'file';
    const startNo = numbering === 'file' ? Number((this.getAttribute('lines') || '').match(/^\s*(\d+)/)?.[1]) || 1 : 1;
    const noOf = (n) => startNo + n - 1;

    const rows = [];
    lines.forEach((line, i) => {
      const n = i + 1;
      if (foldSet.has(n)) {
        if (foldStarts.has(n)) {
          const end = foldStarts.get(n);
          const dim = focus.size && !focus.has(n) ? ' is-dim' : '';
          const note = this.getAttribute('fold-note') || (n === end ? `第 ${noOf(n)} 行已折叠` : `${noOf(n)}–${noOf(end)} 行已折叠`);
          rows.push(
            `<div class="vk-line is-fold${dim}" data-line="${noOf(n)}" data-fold-range="${noOf(n)}-${noOf(end)}">${showNums ? '<span class="vk-fold-mark" aria-hidden="true">⋯</span>' : ''}<span class="vk-fold-text">${esc(note)}</span></div>`
          );
        }
        return;
      }
      const cls = ['vk-line'];
      if (hl.has(n)) cls.push('is-hl');
      if (focus.size && !focus.has(n)) cls.push('is-dim');
      const num = showNums ? `<span class="vk-ln" data-meta data-vk-part="ln" aria-hidden="true">${noOf(n)}</span>` : '';
      const part = hl.has(n) ? ' data-vk-part="line"' : '';
      rows.push(
        `<div class="${cls.join(' ')}"${part} data-line="${noOf(n)}" style="--i:${i}">${num}<span class="vk-src">${line || ' '}</span></div>`
      );
    });

    this.innerHTML =
      win({
        surface,
        chrome,
        cls: 'vk-code',
        attrs: ` data-density="${density}"`,
        head: fileHead(file, label, this.getAttribute('lines') || ''),
        inner: `<div class="vk-bd" data-vk-part="bd">${rows.join('')}</div>`,
      });

    if (marks.length) {
      const bodyEl = this.querySelector('.vk-bd');
      bodyEl.querySelectorAll('.vk-src').forEach((el) => markTerms(el, marks));
    }

    // 行内字符区间：span="4:9-12" 指第 4 行第 9–12 个字符（列从 0 起）。
    for (const part of (this.getAttribute('span') || '').split(',')) {
      const m = part.trim().match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/);
      if (!m) {
        if (part.trim()) this._warnOnce('span', `的 span="${part.trim()}" 不是 行:起-止，已忽略`);
        continue;
      }
      const lineNo = Number(m[1]);
      const lineEl = this.querySelector(`.vk-line[data-line="${lineNo}"]`);
      if (!lineEl) {
        this._warnOnce(`span:${lineNo}`, `的 span 指向第 ${lineNo} 行，但这段里没有这一行`);
        continue;
      }
      wrapCharRange(lineEl.querySelector('.vk-src'), Number(m[2]), Number(m[3]), 'vk-char', `c${lineNo}:${m[2]}-${m[3]}`);
    }

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1680, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '';

    // 长行不静默裁切：量一次，clip 时给右缘渐隐；wrap/scroll 是作者显式选择。
    requestAnimationFrame(() => {
      const bd = this.querySelector('.vk-bd');
      if (!bd) return;
      const fit = this.getAttribute('fit') || 'clip';
      const over = fit === 'clip' && bd.scrollWidth > bd.clientWidth + 1;
      if (over) this.dataset.vkOverflow = '';
      else delete this.dataset.vkOverflow;
    });
  }
}

/* ------------------------------------------------------------------- term */

const TERM_EXT =
  /\.(?:py|js|mjs|ts|tsx|jsx|json|md|txt|html|css|ya?ml|toml|lock|log|csv|png|jpe?g|svg|sh|bash|zsh|go|rs|java|c|h|cpp|rb|php|sql)$/i;
const termIsPath = (t) => (t.includes('/') || TERM_EXT.test(t)) && /^[\w.~/-]+$/.test(t);

function commentStart(cmd) {
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === '\\' && quote === '"') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(cmd[i - 1]))) return i;
  }
  return -1;
}

function paintTermCommand(cmd) {
  const hash = commentStart(cmd);
  const head = hash >= 0 ? cmd.slice(0, hash) : cmd;
  const tail = hash >= 0 ? cmd.slice(hash) : '';
  let first = true;
  const painted = head
    .split(/(\s+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)
    .map((part) => {
      if (!part) return '';
      if (/^\s+$/.test(part)) return part;
      if (/^["']/.test(part)) return `<span class="vk-cmd-str">${esc(part)}</span>`;
      if (first) {
        first = false;
        return `<span class="vk-cmd-exe">${esc(part)}</span>`;
      }
      if (/^--?[\w-]+/.test(part)) return `<span class="vk-cmd-flag">${esc(part)}</span>`;
      if (termIsPath(part)) return `<span class="vk-cmd-path">${esc(part)}</span>`;
      if (/^\d+(?:\.\d+)?(?:ms|s|%|px|kb|mb)?$/.test(part)) return `<span class="vk-cmd-num">${esc(part)}</span>`;
      return esc(part);
    })
    .join('');
  return painted + (tail ? `<span class="vk-cmd-comment">${esc(tail)}</span>` : '');
}

export class VkTerm extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-win';

  capture() {
    delete this.dataset.vkParsed;
    warnIfParsed(this);
    this._preSrc = precompiledSource(this);
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    this._raw = null;
    if (!this._src.trim() && this.getAttribute('src')) fetchSource(this);
  }

  onAttr(name) {
    if (name !== 'src') return;
    this._src = '';
    this._raw = null;
    this._preSrc = null;
    if (this.getAttribute('src')) fetchSource(this);
  }

  onFetched(text) {
    this._raw = text;
    this._src = text;
  }

  render() {
    const source = this._raw
      ? sliceLines(dedent(this._raw), this.getAttribute('lines'))
      : dedent(this._src || '');
    const prompt = this.getAttribute('prompt') || '$';
    const title = this.getAttribute('title') || '';
    const density = ['large', 'compact'].includes(this.getAttribute('density')) ? this.getAttribute('density') : 'normal';

    const rows = source
      .split('\n')
      .map((raw) => raw.replace(/\s+$/, ''))
      .filter((line, i, all) => !(line === '' && i === all.length - 1))
      .map((line) => {
        if (line === '$' || line.startsWith('$ ')) {
          const cmd = line === '$' ? '' : line.slice(2);
          return { kind: 'cmd', text: paintTermCommand(cmd), empty: !cmd };
        }
        if (line === prompt || line.startsWith(prompt + ' ')) {
          const cmd = line === prompt ? '' : line.slice(prompt.length + 1);
          return { kind: 'cmd', text: paintTermCommand(cmd), empty: !cmd };
        }
        const m = line.match(/^(✓|!|✗)\s+(.*)$/);
        if (m) {
          const kind = m[1] === '✓' ? 'ok' : m[1] === '!' ? 'warn' : 'err';
          return { kind, sign: m[1], text: esc(m[2]) };
        }
        return { kind: 'out', text: esc(line) || ' ' };
      });


    const body = rows
      .map((r, i) => {
        const sign = r.kind === 'cmd' ? prompt : r.kind === 'out' ? '' : r.sign;
        const signCls = r.kind === 'cmd' ? 'vk-prompt' : r.kind === 'out' ? '' : 'vk-sign';
        const cls = `vk-line is-${r.kind}`;
        const sr = r.kind === 'ok' ? '成功：' : r.kind === 'warn' ? '警告：' : r.kind === 'err' ? '错误：' : '';
        // 输出从 0 列开始：真实终端不会把 stdout 缩进到 prompt 列。
        const signHtml = r.kind === 'out' ? '' : `<span class="${signCls}">${esc(sign || ' ')}</span>`;
        return `<div class="${cls}" style="--i:${i}"><span class="vk-sr">${sr}</span>${signHtml}<span class="vk-txt">${r.text || ' '}</span></div>`;
      })
      .join('');

    const chrome = this.getAttribute('chrome') || 'min';
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';

    this.innerHTML = win({
      surface,
      chrome,
      cls: 'vk-term',
      attrs: ` data-density="${density}"`,
      head: title ? `<span class="vk-file" data-meta>${esc(title)}</span>` : '',
      inner: `<div class="vk-bd" data-vk-part="bd">${body}</div>`,
    });

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1680, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '';
  }
}

export function defineCode() {
  define('vk-code', VkCode);
  define('vk-term', VkTerm);
}
