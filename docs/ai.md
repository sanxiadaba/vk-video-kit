# vk 作者手册（写给 AI）

> 这是一个通用组件库：每个标签只负责一种编程数据的形状。
> 页面怎么排、拿它讲什么，是调用方的事；库不提供模板、配方或“该怎么组合”的建议。

属性细节在 [`docs/reference.md`](reference.md)；**速查表在文末，由 registry 生成，不要手改。**

---

## 1 · 组件自己成立

```html
<vk-code src="code/hello.c" lines="4-6" current="2"></vk-code>
```

- 从任意一个标签开始，不需要先搭 `vk-page`。
- 块级组件默认填满父容器；`w` / `h` 可选。行内件（`icon` / `tag` / `mark` / `keys`）按内容宽。
- **全库只有白纸**：没有深色主题、深色代码窗、反色卡片。
- 没有播放器、时间轴、逐行淡入；静止帧就是成品。

## 2 · 字号与颜色

1. 字阶只有五档：`display 120` · `title 88` · `heading 64` · `body 52` · `meta 40`。
2. 要读懂的内容用 52；元数据、标签、密集 ASCII 数据用 40（`data-meta` 标记），任何可读文字不低于 40。
3. 钴蓝只有一个含义：**正在讲这里**。它不做语法色——关键字与数字都是墨色 600，字符串是绿的。
4. 语义色（对 / 错 / 注意）只出现在色条、底色、图标上，不写正文。

## 3 · 内容入口

| 数据 | 写法 |
|---|---|
| 真实文件 | `src="code/hello.c"` + `lines="1-8"` |
| 内联源码 | `<script type="text/plain" data-vk-source>…</script>` |
| 结构化子节点 | `<li>` / `<i value label>` / `<table><tr>` |

`src` 与内联块只能有一个。批注与圈选只做覆盖层，用 `for="#id@part:arg"` 指目标。

**子节点优先。** 一维以上的内容一律写成子节点，字符串属性只留"一个值"的场合（`addr` / `title` / `name` / `src`）。

- `vk-cells`：一格一个 `<i value label>`，状态写在格子上（`bad` / `mark` / `filled`），`span` 是跨几格；超过 `cols` 自动换行——多行就是这样成立的。
- `vk-bits`：字段写成 `<i from="30" to="23" label="指数">`；一行位串仍是 `value`。
- `vk-bars` / `vk-timeline`：`<i value label>` / `<i date label lane>`。`vk-bars` 的负值自动落在零线左边，值域不需要手写 `min`。`vk-table` 的合并单元格用原生 `colspan` / `rowspan`，不用额外属性。

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

**能由组件内置状态说清的，不用覆盖层。** `current` / `mark` / `bad` 已经是"这里"的答案；覆盖层只补组件没有的东西。

| 件 | 它回答 | 不该用来 |
|---|---|---|
| `vk-edge` | 两个**物件**之间有关系（指针 → 内存） | 表达"这行写了那格"——那是叙述，口播或字幕就够了 |
| `vk-ring` | 组件没有内置状态，但你要指一片区域 | 组件已经 `bad` / `mark` 时再圈一遍 |
| `vk-spotlight` | 这一屏只留一个目标 | 当"强调"用；强调是 `tone` 和字号的事 |
| `vk-pin` | 一句话钉在一个点上 | 复述标题或副题；一句话一个点 |

一个信号只用一种机制。两个叠在一起，观众要判断"它们是不是在说同一件事"，这个判断本身与讲解无关。

## 5 · 命令

```bash
npx vk build page.html      # 预编译 + 校验；增量缓存
npx vk build . --force      # 忽略缓存
npx vk check page.html      # 结构自检；有错退出码 1
npx vk check a.html b.html  # 多页共用一个浏览器
npx vk shot page.html       # 1920×1080 截图
npx vk tags                 # 36 个标签
npx vk doc vk-code          # 属性 / 枚举 / 默认值
npx vk icons arrow          # 搜图标名
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
  - 属性：`surface` · `tone` · `pad` · `pad-y` · `pad-x` · `radius` · `border` · `w` · `h` · `x` · `y` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-box border="hair" radius="xl" pad="lg" class="spec-w1200 spec-h560" surface="paper">`
- **`vk-text`** · 文字 — 一段文字：字阶、字重、墨阶、等宽、对齐、测量宽。
  - 属性：`size` · `weight` · `mono` · `align` · `measure` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `ink`
  - 例：`<vk-text size="body" measure="body">`
- **`vk-icon`** · 图标 — 一个符号。全量 Lucide 名字；四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。
  - 属性：`name` · `tone` · `label` · `ink` · `size`
  - 例：`<vk-icon name="terminal" size="lg">`
