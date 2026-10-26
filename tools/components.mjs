/**
 * 组件索引 + 30 个组件详情页。
 *
 *   node tools/components.mjs
 *   node tools/components.mjs --check
 *
 * 只读 registry / scenes / presets / specimens；产物写 components/。
 * 详情页 = 16:9 iframe 预览 + 3–4 个 preset tabs + 源码 + 三组属性表 + 说明 + 上/下。
 */
import fs from 'node:fs';
import { TAGS, LAYERS } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { PRESETS } from '../src/scenes/presets.mjs';
import { writeIfChanged, checkMode } from './lib/io.mjs';
import { sitePath } from './lib/paths.mjs';
import { shell, esc, json, codeblock } from './lib/site-ui.mjs';

const check = checkMode();
const dir = sitePath('components');
fs.mkdirSync(dir, { recursive: true });

const TAG_ORDER = Object.keys(TAGS);
const sceneOf = new Map(SCENES.map((s) => [s.tag, s]));
const layerOf = (id) => LAYERS.find((l) => l.id === id) || { label: id, note: '' };

const clean = (html) =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const pageSpecimen = fs.readFileSync(sitePath('specimens/vk-page.html'), 'utf8');
const pageBlock = pageSpecimen.match(/<vk-page[\s\S]*?<\/vk-page>/);
if (!pageBlock) throw new Error('specimens/vk-page.html 缺少 vk-page');
const pageSource = pageBlock[0].trim();

const sourceOf = (tag) => (tag === 'vk-page' ? pageSource : clean(sceneOf.get(tag)?.body || ''));

const thumbOf = (tag) => `../shots/thumbs/${tag}.png`;

const DESIGN_NOTES = {
  'vk-box':
    '面只负责边界：底色、描边、圆角、内距。需要层次时先换 surface 和 border，不加阴影；它不认识兄弟，也不替别人排版。',
  'vk-text':
    '正文是默认声部。measure="body" 把行长压到可读范围，换行由内容决定，不靠手动 <br>。标题、标签各有自己的标签，不要用 text 拼层级。',
  'vk-icon':
    '图标是注脚，不替代文字。四档 scale 跟随同一套尺寸；label 只给读屏，不变成可见字。',
  'vk-img':
    '图片先定比例，再谈裁切。照片用 cover，示意图用 contain；焦点决定裁切时保留哪一块。',
  'vk-rule':
    '分隔线只做语义停顿，不做装饰。三档线宽已经覆盖“轻分组 / 强分组 / 焦点提醒”。',
  'vk-mark':
    '行内标注只包文字，不改布局。高亮只服务一个焦点：同一段里不要同时标三种颜色。',
  'vk-stack':
    '竖向节奏靠 gap 一档一档给。它不画任何东西；需要面或线时，外面套 vk-box。',
  'vk-row':
    '横向关系先定对齐，再定推开方式。wrap 只在内容真的可能超出时使用，不要靠换行制造两行式排版。',
  'vk-grid':
    '列数固定，行高按内容。四列是最宽的一档；内容装不下时减少列数或删内容，不缩字。',
  'vk-canvas':
    '坐标空间里，x / y 是作者明确写下的位置。它不做自动布局；越出安全区由作者自己负责。',
  'vk-edge':
    '连线表达两个东西之间的关系。锚点自己算；一条边只讲一个方向，标签越短越清楚。',
  'vk-title':
    '一屏一个主张。标题负责“为什么看这一帧”，副题补一句代价或结论；index 是可选的场次编号。',
  'vk-list':
    '列表适合并列项，不适合步骤。条目直接写 <li>；有序 / 清单 / 定义三态由属性切换，不改内容。',
  'vk-tag':
    '标签是元信息，不是按钮。两档尺寸已经够用；颜色只表达分类或状态，不拿来做装饰。',
  'vk-callout':
    '提示块是旁注，不是第二个标题。色条和淡底给语义，正文仍然是墨色；一条只讲一个意思。',
  'vk-code':
    '真实文件是唯一真相：src 指向源文件，lines 选片段，highlight / focus / fold 都按片段行号。构建期高亮，运行时只读产物。',
  'vk-term':
    '终端记录真实输出。命令行以提示符开头，输出无前缀，结果行用显式的 ✓ / ! / ✗；不编造工具没说过的话。',
  'vk-diff':
    'diff 看的是变化。上下对照是默认，左右并排只在需要逐行比较时使用；行首符号、色条、词级下划线三通道同时成立。',
  'vk-table':
    '表格是账本：表头、数字右对齐、行高一致。行用 <tr data-em> 标出重点；不要用表格做布局。',
  'vk-math':
    '公式由 KaTeX 在构建期排版，运行时零依赖。src 指向真实 .tex；display 只决定独立成行还是行内。',
  'vk-figure':
    '图窗给图一个说明与来源，不替图说话。图注写“看什么”，来源写“从哪来”；示意图显式用 contain。',
  'vk-browser':
    '浏览器窗只借窗形，不模拟完整浏览器。地址栏的域名优先于路径；前进后退不在承诺里。',
  'vk-filetree':
    '文件树给路径与大小，当前文件是高亮，不是选中。隐藏文件、折叠目录都是显式属性；不要靠缩进猜层级。',
  'vk-keys':
    '键位是操作提示。一枚键帽一个动作，组合键用 + 分隔；它不绑定真实事件。',
  'vk-cells':
    '内存格把地址和值并置。flag 是 1-based 的越界格，只标一格；列数固定时才谈对齐。',
  'vk-steps':
    '步骤是顺序，不是列表。current 只标“现在在哪”；条目仍然直接写 <li>。',
  'vk-progress':
    '进度只表达比例，不表达努力。数值、标签、语义色各司其职；0 和 100 要能直接读懂。',
  'vk-page':
    '页面是画布工具，不是模板。安全区固定，页眉页脚可选，按容器宽度等比缩放；正文永远是 888。',
  'vk-annotate':
    '批注绑在代码行上，按行心对齐。关系由对齐表达，不画长引线；只有指向非代码元素时才给一条短引线。',
  'vk-note':
    '讲解条只服务一条信息。line 指向代码行，for 指向任意元素，由 vk-annotate 组织；n 是可选的步骤号。',
};

