/**
 * 首页 / 示例 / 搜索索引。
 *
 *   node tools/site.mjs
 *   node tools/site.mjs --check
 *
 * 只读 frames/ 与 shots/；产物写根目录 index.html、examples.html、search-index.js。
 * 组件页与文档页分别由 tools/components.mjs、tools/docs.mjs 生成。
 */
import fs from 'node:fs';
import { TAGS, LAYERS } from '../src/registry.mjs';
import { writeIfChanged, checkMode } from './lib/io.mjs';
import { sitePath } from './lib/paths.mjs';
import { shell, esc, json } from './lib/site-ui.mjs';

const check = checkMode();

const FRAMES = [
  {
    no: '01',
    file: 'frame-0.html',
    topic: '数组 · 越界',
    title: '数组不是指针，越界才是问题。',
    note: '标题 + 代码窗 + 账本 + 连线。先把“越界”摆在屏幕上。',
    tags: ['vk-title', 'vk-code', 'vk-table', 'vk-edge'],
  },
  {
    no: '02',
    file: 'frame-1.html',
    topic: '终端 · 路由',
    title: '先跑起来，再看它返回什么。',
    note: '终端记录真实输出，旁边只留一条结论。',
    tags: ['vk-title', 'vk-term', 'vk-callout'],
  },
  {
    no: '03',
    file: 'frame-2.html',
    topic: '对比 · 边界',
    title: '改一行，差在哪要看得见。',
    note: 'diff 看变化，表格把“改前 / 改后”压成一行。',
    tags: ['vk-title', 'vk-diff', 'vk-table'],
  },
  {
    no: '04',
    file: 'frame-3.html',
    topic: '浏览器 · 图窗',
    title: '页面是一份字符串，图也一样。',
    note: '浏览器窗与图窗并排，说明输出和素材都只是内容。',
    tags: ['vk-title', 'vk-browser', 'vk-figure'],
  },
  {
    no: '05',
    file: 'frame-4.html',
    topic: '坐标系 · 连线',
    title: '两个名字，指向同一块内存。',
    note: 'canvas 明确摆放，edge 只表达一条关系。',
    tags: ['vk-title', 'vk-canvas', 'vk-box', 'vk-edge'],
  },
  {
    no: '06',
    file: 'frame-5.html',
    topic: '步骤 · 清单',
    title: '先按顺序走，再记住边界。',
    note: '步骤给顺序，列表给并列项；两种结构不混用。',
    tags: ['vk-title', 'vk-steps', 'vk-list'],
  },
  {
    no: '07',
    file: 'frame-6.html',
    topic: '文件树 · 代码',
    title: '先找到文件，再看那一行。',
    note: '文件树给路径，代码窗只截取需要的那四行。',
    tags: ['vk-title', 'vk-tree', 'vk-code'],
  },
  {
    no: '08',
    file: 'frame-7.html',
    topic: '内存格 · 批注',
    title: '一格一格看，越界就在下一格。',
    note: '内存格给地址，批注贴在代码行右侧。',
    tags: ['vk-title', 'vk-cells', 'vk-annotate', 'vk-code', 'vk-note'],
  },
];

const clean = (html) =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function frameRecipe(frame) {
  const html = fs.readFileSync(sitePath(`frames/${frame.file}`), 'utf8');
  const match = html.match(/<vk-page[\s\S]*?<\/vk-page>/);
  if (!match) throw new Error(`frames/${frame.file} 缺少 vk-page`);
  return `<!-- Frame ${frame.no} · ${frame.topic} · frames/${frame.file} -->\n${clean(match[0])}`;
}

const frameOf = (no) => FRAMES.find((f) => f.no === no);

const layerLabel = (id) => (LAYERS.find((l) => l.id === id) || { label: id }).label;

const installSnippet = `# 尚未发布到 npm；先按本地包安装
npm i /path/to/vk-video-kit

<link rel="stylesheet" href="node_modules/vk-video-kit/vk/fonts.css">
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/vk.css">
<script src="node_modules/vk-video-kit/dist/vk.js"></script>`;

/* ------------------------------------------------------------------ 首页 */

const heroFrame = frameOf('01');

