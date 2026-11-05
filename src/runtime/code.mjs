import {
  esc, dedent, warnIfParsed, fetchSource, hash32, langKey, langLabel, lineSet,
  precompiledSource, numAttr, VkElement, define, applyContentSize, fitContent,
} from './base.mjs';
import { indexRanges, sliceLines, stripAnsi } from '../shared/code.mjs';
import { lexShellLine, looksLikePrompt, shellLang, shellLines, tokensToHtml } from '../shared/shell.mjs';
import { markTerms, wrapCharRange } from './code-utils.mjs';
import { hasColumn } from '../shared/vocab.mjs';
import { win, fileHead } from './window.mjs';

/** 表面：paper 是默认；dark / inset 是显式选择。 */
const SURFACES = new Set(['dark', 'inset']);
const surfaceOf = (el) => {
  const v = el.getAttribute('surface');
  return SURFACES.has(v) ? v : 'paper';
};

/**
 * 采集来的终端文本可能带 ANSI 转义（`\x1b[31m`）。
 * 颜色由设计系统决定，不由终端决定：渲染前剥掉，并只提示一次。
 */
function terminalText(el, text) {
  const raw = String(text ?? '');
  const clean = stripAnsi(raw);
  if (clean !== raw) {
    el._warnOnce(
      'ansi',
      '已忽略终端颜色控制符（ANSI 转义）：颜色由设计系统决定，不由终端决定。采集时关掉颜色（如 --color=never / NO_COLOR=1）即可不再提示'
    );
  }
  return clean;
}

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

  /**
   * 长行溢出：同步量一次，不靠 rAF。
   *
   * 画面看起来像"这行完整"。这里直接读 scrollWidth / clientWidth：读一次强制布局，
   * 但只在渲染时和尺寸变化时各一次，成本可控。
   */
  _measureOverflow() {
    const bd = this.querySelector('.vk-bd');
    if (!bd) return;
    const fit = this.getAttribute('long') || 'clip';
    // clientWidth 为 0 时量不出来（display:none），保持现状，交给 ResizeObserver 再量。
    const over = fit === 'clip' && bd.clientWidth > 0 && bd.scrollWidth > bd.clientWidth + 1;
    if (over) this.dataset.vkOverflow = '';
    else delete this.dataset.vkOverflow;
  }

  _watchOverflow() {
    this._measureOverflow();
    if (typeof ResizeObserver !== 'function') return;
    this._ro?.disconnect();
    const bd = this.querySelector('.vk-bd');
    if (!bd) return;
    this._ro = new ResizeObserver(() => this._measureOverflow());
    this._ro.observe(bd);
  }

  render() {
    const full = dedent(terminalText(this, this._raw ?? this._src ?? ''));
    const source = this._raw ? sliceLines(full, this.getAttribute('lines')) : full;
    const lang = (this.getAttribute('lang') || this._hlLang || 'text').toLowerCase();
    const label = langLabel(lang);
    // 没有显式 file 时从 src 取文件名：窗头有 chip，读者才知道这段代码从哪来。
    const srcPath = this.getAttribute('src') || '';
    // 窗头必须有"来源"：file → src 的文件名 → "源码"。默认窗口不能只剩三个点。
    const file = this.getAttribute('file') || (srcPath ? srcPath.split(/[\\/]/).pop() : '') || '源码';
    const chrome = this.getAttribute('chrome') || 'min';
    const mass = ['compact', 'hero'].includes(this.getAttribute('mass')) ? this.getAttribute('mass') : 'normal';
    const showNums = hasColumn(this, 'vk-code', 'numbers');
    this.dataset.numbers = showNums ? 'all' : 'none';
    const marks = (this.getAttribute('mark') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const revealRaw = this.getAttribute('reveal');
    this.dataset.reveal = revealRaw === 'line' || revealRaw === 'none' ? revealRaw : 'all';

    const parsed = source.split('\n').map((text) => ({ text, sign: '' }));
    const hash = hash32(source);
    const langOk = this._hlLang ? this._hlLang === langKey(lang) : false;
    const valid = this._hl && this._hlHash === hash && this._hl.length === parsed.length && langOk;

    if (valid) delete this.dataset.vkStale;
    else if (!this._hl) this.stale('缺少预编译数据（先跑 vk build）');
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
    // 行号只有一个基准：源文件行号。highlight / focus / fold / span / #id@line 全用它。
    const startNo = Number((this.getAttribute('lines') || '').match(/^\s*(\d+)/)?.[1]) || 1;
    const toSlice = (set) =>
      new Set([...set].map((v) => v - startNo + 1).filter((v) => v >= 1 && v <= lines.length));
    const hl = toSlice(lineSet(this.getAttribute('current') || ''));
    const focus = toSlice(lineSet(this.getAttribute('focus')));
    // 真折叠：区间内的行不渲染；只在区间开头留一条"几行已折叠"。
    const foldSet = new Set();
    const foldStarts = new Map();
    for (const part of (this.getAttribute('fold') || '').split(',')) {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const rawA = parseInt(m[1], 10) - startNo + 1;
      const rawB = parseInt(m[2] || m[1], 10) - startNo + 1;
      const a = Math.max(1, rawA);
      const b = Math.min(Math.max(a, rawB), lines.length);
      if (rawB < 1 || rawA > lines.length) continue;
      foldStarts.set(a, b);
      for (let n = a; n <= b; n++) foldSet.add(n);
    }
    const digits = String(Math.max(startNo + lines.length - 1, 1)).length;
    this.style.setProperty('--vk-digits', String(digits));
    const noOf = (n) => startNo + n - 1;
    const gutterOf = noOf;

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
      const num = showNums ? `<span class="vk-ln" data-meta data-vk-part="ln" aria-hidden="true">${gutterOf(n)}</span>` : '';
      const part = hl.has(n) ? ' data-vk-part="line"' : '';
      rows.push(
        `<div class="${cls.join(' ')}"${part} data-line="${noOf(n)}" style="--i:${i}">${num}<span class="vk-src">${line || ' '}</span></div>`
      );
    });

    this.innerHTML =
      win({
        chrome,
        cls: 'vk-code',
        attrs: ` data-mass="${mass}" data-surface="${surfaceOf(this)}"`,
        head: fileHead(file, label, this.getAttribute('lines') || ''),
        inner: `<div class="vk-bd" data-vk-part="bd">${rows.join('')}</div>`,
      });

    if (marks.length) {
      const bodyEl = this.querySelector('.vk-bd');
      bodyEl.querySelectorAll('.vk-src').forEach((el) => markTerms(el, marks));
    }

    // 行内字符区间：omit="4:9-12" 指第 4 行第 9–12 个字符（列从 0 起）。
    // 属性叫 omit 而不是 span：span 已经归布局（占几份），一个概念只能有一个名字。
    for (const part of (this.getAttribute('omit') || '').split(',')) {
      const m = part.trim().match(/^(\d+)\s*:\s*(\d+)\s*-\s*(\d+)$/);
      if (!m) {
        if (part.trim()) this._warnOnce('omit', `的 omit="${part.trim()}" 不是 行:起-止，已忽略`);
        continue;
      }
      const lineNo = Number(m[1]);
      const lineEl = this.querySelector(`.vk-line[data-line="${lineNo}"]`);
      if (!lineEl) {
        this._warnOnce(`omit:${lineNo}`, `的 omit 指向第 ${lineNo} 行，但这段里没有这一行`);
        continue;
      }
      wrapCharRange(lineEl.querySelector('.vk-src'), Number(m[2]), Number(m[3]), 'vk-char', `c${lineNo}:${m[2]}-${m[3]}`);
    }

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1920, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '';

    // 长行不静默裁切：同步量一次，clip 时给右缘渐隐；wrap/scroll 是作者显式选择。
    this._watchOverflow();
    // 内容字号 / 铺满：只写宿主变量，所有行内尺寸都从它派生。
    applyContentSize(this);
  }

  place() {
    fitContent(this, '.vk-bd');
  }
}

