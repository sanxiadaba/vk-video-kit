# 写一帧

一帧 = 一个 `<vk-page>`。画布 1920×1080，版心 **1680×888**（左右 120 / 上下 96）。
观众在手机横屏看，整帧缩到约 **780 宽（0.406×）**。一帧只说一件事。

数字与属性不在这里抄：`node bin/vk.mjs doc <tag>` 看一个件，`node bin/vk.mjs brief` 看全部。

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
- `<vk-head>` 由内容实测：眉标 67 + 24 + 标题 +（可选）导语 96 + 24。带 lede 约 398，不带约 278；标题→正文 64。
- `place`（默认 `band`）决定纵向位置：`band` 标题带锁顶、正文在剩余区居中且溢出时贴顶；`top` 贴顶；`center` 整块居中（封面）；`bottom` 贴底。
- 一页多帧就并排写多个 `<vk-page id="…">`，`vk render` 按 id 拆产物。

## 二、六个词

| 词 | 意思 | 取值 |
|---|---|---|
| `theme` | 整帧明暗 | `light / dark`；只写在 `vk-page` 上 |
| `surface` | 卡片材质 | `paper / soft / dark`；只写在 `vk-card` 上 |
| `place` | 整块纵向位置 | `band / top / center / bottom`；只写在 `vk-page` 上 |
| `tone` | 语义 | `neutral / info / ok / warn / err` |
| `size` | 字号 | `caption / body / subhead / headline / display / hero` |
| `current` | 当前项 | 项上写属性名；代码 / 字节 / 位写行段；目录写路径 |

`gap` 只给 `vk-flow`；`span` / `bleed` 只给 flow 的直接子项。

视觉旋钮不归作者：圆角、描边、内距、窗口皮、语法色、图标尺寸都由库决定。
作者只写「这是什么」「哪一项是当前」「为什么看这里」。

`current` 是唯一的「正在讲这里」；一帧只让一个东西蓝。正文强调用 `<mark>`（暖黄高亮底）。

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
| 指着某处说一句、量两点之间 | `vk-callout` | `mode="arrow" / "ring" / "note" / "measure"` |

### 对照帧：一块说错，一块说对

不需要新组件。两张 `vk-card` 并排，`tone` 给语义，标题写「错 / 对」：

```html
<vk-flow cols="1 1" gap="wide">
  <vk-card tone="err" title="错"><vk-text>字符串用 <code>==</code> 比较，比的是地址。</vk-text></vk-card>
  <vk-card tone="ok" title="对"><vk-text>用 <code>strcmp</code> 逐字节比内容。</vk-text></vk-card>
</vk-flow>
```

`tone` 只换描边和一层极淡的底，不改字色——对照靠「红/绿边 + 位置」，不靠把字染红。

四条容易选错的：

- 横向排用 `vk-flow cols="auto"`；分栏用 `vk-flow cols="7 5"`；不要为「两块并排」找第二个件。
- `list` 是文字要点，`table` 是二维对齐，`dir` 是缩进层级：读者做的是三件事。
- 链表 / 递归树 / git 分叉 / 死锁环用 `vk-graph`；通信往返用 `vk-seq`；文件目录用 `vk-dir`。
- `vk-graph` 的边可以写在节点上（`after`），也可以写成独立子项（`from` / `to`，支持环、双向、边标）。

**可见文字写成元素内容**：`list` / `steps` / `bars` / `timeline` / `graph` / `seq` 的主文字都写 `<li>文字</li>`；
只有 `note` / `date` / `value` / `label` / `kicker` / `counter` / `lede` 这些元信息才走属性。

## 四、一帧装得下多少（实测）

这些数字来自 `tests/fixtures/` 里真实出图且体检单为「干净」的帧。它们不是规定，是**当前几何下的上限**；
每帧的真实占用请读 `vk render` 打出来的那行事实。

