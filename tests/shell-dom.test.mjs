import test, { after } from "node:test";
import assert from "node:assert/strict";
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from "../cli/serve.mjs";

/**
 * 终端 / 汇编的**渲染**：词法在 src/shared/shell.mjs 里已经用真实采集产物测过
 * （tests/shell.test.mjs）；这里只问浏览器里最终画出来的东西对不对：
 *   · 上色前后（lang="none"）
 *   · 当前行（current / line）
 *   · 逐行浮现（reveal="line" 的 t=0 / 中 / 末）与 reveal="none"
 *   · vk-asm 的五种 token 真的各是一色
 */

const { base, close } = await startServer({
  port: 0,
  root: "_site",
  transform: false,
});
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(`${base}/specimens/vk-term.html`, { waitUntil: "load" });
await page.evaluate(() => window.vk.ready());

after(async () => {
  await closeBrowser(browser);
  await close();
});

const reset = (html) =>
  page.evaluate(async (markup) => {
    document.querySelector("main").innerHTML = markup;
    await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(r));
    // 只在 DOM 换完之后 replan 一次：capture() 记的是「出场之前」的基线，
    // 每次 seek 前都 replan 会把上一帧的内联 opacity 当成基线。
    window.vk.replan();
  }, html);

const seek = (t) => page.evaluate((tt) => window.vk.seek(tt), t);

test("vk-term 上色：命令 / 参数 / 路径 / 输出各自一类，颜色真的不同", async () => {
  await reset(
    '<vk-term id="t">$ gcc -E hello.c -o hello.i\n' +
      "warning: unused variable\n" +
      "Hello, World!</vk-term>",
  );
  const r = await page.evaluate(() => {
    const el = document.querySelector("#t");
    const color = (sel) => {
      const node = el.querySelector(sel);
      return node ? getComputedStyle(node).color : null;
    };
    return {
      cmds: [...el.querySelectorAll(".vk-tok-cmd")].map((e) => e.textContent),
      flags: [...el.querySelectorAll(".vk-tok-flag")].map((e) => e.textContent),
      paths: [...el.querySelectorAll(".vk-tok-path")].map((e) => e.textContent),
      out: [...el.querySelectorAll(".vk-tok-out")].map((e) => e.textContent),
      err: [...el.querySelectorAll(".vk-tok-err")].map((e) => e.textContent),
      colors: {
        cmd: color(".vk-tok-cmd"),
        flag: color(".vk-tok-flag"),
        path: color(".vk-tok-path"),
        out: color(".vk-tok-out"),
        err: color(".vk-tok-err"),
        prompt: color(".vk-tok-prompt"),
      },
      lines: el.querySelectorAll(".vk-line").length,
      dataLang: el.getAttribute("data-lang"),
      // 旧的 vk-cmd-* 一套不该再出现。
      legacy: el.querySelectorAll('[class*="vk-cmd-"]').length,
    };
  });
  assert.deepEqual(r.cmds, ["gcc"]);
  assert.deepEqual(r.flags, ["-E", "-o"]);
  assert.deepEqual(r.paths, ["hello.c", "hello.i"]);
  assert.ok(r.out.length >= 1, "输出行应有 out（整行一个色）");
  assert.ok(r.err.length >= 1, "warning 行应整行落 err");
  assert.equal(r.lines, 3);
  assert.equal(r.dataLang, "sh");
  assert.equal(r.legacy, 0);
  // 五种 token 至少四种不同颜色：墨阶 primary / info / focus / 墨阶 secondary / err。
  const distinct = new Set(Object.values(r.colors).filter(Boolean));
  assert.ok(
    distinct.size >= 5,
    `token 颜色只有 ${distinct.size} 种：${JSON.stringify(r.colors)}`,
  );
  assert.equal(r.colors.cmd, "rgb(11, 15, 20)"); // ink-1
  assert.equal(r.colors.flag, "rgb(58, 68, 84)"); // info
  assert.equal(r.colors.path, "rgb(27, 63, 214)"); // focus
});

test("vk-term marks：结果 glyph 可配，三种状态各自成行", async () => {
  await reset(
    '<vk-term id="t" marks="PASS|WARN|FAIL">PASS 全绿\nWARN 再看\nFAIL 红了</vk-term>',
  );
  const r = await page.evaluate(() => {
    const el = document.getElementById("t");
    return {
      kinds: [...el.querySelectorAll(".vk-line")].map((row) =>
        [...row.classList].find((c) => c.startsWith("is-")),
      ),
      signs: [...el.querySelectorAll(".vk-sign")].map((e) => e.textContent),
    };
  });
  assert.deepEqual(r.kinds, ["is-ok", "is-warn", "is-err"]);
  assert.deepEqual(r.signs, ["PASS", "WARN", "FAIL"]);
});

