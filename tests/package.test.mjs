import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

test('package exports 指向真实文件，不再暴露内部子路径', () => {
  for (const target of [pkg.main, pkg.module, pkg.types]) assert.ok(fs.existsSync(target), target);
  for (const [key, value] of Object.entries(pkg.exports)) {
    if (typeof value === 'string') assert.ok(fs.existsSync(value), `${key} -> ${value}`);
  }
  for (const gone of ['./icons.js', './registry', './scenes', './katex.css']) {
    assert.ok(!(gone in pkg.exports), `${gone} 不应再导出`);
  }
});

test('files 白名单：只发运行时、字体、CLI、元数据与根文档', () => {
  const files = new Set(pkg.files);
  for (const p of [
    'dist',
    'vk',
    'assets/fonts',
    'types',
    'icons.json',
    'custom-elements.json',
    'vscode-html-data.json',
    'web-types.json',
    'bin',
    'cli',
    'src/highlight.mjs',
    'src/registry.mjs',
    'README.md',
    'USAGE.md',
    'LICENSE',
    'CHANGELOG.md',
  ]) {
    assert.ok(files.has(p), `files 缺少 ${p}`);
  }
  for (const p of ['tools', 'site', '_site', 'shots', 'specimens', 'frames', 'docs', 'code', 'assets/img']) {
    assert.ok(!files.has(p), `files 不该包含 ${p}`);
  }
});

test('脚本：构建链、快检与包体门禁都在', () => {
  assert.equal(pkg.scripts.contract, 'node tools/contract-all.mjs');
  assert.equal(pkg.scripts['contract:one'], 'node tools/contract.mjs');
  assert.match(pkg.scripts.test, /tools\/test-all\.mjs/);
  assert.match(pkg.scripts['test:fast'], /--fast/);
  assert.match(pkg.prepack, /npm run build/);
  assert.equal(typeof pkg.scripts.format, 'string');
  for (const gone of ['copy', 'self-test', 'evidence', 'visual', 'audit', 'coverage']) {
    assert.ok(!pkg.scripts[gone], `脚本 ${gone} 应删除`);
  }
  for (const f of ['tools/copy-test.mjs', 'tools/self-test.mjs', 'tools/migrate-v10.mjs']) {
    assert.ok(!fs.existsSync(f), `${f} 应删除`);
  }
});

test('版本 / lock 同步', () => {
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
});

test('ESM 入口在 Node 里可导入（浏览器 API 有守卫）', () => {
  const r = spawnSync(process.execPath, ['-e', "import('./dist/vk.esm.js').then(m=>console.log(m.vk.version))"], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('真实示例文件存在（不随包发布）', () => {
  for (const f of ['code/hello.c', 'code/array.c', 'code/real.diff', 'code/warn.c', 'code/broken.c']) {
    assert.ok(fs.existsSync(f), f);
  }
});

test('CI 只要求 chromium，不要求 msedge', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /npx playwright install chromium/);
  assert.ok(!/msedge/i.test(ci), 'CI 不应要求 msedge');
  assert.match(ci, /node-version:\s*20/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm run build/);
  assert.match(ci, /npm test/);
});
