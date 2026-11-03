# 能力矩阵

> 由 `tools/capabilities.mjs` 从 `docs/capabilities.json` 生成 —— 不要手改。
> 一条能力必须同时有「契约断言 / 标本页 / 测试」三件；缺一件，状态变红，
> `npm test` 里的 capabilities 组与 `tools/verify.mjs` 都会失败。

记账方式：**能力**是用户能看见的一件事（“有一档淡底”“深色块也能用”），
不是标签。标签会删会改；能力不能悄悄消失。

| 能力 | 契约断言 | 标本页 | 测试 | 状态 |
|---|---|---|---|---|
| 语义淡底 · wash | `vk-panel.tone` | `specimen/vk-panel.html` | `tests/surfaces.test.mjs`<br>`tests/panel.test.mjs` | ✅ 绿 |
| 语义淡底 · tint | `vk-panel.tone` | `specimen/vk-panel.html` | `tests/surfaces.test.mjs`<br>`tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · plain | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · raised | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · inset | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · dark | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · 标题带 | `vk-panel.title` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| 终端 · shell 词法 | `vk-term.lang` | `specimen/vk-term.html` | `tests/shell.test.mjs`<br>`tests/shell-dom.test.mjs` | ✅ 绿 |
| 汇编 · 五色 token | `vk-asm.focus` | `specimen/vk-asm.html` | `tests/shell.test.mjs`<br>`tests/shell-dom.test.mjs` | ✅ 绿 |
| 逐行浮现 · reveal | `vk-term.reveal`<br>`vk-code.reveal`<br>`vk-asm.reveal`<br>`vk-term.current` | `specimen/vk-term.html` | `tests/shell-dom.test.mjs` | ✅ 绿 |
| 标注 · 连线 arrow | `vk-annotate.shape`<br>`vk-annotate.head`<br>`vk-annotate.dash`<br>`vk-annotate.width` | `specimen/vk-annotate.html` | `tests/annotate.test.mjs` | ✅ 绿 |
| 标注 · 圈选 circle | `vk-annotate.ring`<br>`vk-annotate.double` | `specimen/vk-annotate.html` | `tests/annotate.test.mjs` | ✅ 绿 |
| 标注 · 批注 note | `vk-annotate.note` | `specimen/vk-annotate.html` | `tests/annotate.test.mjs` | ✅ 绿 |
| 标注 · 编号点 badge | `vk-annotate.n` | `specimen/vk-annotate.html` | `tests/annotate.test.mjs` | ✅ 绿 |
| 对照 · 差异框 mark | `vk-compare.mark`<br>`vk-compare.mark-label` | `specimen/vk-compare.html` | `tests/annotate.test.mjs` | ✅ 绿 |
| 字节窗 · 窄容器逐格 | `vk-bytes.cols` | `specimen/vk-bytes.html` | `tests/gaps-six.test.mjs` | ✅ 绿 |
| 步骤条 · 等权地图 | `vk-steps.done`<br>`vk-steps.mark` | `specimen/vk-steps.html` | `tests/gaps-six.test.mjs` | ✅ 绿 |
| 终端 · 无壳不重复标题 | `vk-term.chrome`<br>`vk-term.title-show` | `specimen/vk-term.html` | `tests/gaps-six.test.mjs` | ✅ 绿 |
| 批注 · 显式落点与避让 | `vk-annotate.side` | `specimen/vk-annotate.html` | `tests/gaps-six.test.mjs` | ✅ 绿 |
| 对照 · 差异放大 | `vk-compare.zoom` | `specimen/vk-compare.html` | `tests/gaps-six.test.mjs` | ✅ 绿 |

## 明细

### ✅ 语义淡底 · wash

- 能力：五色各一档极淡底（浅色 + 深色），做分区背景；落在 vk-panel 上时是 plain / raised 的底。
- 契约断言：`vk-panel.tone`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/surfaces.test.mjs` · 「语义淡底：五色 wash 齐全，浅色/深色两套各自成阶」；`tests/panel.test.mjs` · 「vk-panel variant=plain：六种 tone 的底色」

### ✅ 语义淡底 · tint

