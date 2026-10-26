/**
 * 29 个场景 = 展台上唯一的真源。
 *
 * specimen、工作台、可复制代码、参考表都从这里生成：
 * 一份内容，四处使用，改一处就全对。
 *
 * 每条 body 只写"元件本身"：没有 page、没有标题、没有页脚、没有页码。
 * 内容按 1680×888 的安全区写；默认形态就是它在手机横屏约 1/3 缩放下的样子。
 */

const s = String.raw;

export const SCENES = [
  {
    tag: 'vk-code',
    body: s`
<vk-code w="1360" lang="c" file="hello.c" src="../code/hello.c" lines="1-8" highlight="4" density="large"></vk-code>`,
  },

  {
    tag: 'vk-term',
    body: s`
<vk-term w="1500" title="zsh" prompt="$" caret src="../code/hello.term"></vk-term>`,
  },

  {
    tag: 'vk-annotate',
    body: s`
<vk-annotate w="560">
  <vk-code w="1040" id="arr" lang="c" file="array.c" src="../code/array.c" lines="4-6" highlight="2"></vk-code>
  <vk-note line="1">下标只有 0–2。</vk-note>
  <vk-note line="2">i &lt;= 3 让 i 到 3。</vk-note>
  <vk-note line="3">i = 3 时写到 a[3]。</vk-note>
</vk-annotate>`,
  },

  {
    tag: 'vk-diff',
    body: s`
<vk-diff w="1280" lang="c" file="bounds.c" src="../code/real.diff"></vk-diff>`,
  },

  {
    tag: 'vk-title',
    body: s`
<vk-box w="1400" surface="none">
  <vk-title index="01" eyebrow="字符串 · 内存" size="title" sub="改一个字符，改的是内存里的一个字节。">字符串不是值，是<em>一块内存</em></vk-title>
</vk-box>`,
  },

  {
    tag: 'vk-text',
    body: s`
<vk-box w="1120" surface="none">
  <vk-text size="body" measure="body">数组名在大多数表达式里会退化成指向首元素的指针。它<em>不携带长度</em>，也不记得自己有多大。函数收到的只是一个地址。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-list',
    body: s`
<vk-box w="1200" surface="none">
  <vk-list gap="sm">
    <li><b>char</b> 是 1 个字节</li>
    <li><b>int</b> 通常是 <b>4</b> 个字节</li>
    <li><b>unsigned</b> 只是换一种解释</li>
    <li><b>长度</b> = 元素个数 × 元素大小</li>
  </vk-list>
</vk-box>`,
  },

  {
    tag: 'vk-callout',
    body: s`
<vk-box w="1360" surface="none">
  <vk-callout tone="warn" title="越界不会报错" size="body">
    写进去，程序可能继续跑——写的是别人的内存。
  </vk-callout>
</vk-box>`,
  },

  {
    tag: 'vk-box',
    body: s`
<vk-box border="hair" radius="xl" pad="lg" w="1200" h="560" surface="paper">
  <vk-text size="body">数组不是指针。它是一块连续的内存，名字只是这块内存的入口。</vk-text>
  <vk-text size="body" emphasis="secondary">名字不是值；改一个字符，改的是内存里的一个字节。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-tag',
    body: s`
<vk-stack gap="sm" align="start">
<vk-row gap="sm" align="center">
  <vk-tag>int</vk-tag>
  <vk-tag tone="accent">char</vk-tag>
  <vk-tag tone="muted">4 B</vk-tag>
  <vk-tag tone="muted">指针</vk-tag>
  <vk-tag tone="muted" size="meta">0x10</vk-tag>
</vk-row>
<vk-row gap="sm" align="center">
  <vk-tag tone="ok">通过</vk-tag>
  <vk-tag tone="warn">警告</vk-tag>
  <vk-tag tone="err">越界</vk-tag>
</vk-row>
</vk-stack>`,
  },

  {
    tag: 'vk-table',
    body: s`
<vk-box w="1200" surface="none">
  <vk-table variant="ledger">
    <table>
      <thead>
        <tr><th>类型</th><th align="right">字节</th><th align="right">能表示</th></tr>
      </thead>
      <tbody>
        <tr><td>char</td><td align="right">1</td><td align="right">-128 … 127</td></tr>
        <tr><td>short</td><td align="right">2</td><td align="right">-32768 … 32767</td></tr>
        <tr><td>int</td><td align="right">4</td><td align="right">-21 亿 … 21 亿</td></tr>
        <tr data-em><td>unsigned</td><td align="right">4</td><td align="right">0 … 42 亿</td></tr>
        <tr><td>long</td><td align="right">8</td><td align="right">-9.2e18 … 9.2e18</td></tr>
      </tbody>
    </table>
  </vk-table>
</vk-box>`,
  },

  {
    tag: 'vk-math',
    body: s`
<div style="width:1400px"><vk-math display size="heading" src="../code/formula.tex"></vk-math></div>`,
  },

  {
    tag: 'vk-canvas',
    body: s`
<vk-canvas w="1400" h="420">
  <vk-box id="name-a" x="0" y="120" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">a</vk-text>
  </vk-box>
  <vk-box id="obj-1" x="720" y="120" w="620" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-row gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="label" mono emphasis="muted">0x7f2a</vk-text>
    </vk-row>
  </vk-box>
  <vk-box id="name-b" x="0" y="300" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">b</vk-text>
  </vk-box>
  <vk-box id="obj-2" x="720" y="300" w="620" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-row gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="label" mono emphasis="muted">0x7f2e</vk-text>
    </vk-row>
  </vk-box>
  <vk-edge from="#name-a" to="#obj-1" label="引用"></vk-edge>
  <vk-edge from="#name-b" to="#obj-2" label="切片"></vk-edge>
</vk-canvas>`,
  },

  {
    tag: 'vk-edge',
    body: s`
<vk-canvas w="1600" h="520">
  <vk-box id="buf" x="0" y="70" w="380" radius="lg" pad-y="sm" surface="soft">
    <vk-text size="heading" mono align="center">buf</vk-text>
  </vk-box>
  <vk-box id="mem" x="980" y="280" w="620" border="strong" radius="lg" pad-y="sm" surface="paper">
    <vk-text size="heading" mono align="center">一块内存</vk-text>
  </vk-box>
  <vk-edge from="#buf" to="#mem" label="指向" tension="42" arrow-style="solid" arrow-size="36"></vk-edge>
</vk-canvas>`,
  },

  {
    tag: 'vk-stack',
    body: s`
<vk-stack gap="sm">
  <vk-box border="hair" radius="lg" pad="md" w="600" surface="paper">
    <vk-text size="body">第一步：写代码</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" w="1000" surface="paper">
    <vk-text size="body">第二步：编译</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" w="1000" surface="paper">
    <vk-text size="body">第三步：运行</vk-text>
  </vk-box>
</vk-stack>`,
  },

  {
    tag: 'vk-row',
    body: s`
<vk-box w="1680" surface="none">
  <vk-row gap="md">
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">词法</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="xs" w="160" surface="soft">
      <vk-text size="body" align="center">语法</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">语义</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="xs" w="160" surface="soft">
      <vk-text size="body" align="center">中间码</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">优化</vk-text>
    </vk-box>
  </vk-row>
</vk-box>`,
  },

  {
    tag: 'vk-grid',
    body: s`
<vk-box w="1400" surface="none">
<vk-grid cols="3" gap="sm">
  <vk-box border="hair" radius="lg" pad="xl" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono emphasis="muted">类型</vk-text>
      <vk-text size="body" weight="bold">int</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono emphasis="muted">字节</vk-text>
      <vk-text size="body" weight="bold">4</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono emphasis="muted">最小值</vk-text>
      <vk-text size="body" weight="bold">-21 亿</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono emphasis="muted">最大值</vk-text>
      <vk-text size="body" weight="bold">21 亿</vk-text>
    </vk-stack>
  </vk-box>
</vk-grid>
</vk-box>`,
  },

  {
    tag: 'vk-figure',
    body: s`
<vk-figure w="1200" fig="01" caption="一张 16:9 的图" ratio="16 / 9" src="../assets/img/sample.svg" alt="一张示例图"></vk-figure>`,
  },

  {
    tag: 'vk-browser',
    body: s`
<vk-browser w="1200" url="http://127.0.0.1:5000/hello">
  <vk-stack gap="sm">
    <vk-text size="heading" weight="bold">Hello, C</vk-text>
    <vk-text size="label" emphasis="secondary">路由函数返回什么，浏览器就显示什么。</vk-text>
    <vk-row gap="sm" align="center">
      <vk-tag tone="ok">200 OK</vk-tag>
      <vk-text size="meta" mono emphasis="muted">text/html · 12 B</vk-text>
    </vk-row>
  </vk-stack>
</vk-browser>`,
  },

  {
    tag: 'vk-tree',
    body: s`
<vk-box w="1200" surface="none">
  <vk-tree title="a[i] = 0 · 语法树" variant="ast" src="../code/ast.json" depth="4"></vk-tree>
</vk-box>`,
  },

  {
    tag: 'vk-keys',
    body: s`
<vk-row gap="lg" align="center">
  <vk-keys>Ctrl + C</vk-keys>
  <vk-keys>Ctrl + D</vk-keys>
  <vk-keys>Ctrl + Z</vk-keys>
</vk-row>
<vk-row gap="lg" align="center">
  <vk-keys>Ctrl + R</vk-keys>
  <vk-keys>Ctrl + S</vk-keys>
  <vk-keys>Ctrl + /</vk-keys>
</vk-row>`,
  },

  {
    tag: 'vk-icon',
    body: s`
<vk-row gap="2xl" align="center">
  <vk-stack gap="xs" align="center">
    <vk-icon name="terminal" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">终端</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="code" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">源码</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="circle-x" scale="lg" tone="err"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">错误</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="rocket" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">运行</vk-text>
  </vk-stack>
</vk-row>
<vk-row gap="2xl" align="center">
  <vk-stack gap="xs" align="center">
    <vk-icon name="database" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">数据</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="git-branch" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">分支</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="settings" scale="lg"></vk-icon>
    <vk-text size="label" mono emphasis="tertiary">设置</vk-text>
  </vk-stack>
</vk-row>`,
  },

  {
    tag: 'vk-img',
    body: s`
<vk-img w="1200" h="675" fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl"></vk-img>`,
  },

  {
    tag: 'vk-mark',
    body: s`
<vk-box w="1120" surface="none">
  <vk-text size="body" measure="body">数组名<vk-mark variant="highlight">不是指针</vk-mark>，但传参时会<vk-mark variant="underline">退化</vk-mark>成指针。函数里的 <vk-mark variant="circle">sizeof</vk-mark> 只有 8。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-rule',
    body: s`
<vk-stack gap="md">
  <vk-text size="body">编译成功只说明语法过关。</vk-text>
  <vk-rule></vk-rule>
  <vk-text size="body" emphasis="secondary">警告说的是：这里你可能写错了。</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-note',
    body: s`
<vk-stack gap="md">
  <vk-note tone="accent" size="body">传参时退化，这条要记住。</vk-note>
  <vk-note tone="inverse" size="body">函数里的 sizeof(a) 是 8。</vk-note>
  <vk-note tone="err" size="body">错：以为 a 在函数里还是数组。</vk-note>
  <vk-note tone="ok" size="body">对：长度和指针一起传。</vk-note>
</vk-stack>`,
  },

  {
    tag: 'vk-cells',
    body: s`
<vk-cells values="1|2|3|0" labels="a[0]|a[1]|a[2]|a[3]" addr="0x7ffc" stride="4" flag="4"></vk-cells>`,
  },

  {
    tag: 'vk-steps',
    body: s`
<vk-box w="1200" surface="none">
  <vk-steps current="2">
    <li>写代码</li>
    <li>编译</li>
    <li>运行</li>
  </vk-steps>
</vk-box>`,
  },

  {
    tag: 'vk-bytes',
    body: s`
<vk-bytes w="1360" src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" highlight="1-6"></vk-bytes>`,
  },

  {
    tag: 'vk-frames',
    body: s`
<vk-frames w="1400" src="../code/stack.json" active="3" density="compact"></vk-frames>`,
  },

  {
    tag: 'vk-page',
    body: s`
<vk-page>
  <vk-stack gap="lg">
    <vk-title index="01" eyebrow="m.c" size="title">一页只讲<em>一个概念</em>。</vk-title>
    <vk-text size="body" measure="body">页眉和页脚是可选的；正文仍然是 888，这是视频里最稳的一屏。</vk-text>
  </vk-stack>
</vk-page>`,
  },
];
