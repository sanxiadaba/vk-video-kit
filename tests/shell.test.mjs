import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_PROMPTS,
  TOKEN_CLASS,
  detectShellPrompt,
  lexShellLine,
  shellLang,
  shellLines,
  tokenizeAsm,
  tokensToHtml,
} from "../src/shared/shell.mjs";

/**
 * 终端 / 汇编词法。
 *
 * 这些断言用的是**真实采集产物**（assets/hello/build/steps.txt / disasm.txt /
 * pair.diff），不是手写样例：分词器要能在真转录上工作，不然只是又一个正则玩具。
 */

const read = (rel) => fs.readFileSync(rel, "utf8");
const steps = read("assets/hello/build/steps.txt");
const disasm = read("assets/hello/build/disasm.txt");
const pairDiff = read("assets/hello/build/pair.diff");

const kinds = (row) =>
  row.tokens.filter((t) => t.k).map((t) => `${t.k}:${t.t}`);
const bodyOf = (line, row) =>
  row.kind === "cmd" ? line.slice(row.sign.length).trim() : line;

test("shell 词法：steps.txt 的 6 行各自成类，命令/参数/路径分开", () => {
  const lines = shellLines(steps);
  assert.equal(lines.length, 6, "真实采集是 4 条命令 + 1 条命令 + 1 行输出");
  const rows = lines.map((line) => lexShellLine(line, { lang: "sh" }));

  // 第 1 行是完整的一步：gcc -E hello.c -o hello.i
  assert.equal(rows[0].kind, "cmd");
  assert.equal(rows[0].sign, "$");
  assert.deepEqual(kinds(rows[0]), [
    "cmd:gcc",
    "flag:-E",
    "path:hello.c",
    "flag:-o",
    "path:hello.i",
  ]);

  // 每条命令行只有一个 cmd；-E / -S / -c / -o 这类参数是 flag；
  // hello.i / hello.s / hello.o / hello.exe 都是文件（构建产物也算 path）。
  for (const i of [0, 1, 2, 3]) {
    assert.equal(
      rows[i].tokens.filter((t) => t.k === "cmd").length,
      1,
      `第 ${i + 1} 行只能有一个命令名`,
    );
    assert.ok(
      rows[i].tokens.filter((t) => t.k === "flag").length >= 1,
      `第 ${i + 1} 行没有 flag`,
    );
    assert.ok(
      kinds(rows[i]).some((k) => k.startsWith("path:hello.")),
      `第 ${i + 1} 行没有路径`,
    );
  }
  assert.deepEqual(kinds(rows[1]), [
    "cmd:gcc",
    "flag:-S",
    "path:hello.i",
    "flag:-o",
    "path:hello.s",
  ]);
  assert.deepEqual(kinds(rows[2]), [
    "cmd:gcc",
    "flag:-c",
    "path:hello.s",
    "flag:-o",
    "path:hello.o",
  ]);
  assert.deepEqual(kinds(rows[3]), [
    "cmd:gcc",
    "path:hello.o",
    "flag:-o",
    "path:hello.exe",
  ]);
  assert.deepEqual(kinds(rows[4]), ["cmd:./hello.exe"]);

  // 最后一行是输出：没有 cmd，整行一个 out（输出是数据，不是语法）。
  assert.equal(rows[5].kind, "out");
  assert.deepEqual(kinds(rows[5]), ["out:Hello, World!"]);
});

test("shell 词法：每行的 token 拼回正文，一个字节都不丢", () => {
  for (const file of [
    steps,
    pairDiff,
    disasm.split("\n").slice(0, 40).join("\n"),
  ]) {
    for (const line of shellLines(file)) {
      for (const lang of ["sh", "asm"]) {
        const row = lexShellLine(line, { lang });
        assert.equal(
          row.tokens.map((t) => t.t).join(""),
          bodyOf(line, row),
          `${lang}: ${line}`,
        );
      }
    }
  }
});

test("shell 词法：兜底是 out，绝不整行丢色", () => {
  const weird = [
    "price > 5 units",
    ":: 这不是命令 ::",
    "--- a/before.c",
    "M=42 make",
    "...",
    "✓ 进程退出 0",
    "✗ error: expected ';'",
    "! warning: unused variable",
  ];
  for (const line of weird) {
    const row = lexShellLine(line, { lang: "sh" });
    assert.ok(row.tokens.length > 0, `${line} 没有 token`);
    assert.ok(
      row.tokens.some((t) => t.k),
      `${line} 整行丢色`,
    );
    assert.ok(
      ["cmd", "out", "ok", "warn", "err"].includes(row.kind),
      `${line} 的 kind=${row.kind}`,
    );
  }
  // 普通输出里的 "price > 5" 不能变成命令行（与 tests/silent 的旧断言一致）。
  assert.equal(lexShellLine("price > 5 units", { lang: "sh" }).kind, "out");
  // 未识别的 user@host 提示符仍然不硬猜。
  assert.equal(lexShellLine("user@host:~$ cmd", { lang: "sh" }).kind, "out");
});

