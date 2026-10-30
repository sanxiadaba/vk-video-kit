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
- 块级组件默认填满父容器；`vk-text` 例外，默认按字号取行宽（body 52→1040），要铺满写 `measure="none"`。要分栏用 `vk-grid` + 子项 `span`，要撑满用 `fill`。像素 `w` / `h` 只在 `vk-canvas` 的子节点里合法，写别处会在构建期报错。行内件（`icon` / `tag` / `mark` / `keys`）按内容宽。
- **全库只有白纸**：没有深色主题、深色代码窗、反色卡片。
- 没有播放器、时间轴、逐行淡入；静止帧就是成品。

## 2 · 字号与颜色

1. 字阶七档：`display-2xl 200` · `display-xl 160` · `display 120` · `title 88` · `heading 64` · `body 52` · `meta 40`。160/200 是「一个数字当家」的档，一帧最多一个，不要拿来当标题。
2. 要读懂的内容用 52；元数据、标签、密集 ASCII 数据用 40（`data-meta` 标记），任何可读文字不低于 40。
3. 钴蓝只有一个含义：**正在讲这里**。它不做语法色——关键字与数字都是墨色 600，字符串是绿的。
4. 语义色（对 / 错 / 注意）只出现在色条、底色、图标上，不写正文。

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

几何锚点写在哪就是哪：`vk-edge` 不再把端点从圆角附近推开，`@side` 还会替连线决定出线方向。

写错会在 `vk build` 报错。

### 关系件各回答一个问题

**能由组件内置状态说清的，不用覆盖层。** `current` / `state="mark"` / `state="err"` 已经是"这里"的答案；覆盖层只补组件没有的东西。

| 件 | 它回答 | 不该用来 |
|---|---|---|
| `vk-edge` | 两个**物件**之间有关系（指针 → 内存） | 表达"这行写了那格"——那是叙述，口播或字幕就够了 |
| `vk-ring` | 组件没有内置状态，但你要指一片区域 | 组件已经 `state="err"` / `state="mark"` 时再圈一遍 |
| `vk-spotlight` | 这一屏只留一个目标 | 当"强调"用；强调是 `tone` 和字号的事 |
| `vk-pin` | 一句话钉在一个点上 | 复述标题或副题；一句话一个点 |

一个信号只用一种机制。两个叠在一起，观众要判断"它们是不是在说同一件事"，这个判断本身与讲解无关。

## 5 · 命令

```bash
node bin/vk.mjs brief           # 39 行契约摘要：属性 / 子节点 / 状态
node bin/vk.mjs build page.html # 预编译 + 校验；增量缓存
node bin/vk.mjs build . --force # 忽略缓存
node bin/vk.mjs check page.html # 结构自检；有错退出码 1
node bin/vk.mjs check a.html b.html # 多页共用一个浏览器
node bin/vk.mjs shot page.html  # 1920×1080 诊断图；--strict 遇 error 删图
node bin/vk.mjs tags            # 39 个标签
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
- `vk-ring` / `vk-spotlight` 的形态（作者写 `variant` / `tone` 决定）；
- `vk-asm` 的执行顺序 / 屏障（写 `order` / `fence-after` 才有）。

---

## 组件速查

<!-- vk:tags:start -->
### L1 原子 · 屏幕上真实存在的单个物件

- **`vk-box`** · 面 — 一个面：背景、描边、圆角、内距。不认识兄弟，不排别人。
  - 属性：`surface` · `tone` · `pad` · `pad-y` · `pad-x` · `radius` · `border` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-box border="hair" radius="xl" pad="lg" surface="paper">`
- **`vk-text`** · 文字 — 一段文字：字阶、字重、墨阶、等宽、对齐、测量宽。
  - 属性：`size` · `weight` · `mono` · `align` · `at` · `dur` · `enter` · `ease` · `stagger` · `ink`
  - 例：`<vk-text size="body" measure="body">示例文字。这一段只展示字号、行高和行宽。</vk-text>`
- **`vk-inline`** · 行内 — 行内文字：代码、公式、上下标、链接。字号跟随所在文本行。
  - 属性：`variant` · `href`
  - 例：`<vk-inline variant="code">s[0]</vk-inline>`
- **`vk-icon`** · 图标 — 一个符号。全量 Lucide 名字；四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。
  - 属性：`name` · `tone` · `label` · `src` · `ink` · `size`
  - 例：`<vk-icon name="terminal" size="lg">`
