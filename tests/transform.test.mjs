import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

const hl = await createVkHighlighter(['c', 'diff']);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-transform-'));
fs.writeFileSync(path.join(dir, 'hello.c'), 'int main(void) {\n  return 0;\n}\n');
fs.writeFileSync(path.join(dir, 'bounds.diff'), ' int a[3];\n-int i = 0;\n+int i = 1;\n');
fs.writeFileSync(path.join(dir, 'hello.term'), '$ echo hi\nhi\n');
fs.writeFileSync(path.join(dir, 'formula.tex'), 'a^2 + b^2 = c^2\n');
fs.mkdirSync(path.join(dir, 'app', 'src'), { recursive: true });
fs.writeFileSync(path.join(dir, 'app', 'main.py'), 'print("hi")\n');
fs.writeFileSync(path.join(dir, 'app', 'src', 'parser.py'), 'def parse(): pass\n');

test('inline code：预编译、hash、幂等', async () => {
  const html = '<vk-code lang="c">int x = 1;\nint y = 2;</vk-code>';
  const one = await transformHtml(html, { file: 'inline.html', highlighter: hl });
  assert.ok(one.html.includes('data-vk-hl'));
  assert.ok(one.html.includes('data-vk-hash='));
  const two = await transformHtml(one.html, { file: 'inline.html', highlighter: hl });
  assert.equal(two.html, one.html);
});

test('data-vk-source：不转义 <，构建后源码块消失；与 src 互斥', async () => {
  const html =
    '<vk-code lang="c"><script type="text/plain" data-vk-source>\n#include <stdio.h>\nint main(void) { return 0; }\n</script></vk-code>';
  const out = await transformHtml(html, { file: 'source.html', highlighter: hl });
  assert.ok(out.html.includes('data-vk-hl'));
  assert.ok(out.html.includes('stdio.h'));
  assert.ok(!out.html.includes('data-vk-source'), '源码块应当被构建产物替换');
  await assert.rejects(
    () =>
      transformHtml(
        '<vk-code src="hello.c"><script type="text/plain" data-vk-source>int x;</script></vk-code>',
        { file: path.join(dir, 'page.html'), highlighter: hl }
      ),
    /只能有一个/
  );
});

