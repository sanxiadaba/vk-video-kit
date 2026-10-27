# vk 作者手册（写给 AI）

> 你在写**一帧 1920×1080 的画面**，不是网页。成品是一张静帧，会被剪进视频。
> 只读这一份就能开始；属性细节在 [`docs/reference.md`](reference.md)。
> **速查表在文末，由 registry 生成，不要手改。**

---

## 1 · 最小骨架：每帧都从这里开始

```html
<vk-page footer="第 1 章 · 从能跑到讲清楚 | 01 / 12">
  <vk-stack gap="lg">
    <vk-title index="01" sub="改一个字符，改的是内存里的一个字节。">字符串不是值，是<em>一块内存</em></vk-title>
    <vk-code src="code/hello.c" lines="4-6" highlight="2"></vk-code>
  </vk-stack>
</vk-page>
```

- 一页 = 一个 `vk-page`。安全区固定 1680×888（左右 120、上下 96），**不要自己加 padding 去"撑满"**。
- 一帧只讲一件事。第二件事 → 另起一帧。
- 默认全部纸面。要深色就在组件上写 `surface="ink"`（`vk-page` 也可以整页深）。

## 2 · 三条硬规矩

1. **正文 ≥ 44 设计像素**。行号、文件名、图注、索引这类元数据用 28–40，并标 `data-meta`。
2. **焦点只有一个颜色**（钴蓝）。语义色（对/错/注意）只出现在色条、底色、图标上，**不写正文**。
3. **装不下就删内容，不缩字**。一行代码约 24 字符；带标题的一屏约 9 行代码。

## 3 · 内容从哪来（三套入口，别混）

| 数据类型 | 怎么写 | 谁在用 |
|---|---|---|
| 真实文件 | `src="code/hello.c"` + `lines="1-8"` | `code` `diff` `term` `tree` `bytes` `frames` `math` `figure` |
| 结构化内容 | 子节点：`<li>` / 表格里直接写 `<table><tr>` / `<i value label>` | `list` `steps` `table` `bars` |
| 一行值 | 属性串（用竖线分隔，见下例） | `cells` |

```html
<vk-cells values="1|2|3|0" labels="a[0]|a[1]|a[2]|a[3]" addr="0x7ffc" stride="4" flag="3"></vk-cells>
```

**真实文件是唯一真相**：不要把源码抄进 HTML。构建期读文件，运行时零依赖。

## 4 · 指到组件内部（批注 / 箭头）

`for` / `from` / `to` 接受两种写法：

```html
<vk-note for="#arr">整块看</vk-note>                    <!-- CSS 选择器 -->
<vk-note for="#cells@cell:3">越界的那一格</vk-note>      <!-- #id@part:arg -->
```

| part | 用在 | arg |
|---|---|---|
| `line` | `vk-code` / `vk-diff` | **源文件行号**（`lines="4-6"` 时就是 4–6） |
| `char` | `vk-code` | `行:起-止`，列**从 0 起**，左闭右开 |
| `cell` | `vk-cells` | 下标，**从 0 起** |
| `byte` | `vk-bytes` | 偏移，**从 0 起** |
| `row` | `vk-table` | 行下标，**从 0 起** |
| `node` | `vk-tree` | 节点路径 |
| `step` | `vk-steps` | 下标，**从 0 起** |
| `item` | `vk-list` | 下标，**从 0 起** |

一句话：**代码用行号（身份），其余用下标（位置），一律从 0 起。**

行内讲一个字符区间，用 `span`（`vk-code` 写 `行:起-止`，`vk-note` 写 `起-止`）：

```html
<vk-annotate w="520">
  <vk-code id="arr" src="code/hello.c" lines="1-8" span="4:2-6"></vk-code>
  <vk-note line="4" span="2-6">这一行在改一个字节</vk-note>
</vk-annotate>
```

`vk-note` 写在 `vk-annotate` 里才有效；它按行心对齐，不画长引线。

`vk-canvas` 的子件用 `x` / `y` 定位（任意标签都能写，API 面板里不显示）：

```html
<vk-canvas w="1200" h="360">
  <vk-box id="a" x="0" y="80" w="360" h="200">…</vk-box>
  <vk-box id="b" x="720" y="80" w="360" h="200">…</vk-box>
  <vk-edge from="#a" to="#b"></vk-edge>
</vk-canvas>
```

