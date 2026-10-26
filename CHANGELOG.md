# Changelog

## 2.1.0

标本台第一轮：把“幻灯片”改成有页眉、图版、栏位、图例和真导航的标本册。

- **版面**：每页页眉是图版号 / 名称 / 层 / 五镜头；页脚是目录 / 上一页 / 下一页；成品加 1680×888 图版装裱；变体改成左预设栏 + 舞台 + 底部控件 dock；解剖的 part 改为 `data-vk-part`，宽目标用底部横向图例带；索引改成封面 + 16/15 两页目录；非 16:9 帧外是墨色网格台面。
- **交互**：修掉 `[` / `]` 空接线与 `Esc` 相对路径 500；所有锚点从 `display:contents` 改成可聚焦；镜头/目录路由用 pushState，不再把页眉滚出画布；镜头有 `state` / `aria-selected`，控件可 Enter/Space；补 h1 与 main 语义。
- **库**：`vk-tag` 新增 `state`（selected / current / disabled）；`vk-table` 新增 `dense`；code / term / diff / tree / bytes / frames / figure / browser / page / cells 的内部区域统一发 `data-vk-part`；`vk-page` 暴露真实页眉/正文/页脚 part；`vk-steps` 完成徽标不再压住编号；`vk-math` 场景去掉裸 `<div>`。
- **空状态**：0 属性的 API 用大号 0 + 内容模型；无可见变体的组件给出解释；API 5 行/页，按组均分，不再 29 个单元格换行。
- **门禁**：五镜头 156 个对象全绿；contract 264 个属性；links 识别镜头/索引 hash 路由；`npm test` 8 组全绿。

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