const LAYER_NOTE = {
  elements: 'L1 只画一个物件：形态和边界在组件内部闭合，不依赖兄弟节点。',
  layout: 'L2 只决定在哪、多大：它不承载语义，也不画视觉。',
  components: 'L3 有语义、有成品外观：读法是组件承诺的一部分，不只是样式组合。',
  compositions: 'L4 组织多个组件和跨组件几何：它不改变下层外观。',
};

const SITE_PRESETS = {
  'vk-canvas': [
    { label: '无边距', attrs: { pad: '0' } },
    { label: '宽边距', attrs: { pad: '96' } },
  ],
};

function tabsOf(tag) {
  const presets = [...(PRESETS[tag] || []), ...(SITE_PRESETS[tag] || [])];
  const tabs = [{ label: '默认', attrs: {} }];
  for (const preset of presets.slice(0, 3)) tabs.push({ label: preset.label, attrs: preset.attrs || {} });
  return tabs;
}

function valueText(attr) {
  if (attr.values) return attr.values.join(' / ');
  if (attr.type === 'bool') return '布尔';
  if (attr.type === 'num' || attr.type === 'int') return '数字';
  if (attr.type === 'lines') return '行号 / 行段';
  if (attr.type === 'selector') return '选择器';
  return '文本';
}

function attrRow(name, attr) {
  const dflt = attr.default !== undefined && attr.default !== null ? attr.default : '—';
  const note = [attr.label || name, attr.content ? '内容' : ''].filter(Boolean).join(' · ');
  return `<tr><td><code>${esc(name)}</code></td><td>${esc(valueText(attr))}</td><td>${esc(dflt)}</td><td>${esc(note)}</td></tr>`;
}

function attrTable(title, hint, rows, emptyText) {
  return `<div class="props">
  <div class="props-hd"><b>${esc(title)}</b><span>${esc(hint)}</span></div>
  ${
    rows.length
      ? `<table><thead><tr><th>属性</th><th>取值</th><th>默认</th><th>说明</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : `<p class="props-note">${esc(emptyText)}</p>`
  }
</div>`;
}

function contentTable(tag) {
  const def = TAGS[tag];
  const attrs = Object.entries(def.attrs || {}).filter(([, attr]) => attr.content);
  const rows = attrs.map(([name, attr]) => attrRow(name, attr));
  const model = def.content;
  let note = '';
  if (model) {
    const kind = { text: '文本', items: '条目', rows: '表格行', rebuild: '构建期' }[model.kind] || model.kind;
    const fields = (model.fields || []).map((field) => field.label || field.name).join('、');
    note = `内容模型：${kind}${fields ? `（${fields}）` : ''}。`;
    if (model.note) note += ` ${model.note}`;
  } else {
    note = '没有独立内容模型；属性直接作用在标签上。';
  }
  return `<div class="props">
  <div class="props-hd"><b>内容属性</b><span>content</span></div>
  ${rows.length ? `<table><thead><tr><th>属性</th><th>取值</th><th>默认</th><th>说明</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : `<p class="props-note">${esc(note)}</p>`}
  ${rows.length ? `<p class="props-note">${esc(note)}</p>` : ''}
</div>`;
}

