/**
 * v26 · 契约（门面）
 * ----------------------------------------------------------------------------
 * 校验在 contract/validate.mjs，文档在 contract/doc.mjs；导入方只认这个文件。
 */
export { VERSION } from './version.mjs';
export { CODES, CODES_INFO } from './contract/codes.mjs';
export { asOf, checkValue, validate } from './contract/validate.mjs';
export { fmtAttr, contract, compact, markdown, markdownFull, docText, exampleFrame } from './contract/doc.mjs';
export { parseLines, parseRange } from './shared/range.mjs';
export { variantOf } from './schema.mjs';
