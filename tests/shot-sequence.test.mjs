import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/**
 * 帧序列导出（vk shot --fps/--out-dir）的硬验收：
 * 序列里 t 时刻那一帧，必须和 --at t 单帧逐像素一致。
 *
 * 这条成立的前提是 seek 是纯函数——同一 t 不管怎么到达，画面都一样。
 * 序列是「一次加载、循环 seek」，单帧是「一次加载、seek 一次」，两条路径必须汇合。
 */

const SITE = path.resolve('_site');
const fixture = path.join(SITE, '__seq_test.html');
const tmp = path.join(SITE, '__seq_out');

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<link rel="stylesheet" href="vk/fonts.css"><link rel="stylesheet" href="vk/vk.css"></head>
<body><vk-page dur="1" beat="0.5">
  <vk-stack gap="md">
    <vk-title at="0" enter="rise" dur="0.3" size="subhead" eyebrow="测试">帧序列</vk-title>
    <vk-text id="b" at="0.4" enter="rise" dur="0.3" size="body">第二块在 0.4 秒进来</vk-text>
  </vk-stack>
</vk-page><script src="dist/vk.js"></script></body></html>`;

test('帧序列的每一帧与 --at 单帧逐像素一致', () => {
  fs.mkdirSync(SITE, { recursive: true });
  fs.writeFileSync(fixture, page);
  fs.rmSync(tmp, { recursive: true, force: true });

  const shot = (args) =>
    spawnSync(process.execPath, ['cli/shot.mjs', fixture, ...args], {
      encoding: 'utf8',
      timeout: 120000,
    });

  const seq = shot(['--fps', '10', '--range', '0-0.6', '--out-dir', tmp]);
  assert.equal(seq.status, 0, seq.stderr || seq.stdout);

  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  assert.equal(files.length, 6, `应出 6 帧，实际 ${files.length}`);

  // t = 0.3 是第 4 帧（0, 0.1, 0.2, 0.3）。单帧会带自检结果（留白提醒让退出码非 0），
  // 这里只要文件真的写出来了。
  shot(['--at', '0.3', '--out', path.join(SITE, '__seq_one.png'), '--keep']);
  assert.ok(fs.existsSync(path.join(SITE, '__seq_one.png')), '单帧没写出来');

  const a = PNG.sync.read(fs.readFileSync(path.join(tmp, files[3])));
  const b = PNG.sync.read(fs.readFileSync(path.join(SITE, '__seq_one.png')));
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) diff++;
  }
  assert.equal(diff, 0, `序列第 4 帧与 --at 0.3 差 ${diff} 个像素`);

  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(fixture, { force: true });
  fs.rmSync(path.join(SITE, '__seq_one.png'), { force: true });
});

test('poster 有不同的值时，vk shot 出的是封面那一刻', () => {
  const p2 = fixture.replace('__seq_test', '__seq_poster');
  fs.writeFileSync(p2, page.replace('<vk-page dur="1" beat="0.5">', '<vk-page dur="1" beat="0.5" poster="0">'));
  const shot = (args) =>
    spawnSync(process.execPath, ['cli/shot.mjs', p2, ...args], { encoding: 'utf8', timeout: 120000 });

  const startOut = path.join(SITE, '__poster_default.png');
  const endOut = path.join(SITE, '__poster_end.png');
  shot(['--out', startOut, '--keep']);
  shot(['--at', '1', '--out', endOut, '--keep']);
  assert.ok(fs.existsSync(startOut) && fs.existsSync(endOut), '两张图都应该写出来');

  const A = PNG.sync.read(fs.readFileSync(startOut));
  const B = PNG.sync.read(fs.readFileSync(endOut));
  let diff = 0;
  for (let i = 0; i < A.data.length; i += 4) if (A.data[i] !== B.data[i]) diff++;
  assert.ok(diff > 1000, `poster=0 应该和终态明显不同，实际差 ${diff} 像素`);

  for (const f of [p2, startOut, endOut]) fs.rmSync(f, { force: true });
});
