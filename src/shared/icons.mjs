/**
 * 语义图标白名单 —— vk-icon 只能表达这四类意思。
 *
 * 为什么要有白名单：图标一旦可以随便挑，它就从「语义符号」退化成「装饰」，
 * 一页里就会冒出火箭、灯泡、齿轮，观众读到的是"PPT 素材"，不是信息。
 * 白名单把 vk-icon 锁在四类判断上：
 *
 *   ✓ 成立      check / circle-check
 *   ! 注意      triangle-alert / info
 *   ✗ 不成立    x / circle-x
 *   → 方向      arrow-up / arrow-down / arrow-right
 *
 * 名字就是 Lucide 的名字（构建期内联同一份 icons.generated.mjs）。
 * 运行期的 audit 与构建期的 src/highlight.mjs 读的是这一张表：
 * "什么算合法图标"只有一个定义。
 */

export const ICON_SEMANTIC = {
  check: '✓',
  'circle-check': '✓',
  'triangle-alert': '!',
  info: '!',
  x: '✗',
  'circle-x': '✗',
  'arrow-up': '→',
  'arrow-down': '→',
  'arrow-right': '→',
};

export const ICON_SEMANTIC_NAMES = Object.keys(ICON_SEMANTIC);

/** 白名单文案：构建期与运行期的报错都只抄这一份。 */
export const ICON_WHITELIST_HINT = ICON_SEMANTIC_NAMES.join(' / ');

export const isSemanticIcon = (name) => Object.prototype.hasOwnProperty.call(ICON_SEMANTIC, String(name || '').trim());
