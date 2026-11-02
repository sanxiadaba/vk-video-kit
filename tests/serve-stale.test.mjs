import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LIB_ROOT, computeServerId, computeStamp, readBuildStamp } from '../cli/lib/build-id.mjs';
import { serverIsStale } from '../cli/serve.mjs';

/**
 * ⑥ · dev server 的过时判定要覆盖「构建产物」。
 *
 * 真实的坑：库新增 vk-label / vk-steps.connector 之后，`vk serve` 那个进程
 * 还在用旧 registry，页面直接报「未知标签 vk-label」。
 * 旧判据只看服务端代码指纹，而且路径是按 cwd 读的 —— serve 是从项目目录里起的，
 * 那里没有 src/、也没有 dist/，六个文件全读成 "missing"，
 * 于是「库改了」和「库没改」算出来的指纹永远一样，自动重启从来没触发过。
 *
 * 这里只测判定（纯函数），不起真进程：stamp 变了 = 过时。
 */

const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vk-stale-'));
const put = (root, file, text) => {
  fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

test('改 dist/build.json 的 id → 判定为过时', () => {
  const root = tmpRoot();
  put(root, 'dist/build.json', JSON.stringify({ id: 'aaaa1111', server: 's0', version: '14.0.0' }));
  const startup = computeStamp(root);
  assert.equal(serverIsStale(startup, root), false, '刚记下的指纹不该判旧');

  put(root, 'dist/build.json', JSON.stringify({ id: 'bbbb2222', server: 's0', version: '14.0.0' }));
  assert.equal(serverIsStale(startup, root), true, '库重建后 build.json 的 id 变了，就是过时');

  assert.notEqual(computeStamp(root), startup, '指纹本身也要变');
});

test('没有 build.json 时退回产物哈希：dist/vk.js 变了也判旧', () => {
  const root = tmpRoot();
  put(root, 'dist/vk.js', 'console.log("build 1");');
  const startup = computeStamp(root);
  assert.equal(serverIsStale(startup, root), false);

  put(root, 'dist/vk.js', 'console.log("build 2");');
  assert.equal(serverIsStale(startup, root), true, '手改产物 / 旧版构建只写 vk.js 时也要抓到');
});

test('build.json 坏了不抛错：退回产物哈希继续判', () => {
  const root = tmpRoot();
  put(root, 'dist/vk.js', 'x');
  put(root, 'dist/build.json', '{ this is not json');
  const a = readBuildStamp(root);
  assert.match(a, /^h[0-9a-f]{11}$/, '坏 json → 用 vk.js 的哈希');
  put(root, 'dist/vk.js', 'y');
  assert.notEqual(readBuildStamp(root), a);
});

test('指纹按库根解析，不看 cwd（serve 是从项目目录起的）', () => {
  const here = process.cwd();
  const elsewhere = tmpRoot();
  process.chdir(elsewhere);
  try {
    assert.equal(
      computeServerId(),
      computeServerId(LIB_ROOT),
      'cwd 里没有 src/ 也要算出与库根相同的指纹（旧实现在这里静默变成 "missing" 的哈希）'
    );
    assert.equal(computeStamp(), computeStamp(LIB_ROOT), 'stamp 同理');
  } finally {
    process.chdir(here);
  }
});

test('真库现在算得出一个具体指纹，且与它自己一致', () => {
  const now = computeStamp();
  assert.match(now, /^[0-9a-f]{12}\./, '形如 <serverId>.<buildId>');
  assert.equal(serverIsStale(now), false, '同一时刻两次判定必须一致');
});
