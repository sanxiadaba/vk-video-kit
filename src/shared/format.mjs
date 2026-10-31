/**
 * 数字写法：千分位 / 字节 / 十六进制。
 * 14.0 把 vk-stat 并进 vk-text 时，这是唯一需要带走的东西——
 * 排版（标签在上、单位在下）属于配方，数值写法属于文本机制。
 */
export function formatNumber(raw, format) {
  if (!format || format === 'none') return raw;
  const n = Number(String(raw).replace(/[^0-9.eE+-]/g, ''));
  if (!Number.isFinite(n)) return raw;
  if (format === 'thousands' || format === 'bytes') return n.toLocaleString('en-US');
  if (format === 'hex') return '0x' + Math.round(n).toString(16).toUpperCase();
  return raw;
}
