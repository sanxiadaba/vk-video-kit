# vk · 单帧画面库

给编程科普视频用的**元素层**：把一个内容单元（代码 / 终端 / diff / 树 / 字节 / 位 / 表格 / 公式 / 图 / 文字）
画成 1920×1080 画布上正确、清晰、可测量的那个东西，并把若干单元按份摆进画布。

- **不做**：文案、讲解架构、版面模板、时间轴 / 动画 / 播放 / 转场 / 录屏 / 渲染。
- **做**：30 个标签、一套布局协议、一套词汇（六档字号 / 六色语义 / 三档墨 / 一种纸）、
  构建期预编译（Shiki / KaTeX / hexdump / 树 / 图标）、结构自检、出图。
- **手机横屏基准**：1920 收到约 780 宽（0.406×），正文 56px ≈ 22.7 设备像素。

作者手册（给 AI 的入口）是 [SPEC.md](SPEC.md)。属性细节用 `vk doc <tag>` 查。

## 安装与构建

```bash
npm install
npm run build        # 生成 vk/vk.css、vk/fonts.css、dist/vk.js
```

## 写一帧

```html
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">

<vk-page align="center">
  <vk-stack gap="md">
    <vk-text size="headline">字符串不是值，是<em>一块内存</em></vk-text>
    <vk-code lang="c" file="hello.c" src="../code/hello.c" lines="4-6" current="5"></vk-code>
  </vk-stack>
</vk-page>

<script src="dist/vk.js"></script>
```

```bash
node bin/vk.mjs build pages/a.html       # pages/ → out/，编译代码 / 公式 / 字节 / 树 / 图标
node bin/vk.mjs check pages/a.html       # 结构自检（字号 / 对比度 / 安全区 / 溢出 / 重叠 / 焦点）
node bin/vk.mjs shot pages/a.html        # 出 out/a.png（--phone 出 780 宽）
```

**构建只写 `out/`，不改源文件。**

## 30 个标签

| 层 | 标签 |
|---|---|
| 原子 6 | `box` `panel` `text` `label` `inline` `img` |
| 排布 6 | `stack` `grid` `layer` `pair` `flow` `canvas` |
| 数据 15 | `list` `code` `term` `diff` `table` `math` `compare` `tree` `cells` `bytes` `steps` `bits` `bars` `asm` `timeline` |
| 关系 2 | `annotate` `note` |
| 页面 1 | `page` |

同一件事只有一个写法：`tone` 六值、`size` 六档、`current` 1 起、
`state="current|mark|ok|warn|err"`、`columns` 一个列开关。
没有别名、没有旧写法、没有 `at` / `cue` / `enter`。

## 自检与出图

```bash
node bin/vk.mjs check pages/             # 多页共用一个浏览器
node bin/vk.mjs shot pages/a.html --phone
node bin/vk.mjs shot pages/a.html --width 640 --out out/a.png
node bin/vk.mjs doc vk-code              # 属性 / 取值 / 默认值
node bin/vk.mjs brief                    # 属性清单（--json 给机器）
node bin/vk.mjs tags                     # 30 个标签
node bin/vk.mjs icons arrow              # 搜 Lucide 图标名
```

`vk check` 只判客观错误：字号地板、对比度、安全区、溢出、裁切、非覆盖层重叠、
一处以上焦点、空锚点、渲染失败、素材过期、空帧。

## 测试与预算

```bash
npm test             # 构建 + schema + 30 张样张（不启浏览器）
npm test -- --full   # + 30 页自检 + 640 宽截图回归（约 9s）
npm run budget       # 标签 / 属性 / 行数预算，超了直接红
```

样张在 `tests/pages/`，由 `npm test` 生成，只用于构建与回归，不是模板。
`vk build` 有内容哈希缓存，只重编改过的页；`vk check` 与 `vk shot` 一组页共用一个浏览器和字体缓存。

## 画廊

```bash
npm run gallery      # → out/index.html + out/c/*.html + 30 张 640 宽截图
npm run serve        # → http://127.0.0.1:8099/
```

点缩略图进组件详情：实时 1920 帧、属性表、最小写法、上下一个。
`out/` 是自包含的静态站（已镜像 vk / dist / assets），推 `main` 后由
`.github/workflows/pages.yml` 发布到 GitHub Pages。

## 结构

```
src/schema.mjs      公开 API 的唯一来源（标签 / 属性 / 取值 / 默认值 / 子节点 / 状态）
src/runtime/        组件实现
src/*.css           样式层（tokens → elements → layout → components → page → relations）
cli/                build / check / shot
tools/              构建、样张、画廊、预算、测试
pages/              作者页（源）；构建产物在 out/
```

## 许可

MIT。字体 OFL 1.1、Shiki MIT、KaTeX MIT、Lucide ISC，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
