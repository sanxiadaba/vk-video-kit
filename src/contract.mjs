/**
 * v27 · 契约（门面）
 * ----------------------------------------------------------------------------
 * 校验在 contract/validate.mjs，文档在 contract/doc.mjs；导入方只认这个文件。
 * 这里只留仓内真的有人 import 的出口（bin/vk.mjs、tools/*.mjs、src/build/*.mjs），
 * 不替别的层再导一遍内部工具——想用就直接进模块。
 */
export { VERSION } from './version.mjs';
export { validate, asOf } from './contract/validate.mjs';
/* 诊断分级是跨文件契约：build 只给 error 画红框，render 只把 error 算进 ok。 */
export { isHint, isError, severityOf } from './contract/codes.mjs';
export { contract, markdown, markdownFull, docText, exampleFrame } from './contract/doc.mjs';
