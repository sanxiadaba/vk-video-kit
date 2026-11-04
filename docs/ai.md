# vk 作者手册（写给 AI）

> 这是一个通用组件库：每个标签只负责一种编程数据的形状。
> 页面怎么排、拿它讲什么，是调用方的事；库不提供模板、配方或“该怎么组合”的建议。

属性细节在 [`docs/reference.md`](reference.md)；**速查表在文末，由 registry 生成，不要手改。**

---

## 1 · 组件自己成立

```html
<vk-code src="code/hello.c" lines="4-6" current="5"></vk-code>
```

- 从任意一个标签开始，不需要先搭 `vk-page`。
- 块级组件默认填满父容器；`vk-text` 例外，默认按字号取行宽（body 25 字 → 1400px），要铺满写 `measure="none"`。要分栏用 `vk-grid` + 子项 `span`，要撑满用 `fill`。像素 `w` / `h` 只在 `vk-canvas` 的子节点里合法，写别处会在构建期报错。行内件（`icon` / `tag` / `mark` / `keys`）按内容宽。
- **只有一种材质：白纸。** 没有深色主题、深色代码窗、反色卡片；层次靠纸的明度（`sf-0..4`）与 `vk-panel` 的四档表面 / 语义淡底，不靠第二种材质。
- 没有播放器、时间轴、逐行淡入；静止帧就是成品。

## 2 · 字号与颜色

1. 字阶四档（手机横屏基准，1920 实际渲染 ≈780 / 0.406×）：`caption 48` · `body 56` · `headline 112` · `display 200`。`display` 一页最多一次，只给「本页唯一的答案」；`headline` 是标题；`body` 是正文与数据；`caption` 是标签、单位、脚注。旧名（`label` / `data` / `subhead` / `title`）别名到新档，`hero` 280 / `mega` 400 是「一个数字 / 一个词当家」的补充档，一帧最多一个。
2. 要读懂的内容用 56；元数据、标签、密集 ASCII 数据用 48（`data-meta` 标记），任何可读文字不低于 48（`vk-legacy` 旧页按旧地板 28 / 40 / 96）。
3. 钴蓝只有一个含义：**正在讲这里**。它不做语法色——关键字与数字都是墨色 600，字符串是绿的。
4. 语义色（对 / 错 / 注意）只出现在色条、底色、图标上，不写正文。
5. 注意力只有一套词：`act` × `strength`。

   | act | 写在哪 | 效果 |
   |---|---|---|
   | `focus` | 行 / 格子 / 块 | 行：16% 钴蓝底 + 4px 左条；块（数字、标题、正文、引文）：钴蓝 ink |
   | `context` | 容器 | 兄弟退后（`dim` 默认 0.28），不画白幕、不画描边 |
   | `mark` | 行 / 格子 | 石墨底 + 石墨左条——标注，不是「正在讲」 |
   | `trace` | `<vk-annotate mode="arrow">` | 关系线，可带箭头 |
   | `badge` | `<vk-annotate mode="note">` | 编号批注 + 引线 |
   | `compare` | `<vk-diff>` | 对照 |

   `strength` 只改响度：`solid`（默认）/ `soft` / `ghost`。
   元素上只能写 `focus` / `context` / `mark`——`trace` / `badge` / `compare` 是关系组件自带的动作，
   写在 `<li>` 或 `<vk-text>` 上构建期会报错并告诉你该用哪个组件。

## 3 · 内容入口

| 数据 | 写法 |
|---|---|
| 真实文件 | `src="code/hello.c"` + `lines="1-8"` |
| 内联源码 | `<script type="text/plain" data-vk-source>…</script>` |
| 结构化子节点 | `<li value label>` / `<li from to label>` / `<table><tr>` |

`src` 与内联块只能有一个。批注与圈选只做覆盖层，用 `for="#id@part:arg"` 指目标。

**子节点优先。** 一维以上的内容一律写成子节点，字符串属性只留"一个值"的场合（`addr` / `title` / `name` / `src`）。

