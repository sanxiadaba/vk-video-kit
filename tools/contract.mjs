/**
 * 生成 docs/CONTRACT.md —— 契约的唯一人读版本。
 *
 * 数据来自 src/schema.mjs + src/vocab.mjs，不要手写第二份（v17 的 SPEC 就是
 * 手抄副本，实测漂移了 10 处）。
 *
 *   node tools/contract.mjs           生成
 *   node tools/contract.mjs --check   只校验（测试用）
 */
import fs from 'node:fs';
import { markdown } from '../src/contract.mjs';

const OUT = 'docs/CONTRACT.md';
const body = markdown();

if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (now !== body) {
    console.error(`✗ ${OUT} 与 schema 不一致：跑 node tools/contract.mjs`);
    process.exit(1);
  }
  console.log('✓ 契约文档与 schema 一致');
} else {
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(OUT, body);
  console.log(`✓ ${OUT}（${body.split('\n').length} 行）`);
}
