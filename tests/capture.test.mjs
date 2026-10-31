import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 素材必须是"跑出来的"，不能是"写出来的"。
 * vk capture 记录命令与产物哈希；--verify 在两者不一致时红。
 * demo 里出现过手写终端输出，这条就是防它再回来。
 */
const vk = path.resolve('bin/vk.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-capture-'));
const out = path.join(dir, 'echo.txt');
const run = (args) => spawnSync(process.execPath, [vk, 'capture', ...args], { encoding: 'utf8' });

test('capture 跑真命令并写出命令与哈希', () => {
  const r = run(['--run', 'echo hello-from-capture', '--out', out, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  const text = fs.readFileSync(out, 'utf8');
  assert.match(text, /hello-from-capture/);
  const meta = JSON.parse(fs.readFileSync(out + '.meta.json', 'utf8'));
  assert.equal(meta.kind, 'run');
  assert.equal(meta.exit, 0);
  assert.ok(meta.cmd.includes('echo'));
  assert.ok(meta.outHash, '缺少产物哈希');
});

test('--verify 认得出"素材被改过"', () => {
  assert.equal(run(['--verify', out, '--quiet']).status, 0);
  fs.appendFileSync(out, '手写的一行\n');
  assert.equal(run(['--verify', out, '--quiet']).status, 1, '改过素材却没被发现');
});
