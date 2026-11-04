/**
 * 31 个场景 = 展台上唯一的真源。
 *
 * specimen、工作台、可复制代码、参考表都从这里生成：
 * 一份内容，四处使用，改一处就全对。
 *
 * 内容只有一份来源：./corpus.mjs 里的 hello.c 编译链。
 * 每条 body 只写"元件本身"：没有 page、没有标题、没有页脚、没有页码。
 * 标本页会把这一个例子放进 1680×888 的居中舞台，按可用高度等比放大。
 */

import { C } from './corpus.mjs';

const s = String.raw;

const tree = `hello.c
build/
  obj/
    hello.o
  hello.i
  hello.s
  * hello.exe
+ Makefile`;

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
    // reveal="line" 让 6 行按 at + stagger 逐行浮现（标本页 dur=2.2，可 seek 出三帧）。
    body: s`
<vk-term title="hello · gcc 四步" prompt="$" lang="sh" reveal="line" at="0.1" stagger="0.3" surface="dark" current="6" src="../assets/hello/build/steps.txt"></vk-term>`,
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
  <vk-stack gap="sm">
    <vk-text size="body" measure="body">${C.bytes.preprocessed}：${C.file} 经 gcc -E 把 stdio.h 抄进来。</vk-text>
    <vk-text size="headline" weight="bold">${C.output}</vk-text>
    <vk-text mono fit="width" fit-max="120" class="spec-w780">printf("%s\n", s);</vk-text>
    <vk-text size="label" mono ink="muted">${C.address} · ${C.bytes.preprocessed}</vk-text>
  </vk-stack>
</vk-box>`,
  },

  {
    tag: 'vk-label',
    // 主镜头只留"讲解时真会用到的三种标签 + 一次贴块"。
    // tone 的一整排色阶放进状态带（≤3 档），不再铺满首屏。
    body: s`
