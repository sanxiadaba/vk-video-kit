/**
 * 13.0 改过的字号档位名，一份表两处用：
 *   · 运行期（runtime/base.mjs）：旧页连上 DOM 时折成新名；
 *   · 构建期（highlight.mjs）：旧名字给迁移提示，不拦构建。
 * 14.0 连同这张表一起删。
 */
export const TIER_ALIAS = {
  'display-2xl': 'mega',
  'display-xl': 'hero',
  display: 'title',
  heading: 'subhead',
  meta: 'label',
};
