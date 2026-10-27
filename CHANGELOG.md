# Changelog

## 5.0.0

把库推进到「可寻址的讲解画布」：6 个新标签、8 个核心件做透、内联源码、覆盖层与 40 页标本册。

### 新增 6 个标签（40 个标签 / 5 层）

- **`vk-memory`**：进程地址空间，text / data / bss / heap / stack 一段一段摆开，支持地址、大小、生长方向与 `@seg` 锚点。
- **`vk-asm`**：汇编清单，地址 / 机器码 / 指令三列，支持 `@line` 与 `@addr`；与 `vk-code` 同行连线。
- **`vk-timeline`**：年份轴（等宽列、按日期排序）与多泳道（`variant="lanes"`），支持 `@event` / `@lane`。
- **`vk-pin`**：自由批注气泡 + 引线，自动贴边或写死 `x` / `y`，支持多步编号。
- **`vk-ring`**：圈选 / 框选 / 下划线 / 括号，绑任意锚点，只画覆盖层。
- **`vk-spotlight`**：除目标外整体压暗，可多目标，`dim` / `feather` 可调。

### 8 个核心件做透

- **`vk-cells`**：`offsets` 字节尺、`direction="rtl"`、`align` 对齐括号、每字节 `data-byte` 锚点。
- **`vk-bits`**：子节点 `<i label value>` 多行矩阵、每格 `data-bit` 锚点、按位数自动缩放。
- **`vk-bytes`**：`word` 分组、`endian="little"`、内联 hex、`@byte` 锚点。
- **`vk-code`**：内联源码、`span` 逗号多区间、行/字符锚点不变。
- **`vk-table`**：每个 `td` 写 `data-cell="r,c"`，支持 `@cell:行,列`。
- **`vk-note`**：`for` 可独立使用；`line` 仍由 `vk-annotate` 组织。
- **`vk-edge`**：`via="x,y;x,y"` 路径点，支持所有 part 锚点。
- **`vk-frames`**：槽位 `@slot:帧,槽` 与 `@frame` 锚点。

### 构建 / 作者入口

- **内联源码块**：`<script type="text/plain" data-vk-source>` 可用于 `code` / `diff` / `term` / `math` / `tree` / `frames` / `bytes` / `asm`；与 `src` 只能二选一。
- **锚点协议 v2**：新增 `seg` / `addr` / `bit` / `slot` / `event` / `lane`，覆盖层 `for` 支持逗号多目标；构建期继续静态校验越界与未知 part。
- **标本册**：40 页；成品镜头不再统一 clamp 到 1100，数据件铺满 1360 舞台；索引重排以容纳 40 格。

### 视觉

- 纸面/钴蓝保持；汇编与图解统一 2px 结构线、44 地板；覆盖层只压暗/描边，不改内容尺寸。
- 不新增字体、阴影或动效；静帧仍是唯一成品。

## 4.6.0

两个"看起来能用、其实没接上"的问题，以及一轮性能治理。

### 性能：`npm test` 180s → 13s（源码没变）

| 原来 | 现在 | 为什么 |
|---|---|---|
| 门禁跑 5 个镜头（171 个对象，73s） | 默认只跑「成品」（35 个，约 12s） | 变体 / 解剖 / 用法 / API 四个镜头是**标本册自己的 UI**，不是组件；要全量用 `gate:full` |
| `npm test` 先完整 build 一次 | 产物指纹与源码一致就跳过 | 内容哈希写在 `_site/.fingerprint`，不用 mtime（重写同样内容 mtime 会变） |
| 分片固定 4、四组一起抢核 | 契约 4 片、门禁 2 片，分两波 | 实测：8 片比 4 片慢，十几 个 Chromium 互相拖 |
| 契约每个探针快照整棵子树 × 55 个属性 | 只快照该标签**声明的**属性 | `STYLE_PROPS` 是死代码；55 → 平均 6 |

### 两个修复