test('src + lines：只取片段，行号基准在运行时', async () => {
  const html = '<vk-code lang="c" src="hello.c" lines="2-2"></vk-code>';
  const out = await transformHtml(html, { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(out.html.includes('return 0;'));
  assert.ok(!out.html.includes('int main'));
  assert.equal(out.deps.length, 1);
});

test('diff：预编译行对与词级区间', async () => {
  const html = '<vk-diff lang="diff" src="bounds.diff"></vk-diff>';
  const out = await transformHtml(html, { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(out.html.includes('data-vk-hl-diff'));
  assert.ok(out.html.includes('"l"'));
});

test('math：KaTeX 预编译，hash 校验源', async () => {
  const html = '<vk-math>a^2 + b^2 = c^2</vk-math>';
  const out = await transformHtml(html, { file: 'math.html', highlighter: hl });
  assert.ok(out.html.includes('data-vk-math'));
  assert.ok(out.html.includes('katex'));
});

test('src 从真实文件来：不再把源码手敲进 HTML', async () => {
  const html = '<vk-code lang="c" src="hello.c"></vk-code>';
  const out = await transformHtml(html, { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(out.html.includes('data-vk-src'));
  assert.ok(!/<vk-code[^>]*>\s*int main/.test(out.html));
});

test('term / math / tree 也支持真实文件', async () => {
  const term = await transformHtml('<vk-term src="hello.term"></vk-term>', { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(term.html.includes('data-vk-src'));
  assert.ok(term.html.includes('echo hi'));

  const math = await transformHtml('<vk-math src="formula.tex"></vk-math>', { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(math.html.includes('data-vk-src'));
  assert.ok(math.html.includes('data-vk-math'));

  const tree = await transformHtml('<vk-tree src="app"></vk-tree>', { file: path.join(dir, 'page.html'), highlighter: hl });
  assert.ok(tree.html.includes('data-vk-tree'));
  assert.ok(tree.html.includes('parser.py'));
});

test('构建期拒绝未知枚举、越界数字、未知属性、未知图标、布尔 false', async () => {
  const cases = [
    ['<vk-text size="t9">x</vk-text>', /size="t9"/],
    ['<vk-box w="50%"></vk-box>', /不是数字/],
    ['<vk-box w="-10"></vk-box>', /超出/],
    ['<vk-code lang="c" src="hello.c" typo="x"></vk-code>', /未知属性 typo/],
    ['<vk-icon name="not-a-real-icon"></vk-icon>', /没有图标/],
    ['<vk-tag bare="false"></vk-tag>', /布尔属性/],
    ['<vk-canvas layout="flow"></vk-canvas>', /未知属性 layout/],
    ['<vk-page w="800"></vk-page>', /未知属性 w/],
  ];
  for (const [html, re] of cases) {
    await assert.rejects(() => transformHtml(html, { file: path.join(dir, 'page.html'), highlighter: hl }), re);
  }
});

test('具名槽：允许 eyebrow/sub/title；槽和属性不能同时写', async () => {
  const ok = await transformHtml(
    '<vk-title sub="属性副题"><span slot="eyebrow">眉题</span>主标题</vk-title>',
    { file: 'slots.html', highlighter: hl }
  );
  assert.ok(ok.html.includes('slot="eyebrow"'));
  await assert.rejects(
    () => transformHtml('<vk-title sub="属性" slot="x">主标题</vk-title>', { file: 'slots.html', highlighter: hl }),
    /不支持 slot/
  );
  await assert.rejects(
    () => transformHtml('<vk-title sub="属性"><span slot="sub">槽</span></vk-title>', { file: 'slots.html', highlighter: hl }),
    /不能同时写 slot 和属性/
  );
  await assert.rejects(
    () => transformHtml('<vk-callout><span slot="body">x</span></vk-callout>', { file: 'slots.html', highlighter: hl }),
    /不支持 slot/
  );
});

test('图标构建期内联，未知图标仍然报错', async () => {
  const out = await transformHtml('<vk-icon name="terminal"></vk-icon>', { file: 'icon.html', highlighter: hl });
  assert.ok(out.html.includes('data-vk-inline'));
  assert.ok(out.html.includes('data-vk-name="terminal"'));
  assert.ok(out.html.includes('<svg'));
});

test('tree current 必须存在', async () => {
  await assert.rejects(
    () => transformHtml('<vk-tree src="app" active="nope.py"></vk-tree>', { file: path.join(dir, 'page.html'), highlighter: hl }),
    /active="nope.py"/
  );
});

test('行段越界在构建期报错', async () => {
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" src="hello.c" fold="9-12"></vk-code>', { file: path.join(dir, 'page.html'), highlighter: hl }),
    /fold="9-12"/
  );
});

test('缺失 src 明确报错', async () => {
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" src="missing.c"></vk-code>', { file: path.join(dir, 'page.html'), highlighter: hl }),
    /找不到 missing\.c/
  );
});

test('源码里的 < 未转义时明确报错，不静默吞掉', async () => {
  await assert.rejects(
    () => transformHtml('<vk-code lang="c"><b>int</b> x;</vk-code>', { file: 'bad.html', highlighter: hl }),
    /必须写成/
  );
});

test('引用关系：未知标签、找不到 id、锚点越界、窗头嵌套都在构建期报错', async () => {
  const cases = [
    ['<vk-nope></vk-nope>', /未知标签 <vk-nope>/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#nope">x</vk-pin>', /找不到 #nope/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@cell:9">x</vk-pin>', /越界/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@line:1">x</vk-pin>', /不支持 @line/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@point:120,50">x</vk-pin>', /0–100/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@side:middle">x</vk-pin>', /@side/],
    ['<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@region:10,10,20">x</vk-pin>', /@region/],
    ['<vk-window><vk-code chrome="min">x</vk-code></vk-window>', /两条窗头/],
    ['<vk-bars><li label="a"></li></vk-bars>', /缺数字 value/],
  ];
  for (const [html, re] of cases) {
    await assert.rejects(() => transformHtml(html, { file: 'refs.html', highlighter: hl }), re);
  }
});

test('引用关系：合法锚点不报错', async () => {
  const html =
    '<vk-cells id="c"><li value="1"></li><li value="2"></li></vk-cells><vk-pin for="#c@cell:1">x</vk-pin>' +
    '<vk-pin for="#c@point:50%,100%">y</vk-pin>' +
    '<vk-pin for="#c@side:right">z</vk-pin>' +
    '<vk-pin for="#c@region:10%,10%,40%,40%">w</vk-pin>';
  const out = await transformHtml(html, { file: 'refs-ok.html', highlighter: hl });
  assert.ok(out.html.includes('id="c"'));
});

test('asm：x86 汇编能高亮，.s 扩展名自动识别', async () => {
  fs.writeFileSync(path.join(dir, 'a.s'), 'mov eax, 1\nadd ebx, eax\n');
  const out = await transformHtml('<vk-code src="a.s"></vk-code>', {
    file: path.join(dir, 'page.html'),
    highlighter: hl,
  });
  assert.ok(out.html.includes('data-vk-hl'), '没有生成高亮数据');
  assert.ok(out.html.includes('data-vk-lang="asm"'));
});

test('asm：lang 仍是合法入口，addr 进入机器数据', async () => {
  const html = `<vk-asm lang="asm" addr="0x401136" bytes><script type="text/plain" data-vk-source>
0000000000401136 <main>:
  401136: 55                    push   %rbp
  401137: c3                    ret
</script></vk-asm>`;
  const out = await transformHtml(html, { file: 'asm-inline.html', highlighter: hl });
  assert.ok(out.html.includes('data-vk-asm'));
  assert.ok(out.html.includes('"base":"0x401136"'));
});

test('current/focus/fold：越出片段直接报错，不静默丢失高亮', async () => {
  const file = path.join(dir, 'page.html');
  for (const name of ['current', 'focus', 'fold']) {
    await assert.rejects(
      () =>
        transformHtml(`<vk-code lang="c" src="hello.c" lines="2-2" ${name}="1"></vk-code>`, {
          file,
          highlighter: hl,
        }),
      new RegExp(`${name}="1" 超出 2–2 行`)
    );
  }
  const ok = await transformHtml('<vk-code lang="c" src="hello.c" lines="2-2" current="2"></vk-code>', {
    file,
    highlighter: hl,
  });
  assert.ok(ok.html.includes('data-vk-hl'));
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" current="2" fold="2">a\nb\nc</vk-code>', { file, highlighter: hl }),
    /current="2" 落在 fold 区间内/
  );
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" current="2" focus="3">a\nb\nc</vk-code>', { file, highlighter: hl }),
    /current="2" 不在 focus 内/
  );
});

test('current 越界：bytes / asm / steps 都在构建期硬拦', async () => {
  await assert.rejects(
    () =>
      transformHtml(
        '<vk-bytes current="9"><script type="text/plain" data-vk-source>00 01 02 03</script></vk-bytes>',
        { file: 'bytes.html', highlighter: hl }
      ),
    /vk-bytes> 的 current="9" 超出 0–3/
  );
  await assert.rejects(
    () =>
      transformHtml(
        '<vk-asm lang="asm" current="9"><script type="text/plain" data-vk-source>\nmain:\n  nop\n</script></vk-asm>',
        { file: 'asm.html', highlighter: hl }
      ),
    /vk-asm> 的 current="9" 超出/
  );
  await assert.rejects(
    () => transformHtml('<vk-steps current="9"><li>一步</li><li>两步</li></vk-steps>', { file: 'steps.html', highlighter: hl }),
    /vk-steps> 的 current="9" 超出 0–1/
  );
});

test('inline lines：内联源码也按 lines 切', async () => {
  const out = await transformHtml('<vk-code lang="c" lines="2-2">alpha\nbeta\ngamma</vk-code>', {
    file: 'inline-lines.html',
    highlighter: hl,
  });
  assert.ok(out.html.includes('beta'));
  assert.ok(!out.html.includes('alpha'));
  assert.ok(!out.html.includes('gamma'));
});

test('for 多目标：分号分隔，逐个校验', async () => {
  const html =
    '<vk-cells id="c"><li value="1"></li></vk-cells><vk-text id="t">x</vk-text>' +
    '<vk-ring for="#c@side:right;#t@point:50%,50%"></vk-ring>';
  const out = await transformHtml(html, { file: 'multi-for.html', highlighter: hl });
  assert.ok(out.html.includes('vk-ring'));
});

test('timeline lanes：lane 不在声明里直接报错', async () => {
  await assert.rejects(
    () =>
      transformHtml('<vk-timeline variant="lanes" lanes="A,B"><li lane="C" label="x">y</li></vk-timeline>', {
        file: 'timeline.html',
        highlighter: hl,
      }),
    /lane="C" 不在 lanes 里/
  );
});

test('vk-img 进入布局协议：span 可用', async () => {
  const out = await transformHtml('<vk-grid cols="3"><vk-img span="2"></vk-img></vk-grid>', {
    file: 'img.html',
    highlighter: hl,
  });
  assert.ok(out.html.includes('span="2"'));
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));
