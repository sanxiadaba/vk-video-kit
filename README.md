# vk

给编程科普视频用的**单帧画面库**：一帧 = 1920×1080 一张图。
不做文案、不做分镜、不做动画、不做视频渲染——这是画面层。

- **20 个件**：画布 / 标题带 / 流 / 坐标画布 / 面 / 文字 / 图片 / 源码窗 / 表格 / 列表 / 树 / 公式 / 内存格 / 字节 / 位 / 步骤 / 条 / 时间线 / 关系图 / 标注
- **一套刻度**：字号 44 / 56 / 84 / 132 / 200 / 280；线宽 4 / 8 / 12；颜色用 `light-dark(浅, 深)`
- **构建期预处理**：语法高亮、公式、字节、树、汇编、图标、地址。运行期只做四件需要测量的事
- **只出图**：每帧三件产物，1920 PNG + 780 PNG + frame.json

观众在手机横屏看：1920 的帧缩到约 **780 宽（0.406×）**。所以正文最小 56px（手机 22.7px），
自动缩小的地板 44px（手机 17.9px），结构线 4px（手机 1.6px）。

## 安装

```bash
npm ci
node bin/vk.mjs --help
```

依赖 Node ≥ 20.11。出图用 Playwright：找不到自带 Chromium 时会回退到系统 Chrome / Edge；
要固定渲染器就 `npx playwright install chromium`。

## 一条命令

```bash
node bin/vk.mjs render pages/03.html
```

产物在 `out/`：

| 文件 | 用来 |
|---|---|
| `03.png` | 1920 成片 |
| `03.780.png` | 手机尺度预览（视频里就长这样） |
| `03.json` | 每块矩形、重叠、对比度、实际字号、焦点、内容占比 |

`vk render` 会先构建、自检、再出图；`vk check` 只构建 + 自检 + 写 json（不出图）。
多帧页（一个文件里多个 `<vk-page>`）按 id 拆成多组产物。

## 写一帧

```html
<vk-page>
  <vk-head kicker="第 3 集 · 指针" counter="03" lede="从 a 起走一个 int。">下标是<em>偏移量</em>。</vk-head>
  <vk-code id="c" lang="c" title="a.c" chrome="dots" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]         // 从 a 起走一个 int
    </script>
  </vk-code>
  <vk-callout mode="ring" for="#c@line:2"></vk-callout>
</vk-page>
```

```bash
node bin/vk.mjs check  pages/        # 只自检
node bin/vk.mjs doc    vk-code       # 一个件的属性表
node bin/vk.mjs brief  --json        # 全部契约（给机器读）
node bin/vk.mjs icons  arrow         # 搜图标名
```

## 文档

| 文件 | 解决什么 |
|---|---|
| [docs/GUIDE.md](docs/GUIDE.md) | 怎么写一帧：结构、容量、选件、颜色、标注、拆帧 |
| `out/CONTRACT.md` | 全部组件与属性（`node tools/gen.mjs` 生成，不入库） |
| `node bin/vk.mjs brief --json` | 同一份契约的机器可读版（唯一权威） |

## 自检判五类

没画布 / 渲染失败 / 资源失败 / 文字被裁或出界 / 锚点指空。
其余（留白、重叠、焦点数、对比度、密度）只报数：那是默认值和作者的判断，不是门禁。

## 测试

```bash
npm test               # 契约 + 负例 + 渲染 + 行为 + 确定性，约一分钟
npm test -- --update   # 改了默认版式之后重写 tests/geometry.json
```

## 结构

```
src/vocab.mjs        值：字号 / 行高 / 间距 / 颜色（light-dark 成对）/ 线宽 / 字体
src/schema.mjs       契约：20 个组件的属性、取值、默认值、子节点、一帧容量
src/contract.mjs     校验 + 契约生成（schema 驱动的唯一路径）
src/build.mjs        构建：校验 + 高亮 / 公式 / 字节 / 树 / 汇编 / 图标 / 地址
src/runtime/         运行期：底座 / 代码缩字号 / 关系图 / 标注 / 自检
src/*.css            样式：tokens（生成）→ base → components → callout
bin/vk.mjs           命令行
tools/gen.mjs        从 vocab 生成 tokens，从 schema 生成 out/CONTRACT.md
tools/vendor.mjs     字体与 KaTeX（自托管）
tools/bundle.mjs     打 CSS 与 dist/vk.js
tools/test.mjs       测试
docs/                给作者看的指南（只有一份）
tests/               验收帧 + 行为页 + 负例 + 几何快照
code/                测试用的示例源码与编译产物
```

主题只有一条规则：**谁声明底色，谁写 `color-scheme`**。所有颜色 token 都是
`light-dark(浅色, 深色)`，所以深色页里放浅色卡片、卡片里再放深色块，嵌套几层都对。

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT，Lucide ISC。
