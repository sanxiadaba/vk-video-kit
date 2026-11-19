/** 构建期：标题带、目录树、公式。 */
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { attrOf, hasAttr, serialize, textOf, raw, esc } from '../shared/dom.mjs';
import { frame } from './frame.mjs';

/* ------------------------------------------------------------------ 标题带 */
export function buildHead(node) {
  const kicker = attrOf(node, 'kicker') || '';
  const counter = attrOf(node, 'counter') || '';
  const lede = attrOf(node, 'lede') || '';
  const title = (node.childNodes || []).map(serialize).join('');
  const kick = kicker || counter ? `<div class="vk-kick">${kicker ? `<span class="vk-kicker">${esc(kicker)}</span>` : ''}${counter ? `<span class="vk-counter">${esc(counter)}</span>` : ''}</div>` : '';
  const ledeHtml = lede ? `<div class="vk-lede">${esc(lede)}</div>` : '';
  node.childNodes = [raw(`${kick}<div class="vk-title">${title}</div>${ledeHtml}`)];
}

/* ------------------------------------------------------------------ 目录树
   没有图标：层级由缩进、目录名后的 /、语义色承担。 */
const kindOf = (name, isDir) => {
  if (isDir) return 'dir';
  if (/\.(c|h|cc|cpp|js|mjs|ts|tsx|py|go|rs|java|sh)$/i.test(name)) return 'code';
  if (/\.(bin|exe|o|obj|dis|s|elf)$/i.test(name)) return 'binary';
  return 'file';
};

export function buildDir(node, ctx) {
  let budget = Number(attrOf(node, 'limit') ?? 8);
  if (!Number.isFinite(budget) || budget < 1) budget = 8;
  const maxScan = budget; /* 显示不了那么深的层，扫描也不必下去 */
  let skipped = 0;
  const current = attrOf(node, 'current');
  let itemNo = 0;
  let currentHit = 0;
  let rootName = '';

  const nodeHtml = (name, isDir, p, level, children = '', item = ++itemNo) => {
    const kind = kindOf(name, isDir);
    const cur = current && p === current ? ' current' : '';
    if (cur) currentHit++;
    return (
      `<div class="vk-node" data-vk-item="${item}" data-depth="${level}" data-kind="${kind}"${cur} style="--vk-depth:${level}">` +
      `<span class="vk-nrow"><span class="vk-tname">${esc(name)}${isDir ? '/' : ''}</span></span>` +
      (children ? `<div class="vk-kids">${children}</div>` : '') +
      `</div>`
    );
  };

  const walk = (items, level, base) => {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (budget <= 0) {
        skipped += items.length - i;
        break;
      }
      budget--;
      const name = typeof it === 'string' ? it : it.name;
      if (!name) {
        ctx.diag(node, { code: 'TREE_NODE', message: '目录节点缺 name', fix: '每个节点写成 "src" 或 {"name":"src","children":[]}' });
        continue;
      }
      const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
      const p = base ? `${base}/${name}` : name;
      const item = ++itemNo; /* 父行先占号，子行再排：@item 锚点按视觉顺序 */
      const childHtml = it.children ? walk(it.children, level + 1, p) : '';
      out.push(nodeHtml(name, isDir, p, level, childHtml, item));
    }
    return out.join('');
  };

  const src = attrOf(node, 'src');
  let list;
  if (src) {
    const abs = ctx.resolveAsset(src);
    if (!abs || !fs.statSync(abs).isDirectory()) {
      ctx.diag(node, { code: 'SRC_MISSING', message: `目录树的 src="${src}" 找不到目录`, fix: '路径相对页面文件解析' });
      return `<div class="vk-missing">目录不存在：${esc(src)}</div>`;
    }
    rootName = path.basename(abs);
    const scan = (dir, level) => {
      if (level > maxScan) return [];
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
        .slice(0, 40)
        .map((e) => ({ name: e.name, dir: e.isDirectory(), children: e.isDirectory() ? scan(path.join(dir, e.name), level + 1) : undefined }));
    };
    list = scan(abs, 1);
    budget--; /* 根目录自己占一行 */
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script');
    if (!s) return '<div class="vk-missing">目录树缺 src 或 data-vk-tree</div>';
    try {
      const data = JSON.parse((s.childNodes || []).map((c) => c.value || '').join(''));
      list = Array.isArray(data) ? data : data.children || [data];
    } catch (e) {
      ctx.diag(node, { code: 'TREE_JSON', message: `目录树的内联 JSON 解析失败：${e.message}`, fix: '检查逗号与引号' });
      return `<div class="vk-missing">目录 JSON 解析失败</div>`;
    }
  }

  /* 根目录先占 1 号行：编号按视觉顺序，锚点 @item 才对得上。 */
  let body;
  if (rootName) {
    const rootItem = ++itemNo;
    const childHtml = walk(list, 2, rootName);
    body = nodeHtml(rootName, true, rootName, 1, childHtml, rootItem);
  } else body = walk(list, 1, '');
  const more = skipped > 0 ? `<div class="vk-dir-more">还有 ${skipped} 项</div>` : '';
  body += more;
  if (current && !currentHit) {
    ctx.diag(node, { code: 'CURRENT_MISSING', message: `目录树的 current="${current}" 没有命中任何路径`, fix: '用根名开头的完整路径，如 src/main.c；先看目录树里真实的名字' });
  }
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-tree">${body}</div>`, dots: false, kind: 'dir' });
}

/* ------------------------------------------------------------------ 公式
   行内由父级决定：文字/标题/条目/标注里自动行内，其余是块公式。 */
const INLINE_HOSTS = new Set(['vk-text', 'vk-head', 'li', 'vk-callout']);

export function buildMath(node, ctx) {
  const src = attrOf(node, 'src');
  let text = '';
  if (src) {
    const abs = ctx.resolveAsset(src);
    if (!abs) {
      ctx.diag(node, { code: 'SRC_MISSING', message: `公式的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">公式文件不存在</div>';
    }
    text = fs.readFileSync(abs, 'utf8');
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
    text = s ? (s.childNodes || []).map((c) => c.value || '').join('') : textOf(node);
  }
  if (!text.trim()) {
    ctx.diag(node, { code: 'SRC_MISSING', message: '公式没有内容', fix: 'src 指向 .tex，或把 TeX 直接写在标签里' });
    return '<div class="vk-missing">公式缺内容</div>';
  }
  const inline = INLINE_HOSTS.has(node.parentNode?.tagName);
  if (inline) node.attrs.push({ name: 'data-inline', value: '1' });
  try {
    return katex.renderToString(text.trim(), { displayMode: !inline, throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    ctx.diag(node, { code: 'MATH', message: `公式排版失败：${e.message}`, fix: '检查 TeX 括号是否配对' });
    return '<div class="vk-missing">公式排版失败</div>';
  }
}
