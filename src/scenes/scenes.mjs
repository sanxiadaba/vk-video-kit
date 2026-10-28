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
<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-8" highlight="4" density="loose"></vk-code>`,
  },

  {
    tag: 'vk-term',
    body: s`
<vk-term title="zsh" prompt="$" src="../code/hello.term"></vk-term>`,
  },


  {
    tag: 'vk-diff',
    body: s`
<vk-diff lang="c" file="bounds.c" src="../code/real.diff"></vk-diff>`,
  },

  {
    tag: 'vk-title',
    body: s`
<vk-box w="1400" surface="none">
  <vk-title index="01" eyebrow="示例 · 组件" size="title" sub="副标题只做占位。">示例标题</vk-title>
</vk-box>`,
  },

  {
    tag: 'vk-text',
    body: s`
<vk-box w="1120" surface="none">
  <vk-text size="body" measure="body">示例文字。这一段只展示字号、行高和行宽。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-list',
    body: s`
<vk-box w="1200" surface="none">
  <vk-list gap="sm">
    <li>条目一</li>
    <li>条目二</li>
    <li>条目三</li>
    <li>条目四</li>
  </vk-list>
</vk-box>`,
  },

  {
    tag: 'vk-callout',
    body: s`
<vk-box w="1360" surface="none">
  <vk-callout tone="warn" title="提示框标题" size="body">
    提示框内容，只做占位。
  </vk-callout>
</vk-box>`,
  },

  {
    tag: 'vk-box',
    body: s`
<vk-box border="hair" radius="xl" pad="lg" w="1200" h="560" surface="paper">
  <vk-text size="body">示例内容。这里只放一段中性占位文字。</vk-text>
  <vk-text size="body" ink="secondary">名字不是值；副标题只做占位。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-tag',
    body: s`
<vk-stack gap="sm" align="start">
<vk-row gap="sm" align="center">
  <vk-tag>int</vk-tag>
  <vk-tag tone="accent">char</vk-tag>
  <vk-tag tone="neutral" emphasis="soft">4 B</vk-tag>
  <vk-tag tone="neutral" emphasis="soft">指针</vk-tag>
  <vk-tag tone="neutral" emphasis="soft" size="meta">0x10</vk-tag>
</vk-row>
<vk-row gap="sm" align="center">
  <vk-tag tone="ok">通过</vk-tag>
  <vk-tag tone="warn">警告</vk-tag>
  <vk-tag tone="err">错误</vk-tag>
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
<vk-math display size="heading" src="../code/formula.tex"></vk-math>`,
  },

  {
    tag: 'vk-canvas',
    body: s`
<vk-canvas w="1200" h="420">
  <vk-box id="name-a" x="0" y="120" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">a</vk-text>
  </vk-box>
  <vk-box id="obj-1" x="560" y="120" w="560" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-row gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="label" mono ink="muted">0x7f2a</vk-text>
    </vk-row>
  </vk-box>
  <vk-box id="name-b" x="0" y="300" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">b</vk-text>
  </vk-box>
  <vk-box id="obj-2" x="560" y="300" w="560" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-row gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="label" mono ink="muted">0x7f2e</vk-text>
    </vk-row>
  </vk-box>
  <vk-edge from="#name-a" to="#obj-1" label="引用"></vk-edge>
  <vk-edge from="#name-b" to="#obj-2" label="切片"></vk-edge>
</vk-canvas>`,
  },

  {
    tag: 'vk-edge',
    body: s`
<vk-canvas w="1200" h="520">
  <vk-box id="buf" x="0" y="70" w="320" radius="lg" pad-y="sm" surface="soft">
    <vk-text size="heading" mono align="center">buf</vk-text>
  </vk-box>
  <vk-box id="mem" x="700" y="280" w="480" border="strong" radius="lg" pad-y="sm" surface="paper">
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
    <vk-text size="body">01</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" w="1000" surface="paper">
    <vk-text size="body">02</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" w="1000" surface="paper">
    <vk-text size="body">03</vk-text>
  </vk-box>
</vk-stack>`,
  },

  {
    tag: 'vk-row',
    body: s`
<vk-box w="1680" surface="none">
  <vk-row gap="md">
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">01</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="xs" w="160" surface="soft">
      <vk-text size="body" align="center">02</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">03</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="xs" w="160" surface="soft">
      <vk-text size="body" align="center">04</vk-text>
    </vk-box>
    <vk-box radius="pill" pad-x="md" pad-y="md" w="160" surface="soft">
      <vk-text size="body" align="center">05</vk-text>
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
      <vk-text size="meta" mono ink="muted">类型</vk-text>
      <vk-text size="body" weight="bold">int</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono ink="muted">字节</vk-text>
      <vk-text size="body" weight="bold">4</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono ink="muted">最小值</vk-text>
      <vk-text size="body" weight="bold">-21 亿</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="meta" mono ink="muted">最大值</vk-text>
      <vk-text size="body" weight="bold">21 亿</vk-text>
    </vk-stack>
  </vk-box>
</vk-grid>
</vk-box>`,
  },

  {
    tag: 'vk-figure',
    body: s`
<vk-figure w="1100" fig="01" caption="一张 16:9 的图" ratio="16 / 9" crop="76.25,32.22,12.5,23.33" crop-label="裁切区" src="../assets/img/sample.svg" alt="一张示例图"></vk-figure>`,
  },

  {
    tag: 'vk-window',
    body: s`
<vk-window chrome="browser" url="http://127.0.0.1:5000/hello">
  <vk-stack gap="sm">
    <vk-text size="heading" weight="bold">示例内容</vk-text>
    <vk-text size="label" ink="secondary">示例文字。</vk-text>
    <vk-row gap="sm" align="center">
      <vk-tag tone="ok">200 OK</vk-tag>
      <vk-text size="meta" mono ink="muted">text/html · 12 B</vk-text>
    </vk-row>
  </vk-stack>
</vk-window>`,
  },

  {
    tag: 'vk-tree',
    body: s`
<vk-box w="1200" surface="none">
  <vk-tree title="app" active="src/parser.py" depth="4">
    src/
      __init__.py
      ast.py
      errors.py
      lexer.py
      * parser.py
    tests/
      fixtures/
        basic.tokens
      test_lexer.py
    + main.py
  </vk-tree>
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
    <vk-text size="label" mono ink="tertiary">终端</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="code" scale="lg"></vk-icon>
    <vk-text size="label" mono ink="tertiary">源码</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="circle-x" scale="lg" tone="err"></vk-icon>
    <vk-text size="label" mono ink="tertiary">错误</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="rocket" scale="lg"></vk-icon>
    <vk-text size="label" mono ink="tertiary">运行</vk-text>
  </vk-stack>
</vk-row>
<vk-row gap="2xl" align="center">
  <vk-stack gap="xs" align="center">
    <vk-icon name="database" scale="lg"></vk-icon>
    <vk-text size="label" mono ink="tertiary">数据</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="git-branch" scale="lg"></vk-icon>
    <vk-text size="label" mono ink="tertiary">分支</vk-text>
  </vk-stack>
  <vk-stack gap="xs" align="center">
    <vk-icon name="settings" scale="lg"></vk-icon>
    <vk-text size="label" mono ink="tertiary">设置</vk-text>
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
  <vk-text size="body" measure="body">示例文字：<vk-mark variant="highlight">高亮</vk-mark>、<vk-mark variant="underline">下划线</vk-mark>、<vk-mark variant="circle">圈选</vk-mark>。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-rule',
    body: s`
<vk-stack gap="lg">
  <vk-rule></vk-rule>
  <vk-rule variant="strong"></vk-rule>
  <vk-row justify="center"><vk-rule orientation="vertical" style="height:240px"></vk-rule></vk-row>
</vk-stack>`,
  },

  {
    tag: 'vk-note',
    body: s`
<vk-stack gap="md">
  <vk-note tone="accent" size="body">示例说明一。</vk-note>
  <vk-note emphasis="soft" size="body">示例说明二。</vk-note>
  <vk-note tone="err" size="body">示例说明三。</vk-note>
  <vk-note tone="ok" size="body">示例说明四。</vk-note>
</vk-stack>`,
  },

  {
    tag: 'vk-cells',
    body: s`
<vk-cells values="0x2a|'h'|…" labels="int x|y|填充 3 字节" spans="4|1|3" pad="2" addr="0x7ffc" stride="1" offsets></vk-cells>`,
  },

  {
    tag: 'vk-steps',
    body: s`
<vk-box w="1200" surface="none">
  <vk-steps current="1">
    <li>步骤一</li>
    <li>步骤二</li>
    <li>步骤三</li>
  </vk-steps>
</vk-box>`,
  },

  {
    tag: 'vk-bytes',
    body: s`
<vk-bytes src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" highlight="0-5"></vk-bytes>`,
  },


  {
    tag: 'vk-quote',
    body: s`
<vk-quote source="示例出处">
  示例引文。
</vk-quote>`,
  },

  {
    tag: 'vk-bits',
    body: s`
<vk-bits value="1 01111111 10000000000000000000000" width="32" sign
         fields="31:符号|30-23:指数|22-0:尾数"></vk-bits>`,
  },

  {
    tag: 'vk-bars',
    body: s`
<vk-bars max="1000000" mode="log" unit="ns">
  <i value="1" label="CPU"></i>
  <i value="120" label="内存"></i>
  <i value="1000000" label="磁盘"></i>
</vk-bars>`,
  },


  {
    tag: 'vk-asm',
    body: s`
<vk-asm title="main.s" lines="1-13" highlight="6" bytes
        order="4,1,2,3,5,6,7,8" fence-after="6" fence-label="编译器屏障">
  <script type="text/plain" data-vk-source>
0000000000401136 <main>:
  401136: 55                    push   %rbp
  401137: 48 89 e5              mov    %rsp,%rbp
  40113a: c7 45 fc 2a 00 00 00  movl   $0x2a,-0x4(%rbp)
  401141: 8b 45 fc              mov    -0x4(%rbp),%eax
  401144: 83 c0 01              add    $0x1,%eax
  401147: 89 45 fc              mov    %eax,-0x4(%rbp)
  40114a: b8 00 00 00 00        mov    $0x0,%eax
  40114f: 5d                    pop    %rbp
  401150: c3                    ret
  </script>
</vk-asm>`,
  },

  {
    tag: 'vk-timeline',
    body: s`
<vk-timeline start="1972" end="2018" lanes="A,B" title="示例时间线">
  <i date="1972" lane="A" at="0" label="事件一">说明一</i>
  <i date="1989" lane="A" at="1" label="事件二">说明二</i>
  <i date="1999" lane="B" at="2" label="事件三">说明三</i>
  <i date="2011" lane="A" at="3" label="事件四">说明四</i>
  <i date="2018" lane="B" at="4" label="事件五">说明五</i>
</vk-timeline>`,
  },

  {
    tag: 'vk-pin',
    body: s`
<vk-canvas w="1360" h="520" grid="16">
  <vk-box id="pin-target" x="120" y="150" w="440" h="200" surface="soft" border="hair" radius="lg">
    <vk-text size="heading" mono>s[5]</vk-text>
  </vk-box>
  <vk-pin for="#pin-target" side="right" tone="err" n="1">说明</vk-pin>
</vk-canvas>`,
  },

  {
    tag: 'vk-ring',
    body: s`
<vk-canvas w="1360" h="520" grid="16">
  <vk-box id="ring-target" x="220" y="140" w="520" h="220" surface="soft" border="hair" radius="lg">
    <vk-text size="heading" mono>0x2a</vk-text>
  </vk-box>
  <vk-ring for="#ring-target" shape="ellipse" tone="accent" pad="16" dash></vk-ring>
</vk-canvas>`,
  },

  {
    tag: 'vk-spotlight',
    body: s`
<vk-canvas w="1360" h="520">
  <vk-box x="80" y="120" w="380" h="220" surface="soft" border="hair" radius="lg">
    <vk-text size="label">非目标</vk-text>
  </vk-box>
  <vk-box id="spot-target" x="520" y="120" w="380" h="220" surface="soft" border="hair" radius="lg">
    <vk-text size="label" mono>0x2a</vk-text>
  </vk-box>
  <vk-box x="960" y="120" w="320" h="220" surface="soft" border="hair" radius="lg">
    <vk-text size="label">非目标</vk-text>
  </vk-box>
  <vk-spotlight for="#spot-target" dim="0.72" feather="24"></vk-spotlight>
</vk-canvas>`,
  },




  {
    tag: 'vk-page',
    body: s`
<vk-page>
  <vk-stack gap="lg">
    <vk-title index="01" eyebrow="m.c" size="title">示例页面</vk-title>
    <vk-text size="body" measure="body">页面只提供 1920×1080 画布与安全区。</vk-text>
  </vk-stack>
</vk-page>`,
  },
];