- **`vk-tree` 的目录行真的能点**：以前三角和文件夹只是画出来的，点击没有任何反应。现在目录行是 `role="button"` + `tabindex="0"` + `aria-expanded`，点击 / Enter / Space 都能开合，`collapsed` 属性仍是最初状态。
- **`vk-figure` 的 `crop` 改成"图片的百分比"**：以前按容器百分比定位，`object-fit: cover` / `contain` 下图片的可见矩形和容器不一致，框会整体偏移（1:1 时偏 200px 以上）。现在按 object-fit / object-position 求出图片画在哪，再把图片坐标换成容器坐标，并按容器裁掉看不见的部分。

## 4.5.0

清历史遗留：撤销 2.0 的「文件树泛化成通用树」，并删掉一批没人用的东西。

- **`vk-tree` 只剩文件树**：去掉 `variant`（files / ast / generic）与两条分支、`jsonEntries`、`code/ast.json`；`src` 只收真实目录，指向 `.json` 会在 `vk build` 直接报错。标签名改为「文件树」。
- 删 `tools/lib/site-ui.mjs`：2.x 多页站壳，没有任何文件 import。
- 删 7 个从未被引用的令牌：`--vk-ink-focus-ink`、`--vk-mod-paper-mark`、`--vk-mod-ink-mark`、`--vk-font-display`、`--vk-t-note`、`--vk-dur-3`、`--vk-ease`（后两个是删动效后的残留）。
- 删 `geometry.mjs` 里只出现一次的 `frameOf`。

## 4.4.0

删掉整帧示例与画廊（4.2 引入的东西）。

- 这一层只负责组件。**把几件拼成一帧是编排层的事**，库不提供成品页、也不提供"配方"。
- 删除 `_site/frame/*`、`_site/gallery.html`、`src/scenes/frames.mjs`、`tools/frames.mjs`。
- 删除索引页与标本页上的"整帧示例"入口，以及 `links` / `gate` / `verify` 里的帧目标。
- 保留 `links` 的可达性检查（从 index.html BFS）：抓的是"页面没人链"，与帧无关。

## 4.3.0

用户实测反馈的四件事：代码窗左边空一条、内存格地址溢出/框不准、画廊点不进去、终端光标。

- **代码窗左侧内距 118 → 32**：118 是为了让行号落在文件名 chip 下方，但 chip 是可选的（没写 `file` 就没有），于是窄窗口左边空出 158px。现在行号与代码都从窗头内距开始；`file` 缺省时自动从 `src` 取文件名，窗头仍然有 chip。设计说明同步改写。
- **`vk-cells` 地址不再溢出**：地址字号 44 → 40（元信息档）、横向内距 16 → 8；格宽 ≤150px 时用容器查询退到 28px；极端窄格才省略（`data-ellipsis`，只对元信息生效）。
- **`vk-cells` 的高亮框**：`[data-mark]` 现在同时改边框色与边框样式，填充格（虚线 + 斜纹）上也能读成"框住"；契约从断底色改为断边框色。
- **`cols` 小于最宽跨格时抬到跨格宽度并警告**：以前会静默生成隐式轨道。
- **`vk-figure` 裁切框补 `box-sizing: border-box`**：帧页没有标本册的全局 reset，边框会额外 +4px 并溢出到裁切区外。
- **导航打通**：标本册索引 → 画廊；每张标本页页脚 → 画廊；画廊页脚 → 标本册；每张帧页脚 → 画廊 / 上一张 / 下一张。`links` 新增**可达性检查**（从 index.html BFS，孤儿页直接失败）——画廊当初就是这样"存在但没人链"。
- **帧与画廊补 `vk.ready()`**：`data-vk-ready` 不再缺席。
- **帧标题不再统一写"C 语言"**：05 换成"数学 · π 与它的算法"；02/03 的副题缩到一行，避免末行只剩一个字。

## 4.2.0

六张整帧示例 + 画廊。

