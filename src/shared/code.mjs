/**
 * vk 共享纯函数 —— 构建期与运行时唯一的一份。
 *
 * 这里不允许出现 DOM / Node API：src/highlight.mjs、src/runtime/*.mjs
 * 都直接 import 这个文件，et al. 由 esbuild 打进浏览器 bundle。
 *
 * 之前 dedent / hash32 / sliceLines / buildRows / tokenDiff 在构建期和运行时
 * 各有一份，靠注释“保持同步”。现在只有这一份，tests/shared.test.mjs 校验它。
 */

/** 行首 tab 按 4 列展开 */
export function expandLeadingTabs(line) {
  return String(line).replace(/^[ \t]+/, (ws) => {
    let col = 0;
    for (const ch of ws) col = ch === '\t' ? col + (4 - (col % 4)) : col + 1;
    return ' '.repeat(col);
  });
}

/** 去掉源码缩进带来的公共缩进；统一 CRLF。 */
export function dedent(text) {
  let t = String(text).replace(/\r\n?/g, '\n');
  t = t.replace(/^\n+/, '').replace(/\s+$/, '');
  const lines = t.split('\n').map(expandLeadingTabs);
  let min = Infinity;
  for (const l of lines) {
    if (!l.trim()) continue;
    const n = l.match(/^ */)[0].length;
    if (n < min) min = n;
  }
  if (!Number.isFinite(min) || min === 0) return lines.join('\n');
  return lines.map((l) => (l.trim() ? l.slice(min) : '')).join('\n');
}

/** 与 cli/build.mjs 共用的 32 位内容指纹。 */
export function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * "4,6-8" → Set{4,6,7,8}
 *
 * 上限不是性能优化，是安全边界：`highlight="1-100000000"` 以前会直接
 * 分配一亿个 Set 项，把页面卡死。超过 MAX_LINE 的范围直接截断。
 */
export const MAX_LINE = 10000;
export function lineSet(value) {
  const set = new Set();
  for (const part of String(value || '').split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    if (a > MAX_LINE) continue;
    const end = Math.min(Math.max(a, b), MAX_LINE);
    for (let i = a; i <= end; i++) set.add(i);
  }
  return set;
}

/** "12-18" / "7" → 文件里截出的那几行；越界自动收敛，malformed 返回全文。 */
export function sliceLines(text, spec) {
  const raw = String(spec || '').trim();
  if (!raw) return String(text);
  const m = raw.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) return String(text);
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const a = Math.max(1, parseInt(m[1], 10));
  const b = Math.min(lines.length, Math.max(a, m[2] ? parseInt(m[2], 10) : a));
  return lines.slice(a - 1, b).join('\n');
}

/** 真实 git diff / 手写行段 → { sign, text }；hunk 起始行挂在第一条内容行上。 */
export function parseDiffItems(source) {
  const lines = String(source).split('\n');
  const out = [];
  let pendingOld = null;
  let pendingNew = null;
  let sawHunk = false;

  for (const line of lines) {
    if (/^diff --git /.test(line) || /^index /.test(line) || /^--- /.test(line) || /^\+\+\+ /.test(line)) continue;
    const hunk = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunk) {
      pendingOld = Number(hunk[1]);
      pendingNew = Number(hunk[2]);
      sawHunk = true;
      continue;
    }
    if (/^\\ No newline at end of file/.test(line)) continue;
    if (!line) {
      if (sawHunk) continue;
      out.push({ sign: '', text: '' });
      continue;
    }
    const m = line.match(/^([ +-])/);
    const item = m ? { sign: m[1] === ' ' ? '' : m[1], text: line.slice(1) } : { sign: '', text: line };
    if (pendingOld != null && pendingNew != null) {
      item.oldStart = pendingOld;
      item.newStart = pendingNew;
      pendingOld = null;
      pendingNew = null;
    }
    out.push(item);
  }
  return out;
}

