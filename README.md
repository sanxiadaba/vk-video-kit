# vk · 画面语言

[![ci](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml)
[在线标本册](https://sanxiadaba.github.io/vk-video-kit/) · [GitHub](https://github.com/sanxiadaba/vk-video-kit)

**English.** vk is a 5-layer visual language of 40 web components for building 1920×1080 frames for programming-explainer videos. Content is read from real files or inline source blocks at build time (Shiki, KaTeX, hex dumps, JSON trees), the runtime is dependency-free, and the visual system is desktop-only with a 44px minimum type size. The showcase is a self-hosted specimen book: every page is a real frame, every visible element is a vk component. Documentation is Chinese-first; this paragraph is the English summary.

写一个能直接录进视频的组件。每个标签独立成立；拼成一页是调用方的事。**40 个标签、5 层、1920×1080，桌面 only。**

![vk 代码窗](docs/cover.png)

## 五个原则

- **分则独立。** 每个标签离开兄弟节点也能成立：不伪造内容，不依赖父级上下文，不要求作者补一次性 CSS。
- **合则成帧。** 所有组件共享同一张 1920×1080 画布、同一个 1680×888 安全区、同一条 44px 字号地板。
- **真实文件是唯一真相。** 代码、终端、diff、树、字节、栈帧、公式都通过 `src` 指向真实文件；构建期编译，HTML 里不再出现第二份手敲内容。
- **静止即成品。** 没有播放器、没有时间轴、没有动效。输出就是一张静帧，动效在剪辑层做。
- **文档也是库。** 40 张规格页本身用 vk 组件写：标题行是 `vk-text`，分隔是 `vk-rule`，页面根是 `vk-page`；帧外只有一段 `body{margin:0}`。

## 五层

| 层 | 数量 | 标签 |
|---|---|---|
| L1 原子 | 7 | `vk-box` `vk-text` `vk-icon` `vk-img` `vk-rule` `vk-mark` `vk-window` |
| L2 排布 | 4 | `vk-stack` `vk-row` `vk-grid` `vk-canvas` |
| L3 器械 | 22 | `vk-title` `vk-list` `vk-tag` `vk-callout` `vk-code` `vk-term` `vk-diff` `vk-table` `vk-math` `vk-figure` `vk-tree` `vk-keys` `vk-cells` `vk-bytes` `vk-frames` `vk-steps` `vk-quote` `vk-bits` `vk-bars` `vk-memory` `vk-asm` `vk-timeline` |
| L4 关系 | 6 | `vk-edge` `vk-annotate` `vk-note` `vk-pin` `vk-ring` `vk-spotlight` |
| L5 页面 | 1 | `vk-page` |

L3 只渲染一种**编程数据的形状**：源码、终端会话、差异、表格、公式、树、内存格、字节、栈帧、地址空间、汇编、时间线。时间轴和叙事仍然不进库，用 canvas + box + edge 组合。

## 规格页

`npm run build` 生成的不是组件文档，而是 40 张规格页：

- **索引**：40 格总览（层 / 名字 / 标签），点卡进页；一屏装得下，不滚动。
- **每个组件一页**：一行元信息（层 · 标签 · 名字 · 上下页 · 序号）+ 该组件的标准形态；**单镜头**，没有成品、没有用法、没有解剖。
- 页面本身就是 vk 标签写的：标题行是 `vk-text`，分隔是 `vk-rule`，页面根是 `vk-page`。
- 属性表在 [`docs/reference.md`](docs/reference.md)，由 registry 生成，和页面同源。

帧外的只有一段 `body{margin:0}` 与链接色；帧内的可见元素全部是 vk。

## 快速开始

包尚未发布到 npm；先从本地路径安装：

```bash
npm i /path/to/vk-video-kit
```

```html
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/fonts.css">
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/vk.css">
<script src="node_modules/vk-video-kit/dist/vk.js"></script>

<vk-page align="center">
  <vk-stack gap="lg">
    <vk-title size="title" sub="改一个字符，改的是内存里的一个字节。">
      字符串不是值，是<em>一块内存</em>
    </vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" highlight="4"></vk-code>
  </vk-stack>
</vk-page>
```

```bash
npx vk build page.html   # 读取 src 或内联源码块，把高亮/公式/字节/树写进 HTML
npx vk serve 8099        # 开发服务器；改 .c 刷新即见
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

## 真实数据

| 组件 | `src` 指向 | 构建期做什么 |
|---|---|---|
| `vk-code` / `vk-diff` | 源码 / diff | Shiki 高亮，token 级差异 |
| `vk-term` | transcript | 行分类，显式 ✓ / ! / ✗ |
| `vk-tree` | 真实目录 / 内联 JSON | 目录扫描或 JSON 归一 |
| `vk-bytes` | 真实二进制 / 内联 hex | 十六进制 + ASCII + 地址切行 |
| `vk-frames` | 真实 `.json` / 内联 JSON | 栈帧与槽位 |
| `vk-asm` | `.s` / objdump 文本 | 地址 / 机器码 / 指令解析与高亮 |
| `vk-math` | `.tex` | KaTeX 排版 |
| `vk-icon` | — | 按页注入用到的 Lucide SVG |

代码、终端、diff、树、字节、栈帧、汇编、公式在运行时零依赖；没预编译时会显示 `data-vk-stale`，门禁直接失败。`vk-memory` / `vk-timeline` 由结构化子节点直接排版，不需要构建数据。

## 两条视觉规则

1. **焦点只有一个颜色：冷钴蓝。** 它做当前行底，也做关键字（600）；函数用墨色 600，不再加第二个前景色。
2. **语义色不写正文。** 对 / 错 / 注意只出现在色条、底色、图标上；正文永远是墨色。

**内容字不小于 44 设计像素**（1920 画布；手机横屏约 1/3 时 ≈14.7px）；行号、文件名、索引编号、层、图注等元数据用 28–40。门禁/契约对 `[data-meta]` 放行，公式上下标仍是排版例外。

## 命令

```bash
npm run build       # 生成 _site/、dist/、vk/、types/ 与 metadata
npm run dev         # build + watch 重建 + dev server（8099）
npm run quick -- vk-code   # 单组件闭环：build + 该页门禁 + 截图（约 8s）
npm run specimens   # 只重生成标本册
npm run verify      # 只读校验：生成物与源码不一致就失败
npm run test:fast   # verify + links + pack + 纯函数单测（需先 build）
npm test            # 全量（约 13s；源码没变会跳过 build，默认走缓存）
npm test -- --fast  # 只跑静态检查（不起浏览器）
npm run contract    # 每个公开属性是否真的产生声明效果（4 路并行）
npm run gate        # 44px / 对比度 / 安全区 / 裁切 / console / 溢出 + 每个预设的像素差
npm run gate:full   # 规格页全查（约 75s，改动展示站时才需要）
npm run gate:visual # 预设像素差
npm run links       # 站内链接门禁
npm run pack:check  # 包体文件数 / 体积 / 白名单
npm run shot -- _site/specimen/vk-code.html
npx vk shot page.html       # 出一张 1920×1080（--phone / --crop x,y,w,h）
```

`npm run build` 之后：`_site/` 是完整静态站（索引 + 40 张标本页 + 契约宿主 + 资源），`dist/` 与 `vk/` 是包产物。生成物都不进 git。`npm run quick` 只碰一个标签；`npm test` 的检查缓存键是「共享产物 + 页面 + 工具」，任何一项变了自动失效。

## 仓库结构

```
src/      运行时 + CSS 层 + registry + 标本数据（唯一真源）
cli/      随包发布的 CLI：build / serve
tools/    仅开发：registry 生成、scenes、标本册、契约、门禁
site/     灯箱与显示引擎（showcase.css / showcase.js）
code/     真实示例文件（含 .bin / .json）
docs/     设计说明 + 给 AI 的作者手册 + 生成的属性参考
tests/    纯函数单测与浏览器回归
_site/    构建产物（gitignore）
```

## 包

`npm pack` 只带运行时、字体、CLI 与 editor metadata，不含标本册、门禁、截图、示例。`npm run pack:check` 会守住白名单与体积上限。

## 浏览器

桌面 Chromium / Edge（`target: chrome110`）。标本册是桌面 only；手机横屏观看由 1920 帧整体缩放保证。CI 只装 Chromium。

## 许可

MIT。字体 OFL 1.1、Shiki MIT、KaTeX MIT、Lucide ISC，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

