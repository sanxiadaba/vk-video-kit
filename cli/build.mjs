/**
 * 构建期高亮：把 <vk-code> / <vk-diff> 预编译成「源码 + 语义 class + hash」。
 *
 * 这一层只是 CLI；真正的实现在 src/highlight.mjs —— dev server 调的是同一份核心。
 *
 * 用法：
 *   node cli/build.mjs                 # 处理 _site/specimens/
 *   node cli/build.mjs ep02/           # 处理某一期（递归）
 *   node cli/build.mjs --check         # 只检查，不写文件（CI 用）
 *
 * 代码可以从文件来：<vk-code lang="c" src="code/hello.c">，不用把 `<` 写成 `&lt;`。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

const CACHE = '.vk-cache/precompile.json';
const stripGenerated = (html) =>
  html.replace(/<script\b[^>]*\bdata-vk-(?:src|hl|hl-diff|asm|tree|frames|bytes|math)\b[^>]*>[\s\S]*?<\/script>/gi, '');
const fileKey = (file, html) => {
  const h = crypto.createHash('sha1');
  h.update(stripGenerated(html));
  for (const m of html.matchAll(/\bsrc="([^"]+)"/g)) {
    const src = m[1];
    if (/^(?:[a-z]+:|\/|#)/i.test(src)) continue;
    const abs = path.resolve(path.dirname(file), src.split(/[?#]/)[0]);
    h.update('\0' + abs);
    try {
      const st = fs.statSync(abs);
      h.update(`${st.size}:${st.mtimeMs}`);
    } catch {
      /* 缺文件交给 transform 报错 */
    }
  }
  return h.digest('hex');
};

function walk(input, out) {
  const stat = fs.statSync(input);
  if (stat.isFile()) {
    if (input.endsWith('.html')) out.push(input);
    return;
  }
  for (const f of fs.readdirSync(input)) {
    if (f === 'node_modules' || f.startsWith('.')) continue;
    const p = path.join(input, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
}

export async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const force = args.includes('--force');
  const inputs = args.filter((a) => a !== '--check' && a !== '--force');
  const files = [];

  // 不带参数时：仓库里默认 _site/specimens，别的地方默认当前目录
  if (!inputs.length) {
    walk(fs.existsSync('_site/specimens') ? '_site/specimens' : '.', files);
    if (!files.length) {
      console.error('[vk] 当前目录没有 .html 文件。用法：vk build <文件或目录>');
      process.exitCode = 2;
      return;
    }
  } else {
    for (const a of inputs) {
      if (!fs.existsSync(a)) {
        console.error(`[vk] 找不到 ${a}`);
        process.exitCode = 2;
        return;
      }
      walk(a, files);
    }
  }

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')).files || {};
  } catch {
    /* 首次构建：没有缓存 */
  }
  const nextCache = { ...cache };

  let highlighter = null;
  const getHighlighter = async () => (highlighter ||= await createVkHighlighter());

  let blocks = 0;
  let changed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const abs = path.resolve(file);
    const original = fs.readFileSync(file, 'utf8');
    const key = fileKey(file, original);
    const needs = /<vk-(?:code|term|diff|asm|math|tree|bytes|frames|icon)\b/.test(original);
    const generated = /data-vk-(?:icons|math|hl|hl-diff|src|asm|tree|frames|bytes)\b/.test(original);
    if (!check && !force && cache[abs] === key && (!needs || generated)) {
      skipped++;
      continue;
    }
    try {
      const needsHl = /<vk-(?:code|diff|asm)\b/.test(original);
      const hl = needsHl ? await getHighlighter() : null;
      const out = await transformHtml(original, { file, highlighter: hl });
      blocks += out.count;
      if (check) {
        if (out.html !== original) {
          console.error(`✗ ${file}  (预编译已过期，重跑 node cli/build.mjs)`);
          failed++;
        } else {
          console.log(`✓ ${file}`);
          nextCache[abs] = key;
        }
      } else if (out.html !== original) {
        fs.writeFileSync(file, out.html);
        changed++;
        nextCache[abs] = key;
        console.log(`  ${file}  ${out.count} block(s)`);
      } else {
        nextCache[abs] = key;
      }
    } catch (e) {
      console.error(`✗ ${file}: ${e.message}`);
      failed++;
    }
  }

  if (!check) {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify({ files: nextCache }, null, 0) + '\n');
  }

  if (check) {
    console.log(failed ? `\n${failed} 个文件需要重新预编译` : `\n全部是最新的${skipped ? `（${skipped} 个缓存命中）` : ''}`);
  } else {
    console.log(`\ndone · ${blocks} block(s), ${changed} file(s) written${skipped ? `, ${skipped} cached` : ''}${failed ? `, ${failed} failed` : ''}`);
  }
  process.exitCode = failed ? 1 : 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();



