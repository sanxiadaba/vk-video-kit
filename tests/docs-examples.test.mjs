import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

/**
 * 文档可执行：README / ai.md 里的每个 HTML 示例都必须能过构建。
 *
 * 抽块规则（只认这一种，避免把 bash / css 块也丢进构建器）：
 *   1. 只取 ```html 围栏（info string 去空白后小写等于 html）；
 *   2. 块内容必须含 `<vk-`：纯 `<link>` / `<script>` 的引导块也含 vk 标签，
 *      而讲 CSS 的 ```html 片段会被这条挡掉；
 *   3. 记录文件与围栏起始行，失败时能直接跳过去改。
 *
 * 页面根 = 仓库根：示例里的 `code/hello.c` 按真实页面的相对路径解析。
 */

const DOCS = ['README.md', 'docs/ai.md'];

export function extractHtmlExamples(markdown, file) {
  const out = [];
  const lines = markdown.split(/\r?\n/);
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^```([^\s`]*)\s*$/.exec(line);
    if (m) {
      if (fence) {
        // 收口：只收 ```html 且正文里有 vk 标签的块。
        const body = lines.slice(fence.start, i).join('\n');
        if (fence.info === 'html' && body.includes('<vk-')) {
          out.push({ file, line: fence.line, code: body });
        }
        fence = null;
      } else {
        fence = { info: m[1].trim().toLowerCase(), line: i + 1, start: i + 1 };
      }
    }
  }
  return out;
}

const examples = DOCS.flatMap((file) => extractHtmlExamples(fs.readFileSync(file, 'utf8'), file));

test('文档示例：至少抽到 README 与 ai.md 的 HTML 块（抽块规则本身在守）', () => {
  assert.ok(examples.length >= 6, `只抽到 ${examples.length} 个 HTML 示例，抽块规则可能坏了`);
  assert.ok(examples.some((b) => b.file === 'README.md'));
  assert.ok(examples.some((b) => b.file === 'docs/ai.md'));
});

const highlighter = await createVkHighlighter(['c', 'diff', 'sh', 'asm']);

for (const example of examples) {
  test(`${example.file}:${example.line} 的 HTML 示例可以构建`, async () => {
    const out = await transformHtml(example.code, { file: 'docs-example.html', highlighter });
    assert.ok(out && typeof out.html === 'string' && out.html.length > 0, '构建结果不能为空');
  });
}