- **`vk-img`** · 图片 — 一张图：比例、填充方式、焦点。加载失败有可见占位。
  - 属性：`src` · `alt` · `ratio` · `fit` · `radius` · `border` · `position`
  - 例：`<vk-img fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl">`
- **`vk-rule`** · 分隔线 — 一根线。线宽三档；纯装饰或语义分隔。
  - 属性：`orientation` · `at` · `dur` · `enter` · `ease` · `stagger` · `variant` · `tone` · `dash`
  - 例：`<vk-rule>`
- **`vk-mark`** · 标记 — 行内标注：高亮、下划线、删除线、圈。只包文字，不改布局。
  - 属性：`tone` · `variant`
  - 例：`<vk-mark variant="highlight">高亮</vk-mark>`
- **`vk-window`** · 窗 — 一个窗：三点窗头、标题、地址栏或对话框；内容由作者放。
  - 属性：`title` · `url` · `chrome` · `tone` · `pad` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-window chrome="browser" url="http://127.0.0.1:5000/hello">`
- **`vk-panel`** · 区域 — 一块区域：卡片或章节带。只提供底、边和三个槽（header / footer / 其余进 body），不规定里面怎么排。
  - 属性：`variant` · `surface` · `pad` · `border` · `radius` · `n` · `elevation` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-panel n="1" surface="sf-1">`
- **`vk-stat`** · 指标 — 一个指标：大数字 + 单位 + 标签，可选色点/色条做图例。数字用 tabular-nums，多个指标能对齐。
  - 属性：`value` · `unit` · `label` · `size` · `tone` · `mark` · `format` · `align` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-stat value="52,980" unit="字节" label="预处理后" size="display-xl">`
- **`vk-keys`** · 键位 — 键位：把 A + B 写成两枚键帽。
  - 属性：（无）
  - 例：`<vk-keys>Ctrl + C</vk-keys>`

### L2 排布 · 只决定在哪、多大

- **`vk-stack`** · 竖排 — 纵向节奏。只给间距和对齐，不画任何东西。
  - 属性：`gap` · `align` · `justify` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-stack gap="sm">`
- **`vk-row`** · 横排 — 横向排列。可换行、可两端推开。
  - 属性：`gap` · `align` · `justify` · `wrap` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-row gap="md">`
- **`vk-grid`** · 网格 — 分份容器。cols/rows 切几份，子项用 span 占几份；行高按内容。
  - 属性：`cols` · `tracks` · `rows` · `gap` · `gap-x` · `gap-y` · `align` · `at` · `dur` · `enter` · `ease` · `stagger` · `justify`
  - 例：`<vk-grid cols="3" gap="sm">`
- **`vk-canvas`** · 坐标画布 — 坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。
  - 属性：`w` · `h` · `pad-px` · `grid` · `overflow`
  - 例：`<vk-canvas w="1200" h="420">`

### L3 器械 · 渲染一种编程数据的形状

- **`vk-title`** · 标题 — 标题：一句话主张 + 可选副题。
  - 属性：`index` · `eyebrow` · `sub` · `level` · `size` · `align` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-title index="01" eyebrow="示例 · 组件" size="title" sub="副标题只做占位。">示例标题</vk-title>`
- **`vk-list`** · 列表 — 列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。
  - 属性：`rule` · `bare` · `gap` · `at` · `dur` · `enter` · `ease` · `stagger` · `variant`
  - 子节点：条目写成 `<li>`
  - 状态：`state="ok|warn|err"`（item）
  - 例：`<vk-list gap="sm">`
- **`vk-tag`** · 标签 — 一个小标签：状态、分类、元信息。两档尺寸，可带图标。
  - 属性：`tone` · `size` · `emphasis` · `bare`
  - 例：`<vk-tag>int</vk-tag>`
- **`vk-callout`** · 提示框 — 提示块：说明、正确、注意、错误。色条 + 淡底 + 图标，正文仍是墨色。
  - 属性：`tone` · `title` · `size` · `bare` · `at` · `dur` · `enter` · `ease` · `stagger` · `density`
  - 例：`<vk-callout tone="warn" title="提示框标题" size="body">提示框内容，只做占位。</vk-callout>`
