# 写一帧

一帧 = 一个 `<vk-page>`。1920×1080，版心 **1680×888**（左右 120 / 上下 96）。
观众在手机横屏看，整帧缩到约 **693 宽（0.361×）**。一帧只说一件事。

数字不在这里抄：`vk doc <tag>` 看一个件，`vk brief` 看全部契约，`vk brief --md` 看错误码表。

## 一、结构：page → head → 内容

```html
<vk-page>
  <vk-head kicker="第 3 集 · 指针" counter="1 / 8" lede="下标是偏移量，不是编号。">下标是<mark>偏移量</mark>。</vk-head>
  <vk-code lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
    </script>
  </vk-code>
  <vk-text ink="secondary">一句解释。</vk-text>
</vk-page>
```

- `<vk-page>` 自己就是流：直接写 head 与内容，不用再包一层。
- `<vk-head>` 由内容实测：带 lede 约 398，不带约 278；标题→正文 64。
- `place` 决定纵向位置：`band` 标题带锁顶、正文在剩余区居中且溢出时贴顶；`top` 贴顶；`center` 整块居中（封面）；`bottom` 贴底。
- 一页多帧就并排写多个 `<vk-page id="…">`，`vk render` 按 id 拆产物；同一帧里 id 唯一，跨帧可以重名。

## 二、六个词

| 词 | 意思 | 取值 |
|---|---|---|
| `theme` | 整帧明暗 | `light / dark`；只写在 `vk-page` 上 |
| `surface` | 卡片材质 | `paper / soft / dark`；只写在 `vk-card` 上 |
| `place` | 整块纵向位置 | `band / top / center / bottom`；只写在 `vk-page` 上 |
| `tone` | 语义 | `neutral / info / ok / warn / err` |
| `size` | 字号 | `caption / body / subhead / headline / display / hero`；分件不同，见 `vk doc` |
| `current` | 当前项 | 项上写属性名；代码 / 字节 / 位写行段；目录写路径 |

`gap` 只给 `vk-flow`；`span` / `bleed` 只给 flow 的直接子项；`id` 和只改颜色的 `style` 是所有件都能写的全局属性。
视觉旋钮不归作者：圆角、描边、内距、窗口皮、语法色、图标尺寸都由库决定。
作者只写「这是什么」「哪一项是当前」「为什么看这里」。

`current` 是唯一的「正在讲这里」；一帧只让一个东西蓝。正文强调用 `<mark>`（暖黄高亮底）。
一个标注也可以跨两个件（`for="#代码行 #内存格"`），它仍然是一个故事，不是两个焦点。

## 三、选件：先选机制，再选变体

| 要讲的东西 | 机制 | 变体 |
|---|---|---|
| 真实源码 / 终端 / 改动 / 汇编 / 字节 / 位 | `vk-code` | `as="code" / "term" / "diff" / "asm" / "bytes" / "bits"` |
| 要点 / 步骤 / 条 / 时间线 / 表格 / 内存格 | `vk-board` | `as="list" / "steps" / "bars" / "timeline" / "table" / "cells"` |
| 关系（链表、树、DAG、环图） | `vk-graph` | `as="row" / "tree" / "layered" / "mesh"` |
| 目录层级 | `vk-dir` | — |
| 通信往返（握手、请求/响应、缓存） | `vk-seq` | — |
| 公式 | `vk-math` | — |
| 版面（面、字、图） | `vk-card` / `vk-text` / `vk-img` | — |
| 排布 | `vk-flow` | — |
| 指着某处说一句、量两点之间 | `vk-callout` | `mode="note" / "mark" / "arrow" / "measure"` |

四条容易选错的：

- 横向排用 `vk-flow cols="auto"`；分栏用 `vk-flow cols="7 5"`；不要为「两块并排」找第二个件。
- `list` 是文字要点，`table` 是二维对齐，`dir` 是缩进层级：读者做的是三件事。
- 链表 / 递归树 / git 分叉 / 死锁环用 `vk-graph`；通信往返用 `vk-seq`；文件目录用 `vk-dir`。
- 时间片 / 流水线这种「有起点终点」的条，现在用 `table` 或两帧讲；`bars` 只画从 0 起的长度，`timeline` 只有点。

**可见文字写成元素内容**：`list` / `steps` / `bars` / `timeline` / `graph` / `seq` 的主文字都写 `<li>文字</li>`；
只有 `note` / `date` / `value` / `label` / `kicker` / `counter` / `lede` / 窗口标题 / 表题 / 单位 / 目录名 / alt 这些元信息才走属性。

## 四、两块并排

这是最常用的教学构图：左边代码，右边它改的内存 / 表格 / 图。

