# vk 契约（生成物，不要手改）

画布 1920×1080，版心 1680×888。观众在手机横屏看，实际约 780 宽（0.406×）。
最小可读字号 **44px**（手机 17.9px）。索引一律 1 起；-1 = 没有当前。

## 一帧的容量

| 项 | 一帧最多 |
|---|---|
| 行级单元（合计） | 8 |
| 代码行 | 6 |
| 终端行 | 7 |
| diff 行 | 5 |
| 汇编行 | 5 |
| 表格数据行 | 4 |
| 文件树行 | 5 |
| 内存格行 | 2 |
| 位 | 16 |
| 步骤（横排） | 5 |
| 横条 | 6 |
| 时间线点 | 4 |

## 字号

| 档 | px | 手机 | 用在哪 |
|---|---|---|---|
| caption | 48 | 19.5 | 元信息（来源、单位、编号） |
| body | 56 | 22.7 | 正文与数据（地板） |
| subhead | 84 | 34.1 | 一句话的主张 |
| headline | 132 | 53.6 | 一帧的标题 |
| display | 200 | 81.2 | 一页最多一次 |
| hero | 280 | 113.7 | 一个数字 / 一个词 |

## 标签

### L0 画布

**`vk-page`** · 画布 —— 一帧 1920×1080 的坐标系。align 决定内容在版心（1680×888）里的纵向位置。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `id` | 文本 | — |  | 帧名（出图文件名） |
| `align` | band / center / top / bottom | band |  | 纵向对齐 |
| `surface` | paper / dark | paper |  | 底色 |

### L1 排布

**`vk-stack`** · 竖排 —— 把子项按一条轴排开，只给间距、对齐和份数。不画任何东西。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `gap` | 间距 | normal |  | 间距（档名或像素） |
| `direction` | column / row | column |  | 方向 |
| `pad` | 间距 | none |  | 内距（档名或像素） |
| `align` | start / center / end / stretch | stretch |  | 交叉轴 |
| `justify` | start / center / end / between | start |  | 主轴 |
| `weights` | 序列 | — |  | 按份数分剩余高度，如 "1 2 1" |

**`vk-grid`** · 网格 —— 12 栏网格。子项用 span / row-span 占份；列宽由份数算出，不能手写像素。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `cols` | 整数 | 2 | 1–12 | 列数 |
| `ratio` | 序列 | — |  | 按比例分列，如 "1 8 23"（写了就不看 cols） |
| `pad` | 间距 | none |  | 内距（档名或像素） |
| `gap` | 间距 | normal |  | 间距（档名或像素） |
| `align` | start / center / end / stretch | stretch |  | 纵向对齐 |

**`vk-canvas`** · 坐标画布 —— 坐标空间：子项用 x / y 明确摆放。只有这里认 x / y / w / h / z。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `w` | 数字 | — | 48–1920 | 宽（不写按内容） |
| `h` | 数字 | — | 48–1080 | 高（不写按内容） |
| `pad` | 间距 | none |  | 内距（档名或像素） |

**`vk-layer`** · 叠层 —— 叠放：第一个子项铺满当底，其余按顺序叠上去。它只负责叠，不画面。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `pad` | 间距 | none |  | 内距（档名或像素） |

**`vk-pair`** · 并置 —— 两块并置对照：左右（或上下）两块，中间一条轴，轴上可放 → / = / vs。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `split` | 数字 | 50 | 20–80 | 左块占比（%） |
| `direction` | horizontal / vertical | horizontal |  | 方向 |
| `symbol` | none / → / = / vs | none |  | 轴上符号 |
| `gap` | 间距 | wide |  | 间距（档名或像素） |

### L2 面与字

**`vk-box`** · 面 —— 一块面：底、描边、圆角、内距，可带标题带与窗头。它只描述这一块，不排别人。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `surface` | none / paper / soft / tint / dark | none |  | 表面 |
| `tone` | neutral / info / focus / ok / warn / err | neutral |  | 语调 |
| `pad` | 间距 | normal |  | 内距（档名或像素） |
| `radius` | none / md / pill | md |  | 圆角 |
| `border` | none / hair / strong | none |  | 描边 |
| `title` | 文本 | — |  | 标题（写了才有标题带） |
| `chrome` | none / dots | none |  | 窗头三点 |
| `ring` | 开关 | — |  | 强调环（不占布局） |