<vk-stack gap="lg" class="spec-w1200 spec-pad-top">
  <vk-box id="lab-a" surface="none" pad="sm">
    <vk-text size="subhead" mono>printf("%s\n", s);</vk-text>
  </vk-box>
  <vk-label variant="kicker" index="3" total="4" section="汇编">汇编</vk-label>
  <vk-text size="label" mono ink="muted">kicker 只讲工序，文件名交给代码块</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-inline',
    body: s`
<vk-box class="spec-w1680" surface="none">
  <vk-stack gap="md">
    <vk-text size="body" measure="none">句子里可以放 <vk-inline variant="code">s[0]</vk-inline>、<vk-inline variant="math">O(\log n)</vk-inline>、<vk-inline variant="sup">2</vk-inline> 与 <vk-inline variant="sub">i</vk-inline>，也可以放 <vk-inline variant="link" href="../index.html">${C.stages[0].out} 的 ${C.bytes.preprocessed}</vk-inline>。字号跟随所在行，不破坏字阶。</vk-text>
    <vk-text size="body" measure="none">行内码、公式、上下标共用正文的行高；换行由容器决定，不缩字。链接和按键也走同一套行内盒，句子里不会突然多出一条基线。</vk-text>
    <vk-text size="body" measure="none">同一句里混排时，行高由最高的行内盒决定；下一行仍回到正文基线。</vk-text>
    <vk-stack direction="row" gap="lg" align="center">
      <vk-inline variant="keys">Ctrl + C</vk-inline>
      <vk-inline variant="keys">Ctrl + Shift + P</vk-inline>
    </vk-stack>
  </vk-stack>
</vk-box>`,
  },

  {
    tag: 'vk-list',
    body: s`
<vk-box class="spec-w1200" surface="none">
  <vk-list gap="md">
${C.stages.map((st) => `    <li>${st.cmd}（${st.size}）</li>`).join('\n')}
  </vk-list>
</vk-box>`,
  },

  {
    tag: 'vk-box',
    body: s`
<vk-box border="hair" radius="xl" pad="lg" class="spec-w1200" surface="paper">
  <vk-stack gap="md">
    <vk-text size="subhead" weight="bold">${C.stages[0].out} · ${C.bytes.preprocessed}</vk-text>
    <vk-text size="body">${C.stages[0].what}</vk-text>
    <vk-text size="body" ink="secondary">下一步：${C.stages[1].cmd}（${C.stages[1].size}）。</vk-text>
  </vk-stack>
</vk-box>`,
  },

  {
    tag: 'vk-panel',
    // 同一段 hello.c 的调用行 + 运行结果，放进四档表面：
    // 白纸 → 分区（wash）→ 强调块（tint）→ 深色。看的是「层次」，不是装饰。
    body: s`
<vk-grid cols="2" gap="sm">
  <vk-panel variant="plain" title="白纸">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>  puts("${C.output}");</vk-text>
      <vk-text size="label" mono>$ ./hello.exe</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="plain" tone="info" title="分区">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>  puts("${C.output}");</vk-text>
      <vk-text size="label" mono>$ ./hello.exe</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="inset" tone="focus" title="强调">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>  puts("${C.output}");</vk-text>
      <vk-text size="label" mono>$ ./hello.exe</vk-text>
    </vk-stack>
  </vk-panel>
  <vk-panel variant="dark" title="深色">
    <vk-stack gap="2xs">
      <vk-text size="data" mono>  puts("${C.output}");</vk-text>
      <vk-text size="label" mono>$ ./hello.exe</vk-text>
    </vk-stack>
  </vk-panel>
</vk-grid>
`,
    // 预设从一块开始：抬起 / 语义色 / 窗体各自只看一块，不在四联格里叠。
    strip: s`
<vk-panel variant="plain" title="白纸">
  <vk-stack gap="2xs">
    <vk-text size="data" mono>  puts("${C.output}");</vk-text>
    <vk-text size="label" mono>$ ./hello.exe</vk-text>
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
${C.types.map((t) => `        <tr${t.name === 'unsigned' ? ' state="mark"' : ''}><td>${t.name}</td><td align="right">${t.bytes}</td><td align="right">${t.range}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </vk-table>
</vk-box>`,
  },

  {
    tag: 'vk-math',
    body: s`
<vk-stack gap="md" class="spec-w1680">
  <vk-math display size="subhead" src="../code/formula.tex"></vk-math>
  <vk-text size="body" align="center">100 项首尾配对：100 × 101 / 2 = 5050</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-canvas',
    body: s`
<vk-canvas w="1200" h="540">
  <vk-box id="name-a" x="0" y="120" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">s</vk-text>
  </vk-box>
  <vk-box id="obj-1" x="560" y="120" w="640" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="body" mono weight="medium">"${C.output}"</vk-text>
      <vk-text size="label" mono ink="muted">${C.address}</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box id="name-b" x="0" y="340" w="240" radius="pill" pad-y="xs" surface="soft">
    <vk-text size="body" weight="bold" mono align="center">p</vk-text>
  </vk-box>
  <vk-box id="obj-2" x="560" y="340" w="640" border="strong" radius="lg" pad-x="md" pad-y="xs" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="body" mono weight="medium">s + 0</vk-text>
      <vk-text size="label" mono ink="muted">${C.address}</vk-text>
    </vk-stack>
  </vk-box>
  <vk-edge from="#name-a" to="#obj-1" label="引用"></vk-edge>
  <vk-edge from="#name-b" to="#obj-2" label="起址"></vk-edge>
</vk-canvas>`,
  },

  {
    tag: 'vk-edge',
    // 主镜头只留一条"从源文件指向内存"的实线箭头；曲线 / 虚线 / 双向放进状态带。
    body: s`
<vk-canvas w="1400" h="700">
  <vk-text x="0" y="0" size="body" weight="bold">${C.stages[0].out} → ${C.address}</vk-text>
  <vk-box id="buf" x="0" y="120" w="400" radius="lg" pad-y="sm" surface="soft">
    <vk-text size="body" mono align="center">${C.stages[0].out}</vk-text>
  </vk-box>
  <vk-box id="mem" x="840" y="440" w="520" border="strong" radius="lg" pad-y="sm" surface="paper">
    <vk-text size="body" mono align="center">${C.address}</vk-text>
  </vk-box>
  <vk-edge from="#buf@side:right" to="#mem@point:0%,50%" label="编译" tension="42" arrow-style="solid" arrow-size="52"></vk-edge>
  <vk-text x="0" y="640" size="label" mono ink="muted">gcc -c · ${C.bytes.object}</vk-text>
</vk-canvas>`,
  },

  {
    tag: 'vk-stack',
    // 三行真实演算：小标题 + 一行代码 + 一行注释，gap 自带节奏。
    body: s`
<vk-stack gap="md" align="center" wrap class="spec-w780">
  <vk-box border="hair" radius="lg" pad="sm" class="spec-w780" surface="paper">
    <vk-text size="label" mono ink="muted">01 · 预处理</vk-text>
    <vk-text size="label" mono>${C.stages[0].out} · ${C.bytes.preprocessed}</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="sm" class="spec-w780" surface="paper">
    <vk-text size="label" mono ink="muted">02 · 编译</vk-text>
    <vk-text size="label" mono>${C.stages[1].out} · ${C.stages[1].size}</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="sm" class="spec-w780" surface="paper">
    <vk-text size="label" mono ink="muted">03 · 链接</vk-text>
    <vk-text size="label" mono>${C.stages[3].out} · ${C.stages[3].size}</vk-text>
  </vk-box>
</vk-stack>`,
  },

  {
    tag: 'vk-grid',
    body: s`
<vk-box class="spec-w" surface="none">
<vk-grid cols="3" gap="sm">
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">源文件</vk-text>
      <vk-text size="body" weight="bold">${C.file}</vk-text>
      <vk-text size="label" mono ink="muted">${C.bytes.source}</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">预处理后</vk-text>
      <vk-text size="body" weight="bold">${C.stages[0].out}</vk-text>
      <vk-text size="label" mono ink="muted">${C.bytes.preprocessed}</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">可执行</vk-text>
      <vk-text size="body" weight="bold">${C.stages[3].out}</vk-text>
      <vk-text size="label" mono ink="muted">${C.stages[3].size}</vk-text>
    </vk-stack>
  </vk-box>
</vk-grid>
<vk-grid cols="3" gap="sm">
  <vk-box span="2" border="hair" radius="lg" pad="md" surface="paper">
    <vk-text size="body" weight="bold" mono>gcc -E / -S / -c / -o</vk-text>
  </vk-box>
  <vk-box border="hair" radius="lg" pad="md" surface="paper">
    <vk-text size="body" weight="bold" mono>${C.output}</vk-text>
  </vk-box>
</vk-grid>
</vk-box>`,
  },

  {
    tag: 'vk-pair',
    // 并置对照：左边你写的，右边编译器给的。
    body: s`
<vk-stack gap="md" class="spec-w1680">
  <vk-stack direction="row" justify="between">
    <vk-text size="label" mono ink="muted">你写的</vk-text>
    <vk-text size="label" mono ink="muted">编译器给的</vk-text>
  </vk-stack>
  <vk-pair split="50" gap="96" axis="none" symbol="→" symbol-size="96">
    <vk-text size="body" mono>s[0] = 'H';</vk-text>
    <vk-text size="body" mono>movb $0x48</vk-text>
  </vk-pair>
  <vk-text size="label" mono ink="muted">同一行 C 赋值 → 一条 movb 指令</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-flow',
    // 三块 + 两条箭头：源码 → gcc → 产物。等宽、标签在上、箭头画在间隙正中。
    body: s`
<vk-stack gap="md" class="spec-w1680">
  <vk-text size="body" weight="bold">${C.file} → ${C.stages[0].out}</vk-text>
  <vk-flow arrow arrow-label="gcc" gap="48">
    <li label="源码" tone="info"><vk-text mono>${C.file}</vk-text></li>
    <li label="预处理" tone="neutral"><vk-text mono>gcc -E</vk-text></li>
    <li label="产物" tone="ok"><vk-text mono>${C.stages[0].out}</vk-text></li>
  </vk-flow>
  <vk-text size="label" mono ink="muted">gcc -E · ${C.bytes.preprocessed}</vk-text>
  <vk-text size="label" mono ink="muted">产物：stdio.h 已被抄进 ${C.stages[0].out}</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-compare',
    // 真实截图对：gcc -O0（13 行）vs -O2（10 行）。mark 标出 -O2 少掉的那 3 行。
    body: s`
<vk-grid cols="3">
  <vk-compare span="2" a="../assets/hello/o0.png" b="../assets/hello/o2.png" ratio="1440 / 900" split="46"
    label-a="gcc -O0 · 13 行" label-b="gcc -O2 · 10 行"
    mark="58,73,93,84" mark-label="少 3 行"></vk-compare>
</vk-grid>`,
  },

  {
    tag: 'vk-tree',
    body: s`
<vk-box class="spec-w1200" surface="none">
  <vk-tree title="hello" current="build/hello.exe" depth="4">
${tree}
  </vk-tree>
</vk-box>`,
  },

  {
    tag: 'vk-img',
    // 有边缘、有主体的真实截图：gcc -O0 的反汇编窗口。
    body: s`
<vk-img class="spec-w1200" fit="contain" src="../assets/hello/o0.png" alt="gcc -O0 编出的 hello.c 反汇编" radius="xl"></vk-img>`,
  },

  {
    tag: 'vk-cells',
    body: s`
<vk-cells cols="6" addr="${C.address}" offsets>
${C.memory.cells.map((cell) => `  <li value="${cell.value}" label="${cell.label}"${cell.span ? ` span="${cell.span}"` : ''}${cell.filled ? ' filled' : ''}${cell.state ? ` state="${cell.state}"` : ''}></li>`).join('\n')}
</vk-cells>`,
  },

  {
    tag: 'vk-steps',
    body: s`
<vk-stack gap="md" class="spec-w1200">
  <vk-steps current="1">
${C.stages.map((st) => `    <li>${st.title}</li>`).join('\n')}
  </vk-steps>
  <vk-text size="label" mono ink="muted">当前：${C.stages[1].cmd}</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-bytes',
    body: s`
<vk-stack gap="md" class="spec-w1680">
  <vk-text size="body" weight="bold">hello.bin · 48 字节</vk-text>
  <vk-bytes src="../code/hello.bin" addr="${C.address}" offset="0" length="48" current="0-5"></vk-bytes>
  <vk-text size="label" mono ink="muted">68 65 6c 6c 6f 00 → Hello</vk-text>
</vk-stack>`,
    strip: s`
<vk-bytes src="../code/hello.bin" addr="${C.address}" offset="0" length="16" current="0-3"></vk-bytes>`,
  },

  {
    tag: 'vk-bits',
    body: s`
<vk-stack gap="lg" class="spec-w1680">
  <vk-bits value="${C.float.bits}" bit-width="32" sign index="sparse">
    <li from="31" label="符号"></li>
    <li from="30" to="23" label="指数"></li>
    <li from="22" to="0" label="尾数"></li>
  </vk-bits>
  <vk-stack gap="2xs">
    <vk-text size="label" mono ink="muted">= ${C.float.value} · ${C.float.hex}</vk-text>
    <vk-text size="label" mono ink="muted">符号 0 · 指数 127 · 尾数 0</vk-text>
    <vk-text size="label" mono ink="muted">指数偏移 127：127 - 127 = 2^0</vk-text>
    <vk-text size="label" mono ink="muted">尾数全 0：小数部分为 0</vk-text>
  </vk-stack>
</vk-stack>`,
  },

  {
    tag: 'vk-bars',
    body: s`
<vk-stack gap="md" class="spec-w1200">
  <vk-bars max="${C.size.preprocessed}" scale="log" unit="字节">
    <li value="${C.size.source}" label="hello.c"></li>
    <li value="${C.size.preprocessed}" label="hello.i"></li>
    <li value="${C.size.executable}" label="hello.exe"></li>
  </vk-bars>
  <vk-text size="label" mono ink="muted">对数刻度</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-asm',
    body: s`
<vk-asm title="hello.s" lines="2-9" current="6" bytes order="1,2,3,4,5,6,7,8" long="wrap"
        fence-after="4" fence-label="编译器屏障">
  <script type="text/plain" data-vk-source>
0000000000401136 <main>:
  401136: 55                    push   %rbp
  401137: 48 89 e5              mov    %rsp,%rbp
  40113a: eb 02                 jmp    40113e
  40113c: 90                    nop
  40113e: 83 ec 20              sub    $0x20,%esp
  401141: 74 f4                 je     401137
  401143: b8 00 00 00 00        mov    $0x0,%eax
  401148: c3                    ret
  </script>
</vk-asm>`,
  },

  {
    tag: 'vk-timeline',
    // 真实年表：竖轴按年份排，1989 的 C89 作为主值（value）放大。
    // lane/at 是泳道预设要用的同一份数据，切 variant="lanes" 不会空轴。
    body: s`
<vk-stack gap="md" class="spec-w1680">
  <vk-timeline start="1972" end="2011" title="C 语言标准" value-size="subhead" mass="compact">
    <li date="1972" label="C 诞生" lane="C" at="0">Dennis Ritchie 在 Bell Labs 写下第一版 C。</li>
    <li date="1989" value="C89" lane="C" at="1">ANSI X3.159-1989 把 C 标准化。</li>
    <li date="2011" label="C11" lane="C" at="2">加入 _Generic、原子操作与线程库。</li>
  </vk-timeline>
  <vk-text size="label" mono ink="muted">等距轴：每个节点占一格，不按年份比例</vk-text>
</vk-stack>`,
  },

  {
    tag: 'vk-annotate',
    // 四种形态各一例，全部用真实内容（hello.c 的前三行 + 一行终端输出）。
    body: s`
<vk-canvas w="1680" h="660">
  <vk-code id="vka-src" x="40" y="24" w="760" lang="c" file="hello.c" src="../code/hello.c" lines="1-3" mass="compact"></vk-code>
  <vk-box id="vka-out" x="1100" y="24" w="540" border="hair" radius="lg" pad="md" surface="paper">
    <vk-stack gap="2xs">
      <vk-text size="label" mono ink="muted">$ ./hello.exe</vk-text>
      <vk-text size="body" mono>${C.output}</vk-text>
    </vk-stack>
  </vk-box>
  <vk-box id="vka-gap" x="1100" y="300" w="540" h="120" border="hair" radius="lg" pad="md" surface="soft">
    <vk-text size="body" ink="secondary">-O2 折掉 3 行</vk-text>
  </vk-box>

  <vk-annotate id="vka-arrow" mode="arrow" from="#vka-src@side:right" for="#vka-out@side:left" label="gcc -c" tone="info"></vk-annotate>
  <vk-annotate id="vka-circle" mode="circle" for="#vka-src@line:3" ring="ellipse" width="5" tone="focus"></vk-annotate>
  <vk-annotate id="vka-note" mode="note" note="bubble" for="#vka-gap@side:bottom" tone="warn">-O2 少 3 行</vk-annotate>
  <vk-annotate id="vka-badge" mode="badge" for="#vka-gap" n="2"></vk-annotate>
</vk-canvas>`,
    strip: s`
<vk-canvas w="1200" h="360">
  <vk-box id="pst-a" x="40" y="80" w="240" h="100" surface="soft" radius="lg"><vk-text size="body" mono align="center">${C.file}</vk-text></vk-box>
  <vk-box id="pst-b" x="760" y="180" w="300" h="100" surface="paper" border="hair" radius="lg"><vk-text size="body" mono align="center">${C.stages[3].out}</vk-text></vk-box>
  <vk-annotate mode="arrow" from="#pst-a@side:right" for="#pst-b@side:left" label="gcc"></vk-annotate>
</vk-canvas>`,
  },

  {
    tag: 'vk-note',
    // 边注 + 编号图例，一页看全；内容讲 hello.c 的入口与编译阶段。
    body: s`
<vk-canvas w="1680" h="720">
  <vk-box id="nt-code" x="380" y="40" w="560" h="200" surface="soft" border="hair" radius="lg" pad="md">
    <vk-text size="body" mono>int main(void)</vk-text>
    <vk-text size="body" mono ink="secondary">{ return 0; }</vk-text>
  </vk-box>
  <vk-note kind="margin" for="#nt-code" side="auto" leader="line" w="360">main 的返回值写进 eax；0 表示程序正常结束。</vk-note>

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
    tag: 'vk-layer',
    body: s`
<vk-layer class="spec-w1680 spec-h540" surface="wash">
  <vk-img src="../assets/hello/o0.png" alt="gcc -O0 的反汇编" fill="cover" radius="none"></vk-img>
  <vk-text size="body" weight="bold">gcc -O0 · 13 行</vk-text>
</vk-layer>`,
  },

  {
    tag: 'vk-page',
    // 页面自己就是画布：给一个真实的三段式开场，外加 1920×1080 的边界。
    body: s`
<vk-page class="spec-page-view" align="center">
  <vk-stack gap="lg" align="center">
    <vk-text size="label" mono ink="muted" data-meta>${C.file} · gcc 编译链</vk-text>
    <vk-text size="display" weight="bold" align="center">${C.output}</vk-text>
    <vk-text size="label" measure="body" align="center">${C.file} → ${C.stages[0].out} → ${C.stages[3].out}：${C.bytes.source} → ${C.bytes.preprocessed} → ${C.bytes.executable}</vk-text>
    <vk-stack direction="row" gap="md" align="baseline">
      <vk-text size="label" mono>${C.address}</vk-text>
      <vk-text size="label" mono ink="muted">·</vk-text>
      <vk-text size="label" mono>${C.bytes.preprocessed}</vk-text>
    </vk-stack>
  </vk-stack>
</vk-page>`,
  },
];




