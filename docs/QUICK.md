# vk 写帧卡（AI 入口）

一帧 = 一个 `<vk-page>`。画布 1920×1080，版心 1680×888；手机横屏满屏 **693**（0.361×）。一帧只说一件事：一个 `current`，或一次标注。

## 命令

| 命令 | 作用 |
|---|---|
| `vk render <file\|dir> [--check]` | 出三件：`<name>.png` + `<name>.phone.png` + `<name>.json`；`--check` 只构建 + 体检，不出图 |
| `vk doc <tag>` | 一个件的属性、子项、示例 |
| `vk example <tag> [as]` | 一个件的完整可跑最小帧 |
| `vk brief [--facts] [--codes] [--tag a,b]` | 机器契约；`--facts` 拿最新排版数字，`--codes` 拿错误表 |
| `vk build` | 重建 `dist/` |
| `vk clean [--all]` | 删 `.vk-tmp`；`--all` 连 `out/` |

`--frame id` 只出一帧，`--out DIR` 换目录，`--json` 时 stdout 只有 JSON。多帧文件按 `<base>-<id>.png` 命名。

## 13 个标签

| 标签 | 用途 | 子节点 | 变体 | 必填 |
|---|---|---|---|---|
| `vk-page` | 画布；`place` / `theme` / `band` | 块：head + 内容 | — | — |

一集里放两帧以上时，给每一帧写 `band="lock"`：同一文件里所有帧的标题带对齐到最高那一帧，切帧时正文不跳。
| `vk-head` | 眉标 + 标题 + 导语 | 行内 | `size`：subhead/headline/display | — |
| `vk-flow` | 唯一排布：列、比例、跨栏、叠放 | 块 | — | — |
| `vk-card` | 一块有材质的面 | 块 | — | — |
| `vk-text` | 一段文字 | 行内 | — | — |
| `vk-img` | 图片；可出血 | 无 | — | `src` |
| `vk-code` | 等宽文本网格 | `data-vk-source` 或 `src` | code/term/diff/asm/bytes/bits | `as="bits"` 的 `value` |
| `vk-board` | 条目图 | `<li>`；table 用原生 `<table>`，表题用 `<caption>` | list/steps/bars/timeline/table/cells/band/frames | —（cells 的 `addr` 与 `stride` 成对） |
| `vk-graph` | 节点 + 边 | `<li id>` | row/tree/layered/mesh（不写也推断） | — |
| `vk-dir` | 目录树 | `src` 或 `data-vk-tree` | — | `src` 或 JSON |
| `vk-seq` | 时序消息；`participants` 可省，从 `from` / `to` 推断 | `<li>` | — | — |
| `vk-math` | 公式 | TeX 或 `src` | — | TeX 或 `src` |
| `vk-callout` | 标注层 | 行内（note）/无 | note/mark/arrow/measure/jump | note/mark：`target`；arrow/measure/jump：`from`+`to` |

`bytes` 用 `cols`（4/6/8）；`bits` 的 `value` 只写 0/1、用 `|` 分段，段名 `fields`，位序 `index`（weight/order/none/sparse）。

## 作者能写的词

| 词 | 取值 | 写在哪 |
|---|---|---|
| `theme` | light / dark | 只写 `vk-page` |
| `surface` | auto / paper / soft / raised | 只写 `vk-card`；auto 跟随页面 |
| `place` | band / top / center / bottom | 只写 `vk-page` |
| `band` | auto / lock | 只写 `vk-page`；lock 让同文件所有帧的标题带对齐 |
| `tone` | neutral / info / ok / warn / err | card、li、tr/td、图节点、时序消息 |
| `size` | caption / body（text、code）；subhead / headline / display（head）；text 可用全阶梯 | 件 |
| `current` | 源码行号（文本窗）、字节段（bytes）、位段（bits）、路径（dir）、项开关（li/tr/td） | 项 |
| `gap` | none / close / normal / wide / section，或像素 | 只写 `vk-flow` |
| `split` | `"7 5"`（比例；与 `cols` 二选一） | 只写 `vk-flow` |
| `span` | 1–12 | flow 直接子项 |
| `bleed` | x（flow 子项的 `vk-img`）/ all（page 第一层的 `vk-img`） | `vk-img` |
| `id` | 字母、数字、下划线、短横线、汉字；同帧唯一 | 任何件 |
| `style` | 只写颜色 token（`--vk-focus` / `--vk-syn-*` / `--vk-ink-*` / `--vk-tone`） | 任何件 |