**`vk-text`** · 文字 —— 一段文字：字号、字重、墨阶、对齐、行宽。行内可用 <em> 强调、<strong> 加重、<mark> 标一段原文。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `size` | caption / body / subhead / headline / display / hero | body |  | 字号 |
| `weight` | regular / medium / bold | regular |  | 字重 |
| `ink` | primary / secondary / muted | primary |  | 墨阶 |
| `tone` | neutral / focus | neutral |  | 语调 |
| `align` | left / center / right | left |  | 对齐 |
| `measure` | 行宽 | — |  | 行宽（字数；none = 铺满） |
| `icon` | 文本 | — |  | 图标（Lucide 名） |
| `mono` | 开关 | — |  | 等宽 |

**`vk-label`** · 标签 —— 一行小字：分类、编号、状态。kicker 纯字 / chip 浅底 / badge 实色。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `variant` | kicker / chip / badge | kicker |  | 形态 |
| `tone` | neutral / info / focus / ok / warn / err | neutral |  | 语调 |
| `icon` | 文本 | — |  | 图标（Lucide 名） |
| `counter` | 文本 | — |  | 序号，如 "3 / 5" 或 "03" |

**`vk-inline`** · 行内 —— 句子里的行内元素：代码、公式、上下标、键位。字号跟着所在文本走。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `variant` | code / math / sup / sub / keys | code |  | 形态 |

**`vk-img`** · 图片 —— 一张图：比例、填充方式、焦点。默认完整显示（contain），要裁切得明说。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 图片地址 |
| `alt` | 文本 | — |  | 替代文字 |
| `ratio` | 文本 | — |  | 比例，如 "16 / 9" |
| `fill` | cover / contain | contain |  | 填充（cover 会裁掉超出的部分） |
| `radius` | none / md / pill | md |  | 圆角 |
| `position` | 文本 | 50% 50% |  | 焦点 |

### L3 内容

**`vk-code`** · 代码 —— 代码窗。构建期高亮；可截取真实文件的行段，标当前行、聚光、折叠。
  一帧容量：8 行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `lang` | 文本 | — |  | 语言 |
| `src` | 文本 | — |  | 源文件 |
| `lines` | 文本 | — |  | 行段，如 "4-6" |
| `file` | 文本 | — |  | 窗头文件名 |
| `current` | 行段 | — |  | 当前行（1 起） |
| `focus` | 行段 | — |  | 聚光行 |
| `fold` | 行段 | — |  | 折叠行（缺口） |
| `size` | caption / body / subhead | body |  | 字号 |
| `long` | clip / wrap | clip |  | 长行 |
| `chrome` | min / none | min |  | 窗头 |
| `mark` | 文本 | — |  | 标出的词（窗口里所有出现处） |

src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。构建期高亮，运行期零依赖。

**`vk-term`** · 终端 —— 终端 transcript：提示符、命令、输出、报错各自一色。
  一帧容量：10 行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 源文件 |
| `title` | 文本 | — |  | 窗头标题 |
| `prompt` | 文本 | $ |  | 提示符 |
| `current` | 行段 | — |  | 当前行（1 起） |
| `size` | caption / body / subhead | body |  | 字号 |
| `surface` | paper / dark | paper |  | 表面 |
| `chrome` | min / none | min |  | 窗头 |

src 指向真实 transcript，或内联 <script type="text/plain" data-vk-source>；每行一条命令或一段输出。

**`vk-diff`** · 改动 —— diff：原生 diff 文本，加/删/同各自一色，底部一句改了几行。
  一帧容量：8 行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 源文件 |
| `file` | 文本 | — |  | 窗头文件名 |
| `lang` | 文本 | — |  | 语言（给改动行上语法色） |
| `current` | 行段 | — |  | 当前行（1 起） |
| `size` | caption / body / subhead | body |  | 字号 |

