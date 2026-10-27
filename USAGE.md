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

`dist/vk.js` 是运行时（IIFE，约 96KB，零依赖）。全量 Lucide 图标不进运行时：`npx vk build` 只把本页 `<vk-icon>` 用到的 SVG 注入页面；开发服务器也会现场注入。

## 2 · 写一个代码窗

```html
<vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" highlight="4" density="large">
</vk-code>
```

- `src` 指向真实源文件，`lines="1-8"` 选片段；行号默认按**源文件**行号（4-6 就是 4/5/6），`numbering="slice"` 才从 1 起。
- `src` 相对当前 HTML 文件；文件不存在时 `npx vk build` 会直接报错。
- `highlight="4"` 高亮片段第 4 行；`focus="4"` 让其余行退到 0.28。
- `fold="4"` 在第 4 行后插一条“中间省略”，被折叠的行真的不渲染。
- `surface="ink"` 切深色；不写就是纸面。
- `density="large"` 是 56px 主镜头；默认 48px。
- `chrome="none"` 去窗头和页脚；行号由 `numbers="none"` 单独控制。

终端默认浅色，和代码窗一致；要深色写 `surface="ink"`。结果行用**显式前缀**，不猜；`src` 指向真实 transcript 文件：

```html
<vk-term title="zsh" src="code/hello.term"></vk-term>
```

`code/hello.term` 是一段真实终端记录：命令行以 `$` 开头，结果行用 `✓` / `!` / `✗` 前缀。`!` 是作者标注，不是工具输出。

## 3 · 对比

```html
<vk-diff w="1280" lang="c" file="bounds.c" src="code/real.diff"></vk-diff>
```

源文件就是 git diff 格式（`diff --git` / `@@` / 行首空格 / `+` / `-`）。默认排成**上下对照**：改前一行、改后一行，词级改动有下划线，顶部只写一句 `N 行改动`。`variant="split"` 换成左右两窗并排；`summary="none"` 关掉计数，`chrome="none"` 去窗头与页脚。

## 4 · 行旁批注

```html
<vk-annotate w="560">
  <vk-code id="arr" w="1040" lang="c" file="array.c" src="code/array.c" lines="4-6" highlight="2">
  </vk-code>
  <vk-note line="1">下标只有 0–2。</vk-note>
  <vk-note line="2">i &lt;= 3 让 i 到 3。</vk-note>
  <vk-note line="3">i = 3 时写到 a[3]。</vk-note>
</vk-annotate>
```

- `line="3"` 指代码行；`for="#id"` 指任意元素，也可以写 `for="#id@part:arg"` 指到内部（见 §11）。
- `span="9-12"` 和 `line` 一起用，表示这一行里第 9–12 个字符（列从 0 起）。
- 绑代码行的批注按行心对齐、贴在行右侧；**没有长引线**。
- `for` 目标才会画一条短正交引线（目标处一个圆点）。
- `w` 是批注栏宽（默认 600）；`n="1"` 是可选的“第几步”，默认不出现。

## 5 · 内存格与步骤

```html
<vk-cells values="1|2|3|0" labels="a[0]|a[1]|a[2]|a[3]"
          addr="0x7ffc" stride="4" flag="3"></vk-cells>

<vk-steps current="2">
  <li>写代码</li>
  <li>编译</li>
  <li>运行</li>
</vk-steps>
```

`flag` 是 0-based；示例里 `flag="3"` 指向 `a[3]`，越界那一格会变红并把标签换成“越界”。

结构体 / 内存对齐用三个下标属性（都从 0 起）：

```html
<vk-cells values="0x2a|'h'|…" labels="int x · 4 字节|char y|填充 3 字节"
          spans="4|1|3" pad="2" addr="0x7ffc" stride="1"></vk-cells>
```

- `spans`：每个字段占几个格（缺省 1）；地址按“字段从第几个字节开始”算，跨格后的字段会跳过它占的宽度。
- `pad`：哪些字段是填充格（斜纹底 + 虚线边），可写 `2` 或 `2,4-5`。
- `mark`：哪些格高亮（钴蓝底 + 钴蓝边），可写 `0` 或 `0,2-3`。**是格序号，不是字节偏移**；格宽 ≤150px 时地址自动退到 28px，再窄才省略。

### 树、字节、栈帧与公式

```html
<vk-tree src="code/app" active="src/parser.py" depth="2"></vk-tree>
<vk-bytes src="code/hello.bin" addr="0x7ffc" length="48" highlight="1-6"></vk-bytes>
<vk-frames src="code/stack.json" active="3"></vk-frames>
<vk-math display size="body" src="code/formula.tex"></vk-math>
```

- `vk-tree` 的 `src` 必须是**真实目录**：构建期扫描层级、类型、大小；JSON 树已移除。
- `vk-bytes` 的 `src` 是真实二进制：构建期切成十六进制 + ASCII + 地址；`highlight` 是 1-based 字节段。
- `vk-frames` 的 `src` 是真实 `.json`：一帧一组槽位；`active` 标当前帧，`grows` 只改生长方向。
- `vk-math` 的 `src` 是真实 `.tex` 文件；构建期 KaTeX 编译，运行时只读产物。

