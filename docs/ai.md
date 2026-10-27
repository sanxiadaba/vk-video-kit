# vk 作者手册（写给 AI）

> 你在用**一个组件**，不是在建一套页面框架。  
> 每个标签离开兄弟节点也能成立；页面的编排、容器尺寸、页眉页脚是调用方的事。
> 属性细节在 [`docs/reference.md`](reference.md)；**速查表在文末，由 registry 生成，不要手改。**

---

## 1 · 组件自己成立

从任意一个标签开始，不需要先搭 `vk-page`：

```html
<vk-code src="code/hello.c" lines="4-6" highlight="2"></vk-code>
```

```html
<vk-memory w="720">
  <i label="stack" size="8 MB" grows="down">局部变量</i>
  <i label=".text" size="16 KB">机器码</i>
</vk-memory>
```

- 组件不要求父级、兄弟或整页上下文；`w` / `h` 是组件自己的尺寸，不写就按内容或容器。
- `vk-page` 只是可选的画布工具（1920×1080、安全区、缩放），不是入口，也不是必写项。
- 需要多组件拼一帧时，用 `vk-stack` / `vk-row` / `vk-grid` / `vk-canvas`；这是调用方的选择，库不规定。
- 深色是组件自己的 `surface="ink"`，不是整页开关。

## 2 · 三条硬规矩

1. **正文 ≥ 44 设计像素**。行号、文件名、图注、索引这类元数据用 28–40，并标 `data-meta`。
2. **焦点只有一个颜色**（钴蓝）。语义色（对/错/注意）只出现在色条、底色、图标上，**不写正文**。
3. **装不下就删内容，不缩字**。一行代码约 24 字符；带标题的一屏约 9 行代码。

## 3 · 内容从哪来（四套入口，别混）

| 数据类型 | 怎么写 | 谁在用 |
|---|---|---|
| 真实文件 | `src="code/hello.c"` + `lines="1-8"` | `code` `diff` `term` `tree` `bytes` `frames` `math` `asm` `figure` |
| 内联源码 | `<script type="text/plain" data-vk-source>…</script>` | 同上；短代码、聊天式 AI 产出一个 HTML 时用 |
| 结构化内容 | 子节点：`<li>` / `<i value label>` / 表格 `<table><tr>` | `list` `steps` `table` `bars` `memory` `timeline` |
| 一行值 | 属性串（用竖线分隔，见下例） | `cells` |

```html
<vk-cells values="1|2|3|0" labels="a[0]|a[1]|a[2]|a[3]" addr="0x7ffc" stride="4" flag="3"></vk-cells>
```

内联源码块不用把 `<` 写成 `&lt;`：

```html
<vk-code lang="c" file="hello.c">
  <script type="text/plain" data-vk-source>
#include <stdio.h>
int main(void) { return 0; }
  </script>
</vk-code>
```

`src` 与内联块**只能有一个**；同时出现构建期报错。长文件仍首选 `src`。

## 4 · 指到组件内部（批注 / 箭头）

`for` / `from` / `to` 接受两种写法：

```html
<vk-note for="#arr">整块看</vk-note>                    <!-- CSS 选择器 -->
<vk-note for="#cells@cell:3">越界的那一格</vk-note>      <!-- #id@part:arg -->
```

| part | 用在 | arg |
|---|---|---|
| `line` | `vk-code` / `vk-diff` / `vk-asm` | **源文件行号**（`lines="4-6"` 时就是 4–6） |
| `char` | `vk-code` | `行:起-止`，列**从 0 起**，左闭右开 |
| `cell` | `vk-cells` / `vk-table` | 字段下标 / `行,列`，**从 0 起** |
| `byte` | `vk-cells` / `vk-bytes` | 字节下标 / 偏移，**从 0 起** |
| `bit` | `vk-bits` | `行:位`，多行时用 `0:7` |
| `slot` | `vk-frames` | `帧:槽`，例如 `1:0` |
| `seg` | `vk-memory` | 段下标或段名 |
| `addr` | `vk-asm` | 指令地址 |
| `event` | `vk-timeline` | 事件下标 |
| `lane` | `vk-timeline` | 泳道名 |
| `row` | `vk-table` | 行下标 |
| `node` | `vk-tree` | 节点路径 |
| `step` | `vk-steps` | 下标 |
| `item` | `vk-list` | 下标 |