| 内容 | 一帧上限 | 说明 |
|---|---|---|
| 代码窗 | 3 行（带 lede）/ 4 行（不带） | 每行 64px × 1.5；窗口头 64 |
| 表格 | 4 个数据行 + 表头 | 行高 96 |
| 内存格 | 1 行 4 格 + 一句注 | 一格 354px 高 |
| 时序 | 4 条消息（带 lede）/ 5 条（无标题带） | 一条 108 |
| 关系图 | 3 层 / 环上 4 节点 | 超了会自行压行距，不会缩字 |
| 步骤 | 4 步横排 | 5 步要竖排 |
| 条 | 4–6 条 | |
| 时间线 | 4 点 | |
| 位 | 16 位 | 32 位只标 8 的倍数 |
| 字节 | 2 行 × 8 字节 + 一句注 | |

**放不下时库不缩字**：终端会写「正文带 546 · 内容 648 · 超出 102px」，图照样出。这时该拆帧、砍内容，或者把标题降到 `subhead`。

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

## 六、可读性

- 要读的字不小于 56px（手机 22.7px）：正文、代码、位值、字节、地址、行号、表格数字。
- 代码行号 56px，代码正文 64px（手机 26px），行高 1.5。
- 结构线 6px（手机 2.4px），连接线 8px，焦点线 12px。视频压缩先吃细线。
- `caption` 只做标签、单位、行号、地址；**整句不要用 caption**，整句用 `body`。
- 代码窗口有 `current` 时，其余行压到 72% 对比；当前行加 12px 左条 + 500 字重。

## 七、颜色与主题

- 三档墨：`ink="primary"`（正文）/ `secondary`（次要）/ `muted`（元信息）。正文只用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。一帧最多一处。
- 三个语义色 `ok / warn / err`：只出现在线、图标、底标上，**不写正文**。
- 正文强调用 `<mark>`（暖黄高亮底）；不使用文字下划线。
- 整帧反白：`<vk-page theme="dark">`。卡片材质：`<vk-card surface="paper|soft|dark">`。
- 深色页里最多一块浅面。要改 token，写在 `vk-page` 上，只允许 `--vk-*`：

```html
<vk-page style="--vk-focus: #c2410c; --vk-syn-keyword: #0e7490">
```

## 八、源码窗

```html
<vk-code lang="c" title="a.c" current="2">
  <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
  </script>
</vk-code>
```

- `as` 选内容类型：`code`（默认）/ `term` / `diff` / `asm` / `bytes` / `bits`。
- `code` 必须写 `lang`：不写就没有语法色，构建期报 `ATTR_REQUIRED`。
- `src` 指向真实文件，或内联 `<script type="text/plain" data-vk-source>`。
- `range` 只切**单段**源文件行段（`"4-6"` / `"4-"`）；`current` / `fold` 按**窗口里第几行**算，1 起。
- `mark="i"` 标出源码里所有独立出现的词（按词边界，不会把 `i` 标进 `int`）；`diff` 也支持。
- 写了 `title` 就有标题栏（三点 + 文件名）；没写就是一块干净的代码面。
- `size` 只影响代码正文（`caption` 56 / `body` 64），行号固定 56。
- **字号不会自动缩**：行太长就横向被裁，构建期报 `CLIPPED`。改短，或拆帧。
- `asm` 加 `hex` 显示机器码列；`bytes` 用 `addr / offset / length / cols`；`bits` 用 `value="0|01111|0000000000"`。

## 九、标注与锚点

```html
<vk-callout mode="ring" for="#c@line:2"></vk-callout>
<vk-callout mode="arrow" from="#a@side:right" to="#b@side:left" label="next"></vk-callout>
<vk-callout mode="note" for="#c@line:3">它们加起来，也不是 0.3</vk-callout>
<vk-callout mode="measure" from="#cells@item:1" to="#cells@item:2" label="+4"></vk-callout>
```

- 锚点只认四种部件：`#id@line:3`（窗口第 3 行，可写 `3-4`）、`#id@item:2`（第 2 个单元 / 段 / 行）、
  `#id@bit:5`（第 5 位，可写 `4-7`）、`#id@side:left`。
- 表格的数据行也是 `@item`；内存格 / 位域的当前段也能圈。
- 写错 / 指空会进 JSON、在图上标红；不会静默。
- 圈选是 8px 结构线、圆角、无填充；焦点蓝只给 `current`；note 是 64px 票，clamp 到正文安全区。
- `side` / `shape` / `gap` 不是作者属性：位置和线形由库选。