```html
<vk-flow cols="1 1" gap="wide" valign="start">
  <vk-code id="c" lang="c" title="a.c" current="2">…</vk-code>
  <vk-board id="m" as="cells" addr="0x1000" stride="4" cols="2">
    <li value="0" label="a[0]"></li>
    <li value="7" label="a[1]"></li>
  </vk-board>
</vk-flow>
<vk-callout mode="mark" for="#c@line:2 #m@item:2"></vk-callout>
```

- 半栏的 `cells` 会自动变成 2×2 紧凑格（地址折行、字号 64），不需要作者选密度；这一档不要放 `ptr` 徽标（会多占 152px）。
- 半栏代码建议 `size="caption"`（56）；一行大约 20 个等宽字符，超了会被裁。
- 两块的高度不一定要相等：`valign="start"` 让两块的标题对齐；`valign="center"` 让短的那块居中。
- 两块 + 导语常常放不下：先去掉 lede，或把其中一块拆到下一帧。

## 五、排布：只有一个 flow

```html
<vk-flow cols="7 5" gap="wide" valign="center">
  <vk-code …></vk-code>
  <vk-text>右侧的批注</vk-text>
</vk-flow>
```

- `cols`：`1`–`12`（等分）、`"7 5"`（比例）、`auto`（按内容宽），或混排 `"auto 1"`。
- 子项 `span="N"` 跨栏；`bleed="x"` 出血到画布边（只有图片能 `bleed="all"` 整帧铺满）。
- `overlay`：子项叠在同一格里（图 + 图注）。
- `valign` 管子项纵向（start / center / end / between / stretch）。
- 右栏批注不超过 15 字、且主件是卡片/图片时，flow 会自动堆叠：主件占满全宽，批注落到件下。

## 六、源码窗

```html
<vk-code lang="c" title="a.c" current="2">
  <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
  </script>
</vk-code>
```

- `as` 选内容类型：`code`（默认）/ `term` / `diff` / `asm` / `bytes` / `bits`。**`as="asm"` 不是 `lang="asm"`。**
- `code` 必须写 `lang`：不写就没有语法色，构建期报 `ATTR_REQUIRED`。
- `src` 指向真实文件，或内联 `<script type="text/plain" data-vk-source>`。
- `range` 只切**单段**源文件行段（`"4-6"` / `"4-"`），四个文本窗都支持；`current` / `fold` 按**窗口里第几行**算，1 起。
- `mark="i"` 标出源码里所有独立出现的词（按词边界，不会把 `i` 标进 `int`）；`diff` / `asm` 也支持。
- 写了 `title` 就有标题栏（三点 + 文件名）；没写就是一块干净的代码面。
- `size` 只影响代码正文（`caption` 56 / `body` 64），行号固定 56。
- **字号不会自动缩**：行太长就横向被裁，体检单报 `CLIPPED`。改短，或拆帧。
- `asm`：`hex` 显示机器码列；`show-addr="off"` 省掉地址列（半栏对照时常用）；`fold` 折掉既知行；`mark` 标助记符/操作数。
- `bytes` 用 `addr / offset / length / cols`；`addr` 必须 `0x` 开头。
- `bits` 用 `value="0|01111|0000000000"`，只认 0/1/`|`；`current` 按位段，`field-labels` 个数与 `|` 段数一致。

## 七、标注与锚点

```html
<vk-callout for="#c@line:3">它们加起来，也不是 0.3</vk-callout>
<vk-callout mode="mark" for="#c@line:2"></vk-callout>
<vk-callout mode="mark" for="#c@line:2 #cells@item:2"></vk-callout>
<vk-callout mode="arrow" from="#a" to="#b" label="next"></vk-callout>
<vk-callout mode="measure" from="#cells@item:1" to="#cells@item:2" label="+4"></vk-callout>
```

- 一个标注就是「标记 + 连接 + 一句话」：词和块用框，行用一道线，行段用一只括号——形状由库按目标选，
  连接从标记走到话，话住在页面右侧的注栏里（有注记的页，正文自动让出 560）。
- 锚点只认四种部件：`#id@line:3`（窗口第 3 行，可写 `3-4`）、`#id@item:2`（第 2 个单元 / 段 / 行）、
  `#id@bit:5`（第 5 位，可写 `4-7`）、`#id@side:left`。
- 表格的数据行 / 单元格也是 `@item`；内存格 / 位域的当前段也能划。
- `mark` 标出的每个词都是一个 `@item`：`#c@item:2` 是第 2 个标出的词。
- `for` 可以写多个目标（空格分隔）：标记都画，注记只一条，连接从第一个目标出。
- 写错 / 指空会进 JSON、在图上标红；不会静默。
- 标注一律 focus 色（钴蓝），和 `current` 同一个意思：「正在看这里」。一帧只标注一处。
- 标注只能挂 `vk-page` 或 `vk-flow`；放进 `card` 会让正文不让出注栏。
- `shape` 不是作者属性：形态由库按目标选；`mode` 是作者属性。

## 八、颜色与主题