一句话：**代码用行号（身份），其余用下标（位置），一律从 0 起。**

覆盖层也只认锚点，`for` 可以逗号列多个：

```html
<vk-canvas w="1200" h="420">
  <vk-box id="cell" x="80" y="80" w="320" h="180">0x2a</vk-box>
  <vk-spotlight for="#cell" dim="0.72"></vk-spotlight>
  <vk-ring for="#cell" shape="ellipse" tone="err"></vk-ring>
  <vk-pin for="#cell" side="right" n="1">越界写入</vk-pin>
</vk-canvas>
```

行内讲一个字符区间，用 `span`（`vk-code` 写 `行:起-止`，`vk-note` 写 `起-止`）：

```html
<vk-annotate w="520">
  <vk-code id="arr" src="code/hello.c" lines="1-8" span="4:2-6"></vk-code>
  <vk-note line="4" span="2-6">这一行在改一个字节</vk-note>
</vk-annotate>
```

`vk-note` 用 `line` 时写在 `vk-annotate` 里，按行心对齐；用 `for` 时可以独立作为一条批注块。

`vk-canvas` 的子件用 `x` / `y` 定位（任意标签都能写，API 面板里不显示）：

```html
<vk-canvas w="1200" h="360">
  <vk-box id="a" x="0" y="80" w="360" h="200">…</vk-box>
  <vk-box id="b" x="720" y="80" w="360" h="200">…</vk-box>
  <vk-edge from="#a" to="#b"></vk-edge>
</vk-canvas>
```

结构体内存布局（字段占几格 / 填充 / 高亮 / 字节尺）：

```html
<vk-cells values="0x2a|'h'|…" labels="int x|char y|填充 3 字节"
          spans="4|1|3" pad="2" addr="0x7ffc" stride="1"
          offsets align></vk-cells>
```

`spans` / `pad` / `mark` 的编号都从 0 起（`mark` 是格序号，不是字节）；`offsets` 打开后字段下方出现字节尺，每格带 `@byte` 锚点；`direction="rtl"` 把字节尺倒过来看大端。地址按字段的起始字节算。图里指一个局部用 `crop="x,y,w,h"`：0–100，**按图片本身算**（cover / contain 下也准）。

## 5 · 工作循环（一个组件四步）

```bash
npx vk build page.html          # 预编译 + 校验；错在这里报
npx vk shot page.html           # 出 page.png（1920×1080）
npx vk shot page.html --phone   # 出 640 宽近似手机横屏
npx vk shot page.html --crop 900,300,600,300   # 出 1:1 局部
```

1. 写组件 → 2. `vk build` → 3. `vk shot` → 4. **看那张图**：有没有重叠、裁切、两条窗头、字太小。
   改完回到 2。`vk build` 的报错是给你的，按提示改，不要猜。`vk shot` 只是调用方拿静帧的一种方式，不是组件的职责。

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
| `源码里的 "<" 必须写成 "&lt;"` | 代码别手写进 HTML；用 `src` 或 `data-vk-source` 内联块 |
| `同时写了 src 与 data-vk-source` | 源码只能有一个入口；删掉一个 |
| `line 需要放在 vk-annotate / 代码旁边` | `line` 批注没有代码上下文；改用 `for` 指向元素 |

## 7 · 窗：一个组件，四种窗头

```html
<vk-window title="main.c">…</vk-window>
<vk-window chrome="browser" url="https://www.iso.org/standard/74528.html">…</vk-window>
<vk-window chrome="min" tone="err" title="编译器">…</vk-window>
<vk-window chrome="none" pad="none"><vk-code chrome="none" src="code/hello.c"></vk-code></vk-window>
```

`code` / `term` / `diff` / `asm` / `figure` / `tree` / `bytes` / `frames` 自带窗头；放进 `vk-window` 时要 `chrome="none"`。

## 8 · 没有动效

库不提供播放器、时间轴、逐行淡入、打字机。**静止帧就是成品**；动效在剪辑软件里做。

## 9 · 六个新标签（别再用 canvas 手摆）

