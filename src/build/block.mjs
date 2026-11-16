/** 构建期：标题带、文字、目录树、公式。 */
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

/* ------------------------------------------------------------------ 文字 */
export function buildText(node, ctx) {
  const icon = attrOf(node, 'icon');
  if (!icon) return;
  const svg = ctx.icon(icon);
  if (!svg) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'ICON', message: `文字的行首图标 "${icon}" 找不到`, fix: '写 Lucide 的 kebab 名；用 vk icons <词> 搜' });
    return;
  }
  node.childNodes = [raw(svg), ...(node.childNodes || [])];
}

/* ------------------------------------------------------------------ 目录树 */
const ICON_KIND = (name, isDir) => {
  if (isDir) return 'dir';
  if (/\.(c|h|cc|cpp|js|mjs|ts|tsx|py|go|rs|java|sh)$/i.test(name)) return 'code';
  if (/\.(bin|exe|o|obj|dis|s|elf)$/i.test(name)) return 'binary';
  return 'file';
};

export function buildDir(node, ctx) {
  const depth = Number(attrOf(node, 'depth') || 3);
  let budget = Number(attrOf(node, 'limit') || 6);
  let skipped = 0;
  let truncated = false;
  const current = attrOf(node, 'current');
  let itemNo = 0;
  let currentHit = 0;
  let rootName = '';

  const iconFor = (name, isDir) => {
    const kind = ICON_KIND(name, isDir);
    return ctx.icon(isDir ? 'folder' : kind === 'code' ? 'file-code' : 'file-text') || '';
  };

  const nodeHtml = (name, isDir, p, level, children = '') => {
    const kind = ICON_KIND(name, isDir);
    const cur = current && p === current ? ' current' : '';
    if (cur) currentHit++;
    return (
      `<div class="vk-node" data-vk-item="${++itemNo}" data-depth="${level}" data-kind="${kind}"${cur} style="--vk-depth:${level}">` +
      `<span class="vk-nrow">${iconFor(name, isDir)}<span class="vk-tname">${esc(name)}${isDir ? '/' : ''}</span></span>` +
      (children ? `<div class="vk-kids">${children}</div>` : '') +
      `</div>`
    );
  };

  const walk = (items, level, base) => {
    if (level > depth) return '';
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (budget <= 0) {
        truncated = true;
        skipped += items.length - i;
        break;
      }
      budget--;
      const name = typeof it === 'string' ? it : it.name;
      if (!name) {
        ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'TREE_NODE', message: '目录节点缺 name', fix: '每个节点写成 "src" 或 {"name":"src","children":[]}' });
        continue;
      }
      const isDir = typeof it === 'string' ? false : !!(it.dir || it.children?.length);
      const p = base ? `${base}/${name}` : name;
      out.push(nodeHtml(name, isDir, p, level, it.children ? walk(it.children, level + 1, p) : ''));
    }
    return out.join('');
  };

  const src = attrOf(node, 'src');
  let list;
  if (src) {
    const abs = ctx.resolveAsset(src);
    if (!abs || !fs.statSync(abs).isDirectory()) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `目录树的 src="${src}" 找不到目录`, fix: '路径相对页面文件解析' });
      return `<div class="vk-missing">目录不存在：${esc(src)}</div>`;
    }
    rootName = path.basename(abs);
    const scan = (dir, level) => {
      if (level > depth) return [];
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
        .slice(0, 40)
        .map((e) => ({ name: e.name, dir: e.isDirectory(), children: e.isDirectory() ? scan(path.join(dir, e.name), level + 1) : undefined }));
    };
    list = scan(abs, 1);
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script');
    if (!s) return '<div class="vk-missing">目录树缺 src 或 data-vk-tree</div>';
    try {
      const data = JSON.parse((s.childNodes || []).map((c) => c.value || '').join(''));
      list = Array.isArray(data) ? data : data.children || [data];
    } catch (e) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'TREE_JSON', message: `目录树的内联 JSON 解析失败：${e.message}`, fix: '检查逗号与引号' });
      return `<div class="vk-missing">目录 JSON 解析失败</div>`;
    }
  }

  const more = truncated ? `<div class="vk-node is-more">还有 ${skipped} 项…</div>` : '';
  const body = rootName ? nodeHtml(rootName, true, rootName, 1, walk(list, 2, rootName)) + more : walk(list, 1, '') + more;
  if (current && !currentHit) {
    ctx.diag(node, { code: 'CURRENT_MISSING', message: `目录树的 current="${current}" 没有命中任何路径`, fix: '用根名开头的完整路径，如 src/main.c；先看目录树里真实的名字' });
  }
  return frame({ title: attrOf(node, 'title'), body: `<div class="vk-tree">${body}</div>`, dots: false, kind: 'dir' });
}

/* ------------------------------------------------------------------ 公式 */
export function buildMath(node, ctx) {
  const src = attrOf(node, 'src');
  let text = '';
  if (src) {
    const abs = ctx.resolveAsset(src);
    if (!abs) {
      ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: `公式的 src="${src}" 找不到文件`, fix: '路径相对页面文件解析' });
      return '<div class="vk-missing">公式文件不存在</div>';
    }
    text = fs.readFileSync(abs, 'utf8');
  } else {
    const s = (node.childNodes || []).find((c) => c.tagName === 'script' && hasAttr(c, 'data-vk-source'));
    text = s ? (s.childNodes || []).map((c) => c.value || '').join('') : textOf(node);
  }
  if (!text.trim()) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'SRC_MISSING', message: '公式没有内容', fix: 'src 指向 .tex，或把 TeX 直接写在标签里' });
    return '<div class="vk-missing">公式缺内容</div>';
  }
  try {
    return katex.renderToString(text.trim(), { displayMode: !hasAttr(node, 'inline'), throwOnError: true, strict: false, output: 'htmlAndMathml' });
  } catch (e) {
    ctx.diag(node, { file: ctx.label(ctx.file), line: 1, tag: node.tagName, code: 'MATH', message: `公式排版失败：${e.message}`, fix: '检查 TeX 括号是否配对' });
    return '<div class="vk-missing">公式排版失败</div>';
  }
}
