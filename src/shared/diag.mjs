/**
 * 构建期诊断：三段式。
 *
 * 报错即文档。AI 在犯错的那一刻读到"你写了什么 / 该写什么 / 为什么"，
 * 比让它提前读 40K 的 reference.md 有效得多；人读到也不会被一句
 * "属性校验失败"挡在门外。
 *
 * 约定：
 *   · 第一行是定位（文件:行 <标签> 一句话症状），可被 grep、可被编辑器点开。
 *   · 之后三行固定缩进两格，顺序固定：你写了 / 应该写 / 为什么。
 *   · 没有的段直接省略，不留空标签。
 */
export function diag({ file, line, tag, what, wrote, should, why }) {
  const out = [`${file}:${line} <${tag}> ${what}`];
  if (wrote) out.push(`  你写了：${wrote}`);
  if (should) out.push(`  应该写：${should}`);
  if (why) out.push(`  为什么：${why}`);
  return out.join('\n');
}