## 6 · 页面

`vk-page` 是画布工具：安全区 96 / 120、按容器宽度缩放、可选的页眉页脚。

```html
<vk-page footer="第 1 章 · 从能跑到讲清楚 | 01 / 12" align="center">
  <vk-stack gap="lg">
    <vk-title size="title" sub="改一个字符，改的是内存里的一个字节。">
      字符串不是值，是<em>一块内存</em>
    </vk-title>
    <vk-code lang="c" file="hello.c" src="code/hello.c" lines="1-8" highlight="4"></vk-code>
  </vk-stack>
</vk-page>
```

不想用页面就把它拿掉：元件本身是 1920 的设计像素，不会自己改版；需要整块缩放时只有 `vk-page` 会按容器宽度等比缩放。

## 7 · 构建

```bash
npx vk build page.html    # 处理一个文件
npx vk build .            # 处理当前目录（递归）
npx vk check              # 只检查代码/公式预编译是否最新
npx vk serve 8099         # 开发服务器，改 .c 刷新即见
npx vk shot page.html     # 截图：默认 1920×1080；--phone 出 640；--crop x,y,w,h 出局部
```

没有构建时：`vk-code` / `vk-diff` 在 HTTP 下会退化成纯文本并警告；`file://` 下 `src` 取不到，请先 `npx vk serve` 或 `npx vk build`，不要直接双击 HTML。

## 8 · 字体与颜色

字体随包：Inter / JetBrains Mono / Noto Sans SC 子集，`vk/fonts.css` 一个文件。

颜色、字号、间距都是 CSS 变量（`--vk-*`）。四条规矩：

- **内容字不小于 44 设计像素**；行号、文件名、索引编号、层、图注等元数据 28–40；门禁/契约对 `[data-meta]` 放行。
- **焦点**用 `--vk-focus`（冷钴蓝）做底，不要拿它写正文。
- **语义**（`--vk-ok` / `--vk-err` / `--vk-warn`）只做色条、底色、图标。
- **语法**（`--vk-syn-*`）只出现在代码和终端里。

明暗：

- `vk-term` 默认浅色；`surface="ink"` 变深。
- `vk-code` / `vk-diff` / `vk-figure` 默认纸面；`surface="ink"` 变深。
- 同屏可以混用——默认都浅，终端要深色时显式写 `surface="ink"`。

## 9 · 没有动效

库不提供播放器、时间轴、逐行淡入、打字机，也没有 `vk.freeze()`。
**静止帧就是成品**：`vk shot` 出的那张图就是最终画面；转场与动效在剪辑软件里做。

## 10 · 锚点与内部寻址

`for` / `from` / `to` 接受 CSS 选择器，也接受 `#id@part:arg`：

```html
<vk-note for="#arr@line:4">第 4 行</vk-note>
<vk-note for="#cells@cell:3">第 3 格</vk-note>
<vk-edge from="#arr@line:4" to="#cells@cell:3"></vk-edge>
```

| part | 用在 | 编号 |
|---|---|---|
| `line` / `char` | `vk-code` / `vk-diff` | 源文件行号；字符列从 0 起 |
| `cell` | `vk-cells` | 下标从 0 起 |
| `byte` | `vk-bytes` | 偏移从 0 起（`highlight` 同样是 0-based） |
| `row` | `vk-table` | 行下标从 0 起 |
| `node` | `vk-tree` | 节点路径 |
| `step` / `item` | `vk-steps` / `vk-list` | 下标从 0 起 |

写错会在 `npx vk build` 报错：找不到 id、组件不支持该 part、下标越界、批注行号超出代码行数。

## 11 · 从标本册拿代码

标本册不随 npm 包发布；在仓库里跑 `npm run build` 后打开 `_site/index.html`：

- **索引**：浅色 docs 外壳；34 个组件总览、搜索、层筛选，点卡进页。
- **一页一个组件**：成品 / 变体 / 解剖 / 用法 / API 五个镜头，`1–5` 切换。
- **复制**：变体和 API 镜头都能复制当前片段。片段里的 `src` 仍指向真实文件；粘到新页面后要跑 `npx vk build`（或 dev server）预编译。
- **属性**：API 镜头从 registry 生成，4 行/页；`src` / `lines` / `file` / `title` 等属于内容，不在这里改。
- **解剖**：运行时量 DOM 生成的蓝图；不是手绘图。
- 桌面 only；不提供移动布局。

## 进阶属性

```html
<vk-box h="480" surface="paper">
  <vk-stack gap="sm" justify="between" grow>
    <vk-text>顶部</vk-text>
    <vk-text>底部</vk-text>
  </vk-stack>
</vk-box>

<vk-title size="display">第一章</vk-title>
<vk-term src="code/hello.term" lines="2-8"></vk-term>
<vk-tree src="code/app" active="src/parser.py"></vk-tree>

<vk-annotate w="560">
  <vk-code id="arr" src="code/array.c"></vk-code>
  <vk-note for="#arr">这段整体看。</vk-note>
  <vk-edge from="#arr" to="#arr" from-side="top" to-side="bottom"></vk-edge>
</vk-annotate>
```
