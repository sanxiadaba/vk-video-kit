import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIRRORED, checkMirror, formatMirror } from '../tools/mirror.mjs';

/**
 * 镜像过时 = 静默失效：demo 跑的是旧运行时，页面不报错，vk check 也干净。
 * 所以这条检查本身必须能证明"它真的会红"，否则它只是又一个安静的门。
 *
 * 用临时目录当库和 demo：只验"比字节 + 报修法"这个逻辑，
 * 不依赖 node_modules、不启动浏览器，也不碰真的 demo。
 */

const tool = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'tools',
  'mirror.mjs',
);
const roots = [];

/** 造一对内容完全相同的"库"和"demo"，文件清单跟 sync.mjs 保持一致。 */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-mirror-'));
  roots.push(root);
  const lib = path.join(root, 'lib');
  const demo = path.join(root, 'demo');
  for (const { rel } of MIRRORED) {
    for (const base of [lib, demo]) {
      const file = path.join(base, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `/* ${rel} 的构建产物 */\nconst 版本 = 1;\n`);
    }
  }
  return { lib, demo };
}

/** 改一个字节：模拟 demo 的镜像落后（或被人手抄坏）一版。 */
function corrupt(file) {
  const buf = fs.readFileSync(file);
  buf[buf.length - 1] ^= 0xff;
  fs.writeFileSync(file, buf);
}

const cli = (demo, lib) =>
  spawnSync(process.execPath, [tool, demo, '--lib', lib], { encoding: 'utf8' });

after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

test('产物镜像：一致时通过，并报出比了几个文件', () => {
  const { lib, demo } = sandbox();
  const r = checkMirror({ demo, lib });
  assert.equal(r.ok, true);
  assert.equal(r.bad.length, 0);
  assert.equal(r.files.length, MIRRORED.length);
  const lines = formatMirror(r);
  assert.match(lines[0], /^✓ 产物镜像（与库一致/);
});

test('产物镜像：demo 改一个字节就失败，并给出可执行的修复命令', () => {
  const { lib, demo } = sandbox();
  corrupt(path.join(demo, 'dist/vk.js'));

  const r = checkMirror({ demo, lib });
  assert.equal(r.ok, false, '差一个字节也必须红');
  assert.deepEqual(
    r.bad.map((f) => f.rel),
    ['dist/vk.js'],
  );

  const text = formatMirror(r).join('\n');
  assert.match(text, /^✗ 产物镜像（与库不一致/);
  assert.match(text, /dist\/vk\.js：内容不同/);
  assert.match(
    text,
    /修复：在 demo 目录跑 `node tools\/film\.mjs`，它的第一步会 sync/,
  );
  assert.match(text, /node tools\/sync\.mjs/);
});

test('产物镜像：把字节改回去就恢复通过', () => {
  const { lib, demo } = sandbox();
  const file = path.join(demo, 'dist/vk.js');
  const original = fs.readFileSync(file);
  corrupt(file);
  assert.equal(checkMirror({ demo, lib }).ok, false);
  fs.writeFileSync(file, original);
  const r = checkMirror({ demo, lib });
  assert.equal(r.ok, true, '恢复后必须自己变绿，不能要求删缓存');
});

test('产物镜像：demo 缺文件也算不一致，文案照样给修法', () => {
  const { lib, demo } = sandbox();
  fs.rmSync(path.join(demo, 'vk/vk.css'));
  const r = checkMirror({ demo, lib });
  assert.equal(r.ok, false);
  assert.equal(r.bad[0].rel, 'vk/vk.css');
  assert.match(formatMirror(r).join('\n'), /demo 里没有 vk\/vk\.css/);
  assert.match(formatMirror(r).join('\n'), /node tools\/film\.mjs/);
});

test('产物镜像 CLI：不一致退出码 1，恢复后退出码 0（demo-check 靠它）', () => {
  const { lib, demo } = sandbox();
  const file = path.join(demo, 'dist/vk.js');
  const original = fs.readFileSync(file);
  corrupt(file);

  const red = cli(demo, lib);
  assert.equal(red.status, 1, `不一致时应返回 1：${red.stdout}${red.stderr}`);
  assert.match(red.stdout, /✗ 产物镜像（与库不一致/);
  assert.match(red.stdout, /修复：在 demo 目录跑 `node tools\/film\.mjs`/);

  fs.writeFileSync(file, original);
  const green = cli(demo, lib);
  assert.equal(green.status, 0, green.stderr);
  assert.match(green.stdout, /^✓ 产物镜像（与库一致/m);
});

test('产物镜像：--no-mirror-check 可放行（特殊场景）', () => {
  const { lib, demo } = sandbox();
  corrupt(path.join(demo, 'dist/vk.js'));
  const r = spawnSync(
    process.execPath,
    [tool, demo, '--lib', lib, '--no-mirror-check'],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0);
  assert.match(r.stdout, /已关闭/);
});
