import {
  esc, dedent, warnIfParsed, fetchSource, hash32, langKey, langLabel, lineSet,
  precompiledSource, numAttr, VkElement, define,
} from './base.mjs';
import { indexRanges, sliceLines, stripAnsi } from '../shared/code.mjs';
import { markTerms, wrapCharRange } from './code-utils.mjs';
import { win, fileHead } from './window.mjs';

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
   * 以前放在 requestAnimationFrame 里，离屏 / 后台标签页不跑 rAF，右缘渐隐就永远不出现，
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
    const file = this.getAttribute('file') || (srcPath ? srcPath.split(/[\\/]/).pop() : '');
    const chrome = this.getAttribute('chrome') || 'min';
    const mass = ['compact', 'hero'].includes(this.getAttribute('mass')) ? this.getAttribute('mass') : 'normal';
    const showNums = this.getAttribute('numbers') !== 'none';
    const marks = (this.getAttribute('mark') || '').split(',').map((s) => s.trim()).filter(Boolean);

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
    const hl = toSlice(lineSet(this.getAttribute('current')));
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
    // data-line / 锚点永远是源文件行号；numbering 只影响左侧打印的数字。
    const noOf = (n) => startNo + n - 1;
    const gutterOf = (n) => (numbering === 'slice' ? n : noOf(n));

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
        attrs: ` data-mass="${mass}"`,
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

/**
 * 自动认命令行提示符。只认"确实像 prompt"的形状：
 *   C:\src\demo> cmd        （Windows cmd / 盘符路径）
 *   PS C:\src> cmd          （PowerShell，带 PS 前缀）
 *   [user@host ~]$ cmd      （bash / zsh，带 user@host 的方括号）
 * 普通输出里的 `price > 5` 没有盘符路径 / PS 前缀 / 方括号，不会命中。
 * 命中的提示符原样作为 sign 显示，后面才是命令。
 */
const AUTO_PROMPTS = [
  /^(PS\s+[A-Za-z]:[\\/][^>\r\n]*>)(?:\s+(.*))?$/,
  /^([A-Za-z]:[\\/][^>\r\n]*>)(?:\s+(.*))?$/,
  /^(\[[^\]\r\n]*@[^\]\r\n]*\][$#%])(?:\s+(.*))?$/,
];

function detectPrompt(line) {
  for (const rx of AUTO_PROMPTS) {
    const m = line.match(rx);
    if (m) return { sign: m[1], cmd: (m[2] || '').trim() };
  }
  return null;
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
      if (termIsPath(part)) return `<span class="vk-cmd-path" data-meta>${esc(part)}</span>`;
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
    const prompts = promptAttr ? [promptAttr] : ['$', '>', 'PS>'];
    const title = this.getAttribute('title') || '';
    const mass = ['compact', 'hero'].includes(this.getAttribute('mass')) ? this.getAttribute('mass') : 'normal';

    const rows = source
      .split('\n')
      .map((raw) => raw.replace(/\s+$/, ''))
      .filter((line, i, all) => !(line === '' && i === all.length - 1))
      .map((line) => {
        if (line === '$' || line.startsWith('$ ')) {
          const cmd = line === '$' ? '' : line.slice(2);
          return { kind: 'cmd', text: paintTermCommand(cmd), empty: !cmd };
        }
        const auto = promptAttr ? null : detectPrompt(line);
        if (auto) {
          return { kind: 'cmd', text: paintTermCommand(auto.cmd), empty: !auto.cmd, sign: auto.sign };
        }
        const hit = prompts.find((p) => line === p || line.startsWith(p + ' '));
        if (hit) {
          const cmd = line === hit ? '' : line.slice(hit.length + 1);
          return { kind: 'cmd', text: paintTermCommand(cmd), empty: !cmd, sign: hit };
        }
        // 结果符号可配：marks="PASS|WARN|FAIL"。默认 ✓ / ! / ✗。
        const marksAttr = String(this.getAttribute('marks') || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
        const okMark = marksAttr[0] || '✓';
        const warnMark = marksAttr[1] || '!';
        const errMark = marksAttr[2] || '✗';
        const rxEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resultRx = new RegExp(`^(${[okMark, warnMark, errMark].map(rxEscape).join('|')})\\s+(.*)$`);
        const m = line.match(resultRx);
        if (m) {
          const kind = m[1] === okMark ? 'ok' : m[1] === warnMark ? 'warn' : 'err';
          return { kind, sign: m[1], text: esc(m[2]) };
        }
        return { kind: 'out', text: esc(line) || ' ' };
      });

    // 提示符认不出来时，整块终端会掉成一片灰字：看起来"正常"，其实命令行/输出
    // 这层结构全丢了。不再多猜提示符（不同 shell 长得都不一样），先明说一句：
    // 有一行像"提示符 + 命令"，但一个命令行都没认出来。
    if (!promptAttr && !rows.some((r) => r.kind === 'cmd')) {
      // 只认「真的像提示符」的前缀：盘符路径、PS、user@host、[user@host]$。
      // 普通输出里出现 `price > 5` 不该被当成提示符——那会变成新的假警报。
      const lineLike = source
        .split('\n')
        .find((l) => /^(?:PS\s+[^>]*|[A-Za-z]:[\\/][^>]*|\[[^\]]*\][$#%]|[^\s]*@[^\s]*)[>$#%]\s+\S/.test(l));
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
        const signCls = r.kind === 'cmd' ? 'vk-prompt' : r.kind === 'out' ? '' : 'vk-sign';
        const cls = `vk-line is-${r.kind}`;
        const sr = r.kind === 'ok' ? '成功：' : r.kind === 'warn' ? '警告：' : r.kind === 'err' ? '错误：' : '';
        // 输出从 0 列开始：真实终端不会把 stdout 缩进到 prompt 列。
        const signHtml = r.kind === 'out' ? '' : `<span class="${signCls}" data-meta>${esc(sign || ' ')}</span>`;
        return `<div class="${cls}" style="--i:${i}"><span class="vk-sr">${sr}</span>${signHtml}<span class="vk-txt">${r.text || ' '}</span></div>`;
      })
      .join('');

    const chrome = this.getAttribute('chrome') || 'min';

    this.innerHTML = win({
      chrome,
      cls: 'vk-term',
      attrs: ` data-mass="${mass}"`,
      head: title ? `<span class="vk-file" data-meta>${esc(title)}</span>` : '',
      inner: `<div class="vk-bd" data-vk-part="bd">${body}</div>`,
    });

    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1920, fallback: 0 }) : NaN;
    this.style.width = Number.isFinite(w) ? w + 'px' : '';
  }
}

export function defineCode() {
  define('vk-code', VkCode);
  define('vk-term', VkTerm);
}
