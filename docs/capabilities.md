# 能力矩阵

> 由 `tools/capabilities.mjs` 从 `docs/capabilities.json` 生成 —— 不要手改。
> 一条能力必须同时有「契约断言 / 标本页 / 测试」三件；缺一件，状态变红，
> `npm test` 里的 capabilities 组与 `tools/verify.mjs` 都会失败。

记账方式：**能力**是用户能看见的一件事（“有一档淡底”“深色块也能用”），
不是标签。标签会删会改；能力不能悄悄消失。

| 能力 | 契约断言 | 标本页 | 测试 | 状态 ||---|---|---|---|---|
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
| 图标 · 语义白名单（vk-text icon） | `vk-text.icon` | `specimen/vk-text.html` | `tests/merged-six.test.mjs`<br>`tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 preset · 一页一块深色（默认关） | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 preset · 强调色 ≤1（默认关） | `vk-text.tone` | `specimen/vk-text.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 审计 preset · 内容在 120 边距内（默认关） | `vk-page.align` | `specimen/vk-page.html` | `tests/batch-gh.test.mjs` | ✅ 绿 |
| 并置 · vk-pair | `vk-pair.split`<br>`vk-pair.axis`<br>`vk-pair.axis-width`<br>`vk-pair.symbol`<br>`vk-pair.symbol-size`<br>`vk-pair.gap`<br>`vk-pair.orientation` | `specimen/vk-pair.html` | `tests/batch-primitives.test.mjs` | ✅ 绿 |
| 文字 · 塞满一行 fit="width" | `vk-text.fit`<br>`vk-text.fit-min`<br>`vk-text.fit-max` | `specimen/vk-text.html` | `tests/batch-primitives.test.mjs` | ✅ 绿 |
| 归属说明 · vk-label[for] | `vk-label.for`<br>`vk-label.anchor` | `specimen/vk-label.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 代码窗 / 终端 · surface 与当前行 | `vk-term.surface`<br>`vk-code.surface`<br>`vk-term.current`<br>`vk-code.current` | `specimen/vk-term.html` | `tests/batch-primitives.test.mjs` | ✅ 绿 |
| 纸 · 默认底色是纯白 | `vk-page.align` | `specimen/vk-page.html` | `tests/batch-primitives.test.mjs` | ✅ 绿 |
| 流程 · 箭头按块高缩放 + 中轴词 | `vk-flow.arrow-scale`<br>`vk-flow.arrow-label` | `specimen/vk-flow.html` | `tests/batch-native.test.mjs` | ✅ 绿 |
| 标签 · variant="tag" 专门档位 | `vk-label.variant` | `specimen/vk-label.html` | `tests/batch-native.test.mjs` | ✅ 绿 |
| 并置 · 左右分色 tone-a / tone-b | `vk-pair.tone-a`<br>`vk-pair.tone-b` | `specimen/vk-pair.html` | `tests/batch-native.test.mjs` | ✅ 绿 |
| 文字 · fit 的硬地板 fit-min | `vk-text.fit-min` | `specimen/vk-text.html` | `tests/batch-native.test.mjs` | ✅ 绿 |
| 文案 · 字幕短句（项目层 preset，默认关） | `style:copy` | `specimen/vk-text.html` | `tests/batch-native.test.mjs` | ✅ 绿 |
| 文字 · icon 字形 | `vk-text.icon` | `specimen/vk-text.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 面 · 描边环 ring | `vk-box.ring` | `specimen/vk-box.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 标签 · 贴块 for | `vk-label.for` | `specimen/vk-label.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 标签 · 贴块方向 anchor | `vk-label.anchor` | `specimen/vk-label.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 注解 · 气泡 bubble | `vk-note.kind` | `specimen/vk-note.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 分区 · 窗头 chrome | `vk-panel.chrome` | `specimen/vk-panel.html` | `tests/merged-six.test.mjs` | ✅ 绿 |
| 旧名 · 六个标签的转发 | `vk-text.icon`<br>`vk-box.ring`<br>`vk-label.for`<br>`vk-note.kind`<br>`vk-panel.chrome` | `specimen/vk-text.html` | `tests/merged-six.test.mjs`<br>`tests/registry.test.mjs` | ✅ 绿 |

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

