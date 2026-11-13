/** 构建期：四类源码窗（code / term / diff / asm）。 */
import fs from 'node:fs';
import path from 'node:path';
import { createHighlighter } from 'shiki';
import { attrOf, hasAttr, esc } from '../shared/dom.mjs';
import { parseRange, lineSet } from '../shared/range.mjs';
import { dedent, expandLeadingTabs, stripAnsi, SUPPORTED_LANGS, inferLang, langKey } from '../shared/code.mjs';
import { parseAsm, splitInsn } from '../shared/asm.mjs';
import { SYNTAX } from '../vocab.mjs';
import { frame } from './layout.mjs';

const TOKEN_THEME = {
  name: 'vk',
  type: 'light',
  settings: [
    { settings: { foreground: '#0B0F14', background: '#ffffff' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: SYNTAX.comment[0].toUpperCase() } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.interpolated', 'punctuation.definition.string'], settings: { foreground: SYNTAX.string[0].toUpperCase() } },
    { scope: ['constant.numeric', 'constant.language', 'support.constant', 'constant.character.format.placeholder'], settings: { foreground: SYNTAX.number[0].toUpperCase() } },
    { scope: ['entity.name.function', 'support.function', 'variable.function'], settings: { foreground: SYNTAX.fn[0].toUpperCase() } },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'storage.modifier.array'], settings: { foreground: SYNTAX.operator[0].toUpperCase() } },
    { scope: ['keyword', 'storage.type', 'storage.modifier', 'keyword.control', 'entity.name.type', 'support.type', 'entity.name.class', 'support.class', 'entity.name.tag', 'punctuation.definition.directive'], settings: { foreground: SYNTAX.keyword[0].toUpperCase() } },
  ],
};
const COLOR_CLASS = {
  [SYNTAX.string[0].toUpperCase()]: 's',
  [SYNTAX.comment[0].toUpperCase()]: 'c',
  [SYNTAX.number[0].toUpperCase()]: 'n',
  [SYNTAX.keyword[0].toUpperCase()]: 'k',
  [SYNTAX.fn[0].toUpperCase()]: 'f',
  [SYNTAX.operator[0].toUpperCase()]: 'o',
};

let highlighter = null;
const getHighlighter = async () => {
  highlighter ||= await createHighlighter({ themes: [TOKEN_THEME], langs: [] });
  return highlighter;
};

/** 把一段纯文本里的 needle 包成 mark，其余转义。单词按边界匹配，避免把 i 标进 int。 */
export function markText(text, needle) {
  const s = String(text ?? '');
  if (!needle) return esc(s);
  const word = /^[A-Za-z0-9_$]+$/.test(needle);
  const re = word
    ? new RegExp(`(?<![\\w$])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g')
    : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(re)) {
    out.push(esc(s.slice(last, m.index)));
    out.push(`<mark class="vk-mark">${esc(m[0])}</mark>`);
    last = m.index + m[0].length;
  }
  out.push(esc(s.slice(last)));
  return out.join('');
}

function lineHtml(tokens, needle) {
  const out = [];
  for (const t of tokens) {
    const cls = COLOR_CLASS[(t.color || '').toUpperCase()] || '';
    const html = needle ? markText(t.content, needle) : esc(t.content);
    out.push(cls ? `<span class="${cls}">${html}</span>` : html);
  }
  return out.join('');
}

async function highlightLines(code, lang) {
  const hl = await getHighlighter();
  const key = langKey(lang);
  if (!hl.getLoadedLanguages().includes(key)) {
    if (!SUPPORTED_LANGS.includes(key)) throw new Error(`不支持的语言 "${lang}"。可用：${SUPPORTED_LANGS.join(', ')}`);
    await hl.loadLanguage(key);
  }
  return hl.codeToTokens(code, { lang: key, theme: 'vk' }).tokens;
}

function inlineSource(node) {
  const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
  if (!s) return null;
  return (s.childNodes || []).map((c) => c.value || '').join('');
}

function readSource(node, ctx) {
  const src = attrOf(node, 'src');
  const inline = inlineSource(node);
  if (src && inline != null) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_CONFLICT', message: `<${node.tagName}> 同时写了 src 和内联源码：只能二选一`, fix: '删掉 src，或删掉内联 <script data-vk-source>' });
    return null;
  }
  if (!src && inline == null) return null;
  if (inline != null) return dedent(expandLeadingTabs(stripAnsi(inline)));
  const abs = path.resolve(path.dirname(path.resolve(ctx.file)), src);
  if (!fs.existsSync(abs)) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<${node.tagName}> 的 src="${src}" 找不到文件`, fix: `路径相对页面文件解析：${path.dirname(ctx.label(ctx.file)) || '.'}/` });
    return null;
  }
  ctx.assets.add(abs);
  return dedent(expandLeadingTabs(stripAnsi(fs.readFileSync(abs, 'utf8'))));
}

