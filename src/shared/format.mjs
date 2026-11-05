/**
 * 数字写法：千分位 / 字节 / 十六进制。
 * 排版（标签在上、单位在下）属于配方，数值写法属于文本机制。
 *
 * 只重排「开头就是一个数」的文本，剩下的部分原样留着：
 * "52,980 字节" 会丢掉"字节"——那不是排版，是把内容改成了另一个数。
 */
export function formatNumber(raw, format) {
  if (!format || format === 'none') return raw;
  const m = String(raw).match(/^(\s*)([+-]?\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
  if (!m) return raw;
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n)) return raw;
  let body;
  if (format === 'hex') body = '0x' + Math.round(n).toString(16).toUpperCase();
  else if (format === 'thousands' || format === 'bytes') body = n.toLocaleString('en-US');
  else return raw;
  return m[1] + body + m[3];
}