| 要讲什么 | 用 | 最小写法 |
|---|---|---|
| 进程地址空间 | `vk-memory` | `<vk-memory><i label="stack" grows="down">…</i></vk-memory>` |
| 汇编 / 指令 | `vk-asm` | `<vk-asm src="a.s" highlight="3" bytes>` |
| 年份 / 事件 | `vk-timeline` | `<vk-timeline><i date="1972" label="C 诞生">…</i></vk-timeline>` |
| 线程交错 | `vk-timeline` | `<vk-timeline variant="lanes" steps="6" lanes="主线程,中断">…</vk-timeline>` |
| 指着某一格 / 某一行 | `vk-pin` `vk-ring` `vk-spotlight` | `<vk-ring for="#id@cell:3">` |

`vk-memory` / `vk-timeline` 收 `<i>` 子节点，不读 `src`；`vk-asm` 收 `src` 或内联块。

---

## 组件速查

<!-- vk:tags:start -->
### L1 原子 · 屏幕上真实存在的单个物件

- **`vk-box`** · 面 — 一个面：背景、描边、圆角、内距。不认识兄弟，不排别人。
  - 属性：`surface` · `tone` · `pad` · `pad-y` · `pad-x` · `radius` · `border` · `w` · `h` · `x` · `y` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-box border="hair" radius="xl" pad="lg" w="1200" h="560" surface="paper">`
- **`vk-text`** · 文字 — 一段文字：字阶、字重、墨阶、等宽、对齐、测量宽。
  - 属性：`size` · `weight` · `mono` · `align` · `measure` · `w` · `h` · `grow` · `fill` · `overflow` · `ink`
  - 例：`<vk-text size="body" measure="body">`
- **`vk-icon`** · 图标 — 一个符号。全量 Lucide 名字；四档尺寸；语义色与墨阶分开。label 是无障碍名称，不是可见文字。
  - 属性：`name` · `tone` · `label` · `ink` · `scale`
  - 例：`<vk-icon name="terminal" scale="lg">`
- **`vk-img`** · 图片 — 一张图：比例、填充方式、焦点。加载失败有可见占位。
  - 属性：`src` · `alt` · `ratio` · `fit` · `radius` · `w` · `h` · `position` · `border`
  - 例：`<vk-img w="1200" h="675" fit="contain" src="../assets/img/sample.svg" alt="一张 16:9 的示例图" radius="xl">`
- **`vk-rule`** · 分隔线 — 一根线。线宽三档；纯装饰或语义分隔。
  - 属性：`w` · `grow` · `fill` · `overflow` · `measure` · `variant`
  - 例：`<vk-rule>`
- **`vk-mark`** · 标记 — 行内标注：高亮、下划线、删除线、圈。只包文字，不改布局。
  - 属性：`tone` · `variant`
  - 例：`<vk-mark variant="highlight">`
- **`vk-window`** · 窗 — 一个窗：三点窗头、标题、地址栏或对话框；内容由作者放。
  - 属性：`title` · `url` · `chrome` · `tone` · `surface` · `pad` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-window w="1200" chrome="browser" url="http://127.0.0.1:5000/hello">`
- **`vk-keys`** · 键位 — 键位：把 A + B 写成两枚键帽。
  - 属性：（无）
  - 例：`<vk-keys>`

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
- **`vk-annotate`** · 行旁批注 — 代码 + 批注走廊的两列容器：批注按行心对齐，贴在该行右侧。
  - 属性：`w`
  - 例：`<vk-annotate w="327">`

### L3 器械 · 渲染一种编程数据的形状

- **`vk-title`** · 标题 — 标题：一句话主张 + 可选副题。
  - 属性：`index` · `eyebrow` · `sub` · `level` · `size` · `align` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-title index="01" eyebrow="字符串 · 内存" size="title" sub="改一个字符，改的是内存里的一个字节。">`
- **`vk-list`** · 列表 — 列表。要点 / 清单 / 定义；条目写成 <li>。步骤用 vk-steps。
  - 属性：`rule` · `bare` · `gap` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `variant`
  - 例：`<vk-list gap="sm">`
- **`vk-tag`** · 标签 — 一个小标签：状态、分类、元信息。两档尺寸，可带图标。
  - 属性：`tone` · `size` · `emphasis` · `bare`
  - 例：`<vk-tag>`
- **`vk-callout`** · 提示框 — 提示块：说明、正确、注意、错误。色条 + 淡底 + 图标，正文仍是墨色。
  - 属性：`tone` · `title` · `size` · `flat` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-callout tone="warn" title="越界不会报错" size="body">`
