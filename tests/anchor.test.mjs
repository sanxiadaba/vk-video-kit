/**
 * 锚点协议：`#id@part:arg` 必须在构建期就被验证。
 *
 * 这些用例直接跑 transformHtml（和 `npx vk build` 同一条路），所以断言的是
 * 作者真实会遇到的行为：合法锚点通过，越界/不支持的锚点必须报错。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVkHighlighter, transformHtml } from '../src/highlight.mjs';

const hl = await createVkHighlighter(['c']);

const page = (body) => `<!doctype html><html><body>${body}</body></html>`;
const run = (body) => transformHtml(page(body), { file: 'anchor.html', highlighter: hl });

test('合法锚点：line / char / cell / byte / seg 名字 / row', async () => {
  await assert.doesNotReject(
    run(`
      <vk-code id="c" lang="c" lines="2-4">
int a;
int b;
int c;
      </vk-code>
      <vk-pin for="#c@line:3">这一行</vk-pin>
      <vk-pin for="#c@char:3:0-3">这三个字符</vk-pin>

      <vk-cells id="x" addr="0x10" offsets><li value="1"></li><li value="2"></li><li value="3"></li></vk-cells>
      <vk-pin for="#x@cell:2">第三格</vk-pin>
      <vk-pin for="#x@byte:2">第三个字节</vk-pin>

      <vk-table id="t"><table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table></vk-table>
      <vk-pin for="#t@row:1">第二行</vk-pin>
    `)
  );
});

test('line 越界：lines="2-4" 时写 line:9 必须报错', async () => {
  await assert.rejects(
    run(`
      <vk-code id="c" lang="c" lines="2-4">int a;\nint b;\nint c;</vk-code>
      <vk-pin for="#c@line:9">不存在</vk-pin>
    `),
    /行范围|越界/
  );
});

test('不支持该 part：vk-code 没有 cell 锚点', async () => {
  await assert.rejects(
    run(`
      <vk-code id="c" lang="c">int a;</vk-code>
      <vk-pin for="#c@cell:0">错锚点</vk-pin>
    `),
    /不支持 @cell/
  );
});

test('cell 越界：只有 3 格时 cell:5 必须报错', async () => {
  await assert.rejects(
    run(`
      <vk-cells id="x"><li value="1"></li><li value="2"></li><li value="3"></li></vk-cells>
      <vk-pin for="#x@cell:5">越界</vk-pin>
    `),
    /字节尺|可选范围|越界/
  );
});

test('byte 只有开了字节尺才存在', async () => {
  await assert.rejects(
    run(`
      <vk-cells id="x"><li value="1"></li><li value="2"></li><li value="3"></li></vk-cells>
      <vk-pin for="#x@byte:1">没有字节尺</vk-pin>
    `),
    /字节尺|可选范围|越界/
  );
});

test('引用不存在的 id 必须报错', async () => {
  await assert.rejects(
    run(`<vk-pin for="#nope@line:1">指向空气</vk-pin>`),
    /找不到 #nope/
  );
});
