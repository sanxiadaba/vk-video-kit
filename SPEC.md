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

一个文件可以写多帧：`<vk-page id="1-intro">…</vk-page><vk-page id="2-index">…</vk-page>`，
`vk render a.html` 出 `a-1-intro.png`、`a-2-index.png`。

## 2 只有五个词

| 词 | 意思 | 取值 |
|---|---|---|
| `tone` | 语义 | `neutral / info / focus / ok / warn / err` |
| `size` | 字号 | 六个档名 |
| `gap` `pad` | 间距 | `none / close / normal / wide / section`，或像素数 |
| `current` | 第几项 | **1 起**；`-1` = 没有当前 |
| `state` | 注意力 | `current`（现在讲这里）/ `mark`（作者标了一下） |

没有第二个词表达同一个意思。`tone` 管对错，`state` 管注意力，别混。

## 3 字号

| 档 | px | 手机 | 用在哪 |
|---|---|---|---|
| `caption` | 48 | 19.5 | 标签、单位、脚注：不读第二遍的字 |
| `body` | 56 | 22.7 | 正文与数据（地板） |
| `subhead` | 84 | 34 | 一句话的主张 |
| `headline` | 132 | 54 | 一帧的标题（≤ 14 字） |
| `display` | 200 | 81 | 一页最多一次 |
| `hero` | 280 | 114 | 一个数字 / 一个词当家 |

- 行高固定（64 / 80 / 120 / 176 / 240 / 300），不要自己写行高。
- 行宽按「一行几个字」自动算：正文 25 字。要铺满写 `measure="none"`。
- `size` 只表字号；没有 `mass`、没有第二套密度。

## 4 间距与形

- 间距只有五档：`close 16 / normal 32 / wide 64 / section 128`，加像素逃生口 `gap="48"`。
- 圆角 `none / md / pill`；描边 `none / hair / strong`；线宽 `hair 1 / rule 2 / strong 4`。
- 库不出现 margin：父级给 `gap`，自己给 `pad`。

## 5 颜色

- **纸**：`paper`；`soft` 一档浅底；`tint` 语义淡底；`dark` 只在需要反白时用。
- **墨**：`primary / secondary / muted` 三档。正文用 primary。
- **一个焦点色**（钴蓝）：只在「正在讲这里」时出现。
- **四个语义色**：`info`（作者注）/ `ok` / `warn` / `err`。只出现在线、图标、底标上；**不写正文**。
- 层：`tokens.generated.css`（由 `vocab.mjs` 生成）→ `--vk-*` → 组件。组件里没有 hex。

## 6 排布

只有四种写法：

```html
<vk-stack gap="wide">…</vk-stack>                 <!-- 竖排；direction="row" 横排 -->
<vk-grid cols="12" gap="normal">                  <!-- 12 栏，子项写 span / row-span -->
<vk-grid ratio="1 8 23" gap="close">              <!-- 按比例分列：位域图例常用 -->
  <vk-code span="7">…</vk-code>
  <vk-stack span="5">…</vk-stack>
</vk-grid>
<vk-canvas w="1400" h="600">…子项写 x / y…</vk-canvas>
<vk-layer>…第一个铺底，其余叠上去…</vk-layer>
<vk-pair symbol="vs">…正好两块…</vk-pair>
```

- `span` 只属于 `vk-grid` 的子项；`x / y / w / h / z` 只属于 `vk-canvas` 的子项。写错位置构建期就红。
- **`vk-canvas` 是最后的逃生口**：坐标要自己算，元素高度变了位置就错。堆叠用 `vk-stack`、分栏用 `vk-grid`、
  对照用 `vk-pair`。只有"必须按坐标摆"（示意图、连线两端）才用 canvas。

## 7 27 个件

