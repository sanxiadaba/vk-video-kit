/**
 * v27 · 构建期入口
 * ----------------------------------------------------------------------------
 * 读作者页 → 校验 → 落地默认值 → 把「要算的东西」算好 → 输出一张自包含的页。
 *
 * 只解析一次、只遍历一次：后面所有步骤共用 nodes 这张表。
 * 构建期不再抛异常：所有问题都进 diagnostics，页面照样产出，坏掉的位置画成 .vk-missing。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse, parseFragment } from 'parse5';
import { validate, isHint, severityOf } from '../contract.mjs';
import { asOf } from '../contract.mjs';
import { dedupe } from '../contract/validate.mjs';
import { normalizeTree } from '../normalize.mjs';
import { flatten, lineOf, raw, serialize } from '../shared/dom.mjs';
import { buildSource } from './source.mjs';
import { buildBoard, buildBand, buildFrames } from './board.mjs';
import { buildBytes, buildBits } from './grid.mjs';
import { buildGraph, buildSeq } from './graph.mjs';
import { buildHead, buildDir, buildMath } from './block.mjs';
import { buildFlow, buildCard, buildPage, buildImg, buildCallout, wrapFragment, rewriteLinks, ensureLibs, ROOT } from './frame.mjs';

const label = (f) => path.relative(ROOT, path.resolve(f)).split(path.sep).join('/') || String(f);

/* ------------------------------------------------------------------ 分派
   返回字符串 = 整块 HTML（替换子节点）；返回 undefined = 构建器自己改好了。 */
const BUILDERS = {
  'vk-code': (n, ctx) => {
    const as = asOf(n);
    if (as === 'bytes') return buildBytes(n, ctx);
    if (as === 'bits') return buildBits(n, ctx);
    /* asm / term / diff / code 都由 buildSource 按 lang 自己判断。 */
    return buildSource(n, ctx);
  },
  'vk-board': (n, ctx) => {
    const as = asOf(n);
    if (as === 'band') return buildBand(n, ctx);
    if (as === 'frames') return buildFrames(n, ctx);
    return buildBoard(n, as, ctx);
  },
  'vk-graph': (n, ctx) => buildGraph(n, ctx),
  'vk-seq': (n, ctx) => buildSeq(n, ctx),
  'vk-dir': (n, ctx) => buildDir(n, ctx),
  'vk-math': (n, ctx) => buildMath(n, ctx),
  'vk-callout': (n) => buildCallout(n),
  'vk-head': (n) => buildHead(n),
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

  /* 把有问题的位置标出来：不是门禁，是让 AI/人一眼看到是哪一块。
     hint 不画红框——只能说明「这样做可能不是本意」，画面本身是对。 */
  const issueLines = new Set(diagnostics.filter((d) => !isHint(d.code)).map((d) => d.line));
  for (const node of nodes) {
    if (node.tagName?.startsWith('vk-') && issueLines.has(lineOf(node))) node.attrs = [...(node.attrs || []), { name: 'data-vk-issue', value: '1' }];
  }

  normalizeTree(doc);

  const ctx = {
    file,
    label,
    diag(node, d) {
      const line = lineOf(node);
      diagnostics.push({ ...d, severity: d.severity ?? severityOf(d.code), file: label(file), line, tag: node.tagName, frame: frameOf(node) });
    },
    resolveAsset(src) {
      const abs = path.resolve(path.dirname(path.resolve(file)), src);
      return fs.existsSync(abs) ? abs : null;
    },
    read: (abs) => fs.readFileSync(abs),
  };
  ctx.diag.has = (node, code) => diagnostics.some((d) => d.code === code && d.line === lineOf(node) && d.frame === frameOf(node));

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
    /* 校验与构建会在同一行补同一条事实（SRC_CONFLICT / SRC_MISSING…），收尾去重。 */
    diagnostics: dedupe(diagnostics),
  };
}
