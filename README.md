# vk

给 1920×1080 画面用的**单帧组件库**：一个件画一种内容，一帧就是一张图。
不做文案、不做分镜、不做动画、不做视频渲染——这是画面层，不是内容层。

- 27 个件：代码 / 终端 / 汇编 / 差异 / 表格 / 清单 / 文件树 / 内存格 / 字节 / 位 / 步骤 / 横条 / 时间线 / 图对照 / 公式 / 图片 / 文字 / 标注……
- 一套词汇：六档字号、五档间距、三档墨、五种表面、六个语调。索引一律 1 起。
- 构建期预处理：语法高亮、公式、字节、文件树、汇编、图标。运行期零依赖。
- 只出图：`vk render` 把写好的页面渲成 PNG。

观众在手机横屏上看：1920 的帧缩到约 **780 宽（0.406×）**。
所以字号地板是 44px（手机 17.9px），线宽最小 2px（手机 0.8px）。

## 先看它长什么样

```bash
npm install
vk showcase          # 渲染 tests/frames.html 的 23 帧，排成一页看板并自动打开
```

产物在 `out/showcase/`：`index.html`（缩略图墙，点开看 1920）、`sheet.png`（整页一张图）。
看板是生成物，不入库：改完组件重跑一次就更新。

## 安装

```bash
npm install
npm run build     # 生成 vk/vk.css、vk/fonts.css、dist/vk.js
```

## 写一帧

```html
<vk-page>
  <vk-stack gap="normal">
    <vk-label counter="1 / 8">第 3 集 · 指针</vk-label>
    <vk-text size="subhead">下标是<em>偏移量</em>。</vk-text>
    <vk-code id="c" lang="c" file="a.c" current="2">
      <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]         // 从 a 起走一个 int
      </script>
    </vk-code>
  </vk-stack>
  <vk-callout mode="ring" for="#c@line:2"></vk-callout>
</vk-page>
```

```bash
vk render pages/01.html --phone   # 构建 + 自检 + 出图（780 宽，按手机尺度看）
vk check  pages/                  # 只自检
vk doc    vk-code                 # 一个件的属性表
vk brief  --json                  # 全部契约（给机器读）
vk icons  arrow                   # 搜图标名
vk clean  [--all]                 # 删 out/ 与缓存
```

## 文档

| 文件 | 解决什么 |
|---|---|
| [docs/START.md](docs/START.md) | 最短路径：一个能跑的页 + 五个词 + 六条铁律 |
| [docs/RULES.md](docs/RULES.md) | 一帧容量、选件、颜色语义、深色页、锚点、拆帧 |
| [docs/PITFALLS.md](docs/PITFALLS.md) | 15 个会静默出错的坑，附报错原文 |
| [docs/CONTRACT.md](docs/CONTRACT.md) | 全部件与属性的契约（**生成物**，别手改） |

## 自检判五类

没画布 / 渲染失败 / 资源失败 / 文字被裁 / 锚点指空。
其余（留白、重叠、焦点数、对比度、密度）不判：那是默认值和作者的判断。
`vk render` 会顺手打一行「墨迹 y 96–410（占版心 35%）· 焦点 1」，用来对比相邻帧。

## 测试

```bash
npm test               # 契约 + 渲染 + 行为 + 确定性，约 20 秒
npm test -- --update   # 改了默认值之后重写粗签名
```

## 结构

```
src/vocab.mjs      值：字号 / 行高 / 间距 / 颜色（light-dark 成对）/ 容量 / 地板
src/schema.mjs     契约：27 个件的属性、取值、默认值、子节点
src/contract.mjs   校验 + 文档生成（schema 驱动的唯一路径）
src/build.mjs      构建：校验 + 高亮 / 公式 / 字节 / 树 / 汇编 / 图标
src/runtime/       运行时：底座 / 排布 / 面与字 / 内容 / 图 / 标注 / 自检
src/*.css          样式：tokens（生成）→ base → layout → components → callout
bin/vk.mjs         命令行
tools/             字体 / KaTeX / CSS 生成 / 契约生成 / 打包 / 素材 / 测试
docs/              给作者看的四页
tests/             验收帧 + 行为页 + 粗签名
code/              测试用的示例源码与编译产物
```

主题只有一条规则：**谁声明表面，谁写 `color-scheme`**。所有颜色 token 都是
`light-dark(纸面, 暗面)`，所以深色页里放纸面卡片、卡片里再放深色块，嵌套几层都对。

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT，Lucide ISC。

