/** 打开一个页面、等 vk.ready()、收集运行时错误。check 与 shot 共用。 */
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

export async function openPage(browser, file, { width = 1920, height = 1080, scale = 1 } = {}) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`找不到 ${file}`);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await tab.goto(pathToFileURL(abs).href, { waitUntil: 'load' });
  await tab.evaluate(async () => {
    // 先把会用到的字体显式拉一遍：只等 fonts.ready 有时会在 CJK / KaTeX 切片
    // 还没被触发加载时就返回，首跑与后跑的字形度量不一致，截图会“随机”差一点。
    const faces = [
      '400 56px Inter',
      '700 112px Inter',
      '400 56px "Noto Sans SC"',
      '400 56px "JetBrains Mono"',
      '400 56px KaTeX_Main',
      '400 56px KaTeX_Math',
    ];
    await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {})));
    await document.fonts.ready;
  });
  await tab.evaluate(async () => {
    if (window.vk?.ready) await window.vk.ready();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return { tab, errors, close: () => ctx.close() };
}

export const wait = (tab) =>
  tab.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
