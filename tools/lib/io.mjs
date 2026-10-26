/* 生成物写入/比对：所有生成器共用，保证 build 可复现、check 只读。 */
import fs from 'node:fs';
import path from 'node:path';

export const checkMode = () => process.argv.includes('--check');

function read(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

/**
 * 内容相同就不动；check 模式只报告漂移，不写盘。
 * @returns {boolean} 是否发生了写入（或 check 模式下的漂移）
 */
export function writeIfChanged(file, content, check = checkMode()) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const old = read(file);
  if (old && old.equals(buf)) return false;
  if (check) {
    console.error(`✗ ${file}  ${old ? '内容已过期' : '文件缺失'}`);
    process.exitCode = 1;
    return true;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return true;
}

export function removeIfExists(file, check = checkMode()) {
  if (!fs.existsSync(file)) return false;
  if (check) {
    console.error(`✗ ${file}  应删除（旧产物）`);
    process.exitCode = 1;
    return true;
  }
  fs.rmSync(file, { force: true });
  return true;
}
