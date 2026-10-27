/** npm run build 的最后一步：把内容指纹写进 _site，供 test-all 判断要不要重建。 */
import fs from 'node:fs';
import { fingerprint } from './lib/fingerprint.mjs';
const out = '_site/.fingerprint';
const next = fingerprint();
let old = null;
try {
  old = fs.readFileSync(out, 'utf8').trim();
} catch {
  /* 第一次 */
}
if (old !== next) fs.writeFileSync(out, next);
console.log(`stamp: ${next}`);
