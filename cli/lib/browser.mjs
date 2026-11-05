/** 浏览器会话：一个 context、一个 tab、按页导航。字体缓存跨页复用。 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function launch() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    try {
      ({ chromium } = await import('playwright-core'));
    } catch {
      console.error('\n[vk] 缺少 playwright（自检/截图需要它）。在仓库里 npm i -D playwright。\n');
      process.exit(1);
    }
  }
  return chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
}

/** 打开一个会话。宽度固定，所有页共用；字体只加载一次。 */
export async function openSession(browser, { width = 1920, height = 1080 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  return {
    tab,
    async open(file) {
      const abs = path.resolve(file);
      if (!fs.existsSync(abs)) throw new Error(`找不到 ${file}`);
      errors.length = 0;
      await tab.goto(pathToFileURL(abs).href, { waitUntil: 'load' });
      await tab.evaluate(async () => {
        if (window.vk?.ready) await window.vk.ready();
        // 组件把文字写进 DOM 之后再等一次字体：CJK 切片是按实际用字异步加载的。
        await document.fonts.ready;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      return errors;
    },
    close: () => ctx.close(),
  };
}