/* ------------------------------------------------------------------- term */

/*
 * 命令行的词法在 src/shared/shell.mjs：构建期（src/highlight.mjs）与运行期
 * 的猜法——命令名一色、其余全灰；两份实现就是那样分叉出来的。
 */

export class VkTerm extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-win';

  capture() {
    delete this.dataset.vkParsed;
    warnIfParsed(this);
    this._preSrc = precompiledSource(this);
    // 构建期算好的逐行 token；运行期只在 hash/属性对不上时用共享词法重算。
    const data = this.querySelector(':scope > script[data-vk-term]');
    this._term = null;
    if (data) {
      try {
        const d = JSON.parse(data.textContent);
        if (d && Array.isArray(d.lines)) this._term = d;
      } catch {
        /* 损坏的 token 数据按缺失处理，运行期会自己切 */
      }
    }
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-src], script[data-vk-term]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    this._raw = null;
    if (!this._src.trim() && this.getAttribute('src')) fetchSource(this);
    if (this.getAttribute('src') && !this._preSrc && !this._src.trim()) this.stale('缺少预编译终端数据');
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
    delete this.dataset.vkStale;
  }

  render() {
    const clean = terminalText(
      this,
      this._raw ? dedent(this._raw) : dedent(this._src || '')
    );
    const source = this._raw ? sliceLines(clean, this.getAttribute('lines')) : clean;
    // 提示符：作者写 prompt 就用它；不写则自动认三种常见写法。
    // 采集来自 Windows 时是 ">"，来自 PowerShell 时可能带路径，来自 bash 时是 "$"。
    const promptAttr = this.getAttribute('prompt');
    const prompts = promptAttr ? [promptAttr] : null;
    const marksRaw = String(this.getAttribute('marks') || '');
    const marks = marksRaw.split('|').map((s) => s.trim()).filter(Boolean);
    const lang = shellLang(this.getAttribute('lang') || 'sh');
    const revealRaw = this.getAttribute('reveal');
    const reveal = revealRaw === 'line' || revealRaw === 'none' ? revealRaw : 'all';
    const title = this.getAttribute('title') || '';
    // 窗头要有"来源"：title → src 的文件名 → 终端。默认窗口不能只剩三个点。
    const srcName = (this.getAttribute('src') || '').split(/[\\/]/).pop() || '';
    const headLabel = title || srcName || '终端';
    const mass = ['compact', 'hero'].includes(this.getAttribute('mass')) ? this.getAttribute('mass') : 'normal';

    this.dataset.lang = lang;
    this.dataset.reveal = reveal;

    const lines = shellLines(source);
    // 构建期已经切好的话直接用；hash / lang / prompt / marks 任一不符就自己切。
    const built = this._term;
    const usable =
      built &&
      built.hash === hash32(source) &&
      built.lang === lang &&
      (built.prompt || '') === (promptAttr || '') &&
      (built.marks || '') === marksRaw &&
      built.lines.length === lines.length;
    const rows = lines.map((line, i) => (usable ? built.lines[i] : lexShellLine(line, { lang, prompts, marks })));
    // 诊断/测试用：这一块到底用的是构建期 token，还是运行时重切。
    if (usable) this.dataset.vkTermUsed = '1';
    else delete this.dataset.vkTermUsed;

    // 指一行：current 是正式名，line 是同一概念的别名（current 优先）。
    const startNo = Number((this.getAttribute('lines') || '').match(/^\s*(\d+)/)?.[1]) || 1;
    const currentRaw = this.getAttribute('current') || '';
    const currentSet = new Set([...lineSet(currentRaw)].map((v) => v - startNo + 1));

    // 提示符认不出来时，整块终端会掉成一片灰字：看起来"正常"，其实命令行/输出
    // 这层结构全丢了。不再多猜提示符（不同 shell 长得都不一样），先明说一句：
    // 有一行像"提示符 + 命令"，但一个命令行都没认出来。
    if (!promptAttr && lang !== 'none' && !rows.some((r) => r.kind === 'cmd')) {
      // 只认「真的像提示符」的前缀：盘符路径、PS、user@host、[user@host]$。
      // 普通输出里出现 `price > 5` 不该被当成提示符——那会变成新的假警报。
      const lineLike = lines.find(looksLikePrompt);
      if (lineLike) {
        this._warnOnce(
          'prompt',
          `没有认出任何命令行：有一行像提示符（"${lineLike.trim().slice(0, 40)}"），但它不是 $ / > / PS>，也不像盘符路径、PS 前缀或 [user@host] 提示符。用 prompt="..." 指明，否则整块都会画成输出。`
        );
      }
    }

    const body = rows
      .map((r, i) => {
        const sign = r.kind === 'cmd' ? r.sign || promptAttr || '$' : r.kind === 'out' ? '' : r.sign;
        const signCls = r.kind === 'cmd' ? 'vk-prompt vk-tok-prompt' : r.kind === 'out' ? '' : 'vk-sign';
        const isHl = currentSet.has(i + 1);
        const cls = `vk-line is-${r.kind}${isHl ? ' is-hl' : ''}`;
        const sr = r.kind === 'ok' ? '成功：' : r.kind === 'warn' ? '警告：' : r.kind === 'err' ? '错误：' : '';
        // 输出从 0 列开始：真实终端不会把 stdout 缩进到 prompt 列。
        const signHtml = r.kind === 'out' ? '' : `<span class="${signCls}" data-meta>${esc(sign || ' ')}</span>`;
        const text = tokensToHtml(r.tokens) || ' ';
        return `<div class="${cls}" data-line="${startNo + i}" style="--i:${i}"><span class="vk-sr">${sr}</span>${signHtml}<span class="vk-txt">${text}</span></div>`;
      })
      .join('');

    const chrome = this.getAttribute('chrome') || 'min';
    // chrome="none" 时标题默认不渲染：外层的 panel 已经有标题带，终端再画一次
    // 就是两个标题。title 只留作无障碍名；确实要显示，才写 title-show。
    const showTitle = chrome === 'none' && this.hasAttribute('title-show') && !!title;
    this.dataset.titleShow = this.hasAttribute('title-show') ? '' : '0';
    if (chrome === 'none' && title) {
      if (!this.hasAttribute('role')) {
        this.setAttribute('role', 'group');
        this._vkRole = true;
      }
      this.setAttribute('aria-label', title);
      this._vkAria = true;
    } else if (this._vkAria) {
      this.removeAttribute('aria-label');
      if (this._vkRole) this.removeAttribute('role');
      this._vkAria = false;
      this._vkRole = false;
    }

    this.innerHTML = win({
      chrome,
      cls: 'vk-term',
      attrs: ` data-mass="${mass}" data-surface="${surfaceOf(this)}"`,
      head: chrome !== 'none' ? `<span class="vk-file" data-meta>${esc(headLabel)}</span>` : '',
      inner: `${showTitle ? `<div class="vk-term-title" data-meta>${esc(title)}</div>` : ''}<div class="vk-bd" data-vk-part="bd">${body}</div>`,
    });

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1920, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '';
    applyContentSize(this);
  }

  place() {
    fitContent(this, '.vk-bd');
  }
}

export function defineCode() {
  define('vk-code', VkCode);
  define('vk-term', VkTerm);
}