test("vk-term：构建期 token 真的被运行期消费（标本页）", async () => {
  await page.goto(`${base}/specimen/vk-term.html`, { waitUntil: "load" });
  await page.evaluate(() => window.vk.ready());
  const r = await page.evaluate(() => {
    const el = document.querySelector("vk-term");
    return {
      // 运行期只在 hash / lang / prompt / marks 全部对得上时才消费构建期 token，
      // 并留下这个内部标记（payload 脚本在渲染时已被替换掉，查不到）。
      used: el.hasAttribute("data-vk-term-used"),
      lines: el.querySelectorAll(".vk-line").length,
      renderedCmd: el.querySelector(".vk-tok-cmd")?.textContent || "",
      renderedPath: el.querySelector(".vk-tok-path")?.textContent || "",
    };
  });
  assert.equal(
    r.used,
    true,
    "运行期没有消费构建期 token（hash/lang 对不上？）",
  );
  assert.equal(r.lines, 6, "steps.txt 是 6 行");
  assert.equal(r.renderedCmd, "gcc");
  assert.equal(r.renderedPath, "hello.c");

  // 后面的用例往 <main> 里塞 HTML；回到契约宿主页（它才有 main）。
  await page.goto(`${base}/specimens/vk-term.html`, { waitUntil: "load" });
  await page.evaluate(() => window.vk.ready());
});

test('vk-term lang="none"：同一段 transcript 不上色（对照）', async () => {
  await reset(
    '<vk-term id="a" lang="none">$ gcc -E hello.c -o hello.i\nHello, World!</vk-term>' +
      '<vk-term id="b">$ gcc -E hello.c -o hello.i\nHello, World!</vk-term>',
  );
  const r = await page.evaluate(() => {
    const a = document.querySelector("#a");
    const b = document.querySelector("#b");
    return {
      aTokens: a.querySelectorAll("[data-tok]").length,
      bTokens: b.querySelectorAll("[data-tok]").length,
      aText: a.querySelector(".vk-bd").textContent,
      bText: b.querySelector(".vk-bd").textContent,
      aLang: a.getAttribute("data-lang"),
      // 不上色 = 每一行都落 out；不再有命令行/结果行的结构。
      aCmdLines: a.querySelectorAll(".vk-line.is-cmd").length,
      aOutLines: a.querySelectorAll(".vk-line.is-out").length,
    };
  });
  assert.equal(r.aTokens, 0, "lang=none 不该有 token span");
  assert.ok(r.bTokens >= 5, "默认 lang 应切出 token");
  // 文本一个字节都不少（提示符 $ 留在正文里；上色版的 $ 在另一列，所以分开断）。
  assert.match(r.aText, /\$ gcc -E hello\.c -o hello\.i/);
  assert.match(r.aText, /Hello, World!/);
  assert.match(r.bText, /gcc -E hello\.c -o hello\.i/);
  assert.equal(r.aLang, "none");
  assert.equal(r.aCmdLines, 0);
  assert.equal(r.aOutLines, 2);

  // 运行时改 lang 也要重切（不是只认构建期）。
  await page.evaluate(() =>
    document.querySelector("#a").setAttribute("lang", "sh"),
  );
  await page.waitForTimeout(60);
  const after = await page.evaluate(
    () => document.querySelector("#a").querySelectorAll("[data-tok]").length,
  );
  assert.ok(after >= 5, "改回 sh 后应重新切出 token");
});

test("vk-term current / line：指哪一行，哪一行整行 focus", async () => {
  await reset(
    '<vk-term id="a" current="2">$ one\n$ two\n$ three</vk-term>' +
      '<vk-term id="b" line="3">$ one\n$ two\n$ three</vk-term>',
  );
  const r = await page.evaluate(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      const rows = [...el.querySelectorAll(".vk-line")];
      return rows.map((row) => ({
        line: row.getAttribute("data-line"),
        hl: row.classList.contains("is-hl"),
        bg: getComputedStyle(row).backgroundColor,
      }));
    };
    return { a: read("a"), b: read("b") };
  });
  assert.equal(r.a[1].hl, true);
  assert.equal(r.a[0].hl, false);
  assert.notEqual(r.a[1].bg, "rgba(0, 0, 0, 0)");
  // line 是 current 的别名，指向同一套行号（源文件行号，1 起）。
  assert.equal(r.b[2].line, "3");
  assert.equal(r.b[2].hl, true);
  assert.equal(r.b[1].hl, false);
});

