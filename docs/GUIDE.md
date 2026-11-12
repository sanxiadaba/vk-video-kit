# 写一帧

一帧 = 一个 `<vk-page>`。1920×1080，版心 1680×888（左右 120、上下 96）。
观众在手机横屏看，整帧缩到约 **780 宽（0.406×）**。一帧只说一件事。

数字与属性值不在这里抄：`node bin/vk.mjs doc <tag>` 看一个件，`node bin/vk.mjs brief --json` 看全部，
`node bin/vk.mjs brief --json | node -e "…"` 可以直接读 `skeleton` 与每个件的 `example`。

## 一、结构：page → head → 内容

```html
<vk-page>
  <vk-head kicker="第 3 集 · 指针" counter="1 / 8">下标是<em>偏移量</em>。</vk-head>
  <vk-text>从 a[0] 到 a[3]，中间隔了三个 int。</vk-text>
</vk-page>
```

- `<vk-page>` 自己就是流：直接写 head 与内容，不用再包一层。
- `<vk-head>` 把标题带固定下来：眉标顶到 96，标题跟 24，标题→内容 64。帧与帧的标题不会跳。
- `align`（默认 `band`）决定内容在剩余高度里的位置：`band` 居中，`center` / `top` / `bottom` 整块对齐。
- 一页多帧就并排写多个 `<vk-page id="…">`，`vk render` 按 id 拆产物。

## 二、五个词

| 词 | 意思 | 取值 |
|---|---|---|
| `tone` | 语义 | `neutral / info / ok / warn / err` |
| `size` | 字号 | `caption / body / subhead / headline / display / hero`（数据件只到 subhead） |
| `gap` `pad` | 间距 | `none / close / normal / wide / section`，或像素数 |
| `current` | 第几项 | **1 起**；不写就是没有当前 |
| `state` | 注意力 | 只写在项上：`current` |

没有第二个词表达同一个意思。语义对错用 `tone`，注意力用 `state`，别混。
`current` 是唯一的「正在讲这里」；一帧最多一处。正文强调用 `<em>`，标原文用 `<mark>`。

## 三、排布：只有一个 flow

```html
<vk-flow cols="7 5" gap="wide" align="center">
  <vk-code …></vk-code>
  <vk-text>右侧的批注</vk-text>
</vk-flow>
```

- `cols`：`1`–`12`（等分）、`"7 5"`（比例）、`auto`（按内容宽），或混排 `"auto 1"`（标签列按内容、剩下按比例）。
- 子项 `span="N"` 跨栏；`bleed="x"` 出血到画布边（`bleed="all"` 只给图片）。
- `overlay`：子项叠在同一格里（图 + 图注）。
- `align` 管纵向（start / center / end / between / stretch），`justify` 管横向。

## 四、选件

| 要讲的东西 | 用 |
|---|---|
| 真实源码 / 终端 / diff / 汇编 | `vk-code` 的 `as="code" / "term" / "diff" / "asm"` |
| 内存、字节、位 | `vk-cells` / `vk-bytes` / `vk-bits` |
| 结构（表、要点、目录） | `vk-table` / `vk-list` / `vk-tree` |
| 关系（先后、量级、时间、图、往返） | `vk-steps` / `vk-bars` / `vk-timeline` / `vk-graph` / `vk-seq` |
| 版面（面、字、图） | `vk-surface` / `vk-text` / `vk-img` |
| 指着某处说一句、量两点之间 | `vk-callout` |

四条容易选错的：

- 横向排用 `vk-flow cols="auto"`；分栏用 `vk-flow cols="7 5"`；不要为「两块并排」再找第二个件。
- `vk-list` 是文字要点，`vk-table` 是二维对齐，`vk-tree` 是缩进层级：读者做的是三件事。
- 链表 / 递归树 / git 分叉 / 死锁环用 `vk-graph`；通信往返（TCP、HTTP）用 `vk-seq`；文件目录用 `vk-tree`。
- `vk-graph` 的边可以写在节点上（`after`），也可以写成独立子项（`from` / `to`，支持环、双向、边标）。

## 五、容量

一帧 888 高。标题带占 197（subhead）或 253（headline），标题→内容 64，剩下约 **627**。

| 件 | 一帧最多 | 备注 |
|---|---|---|
| `vk-code` | 6 行 | 带窗口；`as="term"` 也是 6，diff / asm 5 |
| `vk-table` | 4 数据行 | 表头、表题另算 |
| `vk-tree` | 6 行 | 超了末尾留一行「还有 N 项」 |
| `vk-list` | 6 项 | |
| `vk-cells` | 2 行 | `cols=4` 时 8 格 |
| `vk-bytes` | 4 行 | `cols=8` 时 |
| `vk-bits` | 16 位 | 32 位拆两帧，不要靠缩字号硬塞 |
| `vk-steps` | 5 步 | 容器窄时自动竖排 |
| `vk-bars` | 6 条 | |
| `vk-timeline` | 4 点 | |
| `vk-graph` | 6 节点 | 一行/一屏 |
| `vk-seq` | 4 条 | 一次握手就 3 条，别塞满 |

**一帧 = 1 个主组件 + 1 句结论。** 两个数据组件（代码 + 表格）基本一定超。

## 六、可读性

- 要读的字不小于 40px（手机 16.2px）：正文、代码、位值、字节、地址、行号、表格数字。
- 分组标签、单位可以到 34px（手机 13.8px），再小就只剩噪点。
- 结构线 8px（手机 3.2px），分隔线 4px；视频压缩先吃细线。
- 数字列自动右对齐；代码行号在手机上也是 19.5px。

