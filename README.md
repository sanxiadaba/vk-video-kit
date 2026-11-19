# vk

给编程科普视频用的**单帧画面库**：作者写 HTML，构建期预处理，一条命令出 1920×1080 PNG + 693 手机预览 + 体检 JSON。只做画面层，文案、配音、动画、分镜、视频都不在这里。

## 安装

Node ≥ 20.11；出图用 Playwright 自带的 Chromium（`npx playwright install chromium`）。浏览器版本不对会直接报错，不会拿系统浏览器出一批颜色错的图。

```bash
git clone https://github.com/sanxiadaba/vk-video-kit && cd vk-video-kit
npm ci
node bin/vk.mjs render tests/fixtures/code.html
```

产物在 `out/`：`<name>.png`、`<name>.phone.png`、`<name>.json`。多帧文件按 `<base>-<id>.png` 命名；`--out` 不能指向 `src/bin/tools/tests/docs`。

## 13 个标签

- `vk-page` —— 画布
- `vk-head` —— 标题带
- `vk-flow` —— 排布
- `vk-card` —— 面
- `vk-text` —— 文字
- `vk-img` —— 图
- `vk-callout` —— 标注
- `vk-code` —— 源码 / 终端 / diff / 汇编 / 字节 / 位
- `vk-board` —— 列表 / 步骤 / 条 / 时间线 / 表格 / 内存格 / 区间 / 栈帧
- `vk-graph` —— 关系图
- `vk-dir` —— 目录树
- `vk-seq` —— 时序
- `vk-math` —— 公式

机制件用 `as` 选变体；`vk-callout` 的变体是 note / mark / arrow / measure / jump。全部属性与最小帧：`vk doc <tag>`、`vk example <tag>`、`vk brief`。

## 命令

| 命令 | 作用 |
|---|---|
| `vk render <file\|dir> [--check] [--frame id] [--out DIR] [--json]` | 构建 + 体检 + 出三件；`--check` 只体检不出图 |
| `vk doc <tag>` | 一个件的属性、子项、示例 |
| `vk example <tag> [as]` | 一个件的完整可跑最小帧 |
| `vk brief [--facts] [--codes] [--tag a,b] [--json]` | 机器契约 |
| `vk build` | 重建 `dist/` |
| `vk clean [--all]` | 删 `.vk-tmp`；`--all` 连 `out/` |

## 目录

```
src/schema.mjs     唯一契约：13 个标签、变体、属性、子节点、示例
src/vocab.mjs      值：字号 / 行高 / 间距 / 颜色 / 线宽
src/build/         构建期：源码窗 / 条目图 / 关系图 / 页面壳
src/runtime/       运行期：测量、连线、标注
src/audit/         自检：单独打进 dist/audit.js
src/contract/      校验、错误码、文档出口
src/shared/        构建与运行期共用的纯函数
bin/vk.mjs         命令行
tools/             出图、构建、验收
docs/QUICK.md      AI 写帧卡（唯一的写帧入口）
docs/DESIGN.md     视觉契约（维护者）
tests/fixtures/    一帧一件的验收帧
```

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT。
