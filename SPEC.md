# vk · 单帧画面库

**一句话：把一个内容单元画成 1920×1080 上正确、清晰、可测量的那个东西，再把若干单元摆进一帧。**

它不回答：这一页讲什么、分几段、先说哪句、什么时候出现、怎么动。
没有模板、没有时间轴、没有播放器。一帧就是一张图。

---

## 1 一帧

- **1920×1080**，不缩放。手机横屏看到约 780 宽（0.406×）。
- **版心 1680×888**：左右 120、上下 96。内容落在版心里。
- 作者页是**片段**：只写 `<vk-page>`，`<link>` 和 `<script>` 由构建注入，不用你抄路径。
- 一帧只说一件事。装不下就是这一帧讲多了 —— 拆帧，不是缩字。

```html
<vk-page>
  <vk-stack gap="wide">
    <vk-label counter="1 / 4">内存</vk-label>
    <vk-text size="headline">字符串不是值，是<em>一块内存</em></vk-text>
    <vk-code id="c" lang="c" file="hello.c" current="2">
      <script type="text/plain" data-vk-source>
char s[] = "hello";
s[0] = 'H';
      </script>
    </vk-code>
  </vk-stack>
  <vk-callout mode="note" for="#c@line:2">把 H 写进第一个字节</vk-callout>
</vk-page>
```

**帧计数要对**：每帧的 `<vk-label counter="3 / 9">` 要和实际顺序、总数一致，对不上构建期就报。

**`id` 不许重**：重名会让出图互相覆盖、锚点只指到第一个，构建期直接报错。

一个文件可以写多帧：`<vk-page id="1-intro">…</vk-page><vk-page id="2-index">…</vk-page>`，
`vk render a.html` 出 `a-1-intro.png`、`a-2-index.png`。

## 2 只有五个词

| 词 | 意思 | 取值 |
|---|---|---|
| `tone` | 语义 | `neutral / info / focus / ok / warn / err` |
| `size` | 字号 | 六个档名 |
| `gap` `pad` | 间距 | `none / close / normal / wide / section`，或像素数 |
| `current` | 第几项 | **1 起**；`-1` = 没有当前（`vk-tree` 例外：写节点路径） |
| `state` | 注意力 | 只写在项上（`<li>` / 表格行）：`current` / `mark` |

没有第二个词表达同一个意思。`tone` 管对错，`state` 管注意力，别混。

## 3 字号

| 档 | px | 手机 | 用在哪 |
|---|---|---|---|
| `caption` | 48 | 19.5 | 标签、单位、脚注：不读第二遍的字 |
| `body` | 56 | 22.7 | 正文与数据（地板） |
| `subhead` | 84 | 34 | 一句话的主张 |
| `headline` | 132 | 54 | 一帧的标题（一行 12 字，超过就换 `subhead`） |
| `display` | 200 | 81 | 一页最多一次 |
| `hero` | 280 | 114 | 一个数字 / 一个词当家 |

- 行高固定（64 / 80 / 120 / 176 / 240 / 300），不要自己写行高。
- `style=` 里写 `font-size` / `line-height` / `color` 会被构建期拦下：排版只有一个来源。
- 行宽按「一行几个字」自动算：正文 25 字。要铺满写 `measure="none"`。
- 表格的数字列自动右对齐并用等宽数字；文字列不动。
- `size` 只表字号；没有 `mass`、没有第二套密度。
- 数据件（`code` / `table` / `tree` / `bytes` …）的字号只到 `subhead`：它们是内容，不是标题。

## 4 间距与形

- 间距五档：`none 0 / close 16 / normal 32 / wide 64 / section 128`，加像素逃生口 `gap="48"`。
- 圆角 `none / md / pill`；描边 `none / hair / strong`；线宽 `hair 1 / rule 2 / strong 4`。
- 库不出现 margin：父级给 `gap`，自己给 `pad`。

## 5 颜色

