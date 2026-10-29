import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

test('私有包：不再保留 npm 发布面', () => {
  for (const gone of ['exports', 'files', 'prepack', 'prepublishOnly', 'keywords', 'repository', 'homepage', 'bugs']) {
    assert.ok(!(gone in pkg), `${gone} 应删除（私有工具，不发 npm）`);
  }
  assert.ok(!('pack:check' in pkg.scripts), 'pack:check 应删除');
  assert.ok(!fs.existsSync('tools/pack-check.mjs'), 'tools/pack-check.mjs 应删除');
  for (const target of [pkg.main, pkg.module, pkg.types]) assert.ok(fs.existsSync(target), target);
});

test('本地脚本：构建、契约、门禁、测试都在', () => {
  for (const name of ['build', 'gen', 'verify', 'contract', 'contract:one', 'gate', 'test', 'test:fast', 'quick']) {
    assert.equal(typeof pkg.scripts[name], 'string', `缺少脚本 ${name}`);
  }
  assert.match(pkg.scripts.test, /tools\/test-all\.mjs/);
  assert.match(pkg.scripts['test:fast'], /--fast/);
  assert.equal(typeof pkg.scripts.format, 'string');
  for (const gone of ['copy', 'self-test', 'evidence', 'visual', 'audit', 'coverage']) {
    assert.ok(!pkg.scripts[gone], `脚本 ${gone} 应删除`);
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

test('站点根与子目录的相对路径各就各位（GitHub Pages 子路径部署）', () => {
  const root = fs.readFileSync('_site/index.html', 'utf8');
  assert.ok(root.includes('href="vk/vk.css"'), '索引在站点根，样式必须是 vk/vk.css');
  assert.ok(root.includes('src="dist/vk.js"'), '索引在站点根，脚本必须是 dist/vk.js');
  assert.ok(!root.includes('"../vk/'), '索引不能上跳一层：Pages 子路径下会 404');

  const inner = fs.readFileSync('_site/specimen/vk-box.html', 'utf8');
  assert.ok(inner.includes('href="../vk/vk.css"'), '规格页在 specimen/ 下，要上跳一层');
  assert.ok(inner.includes('src="../dist/vk.js"'), '规格页在 specimen/ 下，要上跳一层');
});
