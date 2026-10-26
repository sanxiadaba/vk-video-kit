# vk · 画面元件库

[![ci](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/sanxiadaba/vk-video-kit/actions/workflows/ci.yml)
[在线展示](https://sanxiadaba.github.io/vk-video-kit/) · [GitHub](https://github.com/sanxiadaba/vk-video-kit)

**English.** vk is a set of 30 web components for building 1920×1080 frames for programming-explainer videos. Content is read from real files at build time (Shiki for code, KaTeX for math), the runtime is dependency-free, and the visual system is desktop-only with a 44px minimum type size. Documentation is Chinese-first; this paragraph is the English summary.

写一页能直接录进视频的画面。**30 个标签（29 个元件 + 1 个页面工具），8 个成品帧，1920×1080，桌面 only。**

![vk 代码窗](docs/cover.png)

## 四个原则

- **分则独立。** 每个标签离开兄弟节点也能成立：不伪造内容，不依赖父级上下文，不要求作者补一次性 CSS。
- **合则成帧。** 所有元件共享同一张 1920×1080 画布、同一个 1680×888 安全区、同一条 44px 字号地板，并且可以被局部排序。
- **真实文件是唯一真相。** 代码、终端、diff、文件树、公式都通过 `src` 指向真实文件；构建期编译，HTML 里不再出现第二份手敲内容。
- **静止即成品。** 没有播放器，也没有时间轴。`data-reveal` / `data-type` 只描述“动起来是什么样”，什么时候播由编排层决定。

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
npx vk build page.html   # 读取 src，把高亮/公式写进 HTML，产物自包含
npx vk serve 8099        # 开发服务器；改 .c 刷新即见
```

`file://` 下 `src` 取不到，请先跑 `vk build` 或 `vk serve`，不要直接双击 HTML。

## 30 个标签

- **L1 元素 6 个**：`vk-box` / `vk-text` / `vk-icon` / `vk-img` / `vk-rule` / `vk-mark`，另有 `.vk-win` 窗壳（CSS 类，不是标签）
- **L2 布局 5 个**：`vk-stack` / `vk-row` / `vk-grid` / `vk-canvas` / `vk-edge`
- **L3 组件 16 个**：`vk-title` / `vk-list` / `vk-tag` / `vk-callout` / `vk-code` / `vk-term` / `vk-diff` / `vk-table` / `vk-math` / `vk-figure` / `vk-browser` / `vk-filetree` / `vk-keys` / `vk-cells` / `vk-steps` / `vk-progress`
- **L4 装置 3 个**：`vk-page`（画布工具，不占元件位）/ `vk-annotate` / `vk-note`

展台上的每张画面只有元件本身：没有页眉、标题、页脚、页码、章节号。

## 两条视觉规则

1. **焦点只有一个颜色：冷钴蓝。** 它只做“底”——整行、关键词、当前步。代码关键字回到墨色、靠字重区分，蓝只留给焦点。
2. **语义色不写正文。** 对 / 错 / 注意只出现在色条、底色、图标上；正文永远是墨色。

还有一条硬线：**字不小于 44 设计像素**（1920 画布；手机横屏约 1/3 时 ≈14.7px）。行号、文件名、角标、页脚都在内；公式上下标是排版例外。

## 代码、终端、diff

- 代码窗、终端、diff、图窗、浏览器共用 **L1 一个窗壳**：`.vk-win`。
- **代码只有一个真相**：`src` + `lines` 指向真实文件；行号按片段从 1 起。构建时把读到的源码放进机器数据，HTML 里不再出现手敲的第二份源码。
- 真实文件不止代码：终端 `src` 指向真实 transcript，文件树 `src` 指向真实目录，公式 `src` 指向 `.tex`，diff `src` 指向真实 git diff 文件。
- 代码有四种“看得见的另一面”：主镜头（大、无窗头）、聚光（其余行退到 0.28）、折叠（区间真的不渲染，只留范围说明）、深色。
- 终端结果行是**显式前缀**：`✓` / `!` / `✗`，不靠正则猜；光标是块。
- `vk-diff` 默认**上下对照**；`variant="split"` 换成左右两窗并排。
- 代码高亮 / 公式在构建期完成（Shiki / KaTeX），运行时零依赖。

## 图标与动效

- 图标是全量 Lucide（含常用别名），构建期由 `vk build` 按页注入用到的 SVG；四档尺寸：48 / 64 / 80 / 96。
- 动效是原语：`data-reveal` 逐行显现、`data-type` 逐行打字、块状光标；`vk.freeze()` 或 `html[data-vk-motion="off"]` 一键冻在终态。

## 命令

```bash
npm run build       # 生成 _site/、dist/、vk/、types/ 与 metadata
npm run dev         # build 后启动 dev server（8099，服务 _site/）
npm run verify      # 只读校验：生成物与源码不一致就失败
npm run test:fast   # verify + links + pack + 纯函数单测（需先 build）
npm test            # 全量：build + 静态 + 契约 + 渲染门禁 + 浏览器回归 + 单测
npm run contract    # 每个公开属性是否真的产生声明效果（4 路并行）
npm run gate        # 44px / 对比度 / 安全区 / 裁切 / console / 溢出
npm run gate:visual # 可选：预设像素差（较慢）
npm run links       # 站内链接门禁
npm run pack:check  # 包体文件数 / 体积 / 白名单
npm run shot -- _site/frames/frame-0.html
```

`npm run build` 之后：`_site/` 是完整静态站（首页、30 个组件页、docs、8 帧、搜索索引、specimens、截图），`dist/` 与 `vk/` 是包产物。生成物都不进 git。

## 仓库结构

```
src/      运行时 + CSS 层（唯一真源）
cli/      随包发布的 CLI：build / serve
tools/    仅开发：生成器、契约、门禁、截图
site/     展示站的手写外壳（site.css / site.js）
frames/   8 个作者帧（构建只读，输出到 _site/）
code/     真实示例文件
docs/     手写文档 + 生成的属性参考
tests/    纯函数单测与浏览器回归
_site/    构建产物（gitignore）
```

## 包

`npm pack` 只带运行时、字体、CLI 与 editor metadata，不含展示站、门禁、截图、示例。当前：**355 个文件，unpacked 约 9.2MB**；其中三套字体约 7.5MB。`npm run pack:check` 会守住白名单与 9.5MB 上限。

## 浏览器

桌面 Chromium / Edge（`target: chrome110`）。展示站是桌面 only；手机横屏观看由 1920 帧整体缩放保证。CI 只装 Chromium。

## 许可

MIT。字体 OFL 1.1、Shiki MIT、KaTeX MIT、Lucide ISC，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
