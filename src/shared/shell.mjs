/**
 * 终端 / 汇编词法 —— 构建期与运行期唯一的一份。
 *
 * 为什么要有这一层：
 * 于是一行 transcript 只有「命令名」和「灰字」两种颜色：参数、路径、输出、
 * 报错全是一个色，`gcc -E hello.c -o hello.i` 读起来就是一串同色文字。
 * 这里把一行切成 token，再交给语义色；vk-asm 的指令也用同一张表。
 *
 * 三条硬规矩：
 * 1. 只认形状，不猜语义。命令里认不出的参数保持原色（不额外切 span）；
 *    输出 / stderr 整行落 out / err —— 任何一行都有颜色，绝不整行丢色。
 * 2. 输出结构与 vk-code 的高亮一致：`<span class="vk-tok-…" data-tok="…">`。
 * 3. 这张表是唯一的：src/highlight.mjs（构建期）与 src/runtime/code.mjs
 *    （运行期）都 import 它，不允许第二份实现。
 *
 * 这里不许出现 DOM / Node API：浏览器 bundle 会把它整个打进去。
 */

import { isAsmNoise } from './asm.mjs';

const LANG_ALIAS = {
  sh: 'sh',
  shell: 'sh',
  bash: 'sh',
  zsh: 'sh',
  dash: 'sh',
  powershell: 'powershell',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  asm: 'asm',
  nasm: 'asm',
  x86asm: 'asm',
  assembly: 'asm',
  none: 'none',
  text: 'none',
  plain: 'none',
  plaintext: 'none',
};

/** 归一化 lang；认不出的按 sh（构建期 registry 已经拦过未知值）。 */
export function shellLang(raw) {
  return LANG_ALIAS[String(raw ?? 'sh').trim().toLowerCase()] || 'sh';
}

/**
 * 语义 token → span 类名。**唯一定义**。
 *
 * 颜色全部来自已有语义令牌（墨阶 / info / focus / ok / err），不新增色相；
 * 类名沿用 vk-code 的 `vk-` 前缀与 `data-tok` 结构，两个组件看起来是一套东西。
 */
export const TOKEN_CLASS = Object.freeze({
  prompt: 'vk-tok-prompt',
  cmd: 'vk-tok-cmd',
  flag: 'vk-tok-flag',
  path: 'vk-tok-path',
  string: 'vk-tok-str',
  num: 'vk-tok-num',
  out: 'vk-tok-out',
  err: 'vk-tok-err',
  var: 'vk-tok-var',
  comment: 'vk-tok-comment',
  punct: 'vk-tok-punct',
  reg: 'vk-tok-reg',
  imm: 'vk-tok-imm',
  addr: 'vk-tok-addr',
});

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * token 数组 → HTML。空白 token（k 为空）原样输出，不包 span。
 * 提示符单独成列（.vk-prompt）；正文 token 拼回去与输入逐字节相同，
 * tests/shell.test.mjs 守着这条不变量。
 */
export function tokensToHtml(tokens) {
  let out = '';
  for (const tok of tokens || []) {
    const text = tok?.t;
    if (!text) continue;
    if (!tok.k) {
      out += esc(text);
      continue;
    }
    const cls = TOKEN_CLASS[tok.k] || TOKEN_CLASS.out;
    out += `<span class="${cls}" data-tok="${esc(tok.k)}">${esc(text)}</span>`;
  }
  return out;
}

/* ---------------------------------------------------------------- 提示符 */

/**
 * transcript → 行。构建期与运行期都用这一份：去行尾空白、CRLF 归一、
 * 丢掉末尾那一个空行（文件末尾的换行不算一行）。
 */
export function shellLines(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line, i, all) => !(line === '' && i === all.length - 1));
}

/** 作者的提示符写法（没写 prompt 时按这几个认）。 */
export const DEFAULT_PROMPTS = ['$', '>', 'PS>'];

/**
 * 自动认命令行提示符。只认「确实像 prompt」的形状：
 *   C:\src\demo> cmd        （Windows cmd / 盘符路径）
 *   PS C:\src> cmd          （PowerShell，带 PS 前缀）
 *   [user@host ~]$ cmd      （bash / zsh，带 user@host 的方括号）
 * 普通输出里的 `price > 5` 没有盘符路径 / PS 前缀 / 方括号，不会命中。
 */
