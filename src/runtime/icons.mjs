/**
 * 图标查表。
 *
 * 全量 Lucide 有 2169 个名字、400KB+；作者页面通常只用 1–5 个。
 * 所以运行时只带组件内部用的 11 个（CORE_ICONS），作者写的 <vk-icon> 由
 * `vk build` 按页注入到 <script data-vk-icons>。
 */
import { CORE_ICONS } from '../icons.core.generated.mjs';

let cache = null;

function read() {
  const out = {};
  if (typeof document !== 'undefined') {
    const el = document.querySelector('script[data-vk-icons]');
    if (el) {
      try {
        Object.assign(out, JSON.parse(el.textContent));
      } catch {
        /* 损坏的注入按缺失处理 */
      }
    }
  }
  if (typeof window !== 'undefined' && window.__VK_ICONS) Object.assign(out, window.__VK_ICONS);
  return out;
}

function map() {
  if (!cache) cache = read();
  return cache;
}

export function hasIcon(name) {
  if (Object.hasOwn(CORE_ICONS, name)) return true;
  if (Object.hasOwn(map(), name)) return true;
  // 运行时可能在注入脚本之前就先渲染了一次：miss 时再读一遍。
  cache = read();
  return Object.hasOwn(cache, name);
}

export function iconOf(name) {
  return map()[name] || CORE_ICONS[name] || CORE_ICONS['circle-help'] || '';
}