src 指向真实 diff 文本，或内联 <script type="text/plain" data-vk-source>。

**`vk-table`** · 表格 —— 表格：原生 <table>，数字列自动右对齐、等宽数字。行可写 tone / state。
  一帧容量：5 数据行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `mono` | 开关 | — |  | 等宽 |
| `size` | caption / body / subhead | body |  | 字号 |
| `caption` | 文本 | — |  | 表题（表上方一行小字） |

写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err" state="current"。

**`vk-list`** · 列表 —— 列表：要点 / 清单 / 有序。条目写成 <li>。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `variant` | bullet / check / ordered | bullet |  | 形态 |
| `gap` | 间距 | close |  | 间距（档名或像素） |
| `size` | caption / body / subhead | body |  | 字号 |

每一项写成 <li>；可写 tone 标语义、state="current" 标当前。

**`vk-math`** · 公式 —— 公式：src 指向真实 .tex，构建期用 KaTeX 排版，运行期零依赖。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 源文件 |
| `display` | 开关 | — |  | 独立成行 |
| `size` | caption / body / subhead | body |  | 字号 |

src 指向 .tex 文件，或内联 <script type="text/plain" data-vk-source> 写 TeX。

**`vk-tree`** · 文件树 —— 文件树：src 指向真实目录，构建期扫描层级；缩进与树线是真的，不是列表。
  一帧容量：5 行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 目录 |
| `title` | 文本 | — |  | 窗头标题 |
| `depth` | 整数 | 3 | 1–6 | 最大深度 |
| `max` | 整数 | 10 | 1–40 | 最多显示几行（超了会留一行说明） |
| `current` | 文本 | — |  | 当前节点路径 |
| `size` | caption / body / subhead | body |  | 字号 |
| `icons` | auto / none | auto |  | 图标 |
| `icon-dir` | 文本 | — |  | 目录图标（Lucide 名） |
| `icon-code` | 文本 | — |  | 代码文件图标 |
| `icon-binary` | 文本 | — |  | 二进制文件图标 |
| `icon-file` | 文本 | — |  | 普通文件图标 |
| `chrome` | min / none | min |  | 窗头 |

src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。

**`vk-asm`** · 汇编 —— 汇编清单：地址 / 机器码 / 指令 / 操作数四列。行与地址都能被锚定。
  一帧容量：8 行。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 源文件（objdump 文本） |
| `lines` | 文本 | — |  | 行段 |
| `file` | 文本 | — |  | 窗头文件名 |
| `current` | 行段 | — |  | 当前行（1 起） |
| `size` | caption / body / subhead | body |  | 字号 |
| `chrome` | min / none | min |  | 窗头 |
| `bytes` | 开关 | — |  | 显示机器码列（默认不显示） |

src 指向 objdump 文本，或内联 <script type="text/plain" data-vk-source>。

**`vk-cells`** · 内存格 —— 一格一个 <li>：标签、值、地址。地址由 addr + 序号 × stride 算出，不手写。
  一帧容量：2 行（cols 列一行）。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `addr` | 文本 | — |  | 起始地址，如 "0x1000" |
| `stride` | 整数 | 1 |  | 每格占几字节（int 数组写 4） |
| `cols` | 整数 | 4 | 1–8 | 每行几格 |
| `current` | 序号 | -1 |  | 当前项（1 起；-1 = 没有） |
| `markers` | 文本 | — |  | 额外的指针，如 "lo:1,hi:8,mid:3"（最多 3 个） |
| `size` | caption / body / subhead | body |  | 字号 |

<li value="61" label="s[0]">；地址自动按 addr + 序号 × stride 算。

**`vk-bytes`** · 字节 —— 字节窗：src 指向真实二进制；十六进制 + ASCII + 地址，current 标出一段。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `src` | 文本 | — |  | 二进制文件 |
| `addr` | 文本 | 0x0 |  | 起始地址 |
| `offset` | 整数 | 0 |  | 起始字节 |
| `length` | 整数 | 32 | 1–4096 | 字节数 |
| `cols` | 4 / 8 | 8 |  | 每行几列 |
| `current` | 文本 | — |  | 当前字节段，如 "4-7"（1 起） |