const AUTO_PROMPTS = [
  /^(PS\s+[A-Za-z]:[\\/][^>\r\n]*>)(?:\s+(.*))?$/,
  /^([A-Za-z]:[\\/][^>\r\n]*>)(?:\s+(.*))?$/,
  /^(\[[^\]\r\n]*@[^\]\r\n]*\][$#%])(?:\s+(.*))?$/,
];

/** 认出这一行的提示符与命令；认不出返回 null。 */
export function detectShellPrompt(line, prompts = DEFAULT_PROMPTS) {
  const s = String(line ?? '');
  for (const rx of AUTO_PROMPTS) {
    const m = s.match(rx);
    if (m) return { sign: m[1], cmd: (m[2] || '').trim() };
  }
  for (const p of prompts || []) {
    if (!p) continue;
    if (s === p) return { sign: p, cmd: '' };
    if (s.startsWith(p + ' ')) return { sign: p, cmd: s.slice(p.length + 1) };
  }
  return null;
}

/* ---------------------------------------------------------------- 分词 */

/**
 * shell 的词边界：空白 / 引号串 / 操作符。引号内的空格不切。
 * 输出覆盖整行，拼接后 === 输入。
 */
const OP_RE = /^(?:2>&1|2>>|2>|1>|&&|\|\||>>|[|;&<>()])/;

function splitShell(text) {
  const s = String(text ?? '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j++;
      out.push({ t: s.slice(i, j), k: '' });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '\\' && ch === '"') {
          j += 2;
          continue;
        }
        if (s[j] === ch) {
          j++;
          break;
        }
        j++;
      }
      out.push({ t: s.slice(i, j), k: 'string' });
      i = j;
      continue;
    }
    const op = s.slice(i).match(OP_RE);
    if (op) {
      out.push({ t: op[0], k: 'punct' });
      i += op[0].length;
      continue;
    }
    let j = i;
    while (j < s.length) {
      const c = s[j];
      if (/\s/.test(c) || c === '"' || c === "'") break;
      if (OP_RE.test(s.slice(j))) break;
      j++;
    }
    out.push({ t: s.slice(i, j), k: '' });
    i = j;
  }
  return out;
}

/**
 * 扩展名表：没有目录分隔符时，靠扩展名认路径（`hello.c` / `hello.i` / `hello.exe`）。
 *
 * 只收「像文件名的后缀」：源码 / 文档 / 图片 / 构建产物。`hello` 这种没有后缀的
 * 输出名仍然当普通参数（它分不清是文件名还是字符串）。
 */
const PATH_EXT =
  /\.(?:py|js|mjs|cjs|ts|tsx|jsx|json|md|txt|html?|css|ya?ml|toml|lock|log|csv|png|jpe?g|gif|webp|svg|ico|sh|bash|zsh|ps1|go|rs|java|kt|swift|lua|c|h|cc|cpp|cxx|hpp|rb|php|sql|exe|dll|so|dylib|o|obj|lib|a|s|asm|i|diff|patch|bin|dat|wasm|zip|gz|tar)$/i;
const PATH_SHAPE = /^(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|~[\\/]|[\\/])?[\w.@+~$\u4e00-\u9fff-]+(?:[\\/][\w.@+~$\u4e00-\u9fff-]+)*[\\/]?$/;

/** 像不像路径：有分隔符，或带已知扩展名。 */
export function isShellPath(word) {
  const t = String(word || '');
  if (!t || !PATH_SHAPE.test(t)) return false;
  if (/[\\/]/.test(t)) return true;
  return PATH_EXT.test(t);
}