## 七、颜色

- 三档墨：`ink="primary"`（正文）/ `secondary`（次要）/ `muted`（元信息）。正文只用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。一帧最多一处。
- 三个语义色 `ok / warn / err`：只出现在线、图标、底标上，**不写正文**。
- 正文要强调用 `<em>`（墨色加重 + 粗下划线）或 `<mark>`（淡底 + 蓝下划线），不要用 `tone` 上色。
- 改颜色 / 线宽写在 `vk-page` 上，整帧生效：

```html
<vk-page style="--vk-focus: #c2410c; --vk-syn-keyword: #0e7490">
```

## 八、深色页

- 整帧反白：`<vk-page surface="dark">`。墨、线、语义色、淡底、语法色一起换。
- 代码窗默认 `surface="auto"`：跟着页面一起变深，语法色换成暗面那一套。
- 想要「深色页上的白纸窗」就显式写 `surface="paper"`；白纸窗是**选项**，不是默认。
- 深色页里最多一块浅面；多了就没有「暗」可言。

## 九、源码窗

```html
<vk-code lang="c" title="a.c" chrome="dots" current="2">
  <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]
  </script>
</vk-code>
```

- `as` 选内容类型：`code`（默认）/ `term` / `diff` / `asm`；四者共用窗口、行号、`current`、行段。
- `src` 指向真实文件，或内联 `<script type="text/plain" data-vk-source>`。
- `current` / `fold` 按**窗口里第几行**算，1 起。`lines` 按源文件行段切窗口。
- 窗太窄会先把字号往下缩，缩到 44 为止；还放不下就报「被裁」——这时改短行或拆帧。
- 窗口默认无 chrome；需要「这是 a.c」的信号才写 `chrome="dots"` + `title`。

## 十、标注与锚点

```html
<vk-callout mode="ring" for="#c@line:2"></vk-callout>
<vk-callout mode="arrow" from="#a@side:right" to="#b@side:left" label="next"></vk-callout>
<vk-callout mode="note" for="#c@line:3" side="right">它们加起来，也不是 0.3</vk-callout>
<vk-callout mode="measure" from="#m@item:1" to="#m@item:2" label="+4"></vk-callout>
```

- 锚点只认四种部件：`#id@line:3`（窗口第 3 行）、`#id@item:2`（第 2 个单元 / 段）、
  `#id@bit:5`（第 5 位）、`#id@side:left`。
- 写错 / 指空在构建期或自检里报，不会静默。
- 圈选按**字的墨迹**取框；note 会自己找一块不盖字的地方；measure 画两点之间的量度线。

## 十一、自检与建议

只有五类硬错，都是「无论怎么画都错」，会拦出图：

1. 这一页没有 `<vk-page>`，或画布不是 1920×1080
2. 组件自己渲染失败
3. 资源加载失败（图片、字体）
4. 文字被裁 / 内容出界
5. 标注指空

其余（留白、重叠、焦点数、对比度、小字、容量）**不拦**，写进 `frame.json`，
`vk check … --advise` 会打印成一句句建议：

```
✓ tests/frames.html #steps
   正文 y 547–800（占正文区 41%）· 焦点 1
   · 正文只占 41%：放大这一件，或把下一帧的内容提前
```

**这不是门禁。** 数字是给作者看的，不是用来卡出图的。

## 十二、什么时候拆帧

出现下面任何一条，就是这一帧讲多了：

- 正文超过正文区（`frame.json` 的 `fill` 超过 100，或自检报「超出画布」）
- 代码超过 6 行，或者要缩到比 56 还小才塞得下
- 一帧里出现两个 `current`（观众不知道看哪）
- 标题从 `subhead` 降到了 `body`
- 一帧里有两个数据件（代码 + 表格）
- 要靠手摆坐标才能放下（现在没有坐标画布了，这条直接对应「拆帧」）

## 十三、常见报错与修法

构建期报错都带 `file:line`、错误码和改法。按消息改，不要绕：

| 错误码 | 意思 |
|---|---|
| `UNKNOWN_TAG` | 标签不在 20 个里（旧标签会被指出来） |
| `UNKNOWN_ATTR` | 属性名拼错，或这个件没有这个属性 |
| `VALUE_ENUM` | 取值不在词表 |
| `ATTR_PLACEMENT` | `span` 只能写在 flow 的直接子项上 |
| `SPAN_TOO_WIDE` | `span` 超过父级 `cols` |
| `ATTR_REQUIRED` | 标注缺 `for` / `from` / `to`，或 seq 缺 `a` / `b` |
| `ANCHOR_MISSING` | 锚点指向不存在的 id |
| `VALUE_SELECTOR` | `@line:3` 写了非整数，或 `@part` 不认识 |
| `SRC_MISSING` | `src` 路径找不到（相对页面文件解析） |
| `SRC_CONFLICT` | 同时写了 `src` 和内联内容 |
| `LINES_OUT_OF_RANGE` | `lines` 超出源码行数 |
| `ID_DUPLICATE` | 同一页两个 id |
| `CURRENT_RANGE` | `current` 越界 |
| `GRAPH_REF` | 关系图的 `after` / `from` / `to` 指向不存在的节点 |

## 十四、不做什么

- 不做文案、分镜、配音、动画、视频渲染：那是外层的事。
- 不提供模板：`tests/frames.html` 是验收帧，不是让你照着抄的版式库。
- 不加门禁：容量、留白、焦点只报数；只有「写不出来 / 确实坏了」才拦。