- **`vk-code`** · 代码窗 — 代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `focus` · `fold` · `omit` · `fold-note` · `chrome` · `mark` · `at` · `dur` · `enter` · `ease` · `stagger` · `long` · `numbers` · `numbering` · `density`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-8" current="4" density="loose">`
- **`vk-term`** · 终端 — 终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行。
  - 属性：`src` · `lines` · `title` · `prompt` · `marks` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger` · `density`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-term title="zsh" prompt="$" src="../code/hello.term">`
- **`vk-diff`** · 对比 — 对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。
  - 属性：`lang` · `src` · `lines` · `file` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger` · `variant` · `numbers` · `summary`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-diff lang="c" file="bounds.c" src="../code/real.diff">`
- **`vk-table`** · 表格 — 表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr state="mark"> 标出重点。
  - 属性：`variant` · `stripe` · `mono` · `density` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：内容包在 `<table>` 里
  - 状态：`state="current|mark|ok|warn|err"`（row / cell）
  - 例：`<vk-table variant="ledger">`
- **`vk-math`** · 公式 — 公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。
  - 属性：`src` · `display` · `size` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-math display size="heading" src="../code/formula.tex">`
- **`vk-figure`** · 图窗 — 画框里的图：标题栏、比例、说明、来源。
  - 属性：`src` · `alt` · `caption` · `fig` · `url` · `ratio` · `crop` · `crop-label` · `fit` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger` · `position`
  - 例：`<vk-figure fig="01" caption="一张 16:9 的图" ratio="16 / 9" crop="76.25,32.22,12.5,23.33" crop-label="裁切区" src="../assets/img/sample.svg" alt="一张示例图">`
- **`vk-tree`** · 文件树 — 文件树：src 指向真实目录，构建期扫描层级、类型、大小。
  - 属性：`src` · `title` · `current` · `collapsed` · `limit` · `summary` · `depth` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-tree title="app" current="src/parser.py" depth="4">src/ __init__.py ast.py errors.py lexer.py * parser.py tests/ fixtures/ basic.tokens test_lexer.py + main.py</vk-tree>`
- **`vk-cells`** · 内存格 — 一格一个 <li>：标签、值、地址；state="err" 标出越界的那一格，超过 cols 自动换行。
  - 属性：`addr` · `cols` · `stride` · `offsets` · `direction` · `ruler` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-cells cols="6" addr="0x7ffc" offsets>`
- **`vk-bytes`** · 字节 — 字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，current 标出一段字节。
  - 属性：`src` · `addr` · `offset` · `length` · `cols` · `group` · `ascii` · `address` · `current` · `density` · `chrome` · `at` · `dur` · `enter` · `ease` · `stagger` · `word` · `endian`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-bytes src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" current="0-5">`
- **`vk-steps`** · 步骤 — 步骤条：编号 + 连线 + 当前步。条目写成 <li>。
  - 属性：`current` · `density` · `at` · `dur` · `enter` · `ease` · `stagger` · `orientation`
  - 子节点：条目写成 `<li>`
  - 例：`<vk-steps current="1">`
- **`vk-quote`** · 引文 — 一段引文：出处、作者；左侧竖线或压角引号。
  - 属性：`source` · `author` · `variant` · `size` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 例：`<vk-quote source="示例出处">示例引文。</vk-quote>`
- **`vk-bits`** · 位 — 一行二进制位：索引、分组、符号位。
  - 属性：`value` · `index` · `group` · `sign` · `label` · `tone` · `bit-width` · `bytes` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-bits value="1 01111111 10000000000000000000000" bit-width="32" sign>`
- **`vk-bars`** · 条 — 一组横向条：标签、数值条、单位。子节点写成 <li value label>。
  - 属性：`max` · `scale` · `unit` · `format` · `density` · `tone` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-bars max="1000000" scale="log" unit="ns">`
- **`vk-asm`** · 汇编 — 汇编清单：地址 / 机器码 / 指令 / 操作数四列；行与地址都能被连线锚定。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `focus` · `addr` · `title` · `bytes` · `address` · `density` · `long` · `chrome` · `order` · `fence-after` · `fence-label` · `labels` · `address-label` · `bytes-label` · `mnemonic-label` · `operands-label` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：内容来自 `src` 或 `<script data-vk-source>`（二选一）
  - 例：`<vk-asm title="main.s" lines="1-13" current="6" bytes long="wrap"
        order="4,1,2,3,5,6,7,8" fence-after="6" fence-label="编译器屏障">`