test("shell 词法：提示符只认确实像 prompt 的形状", () => {
  assert.deepEqual(detectShellPrompt("$ gcc hello.c"), {
    sign: "$",
    cmd: "gcc hello.c",
  });
  assert.deepEqual(detectShellPrompt("> objdump -d hello.exe"), {
    sign: ">",
    cmd: "objdump -d hello.exe",
  });
  assert.deepEqual(detectShellPrompt("PS> dir"), { sign: "PS>", cmd: "dir" });
  assert.deepEqual(detectShellPrompt("PS C:\\src> dir"), {
    sign: "PS C:\\src>",
    cmd: "dir",
  });
  assert.deepEqual(detectShellPrompt("C:\\src\\demo> gcc hello.c"), {
    sign: "C:\\src\\demo>",
    cmd: "gcc hello.c",
  });
  assert.deepEqual(detectShellPrompt("[user@host ~]$ ls -la"), {
    sign: "[user@host ~]$",
    cmd: "ls -la",
  });
  assert.equal(detectShellPrompt("price > 5 units"), null);
  assert.equal(detectShellPrompt("user@host:~$ cmd"), null);
  // 作者显式写的 prompt 优先。
  assert.deepEqual(detectShellPrompt("λ gcc x.c", ["λ"]), {
    sign: "λ",
    cmd: "gcc x.c",
  });
  assert.deepEqual(DEFAULT_PROMPTS, ["$", ">", "PS>"]);
});

test("shell 词法：flag / path / num / string / var / 注释 各就各位", () => {
  const row = lexShellLine(
    '$ gcc --unified=1 -o "out dir/hello.exe" $HOME/build 2>&1 # 编译',
    { lang: "sh" },
  );
  assert.deepEqual(kinds(row), [
    "cmd:gcc",
    "flag:--unified=1",
    "flag:-o",
    'string:"out dir/hello.exe"',
    "path:$HOME/build",
    "punct:2>&1",
    "comment:# 编译",
  ]);
});

test("shell 词法：stderr / 含 error|warning 的行落 err 色", () => {
  assert.equal(lexShellLine("error: expected ';'", { lang: "sh" }).kind, "err");
  assert.equal(
    lexShellLine("warning: unused variable", { lang: "sh" }).kind,
    "err",
  );
  assert.equal(
    lexShellLine("fatal error: no such file", { lang: "sh" }).kind,
    "err",
  );
  assert.equal(
    lexShellLine("✗ error: expected ';'", { lang: "sh" }).kind,
    "err",
  );
  assert.equal(lexShellLine("✓ 进程退出 0", { lang: "sh" }).kind, "ok");
  assert.equal(
    lexShellLine("! warning: unused variable", { lang: "sh" }).kind,
    "warn",
  );
  // err 行里认不出的词落 err，不会退回 out 灰。
  const row = lexShellLine("fatal: 构建失败", { lang: "sh" });
  assert.ok(
    row.tokens
      .filter((t) => t.t.trim())
      .every((t) => t.k === "err" || t.k === "num"),
  );
});

test('shell 词法：lang="none" 是纯文本（不认提示符、不切 token）', () => {
  const row = lexShellLine("$ gcc -E hello.c -o hello.i", { lang: "none" });
  assert.equal(row.kind, "out");
  assert.equal(row.sign, "");
  assert.equal(row.tokens.length, 1);
  assert.equal(row.tokens[0].k, "");
  assert.equal(row.tokens[0].t, "$ gcc -E hello.c -o hello.i");
  assert.equal(shellLang("bash"), "sh");
  assert.equal(shellLang("pwsh"), "powershell");
  assert.equal(shellLang("nasm"), "asm");
  assert.equal(shellLang("plaintext"), "none");
});

test("shell 词法：pair.diff 的 git 命令与 diff 正文都能切", () => {
  const lines = shellLines(pairDiff);
  const row = lexShellLine(lines[0], { lang: "sh" });
  assert.equal(row.kind, "cmd");
  assert.equal(row.sign, ">");
  assert.deepEqual(kinds(row), [
    "cmd:git",
    "cmd:diff",
    "flag:--no-index",
    "flag:--unified=1",
    "flag:--no-color",
    "path:before.c",
    "path:after.c",
    "punct:2>",
    "var:$null",
  ]);
  // diff 正文是输出：整行一个 out，不再按词切（版面与可复制性都不变）。
  const add = lines.find((l) => l.startsWith("+    puts(s);"));
  assert.ok(add, "真实 diff 里应有 + 行");
  assert.equal(lexShellLine(add, { lang: "sh" }).kind, "out");
  const meta = lines.find((l) => l.startsWith("diff --git"));
  assert.deepEqual(kinds(lexShellLine(meta, { lang: "sh" })), [
    "out:diff --git a/before.c b/after.c",
  ]);
});

