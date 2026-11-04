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

test('--step 依次执行，写清每一步的命令与输出', () => {
  const file = path.join(dir, 'steps.txt');
  const r = run([
    '--step', 'echo step-one',
    '--step', 'cd .',
    '--step', 'echo step-two',
    '--out', file,
    '--quiet',
  ]);
  assert.equal(r.status, 0, r.stderr);
  // 没有输出的 step 只留命令行；提示符固定 $。
  assert.equal(fs.readFileSync(file, 'utf8'), '$ echo step-one\nstep-one\n$ cd .\n$ echo step-two\nstep-two\n');
  const meta = JSON.parse(fs.readFileSync(file + '.meta.json', 'utf8'));
  assert.equal(meta.kind, 'run');
  assert.equal(meta.exit, 0);
  assert.deepEqual(meta.steps.map((s) => s.cmd), ['echo step-one', 'cd .', 'echo step-two']);
  assert.deepEqual(meta.steps.map((s) => s.stdout), ['step-one', '', 'step-two']);
  assert.ok(meta.steps.every((s) => s.exit === 0 && Number.isFinite(s.ms)), 'steps 缺少 exit/ms');
  assert.equal(run(['--verify', file, '--quiet']).status, 0);
});

test('--step 与 --run 互斥', () => {
  const r = run(['--run', 'echo x', '--step', 'echo y', '--out', path.join(dir, 'both.txt'), '--quiet']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /只能二选一/);
});

test('--verify 认得出"素材被改过"', () => {
  assert.equal(run(['--verify', out, '--quiet']).status, 0);
  fs.appendFileSync(out, '手写的一行\n');
  assert.equal(run(['--verify', out, '--quiet']).status, 1, '改过素材却没被发现');
});

test('--cues：按字幕时间点逐段截图并写清单', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vk-cues-shots-'));
  const r = run(['--cues', '_site/specimen/vk-cues.html', '--out-dir', dir, '--quiet']);
  assert.equal(r.status, 0, r.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'cues.json'), 'utf8'));
  assert.equal(manifest.kind, 'cues');
  assert.equal(manifest.cues.length, 3, '示例页应有 3 条字幕');
  for (const cue of manifest.cues) {
    const file = path.join(dir, cue.file);
    assert.ok(fs.existsSync(file), `缺少截图 ${file}`);
    assert.ok(fs.statSync(file).size > 1024, `截图是空的 ${file}`);
    assert.ok(cue.t >= cue.start && cue.t <= cue.end, '截图时间点要落在这一段里');
  }
});
