import { esc, warnIfParsed, VkElement, define, dedent, hash32, langKey, fetchSource, precompiledSource, numAttr } from './base.mjs';
import { buildRows, parseDiffItems, tokenDiff, sliceLines } from '../shared/code.mjs';
import { wrapRange } from './code-utils.mjs';
import { win, fileHead } from './window.mjs';

/**
 * 上下对照 diff —— 不并排、不铺满整行底色。
 *
 * 读法是"改前这一行 → 改后这一行"，从上往下读；
 * 信号只有三种：行首的 − / +、左侧 4px 色条、被改 token 的 3px 下划线。
 *
 * 源码格式与 git diff 一致：行首 空格 / + / -。
 * 行对与词级区间都在构建期算好（highlight.mjs 写进 data-vk-hl-diff）。
 */
export class VkDiff extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-win';

  capture() {
    delete this.dataset.vkParsed;
    warnIfParsed(this);
    this._preSrc = precompiledSource(this);
    const hl = this.querySelector(':scope > script[data-vk-hl-diff]');
    this._hl = null;
    this._hlHash = null;
    this._hlLang = null;
    if (hl) {
      try {
        this._hl = JSON.parse(hl.textContent);
      } catch {
        /* 损坏的数据按缺失处理 */
      }
      this._hlHash = hl.getAttribute('data-vk-hash');
      this._hlLang = hl.getAttribute('data-vk-lang');
    }
    const clone = this.cloneNode(true);
    clone.querySelectorAll('script[data-vk-hl-diff], script[data-vk-src]').forEach((n) => n.remove());
    this._src = clone.textContent.replace(/\r\n?/g, '\n');
    if (!this._src.trim() && this._preSrc != null) this._src = this._preSrc;
    this._raw = null;
    this._fetched = false;
    if (!this._src.trim() && this.getAttribute('src')) fetchSource(this);
  }

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
    if (name === 'lines' && !this._raw) {
      this._warnOnce('lines', '的 lines 对已内联/预编译片段无效，请重新构建或改用 src');
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
    const file = this.getAttribute('file') || '';
    const chrome = this.getAttribute('chrome') || 'min';
    const showNums = this.getAttribute('numbers') !== 'none';
    const nosum = this.getAttribute('summary') === 'none';
    const mode = (this.getAttribute('variant') || 'unified') === 'split' ? 'split' : 'unified';
    const lang = (this.getAttribute('lang') || this._hlLang || 'text').toLowerCase();

    const items = parseDiffItems(source);
    const rows = buildRows(items);

    const valid =
      this._hl &&
      this._hlHash === hash32(source) &&
      this._hl.length === rows.length &&
      (!this._hlLang || this._hlLang === langKey(lang));

    if (!valid && lang !== 'text') {
      this.stale(this._hl ? '的 diff 数据已过期（源码改过但没重新构建）' : '缺少预编译 diff 数据');
    } else if (valid) {
      delete this.dataset.vkStale;
    }

    let adds = 0;
    let dels = 0;
    let lnL = 0;
    let lnR = 0;
    const unified = [];
    const left = [];
    const right = [];
    const cell = ({ kind, n, html, row }) => {
      const sign = kind === 'del' ? '−' : kind === 'add' ? '+' : '';
      const sr = kind === 'del' ? '删除' : kind === 'add' ? '新增' : '';
      const ln = showNums ? `<span class="vk-ln" aria-hidden="true">${n}</span>` : '';
      return `<div class="vk-dline is-${kind}" data-row="${row}" data-side="${kind}"><span class="vk-sr">${sr}</span><span class="vk-dsign" aria-hidden="true">${sign}</span>${ln}<span class="vk-dsrc">${html || ' '}</span></div>`;
    };
    // 统一视图：旧/新双行号；空号保留列位，读改前改后不会错位。
    const ucell = ({ kind, oldN, newN, html, row }) => {
      const sign = kind === 'del' ? '−' : kind === 'add' ? '+' : '';
      const sr = kind === 'del' ? '删除' : kind === 'add' ? '新增' : '';
      const nums = showNums
        ? `<span class="vk-dnums" aria-hidden="true"><span class="vk-ln">${oldN || ''}</span><span class="vk-ln">${newN || ''}</span></span>`
        : '';
      return `<div class="vk-dline is-${kind}" data-row="${row}" data-side="${kind}"><span class="vk-sr">${sr}</span><span class="vk-dsign" aria-hidden="true">${sign}</span>${nums}<span class="vk-dsrc">${html || ' '}</span></div>`;
    };
    const empty = (row) => `<div class="vk-dline is-empty" data-row="${row}" data-side="empty" aria-hidden="true"></div>`;

    rows.forEach((r, i) => {
      const h = valid ? this._hl[i] : null;
      const L = r.left;
      const R = r.right;
      // 真 git diff 的 hunk 起点：第一条内容行带 oldStart/newStart。
      const startL = L?.oldStart ?? R?.oldStart;
      const startR = R?.newStart ?? L?.newStart;
      if (startL != null) lnL = startL - 1;
      if (startR != null) lnR = startR - 1;

      if (L && R && L.sign === '' && R.sign === '') {
        lnL++;
        lnR++;
        const hl = h?.l || esc(L.text);
        const hr = h?.r || esc(R.text);
        unified.push(ucell({ kind: 'ctx', oldN: lnL, newN: lnR, html: hr, row: i }));
        left.push(cell({ kind: 'ctx', n: lnL, html: hl, row: i }));
        right.push(cell({ kind: 'ctx', n: lnR, html: hr, row: i }));
        return;
      }

      // 左边：只有「改前」
      if (L?.sign === '-') {
        lnL++;
        dels++;
        const html = h?.l || esc(L.text);
        unified.push(ucell({ kind: 'del', oldN: lnL, newN: '', html, row: i }));
        left.push(cell({ kind: 'del', n: lnL, html, row: i }));
      } else if (L?.sign === '+') {
        lnL++;
        adds++;
        const html = h?.l || esc(L.text);
        unified.push(ucell({ kind: 'add', oldN: '', newN: lnL, html, row: i }));
        left.push(cell({ kind: 'add', n: lnL, html, row: i }));
      } else {
        left.push(empty(i));
      }

      // 右边：只有「改后」
      if (R?.sign === '+') {
        lnR++;
        adds++;
        const html = h?.r || esc(R.text);
        unified.push(ucell({ kind: 'add', oldN: '', newN: lnR, html, row: i }));
        right.push(cell({ kind: 'add', n: lnR, html, row: i }));
      } else if (R?.sign === '-') {
        lnR++;
        dels++;
        const html = h?.r || esc(R.text);
        unified.push(ucell({ kind: 'del', oldN: lnR, newN: '', html, row: i }));
        right.push(cell({ kind: 'del', n: lnR, html, row: i }));
      } else {
        right.push(empty(i));
      }
    });

    const changes = Math.max(adds, dels);
    const dnum = String(Math.max(lnL, lnR, 1)).length;
    this.style.setProperty('--vk-dnum-w', `calc(${dnum} * 1ch + var(--vk-s3))`);
    const surface = this.getAttribute('surface') === 'ink' ? 'ink' : 'paper';
    const w = this.hasAttribute('w') ? numAttr(this, 'w', { min: 320, max: 1680, fallback: 0 }) : NaN;

    if (mode === 'split') {
      const pane = (label, body) =>
        win({
          surface,
          chrome,
          cls: 'vk-diff-pane',
          attrs: ` data-label="${esc(label)}" role="group" aria-label="${esc(label)}"`,
          head: `${fileHead(file, '', this.getAttribute('lines') || '')}<span class="vk-dsplit-tag">${label}</span>`,
          inner: `<div class="vk-dbd">${body.join('')}</div>`,
        });
      this.innerHTML = `<div class="vk-diff-split" data-surface="${surface}" data-chrome="${esc(chrome)}" role="group" aria-label="代码对比">${
        nosum ? '' : `<div class="vk-dmeta">${changes} 行改动</div>`
      }<div class="vk-dsplit">${pane('改前', left)}${pane('改后', right)}</div></div>`;
      this.style.width = Number.isFinite(w) ? w + 'px' : '1680px';
    } else {
      this.innerHTML = win({
        surface,
        chrome,
        cls: 'vk-diff',
        head: fileHead(file, 'Diff', this.getAttribute('lines') || ''),
        inner: `${nosum ? '' : `<div class="vk-dmeta">${changes} 行改动</div>`}<div class="vk-dbd">${unified.join('')}</div>`,
      });
      this.style.width = Number.isFinite(w) ? w + 'px' : '';
    }

    // 词级高亮：优先用构建期区间；没有就本地算一次左右 token 差。
    const applyRanges = (el, ranges) => {
      if (!el || !ranges || !ranges.length) return;
      const list = Array.isArray(ranges[0]) ? ranges : [ranges];
      for (const r of list) {
        if (!r || r[0] >= r[1]) continue;
        wrapRange(el, r[0], r[1]);
      }
    };

    const byRow = new Map();
    for (const el of this.querySelectorAll('.vk-dline[data-side="del"], .vk-dline[data-side="add"]')) {
      const i = Number(el.dataset.row);
      if (!byRow.has(i)) byRow.set(i, {});
      byRow.get(i)[el.dataset.side] = el.querySelector('.vk-dsrc');
    }
    for (const [i, pair] of byRow) {
      const h = valid ? this._hl[i] : null;
      if (h?.dl || h?.dr) {
        if (pair.del) applyRanges(pair.del, h.dl);
        if (pair.add) applyRanges(pair.add, h.dr);
      } else if (pair.del && pair.add) {
        const [ra, rb] = tokenDiff(pair.del.textContent, pair.add.textContent);
        applyRanges(pair.del, ra);
        applyRanges(pair.add, rb);
      }
    }
  }
}

export function defineDiff() {
  define('vk-diff', VkDiff);
}