- **`vk-code`** · 代码窗 — 代码窗。构建期高亮；真实文件截取行段；聚光、缺口、整行高亮。
  - 属性：`lang` · `src` · `lines` · `file` · `highlight` · `focus` · `fold` · `span` · `fold-note` · `surface` · `chrome` · `mark` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `long` · `numbers` · `numbering` · `density`
  - 例：`<vk-code w="1360" lang="c" file="hello.c" src="../code/hello.c" lines="1-8" highlight="4" density="loose">`
- **`vk-term`** · 终端 — 终端。src 指向真实 transcript；默认浅色；命令、输出、✓/!/✗ 三种结果行。
  - 属性：`src` · `lines` · `title` · `prompt` · `surface` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `density`
  - 例：`<vk-term w="1500" title="zsh" prompt="$" src="../code/hello.term">`
- **`vk-diff`** · 对比 — 对比：上下对照或左右两窗并排，词级标记 + 一句改了几行。
  - 属性：`lang` · `src` · `lines` · `file` · `surface` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `variant` · `numbers` · `summary`
  - 例：`<vk-diff w="1280" lang="c" file="bounds.c" src="../code/real.diff">`
- **`vk-table`** · 表格 — 表格：账本 / 对照 / 规格三种形态，表头与数字列对齐。行可用 <tr data-em> 标出重点。
  - 属性：`variant` · `stripe` · `mono` · `density` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-table variant="ledger">`
- **`vk-math`** · 公式 — 公式。src 指向真实 .tex；构建期用 KaTeX 渲染成静态 HTML，运行时零依赖。
  - 属性：`src` · `display` · `size` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-math display size="heading" w="1400" src="../code/formula.tex">`
- **`vk-figure`** · 图窗 — 画框里的图：标题栏、比例、说明、来源。
  - 属性：`src` · `alt` · `caption` · `fig` · `url` · `ratio` · `crop` · `fit` · `surface` · `chrome` · `bare` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `position`
  - 例：`<vk-figure w="1200" fig="01" caption="一张 16:9 的图" ratio="16 / 9" crop="76.25,32.22,12.5,23.33" src="../assets/img/sample.svg" alt="一张示例图">`
- **`vk-tree`** · 文件树 — 文件树：src 指向真实目录，构建期扫描层级、类型、大小。
  - 属性：`src` · `title` · `active` · `collapsed` · `limit` · `summary` · `depth` · `hidden` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-tree title="app" active="src/parser.py" depth="4">`
- **`vk-cells`** · 内存格 — 一行连续的内存格：标签、值、地址；flag 标出越界的那一格。
  - 属性：`values` · `labels` · `spans` · `pad` · `marked` · `addr` · `cols` · `flag` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `stride` · `offsets` · `direction` · `align`
  - 例：`<vk-cells w="1360" values="0x2a|'h'|…" labels="int x|y|填充 3 字节" spans="4|1|3" pad="2" addr="0x7ffc" stride="1" offsets>`
- **`vk-bytes`** · 字节 — 字节窗：src 指向真实二进制；八列十六进制 + ASCII + 地址，highlight 标出一段字节。
  - 属性：`src` · `addr` · `offset` · `length` · `cols` · `group` · `ascii` · `address` · `highlight` · `density` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure` · `word` · `endian`
  - 例：`<vk-bytes w="1360" src="../code/hello.bin" addr="0x7ffc" offset="0" length="48" highlight="0-5">`
- **`vk-frames`** · 栈帧 — 栈帧：src 指向真实 JSON；一帧一组槽位，标出当前帧、地址与生长方向。
  - 属性：`src` · `title` · `active` · `grows` · `show` · `summary` · `density` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-frames w="1400" src="../code/stack.json" active="3" density="compact">`
- **`vk-steps`** · 步骤 — 步骤条：编号 + 连线 + 当前步。条目写成 <li>。
  - 属性：`current` · `density` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-steps current="2">`
