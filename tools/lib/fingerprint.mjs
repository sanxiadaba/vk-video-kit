/**
 * 构建指纹：src / package.json 的内容哈希。
 * 用内容而不是 mtime —— 重写同样内容时 mtime 会变，内容不会。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOTS = ['src'];
const EXT = /\.(mjs|js|css|json|md)$/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

export function fingerprint() {
  const files = [...ROOTS.flatMap((d) => walk(d)), 'package.json'].sort();
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex').slice(0, 16);
}