结构体内存布局（字段占几格 / 填充 / 高亮）：

```html
<vk-cells values="0x2a|'h'|…" labels="int x|char y|填充 3 字节"
          spans="4|1|3" pad="2" addr="0x7ffc" stride="1"></vk-cells>
```

`spans` / `pad` / `mark` 的编号都从 0 起（`mark` 是格序号，不是字节）；地址按字段的起始字节算。格宽 ≤150px 时地址会自动退到 28px，再窄才省略。图里指一个局部用 `crop="x,y,w,h"`：0–100，**按图片本身算**（cover / contain 下也准）。

## 5 · 工作循环（一帧四步）

```bash
npx vk build page.html          # 预编译 + 校验；错在这里报
npx vk shot page.html           # 出 page.png（1920×1080）
npx vk shot page.html --phone   # 出 640 宽近似手机横屏
npx vk shot page.html --crop 900,300,600,300   # 出 1:1 局部
```

1. 写 HTML → 2. `vk build` → 3. `vk shot` → 4. **看那张图**：有没有重叠、裁切、两条窗头、字太小。
   改完回到 2。`vk build` 的报错是给你的，按提示改，不要猜。

## 6 · 常见错（`vk build` 会拦住这些）

| 报错 | 原因 |
|---|---|
| `未知标签 <vk-xxx>` | 没有这个组件；别自创标签 |
| `未知属性` / `不在 a / b / c 内` | 属性名或枚举值写错，报错里已经列出可用值 |
| `找不到 #arr` | 引用的 id 不存在，或者 id 写在了 `<template>` 里 |
| `不支持 @cell` | 这个组件没有该锚点；看 §4 的表 |
| `cell 可选范围是 0–3，9 越界` | 下标超了；下标从 0 起 |
| `line="9" 超出上面代码的 1–6` | 批注指向了这段里没有的行 |
| `span 不是 起-止` | `span` 要写 `起-止` 且起 < 止 |
| `没写 chrome="none"，会出现两条窗头` | `<vk-window>` 里放 code/term/diff/figure/tree/bytes/frames 时必须去窗头 |
| `<vk-bars>` 只收 `<i value label>` | 条的行必须是 `<i value="1" label="CPU">` |
| `源码里的 "<" 必须写成 "&lt;"` | 代码别手写进 HTML，用 `src` 指向文件 |

## 7 · 窗：一个组件，四种窗头

```html
<vk-window title="main.c">…</vk-window>
<vk-window chrome="browser" url="https://www.iso.org/standard/74528.html">…</vk-window>
<vk-window chrome="dialog" tone="err" title="编译器">…</vk-window>
<vk-window chrome="none" pad="none"><vk-code chrome="none" src="code/hello.c"></vk-code></vk-window>
```

`code` / `term` / `diff` / `figure` / `tree` / `bytes` / `frames` 自带窗头；放进 `vk-window` 时要 `chrome="none"`。

## 8 · 没有动效

库不提供播放器、时间轴、逐行淡入、打字机。**静止帧就是成品**；动效在剪辑软件里做。

---

## 组件速查

<!-- vk:tags:start -->
### L1 原子 · 屏幕上真实存在的单个物件

- **`vk-box`** · 面 — 一个面：背景、描边、圆角、内距。不认识兄弟，不排别人。
  - 属性：`surface` · `tone` · `pad` · `pad-y` · `pad-x` · `radius` · `border` · `w` · `h` · `x` · `y` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-box border="hair" radius="xl" pad="lg" w="1200" h="560" surface="paper">`
- **`vk-text`** · 文字 — 一段文字：字阶、字重、墨阶、等宽、对齐、测量宽。
  - 属性：`size` · `weight` · `mono` · `align` · `measure` · `w` · `h` · `grow` · `fill` · `overflow` · `emphasis`
  - 例：`<vk-text size="body" measure="body">`
- **`vk-icon`** · 图标 — 一个符号。全量 Lucide 名字；四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。
  - 属性：`name` · `tone` · `label` · `emphasis` · `scale`
  - 例：`<vk-icon name="terminal" scale="lg">`
- **`vk-img`** · 图片 — 一张图：比例、填充方式、焦点。加载失败有可见占位。
  - 属性：`src` · `alt` · `ratio` · `fit` · `radius` · `w` · `h` · `position` · `border`
  - 例：`<vk-img w="1200" h="675" fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl">`