## 骨架

```html
<vk-page>
  <vk-head kicker="第 1 集 · 主题" counter="1 / 8">一句<mark>结论</mark>。</vk-head>
  <vk-code lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1] = 7;
    </script>
  </vk-code>
  <vk-text ink="secondary">一句解释。</vk-text>
</vk-page>
```

## 三个完整帧

① 代码 + note

```html
<vk-page id="why">
  <vk-head kicker="第 1 集 · 指针" counter="1 / 8" lede="下标是偏移量，不是编号。">下标是<mark>偏移量</mark>。</vk-head>
  <vk-code id="c" lang="c" title="a.c" current="2">
    <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1] = 7;
    </script>
  </vk-code>
  <vk-callout target="#c@line:2">写进第二个 int。</vk-callout>
</vk-page>
```

② 两栏：代码 + 内存格，跨件 mark

```html
<vk-page id="two">
  <vk-head kicker="组合" size="subhead">改一个，另一个跟着变。</vk-head>
  <vk-flow split="7 5" gap="wide" valign="start">
    <vk-code id="c" lang="c" title="a.c" current="2">
      <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1] = 7;
      </script>
    </vk-code>
    <vk-board id="m" as="cells" addr="0x1000" stride="4" cols="2">
      <li value="1" label="a[0]"></li>
      <li value="7" label="a[1]"></li>
      <li value="3" label="a[2]"></li>
      <li value="?" label="a[3]"></li>
    </vk-board>
  </vk-flow>
  <vk-callout as="mark" target="#c@line:2 #m@item:2"></vk-callout>
</vk-page>
```

③ 关系图 + 边标签 + 一条 arrow

```html
<vk-page id="chain">
  <vk-head kicker="链表" size="subhead">每个节点只记下一个在哪里。</vk-head>
  <vk-flow split="7 5" gap="wide" valign="center">
    <vk-graph id="g">
      <li id="a">head</li>
      <li id="b" after="a" edge="next">7</li>
      <li id="c" after="b" edge="next" current>13</li>
    </vk-graph>
    <vk-text id="t">顺着 next 走到底。</vk-text>
  </vk-flow>
  <vk-callout as="arrow" from="#g@item:3" to="#t" label="末尾"></vk-callout>
</vk-page>
```

## 六件新写法

**band**：区间带。`start` / `end` 是数据域，`li` 上的 `start` / `end` 是这一段。

```html
<vk-board as="band" start="0" end="16" unit="ms">
  <li start="0" end="3">读文件</li><li start="3" end="9" current>计算</li>
</vk-board>
```

**frames**：栈帧。一帧一个 `li`，正文写字段。

```html
<vk-board as="frames" top-label="栈顶（低地址）">
  <li title="f(2)" note="返回 0x4012" current>n = 2</li>
  <li title="main" note="返回 0">argc = 1</li>
</vk-board>
```

**jump**：同一段代码里行到行，最多 3 条。

```html
<vk-code id="c" lang="c" title="loop.c" current="2"><script type="text/plain" data-vk-source>
for (i = 0; i < n; i++)
  s += a[i];
</script></vk-code>
<vk-callout as="jump" from="#c@line:2" to="#c@line:1" label="i++"></vk-callout>
```

**`@item:2-4`**：连续几格 / 几行是一组，画一只括号。

```html
<vk-board id="m" as="cells" addr="0x1000" stride="4" cols="4">
  <li value="1" label="a[0]"></li><li value="7" label="a[1]"></li><li value="3" label="a[2]"></li><li value="0" label="a[3]"></li>
</vk-board>
<vk-callout as="mark" target="#m@item:2-4"></vk-callout>
```

**`edge=`**：写在 `after` 边上，给这条边一个标签。

```html
<vk-graph><li id="a">head</li><li id="b" after="a" edge="next">7</li></vk-graph>
```

**`@text:`**：按字面指定 `mark=` 标出的词，不用数第几个。

```html
<vk-code id="c" lang="c" mark="i"><script type="text/plain" data-vk-source>
s += a[i];
</script></vk-code>
<vk-callout as="mark" target="#c@text:i"></vk-callout>
```

## 锚点矩阵