const homeBody = `<main id="main">
  <section class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow">vk · 视频组件库</p>
      <h1>把网页写成<span class="accent">一帧</span>，再原样录屏。</h1>
      <p class="lead">29 个元件 + 1 个页面。真实文件、固定安全区、<br>可组合的 8 帧；分则独立，合则成帧。</p>
      <div class="hero-actions">
        <a class="btn primary" href="components/index.html">浏览 30 个标签</a>
        <a class="btn" href="examples.html">看 8 帧</a>
      </div>
    </div>
    <figure class="hero-frame">
      <a class="stage" href="frames/${heroFrame.file}" target="_blank" rel="noopener">
        <img src="shots/frame-0.png" alt="Frame 01：数组不是指针，越界才是问题。">
        <i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>
      </a>
      <figcaption class="hero-caption"><span>Frame 01 · 数组 · 越界</span><a class="linkbtn" href="frames/${heroFrame.file}" target="_blank" rel="noopener">全幅打开 →</a></figcaption>
    </figure>
    <div class="install">
      <div class="install-hd"><span>install</span><button type="button" class="linkbtn" data-copy data-copy-target="#installCode" data-copy-message="已复制安装片段">复制</button></div>
      <pre id="installCode"><code>${esc(installSnippet)}</code></pre>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-hd">
        <div class="hd-copy"><p class="eyebrow">为什么是这套</p><h2>三个能力，一帧就够。</h2></div>
      </div>
      <div class="feature-grid">
        <article class="feature">
          <span class="feature-n">01</span>
          <h3>真实文件是唯一真相</h3>
          <p>代码、终端、diff、目录、公式都通过 <code>src</code> 指向真实文件；构建期编译，HTML 里不会再出现一份手敲内容。</p>
        </article>
        <article class="feature">
          <span class="feature-n">02</span>
          <h3>一屏一帧，分则独立</h3>
          <p>每个标签只做一件事，不依赖兄弟节点也能成立。合帧时共享 1920×1080 画布和 1680×888 安全区。</p>
        </article>
        <article class="feature">
          <span class="feature-n">03</span>
          <h3>静止即成品</h3>
          <p>没有播放器，也没有时间轴。静止帧就是交付物；<code>vk.freeze()</code> 冻在终态，截图和录屏首帧是同一张。</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section" id="components">
    <div class="wrap">
      <div class="section-hd">
        <div class="hd-copy"><p class="eyebrow">组件索引</p><h2>30 个标签，按层找。</h2></div>
        <a class="linkbtn" href="components/index.html">全部组件 →</a>
      </div>
      <div class="tag-index">
        ${LAYERS.filter((l) => l.id !== 'tokens')
          .map((layer) => {
            const tags = Object.keys(TAGS).filter((tag) => TAGS[tag].layer === layer.id);
            if (!tags.length) return '';
            return `<div class="layer-row">
          <div class="layer-name"><b>${esc(layer.label.split(' ')[0])}</b>${esc(layer.label.replace(/^L\d\s*/, ''))}</div>
          <div class="chips">${tags
            .map((tag) => `<a class="chip" href="components/${tag}.html">${esc(TAGS[tag].name)}<code>${tag}</code></a>`)
            .join('')}</div>
        </div>`;
          })
          .join('')}
      </div>
    </div>
  </section>

  <section class="section" id="frames">
    <div class="wrap">
      <div class="section-hd">
        <div class="hd-copy"><p class="eyebrow">8 帧</p><h2>每一帧都是组合，不是模板。</h2><p>打开它、复制它、拆开它。编号是场次，不是页码。</p></div>
        <a class="linkbtn" href="examples.html">全部 8 帧 →</a>
      </div>
      <div class="frame-band">
        ${FRAMES.map(
          (frame) =>
            `<a class="frame-mini" href="examples.html#frame-${frame.no}"><img src="shots/frame-${Number(frame.no) - 1}.png" alt=""><b>${frame.no} · ${esc(frame.topic)}</b></a>`
        ).join('')}
      </div>
    </div>
  </section>
</main>`;

/* ------------------------------------------------------------------ 示例 */

