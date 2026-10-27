# Changelog

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