- 三档墨：`ink="primary"`（正文）/ `secondary`（次要）/ `muted`（元信息）。正文只用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。一帧最多一处。
- 四个语义色 `info / ok / warn / err`（neutral 无语义）：只出现在线、图标、底标上，**不写正文**。
- 表格的 `tr` 和 `td` 都可以写 `tone`；`td` 还有 `align`、`current`、`colspan`、`rowspan`。
- 正文强调用 `<mark>`（暖黄高亮底）；不使用文字下划线。代码里的 `mark="i"` 只建 `@item` 锚点，不画高亮。
- 整帧反白：`<vk-page theme="dark">`。卡片材质：`<vk-card surface="paper|soft|dark">`。
- 要改颜色 token，写在 `vk-page` 上：`style="--vk-focus: #c2410c; --vk-syn-keyword: #0e7490"`。字号、间距、线宽、版心不能用 style 改。

## 九、手机尺度

- 只有一套设计：1920 的画布，按 0.361× 重采样到 **693**。不要为手机再设计一套。
- 693 下 64px 字约 23px，56px 约 20px。**56 只做行号 / 单位 / 地址 / 标签，不写整句。**
- 结构线 8px（693 下约 2.9px）；连接线 8px；焦点线 12px。视频压缩先吃细线。
- 镜头裁切、播放器按钮、字幕条是外层视频的事；这一层只管画面本身。

## 十、自检与拆帧

体检单里 `ok` 只表示「有没有硬错」，`fits` 单独表示「放不放得下」。两个都不阻止出图。

硬错只有这几类：没有画布 / 画布尺寸不对 / 组件渲染失败 / 资源没加载 / 文字被裁 / 元素出画布 / 块重叠 / 标注指空 / 空帧。

出现下面任何一条，就是这一帧讲多了：

- 体检单里 `超出` 大于 0
- 一帧里出现两个 `current`，或 `current` + 一个不相关的标注
- 标题从 `headline` 降到了 `subhead`，还是放不下
- 一帧里有两个数据件，并排后代码被裁
- 最小字号掉到 56 以下（说明有整句用了 caption）

终端那行事实是给你和 AI 看的：

```
正文带 546 · 内容 648 · 超出 102px · 焦点 1 · 最小字 56 · code 648px@64
```

## 十一、常见报错与修法

| 错误码 | 意思 |
|---|---|
| `UNKNOWN_TAG` / `UNKNOWN_ATTR` / `UNKNOWN_VARIANT` | 标签 / 属性 / 变体名不对；`vk doc <tag>` 看可用值 |
| `VALUE_ENUM` / `VALUE_NUMBER` / `VALUE_RANGE` / `VALUE_SPACE` / `VALUE_LINES` | 取值不在词表 / 不是数 / 越界 / 间距不对 / 行段写法不对 |
| `ATTR_REQUIRED` | 缺必填：`for` / `from` / `to` / `lang` / `src` / `value` / `participants` |
| `ATTR_IGNORED` / `ATTR_PLACEMENT` | 这个属性在当前形态下不生效 / 放错了位置 |
| `SPAN_TOO_WIDE` / `ID_DUPLICATE` / `ID_FORMAT` | 跨栏超了 / id 重复 / id 里有不能进文件名的字符 |
| `CHILD_KIND` / `CHILD_MISSING` / `STRAY_TEXT` | 子节点类型不对 / 缺内容 / 块里有裸文字 |
| `ANCHOR_MISSING` / `ANCHOR` | 锚点指空（构建期 / 运行期） |
| `CLIPPED` / `OUTSIDE` / `OVERLAP` / `EMPTY` | 横向被裁 / 出画布 / 块重叠 / 空帧 |
| `SRC_MISSING` / `SRC_CONFLICT` / `RANGE_OUT_OF_RANGE` / `CURRENT_RANGE` | 源文件问题 / 同时写两种源 / 行段越界 / current 越界 |
| `MARK_MISSING` / `FIELD_LABELS` / `GRAPH_REF` | 标不上词 / 段名个数不对 / 图边指向不存在节点 |
| `TREE_JSON` / `TREE_NODE` / `MATH` / `ICON` | 目录 JSON / 目录节点 / 公式 / 图标 |
| `RUNTIME` / `RENDER` / `ASSET` / `FRAME` | 运行期没就绪 / 组件抛错 / 资源失败 / 画布不对 |

完整的「什么时候 + 怎么改」在 `vk brief --md`。

## 十二、不做什么

- 不做文案、分镜、配音、动画、视频渲染：那是外层的事。
- 不提供模板：`tests/fixtures/` 是验收帧，不是让你照着抄的版式库。
- 不加门禁：容量、留白、焦点不拦；只有「写不出来 / 确实坏了」才报硬错。
- 不做兼容别名：v26 就是 v26，旧名（`vk-stack` / `vk-tree` / `vk-cells` / `state` / `lines`）不再可用。
