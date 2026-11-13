# vk

给编程科普视频用的**单帧画面库**：一帧 = 1920×1080 一张图。
不做文案、分镜、动画、视频渲染——这是画面层。

- **20 个件**：画布 / 标题带 / 流 / 卡片 / 文字 / 图片 / 源码窗 / 表格 / 列表 / 目录树 / 公式 / 内存格 / 字节 / 位 / 步骤 / 条 / 时间线 / 关系图 / 时序 / 标注
- **一套刻度**：字号 40 / 56 / 84 / 132 / 200 / 280；线宽 4 / 6 / 8 / 12；间距 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **视觉由库决定**：窗口白底、语法四色、当前行聚光、连接件一套几何；作者只写内容、`current`、`tone`、`theme`
- **构建期预处理**：语法高亮、公式、字节、目录树、汇编、图标、地址；运行期只做需要测量的四件事
- **只出图**：每帧三件产物，1920 PNG + 780 PNG + frame.json

观众在手机横屏看：1920 的帧缩到约 **780 宽（0.406×）**。版心是对称的 **1680×888**（左右 120 / 上下 96）。正文 56px（手机 22.7px），元信息 40px（手机 16.2px），结构线 8px（手机 3.2px）。

## 安装

```bash
npm ci
node bin/vk.mjs build
```

依赖 Node ≥ 20.11。出图用 Playwright：优先自带 Chromium，找不到时回退系统 Chrome / Edge，并把实际引擎版本写进报告。

## 一条命令

```bash
node bin/vk.mjs render my-frame.html
```

产物在 `out/`：

| 文件 | 用来 |
|---|---|
| `my-frame.png` | 1920 成片 |
| `my-frame.780.png` | 手机尺度预览（视频里就长这样） |
| `my-frame.json` | 这一帧的问题（只报画不出来/确实坏了的） |

`vk render` 会先构建 `dist/`（tokens / 字体 / 样式 / 运行期 / 自检），再构建页面、自检、出图。
`vk check` 只构建 + 自检 + 写 json（不出图）。

**默认不是门禁**：内容或版式有问题也照样出图，问题写进 JSON、在图上标成红框/占位；只有一张图都没出来才 exit 1。

## 命令

| 命令 | 作用 |
|---|---|
| `vk build` | 重建 `dist/`（tokens、字体、vk.css、vk.js、audit.js） |
| `vk render <file\|dir> [--frame id] [--out DIR] [--json] [--no-preview]` | 构建 + 自检 + 出图 |
| `vk check <file\|dir> [--frame id] [--out DIR] [--json]` | 只构建 + 自检 + json |
| `vk doc <tag> [--json]` | 一个件的属性、范围、默认值、必填、示例 |
| `vk brief [--json\|--md]` | 全部契约（唯一权威） |
| `vk icons <query>` | 搜 Lucide 图标名 |
| `vk clean [--all]` | 删 `.vk-tmp`；`--all` 连 `out/` |

## 写一帧

一帧就是一个 `<vk-page>`。先读 [`docs/GUIDE.md`](docs/GUIDE.md) 的写作判断；
机器可读契约用 `vk brief --json`，单件用 `vk doc <tag>`，最短骨架在 `brief` 的 `skeleton` 里。
本库不提供模板/版式库，也不放演示剧集。

## 自检只判五类

没画布 / 渲染失败 / 资源失败 / 文字被裁或出界 / 锚点指空。
容量、留白、焦点数、字号、安全区、重叠、对比度都不报；那是作者和视觉设计的事。

## 测试

```bash
npm test               # 契约 + 负例 + 渲染 + 行为 + 确定性 + CLI，约一分钟
```

## 结构

```
src/vocab.mjs        值：字号 / 字距 / 行距 / 间距 / 颜色（light-dark 成对）/ 线宽 / 图标
src/schema.mjs       契约：20 个组件的属性、取值、默认值、子节点、示例、写作规则
src/normalize.mjs    归一化：默认值落地、间距换像素、style 合并
src/contract.mjs     校验 + 契约生成（schema 驱动的唯一路径）
src/build/           构建：四类源码窗、内容件、图、排布
src/runtime/         运行期：底座 / 代码缩字号 / 关系图 / 标注
src/audit/           自检：单独打进 dist/audit.js，不进交付页
src/base.css         画布 / 标题 / 流 / 卡片 / 字 / 墨
src/components.css   20 个件的样式
src/callout.css      标注层
bin/vk.mjs           命令行
tools/gen.mjs        从 vocab 生成 dist/tokens.css
tools/vendor.mjs     字体与 KaTeX（自托管到 dist/fonts）
tools/bundle.mjs     打 dist/vk.css、dist/vk.js、dist/audit.js
tools/test.mjs       测试
docs/GUIDE.md        给作者看的写作指南（只有一份）
tests/fixtures/       一帧一件的最小验收帧
tests/negative/       负例
```

主题只有一条规则：**谁声明表面，谁写 `color-scheme`**。页面用 `theme="light|dark"`，卡片用 `surface="paper|soft|dark"`；
所有颜色 token 都是 `light-dark(浅色, 深色)`，所以深色页里放浅色卡片、卡片里再放深色块，嵌套几层都对。

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT，Lucide ISC。