- 能力：四档主对比 display 200 / headline 112 / body 56 / caption 48（手机横屏 0.406× 基准）；旧名 label/data/subhead/title 别名到新档，hero 280 / mega 400 是补充档。200px 只有一个来源。
- 契约断言：`vk-text.size`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-ef.test.mjs` · 「四档字号：display / headline / body / caption 的字号与行高」；`tests/batch-ef.test.mjs` · 「旧字号名仍解析到合理档位（label / data / subhead / title / hero / mega）」；`tests/batch-ef.test.mjs` · 「display 在全库唯一：200px 只出现在 --vk-t-display 一处」

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

- 能力：三点直径 compact 12 / normal 16 / hero 20，窗头高度 56 / 72 / 88，点间距与文件名 chip 同步；六个内容组件的窗头共用同一组 --vk-chrome-* 变量，vk-legacy 只改这一组值就能整体回退。
- 契约断言：`vk-code.mass` · `vk-term.mass` · `vk-asm.mass` · `vk-tree.mass` · `vk-bytes.mass` · `vk-diff.mass`
- 标本页：`_site/specimen/vk-code.html` + 契约宿主 `_site/specimens/vk-code.html`
- 测试：`tests/batch-ef.test.mjs` · 「三点直径随 mass 缩放：compact 12 / normal 16 / hero 20」

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
- 测试：`tests/annotate.test.mjs` · 「vk-annotate arrow：三种 shape 各走一种路径，实虚/线宽/端点各自生效」；`tests/annotate.test.mjs` · 「旧标签是别名：vk-edge / vk-pin 与 vk-annotate 同几何；vk-ring 变成带环的面」

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

### ✅ 图标 · 语义白名单（vk-text icon）

- 能力：图标本质是一个字形：<vk-text icon="check"> 里文字与图标共存。语义四类：成立（check / circle-check）、注意（triangle-alert / info）、不成立（x / circle-x）、方向（arrow-up / arrow-down / arrow-right）。白名单外的名字在 vk-text 的 icon 上构建期报错；旧 vk-icon 的装饰图标仍只提醒。
- 契约断言：`vk-text.icon`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-text icon：字形与文字共存，白名单外构建期报错」；`tests/batch-gh.test.mjs` · 「vk-icon 白名单外：构建期只提醒，不再拦构建」

### ✅ 审计 preset · 一页一块深色（默认关）

- 能力：项目层审美 preset（vk check --style / tools/style-preset.mjs 才跑）：深色区域按底色亮度识别（vk-panel variant="dark"、深色终端 / 字节窗、.vk-bg-dark 都算）；一页超过 1 块时报一条。默认不跑——「一页只砸一块重」是版面主张，不是库的要求。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/batch-gh.test.mjs` · 「预设 · 深色块 ≤1：--style 下两块报一条，一块通过」

### ✅ 审计 preset · 强调色 ≤1（默认关）

- 能力：项目层审美 preset（vk check --style 才跑）：统计一页里 tone="focus" 的答案级元素（vk-text / vk-panel），超过 1 处报一条；vk-label / vk-icon 不算强调，err / warn 作为反例/警告不占名额。默认不跑。
- 契约断言：`vk-text.tone`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-gh.test.mjs` · 「预设 · 强调色 ≤1：--style 下两处报一条，第二处 err / warn 不算」

### ✅ 审计 preset · 内容在 120 边距内（默认关）

- 能力：项目层审美 preset（vk check --style 才跑）：交付页（1920×1080、未缩放）的可见元素必须落在 [120, 120, 1800, 960] 内（容差 1px）；覆盖层与出血层豁免。默认不跑——120 是这一集的交付边距，换个项目可以换。
- 契约断言：`vk-page.align`
- 标本页：`_site/specimen/vk-page.html` + 契约宿主 `_site/specimens/vk-page.html`
- 测试：`tests/batch-gh.test.mjs` · 「预设 · 内容落在 120 边距内（--style，覆盖层豁免）」

### ✅ 并置 · vk-pair

- 能力：两块内容左右（或上下）并置，中间一条 1–4px 的轴；split 决定左块占比，axis 可关掉轴，symbol 可在轴中点放 → / = / vs，也可什么都不放。两块宽度和 = 容器宽 - 2×gap，轴在 2×gap 沟槽的正中。
- 契约断言：`vk-pair.split` · `vk-pair.axis` · `vk-pair.axis-width` · `vk-pair.symbol` · `vk-pair.symbol-size` · `vk-pair.gap` · `vk-pair.orientation`
- 标本页：`_site/specimen/vk-pair.html` + 契约宿主 `_site/specimens/vk-pair.html`
- 测试：`tests/batch-primitives.test.mjs` · 「vk-pair：两块并置、轴居中、split=30 比例正确、symbol 在轴中点」；`tests/batch-primitives.test.mjs` · 「vk-pair：symbol 的三种写法都出现，axis="none" 只剩空轴」

### ✅ 文字 · 塞满一行 fit="width"

- 能力：单行等宽文本按容器宽度自动缩放字号：fit="width" 时这一行恰好填满容器（测到差 ≤2px），fit-min / fit-max 是上下边界，fit-max 优先。不写 fit 时字号仍只由 size 档决定。
- 契约断言：`vk-text.fit` · `vk-text.fit-min` · `vk-text.fit-max`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-primitives.test.mjs` · 「vk-text fit="width"：780px 容器差 ≤2px，fit-max 封顶」