- **纸**：`paper`；`soft` 一档浅底；`tint` 语义淡底；`dark` 只在需要反白时用。
- **墨**：`primary / secondary / muted` 三档。正文用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。深色底上会自动换成更亮的蓝。
- 每集用一张深色帧收尾（`<vk-page surface="dark">`）——这是本系列的习惯，不是库的规定。
- **四个语义色**：`info`（作者注）/ `ok` / `warn` / `err`。只出现在线、图标、底标上；**不写正文**。
- 层：`tokens.generated.css`（由 `vocab.mjs` 生成）→ `--vk-*` → 组件。组件里没有 hex。

## 6 排布

五种盒子，按"要解决什么"来选：

| 要解决的问题 | 用 |
|---|---|
| 一条线往下排 | `vk-stack`（`direction="row"` 横排） |
| 分栏、或按 12 栏摆 | `vk-grid`（子项写 `span`；等分用 `ratio`） |
| 正好两块对照 | `vk-pair`（中轴字写 `symbol`） |
| 东西要叠着 | `vk-layer`（第一个铺底，其余按 DOM 顺序压上去） |
| 只能按坐标摆 | `vk-canvas`（逃生口，能不用就不用） |

写法：

```html
<vk-stack gap="wide">…</vk-stack>                 <!-- 竖排；direction="row" 横排 -->
<vk-grid cols="12" gap="normal">                  <!-- 12 栏，子项写 span / row-span -->
<vk-grid ratio="1 8 23" gap="close">              <!-- 按比例分列：位域图例常用 -->
  <vk-code span="7">…</vk-code>
  <vk-stack span="5">…</vk-stack>
</vk-grid>
<vk-canvas w="1400" h="600">…子项写 x / y…</vk-canvas>
<vk-layer>…第一个铺底，其余按 DOM 顺序叠上去…</vk-layer>
<vk-pair symbol="vs">…正好两块…</vk-pair>   <!-- `symbol` 写中轴上那个字；写了 split 就不画轴 -->
```

- `span` 只属于 `vk-grid` 的子项；`x` `y` `w` `h` `z` 只属于 `vk-canvas` 的子项。写错位置构建期就红。
- **`vk-canvas` 的子项要写清 `w` / `h`**：不写就按内容高，内容一变就超出画布（自检会报 `超出了 canvas Npx`）。
- **`vk-layer` 里的重叠是对的**，自检不会报。压字那种写法，图不要写 `bleed`（出血把图从文档流里摘出去，
  层就塌成文字那么高），给 `ratio` 让图自己撑高。
- 图对照只有并排和上下两种：静态图里没有"拖动"，滑动裁切那种交互做不了。
- `vk-pair` 默认左右等分；`split="30"` 改成左三右七；`direction="vertical"` 上下对照。

## 7 27 个件

| 件 | 画什么 | 属性 |
|---|---|---|
| （所有件） | 共享 | `span` `row-span` `grow` `bleed` |
| `vk-text` | 一段文字 | `size` `weight` `ink` `tone` `align` `measure` `icon` `mono` |
| `vk-label` | 一行小字 | `variant`(kicker/chip/badge) `tone` `icon` `counter` |
| `vk-inline` | 行内代码 / 公式 / 上下标 / 键位 | `variant` |
| `vk-box` | 一块面 | `surface` `tone` `pad` `radius` `border` `title` `chrome` `ring` |
| `vk-img` | 一张图 | `src` `alt` `ratio` `fill` `radius` `position` |
| `vk-code` | 代码窗 | `lang` `src` `lines` `file` `current` `focus` `fold` `mark` `size` `long` `chrome` |
| `vk-term` | 终端 | `src` `title` `prompt` `current` `size` `surface`(默认 dark) `chrome` |
| `vk-diff` | 改动 | `src` `lines` `file` `lang` `current` `size` |
| `vk-asm` | 汇编 | `src` `lines` `file` `current` `size` `chrome` `bytes` |
| `vk-table` | 表格 | `variant` `mono` `size` `caption`（表上方标题） |
| `vk-list` | 列表 | `variant`(bullet/check/ordered/define) `gap` `size` |
| `vk-math` | 公式 | `src` `display` `size`（TeX 可直接写在标签里） |
| `vk-tree` | 文件树 | `src` `title` `depth` `max` `current` `size` |
| `vk-cells` | 内存格 | `addr` `stride`(每格几字节，默认 1) `cols` `current` `size` |
| `vk-bytes` | 字节窗 | `src` `addr` `offset` `length` `cols` `current`（1 起，如 "1-3"） |
| `vk-bits` | 位串 | `value`（竖线分段：符号 \| 指数 \| 尾数）`label` `index` `group` `sign` `size` |
| `vk-steps` | 步骤条 | `current` `direction` `connector` `size` |
| `vk-bars` | 横条 | `max` `unit` `tone` `scale` |
| `vk-timeline` | 时间线 | `variant` `start` `end` `lanes` `size` `current` |
| `vk-compare` | 两张图对照 | `labels` `variant` `mark` |
| `vk-callout` | 圈 / 线 / 注 / 编号 | `mode` `for` `from` `to` `label` `side` `gap` `shape` `tone` |
| `vk-stack` | 竖排 | `gap` `pad` `align` `justify` `direction` `weights` |
| `vk-grid` | 栅格 | `cols` `gap` `pad` `align` `ratio` |
| `vk-canvas` | 自由摆 | `w` `h` `pad` |
| `vk-layer` | 叠放 | `surface` `tone` |
| `vk-pair` | 并置 | `direction` `split` `symbol` `gap` |
| `vk-page` | 一帧 | `id`(帧名，出图用作文件名) `align`(top/center/bottom，默认 center) `surface`(paper/dark，默认 paper) |

