#!/usr/bin/env node
/**
 * 生成配方页 —— 每个"被删掉的组合标签"一页 A/B 对照。
 *
 * 左边是配方（一行 class），右边是同一个东西用原语硬写。
 * 两栏必须长得一样；`vk check` 会对每一页跑字号、对比度、安全区、空帧、孤行。
 *
 * 为什么要生成而不是手写：配方会长（新增一条就要加一页 A/B），
 * 手写必然有一页忘了同步，然后配方册开始说谎。
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'docs/recipes';

const PAGES = [
  {
    file: 'stat.html',
    title: '指标',
    was: 'vk-stat',
    note: '标签在上、数值居中、单位跟随。14.0 里它是一行 class；数值写法是 vk-text 的 format。',
    a: `<div class="r-stat r-stat--subhead r-stat--focus">
          <span class="r-stat-label" data-meta>预处理之后</span>
          <span class="r-stat-line"><span class="r-stat-value">52,980</span><span class="r-stat-unit">字节</span></span>
        </div>`,
    b: `<vk-stack gap="2xs">
          <vk-text size="label" ink="muted" data-meta>预处理之后</vk-text>
          <vk-stack direction="row" gap="sm" align="baseline">
            <vk-text size="subhead" weight="bold" format="thousands">52980</vk-text>
            <vk-text size="label" ink="muted" data-meta>字节</vk-text>
          </vk-stack>
        </vk-stack>`,
  },
  {
    file: 'title.html',
    title: '标题三件套',
    was: 'vk-title',
    note: '眉题 + 主标题 + 副题。三件都是文字，区别只在字号与颜色。',
    a: `<div class="r-title">
          <p class="r-eyebrow">第 5 站</p>
          <p class="r-title-main">一个字节，一个字符</p>
          <p class="r-title-sub">字符串在内存里就是一段连续的字节，末尾补 00。</p>
        </div>`,
    b: `<vk-stack gap="2xs">
          <vk-text size="label" mono ink="muted" data-meta>第 5 站</vk-text>
          <vk-text size="title" weight="bold" wrap="balance">一个字节，一个字符</vk-text>
          <vk-text size="body" ink="secondary" class="r-ab-text">字符串在内存里就是一段连续的字节，末尾补 00。</vk-text>
        </vk-stack>`,
  },
  {
    file: 'quote.html',
    title: '引文',
    was: 'vk-quote',
    note: '一条竖线 + 一句别人的话 + 出处。竖线是 CSS，字号是字阶。',
    a: `<div class="r-quote">
          <p class="r-quote-text">quirky, flawed, and an enormous success.</p>
          <span class="r-quote-cite" data-meta>Dennis Ritchie</span>
        </div>`,
    b: `<vk-stack gap="2xs" class="r-rule-left">
          <vk-text size="subhead" class="r-ab-text">quirky, flawed, and an enormous success.</vk-text>
          <vk-text size="label" ink="muted" data-meta>Dennis Ritchie</vk-text>
        </vk-stack>`,
  },
  {
    file: 'figure.html',
    title: '图与行内小件',
    was: 'vk-figure / vk-tag / vk-mark',
    note: '图 + 一句说明就是 figure 的全部；胶囊和荧光笔本来就是主题色，不值得占标签。',
    a: `<vk-stack gap="2xs">
          <figure class="r-figure r-ab-fig">
            <span class="r-figure-img"><vk-img src="../../assets/sample-grid.svg" ratio="720 / 280" fit="cover" radius="none" border="none"></vk-img></span>
            <span class="r-figure-cap" data-meta>图 + 一句说明</span>
          </figure>
          <p class="r-body"><span class="r-tag">胶囊</span> 与 <span class="r-mark">荧光笔</span> 都是行内小件。</p>
        </vk-stack>`,
    b: `<vk-stack gap="2xs">
          <div class="r-ab-fig"><vk-img src="../../assets/sample-grid.svg" ratio="720 / 280" fit="cover" radius="none" border="none"></vk-img></div>
          <vk-text size="label" ink="muted" data-meta>图 + 一句说明</vk-text>
          <p class="r-body">胶囊与荧光笔在这里没有等价写法——它们本来就是 CSS。</p>
        </vk-stack>`,
  },
];

const shell = (title, body) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920">
<title>vk · 配方 ${title}</title>
<link rel="stylesheet" href="../../vk/fonts.css">
<link rel="stylesheet" href="../../vk/vk.css">
<link rel="stylesheet" href="recipes.css">
</head>
<body class="r-doc">
<vk-page align="top">
  <vk-stack gap="2xs">
${body}
  </vk-stack>
</vk-page>
<script src="../../dist/vk.js"></script>
</body>
</html>
`;

const ab = (p) => `    <div class="r-title r-title--body">
      <p class="r-eyebrow" data-meta>原 ${p.was}</p>
      <h2 class="r-title-main">${p.title}</h2>
    </div>
    <p class="r-slab" data-meta>${p.note}</p>
    <vk-rule variant="strong"></vk-rule>

    <div class="r-ab">
      <vk-stack gap="2xs">
        <p class="r-slab" data-meta>配方</p>
        ${p.a}
      </vk-stack>
      <vk-stack gap="2xs">
        <p class="r-slab" data-meta>原语手写</p>
        ${p.b}
      </vk-stack>
    </div>`;

const index = `    <div class="r-title r-title--subhead">
      <p class="r-eyebrow">配方册</p>
      <h2 class="r-title-main">一个东西，一种写法</h2>
    </div>
    <vk-rule variant="strong"></vk-rule>
    <vk-stack gap="sm">
${PAGES.map(
  (p) => `      <vk-stack direction="row" gap="sm" align="baseline">
        <vk-text size="body">${p.title}</vk-text>
        <vk-text size="label" ink="muted" data-meta>原 ${p.was} → ${p.file}</vk-text>
      </vk-stack>`
).join('\n')}
    </vk-stack>`;

fs.mkdirSync(OUT, { recursive: true });
for (const p of PAGES) fs.writeFileSync(path.join(OUT, p.file), shell(p.title, ab(p)));
fs.writeFileSync(path.join(OUT, 'index.html'), shell('目录', index));
console.log(`recipes: ${PAGES.length + 1} 页`);