- `vk-cells`：一格一个 `<li value label>`，状态写在格子上（`state="mark"` / `state="err"` / `filled`），`span` 是跨几格；超过 `cols` 自动换行——多行就是这样成立的。
- `vk-bits`：字段写成 `<li from="30" to="23" label="指数">`；一行位串仍是 `value`。
- `vk-bars` / `vk-timeline`：`<li value label>` / `<li date label lane>`。`vk-bars` 的负值自动落在零线左边，值域不需要手写 `min`。`vk-table` 的合并单元格用原生 `colspan` / `rowspan`，不用额外属性。

## 4 · 锚点

`for` / `from` / `to` 支持 CSS 选择器，或 `#id@part:arg`。

**几何锚点**（任何有盒子的标签都能用，百分比相对目标自己的盒子）：

| part | arg | 例 |
|---|---|---|
| `point` | `x%,y%` | `#code@point:100%,50%`（右边缘中点） |
| `side` | `top` / `right` / `bottom` / `left` | `#buf@side:right` |
| `region` | `x%,y%,w%,h%` | `#cells@region:10%,0%,40%,100%` |

**数据锚点**（由组件内容决定，0 起，源码行除外）：

| part | 用在 | arg |
|---|---|---|
| `line` / `char` | `code` / `diff` / `asm` | 源文件行号；列从 0 起，左闭右开 |
| `cell` | `cells` / `table` | 下标或 `行,列`，从 0 起 |
| `byte` | `cells` / `bytes` | 偏移，从 0 起 |
| `bit` / `field` | `bits` | 位下标 / 字段下标，从 0 起 |
| `addr` | `asm` | 指令地址 |
| `row` / `node` / `item` | `table` / `tree` / `list` | 见组件 |
| `step` | `steps` | 从 0 起 |
| `event` / `lane` | `timeline` | 排序后事件下标（0 起）/ 泳道名 |

多个目标用分号隔开（`for="#a@side:right;#b@point:0%,50%"`），因为 region 的参数自己用逗号。

几何锚点写在哪就是哪：`vk-annotate` / `vk-edge` 不再把端点从圆角附近推开，`@side` 还会替连线决定出线方向。

写错会在 `vk build` 报错。

### 关系件各回答一个问题

**能由组件内置状态说清的，不用覆盖层。** `current` / `state="mark"` / `state="err"` 已经是"这里"的答案；覆盖层只补组件没有的东西。

关系层：`<vk-annotate>` 的 `mode` 决定它回答哪个问题；`<vk-note>` 负责"排进版面的注解"
（边注 / 气泡 / 编号图例）。
旧标签 `vk-edge` 是 `vk-annotate` 的别名（`mode="arrow"`）；`vk-pin` 是 `vk-note variant="bubble"`
的别名；`vk-ring` 是 `vk-box ring` / `vk-annotate mode="circle"` 的旧名。
它们继续可用；构建期会给一条迁移提示。

| 形态 | 它回答 | 不该用来 |
|---|---|---|
| `mode="arrow"` | 两个**物件**之间有关系（指针 → 内存） | 表达"这行写了那格"——那是叙述，口播或字幕就够了 |
| `mode="circle"` | 组件没有内置状态，但你要指一片区域 | 组件已经 `state="err"` / `state="mark"` 时再圈一遍 |
| `mode="badge"` | 这是第几个点（①②③） | 当"强调"用；强调是 `tone` 和字号的事 |
| `mode="note"` | 一句话钉在一个点上 | 复述标题或副题；一句话一个点 |
| `vk-ring variant="dim"`（旧别名） | 这一屏只留一个目标 | 当"强调"用 |

一个信号只用一种机制。两个叠在一起，观众要判断"它们是不是在说同一件事"，这个判断本身与讲解无关。

## 5 · 命令