属性的完整取值与默认值：`vk doc <tag>`；机器可读的一份：`vk brief --json`。

**选型**：要讲的东西 → `code` / `term` / `diff` / `asm`（真实文本）· `cells` / `bytes` / `bits`（内存）·
`table` / `list` / `tree`（结构）· `steps` / `bars` / `timeline` / `compare` / `pair`（关系）·
`box` `text` `label`（版面）· `callout`（指着某处说一句）。

### 背景与全幅

一帧可以有一张铺满整帧的底：把它写成 `vk-page` 的直接子项，加 `bleed="all"`。
整帧反白（章节页、终端时刻）就直接写 `<vk-page surface="dark">`：纸变深，正文、次要、弱化三档墨自动换成亮色，不用逐处改 `ink`。
深色页上，自带纸/浅底的件（代码窗、内存格、卡片、注释气泡）会把自己的整套颜色钉回纸面；表格线、步骤章、横条槽、时间线日期、语义色与淡底都会自动换成暗色系的一套。

`tests/darks.html` 是深色页的验收页：基础件、流程件、数据件、标注、语义色，五帧。
终端在深色页上会自然融进去——`vk-term` 默认就是深色窗，去掉窗头（`chrome="none"`）就是一张"整帧终端"。

```html
<vk-page>
  <vk-img src="../assets/cover.png" alt="封面" bleed="all"></vk-img>
  <vk-stack gap="wide">…内容压在图上…</vk-stack>
</vk-page>
```

`bleed="x"` 只横向出血，`bleed="y"` 只纵向。出血只对自己生效，不影响兄弟。

**铺满整帧的图是背景**：`vk-img[bleed="all"]` 会绝对定位铺满画布，内容自动压在它上面。
但图上的字必须在实底上（`vk-box surface="paper"`）—— 库不提供遮罩，别把正文直接压在照片上。



### 几个容易选错的取值

| 属性 | 取值 | 什么时候用 |
|---|---|---|
| `vk-label variant` | `kicker`（默认） | 一帧开头那行小字：编号 + 栏目名 |
| | `chip` | 标签/分类，浅底胶囊 |
| | `badge` | 状态，实心底、白字 |
| `vk-inline variant` | `code`（默认） | 正文里的标识符、运算符 |
| | `math` | 行内公式 |
| | `sup` / `sub` | 上下标（不常用） |
| | `keys` | 键盘键帽，如 <kbd>Ctrl</kbd> |
| `vk-box radius` | `md`（默认）/ `none` / `pill` | 卡片 / 直角 / 胶囊 |
| `vk-box border` | `none`（默认）/ `hair` / `strong` | 无描边 / 细分隔 / 强调框 |
| `vk-code long` | `clip`（默认） | 超出就裁（配合 `long="wrap"` 换行） |
| `vk-term chrome` | `min`（默认） | 有窗头，像应用里的终端 |
| | `none` | 整帧终端，没有窗头，用于"深色呼吸" |
| `vk-compare variant` | `side`（默认） | 左右两张图并排 |
| | `stack` | 上下叠，差异更明显 |