## 十、手机尺度

- 只有一套设计：1920 的画布，按 0.40625× 重采样到 780。不要为手机再设计一套。
- 780 下 56px 字约 22.7px；整句不要用 caption，用 body。
- 镜头裁切、播放器按钮、字幕条是外层视频的事；这一层只管画面本身。

## 十一、自检与默认策略

只有五类硬错，都是「无论怎么画都错」，会写进 JSON：

1. 这一页没有 `<vk-page>`，或画布不是 1920×1080
2. 组件自己渲染失败
3. 资源加载失败（图片、字体）
4. 文字被裁 / 内容出界
5. 标注指空

**默认不是门禁**：以上问题也照样出图。除此之外每帧还有一行事实：

```
正文带 546 · 内容 648 · 超出 102px · 焦点 1 · table 648px@64
```

容量、留白、焦点数不评分、不建议；这行数字是给你和 AI 看的。

出完一集，加 `--sheet` 让 `vk render` 顺手拼一张联系表：所有帧按 780 宽排成两列，每格下面写着占用和焦点。
这是给人扫的验收工具，不是模板，不进产物。

## 十二、什么时候拆帧

出现下面任何一条，就是这一帧讲多了：

- 体检单里 `超出` 大于 0
- 一帧里出现两个 `current`
- 标题从 `headline` 降到了 `subhead`，还是放不下
- 一帧里有两个数据件（代码 + 表格）

## 十三、常见报错与修法

构建期报错都带 `file:line`、错误码和改法。按消息改，不要绕：

| 错误码 | 意思 |
|---|---|
| `UNKNOWN_TAG` | 标签不在 13 个里 |
| `UNKNOWN_ATTR` | 属性名拼错，或这个变体没有这个属性 |
| `UNKNOWN_VARIANT` | `as` 的取值不在变体表里 |
| `VALUE_ENUM` | 取值不在词表 |
| `VALUE_BOOL` | 开关只写属性名，不要写 `="false"` |
| `ATTR_PLACEMENT` | `span`/`bleed` 只能写在 flow 的直接子项上；`vk-head` 只能直接放在 page 下 |
| `SPAN_TOO_WIDE` | `span` 超过父级 `cols` |
| `ATTR_REQUIRED` | 标注缺 `for` / `from` / `to`；`vk-code as="code"` 缺 `lang`；seq 缺参与者 |
| `ANCHOR_MISSING` | 锚点指向不存在的 id |
| `VALUE_SELECTOR` | `@line:3` 写了非整数，或 `@part` 不认识 |
| `SRC_MISSING` | `src` 路径找不到（相对页面文件解析） |
| `SRC_CONFLICT` | 同时写了 `src` 和内联内容 |
| `RANGE_OUT_OF_RANGE` | `range` / `current` 超出源码行数 |
| `VALUE_LINES` | 行段写法不对（`3` / `3-4` / `4-`） |
| `CURRENT_RANGE` | `current` 越界 |
| `ID_DUPLICATE` | 同一页两个 id |
| `CHILD_KIND` | 子节点类型不对（如 text 里塞 flow、li 里塞块级件） |
| `STRAY_TEXT` | 块里有一段裸文字，包进 `vk-text` |
| `GRAPH_REF` | 关系图的 `after` / `from` / `to` 指向不存在的节点 |
| `MARK_MISSING` | `mark` 的词在源码里找不到 |
| `FIELD_LABELS` | `field-labels` 个数与 `\|` 段数不一致 |
| `TREE_JSON` / `TREE_NODE` | 目录 JSON 语法错 / 节点缺 `name` |
| `MATH` / `ICON` | 公式排版失败 / 图标名找不到 |

## 十四、不做什么

- 不做文案、分镜、配音、动画、视频渲染：那是外层的事。
- 不提供模板：`tests/fixtures/` 是验收帧，不是让你照着抄的版式库。
- 不加门禁：容量、留白、焦点不拦；只有「写不出来 / 确实坏了」才值得处理。
- 不做兼容别名：v25 就是 v25，旧名（`vk-stack` / `vk-tree` / `vk-cells` / `state` / `lines`）不再可用。
