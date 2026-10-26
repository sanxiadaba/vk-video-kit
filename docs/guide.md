# 安装与第一帧

## 安装

```bash
# 尚未发布到 npm；先从本地路径安装
npm i /path/to/vk-video-kit
```

```html
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/fonts.css">
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/vk.css">
<script src="node_modules/vk-video-kit/dist/vk.js"></script>
```

`dist/vk.js` 是零依赖的运行时，负责布局、连线、代码窗和页面缩放。代码、终端、diff、文件树、公式的内容在构建期编译：写 `src` 指向真实文件，再跑一次 `npx vk build`。

开发时用 `npx vk serve 8099`。改 `.c` / `.term` / `.diff` 后刷新就能看到，不需要手动预编译。

## 第一帧

一帧就是一张 1920×1080 的页面。最小骨架只有一个 `vk-page` 和它里面的内容：

```html
<vk-page align="center" footer="第 1 章 · 从能跑到讲清楚 | 01 / 12">
  <vk-stack gap="lg">
    <vk-title index="01" eyebrow="字符串 · 内存" size="title"
              sub="改一个字符，改的是内存里的一个字节。">
      字符串不是值，是<em>一块内存</em>。
    </vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" highlight="4"></vk-code>
  </vk-stack>
</vk-page>
```

- `vk-page` 固定 1920×1080，按容器宽度等比缩放；居中用 `align="center"`。
- `vk-stack` 给竖向节奏，`gap` 从 `2xs` 到 `3xl`，不要自己写 margin。
- `vk-title` 只放一句主张；副题用 `sub`，场次编号用 `index`。
- `vk-code` 的 `src` 相对当前 HTML 文件；`lines` 选片段，`highlight` 是片段内的 1-based 行。

写完先跑 `npx vk serve 8099`，从 HTTP 打开（`file://` 下 `src` 取不到）。需要出片时跑 `npx vk build page.html`，再把整页交给录屏工具；库本身没有播放器。

## 图层

| 层 | 只做一件事 | 例子 |
|---|---|---|
| L0 值 | 放数：画、字、间距、形、线、动 | 安全区 96 / 120，正文 52 |
| L1 元素 | 画一个物件；不认识兄弟 | `vk-box`、`vk-text`、`vk-icon` |
| L2 布局 | 决定在哪、多大 | `vk-stack`、`vk-row`、`vk-grid` |
| L3 组件 | 写“这类内容怎么读” | `vk-code`、`vk-table`、`vk-callout` |
| L4 装置 | 组织多个组件和跨组件几何 | `vk-page`、`vk-annotate` |

规则只有一条：每一层只做自己的事。需要新外观时先回到 L0 / L1，不要在一个组件里给另一个组件补样式。

## 真实文件

`src` 是整个库的入口。代码窗、终端、diff、文件树、公式都不把内容抄进 HTML 两遍：

```html
<vk-code lang="c" file="array.c" src="code/array.c" lines="4-6" highlight="2"></vk-code>
<vk-term title="zsh" src="code/hello.term"></vk-term>
<vk-diff lang="c" file="bounds.c" src="code/real.diff"></vk-diff>
<vk-filetree src="code/app" active="src/parser.py"></vk-filetree>
<vk-math display src="code/formula.tex"></vk-math>
```

- 构建期读取源码，把高亮结果放进 `data-vk-hl` 机器数据；作者源码仍然是唯一一份。
- `src` 不存在时 `npx vk build` 直接报错，不会静默留白。
- 终端结果行用显式的 `✓` / `!` / `✗` 前缀；diff 用真实 git unified diff。
- 文件树扫描真实目录，`active` 只是高亮，不改变文件。

## 44px

视频画布有观看条件：1920×1080 出片，手机横屏播放时约 0.333×。所以画面里的字有一个地板：

- 正文 / 讲解 **52** 设计像素，手机上约 17.3px。
- 标签 / 表头 / 次级 **48**，手机上约 16px。
- 行号、文件名、页脚这类元信息 **44**，手机上约 14.7px。

44 是画面地板，不是网页字号。展示层的正文是 15px、代码是 13px；**不要把这套 44–120 的字阶复制到网页控件上**。两套尺度各管各的：画面里的字按手机横屏可读性定，网页里的字按桌面阅读定。

公式是唯一例外：主体跟随正文，上下标按 0.7em 缩放，不为凑 44 把公式整体放大。

## Tokens

视频画面的值来自 `vk/vk.css` 的 `--vk-*`；展示站自己只取一小套网页值。

| 角色 | 值 | 用在哪 |
|---|---|---|
| 纸 | `#FFFFFF` | 页面、画布 |
| 墨 | `#0B0F14` | 正文、标题 |
| 钴蓝 | `#1B3FD6` | 唯一焦点色、链接、主按钮 |
| 舞台 | `#F4F6F9` | 预览底、代码块、控件底 |
| 线 | `#E2E8F0` | 1px 分隔与边框 |
| 对 / 错 / 注意 | `#0A6B57` / `#B42318` / `#8A5A00` | 只做信号，不写正文 |

展示层字阶只有 **12 / 13 / 15 / 20 / 28 / 36**；圆角只有 **3 / 6 / 10**；桌面按钮高 **36**。控件和正文只使用这六档，不再出现零散字阶。

视频画面的字阶是 44 / 48 / 52 / 56 / 64 / 88 / 120，行高与字重另有规则。两者不互相借用。
