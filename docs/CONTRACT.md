# vk 契约 25.0.0

画布 1920×1080，版心 1680×888（左右 120 / 上下 96）。观众在手机横屏看，实际约 780 宽（0.406×）。
索引一律 1 起。字只从 vocab 来，这份文档由 `vk brief --md` 生成。

## 规则

- 可见文字写成元素内容；kicker / counter / lede / note / date / value 才是属性。
- current 写在项上（布尔）；code 的 code/term/diff/asm/bytes 与 bits 用行段；dir 用路径。
- 用 lede 写“为什么看这里”，正文里的重点用 mark。
- src 载体：code/term/diff/asm 用 data-vk-source，math 写 TeX，bytes 写十六进制，dir 用 data-vk-tree。
- 主题：page theme="light|dark"；card surface="paper|soft|dark"。
- span / bleed 只写在 <vk-flow> 的直接子项上；bleed="all" 只给 <vk-img>。

## 骨架

```html
<vk-page>
  <vk-head kicker="第 1 集 · 主题" counter="1 / 8">一句<mark>结论</mark>。</vk-head>
  <vk-code lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
    </script>
  </vk-code>
  <vk-text ink="secondary">一句解释。</vk-text>
</vk-page>
```

## 字号

| 档 | px | 手机 | 行高 | 行宽（字） |
|---|---|---|---|---|
| caption | 56 | 22.7 | 1.5 | 26 |
| body | 64 | 26.0 | 1.5 | 25 |
| subhead | 96 | 39.0 | 1.35 | 18 |
| headline | 144 | 58.5 | 1.3 | 13 |
| display | 216 | 87.7 | 1.2 | 8 |
| hero | 300 | 121.8 | 1.1 | 4 |

## 间距

档名：none=0 / close=16 / normal=32 / wide=64 / section=96；也可以写像素数（gap="48"）。

## flow 子项

任何块级件放进 <vk-flow> 后还可以写：`span` / `bleed`。

## 标签


### L0 画布

**`vk-page`** · 画布 —— 一帧 1920×1080 的坐标系。子项直接写，不用再包一层；place 决定标题带与正文在版心里的纵向位置。

#### 画布 —— 一帧 1920×1080 的坐标系。子项直接写，不用再包一层；place 决定标题带与正文在版心里的纵向位置。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `place` | band / top / center / bottom | band |  | 竖排：band 标题带锁顶、正文居中；center 整块居中 |
| `theme` | light / dark | light |  | 主题：light / dark |

直接写 <vk-head> 与内容；下一层要分栏时写 <vk-flow>。

```html
<vk-page place="band" theme="light">…</vk-page>
```

**`vk-head`** · 标题带 —— 一帧的起手：眉标 + 标题 +（可选）一句为什么。位置与间距固定，帧与帧的标题不会跳。

#### 标题带 —— 一帧的起手：眉标 + 标题 +（可选）一句为什么。位置与间距固定，帧与帧的标题不会跳。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `kicker` | 文本 | — |  | 眉标（集数 / 分类） |
| `counter` | 文本 | — |  | 序号，如 "3 / 8"（等宽，跟在眉标后） |
| `lede` | 文本 | — |  | 导语：这一帧的「为什么」 |
| `size` | subhead / headline / display | headline |  | 标题字号 |
| `align` | left / center | left |  | 对齐 |

标签里的文字就是标题，可以写 <mark> / <code> / <vk-math inline>。

```html
<vk-head kicker="第 1 集 · 指针" counter="1 / 8" lede="一句为什么。">标题<mark>重点</mark></vk-head>
```


### L1 排布

**`vk-flow`** · 流 —— 唯一的排布：列数（或比例、auto）由容器给，子项用 span 跨栏；overlay 叠放；valign 管子项纵向。不画任何东西。

可用 flow 子项属性：`span` / `bleed`。

#### 流 —— 唯一的排布：列数（或比例、auto）由容器给，子项用 span 跨栏；overlay 叠放；valign 管子项纵向。不画任何东西。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `cols` | 列 | 1 |  | 列：1–12、比例 "1 2 1"、或 auto（按内容宽） |
| `gap` | 间距 | normal |  | 分栏间距（档名或像素） |
| `valign` | start / center / end / between / stretch | stretch |  | 子项纵向对齐 |
| `overlay` | 开关 | — |  | 叠放：子项落在同一格里 |

