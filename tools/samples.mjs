/**
 * 每个标签的最小样张：只用于构建 / 截图回归 / 画廊，不进库、不当作模板。
 * 内容尽量用仓库里真实的 code/ 与 assets/。
 */
const C = '../../code';

export const SAMPLES = {
  'vk-box': `<vk-box pad="lg" border="hair" surface="paper"><vk-text size="body">一个面：底、描边、圆角、内距。</vk-text></vk-box>`,
  'vk-panel': `<vk-panel title="输出" variant="plain" border="hair" pad="md"><vk-text size="body">一块有标题的分区。</vk-text></vk-panel>`,
  'vk-text': `<vk-text size="headline">字符串不是值，是<em>一块内存</em>。</vk-text>`,
  'vk-label': `<vk-label variant="kicker" counter="3/5" section="汇编">汇编</vk-label>`,
  'vk-inline': `<vk-text size="body">句子里可以放 <vk-inline variant="code">s[0]</vk-inline>，也可以放 <vk-inline variant="math">O(\\log n)</vk-inline>。</vk-text>`,
  'vk-img': `<vk-img src="../../assets/sample-grid.svg" alt="示例图" ratio="16 / 9" fill="contain" radius="lg"></vk-img>`,
  'vk-stack': `<vk-stack gap="md"><vk-text size="body">上</vk-text><vk-text size="body">中</vk-text><vk-text size="body">下</vk-text></vk-stack>`,
  'vk-grid': `<vk-grid cols="3" gap="md"><vk-box pad="md" border="hair"><vk-text size="body">1</vk-text></vk-box><vk-box pad="md" border="hair" span="2"><vk-text size="body">2（跨两格）</vk-text></vk-box></vk-grid>`,
  'vk-layer': `<vk-layer surface="wash"><vk-box surface="tint"></vk-box><vk-text size="headline">叠在最上面</vk-text></vk-layer>`,
  'vk-pair': `<vk-pair split="50" axis="line" symbol="vs"><vk-box pad="md" border="hair"><vk-text size="body">改前</vk-text></vk-box><vk-box pad="md" border="hair"><vk-text size="body">改后</vk-text></vk-box></vk-pair>`,
  'vk-flow': `<vk-flow arrow="true,label:gcc"><li label="预处理">hello.i</li><li label="编译">hello.s</li><li label="汇编">hello.o</li></vk-flow>`,
  'vk-canvas': `<vk-canvas w="1400" h="600"><vk-box x="0" y="0" pad="md" border="hair"><vk-text size="body">坐标 0,0</vk-text></vk-box><vk-box x="800" y="300" pad="md" border="hair"><vk-text size="body">坐标 800,300</vk-text></vk-box></vk-canvas>`,
  'vk-list': `<vk-list gap="sm"><li>字符串不是值</li><li>它是一块内存</li><li>每个字节都有地址</li></vk-list>`,
  'vk-code': `<vk-code lang="c" file="hello.c" src="${C}/hello.c" lines="1-8" current="4"></vk-code>`,
  'vk-term': `<vk-term title="zsh" src="${C}/hello.term"></vk-term>`,
  'vk-diff': `<vk-diff lang="c" file="real.diff" src="${C}/real.diff"></vk-diff>`,
  'vk-table': `<vk-table><table><tr><th>类型</th><th>宽度</th></tr><tr><td>char</td><td>1</td></tr><tr><td>int</td><td>4</td></tr><tr><td>指针</td><td>8</td></tr></table></vk-table>`,
  'vk-math': `<vk-math display size="headline" src="${C}/formula.tex"></vk-math>`,
  'vk-compare': `<vk-compare ratio="16 / 9" labels="../../assets/hello/o0.png,../../assets/hello/o2.png|gcc -O0|gcc -O2"></vk-compare>`,
  'vk-tree': `<vk-tree title="hello" depth="2">hello.c build/ obj/ hello.s hello.o</vk-tree>`,
  'vk-cells': `<vk-cells cols="4" addr="0x1000"><li value="61" label="s[0]"></li><li value="62" label="s[1]"></li><li value="63" label="s[2]"></li><li value="64" label="s[3]"></li></vk-cells>`,
  'vk-bytes': `<vk-bytes src="${C}/hello.bin" addr="0x0" offset="0" length="16" cols="8"></vk-bytes>`,
  'vk-steps': `<vk-steps current="2"><li>预处理</li><li>编译</li><li>汇编</li><li>链接</li></vk-steps>`,
  'vk-bits': `<vk-bits value="1 01111111 10000000000000000000000" bit-width="32" sign index="sparse"></vk-bits>`,
  'vk-bars': `<vk-bars max="52980" unit="字节"><li value="52980" label="hello.i"></li><li value="1200" label="hello.c"></li></vk-bars>`,
  'vk-asm': `<vk-asm title="hello.s" src="../../assets/hello/build/disasm.txt" lines="9-15"></vk-asm>`,
  'vk-timeline': `<vk-timeline start="1972" end="2011" title="C 语言标准" size="headline"><li date="1972">C 诞生</li><li date="1989">C89</li><li date="1999">C99</li></vk-timeline>`,
  'vk-page': `<vk-text size="body">页面本身是 1920×1080 的坐标系。</vk-text>`,
  'vk-annotate': `<vk-stack gap="md"><vk-code id="ann-code" lang="c" file="hello.c" src="${C}/hello.c" lines="4-6"></vk-code><vk-annotate mode="circle" for="#ann-code@line:5"></vk-annotate></vk-stack>`,
  'vk-note': `<vk-grid cols="3" gap="lg"><vk-box id="note-target" span="2" pad="lg" border="hair"><vk-text size="body">这一行把字符写进数组。</vk-text></vk-box></vk-grid><vk-note variant="margin" for="#note-target">main 的返回值写进 eax；0 表示程序正常结束。</vk-note>`,
};

export function fixturePage(tag) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${tag}</title>
<link rel="stylesheet" href="../vk/fonts.css">
<link rel="stylesheet" href="../vk/vk.css">
</head>
<body style="margin:0;background:#e9e9ea">
<vk-page align="center">
${SAMPLES[tag]}
</vk-page>
<script src="../dist/vk.js"></script>
</body>
</html>
`;
}
