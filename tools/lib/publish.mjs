/**
 * 把库产物镜像进 out/，让 out/ 成为一个自包含的静态站点：
 * 页面在 out/pages/ 用 ../vk、../dist、../assets 就能取到。
 */
import fs from 'node:fs';

export function publish() {
  for (const dir of ['vk', 'dist', 'assets']) {
    if (!fs.existsSync(dir)) throw new Error(`缺少 ${dir}/：先跑 npm run build`);
    fs.rmSync(`out/${dir}`, { recursive: true, force: true });
    fs.cpSync(dir, `out/${dir}`, { recursive: true });
  }
}
