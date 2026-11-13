/**
 * v23 · 构建期入口
 * ----------------------------------------------------------------------------
 * 读作者页 → 校验 → 默认值 → 把「要算的东西」算好 → 输出一张自包含的页。
 *
 * 构建期不再抛异常：所有问题都进 diagnostics，页面照样产出。
 * 真正坏掉的位置画成 .vk-missing / 红框，AI 看得到。
 */
import path from 'node:path';
import { parse, parseFragment } from 'parse5';
import { validate } from '../contract.mjs';
import { normalizeTree } from '../normalize.mjs';
import { flatten, lineOf, raw, serialize } from '../shared/dom.mjs';
import { buildSource } from './source.mjs';
import { buildTable, buildList, buildDir, buildMath, buildBytes, buildBits, buildCells, buildHead, buildText } from './content.mjs';
import { buildSteps, buildBars, buildTimeline, buildGraph, buildSeq } from './diagram.mjs';
import { buildFlow, buildCard, buildPage, buildImg, wrapFragment, rewriteLinks, ROOT } from './layout.mjs';

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

/* ------------------------------------------------------------------ 主流程 */
export async function transformHtml(rawHtml, { file }) {
  const isFull = /<html[\s>]/i.test(rawHtml);
  const doc = isFull ? parse(rawHtml, { sourceCodeLocationInfo: true }) : parseFragment(rawHtml, { sourceCodeLocationInfo: true });
  if (isFull) rewriteLinks(doc, file);

  const diagnostics = validate(doc, label(file));

  /* 把有问题的组件标成红框：不是门禁，是让 AI 在图里看见。 */
  const issueLines = new Set(diagnostics.map((d) => d.line));
  for (const node of flatten(doc)) {
    if (node.tagName?.startsWith('vk-') && issueLines.has(lineOf(node))) node.attrs = [...(node.attrs || []), { name: 'data-vk-issue', value: '1' }];
  }

  normalizeTree(doc);

  const assets = new Set();
  const ctx = {
    file,
    label,
    diag: diagnostics,
    assets,
    icon: (name) => ctx.icons.get(slug(name)) || '',
    icons: new Map(),
  };

  /* 先把所有用到的图标一次性解析好（await 不能出现在同步 builder 里）。 */
  const iconNames = new Set(['folder', 'file-code', 'file-text']);
  for (const node of flatten(doc)) {
    const n = (node.attrs || []).find((a) => a.name === 'icon')?.value;
    if (n) iconNames.add(n);
  }
  for (const name of iconNames) {
    const svg = await iconSvg(name);
    if (svg) ctx.icons.set(slug(name), svg);
  }

  const BUILDERS = {
    'vk-code': async (n) => {
      n.childNodes = [raw(await buildSource(n, ctx))];
    },
    'vk-table': (n) => buildTable(n),
    'vk-list': (n) => buildList(n),
    'vk-dir': (n) => {
      n.childNodes = [raw(buildDir(n, ctx))];
    },
    'vk-math': (n) => {
      n.childNodes = [raw(buildMath(n, ctx))];
    },
    'vk-bytes': (n) => {
      n.childNodes = [raw(buildBytes(n, ctx))];
    },
    'vk-bits': (n) => {
      n.childNodes = [raw(buildBits(n, ctx))];
    },
    'vk-cells': (n) => {
      n.childNodes = [raw(buildCells(n))];
    },
    'vk-head': (n) => buildHead(n),
    'vk-text': (n) => buildText(n, ctx),
    'vk-steps': (n) => {
      n.childNodes = [raw(buildSteps(n, ctx))];
    },
    'vk-bars': (n) => {
      n.childNodes = [raw(buildBars(n))];
    },
    'vk-timeline': (n) => {
      n.childNodes = [raw(buildTimeline(n, ctx))];
    },
    'vk-graph': (n) => {
      n.childNodes = [raw(buildGraph(n))];
    },
    'vk-seq': (n) => {
      n.childNodes = [raw(buildSeq(n, ctx))];
    },
    'vk-card': (n) => buildCard(n),
    'vk-flow': (n) => buildFlow(n),
    'vk-img': (n) => buildImg(n, file),
    'vk-page': (n) => buildPage(n),
  };

  /* 逆序：先叶子后父级，父级拿到的子节点已经是排好的 HTML。 */
  const nodes = flatten(doc).reverse();
  for (const node of nodes) {
    const tag = node.tagName;
    const build = tag && BUILDERS[tag];
    if (!build) continue;
    try {
      await build(node);
    } catch (e) {
      diagnostics.push({ file: label(file), line: lineOf(node), tag, code: 'BUILD', message: `<${tag}> 构建失败：${e.message}`, fix: '看这一条的上下文；通常是 src 路径或行段写错' });
      node.childNodes = [raw(`<div class="vk-missing">${tag} 构建失败：${String(e.message).replace(/[<>&]/g, '')}</div>`)];
    }
  }

  const body = serialize(doc);
  return {
    html: isFull ? body : wrapFragment(body),
    diagnostics,
    assets: [...assets],
    count: nodes.filter((n) => n.tagName === 'vk-page').length,
    warnings: [],
  };
}