| 件 | 画什么 | 关键属性 |
|---|---|---|
| `vk-text` | 一段文字 | `size` `weight` `ink` `tone` `align` `measure` `icon` `mono` |
| `vk-label` | 一行小字 | `variant`(kicker/chip/badge) `tone` `icon` `counter` |
| `vk-inline` | 行内代码 / 公式 / 上下标 / 键位 | `variant` |
| `vk-box` | 一块面 | `surface` `tone` `pad` `radius` `border` `title` `chrome` `ring` |
| `vk-img` | 一张图 | `src` `alt` `ratio` `fill` `radius` `position` |
| `vk-code` | 代码窗 | `lang` `src` `lines` `file` `current` `focus` `fold` `mark` `size` `long` `chrome` |
| `vk-term` | 终端 | `src` `title` `prompt` `current` `size` `surface` `chrome` |
| `vk-diff` | 改动 | `src` `lines` `file` `lang` `current` `size` |
| `vk-asm` | 汇编 | `src` `lines` `file` `current` `size` `chrome` `bytes` |
| `vk-table` | 表格 | `variant` `mono` `size` `caption`（表上方标题） |
| `vk-list` | 列表 | `variant`(bullet/check/ordered/define) `gap` `size` |
| `vk-math` | 公式 | `src` `display` `size` |
| `vk-tree` | 文件树 | `src` `title` `depth` `current` `size` |
| `vk-cells` | 内存格 | `addr` `cols` `current` `size` |
| `vk-bytes` | 字节窗 | `src` `addr` `offset` `length` `cols` `current` |
| `vk-bits` | 位串 | `value`（`|` 分段：符号\|指数\|尾数）`label` `index` `group` `sign` |
| `vk-steps` | 步骤条 | `current` `direction` `connector` `size` |
| `vk-bars` | 横条 | `max` `unit` `tone` `scale` |
| `vk-timeline` | 时间线 | `variant` `start` `end` `lanes` `current` |
| `vk-compare` | 两张图对照 | `labels` `split` `variant` `mark` |
| `vk-callout` | 圈 / 线 / 注 / 编号 | `mode` `for` `from` `to` `label` `side` `gap` `shape` `tone` |
| `vk-stack` `vk-grid` `vk-canvas` `vk-layer` `vk-pair` | 排布 | 见第 6 节 |
| `vk-page` | 一帧 | `align`(top/center/bottom，默认 center) |

属性的完整取值与默认值：`vk doc <tag>`；机器可读的一份：`vk brief --json`。

**选型**：要讲的东西 → `code` / `term` / `diff` / `asm`（真实文本）· `cells` / `bytes` / `bits`（内存）·
`table` / `list` / `tree`（结构）· `steps` / `bars` / `timeline` / `compare` / `pair`（关系）·
`box` `text` `label`（版面）· `callout`（指着某处说一句）。

### 背景与全幅

一帧可以有一张铺满整帧的底：把它写成 `vk-page` 的直接子项，加 `bleed="all"`。

```html
<vk-page>
  <vk-img src="../assets/cover.png" alt="封面" bleed="all"></vk-img>
  <vk-stack gap="wide">…内容压在图上…</vk-stack>
</vk-page>
```

`bleed="x"` 只横向出血，`bleed="y"` 只纵向。出血只对自己生效，不影响兄弟。

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
| `line` | code / diff / asm | 源文件行号（1 起） |
| `cell` | cells | 下标（0 起） |
| `byte` | bytes | 字节偏移 |
| `bit` | bits | 位下标（0 起） |
| `addr` | asm | 指令地址 |
| `event` / `lane` | timeline | 事件下标 / 泳道名 |
| `node` | tree | 节点路径 |
| `point` / `side` / `region` | 任意 | `x%,y%` / `top` / `x%,y%,w%,h%` |

圈选按**字的墨迹**取框：`#c@line:5` 圈的是那一行的字，不是 1680 宽的行盒。

## 10 工作流

```bash
vk render pages/01.html          # 需要时自动重建库 → 构建 → 自检 → 出图 → 打印度量
vk render pages/ --phone         # 780 宽，按手机尺度看
vk check  pages/01.html          # 只自检，不出图
vk doc vk-code                   # 一件的属性表
vk brief --json                  # 全部件的契约（给机器读）
vk icons arrow                   # 搜图标名
```

一集 = 一个 `episodes/*.html` 文件，里面按顺序写 `<vk-page id="1-xxx">`；产物在 `out/<同路径>`；一帧一张 PNG，多帧文件按 `<文件名>-<id>.png`。

## 11 自检判什么

只判「无论你画什么，它都错」的事：

1. 出画布 / 出安全区
2. 内容被裁掉、被省略号截断
3. 非覆盖层互相压住
4. 字号低于 36px（手机 14.6px）
5. 对比度不足（正文 4.5:1，大字 3:1）
6. 锚点指不到东西
7. 渲染失败 / 数据过期 / 图片加载失败
8. 空帧

**不判**：焦点几个、留白多少、标题多长、色相几种。好看不靠门禁，靠默认值和组件的自动适配
（代码窗放不下会自己缩字号；步骤条窄了会自己竖排；注释自动避开内容；表格数字自动右对齐）。

## 12 常见错

- `span` 写到 `vk-stack` 的子项上（只有 grid 子项认）。
- 一帧塞两组 `current` 以上：观众不知道看哪。一处就够。
- 代码行数按窗口算，不是按源文件：`@line:5` 是源文件第 5 行。
- 把长句塞进 `headline`：标题 ≤ 14 字，超了换 `subhead`。
- 用 `tone` 给正文上色：语义色只在线和底上，正文用 `ink`。
- 一帧超过 888 高：删内容或拆帧。`vk render` 会告诉你超了多少。
- `mark` 是**一段原文**（窗口里所有出现处都会被标），不是正则，也不用转义。