- **`_site/frame/*.html`**：代码+批注、终端、内存格+箭头、diff、公式、窗口+报错，每张都是完整 1920×1080（页眉 / 标题 / 主体 / 页脚）。
- **`_site/gallery.html`**：六张的索引页；标本册回答“这一件长什么样”，画廊回答“几件怎么拼”。
- 帧页与画廊进 `verify`、`links`、`gate`（门禁对象 171 → 178）。
- **终端去掉块状光标**：打字动效删掉之后，那个方块没有存在理由；`caret` 属性、CSS、token 一并移除。
- **`vk-cells` 高亮格补边框**：只亮底、边框仍是灰的，看着像“没框准”；现在底和边一起亮（越界格的红色优先）。
- `vk-figure` 的裁切框示例调准到终止符那一格。

## 4.1.0

把"内存模型"这一层做深，补上汇编。

- **`vk-cells` 三个下标属性**（都从 0 起）：`spans="4|1|3"` 字段跨格、`pad="2"` 填充格（斜纹 + 虚线边）、`mark="0,2-3"` 高亮格。地址改为按**字段起始字节**算，跨格字段后面的字段会跳过它占的宽度。
- **格标签降到 40 并标 `data-meta`**：它是元信息，不是正文；单字节字段的 `char y` 不再折成两行。
- **高亮格的元信息退一档墨色**（`ink-4` → `ink-3`）：钴蓝淡底会把 28–40 的对比度压到 4.45:1，正好卡在 4.5 地板下。
- **`vk-figure` 裁切框** `crop="x,y,w,h"`：0–100 百分比矩形 + 2px 钴蓝 + 框外 14% 压暗，不依赖原图尺寸。
- **`asm` / `x86asm` 语言**：Shiki 的 x86 语法接入，`.s` / `.asm` 扩展名自动识别；C 行 ↔ 汇编行用 `vk-annotate` 配对，不加组件。
- 契约补 4 条（cells 的 spans/pad/mark、figure 的 crop），预设与场景同步：`vk-cells` 的成品换成结构体布局，`vk-figure` 的成品带裁切框。

## 4.0.0

用户变成 AI，整库按"AI 能写对、写错能被抓住"重排。破坏性改动。

- **构建期静态交叉校验**：未知 vk 标签、找不到的 `#id`、`@part` 不匹配、`@cell/@byte/@row` 越界、`vk-note` 行号超出代码、`span` 区间非法、`<vk-window>` 里的双窗头、`<vk-bars>` 子节点不合规——全部在 `vk build` 报中文错，不再只进 console。
- **锚点契约**：内部件输出 `data-line` / `data-char` / `data-cell` / `data-byte` / `data-row` / `data-node-path` / `data-step` / `data-item`；`for` / `from` / `to` 支持 `#id@part:arg`；`vk-code` 与 `vk-note` 增 `span`。下标一律 0 起（代码用源文件行号）。
- **`vk-window` 成为 L1 标签**：min / none / browser / dialog 四种窗头 + 内容槽；`vk-browser` 退场（迁移：`<vk-browser url>` → `<vk-window chrome="browser" url>`）。`vk-tree` / `vk-bytes` / `vk-frames` 补 `chrome="none"`，可以拼进一个窗。
- **三个新件**：`vk-quote`（出处是结构）、`vk-bits`（索引 / 分组 / 符号位）、`vk-bars`（`scale="log"` 才扛得住跨数量级）。
- **删动效**：`data-reveal` / `data-type` / `vk.freeze()` / `data-vk-motion` 全部移除；静止帧就是成品。
- **取消 4 个 hidden 属性**：`vk-stack.justify`、`vk-title.level` 转为公开并有契约；`vk-box.x/y` 仍是 canvas 子件的定位属性（面板不显示，文档写明）。
- **`flag` 与 `bytes.highlight` 改 0-based**，与锚点下标一致。
- **`vk shot`**：CLI 出图，默认 1920×1080，`--phone` / `--crop` 按需；不给 AI 固定喂一张它看不清的小图。
- **`docs/ai.md`**：手写正文 + registry 生成的组件速查，作为 AI 的唯一入口；`npm run build` 重建，`verify` 看守。

## 3.0.2

语法选 B：钴蓝关键字。

