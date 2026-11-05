import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/**
 * 标签是导航，不是注意力。
 * 给 kicker 上一层语义色，不该被算成"本帧的第二个焦点"——
 * 否则作者只能在"给标签上色"和"给答案上色"之间二选一。
 */
const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

after(async () => {
  await closeBrowser(browser);
  await close();
});

const mount = async (body) => {
  const html =
    '<!doctype html><html><head><link rel="stylesheet" href="' +
    base +
    '/vk/vk.css"></head><body><vk-page>' +
    body +
    '</vk-page><script src="' +
    base +
    '/dist/vk.js"></script></body></html>';
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => window.vk.ready());
};

test('带语义色的 kicker 不算焦点', async () => {
  await mount('<vk-label variant="kicker" tone="focus">总览</vk-label>');
  const n = await page.evaluate(() => window.vk.focusRegions(document.querySelector('vk-page')).length);
  assert.equal(n, 0, 'kicker 被算成了焦点');
});

test('kicker + 一处答案时，焦点仍然只有一个', async () => {
  await mount(
    '<vk-stack><vk-label variant="kicker" tone="focus">总览</vk-label>' +
      '<vk-text act="focus">答案</vk-text></vk-stack>'
  );
  const n = await page.evaluate(() => window.vk.focusRegions(document.querySelector('vk-page')).length);
  assert.equal(n, 1, '标签与答案各算一个焦点');
});

test('正文上的 tone 仍然算焦点（豁免不许开太大）', async () => {
  await mount('<vk-text tone="focus">答案</vk-text>');
  const n = await page.evaluate(() => window.vk.focusRegions(document.querySelector('vk-page')).length);
  assert.equal(n, 1);
});