子项直接写；span / bleed 只在这里生效。

```html
<vk-flow cols="7 5" gap="wide"><vk-code …></vk-code><vk-text>右侧批注</vk-text></vk-flow>
```


### L2 面与字

**`vk-card`** · 卡片 —— 一块有材质的面：paper / soft / dark。边框、圆角、内距由库决定；可带标题栏。

可用 flow 子项属性：`span` / `bleed`。

#### 卡片 —— 一块有材质的面：paper / soft / dark。边框、圆角、内距由库决定；可带标题栏。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `surface` | paper / soft / dark | paper |  | 材质：paper 白纸 / soft 软底 / dark 暗面 |
| `title` | 文本 | — |  | 标题（写了才有标题带） |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语义：给整块面换一档语义色（对照 / 对错示范） |

卡片里放块级内容；纯分组用 <vk-flow>，卡片是「一块面」。

```html
<vk-card surface="paper" title="输出"><vk-text>一行说明。</vk-text></vk-card>
```

**`vk-text`** · 文字 —— 一段文字：字号、墨阶、对齐、行首图标。行内可用 <em> 强调、<strong> 加重、<mark> 标原文、<code> 行内代码、<kbd> 键位。

可用 flow 子项属性：`span` / `bleed`。

#### 文字 —— 一段文字：字号、墨阶、对齐、行首图标。行内可用 <em> 强调、<strong> 加重、<mark> 标原文、<code> 行内代码、<kbd> 键位。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `size` | caption / body / subhead / headline / display / hero | body |  | 字号 |
| `ink` | primary / secondary / muted | primary |  | 墨阶 |
| `align` | left / center / right | left |  | 对齐 |
| `icon` | 文本 | — |  | 行首图标（Lucide 名） |

文字写在这里；块级内容请包 <vk-flow>。

```html
<vk-text size="body" ink="secondary">一句解释。</vk-text>
```

**`vk-img`** · 图片 —— 一张图：比例、填充方式、焦点。默认完整显示（contain），要裁切得明说；bleed="all" 可整帧铺满当底。

可用 flow 子项属性：`span` / `bleed`。

#### 图片 —— 一张图：比例、填充方式、焦点。默认完整显示（contain），要裁切得明说；bleed="all" 可整帧铺满当底。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `src` | 文本 | — |  | 图片地址 |
| `alt` | 文本 | — |  | 替代文字（图坏了会显示） |
| `ratio` | 文本 | — |  | 比例，如 "16 / 9" |
| `fill` | cover / contain | contain |  | 填充（cover 会裁掉超出的部分） |
| `position` | 文本 | 50% 50% |  | 焦点 |

图片标签里不写内容。

```html
<vk-img src="shot.png" ratio="16 / 9" fill="cover" alt="截图"></vk-img>
```


### L3 机制

**`vk-code`** · 文本网格 —— 等宽文本的网格：源码、终端、改动、汇编、字节、位。构建期高亮/解析，运行期零依赖。用 as 选一种。

可用 flow 子项属性：`span` / `bleed`。

#### 源码 · as="code" —— 真实源码：语法高亮、行号、当前行、折叠、标词。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `lang` | 文本 | — |  | 语言，如 c / js / py（必填：不写就没有语法色）；必填 |
| `src` | 文本 | — |  | 源文件 |
| `range` | 单段行段 | — |  | 源文件行段，如 "4-6"（只接受单段；4- 表示到底） |
| `current` | 行段 | — |  | 当前行（窗口内第几行，1 起） |
| `fold` | 行段 | — |  | 折叠行（窗口内第几行） |
| `mark` | 文本 | — |  | 标出的词（窗口里所有出现处，按词边界；每个词就是一个 @item 锚点） |
| `size` | caption / body | body |  | 代码字号 |

src 指向真实文件，或内联 <script type="text/plain" data-vk-source>。

```html
<vk-code lang="c" title="a.c" current="2"><script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
</script></vk-code>
```

