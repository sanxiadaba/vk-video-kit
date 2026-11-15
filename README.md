# vk

给编程科普视频用的**单帧画面库**：一帧 = 1920×1080 一张图。
不做文案、分镜、动画、视频渲染——这是画面层。

- **13 个标签**：结构 7（`vk-page` / `vk-head` / `vk-flow` / `vk-text` / `vk-card` / `vk-img` / `vk-callout`）+ 机制 6（`vk-code` / `vk-board` / `vk-graph` / `vk-dir` / `vk-seq` / `vk-math`）。
  机制件用 `as` 选变体，变体名沿用旧件名：`vk-code as="code|term|diff|asm|bytes|bits"`。
- **一套刻度**：字号 56 / 64 / 96 / 144 / 216 / 300；线宽 6 / 8 / 12；间距 4 起。
- **视觉由库决定**：作者只写内容、`current`、`tone`、`theme`、`size`。
- **构建期预处理**：语法高亮、公式、字节、目录、汇编、图标全部在构建期算完；运行期只量关系和标注。
- **只出图**：每帧三件产物，1920 PNG + 780 PNG + 体检单 JSON。

观众在手机横屏看：1920 的帧缩到约 **780 宽（0.406×）**。版心对称 **1680×888**（左右 120 / 上下 96）。
正文 64px（手机 26px），元信息 56px（手机 22.7px），结构线 6px（手机 2.4px）。

## 安装

```bash
npm ci
node tools/build.mjs
```

依赖 Node ≥ 20.11。出图用 Playwright：优先自带 Chromium，找不到时回退系统 Chrome / Edge。

## 一条命令

```bash
node bin/vk.mjs render my-frame.html
```

产物在 `out/`：

| 文件 | 用来 |
|---|---|
| `my-frame.png` | 1920 成片 |
| `my-frame.780.png` | 手机尺度预览（视频里就长这样） |
| `my-frame.json` | 这一帧的体检单：问题 + 真实数字 |

`vk render` 会先确保 `dist/` 与源一致，再构建页面、自检、出图。
加 `--sheet` 会额外拼一张 `sheet.png`：所有帧按 780 宽排成两列，带每帧的占用与焦点，扫一眼就知道整集齐不齐。

**不是门禁**：内容放不下也照样出图，终端与 JSON 里写清事实（`正文带 546 · 内容 648 · 超出 102px`）；只有一张图都没出来才 exit 1。

## 命令

| 命令 | 作用 |
|---|---|
| `vk build` | 重建 `dist/`（tokens、字体、vk.css、vk.js、audit.js），写产物清单 |
| `vk render <file\|dir> [--frame id] [--out DIR] [--json] [--no-preview] [--sheet]` | 构建 + 自检 + 出图；`--sheet` 再拼一张联系表 |
| `vk check <file\|dir> [--frame id] [--out DIR] [--json]` | 只构建 + 自检 + json（不出图） |
| `vk doc <tag> [--json]` | 一个件的全部变体、属性、默认值、示例 |
| `vk brief [--json\|--md]` | 全部契约（唯一权威）；`--md` 就是 `docs/CONTRACT.md` |
| `vk icons <query>` | 搜 Lucide 图标名 |
| `vk clean [--all]` | 删 `.vk-tmp`；`--all` 连 `out/` |

## 写一帧

一帧就是一个 `<vk-page>`。先读 [`docs/GUIDE.md`](docs/GUIDE.md) 的写作判断、
[`docs/DESIGN.md`](docs/DESIGN.md) 的视觉契约；机器可读契约用 `vk brief --json`，单件用 `vk doc <tag>`。
本库不提供模板、版式库或演示剧集。

## 自检只判五类

没有画布（含尺寸不对）/ 组件渲染失败 / 资源没加载 / 文字被裁 / 标注指空。
外加一行**事实**：正文带多高、内容多高、超出多少、焦点几处、每个块的真实字号。
容量、留白、焦点数都不拦，只报数。

## 测试

```bash
npm test               # 契约 / 负例 / 出图与体检单 / 行为 / 确定性 / CLI / 对比度，约两分钟
```

## 结构

```
src/vocab.mjs        值：字号 / 行距 / 间距 / 颜色（light-dark 成对）/ 线宽 / 图标
src/schema.mjs       契约：13 个标签、变体、属性、默认值、子节点、示例、写作规则
src/normalize.mjs    归一化：默认值落地、间距换像素、data-vk 身份
src/contract.mjs     校验 + 契约生成（schema 驱动的唯一路径）
src/build/           构建：入口 / 源码窗 / 条目图 / 关系图 / 块 / 页面壳
src/runtime/         运行期：底座 / 关系图 / 标注（只做测量）
src/audit/           自检：单独打进 dist/audit.js，不进交付页
src/base.css         画布 / 标题 / 流 / 卡片 / 字 / 窗口
src/components.css   机制件（几何与排布）
src/state.css        状态层：current / tone（mark 锚点样式在 base.css）
src/callout.css      标注层
bin/vk.mjs           命令行
tools/build.mjs      唯一构建入口（tokens → 字体 → bundle → 契约 → 产物清单）
tools/gen.mjs        vocab → dist/tokens.css
tools/vendor.mjs     字体与 KaTeX（自托管到 dist/fonts）
tools/bundle.mjs     打 dist/vk.css、dist/vk.js、dist/audit.js
tools/test.mjs       测试
docs/GUIDE.md        写作判断与选件
docs/DESIGN.md       视觉与几何契约
docs/CONTRACT.md     生成物，别手改
tests/fixtures/      一帧一件的最小验收帧
tests/negative/      负例
```

主题只有一条规则：**谁声明表面，谁写 `color-scheme`**。页面用 `theme="light|dark"`，卡片用 `surface="paper|soft|dark"`；
所有颜色 token 都是 `light-dark(浅色, 深色)`，所以深色页里放浅色卡片、卡片里再放深色块，嵌套几层都对。

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT，Lucide ISC。
