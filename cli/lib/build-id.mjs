/**
 * 构建标识：页面、磁盘产物、dev server 三方对齐用。
 *
 * 只哈希「会影响画面 / 会影响服务端 transform」的文件；build.json 自身不参与，
 * 否则每次写盘都会变。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

export const BUILD_FILES = [
  'dist/vk.js',
  'vk/vk.css',
  'src/registry.mjs',
  'site/site.js',
  'site/site.css',
];

export const SERVER_FILES = [
  'cli/serve.mjs',
  'src/highlight.mjs',
  'src/shared/code.mjs',
  'src/registry.mjs',
  'src/icons.generated.mjs',
  'src/runtime/code-utils.mjs',
];

function hash(files) {
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f + '\0');
    try {
      h.update(fs.readFileSync(f));
    } catch {
      h.update('missing');
    }
  }
  return h.digest('hex').slice(0, 12);
}

export const computeBuildId = () => hash(BUILD_FILES);
export const computeServerId = () => hash(SERVER_FILES);