function presetStrip(tabs) {
  return `<div class="tabs" role="tablist" aria-label="外观变体">${tabs
    .map(
      (tab, i) =>
        `<button type="button" class="tab" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-preset="${i}">${esc(tab.label)}</button>`
    )
    .join('')}</div>`;
}

async function page(tag) {
  const def = TAGS[tag];
  const layer = layerOf(def.layer);
  const tabs = tabsOf(tag);
  const source = sourceOf(tag);
  const contentAttrs = Object.entries(def.attrs || {}).filter(([, attr]) => attr.content);
  const primary = Object.entries(def.attrs || {}).filter(([, attr]) => !attr.content && (attr.group === 'appearance' || !attr.group));
  const advanced = Object.entries(def.attrs || {}).filter(
    ([, attr]) => !attr.content && attr.group && attr.group !== 'appearance'
  );

  const idx = TAG_ORDER.indexOf(tag);
  const prevTag = TAG_ORDER[(idx - 1 + TAG_ORDER.length) % TAG_ORDER.length];
  const nextTag = TAG_ORDER[(idx + 1) % TAG_ORDER.length];

  const states = (def.states || []).length
    ? `<dt>状态</dt><dd>${esc(def.states.join(' / '))}（静态，不挂事件）</dd>`
    : '';
  const slots = (def.slots || []).length
    ? `<dt>槽</dt><dd>${esc(def.slots.map((s) => s.name).join(' / '))}</dd>`
    : '';
  const modelNote = def.content
    ? def.content.kind === 'rebuild'
      ? '构建期内容：改源文件后运行 <code>npm run build</code>；这里只调外观、行段和密度。'
      : `可编辑内容：${(def.content.fields || []).map((f) => esc(f.label || f.name)).join('、') || '内容字段'}。`
    : '没有独立内容模型；属性直接作用在标签上。';

  const body = `<main id="main">
  <div class="wrap">
    <header class="detail-head">
      <div class="detail-title">
        <p class="eyebrow">组件 · ${esc(layer.label.split(' ')[0])}</p>
        <h1>${esc(def.name)}</h1>
        <p class="detail-tag">${tag}</p>
      </div>
      <div class="detail-actions">
        <div class="copy-split">
          <button type="button" class="btn primary copy-main" id="copyMain">复制</button>
          <button type="button" class="btn primary copy-caret" id="copyCaret" aria-label="复制选项" aria-expanded="false">▾</button>
          <div class="copy-menu" id="copyMenu" hidden>
            <button type="button" data-copy-mode="variant">复制当前变体</button>
            <button type="button" data-copy-mode="source">复制原始片段</button>
          </div>
        </div>
      </div>
    </header>
    <p class="detail-lead">${esc(def.summary)}</p>

    <div class="preview-block">
      <div class="stage" id="previewStage" data-preview-tag="${tag}">
        <div class="stage-in"><iframe id="previewFrame" src="../specimens/${tag}.html" title="${esc(def.name)} · 16:9 预览"></iframe></div>
        <i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>
      </div>
      <div class="stage-meta"><span>1920 × 1080 · 16:9</span><span id="previewScale">—</span></div>
      <div class="tabs-row">
        ${presetStrip(tabs)}
        <span class="tabs-note">${tabs.length > 1 ? `${tabs.length - 1} 个预设 · 只改属性` : '没有外观变体；差异来自内容或使用场景'}</span>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-main">
        <section>
          <div class="section-title"><h2>源码</h2><span>HTML · ${tag}</span></div>
          ${await codeblock(source, 'html', tag)}
        </section>
        <section>
          <div class="section-title"><h2>属性</h2><span>${Object.keys(def.attrs || {}).length} 个</span></div>
          ${attrTable('主要属性', 'primary', primary.map(([n, a]) => attrRow(n, a)), '没有主要属性。')}
          ${attrTable('高级属性', 'advanced', advanced.map(([n, a]) => attrRow(n, a)), '没有高级属性。')}
          ${contentTable(tag)}
        </section>
      </div>

      <aside class="detail-side">
        <div class="side-block">
          <h2>设计说明</h2>
          <p>${esc(DESIGN_NOTES[tag] || def.summary)}</p>
          <p>${esc(LAYER_NOTE[def.layer] || '')}</p>
        </div>
        <div class="side-block">
          <h2>规格</h2>
          <dl class="spec-list">
            <dt>层</dt><dd>${esc(layer.label)}</dd>
            <dt>标签</dt><dd><code>${tag}</code></dd>
            <dt>变体</dt><dd>${tabs.length - 1} 个预设</dd>
            ${states}
            ${slots}
          </dl>
        </div>
        <div class="side-block">
          <h2>内容</h2>
          <p>${modelNote}</p>
        </div>
        <div class="side-block">
          <h2>复制</h2>
          <p>「复制」给当前 preset 的属性；▾ 里可以只取原始片段。复制的是作者源码，不带构建期高亮数据。</p>
        </div>
      </aside>
    </div>

    <nav class="pager" aria-label="上下一个组件">
      <a href="${prevTag}.html">
        <span>← 上一个</span><b>${esc(TAGS[prevTag].name)}</b>
      </a>
      <a class="next" href="${nextTag}.html">
        <span>下一个 →</span><b>${esc(TAGS[nextTag].name)}</b>
      </a>
    </nav>
  </div>
</main>
<script type="application/json" id="specSource">${json({ source })}</script>
<script type="application/json" id="presets">${json(tabs)}</script>`;

  return shell({
    title: `${def.name} · ${tag} · vk`,
    description: def.summary,
    active: 'components',
    base: '../',
    page: 'component',
    body,
  });
}

