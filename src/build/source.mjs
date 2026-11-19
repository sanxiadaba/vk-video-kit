/** 构建期：四类源码窗（code / term / diff / asm）。 */
import fs from 'node:fs';
import path from 'node:path';
import { createHighlighter } from 'shiki';
import { attrOf, hasAttr, esc } from '../shared/dom.mjs';
import { parseRange, lineSet } from '../shared/range.mjs';
import { dedent, stripAnsi, SUPPORTED_LANGS, langKey, isAsmLang, langFromSrc } from './code.mjs';
import { parseAsm, splitInsn } from './asm.mjs';
import { SYNTAX, FONT } from '../vocab.mjs';
import { frame } from './frame.mjs';

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

/* ------------------------------------------------------------------ 标词
   mark 可以写多个词（逗号/空格分隔）。整词优先：窗口里只要出现过整词，
   就只标整词；否则回退子串，并报一条 MARK_PARTIAL（hint）。
   每个匹配都是锚点：#c@text:i 按 data-vk-text 找，@item:N 按序号找。 */
const WORD_NEEDLE = /^[A-Za-z0-9_$]+$/;
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeRe = (needle) => new RegExp(`(?<![\\w$])${reEsc(needle)}(?![\\w$])`, 'g');

/** "i" / "i, j" / "i j" → ["i", "j"]（去重，保序）。 */
export function splitMark(value) {
  const out = [];
  for (const piece of String(value ?? '').split(/[,，、\s]+/)) {
    const w = piece.trim();
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

/** 先定每个词在整个窗口里的匹配方式：整词存在就只认整词。 */
function planMarks(needles, sourceText) {
  const whole = new Set();
  for (const needle of needles) {
    if (WORD_NEEDLE.test(needle) && wholeRe(needle).test(sourceText)) whole.add(needle);
  }
  return whole;
}

/** 把一段纯文本里的 needles 包成 mark，其余转义。state 记序号与命中（词/子串）。 */
export function markText(text, needles, state, whole = new Set()) {
  const s = String(text ?? '');
  const list = Array.isArray(needles) ? needles : splitMark(needles);
  if (!list.length) return esc(s);
  state ||= { n: 0 };
  state.n ||= 0;
  state.hits ||= new Map();

  const plans = list.map((needle) => ({ needle, escaped: reEsc(needle), whole: whole.has(needle) }));
  /* 长的先匹配：同一个起点上 "ab" 不能被 "a" 抢先。 */
  const pattern = [...plans]
    .sort((a, b) => b.needle.length - a.needle.length)
    .map((p) => (p.whole ? `(?<![\\w$])${p.escaped}(?![\\w$])` : p.escaped))
    .join('|');
  const byText = new Map(plans.map((p) => [p.needle, p]));
  const out = [];
  let last = 0;
  for (const m of s.matchAll(new RegExp(pattern, 'g'))) {
    out.push(esc(s.slice(last, m.index)));
    const plan = byText.get(m[0]);
    const hit = state.hits.get(plan.needle) || { word: 0, sub: 0 };
    if (plan.whole) hit.word++;
    else hit.sub++;
    state.hits.set(plan.needle, hit);
    const n = ++state.n;
    out.push(`<mark class="vk-mark" data-vk-item="${n}" data-vk-text="${esc(plan.needle)}">${esc(m[0])}</mark>`);
    last = m.index + m[0].length;
  }
  out.push(esc(s.slice(last)));
  return out.join('');
}

function lineHtml(tokens, needles, state, whole) {
  const out = [];
  for (const t of tokens) {
    const cls = COLOR_CLASS[(t.color || '').toUpperCase()] || '';
    const html = needles.length ? markText(t.content, needles, state, whole) : esc(t.content);
    out.push(cls ? `<span class="${cls}">${html}</span>` : html);
  }
  return out.join('');
}

async function highlightLines(code, lang) {
  const hl = await getHighlighter();
  const key = langKey(lang);
  if (!hl.getLoadedLanguages().includes(key)) {
    if (!SUPPORTED_LANGS.has(key)) throw new Error(`不支持的语言 "${lang}"。可用：${[...SUPPORTED_LANGS].join(', ')}`);
    await hl.loadLanguage(key);
  }
  return hl.codeToTokens(code, { lang: key, theme: 'vk' }).tokens;
}

/* ------------------------------------------------------------------ 读源 */
const UTF8 = new TextDecoder('utf-8', { fatal: true });

function inlineSource(node) {
  const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
  if (!s) return null;
  return (s.childNodes || []).map((c) => c.value || '').join('');
}

function readSource(node, ctx, who) {
  const src = attrOf(node, 'src');
  const inline = inlineSource(node);
  if (src && inline != null) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_CONFLICT', message: `${who} 同时写了 src 和内联源码：只能二选一`, fix: '删掉 src，或删掉内联 <script data-vk-source>' });
    return null;
  }
  if (!src && inline == null) return null;
  /* dedent 里已经展开行首 tab，这里不再重复调用。 */
  if (inline != null) return dedent(stripAnsi(inline));
  const abs = ctx.resolveAsset(src);
  if (!abs) {
    ctx.diag(node, { code: 'SRC_MISSING', message: `${who} 的 src="${src}" 找不到文件`, fix: `路径相对页面文件解析：${path.dirname(ctx.label(ctx.file)) || '.'}/` });
    return null;
  }
  const buf = fs.readFileSync(abs);
  if (buf.subarray(0, 4096).includes(0)) {
    ctx.diag(node, { code: 'SRC_BINARY', message: `${who} 的 src="${src}" 是二进制文件，不能当源码读`, fix: '换一个文本文件；二进制用 vk-code as="bytes"' });
    return null;
  }
  /* UTF-8 BOM 不算第一行的内容；解不开就是编码不对，不猜 GBK。 */
  const body = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.subarray(3) : buf;
  let text;
  try {
    text = UTF8.decode(body);
  } catch {
    ctx.diag(node, { code: 'SRC_ENCODING', message: `${who} 的 src="${src}" 不是 UTF-8 文本`, fix: '用编辑器「另存为 UTF-8」后重试' });
    return null;
  }
  return dedent(stripAnsi(text));
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
    let cls = '';
    if (first) {
      cls = 'vk-cmd';
      first = false;
    } else if (/^--?[\w]/.test(tok)) cls = 'vk-flag';
    else if (/^["']/.test(tok)) cls = 'vk-arg-str';
    else if (tok.includes('/')) cls = 'vk-path';
    out.push(cls ? `<span class="${cls}">${esc(tok)}</span>` : esc(tok));
  }
  return out.join(' ');
}

export async function buildSource(node, ctx) {
  const authored = attrOf(node, 'as') || 'code';
  const src = attrOf(node, 'src') || '';
  const langText = attrOf(node, 'lang') || '';
  /* src= 没写 lang 就按扩展名推断；内联没写 lang 就按纯文本，不硬错。 */
  const lang = langText || (src ? langFromSrc(src) : '');
  /* lang 写 asm / nasm / x86-64… 时也是汇编窗；显式 as 优先（term / diff 不受影响）。 */
  const as = authored === 'code' && isAsmLang(lang) ? 'asm' : authored;
  const who = as === 'code' ? '<vk-code>' : `<vk-code as="${as}">`;
  const plain = !lang || langKey(lang) === 'text';

  const text = readSource(node, ctx, who);
  if (text == null) {
    const bad = ['SRC_MISSING', 'SRC_BINARY', 'SRC_ENCODING', 'SRC_CONFLICT'].find((c) => ctx.diag.has(node, c));
    /* 既没 src 也没 script：validate 已经报过 CHILD_MISSING，这里不再用 SRC_MISSING 重说一遍。 */
    if (!bad && !ctx.diag.has(node, 'CHILD_MISSING')) {
      ctx.diag(node, { code: 'SRC_MISSING', message: `${who} 没有内容`, fix: '写 src="文件" 或内联 <script type="text/plain" data-vk-source>' });
    }
    const why = !bad
      ? '缺内容：写 src 或 data-vk-source'
      : bad === 'SRC_ENCODING'
        ? '源码不是 UTF-8：另存为 UTF-8'
        : bad === 'SRC_BINARY'
          ? '源码是二进制文件'
          : bad === 'SRC_CONFLICT'
            ? '只能写 src 或内联源码里的一个'
            : 'src 找不到文件';
    return `<div class="vk-missing">${who} ${why}</div>`;
  }
  /* 有内容才提示 lang：空节点已经由 CHILD_MISSING 说清，不必再叠一条。
     hint 的严重度由 contract/codes.mjs 的 LANG_MISSING 定义，这里不重复声明。 */
  if (as === 'code' && !lang) {
    ctx.diag(node, {
      file: ctx.label(ctx.file),
      line: 1,
      tag: node.tagName,
      code: 'LANG_MISSING',
      message: `${who} 的内联源码没写 lang，按纯文本显示`,
      fix: '补 lang="c" / "js" / "py" 这类；src= 会按扩展名推断',
    });
  }

  const rangeText = attrOf(node, 'range');
  const range = rangeText ? parseRange(rangeText) : null;
  if (rangeText && !range) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_RANGE_ATTR', message: `${who} 的 range="${rangeText}" 不是单段`, fix: '写法："3" / "3-7" / "4-"' });
    return `<div class="vk-missing">range 写法不对</div>`;
  }
  const { start, rows: srcRows, count } = sliceRange(text, range);
  /* 窗口的行号是源码行号：窗口第 1 行就是 start。 */
  const winEnd = start + Math.max(1, srcRows.length) - 1;
  if (range && range[0] > count) {
    ctx.diag(node, { code: 'RANGE_OUT_OF_RANGE', message: `${who} 的 range 超出源码范围（共 ${count} 行）`, fix: `改成 1–${count}` });
    return `<div class="vk-missing">range 超出源码范围</div>`;
  }
  if (range && Number.isFinite(range[1]) && range[1] > count) {
    ctx.diag(node, { code: 'RANGE_OUT_OF_RANGE', message: `${who} 的 range 上界 ${range[1]} 超出源码范围（共 ${count} 行）`, fix: `改成 1–${count}` });
  }

  const foldText = attrOf(node, 'fold');
  const fold = lineSet(foldText);
  const curText = attrOf(node, 'current') || '';
  const cur = curText ? lineSet(curText) : null;
  if (curText && !cur) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'VALUE_LINES', message: `${who} 的 current="${curText}" 不是行段`, fix: '写法："3" / "3-4" / "4-6"' });
  }
  /* current 是源码行号：一行都没落在窗口里，就说清楚是哪一行、窗口在哪。
     有交集时（如 current="4-"）按窗口截断，不因为尾巴越界而报错。 */
  let firstOutside = 0;
  let anyInside = false;
  for (const n of cur || []) {
    if (n >= start && n <= winEnd) anyInside = true;
    else if (!firstOutside || n < firstOutside) firstOutside = n;
  }
  const missedWindow = !!cur && !anyInside && firstOutside;
  if (missedWindow) {
    ctx.diag(node, {
      file: ctx.label(ctx.file),
      line: 1,
      tag: node.tagName,
      code: 'CURRENT_MISSING',
      message: `${who} 的 current="${curText}"：源码第 ${firstOutside} 行不在窗口 ${start}–${winEnd} 内`,
      fix: `current 写源码行号；这个窗口是源码第 ${start}–${winEnd} 行`,
    });
  }

  /* term 没有 mark 这个属性；写了也不标，避免再叠一条 MARK_MISSING。 */
  const needles = as === 'term' ? [] : splitMark(attrOf(node, 'mark'));
  const sourceText = srcRows.join('\n');
  const markWhole = planMarks(needles, sourceText);
  const markState = { n: 0, hits: new Map() };
  /* 没有命中要分开说：一个词都没标 → MISSING；只有子串命中 → PARTIAL（hint）。 */
  const reportMarks = () => {
    for (const needle of needles) {
      const hit = markState.hits.get(needle) || { word: 0, sub: 0 };
      if (!hit.word && !hit.sub) {
        ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'MARK_MISSING', message: `${who} 的 mark="${needle}" 在窗口里找不到`, fix: '改成源码里真实出现、且在 range 内的词' });
      } else if (!hit.word && WORD_NEEDLE.test(needle)) {
        ctx.diag(node, {
          file: ctx.label(ctx.file),
          line: 1,
          tag: node.tagName,
          code: 'MARK_PARTIAL',
          message: `${who} 的 mark="${needle}" 没有整词出现，只按子串标出`,
          fix: '确认要标的就是词里的这一段；要整词就把 mark 改成源码里完整的词',
        });
      }
    }
  };
  const title = attrOf(node, 'title') || '';
  let body = '';
  let digits = String(start + srcRows.length - 1).length;

  /* 有的行被 fold 掉、term/asm 还会跳过空行：current 指过去可能一个都不亮。
     不能静默成功。 */
  const checkCurrent = () => {
    if (cur && !body.includes('is-cur') && !missedWindow) {
      ctx.diag(node, { code: 'CURRENT_MISSING', message: `${who} 的 current="${curText}" 没有命中任何可见行`, fix: '被 fold 掉的行、空行、diff 的 hunk 头不会亮；按窗口里真实可见的源码行号写' });
    }
  };
  let rangeLabel = rangeText || '';

  if (as === 'code') {
    const tokens = plain ? null : await highlightLines(sourceText, lang);
    const out = [];
    let folded = 0;
    srcRows.forEach((line, i) => {
      const srcNo = start + i;
      if (fold?.has(srcNo)) {
        folded++;
        return;
      }
      if (folded) {
        out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
        folded = 0;
      }
      const cls = cur?.has(srcNo) ? ' is-cur' : '';
      const html = tokens ? lineHtml(tokens[i] || [], needles, markState, markWhole) : markText(line, needles, markState, markWhole);
      out.push(`<div class="vk-line${cls}" data-vk-line="${srcNo}"><span class="vk-ln">${srcNo}</span><span class="vk-lc">${html}</span></div>`);
    });
    if (folded) out.push(`<div class="vk-line is-fold" data-meta><span class="vk-ln">⋯</span><span class="vk-lc">省略 ${folded} 行</span></div>`);
    body = out.join('');
  } else if (as === 'term') {
    const prompt = attrOf(node, 'prompt') || '$';
    const out = [];
    srcRows.forEach((line, i) => {
      const srcNo = start + i;
      const t = line.replace(/\s+$/, '');
      if (!t) return;
      const cls = cur?.has(srcNo) ? ' is-cur' : '';
      if (t.startsWith(prompt)) {
        out.push(`<div class="vk-line${cls}" data-vk-line="${srcNo}"><span class="vk-prompt">${esc(prompt)}</span>${cmdHtml(t.slice(prompt.length).trim())}</div>`);
      } else {
        const isErr = /\b(error|Error|ERROR|fatal|failed|not found|No such)\b|错误|失败/.test(t);
        out.push(`<div class="vk-line${cls}" data-vk-line="${srcNo}"><span class="${isErr ? 'vk-errt' : 'vk-out'}">${esc(t)}</span></div>`);
      }
    });
    body = out.join('');
  } else if (as === 'diff') {
    const rows = [];
    let oldNo = 1;
    let newNo = 1;
    srcRows.forEach((line, i) => {
      const srcNo = start + i;
      if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) return;
      if (line.startsWith('@@')) {
        const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
        if (m) {
          oldNo = Number(m[1]);
          newNo = Number(m[3]);
        }
        rows.push({ kind: 'hunk', text: m ? '' : line, header: !!m, src: srcNo });
        return;
      }
      if (line.startsWith('+')) rows.push({ kind: 'add', text: line.slice(1), old: null, new: newNo++, src: srcNo });
      else if (line.startsWith('-')) rows.push({ kind: 'del', text: line.slice(1), old: oldNo++, new: null, src: srcNo });
      else rows.push({ kind: 'same', text: line.replace(/^ /, ''), old: oldNo++, new: newNo++, src: srcNo });
    });
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
    let add = 0;
    let del = 0;
    let maxLn = 0;
    for (const r of rows) {
      if (r.kind === 'hunk') {
        out.push(`<div class="vk-dhunk">${esc(r.text)}</div>`);
        continue;
      }
      const ln = r.kind === 'del' ? r.old : r.new;
      maxLn = Math.max(maxLn, ln || 0);
      if (r.kind === 'add') add++;
      if (r.kind === 'del') del++;
      const cls = r.kind === 'same' ? '' : ` ${r.kind}`;
      out.push(
        `<div class="vk-drow${cls}${cur?.has(r.src) ? ' is-cur' : ''}" data-vk-line="${r.src}"><span class="vk-ln">${ln}</span><span class="vk-sign">${r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span><span class="vk-dc">${markText(r.text, needles, markState, markWhole) || ' '}</span></div>`
      );
    }
    body = out.join('');
    rangeLabel = `+${add} / −${del}`;
    digits = String(maxLn).length;
  } else {
    /* asm：行号同样是源码行号；fold / current 都按源码行号。 */
    const showHex = hasAttr(node, 'hex');
    /* v27 起叫 addr；旧名 show-addr 照收，避免旧文档/旧帧一夜之间多出一列。 */
    const addrText = hasAttr(node, 'show-addr') ? attrOf(node, 'show-addr') : attrOf(node, 'addr');
    const showAddr = addrText !== 'off';
    const parsed = parseAsm(sourceText);
    const out = [];
    let folded = 0;
    let addrLen = 0;
    parsed.rows.forEach((r) => {
      if (r.kind === 'blank') return;
      const srcNo = start - 1 + r.line;
      if (fold?.has(srcNo)) {
        folded++;
        return;
      }
      if (folded) {
        out.push(`<div class="vk-arow vk-alabel" data-meta><span class="vk-ainsn">⋯ 省略 ${folded} 行</span></div>`);
        folded = 0;
      }
      const cls = cur?.has(srcNo) ? ' is-cur' : '';
      if (r.kind === 'label') {
        out.push(`<div class="vk-arow vk-alabel${cls}" data-vk-line="${srcNo}"><span class="vk-ainsn">${esc(`<${r.text}>:`)}</span></div>`);
        return;
      }
      const { mnemonic, operands } = splitInsn(r.text);
      const addrHtml = r.addr ? (/^0x/i.test(r.addr) ? r.addr : `0x${r.addr}`) : '';
      addrLen = Math.max(addrLen, addrHtml.length);
      const mnemonicHtml = needles.length ? markText(mnemonic, needles, markState, markWhole) : esc(mnemonic);
      const opsHtml = (needles.length ? markText(operands, needles, markState, markWhole) : esc(operands))
        .replace(/%[a-z0-9]+/gi, (m) => `<i class="vk-areg">${m}</i>`)
        .replace(/\$?0x[0-9a-f]+/gi, (m) => `<i class="vk-aimm">${m}</i>`);
      out.push(
        `<div class="vk-arow${cls}" data-vk-line="${srcNo}">${showAddr ? `<span class="vk-aaddr">${esc(addrHtml)}</span>` : ''}${
          showHex ? `<span class="vk-abytes">${esc(r.bytes)}</span>` : ''
        }<span class="vk-ainsn">${mnemonicHtml}</span><span class="vk-aops">${opsHtml}</span></div>`
      );
    });
    if (folded) out.push(`<div class="vk-arow vk-alabel" data-meta><span class="vk-ainsn">⋯ 省略 ${folded} 行</span></div>`);
    body = out.join('');
    checkCurrent();
    reportMarks();
    const addrW = Math.max(88, Math.round(addrLen * 0.62 * FONT.caption + 16));
    return frame({ title, body: `<div class="vk-lines" style="--vk-aaddr-w:${addrW}px">${body}</div>`, range: rangeLabel, dots: true, kind: as });
  }

  /* 只有 term 有专属皮；diff / asm 的行样式由行自己的 class 决定。 */
  const cls = as === 'term' ? ' vk-term' : '';
  const dim = as === 'code' && cur && cur.size ? ' data-dim="1"' : '';
  checkCurrent();
  reportMarks();
  return frame({ title, body: `<div class="vk-lines${cls}"${dim}>${body}</div>`, range: rangeLabel, digits, dots: true, kind: as });
}
