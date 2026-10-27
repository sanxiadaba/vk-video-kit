import { esc } from './base.mjs';

/** 三点是窗的形状：红 / 黄 / 绿，观众一眼认出"这是一个窗口"。 */
export const DOTS = '<span class="vk-dots"><i></i><i></i><i></i></span>';

/**
 * 全库唯一的窗壳。L3 只决定 head 和 inner。
 * @param {{surface?: 'paper'|'ink', chrome?: 'min'|'none', head?: string, inner?: string, cls?: string}} o
 */
export function win({ surface = 'paper', chrome = 'min', head = '', inner = '', cls = '', attrs = '' } = {}) {
  const material = surface === 'ink' ? 'ink' : 'paper';
  const klass = cls ? ` ${cls}` : '';
  const bar = chrome === 'none' ? '' : `<div class="vk-hd" data-vk-part="hd">${head}</div>`;
  return `<div class="vk-win${klass}" data-material="${material}" data-surface="${material}" data-chrome="${esc(chrome)}"${attrs}>${bar}${inner}</div>`;
}

/** 文件名 + 可选行段 + 语言角标。tab 不再自带第二个"窗口点"。 */
export function fileHead(file, lang, range = '') {
  const label = file ? `${file}${range && !file.includes(range) ? ` · ${range}` : ''}` : '';
  return `${label ? `<span class="vk-file" data-meta>${esc(label)}</span>` : ''}${lang ? `<span class="vk-lang" data-meta>${esc(lang)}</span>` : ''}`;
}
