# 写一帧

一帧 = 一个 `<vk-page>`。1920×1080，版心 **1680×888**（左右 120 / 上下 96）。
观众在手机横屏看，整帧缩到约 **780 宽（0.406×）**。一帧只说一件事。

数字与属性值不在这里抄：`node bin/vk.mjs doc <tag>` 看一个件，`node bin/vk.mjs brief` 看全部。

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
- `<vk-head>` 标题带由内容实测：眉标顶到 96，标题跟 24，标题→内容 64；带 lede 约 352，不带约 244，不替空 lede 预留。
- `place`（默认 `band`）决定整块在版心里的位置：`band` 标题带锁顶、正文在剩余区居中；`top` 贴顶；`center` 整块居中（封面）；`bottom` 贴底。
- 一页多帧就并排写多个 `<vk-page id="…">`，`vk render` 按 id 拆产物。

## 二、几个词

| 词 | 意思 | 取值 |
|---|---|---|
| `theme` | 整帧明暗 | `light / dark`；只写在 `vk-page` 上 |
| `surface` | 卡片材质 | `paper / soft / dark`；只写在 `vk-card` 上 |
| `place` | 整块纵向位置 | `band / top / center / bottom`；只写在 `vk-page` 上 |
| `tone` | 语义 | `neutral / info / ok / warn / err` |
| `size` | 字号（只给文字 / 标题带 / 源码窗） | `caption / body / subhead / headline / display / hero`；码窗只到 `caption/body` |
| `current` | 当前项 | 写在**项**上（布尔）；code / bytes / bits 写行段；dir 写路径 |
| `gap` | 分栏间距 | `none / close / normal / wide / section`，或像素数 |
| `span` / `bleed` | flow 子项跨栏 / 出血 | 只在 `<vk-flow>` 的直接子项上 |

视觉旋钮不归作者：圆角、描边、内距、窗口皮、语法色、图标尺寸都由库决定。
作者只写「这是什么」「哪一项是当前」「为什么看这里」。

`current` 是唯一的「正在讲这里」；一帧只让一个东西蓝。正文强调用 `<mark>`（暖黄高亮底）；
`<em>` 也走同一套，但只用于封面这类整帧只有一个重点的画面。

## 三、排布：只有一个 flow

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

## 四、选件

| 要讲的东西 | 用 |
|---|---|
| 真实源码 / 终端 / diff / 汇编 | `vk-code` 的 `as="code" / "term" / "diff" / "asm"` |
| 内存、字节、位 | `vk-cells` / `vk-bytes` / `vk-bits` |
| 结构（表、要点、目录） | `vk-table` / `vk-list` / `vk-dir` |
| 关系（先后、量级、时间、图、往返） | `vk-steps` / `vk-bars` / `vk-timeline` / `vk-graph` / `vk-seq` |
| 版面（卡片、字、图） | `vk-card` / `vk-text` / `vk-img` |
| 指着某处说一句、量两点之间 | `vk-callout` |

四条容易选错的：

- 横向排用 `vk-flow cols="auto"`；分栏用 `vk-flow cols="7 5"`；不要为「两块并排」再找第二个件。
- `vk-list` 是文字要点，`vk-table` 是二维对齐，`vk-dir` 是缩进层级：读者做的是三件事。
- 链表 / 递归树 / git 分叉 / 死锁环用 `vk-graph`；通信往返（TCP、HTTP、缓存）用 `vk-seq`；文件目录用 `vk-dir`。
- `vk-graph` 的边可以写在节点上（`after`），也可以写成独立子项（`from` / `to`，支持环、双向、边标）；`layered` 用 `lane="0/1"` 固定泳道，`mesh` 摆环图。
- 步骤要图标就写 `<li icon="cpu">`；时间线要图标就写 `<li at="1963" icon="type">`，节点会变成 72px 圆形图标，当前点只换描边和图标色。

**可见文字写成元素内容**：`vk-list` / `vk-steps` / `vk-bars` / `vk-timeline` / `vk-graph` / `vk-seq` 的主文字都写 `<li>文字</li>`；
只有 `note` / `date` / `value` / `kicker` / `counter` / `lede` 这些元信息才走属性。

## 五、节奏

一帧 888 高。标题带由内容实测，正文在剩余区居中；带 lede 时正文带约 472，不带时约 580。放不下就拆帧，不要靠缩小字号硬塞。

- 一帧 = 1 个主组件 + 1 句结论；两个数据组件（代码 + 表格）基本一定太多。
- 单件页也要占满栏宽：代码窗、表格、卡片默认铺满内容区；短内容靠件内留白，不靠缩窄窗口。
- 右栏批注不超过 15 字、且主件是卡片/图片时，flow 会自动堆叠：主件占满全宽，批注落到件下；代码/表格/图解这种高主件不堆。
- 图解先按可用宽高排，再缩字号；不要把整张图缩成一小块。
- 正文高于剩余区超过 4px 时，整页按 `(正文带高 - 4) / 内容高` 连续缩放（下限 0.72），左上对齐；带标注的页不缩（标注是页面坐标），整帧出血图也不缩。

## 六、可读性

- 要读的字不小于 40px（手机 16.2px）：正文、代码、位值、字节、地址、行号、表格数字。
- 代码行号 40px，和代码同一基线；代码正文 56px（手机 22.7px），行高 1.5。
- 结构线 8px（手机 3.2px），连接线 6px，分隔线 4px；视频压缩先吃细线。
- `caption` 只做标签、单位、行号、地址；**整句不要用 caption**，整句用 `body / ink2`。
- 代码窗口有 `current` 时，其余行压到 72% 对比；当前行加 12px 左条 + 500 字重。

