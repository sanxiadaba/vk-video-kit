/**
 * 30 个场景 = 展台上唯一的真源。
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
<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-8" current="4" mass="hero"></vk-code>`,
    strip: s`
<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-7" current="4" mass="hero"></vk-code>`,
  },

  {
    tag: 'vk-term',
    // 真实采集产物（assets/hello/build/steps.txt）：四步编译 + 一行输出。
    // 默认就上色；lang="none" 是「同一段 transcript，未上色」的对照。
    // reveal="line" 让 6 行按 at + stagger 逐行浮现（标本页 dur=2.2，可 seek 出三帧）。
    body: s`
<vk-term title="steps.txt" prompt="$" lang="sh" reveal="line" at="0.1" stagger="0.3" src="../assets/hello/build/steps.txt"></vk-term>`,
  },


  {
    tag: 'vk-diff',
    body: s`
<vk-diff lang="c" file="bounds.c" src="../code/real.diff"></vk-diff>`,
  },


  {
    tag: 'vk-text',
    body: s`
<vk-box class="spec-w1120" surface="none">
  <vk-text size="body" measure="body">52,980 字节。这一段只展示字号、行高和行宽，也展示数值写法。</vk-text>
</vk-box>`,
  },

  {
    tag: 'vk-label',
    body: s`
<vk-stack gap="md">
  <vk-stack direction="row" gap="lg" align="center">
    <vk-label variant="kicker">第 3 步 · 汇编</vk-label>
    <vk-label variant="chip">已完成</vk-label>
    <vk-label variant="badge" tone="focus">3</vk-label>
    <vk-label variant="chip" tone="warn" icon="triangle-alert">有洞</vk-label>
  </vk-stack>
  <vk-stack direction="row" gap="lg" align="center">
    <vk-label tone="ok" icon="circle-check">通过</vk-label>
    <vk-label tone="err" icon="circle-x">越界</vk-label>
    <vk-label tone="info" icon="circle-alert">注意</vk-label>
    <vk-label ink="secondary" icon="arrow-right">下一步</vk-label>
  </vk-stack>
</vk-stack>`,
  },

  {
    tag: 'vk-inline',
    body: s`
<vk-box class="spec-w1680" surface="none">
  <vk-text size="body" measure="none">句子里可以放 <vk-inline variant="code">s[0]</vk-inline>、<vk-inline variant="math">O(\log n)</vk-inline>、<vk-inline variant="sup">2</vk-inline> 与 <vk-inline variant="sub">i</vk-inline>，也可以放 <vk-inline variant="link" href="../index.html">一个链接</vk-inline>。字号跟随所在行，不破坏字阶。</vk-text>
  <vk-stack direction="row" gap="lg" align="center">
    <vk-inline variant="keys">Ctrl + C</vk-inline>
    <vk-inline variant="keys">Ctrl + Shift + P</vk-inline>
  </vk-stack>
</vk-box>`,
  },

  {
    tag: 'vk-list',
    body: s`
<vk-box class="spec-w1200" surface="none">
  <vk-list gap="sm">
    <li>条目一</li>
    <li>条目二</li>
    <li>条目三</li>
    <li>条目四</li>
  </vk-list>
</vk-box>`,
  },


  {
    tag: 'vk-box',
    body: s`
<vk-box border="hair" radius="xl" pad="lg" class="spec-w1200 spec-h560" surface="paper">
  <vk-text size="body">示例内容。这里只放一段中性占位文字。</vk-text>
  <vk-text size="body" ink="secondary">名字不是值；副标题只做占位。</vk-text>
</vk-box>`,
  },


  {
    tag: 'vk-panel',
    // 同一段 hello.c + 同一行终端输出，放进四档表面：
    // 白纸 → 分区（wash）→ 强调块（tint）→ 深色。看的是「层次」，不是装饰。
    body: s`
<vk-grid cols="2" gap="sm">
  <vk-panel variant="plain" title="plain · 白纸">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>int main(void) {</vk-text>
      <vk-text size="data" mono>  puts("hello");</vk-text>
      <vk-text size="data" mono>}</vk-text>
      <vk-text size="label" mono>$ ./hello  →  hello</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="plain" tone="info" title="wash · 分区">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>int main(void) {</vk-text>
      <vk-text size="data" mono>  puts("hello");</vk-text>
      <vk-text size="data" mono>}</vk-text>
      <vk-text size="label" mono>$ ./hello  →  hello</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="inset" tone="focus" title="tint · 强调">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>int main(void) {</vk-text>
      <vk-text size="data" mono>  puts("hello");</vk-text>
      <vk-text size="data" mono>}</vk-text>
      <vk-text size="label" mono>$ ./hello  →  hello</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="dark" title="dark · 深色">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>int main(void) {</vk-text>
      <vk-text size="data" mono>  puts("hello");</vk-text>
      <vk-text size="data" mono>}</vk-text>
      <vk-text size="label" mono>$ ./hello  →  hello</vk-text>
    </vk-stack>
  </vk-panel>
</vk-grid>`,
    // 预设从一块开始：raised / 语义色 / 强边各自只看一块，不在四联格里叠。
    strip: s`
<vk-panel variant="plain" title="plain · 白纸">
  <vk-stack gap="2xs">
    <vk-text size="data" mono>int main(void) {</vk-text>
    <vk-text size="data" mono>  puts("hello");</vk-text>
    <vk-text size="data" mono>}</vk-text>
    <vk-text size="label" mono>$ ./hello  →  hello</vk-text>
  </vk-stack>
</vk-panel>`,
  },

  {
    tag: 'vk-table',
    body: s`
<vk-box class="spec-w1200" surface="none">
  <vk-table variant="ledger">
    <table>
      <thead>
        <tr><th>类型</th><th align="right">字节</th><th align="right">能表示</th></tr>
      </thead>
      <tbody>
        <tr><td>char</td><td align="right">1</td><td align="right">-128 … 127</td></tr>
        <tr><td>short</td><td align="right">2</td><td align="right">-32768 … 32767</td></tr>
        <tr><td>int</td><td align="right">4</td><td align="right">-21 亿 … 21 亿</td></tr>
        <tr state="mark"><td>unsigned</td><td align="right">4</td><td align="right">0 … 42 亿</td></tr>
        <tr><td>long</td><td align="right">8</td><td align="right">-9.2e18 … 9.2e18</td></tr>
      </tbody>
    </table>
  </vk-table>
</vk-box>`,
  },

  {
    tag: 'vk-math',
    body: s`
<vk-math display size="subhead" src="../code/formula.tex"></vk-math>`,
  },

  {
    tag: 'vk-canvas',
    body: s`
<vk-canvas w="1200" h="420">
  <vk-box id="name-a" x="0" y="120" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">a</vk-text>
  </vk-box>
  <vk-box id="obj-1" x="560" y="120" w="640" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-stack direction="row" gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="body" mono ink="muted">0x7f2a</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box id="name-b" x="0" y="300" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">b</vk-text>
  </vk-box>
  <vk-box id="obj-2" x="560" y="300" w="640" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-stack direction="row" gap="sm" align="baseline" justify="between">
      <vk-text size="body" mono weight="medium">[1, 2, 3]</vk-text>
      <vk-text size="body" mono ink="muted">0x7f2e</vk-text>
    </vk-stack>
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
    <vk-text size="subhead" mono align="center">buf</vk-text>
  </vk-box>
  <vk-box id="mem" x="700" y="280" w="480" border="strong" radius="lg" pad-y="sm" surface="paper">
    <vk-text size="subhead" mono align="center">一块内存</vk-text>
  </vk-box>
  <vk-edge from="#buf@side:right" to="#mem@point:0%,50%" label="指向" tension="42" arrow-style="solid" arrow-size="36"></vk-edge>
</vk-canvas>`,
  },

  {
    tag: 'vk-stack',
    body: s`
<vk-stack gap="sm">
  <vk-box border="hair" radius="lg" pad="md" class="spec-w520" surface="paper">
    <vk-text size="body">01</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" class="spec-w520" surface="paper">
    <vk-text size="body">02</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" class="spec-w520" surface="paper">
    <vk-text size="body">03</vk-text>
  </vk-box>
</vk-stack>`,
  },

  {
    tag: 'vk-grid',
    body: s`
<vk-box class="spec-w" surface="none">
<vk-grid cols="3" gap="sm">
  <vk-box border="hair" radius="lg" pad="xl" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">类型</vk-text>
      <vk-text size="body" weight="bold">int</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">字节</vk-text>
      <vk-text size="body" weight="bold">4</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">最小值</vk-text>
      <vk-text size="body" weight="bold">-21 亿</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">最大值</vk-text>
      <vk-text size="body" weight="bold">21 亿</vk-text>
    </vk-stack>
  </vk-box>
</vk-grid>
</vk-box>`,
  },

  {
    tag: 'vk-compare',
    // 真实截图对：gcc -O0（13 行）vs -O2（10 行）。mark 标出 -O2 少掉的那 3 行，
    // 坐标是相对取景框的百分比；split 下只画在所属的那一侧（这里是右半的 b）。
    body: s`
<vk-grid cols="3">
  <vk-compare span="2" a="../assets/hello/o0.png" b="../assets/hello/o2.png" ratio="1440 / 900" split="46"
    label-a="gcc -O0 · 13 行" label-b="gcc -O2 · 10 行"
    mark="58,73,93,84" mark-label="少 3 行"></vk-compare>
</vk-grid>`,
  },

  {
    tag: 'vk-window',
    body: s`
<vk-window chrome="browser" url="http://127.0.0.1:5000/hello">
  <vk-stack gap="sm">
    <vk-text size="subhead" weight="bold">示例内容</vk-text>
    <vk-text size="body" ink="secondary">示例文字。</vk-text>
    <vk-stack direction="row" gap="sm" align="center">
      <vk-text size="label">200 OK</vk-text>
      <vk-text size="label" mono ink="muted">text/html · 12 B</vk-text>
    </vk-stack>
  </vk-stack>
</vk-window>`,
  },

  {
    tag: 'vk-tree',
    body: s`
<vk-box class="spec-w1200" surface="none">
  <vk-tree title="app" current="src/parser.py" depth="4">
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
    tag: 'vk-icon',
    // 图标是语义符号，不是装饰：白名单只有四类意思（✓ / ! / ✗ / 方向）。
    // 这一页按"意思"分组，而不是按"图标库"列一遍。
    body: s`
<vk-stack gap="xl">
  <vk-stack direction="row" gap="2xl" align="center">
    <vk-stack gap="xs" align="center">
      <vk-icon name="check" size="lg"></vk-icon>
      <vk-text size="body" mono ink="tertiary">成立</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="circle-check" size="lg" tone="ok"></vk-icon>
      <vk-text size="body" mono ink="tertiary">已完成</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="triangle-alert" size="lg" tone="warn"></vk-icon>
      <vk-text size="body" mono ink="tertiary">注意</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="info" size="lg"></vk-icon>
      <vk-text size="body" mono ink="tertiary">说明</vk-text>
    </vk-stack>
  </vk-stack>
  <vk-stack direction="row" gap="2xl" align="center">
    <vk-stack gap="xs" align="center">
      <vk-icon name="x" size="lg" tone="err"></vk-icon>
      <vk-text size="body" mono ink="tertiary">不成立</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="circle-x" size="lg" tone="err"></vk-icon>
      <vk-text size="body" mono ink="tertiary">越界</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="arrow-up" size="lg"></vk-icon>
      <vk-text size="body" mono ink="tertiary">向上</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="arrow-down" size="lg"></vk-icon>
      <vk-text size="body" mono ink="tertiary">向下</vk-text>
    </vk-stack>
    <vk-stack gap="xs" align="center">
      <vk-icon name="arrow-right" size="lg"></vk-icon>
      <vk-text size="body" mono ink="tertiary">下一步</vk-text>
    </vk-stack>
  </vk-stack>
</vk-stack>`,
  },

  {
    tag: 'vk-img',
    body: s`
<vk-img class="spec-w1200" fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl"></vk-img>`,
  },


  {
    tag: 'vk-rule',
    body: s`
<vk-stack gap="lg">
  <vk-rule></vk-rule>
  <vk-rule variant="strong"></vk-rule>
  <div class="spec-h240"><vk-stack direction="row" justify="center"><vk-rule orientation="vertical" fill></vk-rule></vk-stack></div>
</vk-stack>`,
  },

  {
    tag: 'vk-cells',
    body: s`
<vk-cells cols="6" addr="0x7ffc" offsets>
  <li value="'h'" label="s[0]"></li>
  <li value="'e'" label="s[1]"></li>
  <li value="'l'" label="s[2]" state="mark"></li>
  <li value="'l'" label="s[3]"></li>
  <li value="'o'" label="s[4]"></li>
  <li value="\0" label="s[5]" filled></li>
  <li value="0x2a" label="int x" span="4"></li>
  <li value="'h'" label="char 1 字节"></li>
  <li value="…" label="填充 3 字节" span="3" filled></li>
  <li value="0xff" label="y" state="err"></li>
</vk-cells>`,
  },

  {
    tag: 'vk-steps',
    body: s`
<vk-box class="spec-w1200" surface="none">
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
<vk-bytes src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" current="0-5"></vk-bytes>`,
    strip: s`
<vk-bytes src="../code/hello.bin" addr="0x7ffc" offset="0" length="16" current="0-3"></vk-bytes>`,
  },




  {
    tag: 'vk-bits',
    body: s`
<vk-bits value="1 01111111 10000000000000000000000" bit-width="32" sign>
  <li from="31" label="符号"></li>
  <li from="30" to="23" label="指数"></li>
  <li from="22" to="0" label="尾数"></li>
</vk-bits>`,
  },

  {
    tag: 'vk-bars',
    body: s`
<vk-bars max="1000000" scale="log" unit="ns">
  <li value="1" label="CPU"></li>
  <li value="120" label="内存"></li>
  <li value="1000000" label="磁盘"></li>
</vk-bars>`,
  },


  {
    tag: 'vk-asm',
    body: s`
<vk-asm title="main.s" lines="1-13" current="6" bytes long="wrap"
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
<vk-timeline start="1972" end="2018" lanes="A,B" title="示例时间线" value-size="subhead">
  <li date="1972" lane="A" at="0" label="事件一">说明一</li>
  <li date="1989" lane="A" at="1" label="峰值" value="52,980" note="预处理前 · 字节"></li>
  <li date="1999" lane="B" at="2" label="事件三">说明三</li>
  <li date="2011" lane="A" at="3" label="事件四">说明四</li>
  <li date="2018" lane="B" at="4" label="事件五">说明五</li>
</vk-timeline>`,
  },

  {
    tag: 'vk-pin',
    body: s`
<vk-canvas w="1360" h="520" grid="16">
  <vk-box id="pin-target" x="120" y="150" w="440" h="200" surface="soft" border="hair" radius="lg">
    <vk-text size="subhead" mono>s[5]</vk-text>
  </vk-box>
  <vk-pin for="#pin-target@side:right" side="right" tone="info" n="1">说明</vk-pin>
</vk-canvas>`,
  },

  {
    tag: 'vk-ring',
    body: s`
<vk-canvas w="1360" h="520" grid="16">
  <vk-box id="ring-target" x="220" y="140" w="520" h="220" surface="soft" border="hair" radius="lg">
    <vk-text size="subhead" mono>0x2a</vk-text>
  </vk-box>
  <vk-ring for="#ring-target" variant="rect" tone="info" pad-px="16"></vk-ring>
</vk-canvas>`,
  },




  {
    tag: 'vk-annotate',
    // 四种形态各一例，全部用真实内容（hello.c 的前三行 + 一行终端输出）。
    // 下半张是三种走线 × 实虚的对照：形状是几何，不是滤镜。
    body: s`
<vk-canvas w="1500" h="820">
  <vk-code id="vka-src" x="40" y="20" w="660" lang="c" file="hello.c" src="../code/hello.c" lines="1-3" mass="compact"></vk-code>
  <vk-box id="vka-out" x="820" y="20" w="460" border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">$ ./hello.exe</vk-text>
      <vk-text size="body" mono>Hello, World!</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box id="vka-gap" x="820" y="250" w="460" h="140" border="hair" radius="lg" pad="md" surface="none">
    <vk-text size="body" ink="secondary">这里空着</vk-text>
  </vk-box>

  <vk-annotate id="vka-arrow" mode="arrow" from="#vka-src@side:right" for="#vka-out@side:left" label="编译" tone="info"></vk-annotate>
  <vk-annotate id="vka-circle" mode="circle" for="#vka-src@line:3" ring="ellipse" double tone="focus"></vk-annotate>
  <vk-annotate id="vka-note" mode="note" note="bubble" for="#vka-gap@side:left" tone="warn">-O2 少了 3 行</vk-annotate>
  <vk-annotate id="vka-badge" mode="badge" for="#vka-gap@side:right" n="2"></vk-annotate>

  <vk-text x="40" y="555" size="label" mono ink="muted">形状 × 虚实（左实 / 右虚）</vk-text>

  <vk-text x="40" y="600" size="label" mono ink="muted">straight 实</vk-text>
  <vk-box id="sh1a" x="320" y="600" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh1b" x="540" y="600" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="straight" from="#sh1a@side:right" to="#sh1b@side:left"></vk-annotate>
  <vk-text x="760" y="600" size="label" mono ink="muted">straight 虚</vk-text>
  <vk-box id="sh2a" x="1040" y="600" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh2b" x="1260" y="600" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="straight" dash="dashed" from="#sh2a@side:right" to="#sh2b@side:left"></vk-annotate>

  <vk-text x="40" y="670" size="label" mono ink="muted">ortho 实</vk-text>
  <vk-box id="sh3a" x="320" y="670" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh3b" x="540" y="670" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="ortho" from="#sh3a@side:right" to="#sh3b@side:left"></vk-annotate>
  <vk-text x="760" y="670" size="label" mono ink="muted">ortho 虚</vk-text>
  <vk-box id="sh4a" x="1040" y="670" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh4b" x="1260" y="670" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="ortho" dash="dashed" from="#sh4a@side:right" to="#sh4b@side:left"></vk-annotate>

  <vk-text x="40" y="740" size="label" mono ink="muted">curve 实</vk-text>
  <vk-box id="sh5a" x="320" y="740" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh5b" x="540" y="740" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="curve" from="#sh5a@side:right" to="#sh5b@side:left"></vk-annotate>
  <vk-text x="760" y="740" size="label" mono ink="muted">curve 虚</vk-text>
  <vk-box id="sh6a" x="1040" y="740" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">a</vk-text></vk-box>
  <vk-box id="sh6b" x="1260" y="740" w="120" h="48" surface="soft" radius="md"><vk-text size="label" mono align="center">b</vk-text></vk-box>
  <vk-annotate mode="arrow" shape="curve" dash="dashed" from="#sh6a@side:right" to="#sh6b@side:left"></vk-annotate>
</vk-canvas>`,
    strip: s`
<vk-canvas w="1200" h="360">
  <vk-box id="pst-a" x="40" y="80" w="240" h="100" surface="soft" radius="lg"><vk-text size="body" mono align="center">hello.c</vk-text></vk-box>
  <vk-box id="pst-b" x="760" y="180" w="300" h="100" surface="paper" border="hair" radius="lg"><vk-text size="body" mono align="center">hello.exe</vk-text></vk-box>
  <vk-annotate mode="arrow" from="#pst-a@side:right" for="#pst-b@side:left" label="编译"></vk-annotate>
</vk-canvas>`,
  },

  {
    tag: 'vk-note',
    // 两种"不像气泡"的注解，一页看全：
    // 上半是边注（1px 细线 + 栏间空白里的一句话，与目标正文同基线），
    // 下半是编号图例（目标角上 1 / 2，页角一张编号 + 说明的表）。
    body: s`
<vk-canvas w="1680" h="720">
  <vk-box id="nt-code" x="380" y="40" w="560" h="200" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="body" mono>int main(void)</vk-text>
    <vk-text size="body" mono ink="secondary">{ return 0; }</vk-text>
  </vk-box>
  <vk-note kind="margin" for="#nt-code" side="auto" leader="line" w="240">这一段只讲入口：返回值说明程序有没有跑完。</vk-note>

  <vk-box id="nt-a" x="380" y="380" w="420" h="160" surface="sf-1" radius="lg" pad="md">
    <vk-text size="body">预处理</vk-text>
  </vk-box>
  <vk-box id="nt-b" x="1040" y="380" w="420" h="160" surface="sf-1" radius="lg" pad="md">
    <vk-text size="body">编译</vk-text>
  </vk-box>
  <vk-note kind="legend" for="#nt-a;#nt-b" place="br">
    <li>只把 include 抄进来，不做语法检查</li>
    <li>到这一步才检查语法并优化</li>
  </vk-note>
</vk-canvas>`,
  },

  {
    tag: 'vk-page',
    body: s`
<vk-page>
  <vk-stack gap="lg">
    <vk-stack gap="2xs"><vk-text size="label" mono ink="muted" data-meta>m.c</vk-text><vk-text size="title" weight="bold">示例页面</vk-text></vk-stack>
    <vk-text size="body" measure="body">页面只提供 1920×1080 画布与安全区。</vk-text>
  </vk-stack>
</vk-page>`,
  },
];