- **`vk-quote`** · 引文 — 一段引文：出处、作者；左侧竖线或压角引号。
  - 属性：`source` · `author` · `variant` · `size` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-quote w="1280" source="C11 §6.7.3" author="ISO/IEC 9899">`
- **`vk-bits`** · 位 — 一行二进制位：索引、分组、符号位。
  - 属性：`value` · `index` · `group` · `sign` · `label` · `tone` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bits w="1240" group="4" sign>`
- **`vk-bars`** · 条 — 一组横向条：标签、数值条、单位。子节点写成 <i value label>。
  - 属性：`max` · `mode` · `unit` · `density` · `tone` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-bars w="1280" max="1000000" mode="log" unit="ns">`
- **`vk-memory`** · 内存图 — 地址空间：text / data / bss / heap / stack 一段一段摆开，标地址、大小与生长方向。
  - 属性：`title` · `addr` · `unit` · `mode` · `show` · `orientation` · `density` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-memory w="1280" addr="0x7fff_ffff" unit="B" title="进程地址空间">`
- **`vk-asm`** · 汇编 — 汇编清单：地址 / 机器码 / 指令 / 操作数四列；行与地址都能被连线锚定。
  - 属性：`lang` · `src` · `lines` · `file` · `highlight` · `focus` · `addr` · `title` · `bytes` · `address` · `density` · `chrome` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-asm w="1360" title="main.s" lines="1-13" highlight="6" bytes>`
- **`vk-timeline`** · 时间线 — 时间线：等距事件列表（不按年份比例），或按步展开的多泳道；一条事项一个 <i>。
  - 属性：`start` · `end` · `variant` · `steps` · `lanes` · `title` · `density` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-timeline w="1500" start="1972" end="2018" lanes="A,B" title="C 的五十年">`

### L4 关系 · 两点之间的关系与批注

- **`vk-edge`** · 连线 — 两点之间的连线。自己算锚点，三种形状。
  - 属性：`from` · `to` · `from-side` · `to-side` · `shape` · `tension` · `label` · `tone` · `emphasis` · `arrow` · `arrow-style` · `arrow-size` · `dash` · `gap` · `bend` · `cap` · `clearance` · `label-size` · `label-dx` · `label-dy` · `via`
  - 例：`<vk-edge from="#buf" to="#mem" label="指向" tension="42" arrow-style="solid" arrow-size="36">`
- **`vk-note`** · 讲解条 — 一条讲解：line 指向代码行，for 指向任意元素；可独立使用，也可放进 vk-annotate。
  - 属性：`n` · `line` · `span` · `tone` · `surface` · `size` · `for` · `w` · `h` · `grow` · `fill` · `overflow` · `measure`
  - 例：`<vk-note tone="accent" size="body">`
- **`vk-pin`** · 批注气泡 — 自由批注：气泡 + 引线绑到任意锚点，不改布局；放在 canvas 或 page 里。
  - 属性：`for` · `side` · `x` · `y` · `n` · `tone` · `surface` · `leader` · `gap` · `w` · `size` · `z`
  - 例：`<vk-pin for="#pin-target" side="right" tone="err" n="1">`
- **`vk-ring`** · 圈选 — 圈选/框选/下划线：绑到任意锚点，只画覆盖层，不改布局。
  - 属性：`for` · `shape` · `pad` · `tone` · `dash` · `width` · `z`
  - 例：`<vk-ring for="#ring-target" shape="ellipse" tone="err" pad="16" dash>`
- **`vk-spotlight`** · 聚光 — 聚光：除目标外整体压暗，可多目标；放在 canvas 或 page 里。
  - 属性：`for` · `dim` · `feather` · `surface` · `shape` · `z`
  - 例：`<vk-spotlight for="#spot-target" dim="0.72" feather="24">`

### L5 页面 · 一整张 1920×1080 的画布

- **`vk-page`** · 坐标系 — 坐标系根：一张 1920×1080、原点在左上的画布；不缩放，不含页眉页脚。
  - 属性：`align` · `surface`
  - 例：`<vk-page>`
<!-- vk:tags:end -->