## 七、颜色与主题

- 三档墨：`ink="primary"`（正文）/ `secondary`（次要）/ `muted`（元信息）。正文只用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。一帧最多一处。
- 三个语义色 `ok / warn / err`：只出现在线、图标、底标上，**不写正文**。
- 正文强调用 `<mark>`（暖黄高亮底）；`<em>` 也走同一套，但只用在封面这类「整帧只有一个重点」的画面。两者都不使用文字下划线。
- 整帧反白：`<vk-page theme="dark">`。卡片材质：`<vk-card surface="paper|soft|dark">`；代码窗跟随页面/卡片。
- 深色页里最多一块浅面；多了就没有「暗」可言。
- 要改 token 写在 `vk-page` 上，只允许 `--vk-*`：

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

- `as` 选内容类型：`code`（默认）/ `term` / `diff` / `asm`。
- `src` 指向真实文件，或内联 `<script type="text/plain" data-vk-source>`。
- `range` 只切**单段**源文件行段（`"4-6"` / `"4-"`）；`current` / `fold` 按**窗口里第几行**算，1 起。
- `mark="i"` 标出源码里所有独立出现的词（按词边界，不会把 `i` 标进 `int`）；`diff` 也支持。
- 写了 `title` 就有标题栏（小方块 + 文件名）；没写就是一块干净的代码面。
- 窗窄会先把字号往下缩，缩到 40 为止；短代码会向上长到 84。长高受页面底边约束，绝不会为放大把整页顶出去；地板仍放不下才报「被裁」——这时改短行或拆帧。
- `size` 只影响代码正文（`caption / body`），行号固定 40。
- `asm` 加 `hex` 显示机器码列；`term` 的提示符默认 `$`，可改 `prompt`。

## 九、标注与锚点

```html
<vk-callout mode="ring" for="#c@line:2"></vk-callout>
<vk-callout mode="arrow" from="#a@side:right" to="#b@side:left" label="next"></vk-callout>
<vk-callout mode="note" for="#c@line:3">它们加起来，也不是 0.3</vk-callout>
<vk-callout mode="measure" from="#cells@item:1" to="#cells@item:2" label="+4"></vk-callout>
```

- 锚点只认四种部件：`#id@line:3`（窗口第 3 行，可写 `3-4`）、`#id@item:2`（第 2 个单元 / 段 / 行）、
  `#id@bit:5`（第 5 位，可写 `4-7`）、`#id@side:left`。
- 表格的数据行也是 `@item`；`vk-cells` / `vk-bits` 的 `is-cur` 段也能圈。
- 写错 / 指空会进 JSON、在图上标红；不会静默。
- 圈选是 4px 黑色结构轮廓、无填充；焦点蓝只给 `current`；note 会自己找一块不盖字的地方；measure 从元素外侧画尺寸线，标签在尺寸线上方。
- `side` / `shape` / `gap` 不是作者属性：位置和线形由库选。

## 十、手机尺度

- 只有一套设计：1920 的画布，按 0.40625× 重采样到 780。不要为手机再设计一套。
- 780 下 40px 字约 16.2px；整句不要用 caption，用 body。
- 镜头裁切、播放器按钮、字幕条是外层视频的事；这一层只管画面本身。

## 十一、自检与默认策略

只有五类硬错，都是「无论怎么画都错」，会写进 `frame.json`：

1. 这一页没有 `<vk-page>`，或画布不是 1920×1080
2. 组件自己渲染失败
3. 资源加载失败（图片、字体）
4. 文字被裁 / 内容出界
5. 标注指空

**默认不是门禁**：以上问题也照样出图；未知标签/属性在图上画红框，缺内容画 `.vk-missing` 占位。
其余（容量、留白、焦点数、字号、安全区、重叠、对比度）不报、不建议；那是作者和视觉设计的事。

## 十二、什么时候拆帧

出现下面任何一条，就是这一帧讲多了：

- 文字被裁，或内容超出画布
- 一帧里出现两个 `current`
- 标题从 `headline` 降到了 `subhead`
- 一帧里有两个数据件（代码 + 表格）

## 十三、常见报错与修法

构建期报错都带 `file:line`、错误码和改法。按消息改，不要绕：

| 错误码 | 意思 |
|---|---|
| `UNKNOWN_TAG` | 标签不在 20 个里 |
| `UNKNOWN_ATTR` | 属性名拼错，或这个件没有这个属性 |
| `VALUE_ENUM` | 取值不在词表 |
| `VALUE_BOOL` | 开关只写属性名，不要写 `="false"` |
| `ATTR_PLACEMENT` | `span`/`bleed` 只能写在 flow 的直接子项上；`vk-head` 只能直接放在 page 下 |
| `SPAN_TOO_WIDE` | `span` 超过父级 `cols` |
| `ATTR_REQUIRED` | 标注缺 `for` / `from` / `to`，或 seq 缺参与者 |
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
| `FIELD_LABELS` | `field-labels` 个数与 `|` 段数不一致 |
| `TREE_JSON` / `TREE_NODE` | 目录 JSON 语法错 / 节点缺 `name` |
| `MATH` / `ICON` | 公式排版失败 / 图标名找不到 |

## 十四、不做什么

- 不做文案、分镜、配音、动画、视频渲染：那是外层的事。
- 不提供模板：`tests/fixtures/` 是验收帧，不是让你照着抄的版式库。
- 不加门禁：容量、留白、焦点不报数；只有「写不出来 / 确实坏了」才值得处理。
- 不做兼容别名：v24 就是 v24，旧名（`vk-surface` / `vk-tree` / `state` / `lines` / `long`）不再可用。
