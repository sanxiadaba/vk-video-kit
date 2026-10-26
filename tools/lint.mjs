/**
 * 语法门禁：src/、cli/、tools/、tests/ 下每个 .mjs / .js 都过一遍解析。
 *
 *   node tools/lint.mjs
 *
 * 用 esbuild 的解析器在一个进程里检查全部文件；不写盘，不执行。
 * 语义由测试和门禁负责。
 */
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';

const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.mjs') || ent.name.endsWith('.js')) files.push(p);
  }
}
for (const dir of ['src', 'cli', 'tools', 'tests']) if (fs.existsSync(dir)) walk(dir);

let failed = 0;
for (const file of files.sort()) {
  try {
    await transform(fs.readFileSync(file, 'utf8'), {
      loader: 'js',
      format: 'esm',
      target: 'node20',
      sourcefile: file,
    });
  } catch (e) {
    failed++;
    console.error(`✗ ${file}`);
    for (const err of e.errors || []) {
      console.error(`  ${err.location?.line ?? '?'}: ${err.text}`);
    }
  }
}

if (failed) {
  console.error(`\n语法检查失败：${failed}/${files.length} 个文件。`);
  process.exitCode = 1;
} else {
  console.log(`语法检查通过：${files.length} 个文件。`);
}
