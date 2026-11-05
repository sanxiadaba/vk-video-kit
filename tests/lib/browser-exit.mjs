import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

/**
 * 启动浏览器：用 launchServer + connect，而不是 launch。
 *
 * 原因：Playwright 的 browser.close() 在还有多个 context 时，会等每个
 * renderer 逐个退出（实测 17 个 context 要 30s）。launchServer 能拿到
 * 浏览器进程句柄，关的时候直接 SIGKILL，毫秒级，也不会把测试进程拖住。
 *
 * 同一个文件里的 newContext 按选项复用：测试的页面互不共享 DOM，但可以
 * 共享字体与样式缓存。每个测试开一个新 context 会把 7MB 字体重新下 一遍，
 * 这是浏览器测试最大的一笔重复开销。
 */
export async function launchBrowser(options = {}) {
  const server = await chromium.launchServer(options);
  const browser = await chromium.connect(server.wsEndpoint());
  Object.defineProperty(browser, '__vkServer', { value: server, configurable: true });

  const contexts = new Map();
  const original = browser.newContext.bind(browser);
  browser.newContext = async (contextOptions = {}) => {
    const key = JSON.stringify(contextOptions);
    const cached = contexts.get(key);
    if (cached && !cached.__vkClosed) return cached;
    const ctx = await original(contextOptions);
    const close = ctx.close.bind(ctx);
    Object.defineProperty(ctx, '__vkClosed', { value: false, writable: true });
    ctx.close = async () => {
      ctx.__vkClosed = true;
      contexts.delete(key);
      await close().catch(() => {});
    };
    contexts.set(key, ctx);
    return ctx;
  };
  // browser.newPage 也走共享 context：否则每个 newPage 都隐式开一个新 context。
  browser.newPage = async (contextOptions = {}) => (await browser.newContext(contextOptions)).newPage();
  return browser;
}

export async function closeBrowser(browser) {
  if (!browser) return;
  const server = browser.__vkServer;
  try {
    const session = await browser.newBrowserCDPSession();
    await session.send('Browser.close').catch(() => {});
  } catch {
    /* 浏览器已经断开 */
  }
  try {
    const proc = server?.process?.();
    if (proc && proc.exitCode === null) {
      // Windows 下 kill 只杀父进程，renderer 子进程会留下来；必须整棵树杀。
      // 不 await：taskkill 自己跑完就行，测试进程不用等它（每个文件省 1–2s）。
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', detached: true }).unref();
      } else {
        proc.kill('SIGKILL');
      }
    }
  } catch {
    /* 进程已经退出 */
  }
}
