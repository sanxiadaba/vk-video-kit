/**
 * 构建标识：页面、磁盘产物、dev server 三方对齐用。
 *
 * 路径一律按**库根**解析，不看 cwd。serve 常是在项目目录里起的
 * （`cd 某一集 && vk serve 4321`），那里既没有 src/ 也没有 dist/；
 * 以前按 cwd 读，读不到就把 "missing" 算进哈希 —— 每个进程算出来的都一样，
 * 于是「库改过了」和「库没改」永远相等，过时检测静默失效
 * （页面报「未知标签 vk-label」，提示却怪页面写错了）。
 * 现在库根由本文件位置定，跟从哪儿起服务器无关。
 *
 * 两枚指纹：
 *   build  —— 会影响画面 / 会影响服务端 transform 的文件
 *   server —— 服务端自己（serve.mjs / highlight / registry …）
 *
 * 判定「这个进程过时」要把两者都比：库一重建，dist/build.json 的 id 与
 * dist/vk.js 都会变，而进程里的 registry / transform 还是启动时那一份。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** 库根：cli/lib/ 往上两级。所有指纹都相对它。 */
export const LIB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

const read = (file, root) => {
  try {
    return fs.readFileSync(path.join(root, file));
  } catch {
    return null;
  }
};

function hash(files, root = LIB_ROOT) {
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(f + '\0');
    h.update(read(f, root) || 'missing');
  }
  return h.digest('hex').slice(0, 12);
}

export const computeBuildId = (root = LIB_ROOT) => hash(BUILD_FILES, root);
export const computeServerId = (root = LIB_ROOT) => hash(SERVER_FILES, root);

/**
 * 「这一份 dist 是哪次构建」：优先 build.json 的 id；
 * 没有 / 坏了就退回 dist/vk.js + vk/vk.css 的哈希（手改产物也能抓到）。
 */
export function readBuildStamp(root = LIB_ROOT) {
  const raw = read('dist/build.json', root);
  if (raw) {
    try {
      const { id } = JSON.parse(raw.toString('utf8'));
      if (typeof id === 'string' && id) return id;
    } catch {
      /* 坏 json：退回产物哈希 */
    }
  }
  const js = read('dist/vk.js', root);
  const css = read('vk/vk.css', root);
  if (!js && !css) return 'none';
  const h = crypto.createHash('sha256');
  h.update(js || 'missing');
  h.update('\0');
  h.update(css || 'missing');
  return 'h' + h.digest('hex').slice(0, 11);
}

/**
 * 进程过时判据：服务端代码 + 构建产物。
 * 任何一个库文件改了（重建 dist、改 registry、改 serve），这里都会不同。
 */
export const computeStamp = (root = LIB_ROOT) => `${computeServerId(root)}.${readBuildStamp(root)}`;

/** 纯判定：启动时的 stamp 与现在的 stamp 不同 = 这个进程比磁盘上的库旧。 */
export const isStale = (startupStamp, nowStamp) => startupStamp !== nowStamp;
