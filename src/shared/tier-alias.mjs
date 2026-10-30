/**
 * 13.0 的属性改名表，一份表三处用：
 *   · 运行期（runtime/base.mjs）：旧页连上 DOM 时折成新名；
 *   · 构建期（highlight.mjs）：旧名给迁移提示，不拦构建；
 *   · 组件（runtime/*.mjs）：读新名，旧名只在别名层出现。
 * 14.0 连同这张表一起删。
 */

/** 字号档位：旧名 → 七个语义名。只作用于文字类组件。 */
export const TIER_ALIAS = {
  'display-2xl': 'mega',
  'display-xl': 'hero',
  display: 'title',
  heading: 'subhead',
  meta: 'label',
};

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
  'vk-callout',
]);

/** 旧词：density 的三档并进 mass；loose 是「更松」，对应 hero。 */
export const DENSITY_ALIAS = { compact: 'compact', normal: 'normal', loose: 'hero' };