- 能力：五色各一档稍深的底（浅色 + 深色），做强调块；落在 vk-panel 上时是 inset 的底、也是标题带的高一档。
- 契约断言：`vk-panel.tone`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/surfaces.test.mjs` · 「语义淡底：五色 tint 齐全，比 wash 深、比实色浅」；`tests/panel.test.mjs` · 「vk-panel variant=inset：六种 tone 的底色」

### ✅ vk-panel · plain

- 能力：白纸上一块平的区：靠明度与描边分开，不用第二套材质。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=plain：六种 tone 的底色」

### ✅ vk-panel · raised

- 能力：抬起一档：近白底 + 投影，表示“浮在纸面上的一层”。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=raised：六种 tone 的底色」

### ✅ vk-panel · inset

- 能力：凹下一档：灰底；带 tone 时落到 tint，成为强调块。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=inset：六种 tone 的底色」

### ✅ vk-panel · dark

- 能力：深色块：墨底 + 白字 + 深色 wash/tint；同一套语义色在深色上也成立。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=dark：六种 tone 的底色」

### ✅ vk-panel · 标题带

- 能力：title 生成一条标题带，里面是一个 vk-label；没 title 就不留空带。
- 契约断言：`vk-panel.title`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel：标题带用 vk-label，title 变了就跟着变」

### ✅ 终端 · shell 词法

- 能力：一行 transcript 拆成 prompt / cmd / flag / path / string / num / out / err 并各自上色；认不出就落 out，绝不整行丢色。词法只有一份（src/shared/shell.mjs），构建期与运行期共用；lang="none" 是同一段文本的未上色对照。
- 契约断言：`vk-term.lang`
- 标本页：`_site/specimen/vk-term.html` + 契约宿主 `_site/specimens/vk-term.html`
- 测试：`tests/shell.test.mjs` · 「shell 词法：steps.txt 的 6 行各自成类，命令/参数/路径分开」；`tests/shell-dom.test.mjs` · 「vk-term 上色：命令 / 参数 / 路径 / 输出各自一类，颜色真的不同」

### ✅ 汇编 · 五色 token

- 能力：助记符 / 寄存器 / 立即数 / 地址 / 注释各一色，和终端用同一张语义 token 表（不新增色相）；objdump 的机器码列不会被涂成助记符。契约能探到的是行级视觉（focus / 行底），token 本身由单测与标本页守着。
- 契约断言：`vk-asm.focus`
- 标本页：`_site/specimen/vk-asm.html` + 契约宿主 `_site/specimens/vk-asm.html`
- 测试：`tests/shell.test.mjs` · 「asm 分色：真实 disasm.txt 前 200 行，种类与数量都对得上」；`tests/shell-dom.test.mjs` · 「vk-asm 分色：助记符 / 寄存器 / 立即数 / 地址 / 注释各一色」

### ✅ 逐行浮现 · reveal

- 能力：reveal="all|line|none"：all 是现状整块出现；line 按 at + stagger 逐行浮现（复用 director 的 plan/seek，不新写引擎）；none 整块不参与。current / line 让一行处于 focus，供讲解时指。不是打字机。
- 契约断言：`vk-term.reveal` · `vk-code.reveal` · `vk-asm.reveal` · `vk-term.current`
- 标本页：`_site/specimen/vk-term.html` + 契约宿主 `_site/specimens/vk-term.html`
- 测试：`tests/shell-dom.test.mjs` · 「vk-term reveal="line"：t=0 / 中 / 末三态（复用 director，不是新引擎）」；`tests/shell-dom.test.mjs` · 「reveal="none"：整块不参与出场（at/enter 也不动它）」；`tests/shell-dom.test.mjs` · 「vk-code reveal="line"：代码行也按 at + stagger 逐行浮现」；`tests/shell-dom.test.mjs` · 「vk-term current / line：指哪一行，哪一行整行 focus」

### ✅ 标注 · 连线 arrow

- 能力：mode="arrow"：从一个元素（或 x,y 坐标）指向另一个。shape=straight|ortho|curve 决定走线，dash 决定实虚，width 改线宽，head=arrow|dot|none 决定端点。旧 vk-edge 是它的别名，走线与 13.x 逐像素一致。
- 契约断言：`vk-annotate.shape` · `vk-annotate.head` · `vk-annotate.dash` · `vk-annotate.width`
- 标本页：`_site/specimen/vk-annotate.html` + 契约宿主 `_site/specimens/vk-annotate.html`
- 测试：`tests/annotate.test.mjs` · 「vk-annotate arrow：三种 shape 各走一种路径，实虚/线宽/端点各自生效」；`tests/annotate.test.mjs` · 「旧标签是别名：vk-edge / vk-pin / vk-ring 与 vk-annotate 同几何」

### ✅ 标注 · 圈选 circle

- 能力：mode="circle"：圈出目标，ring=ellipse|rect 决定椭圆或矩形，double 再画一圈内环。旧 vk-ring（含 dim 压暗）是它的别名。
- 契约断言：`vk-annotate.ring` · `vk-annotate.double`
- 标本页：`_site/specimen/vk-annotate.html` + 契约宿主 `_site/specimens/vk-annotate.html`
- 测试：`tests/annotate.test.mjs` · 「vk-annotate circle：椭圆 / 矩形 / 双圈各不相同，且圈住目标」

### ✅ 标注 · 批注 note

- 能力：mode="note"：note=bubble|label|badge 三种写法，都复用 vk-pin 的自动避让（先算四个候选位置，再按压住多少正文排序），所以批注不遮正文。旧 vk-pin 是它的别名。
- 契约断言：`vk-annotate.note`
- 标本页：`_site/specimen/vk-annotate.html` + 契约宿主 `_site/specimens/vk-annotate.html`
- 测试：`tests/annotate.test.mjs` · 「vk-annotate note：泡 / 引线标签 / 编号点三种写法，且不压住正文」

### ✅ 标注 · 编号点 badge

- 能力：mode="badge"：编号点（①②③）钉在任意锚点上，n 是编号。位置由锚点决定，不手摆坐标。
- 契约断言：`vk-annotate.n`
- 标本页：`_site/specimen/vk-annotate.html` + 契约宿主 `_site/specimens/vk-annotate.html`
- 测试：`tests/annotate.test.mjs` · 「vk-annotate badge：编号点钉在任意锚点上，位置跟着锚点走」

### ✅ 对照 · 差异框 mark

- 能力：vk-compare 的 mark 在对照图上标出一处或多处差异：x1,y1,x2,y2（相对百分比，多组用 ;），细框 + 角标；mark-label 一一对应。split 下每处只标在所属的那一半（框心决定 A/B），side/stack 下标在 a 上。
- 契约断言：`vk-compare.mark` · `vk-compare.mark-label`
- 标本页：`_site/specimen/vk-compare.html` + 契约宿主 `_site/specimens/vk-compare.html`
- 测试：`tests/annotate.test.mjs` · 「vk-compare mark：百分比换成像素，split 下只标在所属的一半」；`tests/annotate.test.mjs` · 「vk-compare mark：写错的坐标不画框，也不炸页面」

### ✅ 字节窗 · 窄容器逐格

- 能力：十六进制按单格换行，不再把整行当成一格去量：400px 的窄卡里 8 列照常读，只有连半行都放不下时才报“格太窄”，并给出减少 cols / 关掉 ascii / 换宽容器三条改法。
- 契约断言：`vk-bytes.cols`
- 标本页：`_site/specimen/vk-bytes.html` + 契约宿主 `_site/specimens/vk-bytes.html`
- 测试：`tests/gaps-six.test.mjs` · 「vk-bytes 窄卡片：逐格测量，400px 8 列不报文本超出，200px 报格太窄」

### ✅ 步骤条 · 等权地图

- 能力：done="none" 时不再把 current 之前自动画成绿色对勾，只保留 current（或整页不标）；mark="N" 只强调第 N 步、不给其它步打勾。默认 done="auto" 与旧行为一字不差。
- 契约断言：`vk-steps.done` · `vk-steps.mark`
- 标本页：`_site/specimen/vk-steps.html` + 契约宿主 `_site/specimens/vk-steps.html`
- 测试：`tests/gaps-six.test.mjs` · 「vk-steps done="none"：不标已完成，只有第 3 步是 current；默认行为不变」；`tests/gaps-six.test.mjs` · 「vk-steps mark="N"：只强调第 N 步，不给其它步打勾」

### ✅ 终端 · 无壳不重复标题

- 能力：chrome="none" 时 title 只作无障碍名（aria-label），不再渲染自己的窗头 / 文件名；确实要显示才写 title-show。默认 chrome="min" 的窗头不变。
- 契约断言：`vk-term.chrome` · `vk-term.title-show`
- 标本页：`_site/specimen/vk-term.html` + 契约宿主 `_site/specimens/vk-term.html`
- 测试：`tests/gaps-six.test.mjs` · 「vk-term chrome="none"：title 只作无障碍名，title-show 才显示」

### ✅ 批注 · 显式落点与避让

- 能力：note 新增 side=top|right|bottom|left 与 x/y 坐标；自动选边把目标自身矩形也算成障碍，优先选引线不穿过目标的一侧，实在没有干净位置时说明并选压字最少的一侧。
- 契约断言：`vk-annotate.side`
- 标本页：`_site/specimen/vk-annotate.html` + 契约宿主 `_site/specimens/vk-annotate.html`
- 测试：`tests/gaps-six.test.mjs` · 「vk-annotate note：自动避让不压目标行、引线不穿行；side="bottom" 按指定侧」；`tests/gaps-six.test.mjs` · 「vk-annotate note：四个方向都不干净时警告，并选压字最少的一侧」

### ✅ 对照 · 差异放大

- 能力：zoom="mark" 在对照下方生成差异放大块（默认 ×2）：放大 mark 框住的那块，也可以写 x1,y1,x2,y2 或只写倍数；放大块样式与小标题由组件给，作者不写 CSS。
- 契约断言：`vk-compare.zoom`
- 标本页：`_site/specimen/vk-compare.html` + 契约宿主 `_site/specimens/vk-compare.html`
- 测试：`tests/gaps-six.test.mjs` · 「vk-compare zoom="mark"：生成差异放大块，内容与 mark 区域一致」

## 怎么判红

1. **契约**：`标签.属性` 必须出现在 registry，并且在 `src/effects.mjs` 里有一条
   `on / prop / expect`（内容属性走契约的“改了就变”探针）。motion / pose /
   context / build 这类会被契约跳过的属性不算数。
2. **标本**：`src/scenes/scenes.mjs` 里要有这个标签的场景，构建后
   `_site/specimen/<tag>.html`（人看的标本页）与 `_site/specimens/<tag>.html`
   （契约宿主）都要存在。
3. **测试**：`tests/*.test.mjs` 里真的能按名字找到那条 test（不是只建了文件）。

缺任何一件，脚本逐条打印缺什么并以退出码 1 结束；不会“生成了就算过”。