### 没有这些属性（别猜）

几个"看着该有、其实没有"的，写在这里省得反复试：

| 想做的事 | 没有的属性 | 怎么做 |
|---|---|---|
| 文字在格子里上下居中 | `vk-text` **没有纵向 `align`**（只管左右） | 包一层 `<vk-stack justify="center">` |
| 给容器加内边距 | `vk-layer` **没有 `pad`**（内距固定 32） | 用 `vk-box pad=…` 包住，或改用 `vk-stack`/`vk-grid`（它们有 `pad`） |
| 终端里的语法高亮 | `vk-term` **没有 `lang`** | 要高亮就用 `vk-code`，终端就让它朴素 |
| 改行高 / 字距 | 没有 | 行高由 `size` 决定，字距固定在 token 里 |
| 给正文上语义色 | `vk-text.tone` 只有 `neutral` / `focus` | 语义色只在线、底标、图标上 |

## 7.5 配方

五个最常用的组合。每一段都能直接贴进页面，渲染出来是干净的（`tests/recipes.html` 就是这五段）。

**封面：左边标题，右边一张图**

```html
<vk-page id="1-cover">
  <vk-grid cols="12" gap="normal">
    <vk-stack span="6" gap="normal" justify="center">
      <vk-label counter="1 / 7">第 6 集 · 编译链路</vk-label>
      <vk-text size="subhead">从 .c 到 .exe，<br>中间发生了什么。</vk-text>
    </vk-stack>
    <vk-img span="6" src="../assets/hello/asm-o0.png" ratio="4 / 3" fill="contain" radius="md"></vk-img>
  </vk-grid>
</vk-page>
```

**代码 + 圈住一行**

```html
<vk-page id="2-code">
  <vk-stack gap="normal">
    <vk-label counter="2 / 7">代码 + 圈住一行</vk-label>
    <vk-text size="subhead">关键就在<em>这一行</em>。</vk-text>
    <vk-code id="c" lang="c" file="sum.c" src="../code/opt/sum.c" lines="1-3" current="2"></vk-code>
    <vk-text size="caption" ink="muted">圈的是源文件第 2 行。</vk-text>
  </vk-stack>
  <vk-callout mode="ring" for="#c@line:2" tone="focus"></vk-callout>
</vk-page>
```

**前后对照**

```html
<vk-page id="3-pair">
  <vk-stack gap="normal">
    <vk-label counter="3 / 7">前后对照</vk-label>
    <vk-text size="subhead">同一个循环，<em>一个顺、一个跳</em>。</vk-text>
    <vk-pair symbol="vs">
      <vk-code lang="c" file="a.c">
        <script type="text/plain" data-vk-source>
for (i = 0; i < n; i++)
    sum += a[i];
        </script>
      </vk-code>
      <vk-code lang="c" file="b.c">
        <script type="text/plain" data-vk-source>
for (i = 0; i < n; i++)
    sum += a[idx[i]];
        </script>
      </vk-code>
    </vk-pair>
  </vk-stack>
</vk-page>
```

**表格 + 一句结论**

```html
<vk-page id="4-table">
  <vk-stack gap="normal">
    <vk-label counter="4 / 7">表格 + 一句结论</vk-label>
    <vk-text size="subhead">越往下，<em>越慢也越大</em>。</vk-text>
    <vk-table variant="spec">
      <table>
        <tr><th>层级</th><th>容量</th><th>延迟</th></tr>
        <tr><td>L1</td><td>32 KB</td><td>1ns</td></tr>
        <tr><td>内存</td><td>16 GB</td><td>100ns</td></tr>
      </table>
    </vk-table>
    <vk-text size="caption" ink="muted">差两个数量级。</vk-text>
  </vk-stack>
</vk-page>
```

**深色章节页**

```html
<vk-page id="5-chapter" surface="dark">
  <vk-stack gap="wide">
    <vk-label counter="5 / 7">第二章</vk-label>
    <vk-text size="display">数据在哪，<br>决定它多快。</vk-text>
    <vk-text size="body" ink="secondary">从缓存行到数组，从 1ns 到 100ns。</vk-text>
  </vk-stack>
</vk-page>
```

