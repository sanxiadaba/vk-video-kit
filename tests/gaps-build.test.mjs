import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';
import { hash32, stripAnsi } from '../src/shared/code.mjs';
import { TAGS } from '../src/registry.mjs';

/* 构建期能拦住的缺口：不留到运行期"看起来没问题"。 */

const hl = await createVkHighlighter(['c']);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-gaps-build-'));

after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('④ vk-code 的 mark 找不到词时构建失败，并给出真实候选', async () => {
  await assert.rejects(
    () => transformHtml('<vk-code lang="c" mark="nope">int count = 0;</vk-code>', { file: 'p.html', highlighter: hl }),
    /mark="nope"[\s\S]*源码里实际有[\s\S]*count/
  );
  const out = await transformHtml('<vk-code lang="c" mark="count">int count = 0;</vk-code>', {
    file: 'p.html',
    highlighter: hl,
  });
  assert.ok(out.html.includes('data-vk-hl'));
});

test('⑤ vk-canvas 子节点缺 x 或 y 时构建失败，并指出缺哪个', async () => {
  await assert.rejects(
    () =>
      transformHtml('<vk-canvas w="600" h="300"><vk-box y="0" w="200" h="100"></vk-box></vk-canvas>', {
        file: 'p.html',
        highlighter: hl,
      }),
    /<vk-canvas>[\s\S]*缺 x/
  );
  await assert.rejects(
    () =>
      transformHtml('<vk-canvas w="600" h="300"><vk-box x="0" w="200" h="100"></vk-box></vk-canvas>', {
        file: 'p.html',
        highlighter: hl,
      }),
    /<vk-canvas>[\s\S]*缺 y/
  );
  const out = await transformHtml(
    '<vk-canvas w="600" h="300"><vk-box id="a" x="0" y="0" w="200" h="100"></vk-box><vk-box id="b" x="300" y="0" w="200" h="100"></vk-box><vk-edge from="#a" to="#b"></vk-edge></vk-canvas>',
    { file: 'p.html', highlighter: hl }
  );
  assert.ok(out.html.includes('vk-canvas'));
});

test('⑦ vk-tree 的 collapsed 指错目录时构建失败，并给出真实目录候选', async () => {
  const proj = path.join(dir, 'proj');
  fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'src', 'a.c'), 'int a;\n');
  fs.mkdirSync(path.join(proj, 'docs'), { recursive: true });
  const file = path.join(dir, 'page.html');
  await assert.rejects(
    () => transformHtml('<vk-tree src="proj" collapsed="nope"></vk-tree>', { file, highlighter: hl }),
    /collapsed="nope"[\s\S]*可用目录[\s\S]*src/
  );
  const out = await transformHtml('<vk-tree src="proj" collapsed="src"></vk-tree>', { file, highlighter: hl });
  assert.ok(out.html.includes('data-vk-tree'));
});

test('② 构建期按剥离 ANSI 后的文本高亮与算 hash，HTML 里保留原文给运行期提示', async () => {
  const raw = '\u001b[31mint\u001b[0m x;';
  const out = await transformHtml(`<vk-code lang="c">${raw}</vk-code>`, { file: 'p.html', highlighter: hl });
  const hash = out.html.match(/data-vk-hash="([^"]+)"/)?.[1];
  assert.equal(hash, hash32(stripAnsi(raw)));
  assert.ok(out.html.includes('\u001b[31m'), '原文要留给运行时提示');
});

test('① vk-cells 的 <li> 接受 act：focus 构建通过、bogus 报可用值、state=current 仍提示退役', async () => {
  const ok = await transformHtml(
    '<vk-cells cols="2"><li value="14" label="字节" act="focus"></li><li value="15"></li></vk-cells>',
    { file: 'p.html', highlighter: hl }
  );
  assert.match(ok.html, /act="focus"/, 'act="focus" 应原样留在产物里，运行期才能落到 .vk-cell');

  await assert.rejects(
    () => transformHtml('<vk-cells cols="2"><li value="14" act="bogus"></li></vk-cells>', { file: 'p.html', highlighter: hl }),
    /act="bogus"[\s\S]*可用：focus \/ context \/ mark/,
    '非法 act 必须在构建期报错并列出 cells 的词表'
  );

  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const out = await transformHtml('<vk-cells cols="2"><li value="14" state="current"></li></vk-cells>', {
      file: 'p.html',
      highlighter: hl,
    });
    assert.match(out.html, /state="current"/, 'state="current" 仍作为一版别名生效');
  } finally {
    console.warn = oldWarn;
  }
  assert.match(warnings.join('\n'), /state="current" 已退役[\s\S]*<li act="focus">/, '退役提示必须指向现在能构建的写法');
});

test('⑧ vk-cells 的 filled 文档与 <li filled> 布尔实现一致', () => {
  const field = TAGS['vk-cells'].content.fields.find((f) => f.name === 'filled');
  assert.ok(field, 'vk-cells 的 filled 文档字段不见了');
  assert.match(field.label, /布尔/);
  assert.doesNotMatch(field.label, /序号/);
  assert.equal(field.type, 'bool');
});

test('⑨ vk-compare：mode=side / stack 同时写 split 构建期警告，不静默忽略', async () => {
  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const out = await transformHtml(
      '<vk-compare mode="side" split="30" fit="cover" a="assets/sample-grid.svg" b="assets/sample-grid-b.svg"></vk-compare>',
      { file: 'p.html', highlighter: hl }
    );
    assert.match(out.html, /mode="side"/);
  } finally {
    console.warn = oldWarn;
  }
  assert.match(warnings.join('\n'), /mode="side" 下 split 不起作用/, 'side 下 split 必须明确说它不起作用');
});

test('⑩ vk-pin 的 w 接受 200px，vk-bars 的 ratio-to 指空时构建期警告', async () => {
  const pin = await transformHtml(
    '<vk-page><vk-box id="x">目标</vk-box><vk-pin for="#x" w="200px">批注</vk-pin></vk-page>',
    { file: 'p.html', highlighter: hl }
  );
  assert.match(pin.html, /w="200px"/);

  const warnings = [];
  const oldWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await transformHtml(
      '<vk-bars ratio-to="9"><li value="106" label="a"></li><li value="52980" label="b"></li></vk-bars>',
      { file: 'p.html', highlighter: hl }
    );
  } finally {
    console.warn = oldWarn;
  }
  assert.match(warnings.join('\n'), /ratio-to="9" 指不到任何一行/);
});
