# vk 写帧卡（AI 入口）

一帧 = 一个 `<vk-page>`。1920×1080，版心 1680×888。手机横屏满屏约 **693** 宽（0.361×）。
一帧只说一件事；一个 `current`，或一次标注。

## 命令与产物

| 命令 | 作用 |
|---|---|
| `vk check <file> --json` | 构建 + 自检，不出图；改帧时先用它，最快 |
| `vk render <file> --sheet` | 出 `<name>.png`（1920）+ `<name>.phone.png`（693）+ `<name>.json` |
| `vk example <tag> [as]` | 一个件的**完整可跑最小帧**；先抄这个再改 |
| `vk doc <tag>` | 一个件的属性、子项、示例 |
| `vk brief --tag code,board --json` | 只取这几个件的契约（默认紧凑约 29KB，别一上来全读） |
| `vk brief --codes` | 错误码表 |

产物默认在 `out/`；单页叫 `<base>.png`，多页叫 `<base>-<id>.png`；`--sheet` 另出 `sheet.png`，`--frame id` 只出一帧。`--out` 不能指向 `src/bin/tools/tests/docs`。

## 排版事实（写之前先算）

- 标题带：带 `lede` 约 **398**，不带约 **278**，`subhead` 约 **221**；正文带随之变小。
- 有 `note`：正文让出 **560** 注栏，右注栏宽约 440。无 note 的半栏代码约 20 字（`size="caption"` 约 24），有 note 的半栏只剩约 11 字。
- **两块 + 导语通常放不下**：先去掉 `lede`；再不行就拆帧。
- 表格 4 个数据行约 **520**；带 `caption` 再减一行；带导语的正文带只剩 426，4 行放不下。
- `cells` 半栏自动 **2×2**（值 64、标签/地址 56）；这一档不要放 `ptr`（徽标+针脚多占 152）。
- 一帧只放 **一条 `note`**；要标两处用 `mode="mark"` 的多个 `for`。

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
| `vk-callout` | 标记 / 注记 / 箭头 / 量度；`mode="mark\|note\|arrow\|measure"` | 行内 | — |

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
| `span` / `bleed` | 跨栏 / 出血；`bleed="all"` 只给 page 第一层的 `vk-img` | `span` / `bleed="x"` 只写 flow 直接子项 |
| `id` | 字母数字下划线短横线汉字，同帧唯一 | 任何件 |
| `style` | 只写颜色 token（`--vk-focus` / `--vk-syn-*` / `--vk-ink-*` / `--vk-tone`） | 任何件 |

## 机制件最小写法

```html
<!-- list：li 可带 note，右侧一列小字（值 / 地址 / 单位） -->
<vk-board as="list"><li note="a">取首地址</li><li current note="a + i × 4">加下标 × 4</li></vk-board>

<!-- seq：participants 必填；两条用 direction，三条以上用 from/to -->
<vk-seq participants="客户端,服务端"><li>SYN</li><li direction="left">SYN+ACK</li></vk-seq>

<!-- graph：节点 <li id>；after 是父，from/to 是显式边 -->
<vk-graph as="row"><li id="a">head</li><li id="b" after="a">7</li><li id="c" after="b" current>13</li></vk-graph>

<!-- dir：JSON 必须包在 data-vk-tree 的 script 里；current 是根名开头的路径 -->
<vk-dir current="src/main.c"><script type="text/plain" data-vk-tree>[{"name":"src","children":[{"name":"main.c"}]}]</script></vk-dir>

<!-- cells：addr 必须 0x；一格一个 li -->
<vk-board as="cells" addr="0x1000" stride="4" cols="4"><li value="1" label="a[0]"></li><li value="7" label="a[1]" current></li></vk-board>

<!-- table：原生 <table>；@item 指数据行，不指单元格 -->
<vk-board as="table" caption="四层存储"><table><tr><th>层</th><th>延迟</th></tr><tr><td>内存</td><td>100 ns</td></tr></table></vk-board>

<!-- bytes：cols 4/6/8；bits：value 只认 0/1/| -->
<vk-code as="bytes" cols="6" addr="0x0" current="1-5"><script type="text/plain" data-vk-source>68 65 6c 6c 6f 00</script></vk-code>
<vk-code as="bits" value="0|01111|0000000000" field-labels="符号,阶码,尾数" current="2-6"></vk-code>

<!-- asm：是 as="asm"，不是 lang="asm"；show-addr=off 省一列 -->
<vk-code as="asm" size="caption" show-addr="off" current="2"><script type="text/plain" data-vk-source>
1004: 48 89 f8 mov %rdi,%rax
1007: 48 01 f0 add %rsi,%rax
</script></vk-code>
```

`current` 是**当前项**：code/asm 是窗口里第几行（`range` 之后），bytes 是字节段，bits 是位段，dir 是路径，table/list 是项号。被 `fold` 掉的行不会亮。`@item` 是第几个条/节点/标出的词。

## 硬规则

1. 可见文字写成元素内容；kicker / counter / lede / note / date / value / label / 窗口标题 / 表题 / 单位 / 目录名 / alt 才走属性。
2. **两块并排**：`<vk-flow cols="1 1">` 或 `"7 5"`；两块加起来放不下就拆帧。
3. **不自动缩字**：放不下就拆帧、砍内容、或标题降 `subhead`；`style` 不能改字号。
4. `current` 按**窗口第几行**算（不是源码行号）；`@item` 是第几个条目 / 标出的词。
5. `mark` 只标**一个完整 token**；`a[i]` 这种跨 token 的写法先只 mark `i`。
6. 主题：谁声明表面谁写 `color-scheme`；深色页里最多一块浅面。
7. 标注是覆盖层：`vk-callout` 只挂 `vk-page` 或 `vk-flow`；`for` 可以写多个目标（空格分隔），一个故事。注记先试右注栏；横线会穿过中间的块时，自动转到目标下方/上方；多行注记对齐第一行。

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

还有四个最常撞的：`as="asm"` 写成 `lang="asm"`；`vk-dir` 裸写 JSON 不包 `data-vk-tree`；半栏 `cells` 放 `ptr`；整句用 `size="caption"`（minFont 仍是 56，但手机上太小）。

## 体检单

每帧 `<name>.json`：

```json
{
  "ok": true, "fits": true,
  "issues": [],
  "health": {
    "head": 278, "band": 546, "bodyWidth": 1680,
    "content": 412, "overflow": 0, "slackTop": 7, "slackBottom": 7,
    "focus": 1, "callout": 0,
    "callouts": [],
    "anchors": 0, "empty": false, "minFont": 56, "under56": [],
    "blocks": [{ "vk": "code", "id": "c", "h": 412, "top": 7, "rows": 3, "font": 64, "overflow": 0 }],
    "clipped": [], "outside": [], "overlaps": [], "images": []
  }
}
```

`ok` = 这一帧没有硬错；`fits` = 纵向放得下。顶层 `ok` = **所有帧**都没有硬错且没有文件级诊断；`produced` 是帧数，`inputs` 是输入文件数，`clean` 是全部 ok 且 fits。都不阻止出图。
全部错误码与改法：`vk brief --codes`；单件：`vk doc <tag>`。
