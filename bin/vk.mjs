#!/usr/bin/env node
/**
 * vk CLI —— 随包发布，装完就能用。
 *
 *   vk build [files...]   把 <vk-code src> 与 <vk-math> 预编译成自包含 HTML
 *   vk serve [port]       开发服务器，改文件刷新即见
 *   vk check              只检查预编译数据是否最新
 */
const [, , cmdRaw, ...rest] = process.argv;
const cmd = cmdRaw || 'help';

const need = async (pkg, why) => {
  try {
    return await import(pkg);
  } catch {
    console.error(`\n[vk] 缺少 ${pkg}（${why}）。包的依赖未装好，请重新安装 vk-video-kit。\n`);
    process.exit(1);
  }
};

if (cmd === 'build' || cmd === 'check') {
  await need('shiki', '代码高亮');
  await need('parse5', '解析 HTML');
  await need('katex', '公式渲染');
  process.argv = [process.argv[0], 'precompile', ...(cmd === 'check' ? ['--check'] : []), ...rest];
  const m = await import('../cli/build.mjs');
  await m.main();
} else if (cmd === 'serve') {
  await need('shiki', '代码高亮');
  await need('parse5', '解析 HTML');
  await need('katex', '公式渲染');
  const m = await import('../cli/serve.mjs');
  await m.main(Number(rest[0]) || 8099, process.cwd());
} else if (cmd === 'shot') {
  const m = await import('../cli/shot.mjs');
  void m;
} else {
  console.log(`
vk —— 把内容做成画面单元

  vk build [files...]   预编译代码高亮与公式（产物自包含）
  vk check              只检查是否最新，不写入
  vk serve [port]       开发服务器（默认 8099）
  vk shot <page.html>   截一张 1920×1080（--phone / --crop x,y,w,h）

用法与属性见包内的 README.md / USAGE.md，给 AI 的入口是 docs/ai.md。
`);
}