const examplesBody = `<main id="main">
  <section class="page-hero wrap">
    <p class="eyebrow">示例</p>
    <h1>8 帧，八个成品。</h1>
    <p class="lead">每一帧由三到五个元件组合而成。全幅打开看 1920×1080 的真实画面，<br>或者复制 recipe 回去拆。</p>
    <div class="hero-meta"><span>01–08</span><span>1920 × 1080</span><span>vk-page + 元件</span></div>
  </section>
  <div class="wrap">
    <div class="examples-grid">
      ${FRAMES.map((frame) => {
        const recipe = frameRecipe(frame);
        return `<article class="frame-card" id="frame-${frame.no}">
        <a class="frame-media" href="frames/${frame.file}" target="_blank" rel="noopener">
          <img src="shots/frame-${Number(frame.no) - 1}.png" alt="Frame ${frame.no}：${esc(frame.title)}">
          <span class="frame-open">全幅打开 ↗</span>
        </a>
        <div class="frame-body">
          <div class="frame-hd"><span class="frame-no">${frame.no}</span><h2>${esc(frame.title)}</h2></div>
          <p>${esc(frame.note)}</p>
          <div class="frame-tags">${frame.tags.map((tag) => `<code>${tag}</code>`).join('')}</div>
          <div class="frame-actions">
            <a class="btn" href="frames/${frame.file}" target="_blank" rel="noopener">全幅打开</a>
            <button type="button" class="linkbtn" data-copy data-copy-target="#recipe-${frame.no}" data-copy-message="已复制 recipe">复制 recipe</button>
          </div>
          <details class="recipe">
            <summary>recipe · ${frame.tags.length} 个标签</summary>
            <pre id="recipe-${frame.no}">${esc(recipe)}</pre>
          </details>
        </div>
      </article>`;
      }).join('')}
    </div>
  </div>
</main>`;

/* -------------------------------------------------------------- 搜索索引 */

const searchComponents = Object.keys(TAGS).map((tag) => ({
  tag,
  name: TAGS[tag].name,
  summary: TAGS[tag].summary,
  layer: layerLabel(TAGS[tag].layer),
  keywords: Object.keys(TAGS[tag].attrs || {}).join(' '),
  href: `components/${tag}.html`,
}));

const searchExamples = FRAMES.map((frame) => ({
  no: frame.no,
  title: frame.title,
  note: `${frame.topic} · ${frame.tags.join(' + ')}`,
  keywords: `${frame.topic} ${frame.tags.join(' ')} recipe frame 帧 示例`,
  href: `examples.html#frame-${frame.no}`,
}));

const searchDocs = [
  { title: '安装', note: 'npm / CSS / 运行时', href: 'docs.html#install', keywords: 'install npm 引入' },
  { title: '第一帧', note: 'vk-page 与最小骨架', href: 'docs.html#first-frame', keywords: 'page 第一帧 hello 骨架' },
  { title: '图层', note: 'L0–L4 各自只做一件事', href: 'docs.html#layers', keywords: 'layer L0 L1 L2 L3 L4 图层' },
  { title: '真实文件', note: 'src 指向真实代码 / 目录 / tex', href: 'docs.html#files', keywords: 'src 文件 filetree diff term math' },
  { title: '44px', note: '视频画布的地板，不复制到网页', href: 'docs.html#px44', keywords: '44 字号 可读性 安全区' },
  { title: 'Tokens', note: '纸 / 墨 / 钴蓝 / 字阶 / 圆角', href: 'docs.html#tokens', keywords: 'token color type radius 设计变量' },
  { title: '属性参考', note: '30 个标签的属性表', href: 'docs.html#reference', keywords: 'reference 属性 表 api' },
  { title: '授权', note: 'MIT / OFL / 第三方', href: 'docs.html#license', keywords: 'license MIT 授权 第三方' },
];

const searchIndex = `/* generated by tools/site.mjs — do not edit */
window.VK_SEARCH = ${json({
  components: searchComponents,
  examples: searchExamples,
  docs: searchDocs,
})};
`;

/* ------------------------------------------------------------------ 写盘 */

let made = 0;
if (
  writeIfChanged(
    sitePath('index.html'),
    shell({
      title: 'vk · 把网页写成一帧',
      description: 'vk 视频组件库：29 个元件 + 1 个页面，真实文件、1920×1080 安全区、8 个成品帧。',
      active: '',
      base: '',
      page: 'home',
      body: homeBody,
    }),
    check
  )
)
  made++;

if (
  writeIfChanged(
    sitePath('examples.html'),
    shell({
      title: '8 帧 · vk',
      description: 'vk 的 8 个成品帧：全幅打开、标签清单、可复制的 recipe。',
      active: 'examples',
      base: '',
      page: 'examples',
      body: examplesBody,
    }),
    check
  )
)
  made++;

if (writeIfChanged(sitePath('search-index.js'), searchIndex, check)) made++;

console.log(`site: ${made} written · ${Object.keys(TAGS).length} components · ${FRAMES.length} frames`);
