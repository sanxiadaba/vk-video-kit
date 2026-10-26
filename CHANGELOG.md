# Changelog

## 1.0.0

首个公开版本。30 个标签（29 个元件 + 1 个页面工具）、8 个成品帧、1920×1080、桌面 only。

- **共享原语**：Frame（尺寸 / 流 / 溢出 / 面）、Lines（代码 / 终端 / diff 共用行模型）、Spatial（canvas / edge / annotate 的跨组件几何）；组件只声明自己用哪套，不各自重写。
- **真实文件**：`vk-code` / `vk-term` / `vk-diff` / `vk-filetree` / `vk-math` 的 `src` 指向真实文件，构建期由 Shiki / KaTeX 编译；运行时零依赖。
- **视觉**：冷钴蓝只做焦点底；语义色不写正文；44px 字号地板；纸 / 软 / 墨三档材质。
- **门禁**：`verify`（生成物与源码一致）、`contract`（每个公开属性真的产生声明效果）、`gate`（44px / 对比度 / 安全区 / 裁切 / console / 溢出）、`links`、`pack`，外加浏览器回归与纯函数单测。
- **包**：只发运行时、字体、CLI 与 editor metadata；展示站、示例、门禁不随包发布。
- **仓库**：源码 only；`_site/` 是构建产物，`npm run build` 后 `git status` 仍然干净。