- 关键字 `#1d4ed8` + 600；函数回到墨色 + 600；字符串深绿、数字琥珀、运算符/标点墨灰。
- 蓝色只落在关键字和当前行，不再增加第二套前景色。
- 终端同套：`gcc` 钴蓝加粗，路径绿，flag 墨灰。

## 3.0.1

开发闭环提速 + 语法样片。站点本身的视觉不变。

- **单组件闭环** `npm run quick -- vk-code`：build + 该标签 5 个镜头门禁 + 一张截图，约 8s；不再为一个视觉改动跑全量。
- **检查缓存**：`.vk-cache/`，键 = 共享产物（vk/、dist/、assets/、showcase.css/js、检查工具）+ 页面 + 对象名。门禁/契约第二次 no-op 从 60s 级降到 2s 级；`VK_CHECK_CACHE=0` 可强制全跑。失败不写缓存。
- **test-all 并行**：contract / gate / browser / unit 四组同时跑；全量首次 80s，缓存后 36s（build 仍占大头）。
- **dev 重建**：`npm run dev` 现在 watch `src` / `site` / 构建工具，保存即重 build；不再手动 build。
- **语法样片**：`docs/syntax-lab.png` 给出 A–E 五个度（墨骨 / 钴蓝关键字 / 钴蓝函数 / GitHub Light / One Light），站点暂不改色，等选择。

## 3.0.0

浅色产品文档外壳 + 全组件复审。把“深墨书脊 + 白纸舞台”换成 280 侧栏 + 64 顶栏的 docs shell。

- **外壳**：浅灰应用底、白色侧栏 / 内容、1px 边、钴蓝单一强调；31 个组件按层分组进侧栏，搜索/层筛选，`/` 聚焦；原来的封面、深墨台面、衬线图版号移除。
- **字号**：正文 44 仍是地板；行号、图注、索引编号、层、侧栏标签改用 28–40，并显式标 `[data-meta]`；门禁与 contract 只对正文查 44。
- **代码窗**：三点回来；56 高文档头：40 文件名（强调）+ 28 行段 + 语言角标；行号 36、无底色/无阴影；源文件行号（`lines="4-6"` → 4/5/6）；当前行 6% 冷蓝 + 代码左侧 2px 蓝线 + 行号变蓝；语法降饱和：关键字/函数墨色加粗，字符串绿，数字琥珀；文件名做成 48 高圆角 tag，行号与文件名同列（118 inset），行号 36 左对齐；折叠虚线。
- **vk-tree**：成品页改为真实文件树（src/tests/fixtures、长名、M/A 状态、current、深度、计数）；folder/file 图标；`collapsed`、`limit`、`truncated` 修正；溢出不再逃出画面。
- **vk-frames**：slot / value / address 改成共享列（subgrid），address 28px、muted，长 value 省略，value/address 不再叠字。
- **解剖/批注**：编号锚点贴到 part 左侧并加引线；code 的 window/header/body/line 四处可量；annotate 补上 `data-anatomy-target`，边注改成一行一条、按源行号 4/5/6 对齐；图例缩到一行。
- **vk-bytes**：group=1 不再给每个字节加组间距；hex 用 max-content + 1200 宽，ASCII 独立列，不再压住。
- **索引**：31 格 5×7 接触印样；卡片中文名 40、tag/number 28，不再文字压卡；搜索 + 层筛选 + 空态。侧栏跨页保留滚动位置，点击不再跳去追当前项；`overscroll-behavior: contain`。
- **质量**：156 个五镜头对象全绿；contract 265 属性；links / verify / pack / browser / unit 全绿。

## 2.1.0

标本台第一轮：把“幻灯片”改成有页眉、图版、栏位、图例和真导航的标本册。