- **`vk-rule`** · 分隔线 — 一根线。线宽三档；纯装饰或语义分隔。
  - 属性：`w` · `h` · `grow` · `fill` · `overflow` · `measure` · `variant`
  - 例：`<vk-rule>`
- **`vk-mark`** · 标记 — 行内标注：高亮、下划线、删除线、圈。只包文字，不改布局。
  - 属性：`tone` · `variant`
  - 例：`<vk-mark variant="highlight">`
- **`vk-window`** · 窗 — 一个窗：三点窗头、标题、地址栏或对话框；内容由作者放。
  - 属性：`title` · `url` · `chrome` · `tone` · `surface` · `pad` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-window w="1200" chrome="browser" url="http://127.0.0.1:5000/hello">`

### L2 排布 · 只决定在哪、多大

- **`vk-stack`** · 竖排 — 纵向节奏。只给间距和对齐，不画任何东西。
  - 属性：`gap` · `align` · `justify` · `grow` · `w` · `h` · `fill` · `overflow` · `measure`
  - 例：`<vk-stack gap="sm">`
- **`vk-row`** · 横排 — 横向排列。可换行、可两端推开。
  - 属性：`gap` · `align` · `justify` · `wrap` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-row gap="md">`
- **`vk-grid`** · 网格 — 二维网格。列数固定，行高按内容。
  - 属性：`cols` · `gap` · `gap-x` · `gap-y` · `align` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `justify`
  - 例：`<vk-grid cols="3" gap="sm">`
- **`vk-canvas`** · 坐标系 — 坐标空间。子节点用 x/y 明确摆放；可铺一层蓝图纸栅格。
  - 属性：`w` · `h` · `pad` · `grid` · `inset` · `overflow`
  - 例：`<vk-canvas w="1200" h="420">`

### L3 器械 · 渲染一种编程数据的形状

- **`vk-title`** · 标题 — 标题：一句话主张 + 可选副题。
  - 属性：`index` · `eyebrow` · `sub` · `level` · `size` · `align` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-title index="01" eyebrow="字符串 · 内存" size="title" sub="改一个字符，改的是内存里的一个字节。">`
- **`vk-list`** · 列表 — 列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。
  - 属性：`rule` · `bare` · `gap` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `variant`
  - 例：`<vk-list gap="sm">`
- **`vk-tag`** · 标签 — 一个小标签：状态、分类、元信息。两档尺寸，可带图标。
  - 属性：`tone` · `size` · `state` · `bare`
  - 例：`<vk-tag>`
- **`vk-callout`** · 提示框 — 提示块：说明、正确、注意、错误。色条 + 淡底 + 图标，正文仍是墨色。
  - 属性：`tone` · `title` · `size` · `flat` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-callout tone="warn" title="越界不会报错" size="body">`
- **`vk-code`** · 代码窗 — 代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮。
  - 属性：`lang` · `src` · `lines` · `file` · `highlight` · `focus` · `fold` · `span` · `fold-note` · `surface` · `chrome` · `mark` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `fit` · `numbers` · `numbering` · `density`
  - 例：`<vk-code w="1360" lang="c" file="hello.c" src="../code/hello.c" lines="1-8" highlight="4" density="large">`
- **`vk-term`** · 终端 — 终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行。
  - 属性：`src` · `lines` · `title` · `prompt` · `surface` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-term w="1500" title="zsh" prompt="$" src="../code/hello.term">`
- **`vk-diff`** · 对比 — 对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。
  - 属性：`lang` · `src` · `lines` · `file` · `surface` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `variant` · `numbers` · `summary`
  - 例：`<vk-diff w="1280" lang="c" file="bounds.c" src="../code/real.diff">`
- **`vk-table`** · 表格 — 表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr data-em> 标出重点。
  - 属性：`variant` · `stripe` · `mono` · `density` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `fit`
  - 例：`<vk-table variant="ledger">`
- **`vk-math`** · 公式 — 公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。
  - 属性：`src` · `display` · `size` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-math display size="heading" w="1400" src="../code/formula.tex">`