#### 终端 · as="term" —— 命令与输出：提示符、命令、输出各自一色。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `src` | 文本 | — |  | 记录文件 |
| `current` | 行段 | — |  | 当前行（窗口内第几行，1 起） |
| `size` | caption / body | body |  | 字号 |
| `prompt` | 文本 | $ |  | 提示符 |

src 指向 .txt/.log，或内联 <script type="text/plain" data-vk-source>。

```html
<vk-code as="term" title="bash"><script type="text/plain" data-vk-source>
$ cc hello.c -o hello
$ ./hello
hello
</script></vk-code>
```

#### 改动 · as="diff" —— 一段 diff：增删行、hunk 头、标词。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `lang` | 文本 | — |  | 语言（可选，用于给增删行上语法色） |
| `src` | 文本 | — |  | diff 文件 |
| `current` | 行段 | — |  | 当前行（窗口内第几行，1 起） |
| `mark` | 文本 | — |  | 标出的词 |
| `size` | caption / body | body |  | 字号 |

src 指向 .diff，或内联 <script type="text/plain" data-vk-source>。

```html
<vk-code as="diff" title="a.c"><script type="text/plain" data-vk-source>
- a[1] = 7;
+ a[1] = 8;
</script></vk-code>
```

#### 汇编 · as="asm" —— 汇编清单：地址、机器码、助记符、操作数。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `src` | 文本 | — |  | 反汇编文件 |
| `current` | 行段 | — |  | 当前行（窗口内第几行，1 起） |
| `hex` | 开关 | — |  | 显示机器码列 |
| `size` | caption / body | body |  | 字号 |

src 指向 objdump 输出，或内联 <script type="text/plain" data-vk-source>。

```html
<vk-code as="asm" hex current="2"><script type="text/plain" data-vk-source>
0x1004 48 89 f8 mov %rdi,%rax
0x1007 48 01 f0 add %rsi,%rax
</script></vk-code>
```

#### 字节 · as="bytes" —— 十六进制转储：地址 + 十六进制 + ASCII 三列。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `src` | 文本 | — |  | 二进制文件 |
| `addr` | 文本 | 0x0 |  | 起始地址 |
| `offset` | 整数 | 0 | 0–65535 | 起始字节 |
| `length` | 整数 | 32 | 1–4096 | 字节数 |
| `cols` | 4 / 8 | 8 |  | 每行几列 |
| `current` | 行段 | — |  | 当前字节段，如 "4-7"（1 起） |

src 指向二进制；也可内联十六进制（68 65 6c 6c 6f）。

```html
<vk-code as="bytes" title="hello.bin" current="1-3"><script type="text/plain" data-vk-source>
68 65 6c 6c 6f
</script></vk-code>
```

#### 位 · as="bits" —— 一行二进制位：索引、分段、符号位。用 | 分段，field-labels 给每段起名。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | code / term / diff / asm / bytes / bits | code |  | 内容类型 |
| `title` | 文本 | — |  | 标题栏文字（文件名 / 命令行） |
| `value` | 文本 | — |  | 位串，可含空格；用 | 分段 |
| `current` | 行段 | — |  | 当前位段，如 "4-7"（1 起，从左数） |
| `label` | 文本 | — |  | 左边一行说明 |
| `field-labels` | 文本 | — |  | 各段名，逗号分隔（个数要与 | 的段数一致） |
| `index` | down / up / none / sparse | down |  | 位序号：down 按位权；up 从左数；sparse 只标 8 的倍数 |
| `sign` | 开关 | — |  | 标出符号位 |

位串写在 value 属性里。

```html
<vk-code as="bits" value="0|01111|0000000000" field-labels="符号,阶码,尾数" current="2-6"></vk-code>
```

**`vk-board`** · 条目图 —— 把条目排成一张图：要点、步骤、条、时间线、表格、内存格。一个 <li> 一项；用 as 选一种。

可用 flow 子项属性：`span` / `bleed`。

#### 列表 · as="list" —— 要点 / 清单 / 有序。条目写成 <li>。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `variant` | bullet / check / ordered | bullet |  | 形态 |