**一组数字：横条**

```html
<vk-page id="6-bars">
  <vk-stack gap="normal">
    <vk-label counter="6 / 7">两组数字</vk-label>
    <vk-text size="subhead">同样的活，差了<em>四倍</em>。</vk-text>
    <vk-bars max="30" unit="毫秒">
      <li value="5" label="数组" tone="ok"></li>
      <li value="23" label="链表" tone="err"></li>
    </vk-bars>
    <vk-text size="caption" ink="muted">八百万次累加，同一台机器。</vk-text>
  </vk-stack>
</vk-page>
```

**一个终端窗口**

```html
<vk-page id="7-term">
  <vk-stack gap="normal">
    <vk-label counter="7 / 7">一个终端窗口</vk-label>
    <vk-text size="subhead">跑一遍，<em>输出自己说话</em>。</vk-text>
    <vk-term title="python">
      <script type="text/plain" data-vk-source>
$ python3 -c "print(0.1 + 0.2)"
0.30000000000000004
      </script>
    </vk-term>
  </vk-stack>
</vk-page>
```

## 8 内容从哪来

**真实文本是唯一真相。** 两种写法，二选一：

```html
<vk-code lang="c" src="../code/hello.c" lines="4-6"></vk-code>   <!-- 真文件 -->
<vk-code lang="c"><script type="text/plain" data-vk-source>…</script></vk-code>  <!-- 内联 -->
```

构建期把高亮 / 公式 / 字节 / 树 / 汇编编译进页面，运行期零依赖。
`vk render` 永远先构建，所以不存在「改了源没重建」。

## 9 关系：指着某处说一句

```html
<vk-callout mode="ring" for="#c@line:5"></vk-callout>
<vk-callout mode="arrow" from="#a" to="#b" shape="ortho"></vk-callout>
<vk-callout mode="note" for="#c@line:5" side="bottom">这一行在写内存</vk-callout>
```

`for / from / to` 接受 CSS 选择器，或 `#id@part:arg`：

| part | 用在哪 | arg |
|---|---|---|
| `line` | code / term / diff / asm | 源文件行号（1 起） |
| `word` | 任意件 | `行号:几个字`（行的部分可省）：只指那段字，不指整行 |
| `cell` | cells | 下标（0 起） |
| `byte` | bytes | 字节偏移（0 起） |
| `bit` | bits | 位下标（0 起） |
| `addr` | asm | 指令地址，如 `#a@addr:401136` |
| `step` | steps | 第几步（0 起） |
| `event` / `lane` | timeline | 事件下标（0 起）/ 泳道名 |
| `node` | tree | 节点路径，如 `#t@node:src/main.c` |
| `point` / `side` / `region` | 任意带 id 的件 | `x%,y%` / `top/right/bottom/left` / `x%,y%,w%,h%` |

圈选按**字的墨迹**取框：`#c@line:5` 圈的是那一行的字，不是 1680 宽的行盒。
要精确到行里的一段字，用 `word`：`#c@word:2:a[2]` 圈住的只是 `a[2]` 这几个字符。

## 10 工作流

```bash
vk render pages/01.html          # 需要时自动重建库 → 构建 → 自检 → 出图 → 打印度量
vk render pages/ --phone         # 780 宽，按手机尺度看
vk render pages/ --width 960     # 任意宽度（会等比缩图）
vk render a.html --out shots/    # 出图目录（默认 out/）
vk render a.html --shot .vk-win  # 只截帧里某个元素：导出素材用
vk check  pages/01.html          # 只自检，不出图
vk doc vk-code                   # 一件的属性表
vk brief --json                  # 全部件的契约（给机器读）
vk icons arrow                   # 搜图标名
vk stats episodes/               # 每集体检：帧数 / 占版心 / 缺主张 / 节奏
vk sheet episodes/ --cols 4      # 把一集缩成联络图，看整体节奏
```

一集 = 一个 `episodes/*.html` 文件，里面按顺序写 `<vk-page id="1-xxx">`；产物在 `out/<同路径>`；一帧一张 PNG，多帧文件按 `<文件名>-<id>.png`。

