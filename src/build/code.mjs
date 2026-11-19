/**
 * 源码文本清洗 —— 只在构建期用。
 *
 * 不进程运行时 bundle：这里允许 Node/构建期约定，但不碰 DOM。
 *
 * 同一套规则只有这一份：去缩进、去 ANSI、语言别名。
 */

/** 行首 tab 按 4 列展开 */
export function expandLeadingTabs(line) {
  return String(line).replace(/^[ \t]+/, (ws) => {
    let col = 0;
    for (const ch of ws) col = ch === '\t' ? col + (4 - (col % 4)) : col + 1;
    return ' '.repeat(col);
  });
}

/**
 * 终端转义序列：CSI（`\x1b[31m`、`\x1b[2J`）、OSC（`\x1b]0;标题\x07`）与两字符序列。
 * 只剥颜色/光标控制，不保留颜色：这个库的颜色由设计系统决定，不由终端决定。
 */
const ANSI_RE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-_])|\u009b[0-?]*[ -/]*[@-~]/g;

/** 剥掉 ANSI 转义；返回纯文本。构建期与运行期共用同一份。 */
export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '');
}

/** 去掉源码缩进带来的公共缩进；统一 CRLF。行首 tab 在这一步展开。 */
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

/** Shiki 能加载的语言（langKey 归一后的名字）。只留集合：标签名由 lang 属性自己说。 */
export const SUPPORTED_LANGS = new Set([
  'python',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'bash',
  'asm',
  'json',
  'sql',
  'html',
  'css',
  'c',
  'cpp',
  'csharp',
  'java',
  'rust',
  'go',
  'ruby',
  'php',
  'kotlin',
  'swift',
  'lua',
  'yaml',
  'toml',
  'ini',
  'dockerfile',
  'makefile',
  'diff',
  'markdown',
  'vue',
  'svelte',
  'text',
]);

export const langKey = (lang) => LANG_ALIAS[String(lang || 'text').toLowerCase()] || String(lang || 'text').toLowerCase();

/* 汇编窗的语言名：写了这些就等于 as="asm"（asm.mjs 自己解析，不走 Shiki）。 */
export const ASM_LANGS = new Set(['asm', 'att', 'intel', 'x86', 'x86-64', 'x86_64']);
export const isAsmLang = (lang) => ASM_LANGS.has(langKey(lang));

/** src= 没写 lang 时按扩展名推断；认不出就按纯文本（不硬错）。 */
const EXT_LANG = {
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  js: 'js',
  mjs: 'js',
  ts: 'ts',
  py: 'py',
  rs: 'rust',
  go: 'go',
  java: 'java',
  sh: 'bash',
  bash: 'bash',
  json: 'json',
  sql: 'sql',
};

export function langFromSrc(src) {
  const m = String(src ?? '').split(/[?#]/)[0].match(/\.([A-Za-z0-9]+)$/);
  return (m && EXT_LANG[m[1].toLowerCase()]) || 'text';
}