| 件 | `@item:N` 数第几项 |
|---|---|
| code / term / diff / asm | `mark=` 标出的词，按出现顺序；也可用 `@text:词` 按字面找 |
| bytes | 第几个字节（hex 与 ASCII 共用序号） |
| bits | 第几个位段（value 的分段） |
| table | 第几个数据行（表头不算） |
| cells | 第几格 |
| list / steps / bars / timeline / band / frames | 第几个 `<li>` |
| graph | 第几个节点（按书写顺序） |
| seq | 第几条消息 |
| dir | 第几个可见行 |
| 任何件 | `@side:top/right/bottom/left`；`@line` 只给文本窗，是源码行号 |

## 硬规则

1. 可见文字走元素内容；只有 `kicker` / `counter` / `lede` / `note` / `date` / `value` / `label` / 窗口标题 / 表题 / 单位 / 目录名 / `alt` 走属性。
2. `current` 是**源码行号**（1 起，可写 `"4-6"`），不是窗口第几行。
3. 一帧一个 `current`。
4. 一帧只一条 `note`；要标两处用 `as="mark"` 的多目标。
5. 标注只挂 `vk-page` 或 `vk-flow`。
6. `span` 与 `bleed="x"` 只给 flow 直接子项；`bleed="all"` 只给 page 第一层的 `vk-img`。
7. 不自动缩字；放不下就拆帧、砍内容、降 `size`。
8. 谁声明表面谁写 `color-scheme`：`vk-page theme`、`vk-card surface`。

## 拆帧预算

| 内容 | 一帧量级 |
|---|---|
| 代码窗 | 3–4 行 |
| 表格 | 4 个数据行 + 表头 |
| 内存格 | 全宽 1 行 4 格；半栏 2×2 |
| 时序 | 2–6 条 |
| 关系图 | 3 层；环上 4 节点 |
| 区间 | 3–4 段 |
| 栈帧 | 4 帧 |
| 步骤 | 4 步 |
| 条 | 4–6 条 |
| 时间线 | 3 点（方块节点，轴按数据域） |
| 位 | 16 位 |
| 字节 | 2 行 × 8 字节 |

数字会变：跑 `vk brief --facts` 拿最新的；这里只记量级。

## 体检单

每帧 `<name>.json`；`ok` 只判硬错，`fits` 只判放不放得下；两个都不拦出图。

| 字段 | 一句话 |
|---|---|
| `ok` | 这一帧没有硬错（结构、渲染、裁切、锚点）。 |
| `fits` | 纵向放得下：`overflow=0`。 |
| `anchors` | 指空的锚点数；>0 说明 `target` / `from` / `to` 找不到 id 或行。 |
| `focus` | `current` 的个数；一帧应为 1。 |
| `minFont` | 画面最小字号；整句掉到 56 说明该用 `body`。 |
| `under56` | 小于 56 的文字清单。 |
| `blocks` | 每块的 `h` / `top` / `rows` / `font` / `overflow`。 |
| `callouts` | 每条标注的 `side` / `tight`；`tight` 表示注记挤住目标。 |
| `band` | 正文带可用高。 |
| `content` | 内容实际高。 |
| `overflow` | 内容超出正文带的像素；>0 即放不下。 |
| `slackTop` / `slackBottom` | 上下余量。 |
| `clipped` | 横向被裁的文字（含 `over`）。 |
| `outside` | 出画布的块。 |
| `overlaps` | 叠在一起的块。 |
| `images` | 图片实际尺寸与填充方式。 |
| `head` / `bodyWidth` | 标题带高 / 正文可用宽。 |
| `empty` | 空帧。 |
| 顶层 `ok` / `clean` | 所有帧无硬错 / 全部 `ok` 且 `fits`。 |

## 症状 → 改法

1. `overflow>0`：先删一行 / 去 `lede`，再降 `subhead`，最后拆帧。
2. `focus=2`：只留一个 `current`；另一处改成 `as="mark"` 标注。
3. 半栏代码被裁（`clipped`）：代码 `size="caption"`、缩短行；`split` 给代码更多宽；还不行拆帧。
4. `anchors>0`：目标没 `id` 或锚点写错；`@line` 要用源码行号。
5. `callouts[].tight`：注记挤住目标；换 `@side` 或标到另一行；还挤就拆帧。
6. 深色页放浅面：`surface="auto"` 跟随页面；深色页最多一块 `paper`。
7. `minFont=56` 且是整句：整句换 `body`；`caption` 只留标签、单位、行号、地址。
8. `fits:true` 但太空：加一句解释、放大一号，或把两帧并一帧。
