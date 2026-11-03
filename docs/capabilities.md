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
| vk-panel · plain（默认无框无底） | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs`<br>`tests/batch-ef.test.mjs` | ✅ 绿 |
| 版式 · 四档字号 | `vk-text.size` | `specimen/vk-text.html` | `tests/batch-ef.test.mjs` | ✅ 绿 |
| 版式 · 网格与版心 | `vk-grid.cols`<br>`vk-grid.gap` | `specimen/vk-grid.html` | `tests/batch-ef.test.mjs` | ✅ 绿 |
| 组件 · 内容组件默认窗头 | `vk-code.chrome`<br>`vk-term.chrome`<br>`vk-asm.chrome`<br>`vk-tree.chrome`<br>`vk-bytes.chrome`<br>`vk-diff.chrome` | `specimen/vk-code.html` | `tests/batch-ef.test.mjs` | ✅ 绿 |
| 组件 · 三点随 mass 缩放 | `vk-code.mass`<br>`vk-term.mass`<br>`vk-asm.mass`<br>`vk-tree.mass`<br>`vk-bytes.mass`<br>`vk-diff.mass` | `specimen/vk-code.html` | `tests/batch-ef.test.mjs` | ✅ 绿 |
| 页眉 · 工序进度 kicker | `vk-label.index`<br>`vk-label.total`<br>`vk-label.section` | `specimen/vk-label.html` | `tests/batch-ef.test.mjs` | ✅ 绿 |
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
| 注解 · 边注 margin | `vk-note.kind`<br>`vk-note.side`<br>`vk-note.leader`<br>`vk-note.w`<br>`vk-note.for` | `specimen/vk-note.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 注解 · 编号图例 legend | `vk-note.kind`<br>`vk-note.place` | `specimen/vk-note.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 图标 · 语义白名单 | `vk-icon.name` | `specimen/vk-icon.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 · 一页一块深色 | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 · 强调色 ≤1 | `vk-text.tone` | `specimen/vk-text.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 · 内容在 120 边距内 | `vk-page.align` | `specimen/vk-page.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |

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

### ✅ vk-panel · plain（默认无框无底）

- 能力：plain 是默认形态：透明、无边框，只是一块版面区域；底色与描边只在显式 tone / border（或 raised / inset / dark）时出现。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=plain：六种 tone 的底色」；`tests/batch-ef.test.mjs` · 「vk-panel plain 默认无框无底，tone 才有 wash」

### ✅ 版式 · 四档字号

