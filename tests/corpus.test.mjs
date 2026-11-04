import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 全库共用一份语料：hello.c 的四步编译链。
 *
 * 观众看到的每一个例子都必须是"能跑出来的东西"：
 * gcc -E / -S / -c / -o、hello.i、52,980、0x404064、Hello, World!。
 * 一旦有人把占位词写回场景或生成物，这条测试直接红。
 */

const PLACEHOLDER = /示例内容|条目[一二三四]|步骤[一二三四]|事件[一二三四]|示例页面|Lorem|\bfoo\b/i;

const read = (file) => fs.readFileSync(file, 'utf8');

test('场景文件里没有占位词', () => {
  const dir = 'src/scenes';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  assert.ok(files.includes('scenes.mjs'), '缺少 src/scenes/scenes.mjs');
  assert.ok(files.includes('corpus.mjs'), '缺少 src/scenes/corpus.mjs');
  const bad = [];
  for (const f of files) {
    const text = read(path.join(dir, f));
    for (const line of text.split(/\r?\n/)) {
      if (PLACEHOLDER.test(line)) bad.push(`${dir}/${f}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bad, [], `场景里还有占位词：\n${bad.join('\n')}`);
});

test('生成物里没有占位词', () => {
  const files = [
    'docs/reference.md',
    'docs/ai.md',
    'spec.json',
    'custom-elements.json',
    'types/index.d.ts',
  ].filter((f) => fs.existsSync(f));
  for (const dir of ['_site/specimen', '_site/specimens']) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
      files.push(path.join(dir, f));
    }
  }
  if (fs.existsSync('_site')) {
    for (const f of fs.readdirSync('_site').filter((x) => /^index.*\.html$/.test(x)).sort()) {
      files.push(path.join('_site', f));
    }
  }
  assert.ok(files.length > 0, '没有可检查的生成物：先运行 npm run build');
  const bad = [];
  for (const f of files) {
    const text = read(f);
    for (const line of text.split(/\r?\n/)) {
      if (PLACEHOLDER.test(line)) bad.push(`${f}: ${line.trim().slice(0, 160)}`);
    }
  }
  assert.deepEqual(bad, [], `生成物里还有占位词：\n${bad.slice(0, 20).join('\n')}`);
});
