/**
 * 最小 CSS 解析器 —— 只做一件事：把样式表拆成规则，让删改可以按"选择器"进行。
 *
 * 为什么需要它：删组件时有四次事故是我按注释分段切 CSS，把邻居规则一起带走
 * （vk-text 的焦点色、vk-callout 的 wrap、窗头规则、bars 的 mass）。字符串切片
 * 不知道"规则"是什么，只能靠人眼看；这个解析器知道。
 *
 * 只支持 CSS 的子集，够库自己用：普通规则、@media/@supports（递归）、@keyframes（整块保留）。
 * 不支持 @layer/@import/@container 的嵌套语义——遇到就整块原样保留，不猜。
 */

/** 把样式表拆成 [{ type, selector, body, raw }]，@ 规则会带 children。 */
export function parse(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) {
      out.push({ type: 'raw', raw: css.slice(i) });
      break;
    }
    const headStart = i;
    let depth = 0;
    let close = open;
    for (; close < css.length; close++) {
      if (css[close] === '{') depth++;
      else if (css[close] === '}') {
        depth--;
        if (!depth) break;
      }
    }
    const head = css.slice(headStart, open);
    const body = css.slice(open + 1, close);
    const lead = head.slice(0, head.lastIndexOf('}') + 1);
    const selector = head.slice(head.lastIndexOf('}') + 1).trim();
    if (selector.startsWith('@')) {
      const nested = /^@(media|supports|layer|container)\b/.test(selector);
      out.push({
        type: 'at',
        selector,
        lead,
        body: nested ? undefined : body,
        children: nested ? parse(body) : undefined,
        raw: css.slice(headStart, close + 1),
      });
    } else if (!selector) {
      out.push({ type: 'raw', raw: css.slice(headStart, close + 1) });
    } else {
      out.push({ type: 'rule', selector, lead, body, raw: css.slice(headStart, close + 1) });
    }
    i = close + 1;
  }
  return out;
}

/** 一条规则的选择器列表（只切括号外的逗号——:where(a, b) 里的逗号不是分隔符）。 */
export function selectorList(selector) {
  const out = [];
  let depth = 0;
  let cur = '';
  let quote = null;
  for (const ch of selector) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/** 去掉注释：选择器里带注释会让一切匹配失效。 */
export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 选择器里引用的**标签**（vk-xxx）。
 * 注意不能误伤类名：.vk-ic / .vk-src 是类，不是标签。
 */
export const tagsIn = (selector) => [
  ...new Set(selector.match(/(?<![\w.#-])vk-[a-z][a-z0-9-]*/g) || []),
];

/** 选择器里引用的自定义类名（.vk-xxx / .r-xxx …）。 */
export const classesIn = (selector) => [...new Set(selector.match(/\.([a-zA-Z][\w-]*)/g) || [])];

/**
 * 按选择器删规则：命中 isDead 的选择器从列表里去掉；列表空了整条规则删掉。
 * 其它规则的字节保持原样（只在命中处重排选择器），不做全局格式化。
 */
export function dropSelectors(css, isDead) {
  const walk = (nodes) =>
    nodes
      .map((node) => {
        if (node.type !== 'rule' && node.type !== 'at') return node.raw ?? '';
        if (node.type === 'at' && node.children) {
          const inner = walk(node.children);
          return inner.trim() ? `${node.lead}${node.selector}{${inner}}` : '';
        }
        if (node.type === 'at') return node.raw;
        const parts = selectorList(node.selector);
        const keep = parts.filter((s) => !isDead(s));
        if (!keep.length) return '';
        if (keep.length === parts.length) return node.raw;
        return `${node.lead}${keep.join(', ')}{${node.body}}`;
      })
      .join('');
  return walk(parse(css));
}

/** 选中所有规则（展开 @media 内层），用于静态检查。 */
export function rules(css) {
  const out = [];
  const walk = (nodes) =>
    nodes.forEach((n) => {
      if (n.type === 'rule') out.push(n);
      else if (n.type === 'at' && n.children) walk(n.children);
    });
  walk(parse(css));
  return out;
}
