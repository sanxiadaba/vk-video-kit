/**
 * 13.0 的属性改名表 —— 15.0 起真源移到 src/shared/vocab.mjs。
 *
 * 这个文件只剩两个用途：
 *   · 旧 import 不破（TIER_ALIAS / DENSITY_ALIAS 是 vocab 里那张表的别名）；
 *   · MASS_TAGS：哪些标签有「体量」这根轴（运行期用它把 size 上的体量词认出来，只提示不改写）。
 */
export { SIZE_ALIAS as TIER_ALIAS, MASS_ALIAS as DENSITY_ALIAS } from './vocab.mjs';

/**
 * 内在体量（一个块有多大）：compact / normal / hero。
 * 「字号档」与「体量档」是两根轴——同一段代码可以是脚注也可以是整页主角，
 * 那是体量，不是字号。所以体量单独一个属性名 mass，不再和 size 抢名字。
 */
export const MASS_TAGS = new Set([
  'vk-code',
  'vk-term',
  'vk-table',
  'vk-cells',
  'vk-bars',
  'vk-asm',
  'vk-bytes',
  'vk-steps',
  'vk-timeline',
  'vk-diff',
  'vk-tree',
  'vk-bits',
  'vk-window',
  'vk-list',
]);