```bash
node bin/vk.mjs brief           # 契约摘要：属性 / 子节点 / 状态
node bin/vk.mjs build page.html # 预编译 + 校验；增量缓存
node bin/vk.mjs build . --force # 忽略缓存
node bin/vk.mjs check page.html # 结构自检；有错退出码 1
node bin/vk.mjs check a.html b.html # 多页共用一个浏览器
node bin/vk.mjs shot page.html  # 1920×1080 诊断图；--strict 遇 error 删图
node bin/vk.mjs tags            # 全部标签（数字从 registry 取，不写死）
node bin/vk.mjs doc vk-code     # 属性 / 枚举 / 默认值；--all 带布局协议
node bin/vk.mjs icons arrow     # 搜图标名
```

`vk build` 的报错是给作者改的；`vk check` 查字号、对比度、安全区、溢出、裁切、重叠、空锚点。

## 6 · 列头

`vk-asm` 的地址/机器码/指令/操作数是通用结构列头，可用 `address-label` / `bytes-label` / `mnemonic-label` / `operands-label` 覆盖；`labels="none"` 整体隐藏。其他组件的表头由作者内容决定。

## 7 · 手动开启的东西

默认只给结构；这些不自动出现：

- `vk-bits` 的位序号与字段说明；
- `vk-figure` 的裁切标签；
- `vk-box` 的描边环（写 `ring`）与 `vk-annotate mode="circle"` 的形态；
- `vk-asm` 的执行顺序 / 屏障（写 `order` / `fence="after:4,label:编译器屏障"` 才有）。

---

## 组件速查

<!-- vk:tags:start -->
### L1 原子 · 屏幕上真实存在的单个物件

- **`vk-box`** · 面 — 一个面：背景、描边、圆角、内距。不认识兄弟，不排别人。
  - 属性：`surface` · `tone` · `pad` · `radius` · `border` · `ring` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 例：`<vk-box border="hair" radius="xl" pad="lg" surface="paper">`
- **`vk-panel`** · 分区 — 一块内容分区：底色、可选标题带、内距、圆角；chrome="dots" 会长出窗头，于是它也能当窗用。它只描述这一块，不认识兄弟、不排别人；排布归 vk-stack / vk-grid。
  - 属性：`tone` · `variant` · `title` · `chrome` · `fill` · `pad` · `radius` · `border` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `surface`
  - 例：`<vk-panel variant="plain" title="白纸">`
- **`vk-text`** · 文字 — 一段文字：字阶、字重、墨阶、等宽、对齐、测量宽；可带一个语义图标（文字与图标共存）。
  - 属性：`size` · `weight` · `mono` · `align` · `format` · `fit` · `fit-min` · `fit-max` · `icon` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `ink` · `tone`
  - 例：`<vk-text size="body" measure="body">52,980 字节：hello.c 经 gcc -E 把 stdio.h 抄进来。</vk-text>`
- **`vk-label`** · 标签 — 一行小字：分类、进度、状态。四种墨阶 + 五种语义色，三种形态（kicker / chip / badge），可带一个图标；写 for 就贴到目标块上（原 vk-caption）。
  - 属性：`variant` · `tone` · `ink` · `counter` · `section` · `icon` · `for` · `side` · `gap`
  - 例：`<vk-label variant="kicker" counter="3/4" section="汇编">汇编</vk-label>`
- **`vk-inline`** · 行内 — 行内文字：代码、公式、上下标、链接。字号跟随所在文本行。
  - 属性：`variant` · `href`
  - 例：`<vk-inline variant="code">s[0]</vk-inline>`
- **`vk-img`** · 图片 — 一张图：比例、填充方式、焦点。加载失败有可见占位。
  - 属性：`src` · `alt` · `ratio` · `fill` · `radius` · `border` · `position`
  - 例：`<vk-img fill="contain" src="../assets/hello/o0.png" alt="gcc -O0 编出的 hello.c 反汇编" radius="xl">`

### L2 排布 · 只决定在哪、多大