### ✅ 归属说明 · vk-label[for]

- 能力：「你写的 / 编译器给的」这种归属说明：给 vk-label 写 for，它就贴在目标块上方（anchor="above"）或下方（anchor="below"），左边界对齐目标块的首字符（不是容器左边），字号 caption、墨阶 secondary，不占正文布局。旧标签 vk-caption 保留为别名。
- 契约断言：`vk-label.for` · `vk-label.anchor`
- 标本页：`_site/specimen/vk-label.html` + 契约宿主 `_site/specimens/vk-label.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-label for：贴块说明的左边界对齐目标首字符」；`tests/merged-six.test.mjs` · 「vk-label anchor：above / below 换方向」

### ✅ 代码窗 / 终端 · surface 与当前行

- 能力：surface="paper|dark|inset" 换的是整组窗材质变量：dark 是真正的深色底 + 反白文字，窗头、行号、语法、提示符、结果行一起适配；current 指的那一行在深色底上用更亮的蓝，不与该表面打架。
- 契约断言：`vk-term.surface` · `vk-code.surface` · `vk-term.current` · `vk-code.current`
- 标本页：`_site/specimen/vk-term.html` + 契约宿主 `_site/specimens/vk-term.html`
- 测试：`tests/batch-primitives.test.mjs` · 「vk-term / vk-code surface="dark"：反白底 + current 高亮同时成立」

### ✅ 纸 · 默认底色是纯白

- 能力：库的默认页面底色就是 #fff：html / body 与 vk-page 宿主、内层画布都是纯白，不把任何项目级 tint 当默认。项目层要灰底自己写（unlayered 作者样式永远压过库的层）。
- 契约断言：`vk-page.align`
- 标本页：`_site/specimen/vk-page.html` + 契约宿主 `_site/specimens/vk-page.html`
- 测试：`tests/batch-primitives.test.mjs` · 「vk-page / body：空文档里的默认底色是纯白」

### ✅ 流程 · 箭头按块高缩放 + 中轴词

- 能力：vk-flow 的箭头不再是固定 14px 三角：尺寸 = 容器高 × arrow-scale（默认 0.12），夹在 28–64px；线宽 = 尺寸 × 0.1（最小 2px）。arrow 默认开，arrow="false" 才关。arrow-label 会在中轴那根箭头上挂一个词，字号 = caption × 0.75（36），纸色底把轴线垫断。
- 契约断言：`vk-flow.arrow-scale` · `vk-flow.arrow-label`
- 标本页：`_site/specimen/vk-flow.html` + 契约宿主 `_site/specimens/vk-flow.html`
- 测试：`tests/batch-native.test.mjs` · 「vk-flow 箭头：默认画，尺寸 = 容器高 × arrow-scale（28–64），线宽 = 尺寸 × 0.1」；`tests/batch-native.test.mjs` · 「vk-flow arrow-label：中轴挂词，字号 36（caption × 0.75），纸色底垫断轴线」

### ✅ 标签 · variant="tag" 专门档位

- 能力：vk-label 新增 tag 形态：36px（caption 的 0.75）、letter-spacing .08em、颜色按 tone，不加底、不加框。vk-flow 的步骤标签统一用它，不再用 caption 48 的裸 span。tag 有自己的地板（caption × 0.75），不按正文 body 判。
- 契约断言：`vk-label.variant`
- 标本页：`_site/specimen/vk-label.html` + 契约宿主 `_site/specimens/vk-label.html`
- 测试：`tests/batch-native.test.mjs` · 「vk-label variant="tag"：36px / .08em / 无底无框，tone 决定颜色」

### ✅ 并置 · 左右分色 tone-a / tone-b

- 能力：vk-pair 的左右两块可以各自上一种语义色：wash 底 + 1px 同色系 tint 描边（info / focus / ok / warn / err / neutral）。不写 tone-a / tone-b 时不加底、不加框、不加内距，旧页逐像素不变。
- 契约断言：`vk-pair.tone-a` · `vk-pair.tone-b`
- 标本页：`_site/specimen/vk-pair.html` + 契约宿主 `_site/specimens/vk-pair.html`
- 测试：`tests/batch-native.test.mjs` · 「vk-pair tone-a / tone-b：左右分色 wash + 1px 同色描边；不写不改现状」

### ✅ 文字 · fit 的硬地板 fit-min

- 能力：vk-text fit="width" 的 fit-min 默认 40，是硬地板：容器再窄也不再缩字。到了地板仍放不下时，宿主带 data-fit-overflow，运行期提醒「容器太窄，建议减少并列块或换竖排」。不写 fit-min 时字号也不会掉到 40 以下。
- 契约断言：`vk-text.fit-min`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-native.test.mjs` · 「vk-text fit="width"：fit-min 是硬地板，放不下加 data-fit-overflow 并提醒」

