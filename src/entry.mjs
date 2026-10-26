/**
 * ESM 入口：给 bundler 用。
 *
 * 运行时只做一件事：把作者写的标签变成成品画面。
 * 代码高亮 / 公式在构建期完成；时间轴在编排层；运行时零依赖。
 */
import './runtime/index.mjs';

export const vk = globalThis.vk;
export default globalThis.vk;
