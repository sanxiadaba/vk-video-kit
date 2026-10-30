import { esc } from './base.mjs';

/** 三点是窗的形状：红 / 黄 / 绿，观众一眼认出"这是一个窗口"。 */
export const DOTS = '<span class="vk-dots"><i></i><i></i><i></i></span>';

/**
 * 全库唯一的窗壳。L3 只决定 head 和 inner。
 * 只有白纸一种材质，所以这里没有 surface。
 * @param {{chrome?: 'min'|'none'|'browser', head?: string, inner?: string, cls?: string, attrs?: string}} o
 */
export function win({ chrome = 'min', head = '', inner = '', cls = '', attrs = '' } = {}) {
  const klass = cls ? ` ${cls}` : '';
  // chrome="plain"：有标题栏，没有三点 —— 用来当「卡片」，而不是「窗口」。
  const dots = chrome === 'plain' ? '' : DOTS;
  const bar = chrome === 'none' ? '' : `<div class="vk-hd" data-vk-part="hd">${dots}${head}</div>`;
  return `<div class="vk-win${klass}" data-chrome="${esc(chrome)}"${attrs}>${bar}${inner}</div>`;
}

/** 文件名 + 可选行段 + 语言角标。tab 不再自带第二个"窗口点"。 */
export function fileHead(file, lang, range = '') {
  const rangeHtml = file && range && !file.includes(range) ? `<span class="vk-range" data-meta>${esc(range)}</span>` : '';
  return `${file ? `<span class="vk-file" data-meta>${esc(file)}</span>${rangeHtml}` : ''}${lang ? `<span class="vk-lang" data-meta>${esc(lang)}</span>` : ''}`;
}