let made = 0;
for (const tag of TAG_ORDER) {
  if (writeIfChanged(`${dir}/${tag}.html`, await page(tag), check)) made++;
}

const layerBlocks = LAYERS.filter((l) => l.id !== 'tokens')
  .map((layer) => {
    const tags = TAG_ORDER.filter((tag) => TAGS[tag].layer === layer.id);
    if (!tags.length) return '';
    return `<section class="layer-group" data-layer-group>
  <div class="layer-hd">
    <span class="layer-code">${esc(layer.label.split(' ')[0])}</span>
    <h2>${esc(layer.label.replace(/^L\d\s*/, ''))}</h2>
    <span class="layer-note">${esc(layer.note)}</span>
  </div>
  <div class="tag-grid">
    ${tags
      .map((tag) => {
        const def = TAGS[tag];
        const hay = [tag, def.name, def.summary, ...Object.keys(def.attrs || {})].join(' ').toLowerCase();
        return `<a class="tag-card" href="${tag}.html" data-search-item="${esc(hay)}">
      <div class="tag-media"><img src="${thumbOf(tag)}" alt=""></div>
      <div class="tag-body">
        <div class="tag-top"><h3>${esc(def.name)}</h3><code>${tag}</code></div>
        <p>${esc(def.summary)}</p>
        <span class="tag-layer">${esc(layer.label)}</span>
      </div>
    </a>`;
      })
      .join('')}
  </div>
</section>`;
  })
  .join('');

const indexBody = `<main id="main">
  <section class="page-hero wrap">
    <p class="eyebrow">组件索引</p>
    <h1>30 个标签，按层找。</h1>
    <p class="lead">29 个元件 + 1 个页面。每个标签只做一件事；点开看 16:9 预览、<br>可复制的 preset 和完整属性。</p>
    <div class="hero-meta"><span>L1–L4</span><span>${TAG_ORDER.length} 个标签</span><span>1920 × 1080</span></div>
  </section>
  <div class="wrap">
    <div class="toolbar">
      <label class="field"><span class="sr">搜索组件</span><input id="indexSearch" type="search" placeholder="搜索标签 / 名称 / 属性" autocomplete="off"></label>
      <span class="toolbar-note" id="searchCount">${TAG_ORDER.length} 个标签</span>
    </div>
    <div data-filter-grid>
      ${layerBlocks}
    </div>
    <p class="empty" id="searchEmpty" hidden>没有匹配的标签。试试标签名、名称或属性名。</p>
  </div>
</main>`;

const index = shell({
  title: '组件索引 · vk',
  description: 'vk 的 30 个标签：按 L1–L4 分组，16:9 预览、预设、属性与可复制源码。',
  active: 'components',
  base: '../',
  page: 'components',
  body: indexBody,
});
if (writeIfChanged(`${dir}/index.html`, index, check)) made++;

console.log(`components: ${made} written, ${TAG_ORDER.length + 1} pages`);