function sliceRange(text, range) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (!range) return { start: 1, rows: lines, count: lines.length };
  const [a, b] = range;
  const start = Math.max(1, Math.min(lines.length, a));
  const end = Math.min(lines.length, Number.isFinite(b) ? b : lines.length);
  return { start, rows: lines.slice(start - 1, Math.max(start, end)), count: lines.length };
}

function cmdHtml(cmd) {
  const out = [];
  let first = true;
  for (const m of cmd.matchAll(/"[^"]*"|'[^']*'|\S+/g)) {
    const tok = m[0];
    let cls = 'vk-arg';
    if (first) {
      cls = 'vk-cmd';
      first = false;
    } else if (/^--?[\w]/.test(tok)) cls = 'vk-flag';
    else if (/^["']/.test(tok)) cls = 'vk-arg-str';
    else if (tok.includes('/')) cls = 'vk-path';
    out.push(`<span class="${cls}">${esc(tok)}</span>`);
  }
  return out.join(' ');
}

export async function buildSource(node, ctx) {
  const as = attrOf(node, 'as') || 'code';
  const text = readSource(node, ctx);
  if (text == null) {
    if (!ctx.diag.some((d) => d.tag === node.tagName && d.line === 1)) {
      ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `<${node.tagName}> 没有内容`, fix: '写 src="文件" 或内联 <script type="text/plain" data-vk-source>' });
    }
    return `<div class="vk-missing">${esc(node.tagName)} 缺内容：写 src 或 data-vk-source</div>`;
  }

  const rangeText = attrOf(node, 'range');
  const range = rangeText ? parseRange(rangeText) : null;
  if (rangeText && !range) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_RANGE_ATTR', message: `<${node.tagName}> 的 range="${rangeText}" 不是单段`, fix: '写法："3" / "3-7" / "4-"' });
    return `<div class="vk-missing">range 写法不对</div>`;
  }
  const { start, rows: srcRows, count } = sliceRange(text, range);
  if (range && range[0] > count) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'RANGE_OUT_OF_RANGE', message: `<${node.tagName}> 的 range 超出源码范围（共 ${count} 行）`, fix: `改成 1–${count}` });
    return `<div class="vk-missing">range 超出源码范围</div>`;
  }

  const fold = lineSet(attrOf(node, 'fold'));
  const cur = lineSet(attrOf(node, 'current'));
  if (attrOf(node, 'current') && !cur) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `<${node.tagName}> 的 current="${attrOf(node, 'current')}" 不是行段`, fix: '写法："3" / "3-4" / "4-6"' });
  }
  if (cur && [...cur].some((n) => n > srcRows.length)) {
    ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'CURRENT_RANGE', message: `<${node.tagName}> 的 current 越界（窗口里只有 ${srcRows.length} 行）`, fix: `改成 1–${srcRows.length}` });
  }
  const mark = attrOf(node, 'mark') || '';
  if (mark && !text.includes(mark)) ctx.diag.push({ file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'MARK_MISSING', message: `<${node.tagName}> 的 mark="${mark}" 在源码里找不到`, fix: '改成源码里真实出现的词' });
  const title = attrOf(node, 'title') || '';

  let body = '';
  let digits = String(start + srcRows.length - 1).length;
  let rangeLabel = rangeText || '';

  if (as === 'code') {
    const tokens = await highlightLines(srcRows.join('\n'), attrOf(node, 'lang') || 'text');
    const out = [];
    let folded = 0;
    srcRows.forEach((_, i) => {
      const win = i + 1;
      const srcNo = start + i;
      if (fold?.has(win)) {
        folded++;
        return;
      }
      if (folded) {
        out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
        folded = 0;
      }
      const cls = cur?.has(win) ? ' is-cur' : '';
      out.push(`<div class="vk-line${cls}" data-vk-line="${win}" data-src="${srcNo}"><span class="vk-ln">${srcNo}</span><span class="vk-lc">${lineHtml(tokens[i] || [], mark)}</span></div>`);
    });
    if (folded) out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
    body = out.join('');
    digits = String(start + srcRows.length - 1).length;
  } else if (as === 'term') {
    const prompt = attrOf(node, 'prompt') || '$';
    const out = [];
    let win = 0;
    for (const line of srcRows) {
      const t = line.replace(/\s+$/, '');
      if (!t) continue;
      win++;
      if (t.startsWith(prompt)) {
        out.push(`<div class="vk-line${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-prompt">${esc(prompt)}</span>${cmdHtml(t.slice(prompt.length).trim())}</div>`);
      } else {
        const isErr = /\b(error|Error|ERROR|fatal|failed|not found|No such)\b|错误|失败/.test(t);
        out.push(`<div class="vk-line${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="${isErr ? 'vk-errt' : 'vk-out'}">${esc(t)}</span></div>`);
      }
    }
    body = out.join('');
    digits = String(win).length;
  } else if (as === 'diff') {
    const rows = [];
    let oldNo = 1;
    let newNo = 1;
    for (const line of srcRows) {
      if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) continue;
      if (line.startsWith('@@')) {
        const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (m) {
          oldNo = Number(m[1]);
          newNo = Number(m[3]);
        }
        rows.push({ kind: 'hunk', text: m ? '' : line, header: !!m });
        continue;
      }
      if (line.startsWith('+')) rows.push({ kind: 'add', text: line.slice(1), old: null, new: newNo++ });
      else if (line.startsWith('-')) rows.push({ kind: 'del', text: line.slice(1), old: oldNo++, new: null });
      else rows.push({ kind: 'same', text: line.replace(/^ /, ''), old: oldNo++, new: newNo++ });
    }
    const spanOf = (nums) => (Math.min(...nums) === Math.max(...nums) ? `${nums[0]}` : `${Math.min(...nums)}–${Math.max(...nums)}`);
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i];
      if (h.kind !== 'hunk' || !h.header) continue;
      const body2 = [];
      for (let j = i + 1; j < rows.length && rows[j].kind !== 'hunk'; j++) body2.push(rows[j]);
      const dels = body2.filter((r) => r.kind === 'del');
      const adds = body2.filter((r) => r.kind === 'add');
      if (dels.length || adds.length) {
        const changed = (adds.length ? adds : dels).map((r) => (r.kind === 'add' ? r.new : r.old));
        h.text = !dels.length ? `新增第 ${spanOf(changed)} 行` : !adds.length ? `删除第 ${spanOf(changed)} 行` : `改第 ${spanOf(changed)} 行`;
      } else {
        const olds = body2.filter((r) => r.kind === 'same').map((r) => r.old);
        const news = body2.filter((r) => r.kind === 'same').map((r) => r.new);
        const or = spanOf(olds);
        const nr = spanOf(news);
        h.text = or === nr ? `第 ${or} 行` : `旧 ${or} 行 → 新 ${nr} 行`;
      }
    }
    const out = [];
    let win = 0;
    let add = 0;
    let del = 0;
    let maxLn = 0;
    for (const r of rows) {
      if (r.kind === 'hunk') {
        out.push(`<div class="vk-dhunk">${esc(r.text)}</div>`);
        continue;
      }
      win++;
      const ln = r.kind === 'del' ? r.old : r.new;
      maxLn = Math.max(maxLn, ln || 0);
      if (r.kind === 'add') add++;
      if (r.kind === 'del') del++;
      const cls = r.kind === 'same' ? '' : ` ${r.kind}`;
      out.push(
        `<div class="vk-drow${cls}${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-ln">${ln}</span><span class="vk-sign">${r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span><span class="vk-dc">${markText(r.text, mark) || ' '}</span></div>`
      );
    }
    body = out.join('');
    digits = String(maxLn).length;
    rangeLabel = `+${add} / −${del}`;
  } else {
    /* asm */
    const showHex = hasAttr(node, 'hex');
    const parsed = parseAsm(srcRows.join('\n'));
    const out = [];
    let win = 0;
    let addrLen = 0;
    parsed.rows.forEach((r) => {
      if (r.kind === 'blank') return;
      win++;
      if (r.kind === 'label') {
        out.push(`<div class="vk-arow vk-alabel${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"><span class="vk-aaddr"></span><span class="vk-ainsn">${esc(`<${r.text}>:`)}</span></div>`);
        return;
      }
      const { mnemonic, operands } = splitInsn(r.text);
      const addrText = r.addr ? (/^0x/i.test(r.addr) ? r.addr : `0x${r.addr}`) : '';
      addrLen = Math.max(addrLen, addrText.length);
      out.push(
        `<div class="vk-arow${cur?.has(win) ? ' is-cur' : ''}" data-vk-line="${win}"${addrText ? ` data-vk-addr="${esc(addrText)}"` : ''}><span class="vk-aaddr">${esc(addrText)}</span>${
          showHex ? `<span class="vk-abytes">${esc(r.bytes)}</span>` : ''
        }<span class="vk-ainsn">${esc(mnemonic)}</span><span class="vk-aops">${esc(operands)
          .replace(/%[a-z0-9]+/gi, (m) => `<i class="vk-areg">${m}</i>`)
          .replace(/\$?0x[0-9a-f]+/gi, (m) => `<i class="vk-aimm">${m}</i>`)}</span></div>`
      );
    });
    body = out.join('');
    digits = String(win).length;
    const addrW = Math.max(88, Math.round(addrLen * 0.62 * 40 + 16));
    return frame({ title, body: `<div class="vk-lines vk-asm" style="--vk-aaddr-w:${addrW}px">${body}</div>`, range: rangeLabel, dots: true, kind: as });
  }


  const cls = as === 'term' ? ' vk-term' : as === 'diff' ? ' vk-diff' : as === 'asm' ? ' vk-asm' : '';
  const dim = as === 'code' && cur?.size ? ' data-dim="1"' : '';
  return frame({ title, body: `<div class="vk-lines${cls}"${dim}>${body}</div>`, range: rangeLabel, digits, dots: true, kind: as });
}