- **版面**：深墨书脊 280 + 纸舞台 1376。书脊是衬线图版号 / 名称 / 层 / 五镜头；页眉只剩 wordmark 与 015/031；页脚是目录 / 上一页 / 下一页；成品是图版座 + 图注（PLATE 015 / vk-code / L3）；变体是 380 控件栏 + 940 舞台；解剖是实测 part + 底部图例带；用法是两栏 + 整行 mono 片段；索引是深墨封面 + 31 格接触印样。非 16:9 帧外是墨色网格台面。
- **交互**：修掉 `[` / `]` 空接线与 `Esc` 相对路径 500；所有锚点从 `display:contents` 改成可聚焦；镜头路由用 pushState，不再把页眉滚出画布；镜头有 aria-current / aria-selected，控件可 Enter/Space；补 h1 与 main 语义。
- **库**：`vk-tag` 新增 `state`（selected / current / disabled）；`vk-table` 新增 `dense`；`vk-page` 新增 `surface`（paper / ink）；code / term / diff / tree / bytes / frames / figure / browser / page / cells 的内部区域统一发 `data-vk-part`；`vk-note` 的 tone 从“只换一笔”改成整条底色 + 左边线（annotate 里仍保持无底色）；`vk-steps` 完成徽标不再压住编号；`vk-math` 场景去掉裸 `<div>`。
- **内容**：API 4 行/页，按组均分；0 属性用大号 0 + 内容模型；无可见变体给出解释；用法片段只给根标签的前两个属性 + `…`，完整片段仍在复制数据里。
- **门禁**：五镜头 156 个对象全绿；contract 265 个属性；links 识别镜头 hash 路由；`npm test` 8 组全绿。

## 2.0.0

展示站重写成一本自举的标本册；组件集从 30 个重整为 31 个 / 5 层。

- **分层**：L1 原子 6 / L2 排布 4 / L3 器械 17 / L4 关系 3 / L5 页面 1。`vk-edge` 从排布移到关系；`vk-page` 独立成 L5。
- **重组**：删除 `vk-progress`（顺序由 `vk-steps` 表达）；`vk-filetree` 泛化为 `vk-tree`（目录 / AST / 普通结构）；新增 `vk-bytes`（真实二进制 → 十六进制 + ASCII）与 `vk-frames`（真实 JSON 栈帧）。
- **库增强**：`vk-canvas grid` 蓝图纸栅格；`vk-page` 支持 header / footer slot；`vk-frames` 支持 summary / show / density。
- **标本册**：31 张 1920×1080 帧，每页五镜头（成品 / 变体 / 解剖 / 用法 / API）；索引两栏分页；镜头靠 `<template>` 惰性装载。
- **自举**：去掉 45KB 的 site.css / site.js；帧外只剩灯箱、隐藏、焦点三组 CSS；导航、控件、解剖标注全部是 vk 组件。
- **门禁**：`gate` 改为检查 31 张标本页 + 索引；`links` 扫描新站；`contract` 使用 scenes 宿主；`verify` 跟随新生成链。
- **文档**：README / USAGE / design 更新到 5 层与新站；`docs/guide.md`、`examples.html`、`components/`、8 帧与旧生成器退役。

## 1.0.0

首个公开版本。30 个标签（29 个元件 + 1 个页面工具）、8 个成品帧、1920×1080、桌面 only。

- **共享原语**：Frame（尺寸 / 流 / 溢出 / 面）、Lines（代码 / 终端 / diff 共用行模型）、Spatial（canvas / edge / annotate 的跨组件几何）；组件只声明自己用哪套，不各自重写。
- **真实文件**：`vk-code` / `vk-term` / `vk-diff` / `vk-filetree` / `vk-math` 的 `src` 指向真实文件，构建期由 Shiki / KaTeX 编译；运行时零依赖。
- **视觉**：冷钴蓝只做焦点底；语义色不写正文；44px 字号地板；纸 / 软 / 墨三档材质。
- **门禁**：`verify`（生成物与源码一致）、`contract`（每个公开属性真的产生声明效果）、`gate`（44px / 对比度 / 安全区 / 裁切 / console / 溢出）、`links`、`pack`，外加浏览器回归与纯函数单测。
- **包**：只发运行时、字体、CLI 与 editor metadata；展示站、示例、门禁不随包发布。
- **仓库**：源码 only；`_site/` 是构建产物，`npm run build` 后 `git status` 仍然干净。
