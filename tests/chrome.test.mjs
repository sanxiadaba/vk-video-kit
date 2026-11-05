import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, launchBrowser } from './lib/browser-exit.mjs';
import { startServer } from '../cli/serve.mjs';

/**
 * 窗类组件的窗头必须一致：左边三个点，右边有文件名/标题。
 * 第 4 站那棵树曾经是一张光秃秃的卡片——同一类东西长得不一样，
 * 观众会以为它们是两种东西。
 *
 * 减法第一波：vk-window 并进 vk-panel（chrome="dots"），它的窗头
 * 由 tests/merged-six.test.mjs 单独守；这里只验"内容组件的窗"。
 */
const WINDOWY = ['vk-asm', 'vk-tree', 'vk-code', 'vk-term', 'vk-bytes', 'vk-diff'];

const { base, close } = await startServer({ port: 0, root: '_site', transform: false });
const browser = await launchBrowser({ channel: 'msedge' }).catch(() => launchBrowser());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

after(async () => {
  await closeBrowser(browser);
  await close();
});

for (const tag of WINDOWY) {
  test(`${tag} 的窗头有三个点和标题`, async () => {
    await page.goto(`${base}/specimens/${tag}.html`, { waitUntil: 'load' });
    await page.evaluate(() => window.vk.ready());
    const r = await page.evaluate((t) => {
      const host = document.querySelector(t);
      const hd = host?.querySelector('[data-vk-part="hd"], .vk-asm-hd, .vk-tree-hd, .vk-code-hd, .vk-term-hd, .vk-diff-hd, .vk-bytes-hd');
      const dots = host?.querySelector('.vk-dots');
      return { dots: !!dots, dotsCount: dots ? dots.children.length : 0, hdText: (hd?.textContent || '').trim().length };
    }, tag);
    assert.equal(r.dots, true, `${tag} 没有三个点`);
    assert.equal(r.dotsCount, 3, `${tag} 的点不是三个`);
    assert.ok(r.hdText > 0, `${tag} 的窗头没有标题`);
  });
}
