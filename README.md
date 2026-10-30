# vk · 画面语言

[![ci](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml)
[在线标本册](https://sanxiadaba.github.io/vk-video-kit/) · [GitHub](https://github.com/sanxiadaba/vk-video-kit)

**English.** vk is a 5-layer visual language of 39 web components for building 1920×1080 frames for programming-explainer videos. Content is read from real files or inline source blocks at build time (Shiki, KaTeX, hex dumps, JSON trees), the runtime is dependency-free, the palette is paper-only with one focus blue and one annotation plum, and the visual system is desktop-only with a two-step type system: 52 for content, 40 for metadata. The showcase is a self-hosted specimen book: every page is a real frame, every visible element is a vk component. Documentation is Chinese-first; this paragraph is the English summary.

写一个能直接录进视频的组件。每个标签独立成立；拼成一页是调用方的事。**39 个标签、5 层、1920×1080，桌面 only，只有白纸。**

![vk 标本册索引](docs/cover.png)

## 五个原则

- **分则独立。** 每个标签离开兄弟节点也能成立：不伪造内容，不依赖父级上下文，不要求作者补一次性 CSS。
- **合则成帧。** 所有组件共享同一张 1920×1080 画布、同一个 1680×888 安全区、同一条字阶：内容 52 / 元数据 40。
- **真实文件是唯一真相。** 代码、终端、diff、树、字节、公式都通过 `src` 指向真实文件；构建期编译，HTML 里不再出现第二份手敲内容。
- **静止即成品。** 没有播放器、没有时间轴、没有动效。输出就是一张静帧，动效在剪辑层做。
- **文档也是库。** 39 张规格页本身用 vk 组件写：标题行是 `vk-text`，分隔是 `vk-rule`，页面根是 `vk-page`；帧外只有一段 `body{margin:0}`。

## 五层

| 层 | 数量 | 标签 |
|---|---|---|
| L1 原子 | 9 | `vk-box` `vk-text` `vk-inline` `vk-icon` `vk-img` `vk-rule` `vk-mark` `vk-window` `vk-keys` |
| L2 排布 | 4 | `vk-stack` `vk-row` `vk-grid` `vk-canvas` |
| L3 器械 | 19 | `vk-title` `vk-list` `vk-tag` `vk-callout` `vk-code` `vk-term` `vk-diff` `vk-table` `vk-math` `vk-figure` `vk-tree` `vk-cells` `vk-bytes` `vk-steps` `vk-quote` `vk-bits` `vk-bars` `vk-asm` `vk-timeline` |
| L4 关系 | 4 | `vk-edge` `vk-pin` `vk-ring` `vk-spotlight` |
| L5 页面 | 1 | `vk-page` |

L3 只渲染一种**编程数据的形状**：源码、终端会话、差异、表格、公式、树、内存格、字节、汇编、时间线、字节布局板。时间轴和叙事仍然不进库，用 canvas + box + edge 组合。

## 快速开始

这是私有工具，不发布 npm。第一次先装依赖并构建一次（生成 `vk/`、`dist/` 与 `_site/`）：

```bash
npm install
npm run build
```

一帧的最小 HTML。资源路径相对页面本身；页面放在子目录时改成 `../vk/...`：

```html
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">
<script src="dist/vk.js"></script>

<vk-page align="center">
  <vk-stack gap="lg">
    <vk-title size="title" sub="改一个字符，改的是内存里的一个字节。">
      字符串不是值，是<em>一块内存</em>
    </vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" current="4"></vk-code>
  </vk-stack>
</vk-page>
```

排版只有一种写法：**分份**。容器给份（`cols` / `rows`），子项占份（`span`），撑满用 `fill`：

```html
<vk-grid cols="3" gap="lg" fill>
  <vk-code span="2" src="hello.c" lines="4-9"></vk-code>
  <vk-stack span="1" gap="md">…</vk-stack>
</vk-grid>
```

像素 `w` / `h` 只在 `vk-canvas` 的子节点里合法，`style` 不被接受——布局要能算、能验，不能靠手摆。容量也是算出来的：一帧 888px 高，正文 52×1.5 一行，**11 行**。

```bash
node bin/vk.mjs build page.html   # 读取 src 或内联源码块，把高亮/公式/字节/树写进 HTML
node bin/vk.mjs check page.html   # 结构自检：字号/对比度/安全区/溢出/重叠/空锚点
node bin/vk.mjs shot page.html    # 出一张 1920×1080
node bin/vk.mjs serve 8099        # 开发服务器；改 .c 刷新即见
node bin/vk.mjs tags              # 39 个标签
node bin/vk.mjs doc vk-code       # 某个标签的属性
node bin/vk.mjs brief             # 39 行契约摘要（AI 入口）
node bin/vk.mjs icons arrow       # 搜图标名
```

短代码也可以不落盘，直接放进内联源码块（`<` 不用转义）：

```html
<vk-code lang="c" file="hello.c">
  <script type="text/plain" data-vk-source>
#include <stdio.h>
int main(void) { return 0; }
  </script>
</vk-code>
```

`src` 仍是长文件的首选；`src` 与内联块同时出现，构建期会报错。`file://` 下 `src` 取不到，请先跑 `vk build` 或 `vk serve`，不要直接双击 HTML。

## 写一帧

### 代码窗

```html
<vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" current="4" density="loose"></vk-code>
```

- **行号只有一个基准：源文件行号。** `lines="4-6"` 时 gutter 是 4/5/6，`current` / `focus` / `fold` 也写 4/5/6；`numbering="slice"` 只改左侧打印的数字，不改锚点。
- `current="4"` 标出第 4 行（可写 `current="4-6"` 标一段）；`focus="4"` 让其余行退到 0.28；`fold="4"` 隐藏第 4 行，`fold="4-7"` 隐藏 4–7 行，只在开头留一条“中间省略”。
- `long="clip"`（默认）长行裁切并给右缘渐隐；`long="wrap"` 换行。`density` 只改行高与留白，不改字号。
- `chrome="none"` 去窗头；`numbers="none"` 单独关行号。
- `current` / `focus` / `fold` 落在片段外会在构建期报错——写错的行段只会让重点消失，画面看起来仍然正常，所以必须硬拦。

终端读真实 transcript，命令行以 `$` 开头，结果行用显式前缀 `✓` / `!` / `✗`：

```html
<vk-term title="zsh" src="code/hello.term"></vk-term>
```

diff 默认上下对照，`variant="split"` 换成左右两窗并排；`summary="none"` 关计数，`chrome="none"` 去窗头。diff 没有 `current` / `focus`——它表达“改了什么”，不是“正在讲哪行”；要指某一行用 `vk-ring` / `vk-spotlight` 的 `@line` 锚点。

### 数据形状

| 组件 | 内容入口 | 构建期做什么 |
|---|---|---|
| `vk-code` | `src` 源码 / 内联块 | Shiki 高亮 |
| `vk-diff` | `src` diff / 内联块 | 行对与词级差异 |
| `vk-term` | `src` transcript | 行分类 |
| `vk-table` | 原生 `<table>` | 列宽、数字列对齐 |
| `vk-math` | `src` `.tex` / 内联 | KaTeX 排版 |
| `vk-figure` | `src` 图片 | 画框与图注 |
| `vk-tree` | `src` 真实目录 / 内联 JSON | 扫描层级、类型、大小 |
| `vk-cells` | `<li value label>` | 一格一个单元 |
| `vk-bytes` | `src` 二进制 / 内联 hex | 十六进制 + ASCII + 地址 |
| `vk-asm` | `src` `.s` / objdump 文本 | 地址 / 机器码 / 指令 |
| `vk-timeline` | `<li date label lane>` | 等距事件或多泳道 |
| `vk-bars` | `<li value label>` | 横向条与数值轴 |
| `vk-bits` | `value` / `<li from to label>` | 位串与字段 |

代码、终端、diff、树、字节、汇编、公式在运行时零依赖；没预编译时会显示 `data-vk-stale`，门禁直接失败。`vk-timeline` 由结构化子节点直接排版，不需要构建数据。

### 页面与出血

`vk-page` 固定 1920×1080、安全区 96 / 120、可选 `align="top|center|bottom"`。**不缩放**，出片尺寸就是设计尺寸。

需要全幅图/色带到 1920 边时，给 page 的直接子节点写 `bleed`：它铺满整帧、排在内容层后面；出血层只收图/面，正文仍守安全区（`vk check` 会拦住出血层里的文字）。

```html
<vk-page align="center">
  <vk-img bleed src="assets/cover.jpg" alt="" fit="cover"></vk-img>
  <vk-stack gap="lg">
    <vk-title size="title" sub="改一个字符，改的是内存里的一个字节。">字符串不是值，是<em>一块内存</em></vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" current="4"></vk-code>
  </vk-stack>
</vk-page>
```

不想用页面就把它拿掉：元件本身是 1920 的设计像素。

### 锚点

`for` / `from` / `to` 接受 CSS 选择器，也接受 `#id@part:arg`：

```html
<vk-pin for="#arr@line:4">第 4 行</vk-pin>
<vk-pin for="#cells@cell:3">第 3 格</vk-pin>
<vk-pin for="#cells@region:10%,0%,40%,100%">这四个字节</vk-pin>
<vk-edge from="#buf@side:right" to="#mem@point:0%,50%"></vk-edge>
```

`vk-pin` 只钉一个目标；要同时圈/照亮多处，用 `vk-ring` / `vk-spotlight`（它们的 `for` 用分号分隔多个目标）。

| part | 用在 | 编号 |
|---|---|---|
| `point` | 任意标签 | `x%,y%`，左上角是 0,0 |
| `side` | 任意标签 | `top` / `right` / `bottom` / `left` |
| `region` | 任意标签 | `x%,y%,w%,h%` |
| `line` / `char` | `vk-code` / `vk-diff` / `vk-asm` | 源文件行号；字符列从 0 起 |
| `cell` | `vk-cells` / `vk-table` | 下标或 `行,列`，从 0 起 |
| `byte` | `vk-cells` / `vk-bytes` | 偏移从 0 起 |
| `bit` / `field` | `vk-bits` | 位下标 / 字段下标，从 0 起 |
| `addr` | `vk-asm` | 指令地址 |
| `row` / `node` / `item` | `vk-table` / `vk-tree` / `vk-list` | 见组件 |
| `step` | `vk-steps` | 从 0 起 |
| `event` / `lane` | `vk-timeline` | 排序后事件下标（0 起）/ 泳道名 |

写错会在 `vk build` 报错。

## 两条视觉规则

1. **钴蓝只做一件事：标出“正在讲这里”。** 当前行整行 16% 蓝底 + 左侧 4px 实心条；关键字与数字回到墨色 600，语法色只剩字符串的绿。作者加的标注（`em` / callout / tag / ring / pin）用梅紫，其中 `em` 只画一条梅紫下划线，整块底高亮留给 `vk-mark`；asm 寄存器、时间线圆点、文件类型这些结构件回墨阶。
2. **语义色不写正文。** 对 / 错 / 注意只出现在色条、底色、图标上；正文永远是墨色。

**字阶七档：36 / 40 / 48 / 96 / 144 / 224 / 320，名字是 `label / data / body / subhead / title / hero / mega`。**

- `label` 36：行号、单位、刻度、出处——只给「不读第二遍」的字；
- `data` 40：等宽数据（代码、表格数字、地址、字节）；
- `body` 48：要读懂的内容（手机横屏 0.38× 时 18.2px）；
- `subhead` 96：小标题、提示框标题（0.38× 时 36.5px，刚好在可读线上）；
- `title` 144：页标题；
- `hero` 224 / `mega` 320：一个数字当家 / 一个词当家，一帧最多一个。

旧名（`display-2xl` / `display-xl` / `display` / `heading` / `meta`）保留一版别名，构建期会提示改名；180 那一档已删除。

`vk-text` 默认按字号取行宽（body 52→1040，title 88→900）；要铺满容器写 `measure="none"`。

## 规格页

`npm run build` 生成的不是组件文档，而是 39 张规格页：

- **索引**：7 页（前 6 页每页 6 格，最后一页 1 格）。每格是**帧板**的等比缩略图 + 名字 + `vk-*` 标签名；缩略图由 `tools/thumbs.mjs` 生成，内容哈希缓存。
- **每个组件一页 = 纸 + 帧板**：上方一块 1920×1080 帧板（一行元信息 + 标准形态），下方是状态带（`PRESETS` 逐档）与最小 HTML；帧板仍是单镜头，没有成品、没有用法、没有解剖。
- 页面本身就是 vk 标签写的：标题行是 `vk-text`，分隔是 `vk-rule`，页面根是 `vk-page`；状态带与最小写法在帧板外。
- 属性表在 [`docs/reference.md`](docs/reference.md)，由 registry 生成，和页面同源。

帧外的只有一段 `body{margin:0}` 与链接色；帧内的可见元素全部是 vk。

## 命令

```bash
npm run build       # 生成 _site/、dist/、vk/、types/ 与 metadata
npm run dev         # build + watch 重建 + dev server（8099）
npm run quick -- vk-code   # 单组件闭环：build + 该页门禁 + 截图（约 8s）
npm run plan -- slice/deck.json  # 容量表 + 自动求解（改 cols 并写回）+ 跨帧建议
npm run box -- slice/frames/07.html  # 打印一帧的盒子树
npm run specimens   # 只重生成标本册
npm run verify      # 只读校验：生成物与源码不一致就失败
npm run test:fast   # verify + links + pack + 纯函数单测（需先 build）
npm test            # 全量（约 30s；首次 contract/gate 冷跑，暖缓存更快）
npm test -- --fast  # 只跑静态检查（不起浏览器）
npm run contract    # 每个公开属性是否真的产生声明效果（4 路并行）
npm run gate        # 40px 地板 / 对比度 / 安全区 / 裁切 / console / 溢出
npm run gate:full   # 38 页全查（暖缓存约 2s；--force 冷跑约 9s）
npm run gate:visual # 每个预设的像素差
npm run links       # 站内链接门禁
npm run shot -- _site/specimen/vk-code.html
node bin/vk.mjs shot page.html       # 出一张 1920×1080（--phone / --crop x,y,w,h）
```

`vk check` 查 40px 地板、正文是否落在 52、对比度、安全区、溢出、裁切、空锚点、非覆盖层重叠；`vk shot` 的自检与它共用同一份 `VK.auditPage()`。构建缓存放在 `.vk-cache/`，删掉它等价于 `--force`。

`npm run build` 之后：`_site/` 是完整静态站（索引 + 39 张标本页 + 契约宿主 + 资源），`dist/` 与 `vk/` 是本地页面引用的构建产物。生成物都不进 git。`npm run quick` 只碰一个标签；`npm test` 的检查缓存键是「共享产物 + 页面 + 工具」，任何一项变了自动失效。

## 仓库结构

```
src/      运行时 + CSS 层 + registry + 标本数据（唯一真源）
cli/      本地 CLI：build / serve / check / shot
tools/    仅开发：registry 生成、scenes、标本册、契约、门禁
code/     真实示例文件（含 .bin / .json）
docs/     设计说明 + 给 AI 的作者手册 + 生成的属性参考
tests/    纯函数单测与浏览器回归
_site/    构建产物（gitignore）
```

## 包

私有工具，不发布 npm；`dist/` 与 `vk/` 只供本地页面引用，CLI 用 `node bin/vk.mjs`。

## 浏览器

桌面 Chromium / Edge（`target: chrome110`）。标本册是桌面 only；手机横屏观看由 1920 帧整体缩放保证。CI 只装 Chromium。

## 许可

MIT。字体 OFL 1.1、Shiki MIT、KaTeX MIT、Lucide ISC，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
