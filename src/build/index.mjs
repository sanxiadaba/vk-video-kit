/**
 * v26 · 构建期入口
 * ----------------------------------------------------------------------------
 * 读作者页 → 校验 → 落地默认值 → 把「要算的东西」算好 → 输出一张自包含的页。
 *
 * 只解析一次、只遍历一次：后面所有步骤共用 nodes 这张表。
 * 构建期不再抛异常：所有问题都进 diagnostics，页面照样产出，坏掉的位置画成 .vk-missing。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse, parseFragment } from 'parse5';
import { validate } from '../contract.mjs';
import { asOf } from '../contract.mjs';
import { normalizeTree } from '../normalize.mjs';
import { flatten, lineOf, raw, serialize } from '../shared/dom.mjs';
import { buildSource } from './source.mjs';
import { buildBoard } from './board.mjs';
import { buildBytes, buildBits } from './grid.mjs';
import { buildGraph, buildSeq } from './graph.mjs';
import { buildHead, buildText, buildDir, buildMath } from './block.mjs';
import { buildFlow, buildCard, buildPage, buildImg, wrapFragment, rewriteLinks, ensureLibs, ROOT } from './frame.mjs';

const label = (f) => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/') || String(f);

/* ------------------------------------------------------------------ 图标 */
let ICON_MAP = null;
const slug = (name) => String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');
const loadIcons = async () => {
  if (ICON_MAP) return ICON_MAP;
  const lucide = await import('lucide');
  ICON_MAP = new Map();
  for (const [name, nodes] of Object.entries(lucide.icons || {})) {
    ICON_MAP.set(name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase(), nodes);
  }
  return ICON_MAP;
};

const iconInner = (nodes) =>
  (nodes || []).map(([tag, attrs]) => `<${tag}${Object.entries(attrs || {}).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('')}/>`).join('');

const iconSvg = async (name) => {
  const map = await loadIcons();
  const nodes = map.get(slug(name));
  if (!nodes) return null;
  return `<span class="vk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInner(nodes)}</svg></span>`;
};

/* ------------------------------------------------------------------ 分派
   返回字符串 = 整块 HTML（替换子节点）；返回 undefined = 构建器自己改好了。 */
const BUILDERS = {
  'vk-code': (n, ctx) => {
    const as = asOf(n);
    if (as === 'bytes') return buildBytes(n, ctx);
    if (as === 'bits') return buildBits(n, ctx);
    return buildSource(n, ctx);
  },
  'vk-board': (n, ctx) => buildBoard(n, asOf(n), ctx),
  'vk-graph': (n) => buildGraph(n),
  'vk-seq': (n, ctx) => buildSeq(n, ctx),
  'vk-dir': (n, ctx) => buildDir(n, ctx),
  'vk-math': (n, ctx) => buildMath(n, ctx),
  'vk-head': (n) => buildHead(n),
  'vk-text': (n, ctx) => buildText(n, ctx),
  'vk-card': (n) => buildCard(n),
  'vk-flow': (n) => buildFlow(n),
  'vk-img': (n, ctx) => buildImg(n, ctx),
  'vk-page': (n) => buildPage(n),
};

/* ------------------------------------------------------------------ 主流程 */
export async function transformHtml(rawHtml, { file }) {
  const isFull = /<html[\s>]/i.test(rawHtml);
  const doc = isFull ? parse(rawHtml, { sourceCodeLocationInfo: true }) : parseFragment(rawHtml, { sourceCodeLocationInfo: true });
  if (isFull) {
    rewriteLinks(doc, file);
    ensureLibs(doc);
  }

  const nodes = flatten(doc);
  const pages = nodes.filter((n) => n.tagName === 'vk-page');
  const pageIndex = new Map(pages.map((p, i) => [p, i]));
  const frameOf = (node) => {
    for (let n = node; n; n = n.parentNode) if (pageIndex.has(n)) return pageIndex.get(n);
    return null;
  };
  const diagnostics = validate(doc, label(file));

  /* 把有问题的位置标出来：不是门禁，是让 AI/人一眼看到是哪一块。 */
  const issueLines = new Set(diagnostics.map((d) => d.line));
  for (const node of nodes) {
    if (node.tagName?.startsWith('vk-') && issueLines.has(lineOf(node))) node.attrs = [...(node.attrs || []), { name: 'data-vk-issue', value: '1' }];
  }

  normalizeTree(doc);

  const ctx = {
    file,
    label,
    diag(node, d) {
      const line = lineOf(node);
      diagnostics.push({ ...d, file: label(file), line, tag: node.tagName, frame: frameOf(node) });
    },
    resolveAsset(src) {
      const abs = path.resolve(path.dirname(path.resolve(file)), src);
      return fs.existsSync(abs) ? abs : null;
    },
    read: (abs) => fs.readFileSync(abs),
    icon: (name) => ctx.icons.get(slug(name)) || '',
    icons: new Map(),
  };
  ctx.diag.has = (node, code) => diagnostics.some((d) => d.code === code && d.line === lineOf(node) && d.frame === frameOf(node));

  /* 图标按实际出现的名字惰性解析；目录树另有三个内建名。 */
  const iconNames = new Set();
  for (const node of nodes) {
    const n = (node.attrs || []).find((a) => a.name === 'icon')?.value;
    if (n) iconNames.add(n);
    if (node.tagName === 'vk-dir') ['folder', 'file-code', 'file-text'].forEach((x) => iconNames.add(x));
  }
  for (const name of iconNames) {
    const svg = await iconSvg(name);
    if (svg) ctx.icons.set(slug(name), svg);
  }

  /* 逆序：先叶子后父级，父级拿到的子节点已经是排好的 HTML。 */
  for (const node of [...nodes].reverse()) {
    const build = node.tagName && BUILDERS[node.tagName];
    if (!build) continue;
    try {
      const html = await build(node, ctx);
      if (typeof html === 'string') node.childNodes = [raw(html)];
    } catch (e) {
      ctx.diag(node, { code: 'BUILD', message: `<${node.tagName}> 构建失败：${e.message}`, fix: '看这一条的上下文；通常是 src 路径或行段写错' });
      node.childNodes = [raw(`<div class="vk-missing">${node.tagName} 构建失败：${String(e.message).replace(/[<>&]/g, '')}</div>`)];
    }
  }

  const body = serialize(doc);
  return {
    html: isFull ? body : wrapFragment(body),
    diagnostics,
  };
}