每一项写成 <li>；当前项写 current。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-board><li>取首地址</li><li current>加下标 × 4</li></vk-board>
```

#### 步骤 · as="steps" —— 编号 + 连线 + 当前步。容器窄时自动竖排。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `direction` | auto / horizontal / vertical | auto |  | 方向 |

每一步写成 <li>；当前步写 current。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `note` | 文本 | — |  | 小字说明 |
| `icon` | 文本 | — |  | 图标（Lucide 名） |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-board as="steps"><li icon="file-code">预处理</li><li icon="cpu" current>编译</li></vk-board>
```

#### 条 · as="bars" —— 一组横向条：标签、值、单位。值只写数字。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `max` | 数字 | — | ≥ 1 | 最大值（不写按最大一条） |
| `unit` | 文本 | — |  | 单位 |
| `scale` | linear / log | linear |  | 刻度 |

<li value="120">hello.o</li>；值写数字，不写单位。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `value` | 数字 | — | ≥ 0 | 数值 |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-board as="bars" unit="ms"><li value="6">解析</li><li value="24" current>链接</li></vk-board>
```

#### 时间线 · as="timeline" —— 一条轴上的点：给了 at + start/end 就按比例摆，否则等距。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `start` | 数字 | — |  | 起点（数字，如 1963） |
| `end` | 数字 | — |  | 终点 |

<li at="1972">C 诞生</li>；当前点写 current。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `at` | 数字 | — |  | 位置（数字） |
| `date` | 文本 | — |  | 日期标签（不写就用 at） |
| `note` | 文本 | — |  | 小字说明 |
| `icon` | 文本 | — |  | 节点图标（Lucide 名） |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-board as="timeline" start="1963" end="2010"><li at="1963">ASCII</li><li at="2010" icon="smile" current>Emoji</li></vk-board>
```

#### 表格 · as="table" —— 原生 <table>：数字列自动右对齐、等宽数字；行可写 tone / current。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `caption` | 文本 | — |  | 表题（表上方一行小字） |

写原生 <table>：<tr><th>…</th></tr>；行可写 tone="ok|warn|err"、current。

```html
<vk-board as="table" caption="读一次要多久"><table><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100ns</td></tr></table></vk-board>
```

#### 内存格 · as="cells" —— 一格一个 <li>：值、标签、指针、旧值。地址由 addr + 序号 × stride 算出。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | list / steps / bars / timeline / table / cells | list |  | 条目形态 |
| `addr` | 文本 | — |  | 起始地址，如 "0x1000" |
| `stride` | 整数 | 1 | 1–16 | 每格占几字节（int 数组写 4） |
| `cols` | 整数 | 4 | 1–8 | 每行几格 |

<li value="61" label="s[0]" ptr="lo">；地址自动算。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `value` | 文本 | — |  | 值 |
| `label` | 文本 | — |  | 标签 |
| `ptr` | 文本 | — |  | 指针名，如 "lo"（空格分隔多个） |
| `was` | 文本 | — |  | 旧值（显示「旧 → 新」） |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-board as="cells" addr="0x1000" stride="4"><li value="1" label="a[0]"></li><li value="2" label="a[1]" current></li></vk-board>
```

**`vk-graph`** · 关系图 —— 节点写成 <li id>文字</li>，边写在节点上（after="父id"）或写成独立子项（from/to，支持环、双向、边标）。

可用 flow 子项属性：`span` / `bleed`。

#### 关系图 —— 节点写成 <li id>文字</li>，边写在节点上（after="父id"）或写成独立子项（from/to，支持环、双向、边标）。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `as` | row / tree / layered / mesh | row |  | 布局 |
| `direction` | horizontal / vertical | horizontal |  | 方向（只对 row） |

<li id="a">head</li> → <li id="b" after="a">next</li>；不写 after 的节点是根。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `id` | 文本 | — |  | 节点 id（边用它引用） |
| `note` | 文本 | — |  | 节点下的小字 |
| `after` | 文本 | — |  | 父节点 id（空格分隔多个） |
| `lane` | 整数 | — | 0–9 | layered 布局里放第几条泳道 |
| `from` | 文本 | — |  | 显式边的起点 |
| `to` | 文本 | — |  | 显式边的终点 |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-graph><li id="a">head</li><li id="b" after="a">next</li></vk-graph>
```