## 11 节奏

`vk stats episodes/` 会印一行每帧的形态：

```
09-memory.html  ·  9 帧
  节奏 ●字 字 块 条 码 表 步 单 字
```

`码` 代码 · `端` 终端 · `汇` 汇编 · `差` 差异 · `表` 表格 · `单` 清单 · `树` 文件树 ·
`格` 内存格 · `节` 字节 · `位` 位串 · `步` 步骤 · `条` 横条 · `线` 时间线 · `照` 对照 ·
`并` 并置 · `图` 图 / 画布 · `块` 盒子示意 · `式` 公式 · `字` 纯文字 · `●` 深色帧。

连续三帧同一个形态会单独点出来——那一段观众会觉得"怎么还是这个"。

## 12 改动反馈

渲染完会留一份快照（`out/.vk-run.json`），下次渲染对比着报一句：

```
干净：66 帧
比上次变了 65 帧：episodes/01-floats.html#1-hook …
```

改了一个默认值、动了一个 token，不用逐张看图也能知道影响面。快照只比"墨迹范围 / 占版心 / 焦点数 / 问题类型"，
不是像素比对——排版微调不会误报成"变了"。


## 13 一集怎么排

十集走下来，稳定的骨架是这样的（5–10 帧）：

1. **钩子**：一句反常识的话或一个问题。别解释，先让人停下来。
2. **证据**：真代码 / 真终端 / 真字节。这一段观众要能"看见"，不是听你说。
3. **对照或数字**：两种写法并排，或者一组量化的条形。差多少，用画面说。
4. **为什么**：机制。到这一帧观众已经信了，才愿意听解释。
5. **收尾**：一句能被记住的话 + 一帧深色。

几条不是规定、但十集都守着的习惯：

- **每帧一个主张**：最大那行字就是这一帧的观点，没有就用 `vk stats` 找出来补。
- **一集至少一帧深色**：十集都用深色收尾。长一点（8 帧以上）的集，中段再放一次深色呼吸——
  终端、抓包这类"原始输出"最适合，`<vk-page surface="dark">` + `<vk-term chrome="none">`。
- **一帧只说一件事**：装不下就拆帧，不缩字号。
- **节奏别连续三帧同形**：`vk stats` 会点出来。

## 14 自检判什么

只判「无论你画什么，它都错」的事：

1. 出画布 / 出安全区
2. 内容被裁掉、被省略号截断
3. 非覆盖层互相压住
4. 字号低于 36px（手机 14.6px）
5. 对比度不足（正文 4.5:1，大字 3:1）
6. 锚点指不到东西
7. 渲染失败 / 数据过期 / 图片加载失败
8. 文字直接压在图/画布上（SPEC 要求垫实底）
9. 空帧、空件（数据件没读到内容）
10. 画布里的子项超出画布、或互相重叠
11. 一个文件里一帧都没有

**不判**：焦点几个、留白多少、标题多长、色相几种。好看不靠门禁，靠默认值和组件的自动适配
（代码窗先长宽、超过版心再缩字号（窗宽跟版心走，连续帧不会跳）；步骤条窄了会自己竖排；注释自动避开内容；表格数字自动右对齐）。

汇编里的对齐填充（`nop`、末尾的 `lea 0x0(...)`）会自动压暗：它确实在文件里，但不是函数干的事。

长行最后才交给 `long`：`clip` 是默认（窗口长到版心为止，再缩字号，实在放不下才切），
`wrap` 是折行。

## 15 常见错

- `span` 写到 `vk-stack` 的子项上（只有 grid 子项认）。
- 一帧塞两组 `current` 以上：观众不知道看哪。一处就够。
- 代码行数按窗口算，不是按源文件：`@line:5` 是源文件第 5 行。
- 把长句塞进 `headline`：一行 12 字，超了换 `subhead`。
- 用 `tone` 给正文上色：语义色只在线和底上，正文用 `ink`。
- 一帧超过 888 高：删内容或拆帧。`vk render` 会告诉你超了多少。
- `mark` 是**一段原文**（窗口里所有出现处都会被标），不是正则，也不用转义。