- **`vk-stack`** · 竖排 — 纵向节奏。只给间距和对齐，不画任何东西。默认等距；写 weights="1 2 1" 时按权重分剩余高度（ratio 是它的别名）。
  - 属性：`gap` · `direction` · `align` · `justify` · `wrap` · `weights` · `ratio` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 例：`<vk-stack gap="md" align="center" wrap>`
- **`vk-grid`** · 网格 — 分份容器。cols/rows 切几份，子项用 span 占几份；行高按内容。
  - 属性：`cols` · `tracks` · `rows` · `gap` · `align` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `justify`
  - 例：`<vk-grid cols="3" gap="sm">`
- **`vk-layer`** · 叠层 — 叠放容器：第一个子元素铺满当底，其余按顺序绝对定位叠在上面；vk-text 放在最上面时默认加纸色描边（readable="off" 关），surface 给这一层上五档底色。
  - 属性：`surface` · `tone` · `fill` · `readable` · `grow`
  - 例：`<vk-layer surface="wash">`
- **`vk-pair`** · 并置 — 两块并置对照：左右（或上下）两块，中间一条轴；轴上可放 → / = / vs，也可只留一条线。tone="左,右" 可给两侧各上一种语义淡底。
  - 属性：`split` · `axis` · `axis-width` · `symbol` · `size` · `gap` · `direction` · `tone` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 例：`<vk-pair split="50" gap="96" axis="none" symbol="→" size="96">`
- **`vk-flow`** · 流程 — 多步流程：每步一块（上方小标签 + 内容块），等宽排开，块之间画箭头；gap 控制步距（默认 48），箭头尺寸 = 容器高 × scale（arrow="true,scale:0.12"，夹在 28–64），容器窄于 1100px 自动竖排。
  - 属性：`gap` · `arrow` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：条目写成 `<li>`
  - 例：`<vk-flow arrow="true,label:gcc" gap="48">`
- **`vk-canvas`** · 坐标画布 — 坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。
  - 属性：`w` · `h` · `pad` · `grid` · `overflow`
  - 例：`<vk-canvas w="1200" h="540">`

### L3 器械 · 渲染一种编程数据的形状

- **`vk-list`** · 列表 — 列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。
  - 属性：`rule` · `bare` · `gap` · `mass` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `variant`
  - 子节点：条目写成 `<li>`
  - 状态：`state="ok|warn|err"`（item）
  - 例：`<vk-list gap="md">`
- **`vk-code`** · 代码窗 — 代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮；reveal="line" 逐行浮现。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `focus` · `fold` · `omit` · `fold-note` · `chrome` · `mark` · `columns` · `mass` · `size` · `fit` · `surface` · `reveal` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `long`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-8" current="4" mass="hero">`
- **`vk-term`** · 终端 — 终端。src 指向真实 transcript；命令 / 参数 / 路径 / 输出 / 报错各自一色；逐行浮现。
  - 属性：`src` · `lines` · `title` · `prompt` · `marks` · `lang` · `current` · `reveal` · `chrome` · `title-show` · `mass` · `size` · `fit` · `surface` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-term title="hello · gcc 四步" prompt="$" lang="sh" reveal="line" at="0.1" stagger="0.3" surface="dark" current="6" src="../assets/hello/build/steps.txt">`
- **`vk-diff`** · 对比 — 对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。
  - 属性：`mass` · `lang` · `src` · `lines` · `file` · `chrome` · `columns` · `size` · `fit` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `variant`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-diff lang="c" file="bounds.c" src="../code/real.diff">`
- **`vk-table`** · 表格 — 表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr state="mark"> 标出重点。
  - 属性：`variant` · `stripe` · `mono` · `mass` · `size` · `fit` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：内容包在 `<table>` 里
  - 状态：`state="current|mark|ok|warn|err"`（row / cell）
  - 例：`<vk-table variant="ledger">`