- **`vk-figure`** · 图窗 — 画框里的图：标题栏、比例、说明、来源。
  - 属性：`src` · `alt` · `caption` · `fig` · `url` · `ratio` · `crop` · `fit` · `surface` · `chrome` · `w` · `bare` · `h` · `grow` · `fill` · `overflow` · `measure` · `position`
  - 例：`<vk-figure w="1200" fig="01" caption="一张 16:9 的图" ratio="16 / 9" crop="76.25,32.22,12.5,23.33" src="../assets/img/sample.svg" alt="一张示例图">`
- **`vk-tree`** · 文件树 — 文件树：src 指向真实目录，构建期扫描层级、类型、大小。
  - 属性：`src` · `title` · `active` · `collapsed` · `limit` · `summary` · `depth` · `hidden` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-tree title="app" active="src/parser.py" depth="4">`
- **`vk-keys`** · 键位 — 键位：把 A + B 写成两枚键帽。
  - 属性：（无）
  - 例：`<vk-keys>`
- **`vk-cells`** · 内存格 — 一行连续的内存格：标签、值、地址；flag 标出越界的那一格。
  - 属性：`values` · `labels` · `spans` · `pad` · `mark` · `addr` · `cols` · `flag` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `stride`
  - 例：`<vk-cells values="0x2a|'h'|…" labels="int x|y|填充 3 字节" spans="4|1|3" pad="2" addr="0x7ffc" stride="1">`
- **`vk-bytes`** · 字节 — 字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，highlight 标出一段字节。
  - 属性：`src` · `addr` · `offset` · `length` · `cols` · `group` · `ascii` · `address` · `highlight` · `density` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bytes w="1360" src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" highlight="0-5">`
- **`vk-frames`** · 栈帧 — 栈帧：src 指向真实 JSON；一帧一组槽位，标出当前帧、地址与生长方向。
  - 属性：`src` · `title` · `active` · `grows` · `show` · `summary` · `density` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-frames w="1400" src="../code/stack.json" active="3" density="compact">`
- **`vk-steps`** · 步骤 — 步骤条：编号 + 连线 + 当前步。条目写成 <li>。
  - 属性：`current` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `orientation` · `density`
  - 例：`<vk-steps current="2">`
- **`vk-quote`** · 引文 — 一段引文：出处、作者；左侧竖线或压角引号。
  - 属性：`source` · `author` · `variant` · `size` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-quote w="1280" source="C11 §6.7.3" author="ISO/IEC 9899">`
- **`vk-bits`** · 位 — 一行二进制位：索引、分组、符号位。
  - 属性：`value` · `index` · `group` · `sign` · `label` · `tone` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bits value="1111 1111" index="7-0" group="4" sign label="有符号视角：-1">`
- **`vk-bars`** · 条 — 一组横向条：标签、数值条、单位。子节点写成 <i value label>。
  - 属性：`max` · `scale` · `unit` · `density` · `tone` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bars w="1280" max="1000000" scale="log" unit="ns">`

### L4 关系 · 两点之间的关系与批注

- **`vk-edge`** · 连线 — 两点之间的连线。自己算锚点，三种形状。
  - 属性：`from` · `to` · `from-side` · `to-side` · `shape` · `tension` · `label` · `tone` · `arrow` · `arrow-style` · `arrow-size` · `dash` · `gap` · `bend` · `cap` · `clearance` · `label-size` · `label-dx` · `label-dy`
  - 例：`<vk-edge from="#buf" to="#mem" label="指向" tension="42" arrow-style="solid" arrow-size="36">`
- **`vk-annotate`** · 行旁批注 — 把批注绑到代码行：按行心对齐、贴在该行右侧；引线只服务非代码目标。
  - 属性：`w`
  - 例：`<vk-annotate w="327">`
- **`vk-note`** · 讲解条 — 一条讲解：line 指向代码行，for 指向任意元素，由 vk-annotate 组织。
  - 属性：`n` · `line` · `span` · `tone` · `size` · `for` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `emphasis`
  - 例：`<vk-note tone="accent" size="body">`

### L5 页面 · 一整张 1920×1080 的画布

- **`vk-page`** · 页面 — 1080p 画布工具：安全区、可选页眉页脚、按容器宽度缩放。
  - 属性：`header` · `footer` · `align` · `surface` · `fit`
  - 例：`<vk-page>`
<!-- vk:tags:end -->