- **`vk-timeline`** · 时间线 — 时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <li>。
  - 属性：`start` · `end` · `variant` · `steps` · `lanes` · `title` · `density` · `at` · `dur` · `enter` · `ease` · `stagger`
  - 子节点：条目写成 `<li>`
  - 状态：`state="current|mark|ok|warn|err"`（item）
  - 例：`<vk-timeline start="1972" end="2018" lanes="A,B" title="示例时间线">`

### L4 关系 · 两点之间的关系与批注

- **`vk-edge`** · 连线 — 两点之间的连线。自己算锚点，三种形状。
  - 属性：`from` · `to` · `from-side` · `to-side` · `variant` · `tension` · `label` · `tone` · `emphasis` · `arrow` · `arrow-style` · `arrow-size` · `dash` · `gap-px` · `bend` · `cap` · `z` · `label-size` · `label-dx` · `label-dy` · `via`
  - 例：`<vk-edge from="#buf@side:right" to="#mem@point:0%,50%" label="指向" tension="42" arrow-style="solid" arrow-size="36">`
- **`vk-pin`** · 批注泡 — 自由批注：气泡 + 引线绑到任意锚点，不改布局；放在 canvas 或 page 里。
  - 属性：`for` · `side` · `x` · `y` · `n` · `tone` · `variant` · `emphasis` · `leader` · `gap-px` · `w` · `size` · `z`
  - 例：`<vk-pin for="#pin-target@side:right" side="right" tone="info" n="1">说明</vk-pin>`
- **`vk-ring`** · 圈选 — 圈选/框选/下划线：绑到任意锚点，只画覆盖层，不改布局。
  - 属性：`for` · `variant` · `pad-px` · `tone` · `dash` · `stroke` · `z`
  - 例：`<vk-ring for="#ring-target" variant="rect" tone="info" pad-px="16" dash>`
- **`vk-spotlight`** · 聚光 — 聚光：目标保持原样，其余逐层退后。不画遮罩、不画描边；可多目标，keep 里的东西不退。
  - 属性：`for` · `dim` · `keep` · `z`
  - 例：`<vk-spotlight for="#spot-target" dim="0.45">`

### L5 页面 · 一整张 1920×1080 的画布

- **`vk-page`** · 页面 — 坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。
  - 属性：`align` · `dur` · `beat` · `poster`
  - 例：`<vk-page>`
<!-- vk:tags:end -->

---

## 9 · 已经踩过的坑

写页面之前先读一遍，这些都不会报错，只会画错。

- **`vk-bytes` 的地址是算出来的**：`offset` 是文件偏移，`addr` 是窗口第 0 字节的地址，屏幕上是 `addr + offset + i`；`current` 又是片段内 0 基。想让窗口从 `0x404064` 开始，写 `addr="0x404000" offset="0x2064"`。
- **`span` 只属于 `vk-grid`**：`vk-figure`、`vk-code` 放在 page 直系时 `span` 无效（构建期会报）。全宽 16:9 的图会算出 945px 高、顶出 1080——要么包一层 `vk-grid` 给它 `span`，要么换更宽的 `ratio`。
- **`vk-pin` 的 `side` 是强制边，不是偏好**：钉在整行宽的组件（tree 的一行、code 的整行）上时，气泡会被夹到画布边缘并压住内容。整行目标改用 `side="auto"` 或显式 `x` / `y`。
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

## 11 · 新增的三件（12.2）

- **`vk-stat`**：一个数字当家的指标。`<vk-stat value="52,980" unit="字节" label="预处理后" size="display-xl">`。数字用 tabular-nums；`format="thousands|bytes|hex"` 只改写法。
- **`vk-panel`**：区域（卡片 / 章节带）。只给底、边、三槽：`slot="header"` / 正文 / `slot="footer"`，另有 `n` 编号徽章与 `elevation="0..2"`。**它不排内容**，怎么排由作者决定。
- **`vk-grid tracks`**：真轨道。`<vk-grid tracks="1fr 2fr">`、`"auto 1fr"`；只收 `fr` 与 `auto`，**px 会在构建期报错**（会让安全区与溢出检查失真）。等分仍用 `cols="1..6"`，两条路互斥。

> `elevation` 声明的重叠会被审计放行，但每次放行都会打印一行「已豁免：A 压在 B 上」。看到这行就说明有人主动叠了层。
