/**
 * 生成样张：tests/pages/<tag>.html。
 * 样张只用于构建 / 截图回归 / 画廊，不进库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SAMPLES, fixturePage } from './samples.mjs';

const dir = 'tests/pages';
fs.mkdirSync(dir, { recursive: true });
for (const tag of Object.keys(SAMPLES)) {
  fs.writeFileSync(path.join(dir, `${tag}.html`), fixturePage(tag));
}
console.log(`fixtures: ${Object.keys(SAMPLES).length} 张 → ${dir}/`);