- **`vk-math`** · 公式 — 公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。
  - 属性：`src` · `display` · `size` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-math display size="subhead" src="../code/formula.tex">`
- **`vk-compare`** · 对照 — 前后对照：mode="split"（默认）时左边 split% 显示 labels 的第一张、右边显示第二张（labels="a,b"），上面那张按 split 裁掉右侧；mode="side" 左右并排、mode="stack" 上下排列，两张图各自完整、都不裁切。角标接在竖线后（labels="a,b|左|右"），默认叠在图上（label-position="inside"）；label-position="top" 会为角标单独让出一条带，不压图像。mark 在图上标出差异（x1,y1,x2,y2 百分比；多组用 ;），mark-label 给角标；split 下每处只标在框心所属的那一半，side/stack 下只标在 a 图（b 是参照物）。zoom="mark" 在下方生成一块差异放大（默认 ×2），也可以写 x1,y1,x2,y2 或只写倍数。
  - 属性：`alt` · `variant` · `ratio` · `split` · `fill` · `position` · `labels` · `label-position` · `mark` · `mark-label` · `zoom` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 例：`<vk-compare span="2" ratio="1440 / 900" split="46"
    labels="../assets/hello/o0.png,../assets/hello/o2.png|gcc -O0 · 13 行|gcc -O2 · 10 行"
    mark="58,73,93,84" mark-label="少 3 行">`
- **`vk-tree`** · 文件树 — 文件树：src 指向真实目录，构建期扫描层级、类型、大小。
  - 属性：`mass` · `src` · `title` · `current` · `collapsed` · `limit` · `columns` · `depth` · `chrome` · `size` · `fit` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-tree title="hello" current="build/hello.exe" depth="4">hello.c build/ obj/ hello.o hello.i hello.s * hello.exe + Makefile</vk-tree>`
- **`vk-cells`** · 内存格 — 一格一个 <li>：标签、值、地址；state="err" 标出越界的那一格，act="focus" 标出当前格，超过 cols 自动换行。
  - 属性：`addr` · `cols` · `stride` · `columns` · `direction` · `mass` · `current` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-cells cols="6" addr="0x404064" columns="offsets">`
- **`vk-bytes`** · 字节 — 字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，current 标出一段字节。
  - 属性：`src` · `addr` · `offset` · `length` · `cols` · `group` · `columns` · `current` · `mass` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `word` · `endian`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-bytes src="../code/hello.bin" addr="0x404064" offset="0" length="48" current="1-6">`
- **`vk-steps`** · 步骤 — 步骤条：编号 + 连线 + 当前步。条目写成 <li>；current="-1" = 不标当前步（纯地图，五步等权）；done="none" 连前面也不打勾，mark="N" 只强调第 N 步。
  - 属性：`current` · `done` · `mark` · `mass` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength` · `direction` · `connector`
  - 子节点：条目写成 `<li>`
  - 例：`<vk-steps current="2">`
- **`vk-bits`** · 位 — 一行二进制位：索引、分组、符号位。
  - 属性：`mass` · `value` · `index` · `group` · `sign` · `label` · `tone` · `bit-width` · `bytes` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-bits value="1 01111111 10000000000000000000000" bit-width="32" sign index="sparse">`
- **`vk-bars`** · 条 — 一组横向条：标签、数值条、单位；ratio-to 指向基准行（0 起）时，每条旁直接标出相对它的倍率（×500）。子节点写成 <li value label>。
  - 属性：`max` · `scale` · `ratio-to` · `unit` · `format` · `mass` · `tone` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-bars max="52980" scale="log" unit="字节">`
- **`vk-asm`** · 汇编 — 汇编清单：地址 / 机器码 / 指令 / 操作数四列；行与地址都能被连线锚定。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `reveal` · `focus` · `addr` · `title` · `bytes` · `columns` · `mass` · `long` · `chrome` · `order` · `fence` · `size` · `fit` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-asm title="hello.s" lines="2-9" current="6" bytes order="1,2,3,4,5,6,7,8" long="wrap"
        fence="after:4,label:编译器屏障">`