**`vk-dir`** · 目录树 —— 目录层级：src 指向真实目录，构建期扫描；缩进与树线是真的。也可用内联 JSON 描述任意层级。

可用 flow 子项属性：`span` / `bleed`。

#### 目录树 —— 目录层级：src 指向真实目录，构建期扫描；缩进与树线是真的。也可用内联 JSON 描述任意层级。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `src` | 文本 | — |  | 目录 |
| `title` | 文本 | — |  | 标题栏文字 |
| `depth` | 整数 | 3 | 1–6 | 最大深度 |
| `limit` | 整数 | 6 | 1–40 | 最多显示几行（超了会留一行说明） |
| `current` | 文本 | — |  | 当前节点路径，如 "src/main.c" |

src 指向真实目录；也可用 <script type="text/plain" data-vk-tree> 写 JSON。

```html
<vk-dir><script type="text/plain" data-vk-tree>["src","README.md"]</script></vk-dir>
```

**`vk-seq`** · 时序 —— 两条以上生命线之间的往返：一行一条消息，按阅读顺序从上往下。2–4 个参与者。

可用 flow 子项属性：`span` / `bleed`。

#### 时序 —— 两条以上生命线之间的往返：一行一条消息，按阅读顺序从上往下。2–4 个参与者。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `participants` | 文本 | — |  | 参与者，逗号分隔，如 "客户端,服务端,缓存"（2–4 个） |
| `a` | 文本 | — |  | 左端名称（只有两条泳道时用） |
| `b` | 文本 | — |  | 右端名称（只有两条泳道时用） |

<li>SYN</li>；<li direction="left">SYN+ACK</li>；三条以上用 from/to="客户端"。

子项属性：

| 子项属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `from` | 文本 | — |  | 起点（参与者名或 1 起的序号） |
| `to` | 文本 | — |  | 终点 |
| `direction` | right / left | right |  | 方向（两条泳道时用） |
| `note` | 文本 | — |  | 消息下的小字 |
| `tone` | neutral / info / ok / warn / err | neutral |  | 语调 |
| `current` | 开关 | — |  | 当前项（写属性名，不写值） |

```html
<vk-seq a="客户端" b="服务端"><li>SYN</li><li direction="left">SYN+ACK</li><li>ACK</li></vk-seq>
```

**`vk-math`** · 公式 —— 公式：src 指向 .tex 或直接写 TeX，构建期用 KaTeX 排版，运行期零依赖。inline 写在句子里。

可用 flow 子项属性：`span` / `bleed`。

#### 公式 —— 公式：src 指向 .tex 或直接写 TeX，构建期用 KaTeX 排版，运行期零依赖。inline 写在句子里。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `src` | 文本 | — |  | 源文件 |
| `inline` | 开关 | — |  | 行内（跟在句子里） |
| `align` | left / center | center |  | 对齐 |

src 指向 .tex 文件；或把 TeX 直接写在标签里。

```html
<vk-math>T(n) = 2T(n/2) + O(n)</vk-math>
```


### L4 标注

**`vk-callout`** · 标注 —— 画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标，note 是带引线的气泡，measure 量两点之间。它不改布局。

#### 标注 —— 画在别人身上的一层：arrow 从一处指向另一处，ring 圈住目标，note 是带引线的气泡，measure 量两点之间。它不改布局。

| 属性 | 取值 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `mode` | arrow / ring / note / measure | arrow |  | 形态 |
| `for` | 锚点 | — |  | 目标；必填；只对 mode=ring|note |
| `from` | 锚点 | — |  | 起点；必填；只对 mode=arrow|measure |
| `to` | 锚点 | — |  | 终点；必填；只对 mode=arrow|measure |
| `label` | 文本 | — |  | 连线上的字；只对 mode=arrow|measure |
| `tone` | neutral / info / ok / warn / err | info |  | 语调 |

note 的文字写在这里；label 是连线上的字。

```html
<vk-callout mode="note" for="#c@line:2">这里改了 0 号字节</vk-callout>
```