### ✅ 文案 · 字幕短句（项目层 preset，默认关）

- 能力：项目层 --style preset 的 copy 规则（level=warn，默认不启用）：字幕位（vk-text size="caption" / vk-label[for]（原 vk-caption））不带句号、每行 ≤18 字。正文段落不按字幕判；规则清单在 STYLE_RULES，文档在 docs/style-preset.md，项目写法见 film.css。
- 契约断言：`style:copy`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/batch-native.test.mjs` · 「预设 · 字幕短句：句号 / 超 18 字报提醒（level=warn，默认不跑）」

### ✅ 文字 · icon 字形

- 能力：图标是一个字形，并进 vk-text：icon="check" 写在文字前面，文字与图标共存；四档字号与墨阶仍然只由 vk-text 决定。旧 vk-icon 转发到同一段内联实现。
- 契约断言：`vk-text.icon`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-text icon：字形与文字共存，白名单外构建期报错」

### ✅ 面 · 描边环 ring

- 能力：vk-box 的 ring 是一圈不占布局的描边强调（box-shadow），环色跟 tone、默认焦点色；加不加环，邻居的位置与尺寸都不变。旧 vk-ring 转发到这条描边。
- 契约断言：`vk-box.ring`
- 标本页：`_site/specimen/vk-box.html` + 契约宿主 `_site/specimens/vk-box.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-box ring：描边环不占布局，tone 换环色」

### ✅ 标签 · 贴块 for

- 能力：vk-label 写 for 就变成归属说明：位置由目标块决定，左边界对齐目标块的首字符；不写 for 仍是块里的一枚标签。旧 vk-caption 转发到这里。
- 契约断言：`vk-label.for`
- 标本页：`_site/specimen/vk-label.html` + 契约宿主 `_site/specimens/vk-label.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-label for：贴块说明的左边界对齐目标首字符」

### ✅ 标签 · 贴块方向 anchor

- 能力：anchor="above"（默认）贴在目标块上方，anchor="below" 贴在下方；净空 16px，方向落在宿主的 data-anchor 上。
- 契约断言：`vk-label.anchor`
- 标本页：`_site/specimen/vk-label.html` + 契约宿主 `_site/specimens/vk-label.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-label anchor：above / below 换方向」

### ✅ 注解 · 气泡 bubble

- 能力：vk-note kind="bubble" 是原来的批注泡：气泡 + 引线绑到任意锚点，自动避让正文；w / n / tone / emphasis / size / leader / gap-px / x / y 与旧 vk-pin 同名同义。
- 契约断言：`vk-note.kind`
- 标本页：`_site/specimen/vk-note.html` + 契约宿主 `_site/specimens/vk-note.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-note kind="bubble"：泡 + 引线与旧 vk-pin 同几何」

### ✅ 分区 · 窗头 chrome

- 能力：vk-panel chrome="dots" 长出三点窗头与标题带（默认 none 仍是干净分区）；窗头高 / 三点尺寸读窗自己的令牌，与 code / term / diff 同一张表。旧 vk-window 转发到这里。
- 契约断言：`vk-panel.chrome`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/merged-six.test.mjs` · 「vk-panel chrome="dots"：三点窗头与标题带」

### ✅ 旧名 · 六个标签的转发

- 能力：vk-icon → vk-text、vk-rule → vk-box、vk-caption → vk-label、vk-pin → vk-note、vk-ring → vk-box、vk-window → vk-panel。旧标签继续可用（同名自定义元素、同一套 DOM），构建期给一条"已合并到 X，旧名保留"的提示；标签清单里不再单列。
- 契约断言：`vk-text.icon` · `vk-box.ring` · `vk-label.for` · `vk-note.kind` · `vk-panel.chrome`
- 标本页：`_site/specimen/vk-text.html` + 契约宿主 `_site/specimens/vk-text.html`
- 测试：`tests/merged-six.test.mjs` · 「六个旧标签是别名：转发到新标签并给一条构建期提示」；`tests/registry.test.mjs` · 「别名只转发到一个公开标签，且不在清单里单列」

## 怎么判红

1. **契约**：`标签.属性` 必须出现在 registry，并且在 `src/effects.mjs` 里有一条
   `on / prop / expect`（内容属性走契约的“改了就变”探针）。motion / pose /
   context / build 这类会被契约跳过的属性不算数。
2. **标本**：`src/scenes/scenes.mjs` 里要有这个标签的场景，构建后
   `_site/specimen/<tag>.html`（人看的标本页）与 `_site/specimens/<tag>.html`
   （契约宿主）都要存在。
3. **测试**：`tests/*.test.mjs` 里真的能按名字找到那条 test（不是只建了文件）。

缺任何一件，脚本逐条打印缺什么并以退出码 1 结束；不会“生成了就算过”。
