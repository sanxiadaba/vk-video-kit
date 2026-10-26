/**
 * 生成 docs.html：一个 H1、左 TOC、760 正文。
 *
 *   node tools/docs.mjs
 *   node tools/docs.mjs --check
 *
 * 正文来自 docs/guide.md + docs/reference.md + LICENSE + THIRD-PARTY-NOTICES.md。
 * Markdown 只做这几份文档需要的子集；代码块用 Shiki（dev 依赖）在生成期高亮。
 */
import fs from 'node:fs';
import { writeIfChanged, checkMode } from './lib/io.mjs';
import { shell, esc, codeblock } from './lib/site-ui.mjs';

const check = checkMode();
const read = (file) => fs.readFileSync(file, 'utf8');

const SECTION_IDS = {
  安装: 'install',
  第一帧: 'first-frame',
  图层: 'layers',
  真实文件: 'files',
  '44px': 'px44',
  Tokens: 'tokens',
  属性参考: 'reference',
  授权: 'license',
};

const PLAIN = (s) =>
  String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

function slugOf(text, used) {
  const plain = PLAIN(text).trim();
  let base = SECTION_IDS[plain] || plain
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) base = 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function linkHref(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  let h = href;
  if (/reference\.md/.test(h)) return '#reference';
  if (/design\.md/.test(h)) return '#tokens';
  if (/choosing\.md/.test(h)) return 'components/index.html';
  if (/README\.md/.test(h)) return 'index.html';
  h = h.replace(/^\.\.\//, '').replace(/\.md$/, '.html');
  return h;
}

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${esc(linkHref(href))}">${label}</a>`);
  return out;
}

function splitCells(row) {
  return row
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

async function renderMarkdown(md, { shift = 0, toc = null, skipH1 = true, transform = null } = {}) {
  const source = transform ? transform(md) : md;
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const used = new Set();
  let skipped = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || 'text';
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(await codeblock(buf.join('\n'), lang));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      let level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && skipH1 && !skipped) {
        skipped = true;
        i++;
        continue;
      }
      if (level === 1) level = 2;
      level = Math.min(6, level + shift);
      const id = slugOf(text, used);
      if (toc && (level === 2 || level === 3)) toc.push({ level, text: PLAIN(text), id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*\|/.test(line)) {
      const rows = [];
      let j = i;
      while (j < lines.length && /^\s*\|/.test(lines[j])) rows.push(lines[j++].trim());
      const sep = rows[1] && /^\|?\s*:?-{2,}/.test(rows[1]) ? rows[1] : '';
      const body = sep ? rows.filter((_row, index) => index !== 1) : rows;
      if (body.length) {
        const head = splitCells(body[0]);
        const aligns = sep
          ? splitCells(sep).map((cell) =>
              /^:.*:$/.test(cell) ? 'center' : /:$/.test(cell) ? 'right' : /^:/.test(cell) ? 'left' : ''
            )
          : [];
        const alignAttr = (index) => (aligns[index] ? ` style="text-align:${aligns[index]}"` : '');
        out.push(
          `<div class="table-wrap"><table><thead><tr>${head
            .map((cell, index) => `<th${alignAttr(index)}>${inline(cell)}</th>`)
            .join('')}</tr></thead><tbody>${body
            .slice(1)
            .map(
              (row) =>
                `<tr>${splitCells(row)
                  .map((cell, index) => `<td${alignAttr(index)}>${inline(cell)}</td>`)
                  .join('')}</tr>`
            )
            .join('')}</tbody></table></div>`
        );
      }
      i = j;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push(`<ul>${buf.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      out.push(`<ol>${buf.map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|>\s?|\s*\||\s*[-*]\s+|\s*\d+\.\s+|-{3,}$)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    else i++;
  }

  return out.join('\n');
}

const stripMaintenance = (md) =>
  md
    .replace(/^> 由 `tools\/gen\.mjs`[^\n]*\n/gm, '')
    .replace(/\[验收台\]\([^)]*\)/g, '[组件索引](components/index.html)')
    .replace(/验收台/g, '组件索引');

const guideToc = [];
const guide = await renderMarkdown(read('docs/guide.md'), { toc: guideToc });
const reference = await renderMarkdown(stripMaintenance(read('docs/reference.md')), { shift: 1 });
const design = await renderMarkdown(read('docs/design.md'), { shift: 1 });
const choosing = await renderMarkdown(read('docs/choosing.md'), { shift: 1 });
const license = esc(read('LICENSE').trim());
const notices = fs.existsSync('THIRD-PARTY-NOTICES.md')
  ? await renderMarkdown(read('THIRD-PARTY-NOTICES.md'), { shift: 1 })
  : '';

const toc = [
  ...guideToc,
  { level: 2, text: '属性参考', id: 'reference' },
  { level: 2, text: '设计说明', id: 'design' },
  { level: 2, text: '怎么选', id: 'choosing' },
  { level: 2, text: '授权', id: 'license' },
];

const tocHtml = toc
  .map(
    (item) =>
      `<a href="#${item.id}"${item.level === 3 ? ' data-sub="1"' : ''}>${esc(item.text)}</a>`
  )
  .join('');

const body = `<main id="main">
  <header class="doc-hero">
    <div class="doc-wrap">
      <p class="eyebrow">文档</p>
      <h1>文档</h1>
      <p class="lead">安装、第一帧、图层、真实文件、44px 与 tokens；<br>后面是完整的属性表、设计说明与选型建议。</p>
    </div>
  </header>
  <div class="doc-wrap">
    <div class="doc-layout">
      <aside class="toc" data-toc aria-label="目录">
        <p class="eyebrow">目录</p>
        ${tocHtml}
      </aside>
      <article class="doc-body">
        ${guide}
        <section id="reference">
          <h2>属性参考</h2>
          <p>30 个标签的属性、取值和默认值。日常从组件详情页进入；这里用来查表。</p>
          <div class="ref-body">${reference}</div>
        </section>
        <section id="design">
          <h2>设计说明</h2>
          <p>为什么是 44px、为什么焦点只有一个颜色、为什么窗只有一层。</p>
          ${design}
        </section>
        <section id="choosing">
          <h2>怎么选</h2>
          <p>同一件事有多个标签时，先看这一页。</p>
          ${choosing}
        </section>
        <section id="license">
          <h2>授权</h2>
          <p>vk 本体是 MIT。字体 OFL 1.1，运行时依赖见第三方声明。完整文本见 <a href="LICENSE">LICENSE</a>。</p>
          <pre class="license">${license}</pre>
          <div class="third-party">${notices}</div>
        </section>
      </article>
    </div>
  </div>
</main>`;

const html = shell({
  title: '文档 · vk',
  description: 'vk 的安装、第一帧、图层、真实文件、44px、tokens、属性参考、设计说明与授权。',
  active: 'docs',
  base: '',
  page: 'docs',
  body,
});

if (writeIfChanged('_site/docs.html', html, check)) console.log('docs.html written');
else console.log('docs.html unchanged');