- **`vk-img`** · 图片 — 一张图：比例、填充方式、焦点。加载失败有可见占位。
  - 属性：`src` · `alt` · `ratio` · `fit` · `radius` · `position` · `border`
  - 例：`<vk-img class="spec-w1200" fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl">`
- **`vk-rule`** · 分隔线 — 一根线。线宽三档；纯装饰或语义分隔。
  - 属性：`orientation` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `variant` · `tone`
  - 例：`<vk-rule>`
- **`vk-mark`** · 标记 — 行内标注：高亮、下划线、删除线、圈。只包文字，不改布局。
  - 属性：`tone` · `variant`
  - 例：`<vk-mark variant="highlight">`
- **`vk-window`** · 窗 — 一个窗：三点窗头、标题、地址栏或对话框；内容由作者放。
  - 属性：`title` · `url` · `chrome` · `tone` · `pad` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-window chrome="browser" url="http://127.0.0.1:5000/hello">`
- **`vk-keys`** · 键位 — 键位：把 A + B 写成两枚键帽。
  - 属性：（无）
  - 例：`<vk-keys>`

### L2 排布 · 只决定在哪、多大

- **`vk-stack`** · 竖排 — 纵向节奏。只给间距和对齐，不画任何东西。
  - 属性：`gap` · `align` · `justify` · `grow` · `w` · `h` · `span` · `row-span` · `fill` · `overflow` · `measure`
  - 例：`<vk-stack gap="sm">`
- **`vk-row`** · 横排 — 横向排列。可换行、可两端推开。
  - 属性：`gap` · `align` · `justify` · `wrap` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-row gap="md">`
- **`vk-grid`** · 网格 — 分份容器。cols/rows 切几份，子项用 span 占几份；行高按内容。
  - 属性：`cols` · `rows` · `gap` · `gap-x` · `gap-y` · `align` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `justify`
  - 例：`<vk-grid cols="3" gap="sm">`
- **`vk-canvas`** · 坐标画布 — 坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。
  - 属性：`w` · `h` · `pad-px` · `grid` · `overflow`
  - 例：`<vk-canvas w="1200" h="420">`

### L3 器械 · 渲染一种编程数据的形状

- **`vk-title`** · 标题 — 标题：一句话主张 + 可选副题。
  - 属性：`index` · `eyebrow` · `sub` · `level` · `size` · `align` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-title index="01" eyebrow="示例 · 组件" size="title" sub="副标题只做占位。">`
- **`vk-list`** · 列表 — 列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。
  - 属性：`rule` · `bare` · `gap` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `variant`
  - 例：`<vk-list gap="sm">`
- **`vk-tag`** · 标签 — 一个小标签：状态、分类、元信息。两档尺寸，可带图标。
  - 属性：`tone` · `size` · `emphasis` · `bare`
  - 例：`<vk-tag>`
- **`vk-callout`** · 提示框 — 提示块：说明、正确、注意、错误。色条 + 淡底 + 图标，正文仍是墨色。
  - 属性：`tone` · `title` · `size` · `bare` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-callout tone="warn" title="提示框标题" size="body">`
- **`vk-code`** · 代码窗 — 代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `focus` · `fold` · `omit` · `fold-note` · `chrome` · `mark` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `long` · `numbers` · `numbering` · `density`
  - 例：`<vk-code lang="c" file="hello.c" src="../code/hello.c" lines="1-8" current="4" density="loose">`
- **`vk-term`** · 终端 — 终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行。
  - 属性：`src` · `lines` · `title` · `prompt` · `marks` · `chrome` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-term title="zsh" prompt="$" src="../code/hello.term">`
- **`vk-diff`** · 对比 — 对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。
  - 属性：`lang` · `src` · `lines` · `file` · `chrome` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `variant` · `numbers` · `summary`
  - 例：`<vk-diff lang="c" file="bounds.c" src="../code/real.diff">`
- **`vk-table`** · 表格 — 表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr data-em> 标出重点。
  - 属性：`variant` · `stripe` · `mono` · `density` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-table variant="ledger">`
- **`vk-math`** · 公式 — 公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。
  - 属性：`src` · `display` · `size` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-math display size="heading" src="../code/formula.tex">`
- **`vk-figure`** · 图窗 — 画框里的图：标题栏、比例、说明、来源。
  - 属性：`src` · `alt` · `caption` · `fig` · `url` · `ratio` · `crop` · `crop-label` · `fit` · `chrome` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `position`
  - 例：`<vk-figure fig="01" caption="一张 16:9 的图" ratio="16 / 9" crop="76.25,32.22,12.5,23.33" crop-label="裁切区" src="../assets/img/sample.svg" alt="一张示例图">`
- **`vk-tree`** · 文件树 — 文件树：src 指向真实目录，构建期扫描层级、类型、大小。
  - 属性：`src` · `title` · `current` · `collapsed` · `limit` · `summary` · `depth` · `chrome` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-tree title="app" current="src/parser.py" depth="4">`