src 指向真实二进制文件。数值是读出来的，不是手写的。

**`vk-bits`** · 位 —— 一行二进制位：索引、分组、符号位。用来讲位域与浮点布局。
  一帧容量：16 位（32 位请用 index="sparse"）。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `value` | 文本 | — |  | 位串，可含空格；用 | 分段（符号 | 指数 | 尾数） |
| `label` | 文本 | — |  | 左边一行说明 |
| `index` | down / up / none / sparse | down |  | 位序号：down 按位权 7,6,5…；up 从左往右数 0,1,2…；sparse 只标 8 的倍数 |
| `group` | 1 / 4 / 8 | 4 |  | 分组 |
| `sign` | 开关 | — |  | 标出符号位 |
| `size` | caption / body / subhead | body |  | 字号 |

### L4 图

**`vk-steps`** · 步骤 —— 步骤条：编号 + 连线 + 当前步。条目写成 <li>；容器窄时自动竖排，不压字。
  一帧容量：5 步（横排）。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `current` | 序号 | -1 |  | 当前项（1 起；-1 = 没有） |
| `direction` | auto / horizontal / vertical | auto |  | 方向 |
| `connector` | arrow / line / none | arrow |  | 连接线 |
| `size` | caption / body / subhead | body |  | 字号 |

每一步写成 <li>；可写 tone 标语义。

**`vk-bars`** · 条 —— 一组横向条：标签、值、单位。用来讲大小对比。
  一帧容量：6 条。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `max` | 数字 | — |  | 最大值（不写按最大一条） |
| `unit` | 文本 | — |  | 单位 |
| `tone` | neutral / info / focus / ok / warn / err | neutral |  | 语调 |
| `scale` | linear / log | linear |  | 刻度 |
| `size` | caption / body / subhead | body |  | 字号 |

<li value="120" label="hello.o">；值写数字，不写单位。

**`vk-timeline`** · 时间线 —— 时间线：等距事件（不按年份比例）或多泳道。一条事项一个 <li>。
  一帧容量：4 点。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `variant` | events / lanes | events |  | 形态 |
| `start` | 文本 | — |  | 起点 |
| `end` | 文本 | — |  | 终点 |
| `lanes` | 文本 | — |  | 泳道名（逗号分隔） |
| `size` | caption / body / subhead | body |  | 字号 |
| `current` | 序号 | -1 |  | 当前项（1 起；-1 = 没有） |

<li date="1972" label="C 诞生" note="小字说明">；lanes 形态写 lane="名字"。

**`vk-compare`** · 对照 —— 两张图对照：默认左右并排（每张完整、不裁），也可上下；可标差异框。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `labels` | 文本 | — |  | 两张图与角标："a.png,b.png|改前|改后" |
| `variant` | side / stack | side |  | 形态 |
| `mark` | 文本 | — |  | 差异框：x1,y1,x2,y2（%；多组用 ;） |

### L5 关系

**`vk-callout`** · 标注 —— 画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标（按字的范围取框，不按整行盒子），note 是带引线的注释气泡，badge 是编号点。它不改布局。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `span` | 整数 | 1 | 1–12 | 占几份 |
| `row-span` | 整数 | 1 | 1–12 | 跨几行 |
| `grow` | 开关 | — |  | 吃掉剩余空间 |
| `bleed` | x / all | — |  | 出血到画布边 |
| `mode` | arrow / ring / note / badge | arrow |  | 形态 |
| `for` | 锚点 | — |  | 目标 |
| `from` | 锚点 | — |  | 起点 |
| `to` | 锚点 | — |  | 终点 |
| `side` | auto / top / right / bottom / left | auto |  | 优先贴哪一侧（放不下会自动顺延） |
| `gap` | 间距 | normal |  | 间距（档名或像素） |
| `shape` | straight / ortho / curve | curve |  | 连线形状 |
| `label` | 文本 | — |  | 连线上的字 |
| `tone` | neutral / info / focus / ok / warn / err | info |  | 语调 |