/** 把连续的增删配成一对一对的行；上下文行两边都出现。 */
export function buildRows(items) {
  const rows = [];
  let i = 0;
  while (i < items.length) {
    if (!items[i].sign) {
      rows.push({ left: items[i], right: items[i], ctx: true });
      i++;
      continue;
    }
    const chunk = [];
    while (i < items.length && items[i].sign) chunk.push(items[i++]);
    const del = chunk.filter((x) => x.sign === '-');
    const add = chunk.filter((x) => x.sign === '+');
    const n = Math.max(del.length, add.length);
    for (let k = 0; k < n; k++) rows.push({ left: del[k] || null, right: add[k] || null });
  }
  return rows;
}

/* ---------------------------------------------------------------- diff */

/** 把代码行切成 token：字符串 / 注释 / 标识符 / 数字 / 多字符运算符 / 标点 / 空白 */
const TOKEN_RE =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|<=|>=|==|!=|&&|\|\||\+\+|--|->|<<|>>|[-+*/%=<>!&|^~?:;,.()[\]{}]|\s+)/g;

export function tokenize(s) {
  const out = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), start: last, end: m.index });
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), start: last, end: s.length });
  return out;
}

const mergeRanges = (ranges) => {
  const out = [];
  for (const r of ranges.sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
};

/**
 * token 级 diff：`<=` 和 `<` 各算一个整体，不会只标出 `=`。
 * 返回 [左区间[], 右区间[]]，区间是 UTF-16 下标。空白变化不标（看不见）。
 */
export function tokenDiff(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.length * B.length > 60000) return [[[0, a.length]], [[0, b.length]]];
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i].text === B[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const aR = [];
  const bR = [];
  let i = 0;
  let j = 0;
  const push = (list, t) => {
    if (t.text.trim()) list.push([t.start, t.end]);
  };
  while (i < n && j < m) {
    if (A[i].text === B[j].text) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(aR, A[i++]);
    } else {
      push(bR, B[j++]);
    }
  }
  while (i < n) push(aR, A[i++]);
  while (j < m) push(bR, B[j++]);
  return [mergeRanges(aR), mergeRanges(bR)];
}

/* -------------------------------------------------------------- language */

export const LANG_ALIAS = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  'c++': 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  rb: 'ruby',
  kt: 'kotlin',
  yml: 'yaml',
  htm: 'html',
  markup: 'html',
  md: 'markdown',
  docker: 'dockerfile',
  make: 'makefile',
  plaintext: 'text',
  txt: 'text',
  x86asm: 'asm',
  nasm: 'asm',
  assembly: 'asm',
};

/** 扩展名 -> 语言；构建期 inferLang 与运行时文件树共用这一份。 */
export const EXT_LANG = {
  '.c': 'c',
  '.h': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.json': 'json',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.lua': 'lua',
  '.sh': 'bash',
  '.s': 'asm',
  '.asm': 'asm',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.diff': 'diff',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
};

export const inferLang = (file) => {
  const s = String(file || '');
  const dot = s.lastIndexOf('.');
  return dot >= 0 ? EXT_LANG[s.slice(dot).toLowerCase()] || 'text' : 'text';
};
export const LANG_LABEL = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  bash: 'Shell',
  asm: 'ASM',
  json: 'JSON',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  java: 'Java',
  rust: 'Rust',
  go: 'Go',
  ruby: 'Ruby',
  php: 'PHP',
  kotlin: 'Kotlin',
  swift: 'Swift',
  lua: 'Lua',
  yaml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  diff: 'Diff',
  markdown: 'Markdown',
  vue: 'Vue',
  svelte: 'Svelte',
  text: 'Text',
};

export const langKey = (lang) => LANG_ALIAS[String(lang || 'text').toLowerCase()] || String(lang || 'text').toLowerCase();
export const langLabel = (lang) => LANG_LABEL[langKey(lang)] || langKey(lang).toUpperCase();
export const SUPPORTED_LANGS = Object.freeze(Object.keys(LANG_LABEL));
