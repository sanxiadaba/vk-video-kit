/**
 * v25 · 契约（门面）
 * ----------------------------------------------------------------------------
 * 校验在 contract/validate.mjs，文档在 contract/doc.mjs；导入方只认这个文件。
 */
export { VERSION, CODES, asOf, checkValue, validate } from './contract/validate.mjs';
export { fmtAttr, contract, markdown, docText } from './contract/doc.mjs';
export { parseLines, parseRange } from './shared/range.mjs';
export { variantOf } from './schema.mjs';
