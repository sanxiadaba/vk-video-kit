# vk 写帧卡（AI 入口）

一帧 = 一个 `<vk-page>`。1920×1080，版心 1680×888。手机横屏满屏约 **693** 宽（0.361×）。
一帧只说一件事；一个 `current`，或一次标注。

## 骨架

```html
<vk-page id="demo">
  <vk-head kicker="第 1 集 · 指针" counter="1 / 8" lede="一句为什么。">一句<mark>结论</mark>。</vk-head>
  <vk-code id="c" lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1] = 7;
    </script>
  </vk-code>
  <vk-callout mode="note" for="#c@line:2">写进第二个 int。</vk-callout>
</vk-page>
```

## 13 个标签

| 标签 | 用途 | 子节点 | 变体（`as`） |
|---|---|---|---|
| `vk-page` | 画布；`place="band\|top\|center\|bottom"`、`theme` | 块 | — |
| `vk-head` | 眉标 + 标题 + 导语；`size="subhead\|headline\|display"` | 行内 | — |
| `vk-flow` | 唯一排布；`cols`、`gap`、`valign`、`overlay`；子项 `span` / `bleed` | 块 | — |
| `vk-text` | 一段文字；`size`、`ink`、`align`、`icon` | 行内 | — |
| `vk-card` | 一块面；`surface`、`title`、`tone` | 块 | — |
| `vk-img` | 图；`src`、`ratio`、`fill`、`position` | 无 | — |
| `vk-code` | 等宽文本网格 | 见变体 | `code` / `term` / `diff` / `asm` / `bytes` / `bits` |
| `vk-board` | 条目与数据视图 | `<li>`，table 用原生 `<table>` | `list` / `steps` / `bars` / `timeline` / `table` / `cells` |
| `vk-graph` | 节点 + 边 | `<li id>` | `row` / `tree` / `layered` / `mesh` |
| `vk-dir` | 目录树 | `src` 或 JSON | — |
| `vk-seq` | 时序消息 | `<li>` | — |
| `vk-math` | 公式（KaTeX） | TeX | — |
| `vk-callout` | 标记 / 注记 / 箭头 / 量度 | 行内 | `mark` / `note` / `arrow` / `measure` |

## 作者能写的词

| 词 | 取值 | 写在哪 |
|---|---|---|
| `theme` | light / dark | 只写 `vk-page` |
| `surface` | paper / soft / dark | 只写 `vk-card` |
| `place` | band / top / center / bottom | 只写 `vk-page` |
| `tone` | neutral / info / ok / warn / err | 件、行、单元格 |
| `size` | caption / body / subhead / headline / display / hero（分件不同，见 `vk doc`） | 件 |
| `current` | 开关，写在项上；code/bytes/bits 用行段；dir 用路径 | 项 |
| `gap` | none / close / normal / wide / section / 像素 | 只写 `vk-flow` |
| `span` / `bleed` | 跨栏 / 出血 | 只写 flow 的直接子项 |
| `id` | 字母数字下划线短横线汉字，同帧唯一 | 任何件 |
| `style` | 只写颜色 token（`--vk-focus` / `--vk-syn-*` / `--vk-ink-*` / `--vk-tone`） | 任何件 |

## 硬规则

1. 可见文字写成元素内容；kicker / counter / lede / note / date / value / label / 窗口标题 / 表题 / 单位 / 目录名 / alt 才走属性。
2. **两块并排**：`<vk-flow cols="1 1">` 或 `"7 5"`；两块加起来放不下就拆帧。
3. **不自动缩字**：放不下就拆帧、砍内容、或标题降 `subhead`；`style` 不能改字号。
4. `current` 按**窗口第几行**算（不是源码行号）；`@item` 是第几个条目 / 标出的词。
5. `mark` 只标**一个完整 token**；`a[i]` 这种跨 token 的写法先只 mark `i`。
6. 主题：谁声明表面谁写 `color-scheme`；深色页里最多一块浅面。
7. 标注是覆盖层：`vk-callout` 只挂 `vk-page` 或 `vk-flow`；`for` 可以写多个目标（空格分隔），一个故事。

## 锚点

`#id`、`#id@line:3`、`#id@line:3-4`、`#id@item:2`、`#id@bit:5`、`#id@side:left`。
`for` 支持多个：`for="#c@line:2 #m@item:2"`。

## 拆帧预算（实测，不是门禁）

| 内容 | 一帧上限 |
|---|---|
| 代码窗 | 3 行（带导语）/ 4 行（不带） |
| 表格 | 4 个数据行 + 表头（带 caption 再减一行） |
| 内存格 | 全宽 1 行 4 格；半栏 2×2 紧凑格 |
| 时序 | 2 条（带导语）/ 4 条（subhead）/ 6 条（无标题带） |
| 关系图 | 3 层 / 环上 4 节点 |
| 步骤 | 4 步横排 |
| 条 | 4–6 条 |
| 时间线 | 3 点 |
| 位 | 16 位 |
| 字节 | 2 行 × 8 字节 |

## 十个坏味道

1. 一帧两个数据件，硬塞 7:5，代码被裁。
2. 两个 `current`，或 `current` + 一个不相关的标注。
3. 标题超过 11 个字还不换行 / 不降 `subhead`。
4. `vk-flow` 里套 `vk-flow`，列宽算不清。
5. `note` 指右边缘，注记被挤到下一行。
6. 深色页里两张 `paper`。
7. `size="caption"` 写到 card / head 不支持的值。
8. `current="true"`（开关只写属性名）。
9. `mark` 的词在 `range` 外，标不上。
10. `@item` 指向一个没 mark 的词。

## 体检单

每帧 `<name>.json`：

```json
{
  "ok": true, "fits": true,
  "issues": [],
  "health": {
    "band": 546, "content": 412, "overflow": 0,
    "slackTop": 7, "slackBottom": 7,
    "focus": 1, "callout": 0, "minFont": 56,
    "blocks": [{ "vk": "code", "h": 412, "font": 64 }],
    "clipped": [], "outside": [], "overlaps": []
  }
}
```

`ok` = 没有硬错；`fits` = 纵向放得下。两个都不阻止出图。
全部错误码与改法：`vk brief --md`；单件：`vk doc <tag>`。