test("asm 分色：助记符 / 寄存器 / 立即数 / 地址 / 注释", () => {
  const insn = (t) =>
    tokenizeAsm(t)
      .filter((x) => x.k)
      .map((x) => `${x.k}:${x.t}`);

  assert.deepEqual(insn("push   %rbp"), ["cmd:push", "reg:%rbp"]);
  assert.deepEqual(insn("movl   $0x2a,-0x4(%rbp)"), [
    "cmd:movl",
    "imm:$0x2a",
    "punct:,",
    "addr:-0x4",
    "punct:(",
    "reg:%rbp",
    "punct:)",
  ]);
  assert.deepEqual(insn("call   402744 <___set_app_type>"), [
    "cmd:call",
    "addr:402744",
    "addr:<___set_app_type>",
  ]);
  // 前缀与真助记符都算 cmd。
  assert.deepEqual(insn("repz ret"), ["cmd:repz", "cmd:ret"]);
  // 注释整段一色，不吃掉后面的字。
  assert.deepEqual(insn("add $0x1,%eax # 求和"), [
    "cmd:add",
    "imm:$0x1",
    "punct:,",
    "reg:%eax",
    "comment:# 求和",
  ]);
});

test("asm 分色：真实 disasm.txt 前 200 行，种类与数量都对得上", () => {
  const lines = shellLines(disasm)
    .filter((l) => /^\s*[0-9a-f]{4,16}:/.test(l))
    .slice(0, 200);
  assert.ok(
    lines.length >= 190,
    `前 200 行里应有大量指令行，实际 ${lines.length}`,
  );

  let addr = 0;
  let num = 0;
  let cmd = 0;
  let reg = 0;
  let imm = 0;
  let punct = 0;
  for (const line of lines) {
    const row = lexShellLine(line, { lang: "asm" });
    const count = (k) => row.tokens.filter((t) => t.k === k).length;
    addr += count("addr");
    num += count("num");
    cmd += count("cmd");
    reg += count("reg");
    imm += count("imm");
    punct += count("punct");
    // objdump 的地址列在前：每行第一个有色 token 必须是 addr。
    assert.equal(row.tokens.find((t) => t.k)?.k, "addr", line);
    // 机器码不能被涂成助记符：只有助记符（+ 可能的 rep/lock 前缀）是 cmd。
    // objdump 的折行续行（`  40101c:\t4d 5a`）只有字节，没有 cmd，这是对的。
    assert.ok(count("cmd") <= 2, line);
  }
  assert.ok(addr > 200, `地址数 ${addr}`);
  assert.ok(num > 400, `机器码字节数 ${num}`);
  // 折行续行只有字节；有助记符的行占绝大多数。
  assert.ok(cmd > lines.length * 0.85, `助记符数 ${cmd} / ${lines.length} 行`);
  assert.ok(cmd <= lines.length * 2, `前缀不该超过一行两个 cmd：${cmd}`);
  assert.ok(reg > 100, `寄存器数 ${reg}`);
  assert.ok(imm > 20, `立即数 ${imm}`);
  assert.ok(punct > 100, `标点数 ${punct}`);
});

test("asm 分色：objdump 表头不算指令，不涂成命令名", () => {
  const noise = "hello.exe:     file format pei-i386";
  const row = lexShellLine(noise, { lang: "asm" });
  assert.equal(row.kind, "out");
  assert.ok(
    row.tokens.every((t) => t.k !== "cmd"),
    "表头不能被当成助记符",
  );
  const section = lexShellLine("Disassembly of section .text:", {
    lang: "asm",
  });
  assert.ok(section.tokens.every((t) => t.k !== "cmd"));
});

test("token → span：结构与 vk-code 一致，类名来自同一张表", () => {
  const row = lexShellLine("$ gcc -E hello.c -o hello.i", { lang: "sh" });
  const html = tokensToHtml(row.tokens);
  assert.match(html, /<span class="vk-tok-cmd" data-tok="cmd">gcc<\/span>/);
  assert.match(html, /<span class="vk-tok-flag" data-tok="flag">-E<\/span>/);
  assert.match(
    html,
    /<span class="vk-tok-path" data-tok="path">hello\.c<\/span>/,
  );
  // 旧的 vk-cmd-* 一套已经退役：颜色只能来自共享表。
  assert.doesNotMatch(html, /vk-cmd-/);
  for (const kind of [
    "cmd",
    "flag",
    "path",
    "string",
    "num",
    "out",
    "err",
    "prompt",
    "comment",
    "punct",
    "reg",
    "imm",
    "addr",
  ]) {
    assert.ok(TOKEN_CLASS[kind]?.startsWith("vk-tok-"), `${kind} 没有类名`);
  }
});

test("词法只有一份：构建期与运行期都 import src/shared/shell.mjs", () => {
  const runtime = fs.readFileSync("src/runtime/code.mjs", "utf8");
  const build = fs.readFileSync("src/highlight.mjs", "utf8");
  assert.match(runtime, /from '\.\.\/shared\/shell\.mjs'/);
  assert.match(build, /from '\.\/shared\/shell\.mjs'/);
  assert.doesNotMatch(
    runtime,
    /function paintTermCommand/,
    "运行期还留着一份私有词法",
  );
  assert.doesNotMatch(
    runtime,
    /const AUTO_PROMPTS/,
    "运行期还留着一份私有提示符表",
  );
});