- **`vk-cells`** · 内存格 — 一格一个 <i>：标签、值、地址；bad 标出越界的那一格，超过 cols 自动换行。
  - 属性：`addr` · `cols` · `stride` · `offsets` · `direction` · `ruler` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-cells cols="6" addr="0x7ffc" offsets>`
- **`vk-bytes`** · 字节 — 字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，current 标出一段字节。
  - 属性：`src` · `addr` · `offset` · `length` · `cols` · `group` · `ascii` · `address` · `current` · `density` · `chrome` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `word` · `endian`
  - 例：`<vk-bytes src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" current="0-5">`
- **`vk-steps`** · 步骤 — 步骤条：编号 + 连线 + 当前步。条目写成 <li>。
  - 属性：`current` · `density` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure` · `orientation`
  - 例：`<vk-steps current="1">`
- **`vk-quote`** · 引文 — 一段引文：出处、作者；左侧竖线或压角引号。
  - 属性：`source` · `author` · `variant` · `size` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-quote source="示例出处">`
- **`vk-bits`** · 位 — 一行二进制位：索引、分组、符号位。
  - 属性：`value` · `index` · `group` · `sign` · `label` · `tone` · `bit-width` · `bytes` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bits value="1 01111111 10000000000000000000000" bit-width="32" sign>`
- **`vk-bars`** · 条 — 一组横向条：标签、数值条、单位。子节点写成 <i value label>。
  - 属性：`max` · `scale` · `unit` · `density` · `tone` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bars max="1000000" scale="log" unit="ns">`
- **`vk-asm`** · 汇编 — 汇编清单：地址 / 机器码 / 指令 / 操作数四列；行与地址都能被连线锚定。
  - 属性：`lang` · `src` · `lines` · `file` · `current` · `focus` · `addr` · `title` · `bytes` · `address` · `density` · `chrome` · `order` · `fence-after` · `fence-label` · `labels` · `address-label` · `bytes-label` · `mnemonic-label` · `operands-label` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-asm title="main.s" lines="1-13" current="6" bytes
        order="4,1,2,3,5,6,7,8" fence-after="6" fence-label="编译器屏障">`
- **`vk-timeline`** · 时间线 — 时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <i>。
  - 属性：`start` · `end` · `variant` · `steps` · `lanes` · `title` · `density` · `w` · `h` · `span` · `row-span` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-timeline start="1972" end="2018" lanes="A,B" title="示例时间线">`

### L4 关系 · 两点之间的关系与批注

- **`vk-edge`** · 连线 — 两点之间的连线。自己算锚点，三种形状。
  - 属性：`from` · `to` · `from-side` · `to-side` · `variant` · `tension` · `label` · `tone` · `emphasis` · `arrow` · `arrow-style` · `arrow-size` · `dash` · `gap-px` · `bend` · `cap` · `z` · `label-size` · `label-dx` · `label-dy` · `via`
  - 例：`<vk-edge from="#buf@side:right" to="#mem@point:0%,50%" label="指向" tension="42" arrow-style="solid" arrow-size="36">`
- **`vk-pin`** · 批注泡 — 自由批注：气泡 + 引线绑到任意锚点，不改布局；放在 canvas 或 page 里。
  - 属性：`for` · `side` · `x` · `y` · `n` · `tone` · `emphasis` · `leader` · `gap-px` · `w` · `size` · `z`
  - 例：`<vk-pin for="#pin-target" side="right" tone="err" n="1">`
- **`vk-ring`** · 圈选 — 圈选/框选/下划线：绑到任意锚点，只画覆盖层，不改布局。
  - 属性：`for` · `variant` · `pad-px` · `tone` · `dash` · `stroke` · `z`
  - 例：`<vk-ring for="#ring-target@region:20%,20%,60%,60%" variant="ellipse" tone="accent" pad-px="16" dash>`
- **`vk-spotlight`** · 聚光 — 聚光：除目标外整体压暗，可多目标；放在 canvas 或 page 里。
  - 属性：`for` · `dim` · `feather` · `variant` · `z`
  - 例：`<vk-spotlight for="#spot-target" dim="0.72" feather="24">`

### L5 页面 · 一整张 1920×1080 的画布

- **`vk-page`** · 页面 — 坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。
  - 属性：`align`
  - 例：`<vk-page>`
<!-- vk:tags:end -->
