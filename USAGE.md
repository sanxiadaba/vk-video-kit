# 使用

## 1 · 装

包尚未发布到 npm；先从本地路径安装：

```bash
npm i /path/to/vk-video-kit
```

```html
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/fonts.css">
<link rel="stylesheet" href="node_modules/vk-video-kit/vk/vk.css">
<script src="node_modules/vk-video-kit/dist/vk.js"></script>
```

`dist/vk.js` 是运行时（IIFE，约 150KB，零依赖）。全量 Lucide 图标不进运行时：`npx vk build` 只把本页 `<vk-icon>` 用到的 SVG 注入页面。

## 2 · 写一个代码窗

```html
<vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" current="4" density="loose"></vk-code>
```

- `src` 指向真实源文件，`lines="1-8"` 选片段；行号默认按**源文件**行号（4-6 就是 4/5/6），`numbering="slice"` 才从 1 起。
- `src` 相对当前 HTML 文件；文件不存在时 `npx vk build` 会直接报错。
- `current="4"` 标出源文件第 4 行（也可以写 `current="4-6"` 标一段）；`focus="4"` 让其余行退到 0.28。
- `fold="4"` 在第 4 行后插一条“中间省略”，被折叠的行真的不渲染。
- `long="clip"`（默认）长行直接裁并给右缘渐隐；`long="wrap"` 才换行。
- `density="compact" | "normal" | "loose"` 只改行高与上下留白，**不改字号**。
- `chrome="none"` 去窗头；`numbers="none"` 单独控制行号。
- 全库没有深色窗：`surface` 已移除。

终端默认白底，`src` 指向真实 transcript 文件：

```html
<vk-term title="zsh" src="code/hello.term"></vk-term>
```

`code/hello.term` 是一段真实终端记录：命令行以 `$` 开头，结果行用 `✓` / `!` / `✗` 前缀。`!` 是作者标注，不是工具输出。

## 3 · 对比

```html
<vk-diff w="1280" lang="c" file="bounds.c" src="code/real.diff"></vk-diff>
```

默认上下对照；`variant="split"` 换成左右两窗并排；`summary="none"` 关计数；`chrome="none"` 去窗头。`current` / `focus` 仍按片段行；`@line` 现在真的能锚定到 diff 行。

## 4 · 内存格与字节

```html
<vk-cells cols="4" addr="0x7ffc" stride="4">
  <i value="1" label="a[0]"></i>
  <i value="2" label="a[1]"></i>
  <i value="3" label="a[2]"></i>
  <i value="0" label="a[3]" bad></i>
</vk-cells>

<vk-bytes src="code/hello.bin" addr="0x7ffc" length="48" current="0-5"></vk-bytes>
```

- `vk-cells` 一格一个 `<i>`：`bad` / `mark` / `filled` 写在格子上，`span` 表示跨几格；超过 `cols` 自动换行。
- `vk-bytes` 的 `current` 是 0 起的字节段；`word` / `endian` 支持 1/2/4/8 与 little/big。

## 5 · 页面

`vk-page` 是画布工具：固定 1920×1080、安全区 96 / 120、可选 `align="top|center"`。**不缩放**，出片尺寸就是设计尺寸；预览缩放属于播放器。

```html
<vk-page align="center">
  <vk-stack gap="lg">
    <vk-title size="title" sub="改一个字符，改的是内存里的一个字节。">字符串不是值，是<em>一块内存</em></vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" current="4"></vk-code>
  </vk-stack>
</vk-page>
```

不想用页面就把它拿掉：元件本身是 1920 的设计像素。

## 6 · 构建与自检

```bash
npx vk build page.html    # 处理一个文件（增量：没改就跳过）
npx vk build .            # 处理当前目录（递归）
npx vk build . --force    # 忽略增量缓存，整棵重建
npx vk check page.html    # 结构自检；有错退出码 1
npx vk check a.html b.html # 多页共用一个浏览器
npx vk shot page.html     # 截图：默认 1920×1080；--phone / --crop x,y,w,h
npx vk serve 8099         # 开发服务器
npx vk tags               # 36 个标签
npx vk doc vk-code        # 某个标签的属性
npx vk icons arrow        # 搜图标名
```

`vk check` 查 40px 地板、正文是否落在 52、对比度、安全区、溢出、裁切、空锚点、非覆盖层重叠；`vk shot` 的自检与它共用同一份 `VK.auditPage()`。构建缓存放在 `.vk-cache/`，删掉它等价于 `--force`。

没有构建时：`vk-code` / `vk-diff` 在 HTTP 下会退化成纯文本并警告；`file://` 下 `src` 取不到，请先 `npx vk serve` 或 `npx vk build`。

## 7 · 字体与颜色

字体随包：Inter / JetBrains Mono / Noto Sans SC 子集，`vk/fonts.css` 一个文件。

- **只有白纸**：没有深色主题、深色代码窗、反色卡片。
- **字阶只有五档**：120 / 88 / 64 / 52 / 40。要读懂的内容 52，元数据/标签/密集 ASCII 数据 40（`data-meta`），不得再低。
- **焦点**用 `--vk-focus`（冷钴蓝）做底，不要拿它写正文。
- **语义**（`--vk-ok` / `--vk-err` / `--vk-warn`）只做色条、底色、图标。
- **语法**（`--vk-syn-*`）只出现在代码和终端里。

## 8 · 没有动效

库不提供播放器、时间轴、逐行淡入、打字机。
**静止帧就是成品**：`vk shot` 出的那张图就是最终画面；转场与动效在剪辑软件里做。

## 9 · 锚点与内部寻址

`for` / `from` / `to` 接受 CSS 选择器，也接受 `#id@part:arg`：

```html
<vk-pin for="#arr@line:4">第 4 行</vk-pin>
<vk-pin for="#cells@cell:3">第 3 格</vk-pin>
<vk-pin for="#cells@region:10%,0%,40%,100%">这四个字节</vk-pin>
<vk-edge from="#buf@side:right" to="#mem@point:0%,50%"></vk-edge>
```

**几何锚点**：`point:x%,y%`、`side:top|right|bottom|left`、`region:x%,y%,w%,h%`，百分比相对目标自己的盒子；任何有盒子的标签都能被点到。

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

写错会在 `npx vk build` 报错。

## 10 · 规格页

规格页不随 npm 包发布；在仓库里跑 `npm run build` 后打开 `_site/index.html`：

- **索引**：6 页 × 6 格（3 列 × 2 行）。每格是整张标本页的等比缩略图 + 名字，和点进去看到的一致。
- **一页一个组件**：一行元信息 + 标准形态，**单镜头**。
- **属性表**：`docs/reference.md`，由 registry 生成。
- **变体**：不进页面；每个组件的预设由门禁逐条施加并比对像素。
- 桌面 only；不提供移动布局。