- 能力：四档主对比 display 160 / headline 96 / body 40 / caption 28；旧名 label/data/subhead/title 别名到新档，hero/mega 保留为补充档。160px 只有一个来源。
- 契约断言：`vk-text.size`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-ef.test.mjs` · 「四档字号：display / headline / body / caption 的字号与行高」；`tests/batch-ef.test.mjs` · 「旧字号名仍解析到合理档位（label / data / subhead / title / hero / mega）」；`tests/batch-ef.test.mjs` · 「display 在全库唯一：160px 只出现在 --vk-t-display 一处」

### ✅ 版式 · 网格与版心

- 能力：--vk-grid-cols 12 / --vk-grid-gutter 32 / --vk-margin 120；vk-grid cols="12" 在 1680 版心里每栏 = (1680 - 11×32)/12；.vk-frame 是最宽 1680 的版心列。
- 契约断言：`vk-grid.cols` · `vk-grid.gap`
- 标本页：`_site/specimen/vk-grid.html` + 契约宿主 `_site/specimens/vk-grid.html`
- 测试：`tests/batch-ef.test.mjs` · 「vk-grid cols="12"：每栏宽 = (1680 - 11 × 32) / 12」；`tests/batch-ef.test.mjs` · 「版心：vk-page 内距 120，.vk-frame 宽 1680」

### ✅ 组件 · 内容组件默认窗头

- 能力：vk-term / vk-code / vk-asm / vk-tree / vk-bytes / vk-diff 默认都有三点 + 文件名/来源；chrome="none" 仍可用，但构建期提醒放到提供上下文的容器（如 vk-panel 的 title）。vk-panel 永不带三点。
- 契约断言：`vk-code.chrome` · `vk-term.chrome` · `vk-asm.chrome` · `vk-tree.chrome` · `vk-bytes.chrome` · `vk-diff.chrome`
- 标本页：`_site/specimen/vk-code.html` + 契约宿主 `_site/specimens/vk-code.html`
- 测试：`tests/batch-ef.test.mjs` · 「六个内容组件默认都有三点窗头，vk-panel 没有」；`tests/batch-ef.test.mjs` · 「chrome="none" 构建期提醒放到有上下文的容器里」

### ✅ 组件 · 三点随 mass 缩放

- 能力：三点直径 compact 8 / normal 12 / hero 16，窗头高度 40 / 56 / 72，点间距同步；六个内容组件的窗头共用同一组 --vk-chrome-* 变量。
- 契约断言：`vk-code.mass` · `vk-term.mass` · `vk-asm.mass` · `vk-tree.mass` · `vk-bytes.mass` · `vk-diff.mass`
- 标本页：`_site/specimen/vk-code.html` + 契约宿主 `_site/specimens/vk-code.html`
- 测试：`tests/batch-ef.test.mjs` · 「三点直径随 mass 缩放：compact 8 / normal 12 / hero 16」

### ✅ 页眉 · 工序进度 kicker

- 能力：vk-label variant="kicker" 写 index / total / section 时渲染成「工序 3/5 · 汇编」，左侧 4px 焦点色条，caption 档 28px；index/total 是整条流程的位置，不是页号。文本里出现文件名或「第 N 页/N 帧」时构建期提醒。
- 契约断言：`vk-label.index` · `vk-label.total` · `vk-label.section`
- 标本页：`_site/specimen/vk-label.html` + 契约宿主 `_site/specimens/vk-label.html`
- 测试：`tests/batch-ef.test.mjs` · 「vk-kicker 工序进度：工序 3/5 · 汇编，色条 4px」；`tests/batch-ef.test.mjs` · 「kicker 含文件名 / 页号时构建期给出提醒」

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

### ✅ 注解 · 边注 margin

- 能力：kind="margin"：一条 1px 细线从目标引出，文字落在栏间空白里，首行与目标正文同基线；side 自动选有空间的一侧，leader="dot" 在目标端加一枚小圆点。文字固定 caption（28）/ ink secondary，没有泡、没有底、没有箭头。
- 契约断言：`vk-note.kind` · `vk-note.side` · `vk-note.leader` · `vk-note.w` · `vk-note.for`
- 标本页：`_site/specimen/vk-note.html` + 契约宿主 `_site/specimens/vk-note.html`
- 测试：`tests/batch-gh.test.mjs` · 「vk-note kind="margin"：1px 细线、文字 caption、与目标正文同基线」；`tests/batch-gh.test.mjs` · 「vk-note 自动选边：有空间的一侧才放文字，显式 side 按指定侧」；`tests/batch-gh.test.mjs` · 「vk-note leader="dot"：细线 + 目标端圆点，没有箭头」

### ✅ 注解 · 编号图例 legend

- 能力：kind="legend"：每个目标角上一枚编号点（1 / 2 / 3），页角给一张编号 + 说明的图例表；place=br / bl / bottom 决定表落在哪一角。编号按 <li> 的顺序一一对应，构建期校验目标数与条目数相同。
- 契约断言：`vk-note.kind` · `vk-note.place`
- 标本页：`_site/specimen/vk-note.html` + 契约宿主 `_site/specimens/vk-note.html`
- 测试：`tests/batch-gh.test.mjs` · 「vk-note kind="legend"：编号点钉在目标右上角，页角图例表编号对齐」；`tests/batch-gh.test.mjs` · 「vk-note：构建期找不到目标 / 缺 for / 条目数对不上时直接报错」

### ✅ 图标 · 语义白名单

- 能力：vk-icon 只表达四类意思：成立（check / circle-check）、注意（triangle-alert / info）、不成立（x / circle-x）、方向（arrow-up / arrow-down / arrow-right）。白名单外的名字构建期报错并列出可用名；运行期 audit 再兜一层。
- 契约断言：`vk-icon.name`
- 标本页：`_site/specimen/vk-icon.html` + 契约宿主 `_site/specimens/vk-icon.html`
- 测试：`tests/batch-gh.test.mjs` · 「vk-icon 白名单：名字在内通过，在外构建期报错并列出可用名」

### ✅ 审计 · 一页一块深色

- 能力：深色区域按底色亮度识别（vk-panel variant="dark"、深色终端 / 字节窗、.vk-bg-dark 都算）；一页超过 1 块时 audit 报错：一页最多一块深色区域，它应该是本页唯一的"重"。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/batch-gh.test.mjs` · 「审计 · 深色块 ≤1：两块报错，一块通过」

### ✅ 审计 · 强调色 ≤1

- 能力：统计一页里 tone="focus" 的答案级元素（vk-text / vk-panel），超过 1 处报错；vk-label / vk-icon 不算强调，err / warn 作为反例/警告不占名额。
- 契约断言：`vk-text.tone`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-gh.test.mjs` · 「审计 · 强调色 ≤1：两处 tone="focus" 报错，第二处 err / warn 不算」

### ✅ 审计 · 内容在 120 边距内

- 能力：交付页（1920×1080、未缩放）的所有可见元素必须落在 [120, 120, 1800, 960] 内（容差 1px）；覆盖层（annotate / ring / edge / note）与出血层豁免。
- 契约断言：`vk-page.align`
- 标本页：`_site/specimen/vk-page.html` + 契约宿主 `_site/specimens/vk-page.html`
- 测试：`tests/batch-gh.test.mjs` · 「审计 · 内容必须在 120 边距内（覆盖层豁免）」

## 怎么判红

1. **契约**：`标签.属性` 必须出现在 registry，并且在 `src/effects.mjs` 里有一条
   `on / prop / expect`（内容属性走契约的“改了就变”探针）。motion / pose /
   context / build 这类会被契约跳过的属性不算数。
2. **标本**：`src/scenes/scenes.mjs` 里要有这个标签的场景，构建后
   `_site/specimen/<tag>.html`（人看的标本页）与 `_site/specimens/<tag>.html`
   （契约宿主）都要存在。
3. **测试**：`tests/*.test.mjs` 里真的能按名字找到那条 test（不是只建了文件）。

缺任何一件，脚本逐条打印缺什么并以退出码 1 结束；不会“生成了就算过”。