const FLAG_RE = /^--?[A-Za-z0-9][\w-]*(?:=[^\s]*)?$/;
const NUM_RE = /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?)(?:ms|us|ns|s|%|px|kb|mb|gb|tb)?$/i;
const ASSIGN_RE = /^[A-Za-z_]\w*(?:\[[^\]]*\])?=/;
const VAR_RE = /^(?:\$\{?[\w@#?*!$-]+\}?|%[\w]+%|\$env:\w+)$/i;

/** `sudo gcc …` / `time make`：后面那个词才是命令。 */
const WRAPPERS = new Set(['sudo', 'doas', 'env', 'time', 'nice', 'command', 'builtin', 'xargs', 'watch', 'nohup', 'exec']);

/** 两段式命令的第二个词（`git diff` / `cargo build`）；只认已知子命令，不瞎猜。 */
const SUBCOMMANDS = {
  git: new Set(['diff', 'status', 'log', 'add', 'commit', 'push', 'pull', 'clone', 'checkout', 'init', 'show', 'branch', 'merge', 'rebase', 'stash', 'remote', 'tag', 'config']),
  npm: new Set(['run', 'test', 'install', 'i', 'ci', 'publish', 'exec', 'start', 'build', 'ls', 'init']),
  npx: new Set(['run', 'test', 'build']),
  cargo: new Set(['build', 'run', 'test', 'check', 'clippy', 'fmt', 'new', 'add', 'publish', 'doc']),
  go: new Set(['build', 'run', 'test', 'mod', 'get', 'vet', 'fmt', 'install', 'env']),
  docker: new Set(['build', 'run', 'ps', 'images', 'pull', 'push', 'logs', 'exec', 'compose', 'rm', 'start', 'stop']),
  kubectl: new Set(['get', 'apply', 'delete', 'describe', 'logs', 'exec', 'create', 'set']),
  python: new Set(['-m']),
  python3: new Set(['-m']),
  pip: new Set(['install', 'uninstall', 'list', 'freeze']),
  pip3: new Set(['install', 'uninstall', 'list', 'freeze']),
  make: new Set([]),
};

/** 行内注释的起点：`#` 在行首或空白之后，且不在引号里。 */
function commentStart(cmd) {
  let quote = null;
  const s = String(cmd ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
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
    if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return i;
  }
  return -1;
}

/** 一条命令（提示符之后的部分）→ token。 */
function lexCommand(cmd) {
  const s = String(cmd ?? '');
  const hash = commentStart(s);
  const body = hash >= 0 ? s.slice(0, hash) : s;
  const tail = hash >= 0 ? s.slice(hash) : '';
  const parts = splitShell(body);
  if (tail) parts.push({ t: tail, k: 'comment' });

  let cmdSeen = false;
  let pendingCmd = false;
  let subOf = '';
  for (const part of parts) {
    if (!part.t.trim()) continue;
    if (part.k === 'punct' || part.k === 'comment') continue;
    const word = part.t;
    if (part.k === 'string') {
      if (!cmdSeen) {
        part.k = 'cmd';
        cmdSeen = true;
      }
      continue;
    }
    if (pendingCmd) {
      if (FLAG_RE.test(word)) {
        part.k = 'flag';
        continue;
      }
      part.k = 'cmd';
      pendingCmd = false;
      subOf = word;
      continue;
    }
    if (!cmdSeen) {
      // `FOO=bar cmd`：赋值是修饰，不是命令。
      if (ASSIGN_RE.test(word)) {
        part.k = 'var';
        continue;
      }
      part.k = 'cmd';
      cmdSeen = true;
      subOf = word;
      if (WRAPPERS.has(word)) pendingCmd = true;
      continue;
    }
    if (FLAG_RE.test(word)) {
      part.k = 'flag';
      continue;
    }
    if (SUBCOMMANDS[subOf] && SUBCOMMANDS[subOf].has(word)) {
      part.k = 'cmd';
      continue;
    }
    if (isShellPath(word)) {
      part.k = 'path';
      continue;
    }
    if (NUM_RE.test(word)) {
      part.k = 'num';
      continue;
    }
    if (VAR_RE.test(word)) {
      part.k = 'var';
      continue;
    }
    // 认不出的参数保持原样（继承命令行的墨阶 primary）：
    // 它不是「输出」，也不该被当成第二种语法色；更重要的是不额外切一层 span。
  }
  return parts;
}

/**
 * 普通输出行（或 stderr）→ 一个 token。
 *
 * 输出是**数据**，不是语法：整行一个颜色，不再按词切。这样 `Hello, World!`
 * 和 `printf("%s\n", s);` 仍然是一段连续的文本（排版、换行、可复制性都不变），
 * 也避免把 diff 正文、日志里的每个词都涂成不同颜色——那是噪声，不是表达。
 */
function lexOutput(text, tone) {
  return [{ t: String(text ?? ''), k: tone === 'err' ? 'err' : 'out' }];
}

/* ---------------------------------------------------------------- 汇编 */

const ASM_REG_RE = /^%[a-z][a-z0-9]*$/i;
const ASM_BYTE_RE = /^[0-9a-f]{1,3}$/i;
const ASM_PREFIX = new Set(['lock', 'rep', 'repz', 'repnz', 'repe', 'repne']);

/** x86 常见寄存器；AT&T 带 %，Intel 写法不带。 */
const REGISTERS = new Set([
  'al', 'ah', 'ax', 'eax', 'rax', 'bl', 'bh', 'bx', 'ebx', 'rbx', 'cl', 'ch', 'cx', 'ecx', 'rcx',
  'dl', 'dh', 'dx', 'edx', 'rdx', 'si', 'esi', 'rsi', 'di', 'edi', 'rdi', 'sp', 'esp', 'rsp',
  'bp', 'ebp', 'rbp', 'ip', 'eip', 'rip', 'cs', 'ds', 'es', 'fs', 'gs', 'ss', 'flags', 'eflags', 'rflags',
  'st', 'st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6', 'st7', 'eiz', 'riz',
]);

const asmReg = (word) => {
  const w = String(word || '').toLowerCase();
  if (ASM_REG_RE.test(w)) return true;
  if (REGISTERS.has(w)) return true;
  return /^(?:xmm|ymm|zmm|mm|cr|dr)\d{1,2}$/.test(w);
};

/** objdump 的机器码列：`f3` `c3` `8d` 这种 1–2 位十六进制，连续出现。 */
const ASM_BYTE_TOKEN = /^[0-9a-f]{1,2}(?![0-9a-z_])/i;

/**
 * 汇编一行 → token。mnemonic=true 时，第一个非空白词是助记符（cmd 色）。
 * 操作数里：寄存器 / 立即数 / 地址 / 注释 各自一色，其余退到 out。
 *
 * 也收「objdump 原行」：`  401000:\tf3 c3  repz ret`。地址后面的连续
 * 1–2 位十六进制是机器码，不是助记符——不跳过它，`f3` 会被涂成命令名。
 */
export function tokenizeAsm(text, { mnemonic = true } = {}) {
  const s = String(text ?? '');
  const out = [];
  let i = 0;
  let firstWord = !!mnemonic;
  let bytesPending = false;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j++;
      out.push({ t: s.slice(i, j), k: '' });
      i = j;
      continue;
    }
    if (ch === '#' || (ch === ';' && (i === 0 || /\s/.test(s[i - 1])))) {
      out.push({ t: s.slice(i), k: 'comment' });
      break;
    }
    const rest = s.slice(i);
    if (ch === '<') {
      const j = s.indexOf('>', i);
      if (j > i) {
        out.push({ t: s.slice(i, j + 1), k: 'addr' });
        i = j + 1;
        continue;
      }
    }
    // 地址：`401000:` 或 `0x40638c` / `-0x4`。
    const labeled = rest.match(/^[0-9a-f]{4,16}:/i);
    if (labeled) {
      out.push({ t: labeled[0], k: 'addr' });
      i += labeled[0].length;
      bytesPending = true; // objdump：地址后面紧跟机器码列
      continue;
    }
    if (bytesPending) {
      const byte = rest.match(ASM_BYTE_TOKEN);
      if (byte) {
        out.push({ t: byte[0], k: 'num' });
        i += byte[0].length;
        continue;
      }
      bytesPending = false;
      firstWord = true; // 机器码之后才是助记符
    }
    const hex = rest.match(/^[-+]?0x[0-9a-f]+/i);
    if (hex) {
      out.push({ t: hex[0], k: 'addr' });
      i += hex[0].length;
      continue;
    }
    const imm = rest.match(/^\$[-+]?(?:0x[0-9a-f]+|\d+)/i);
    if (imm) {
      out.push({ t: imm[0], k: 'imm' });
      i += imm[0].length;
      continue;
    }
    if (ch === '$') {
      out.push({ t: '$', k: 'punct' });
      i++;
      continue;
    }
    const bare = rest.match(/^[0-9a-f]{4,16}(?![0-9a-z_])/i);
    if (bare && /[0-9]/.test(bare[0])) {
      out.push({ t: bare[0], k: 'addr' });
      i += bare[0].length;
      continue;
    }
    const dec = rest.match(/^[-+]?\d+(?:\.\d+)?/);
    if (dec) {
      out.push({ t: dec[0], k: 'num' });
      i += dec[0].length;
      continue;
    }
    if (ch === '%') {
      const reg = rest.match(/^%[a-z0-9]+/i);
      if (reg) {
        out.push({ t: reg[0], k: 'reg' });
        i += reg[0].length;
        continue;
      }
    }
    const word = rest.match(/^[A-Za-z_.$@][\w.$@]*/);
    if (word) {
      const w = word[0];
      if (firstWord) {
        firstWord = false;
        out.push({ t: w, k: 'cmd' });
        if (ASM_PREFIX.has(w.toLowerCase())) firstWord = true;
      } else if (asmReg(w)) {
        out.push({ t: w, k: 'reg' });
      } else if (ASM_BYTE_RE.test(w) && /[0-9]/.test(w)) {
        out.push({ t: w, k: 'num' });
      } else {
        out.push({ t: w, k: 'out' });
      }
      i += w.length;
      continue;
    }
    out.push({ t: ch, k: 'punct' });
    i++;
  }
  return out;
}

/* ---------------------------------------------------------------- 整行 */

const DEFAULT_MARKS = ['✓', '!', '✗'];

/** 看起来像 stderr 的行：没有 glyph 也要落 err 色，不能混在正文里。 */
const ERR_LINE =
  /(?:^|\s)(?:error|fatal|failed|failure|traceback|exception|panic|undefined reference|cannot find|no such file)\b|✗|✘/i;
const WARN_LINE = /(?:^|\s)warning\b/i;

const rxEscape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function resultPattern(marks) {
  const [ok, warn, err] = [0, 1, 2].map((i) => marks[i] || DEFAULT_MARKS[i]);
  return new RegExp(`^(${[ok, warn, err].map(rxEscape).join('|')})\\s+(.*)$`);
}

/**
 * 一行 transcript → { kind, sign, tokens }。
 *
 * kind：cmd / out / ok / warn / err（与 vk-term 的 .is-* 同名）。
 * tokens 覆盖整行（空白 token 的 k 为空串），拼接后与输入逐字节相同。
 * lang="none" 时不认提示符、不切 token：整行一个无色的纯文本 token。
 */
export function lexShellLine(line, opts = {}) {
  const text = String(line ?? '');
  const lang = shellLang(opts.lang);
  if (lang === 'none') return { kind: 'out', sign: '', tokens: [{ t: text, k: '' }] };

  const prompts = Array.isArray(opts.prompts) && opts.prompts.length ? opts.prompts : DEFAULT_PROMPTS;
  const marks = Array.isArray(opts.marks) && opts.marks.length ? opts.marks : DEFAULT_MARKS;

  // 1) 命令行：提示符后面的部分按 shell 切。
  const prompt = detectShellPrompt(text, prompts);
  if (prompt) return { kind: 'cmd', sign: prompt.sign, tokens: lexCommand(prompt.cmd) };

  // 2) 结果行：✓ / ! / ✗（marks 可配）。
  const m = text.match(resultPattern(marks));
  if (m) {
    const kind = m[1] === (marks[0] || DEFAULT_MARKS[0]) ? 'ok' : m[1] === (marks[1] || DEFAULT_MARKS[1]) ? 'warn' : 'err';
    return { kind, sign: m[1], tokens: lexOutput(m[2], kind === 'err' ? 'err' : 'out') };
  }

  // 3) 汇编输出：地址 / 助记符 / 寄存器 / 立即数 各自一色。
  if (lang === 'asm') {
    if (ERR_LINE.test(text) || WARN_LINE.test(text)) {
      return { kind: 'err', sign: '', tokens: lexOutput(text, 'err') };
    }
    // objdump 自己的表头 / 提示不是指令，别把 "file format" 涂成命令名。
    if (isAsmNoise(text)) return { kind: 'out', sign: '', tokens: lexOutput(text, 'out') };
    return { kind: 'out', sign: '', tokens: tokenizeAsm(text, { mnemonic: true }) };
  }

  // 4) 普通输出 / stderr：兜底一定有颜色。
  const kind = ERR_LINE.test(text) || WARN_LINE.test(text) ? 'err' : 'out';
  return { kind, sign: '', tokens: lexOutput(text, kind) };
}

/** 把「像提示符但没认出来」的行找出来（运行期只用来提示一次）。 */
export function looksLikePrompt(line) {
  return /^(?:PS\s+[^>]*|[A-Za-z]:[\\/][^>]*|\[[^\]]*\][$#%]|[^\s]*@[^\s]*)[>$#%]\s+\S/.test(String(line ?? ''));
}
