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

test('⑧ vk-cells 的 filled 文档与 <li filled> 布尔实现一致', () => {
  const field = TAGS['vk-cells'].content.fields.find((f) => f.name === 'filled');
  assert.ok(field, 'vk-cells 的 filled 文档字段不见了');
  assert.match(field.label, /布尔/);
  assert.doesNotMatch(field.label, /序号/);
  assert.equal(field.type, 'bool');
});