test('vk-term reveal="line"：t=0 / 中 / 末三态（复用 director，不是新引擎）', async () => {
  await reset(
    '<vk-page dur="1.6"><vk-term id="t" reveal="line" at="0" stagger="0.5">$ one\n$ two\n$ three</vk-term></vk-page>',
  );
  const rows = () =>
    page.$$eval("#t .vk-line", (els) =>
      els.map((e) => ({
        opacity: e.style.opacity,
        cue: e.getAttribute("data-vk-cue"),
      })),
    );

  await seek(0);
  const t0 = await rows();
  assert.deepEqual(
    t0.map((r) => r.opacity),
    ["0", "0", "0"],
    "t=0 三行都还没出现",
  );
  assert.ok(
    t0.every((r) => r.cue != null),
    "每一行都应进 cue 表",
  );

  await seek(0.6);
  const mid = await rows();
  assert.equal(mid[0].opacity, "", "第一行已经落定");
  assert.notEqual(mid[1].opacity, "", "第二行正在出场");
  assert.equal(mid[2].opacity, "0", "第三行还没开始");

  await seek(1.6);
  const end = await rows();
  assert.deepEqual(
    end.map((r) => r.opacity),
    ["", "", ""],
    "末态回到静态页，逐像素不变",
  );
  assert.deepEqual(pageErrors, []);
});

test('reveal="none"：整块不参与出场（at/enter 也不动它）', async () => {
  await reset(
    '<vk-page dur="1"><vk-term id="t" reveal="none" at="0" enter="fade">$ one\n$ two</vk-term></vk-page>',
  );
  await seek(0);
  const r = await page.evaluate(() => {
    const el = document.getElementById("t");
    return {
      reveal: el.getAttribute("data-reveal"),
      cues: el.querySelectorAll("[data-vk-cue]").length,
      opacity: [...el.querySelectorAll(".vk-line")].map((e) => e.style.opacity),
    };
  });
  assert.equal(r.reveal, "none");
  assert.equal(r.cues, 0);
  assert.deepEqual(r.opacity, ["", ""], "reveal=none 的行不该被隐藏");
});

test('vk-code reveal="line"：代码行也按 at + stagger 逐行浮现', async () => {
  await reset(
    '<vk-page dur="1.2"><vk-code id="t" lang="text" reveal="line" stagger="0.4">a\nb\nc</vk-code></vk-page>',
  );
  await seek(0);
  const t0 = await page.$$eval("#t .vk-line", (els) =>
    els.map((e) => e.style.opacity),
  );
  assert.deepEqual(t0, ["0", "0", "0"]);
  await seek(1.2);
  const end = await page.$$eval("#t .vk-line", (els) =>
    els.map((e) => e.style.opacity),
  );
  assert.deepEqual(end, ["", "", ""]);
});

test("vk-asm 分色：助记符 / 寄存器 / 立即数 / 地址 / 注释各一色", async () => {
  await page.goto(`${base}/specimens/vk-asm.html`, { waitUntil: "load" });
  await page.evaluate(() => window.vk.ready());
  const r = await page.evaluate(() => {
    const root = document.querySelector("vk-asm");
    const color = (sel) => {
      const node = root.querySelector(sel);
      return node ? getComputedStyle(node).color : null;
    };
    return {
      cmd: root.querySelectorAll(".vk-tok-cmd").length,
      reg: root.querySelectorAll(".vk-tok-reg").length,
      imm: root.querySelectorAll(".vk-tok-imm").length,
      addr: root.querySelectorAll(".vk-tok-addr").length,
      punct: root.querySelectorAll(".vk-tok-punct").length,
      colors: {
        cmd: color(".vk-tok-cmd"),
        reg: color(".vk-tok-reg"),
        imm: color(".vk-tok-imm"),
        addr: color(".vk-tok-addr"),
      },
      legacy: root.querySelectorAll(".vk-op-reg, .vk-op-imm").length,
    };
  });
  assert.ok(r.cmd >= 5, `助记符 ${r.cmd}`);
  assert.ok(r.reg >= 5, `寄存器 ${r.reg}`);
  assert.ok(r.imm >= 2, `立即数 ${r.imm}`);
  assert.ok(r.addr >= 2, `地址 ${r.addr}`);
  assert.ok(r.punct >= 2, `标点 ${r.punct}`);
  assert.equal(r.legacy, 0, "旧的两色操作数 class 已退役");
  const distinct = new Set(Object.values(r.colors));
  assert.equal(
    distinct.size,
    4,
    `四种 token 应有四种颜色：${JSON.stringify(r.colors)}`,
  );
  // 助记符 = 墨阶 primary；寄存器 = focus；立即数 = ok；地址 = 墨阶 tertiary。
  assert.equal(r.colors.cmd, "rgb(11, 15, 20)");
  assert.equal(r.colors.reg, "rgb(27, 63, 214)");
  assert.equal(r.colors.imm, "rgb(7, 84, 74)");
  assert.equal(r.colors.addr, "rgb(75, 85, 99)");
});
