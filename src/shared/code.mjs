/**
 * vk 共享纯函数 —— 构建期与运行时唯一的一份。
 *
 * 这里不允许出现 DOM / Node API：src/build.mjs 与 src/runtime/*.mjs 都 import 它，
 * 由 esbuild 打进浏览器 bundle。
 *
 * 同一套规则只有这一份：去缩进、去 ANSI、行段、语言别名。
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
export const SUPPORTED_LANGS = Object.freeze(Object.keys(LANG_LABEL));