- **`vk-timeline`** · 时间线 — 时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <li>，li 可写 value（大数字主值）与 note（小说明）；主值字号写在 size（title 200 默认 / hero 280 / subhead 112 …），当前项写在 current（1 起，-1 = 不标）。
  - 属性：`start` · `end` · `variant` · `steps` · `lanes` · `title` · `mass` · `current` · `size` · `at` · `dur` · `enter` · `ease` · `stagger` · `cue` · `act` · `strength`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-timeline start="1972" end="2011" title="C 语言标准" size="subhead" mass="compact">`

### L4 关系 · 两点之间的关系与批注

- **`vk-edge`** · 连线 — 两点之间的连线。自己算锚点，三种形状。
  - 属性：`from` · `to` · `from-side` · `to-side` · `variant` · `tension` · `label` · `tone` · `strength` · `size` · `arrow` · `dash` · `gap` · `bend` · `label-offset` · `z` · `act` · `at` · `dur` · `enter` · `ease` · `via`
  - 例：`<vk-edge from="#buf@side:right" to="#mem@point:0%,50%" label="编译" tension="42" arrow="end,size:52">`
- **`vk-annotate`** · 标注 — 关系与图示：mode="arrow"（从一个元素/坐标指向另一个）、mode="circle"（圈出目标，可双圈）、mode="note"（批注泡 / 引线标签 / 编号点，自动避开正文）、mode="badge"（编号点）。只画覆盖层，不改布局。
  - 属性：`mode` · `for` · `from` · `to` · `shape` · `dash` · `width` · `arrow` · `ring` · `double` · `note` · `n` · `size` · `strength` · `tone` · `label` · `gap` · `z` · `side` · `x` · `y` · `at` · `dur` · `enter` · `ease`
  - 例：`<vk-annotate id="vka-arrow" mode="arrow" from="#vka-src@side:right" for="#vka-out@side:left" label="gcc -c" tone="info">`
- **`vk-note`** · 注解 — 三种注解：variant="margin" 用 1px 细线引到栏间空白（与正文基线对齐，自动选有空间的一侧）；variant="bubble" 是泡 + 引线（原 vk-pin）；variant="legend" 在目标角上放编号点，页角给编号 + 说明。不占布局，也不占焦点名额。
  - 属性：`variant` · `for` · `side` · `leader` · `w` · `z` · `tone` · `strength` · `size` · `n` · `gap` · `x` · `y`
  - 例：`<vk-note variant="margin" for="#nt-code" side="auto" leader="line" w="360">main 的返回值写进 eax；0 表示程序正常结束。</vk-note>`

### L5 页面 · 一整张 1920×1080 的画布

- **`vk-page`** · 页面 — 坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。theme 换整套调色板（只换颜色，不动尺寸）。
  - 属性：`align` · `theme` · `dur` · `beat` · `poster` · `cues` · `states` · `transition` · `focus-duration` · `focus-transition`
  - 例：`<vk-page align="center">`

### 旧名（已合并，仍可用）

- **`vk-icon`** → `vk-text` — 图标本质是一个字形：改用 <vk-text icon="check">，文字与图标可以共存。
- **`vk-rule`** → `vk-box` — 一条线就是一块 1px 高的面：用 <vk-box border="hair">（或 vk-box 的 h + surface）。
- **`vk-window`** → `vk-panel` — 窗就是带窗头的分区：用 <vk-panel chrome="dots" title="…">，窗头与内距是同一套属性。
- **`vk-pin`** → `vk-note` — 批注泡是 vk-note 的一种形态：用 <vk-note variant="bubble">（泡 + 引线，属性同旧版）。
- **`vk-ring`** → `vk-box` — 圈选是一块带环的面：用 <vk-box ring>（不占布局）；overlay 圈选用 vk-annotate mode="circle"。
- **`vk-caption`** → `vk-label` — 归属说明就是贴到目标块上的一枚标签：用 <vk-label for="#id" side="top|bottom">。
<!-- vk:tags:end -->

---

## 9 · 已经踩过的坑

写页面之前先读一遍，这些都不会报错，只会画错。

- **`vk-bytes` 的地址是算出来的**：`offset` 是文件偏移，`addr` 是窗口第 0 字节的地址，屏幕上是 `addr + offset + i`；`current` 又是片段内 0 基。想让窗口从 `0x404064` 开始，写 `addr="0x404000" offset="0x2064"`。
- **`span` 只属于 `vk-grid`**：`vk-figure`、`vk-code` 放在 page 直系时 `span` 无效（构建期会报）。全宽 16:9 的图会算出 945px 高、顶出 1080——要么包一层 `vk-grid` 给它 `span`，要么换更宽的 `ratio`。
- **`vk-note variant="bubble"` 的 `side` 是强制边，不是偏好**：钉在整行宽的组件（tree 的一行、code 的整行）上时，气泡会被夹到画布边缘并压住内容。整行目标改用 `side="auto"` 或显式 `x` / `y`。`vk-annotate mode="note"` 没有 `side`，只做自动避让（代码行也算正文）。
- **`vk-compare` 的 `mark` 是百分比，不是像素**：`mark="x1,y1,x2,y2"` 相对取景框；`split` 下每处只标在所属的一半（框心决定 A/B），`side` / `stack` 下只标在 a 图上。写错坐标只会得到 warning，不会画错位置。
- **`vk-cells` 的 `cols` 上限是 8**；8 列时地址会省略号截断，想要完整地址就减列或缩短地址。
- **多行 `current`（`current="4-6"`）算一处焦点**：不要在一个组件里既写 `current` 又写 `focus`，那才是"两处"。
- **带 `src` 的组件必须 `vk build`**：没预编译会 `stale`（`vk check` / `vk shot` 会红）。审阅页里出现空白帧，先怀疑这一条。
- **`vk check` 逐页审计**：一个文档里有多张 `vk-page` 时，问题会带 `第 N 页`；不要以为"只查了第一页"。
- **`vk shot` 默认删坏图**：有 error 时截图会被删掉，`--keep` 才保留——看不到图不一定是没生成。

---

## 10 · 一帧的度量

`vk.metrics()`（`vk shot` 会打印一行）给出 `contentTop / contentBottom / contentLeft / contentRight / focus`。
它只测量、不判定：一集里同一档帧型的 `contentTop` 应该相等，`focus` 应该恰好是 1。偏差超过 8px 或焦点为 0，多半是这一帧缺了主角。

---

## 11 · 表面与层次（14.1 / 批次 A）

- **`vk-panel`**：一块**内容分区**。`<vk-panel tone="info" variant="inset" title="输出" pad="md" radius="lg" border="hair">…</vk-panel>`。
  - 四档表面：`plain` 是默认的**无框无底**（透明，只是一块版面区域）/ `raised` 抬起（近白 + 投影）/ `inset` 凹下（灰）/ `dark` 深色（墨底白字）。
  - `tone` 只染面：`plain`、`raised` 上落 **wash**（极淡，分区）；`inset` 上落 **tint**（稍深，强调块）；`dark` 上落**深色 wash / tint**。描边只在显式 `border="hair|strong"` 时出现。
  - `title` 生成标题带，里面是一个 `vk-label`；标题带的底比内容再高一档。**它不排内容**——内容怎么排由你决定（`vk-stack` / `vk-grid`）。
  - 与 `vk-box` 的分工：`box` 是「没有标题的面」，`panel` 是「有标题、带语义的分区」。
- **语义淡底**：`--vk-wash-*` / `--vk-tint-*`（浅色）与 `--vk-dark-wash-*` / `--vk-dark-tint-*`（深色），五色 × 两档。两档都由语义色与白/墨混合，色相不变；浅色版上的正文墨 ≥ 13:1，深色版上的白字 ≥ 14:1。
- **能力矩阵**：`docs/capabilities.md` 记「能力」而不是标签；每条能力必须有契约断言 / 标本页 / 测试，缺一件 `npm test` 就红（`node tools/capabilities.mjs`）。

> `vk-grid tracks` 仍是真轨道：`<vk-grid tracks="1fr 2fr">`、`"auto 1fr"`；只收 `fr` 与 `auto`，px 会在构建期报错。等分用 `cols="1..12"`（12 是默认坐标系，沟槽 `--vk-grid-gutter: 32px`），两条路互斥。

## 12 · 版式与默认值（15.x / 手机横屏基准）

- **四档字号**：`caption 48` · `body 56` · `headline 112` · `display 200`。旧名 `label` / `data` / `subhead` / `title` 是别名；`hero` 280 / `mega` 400 是补充档。
- **网格与版心**：`--vk-grid-cols: 12`、`--vk-grid-gutter: 32px`、`--vk-margin: 120px`；`.vk-frame` 是最宽 1680 的版心列，`.vk-safe` 是全宽容器的 120 边距。
- **窗头**：`vk-term` / `vk-code` / `vk-asm` / `vk-tree` / `vk-bytes` / `vk-diff` 默认有三点 + 文件名/来源；`chrome="none"` 仍可用但构建期会提醒放到有上下文的容器里。三点随 `mass` 变 12 / 16 / 20px，窗头 56 / 72 / 88。
- **页眉**：`<vk-label variant="kicker" counter="3/5" section="汇编">` → `工序 3/5 · 汇编`（不是页号）；左侧 4px 焦点色条。这条只是建议，默认不审计；`--style` 才判。
- **属性收敛（15.2）**：列开关写 `columns="numbers,summary"`；间距写 `gap` / `pad`（`"24"` 或 `"24 48"`，先左右后上下）；箭头写 `arrow="end:open,size:40,scale:0.12,label:gcc"`；屏障写 `fence="after:4,label:…"`；工序进度写 `counter="3/5"`。旧名仍是别名（运行期折叠 + 构建期提示），见 [convergence-15b.md](convergence-15b.md)。
- **兼容开关**：`<body class="vk-legacy">` 只切尺寸——回到 14.x 的字号（160 / 96 / 40 / 28）与窗头（40 / 56 / 72），审计地板跟着切回 28 / 40 / 96；panel 的底 / 框、kicker 的色条、grid 沟槽不跟着回退。
- **库 vs 项目**：库只判客观错误；强调色 ≤1 / 深色块 ≤1 / 页眉措辞 / 120 边距是项目层 preset，默认关，用 `vk check --style` 或 `tools/style-preset.mjs` 打开（见 `docs/style-preset.md`）。图标白名单只是提醒。

## 13 · 主题（16.0 · 调色板）

- **三套内置主题**：`paper`（默认，纯白 / 冷墨 / 钴蓝，与 15.x 逐像素相同）· `graphite`（近白 / 暖墨 / 琥珀，适合长时间看）· `blueprint`（极浅蓝 / 深蓝墨 / 亮蓝，适合讲结构）。
- **怎么挂**：`<vk-page theme="graphite">`，或 `<body data-theme="graphite">`，或任意祖先 `<div data-theme="blueprint">`（只影响这一块）。不写 = paper。
- **只换颜色**：主题不动字号 / 行距 / 间距 / 圆角 / 线宽。三套主题下同一页面的包围盒与字号逐项相等（`tests/theme-geometry.test.mjs`）。
- **对比度**：三套主题的正文都 ≥ 7:1，`ink="muted"` 标注 ≥ 4.5:1（`tests/theme-tokens.test.mjs`）。不要为了配色把墨提亮：主题里已经算好了。
- **作者不写颜色**：页面里不出现 hex / rgba。要强调用 `tone` / `act` / `surface`，要换一整套色就覆盖 `--vk-theme-*`（或在带 `data-theme` 的元素上覆盖）。
- **自定义主题**：复制一套 `[data-theme="…"]` 块改值；规则（wash 9% / tint 22% / 深 wash 16% / 深 tint 36%）见 `src/tokens/themes.css` 顶部与 `docs/themes.md`。
- **别做的事**：一帧只用一套主题；局部 `data-theme` 只给「对照」这类明确的构图（标本册的 theme 页是例外）。
