# 定制：图标、颜色、形状

这个库的定制分三层，越往下越自由，但都不要越过「一帧 1920×1080、手机横屏」这条线。

## 1. 颜色与线宽：写在 vk-page 上

```html
<vk-page style="--vk-focus: #c2410c; --vk-syn-keyword: #0e7490">
```

深色页写一对：`light-dark(浅, 深)`。常改的变量见 `RULES.md` 的「改颜色 / 改线宽」。组件级还有 `tone`、`border`、`surface` 三个粗调。

## 2. 图标：一个名字，到处能用

任何 Lucide 图标（kebab 名，如 `cpu`、`folder`、`lightbulb`）都可以：

```html
<vk-icon name="eye" size="body" tone="focus"></vk-icon>
<vk-text icon="lightbulb">一句话</vk-text>
<vk-label icon="terminal" counter="03">终端</vk-label>
```

- `size` 用字号档（caption/body/subhead/headline/display/hero）
- `tone` 用语义色（focus/ok/warn/err/info），不写就跟正文同色
- 图标是 1em 的字形，跟着字号和行高走，不会自己撑高一行

### 文件树

默认：目录 = `folder`，文件 = `file`，颜色按类型分（代码=结构词色、二进制=数字色）。
**花括号只是可选项**，不是默认：

```html
<vk-tree src="code" icon-code="braces"></vk-tree>   <!-- 代码文件用花括号 -->
<vk-tree src="code" icons="none"></vk-tree>         <!-- 整棵树不要图标 -->
<vk-tree src="code" icon-dir="folder-open" icon-binary="binary"></vk-tree>
<vk-tree src="code" chrome="none"></vk-tree>        <!-- 去掉窗口，只要树 -->
```

## 3. 每个件能改什么

| 件 | 可改 | 默认 | 备注 |
|---|---|---|---|
| `vk-page` | `align` band/center/top/bottom、`surface`、`style` 变量 | band | band = 标题锚 96、内容在剩余带居中 |
| `vk-box` | `surface` paper/soft/dark、`border`、`pad`、`radius`、`title`、`tone` | paper | 标题可去掉 |
| `vk-label` | `variant`、`tone`、`icon`、`counter` | text | |
| `vk-text` | `size`、`ink`、`tone`、`icon`、`measure` | body | |
| `vk-code` | `size`、`chrome`、`long`、`file`、`lines`、`current`、`focus`、`fold`、`mark` | body | 窗宽跟内容 |
| `vk-term` | `size`、`chrome`、`surface`、`title`、`current`、`prompt` | body | |
| `vk-diff` | `size`、`file`、`chrome` | body | hunk 标签按实际行列算 |
| `vk-asm` | `size`、`file`、`lines`、`current`、`bytes` | body | 助记符/寄存器/立即数分色 |
| `vk-tree` | `size`、`depth`、`max`、`current`、`icons`、`icon-*`、`chrome` | body | |
| `vk-table` | `size`、`caption`、`variant` | body | 三分之二宽（1120） |
| `vk-cells` | `cols`、`stride`、`addr`、`size`、`current`、`markers` | body | |
| `vk-bytes` | `size`、`cols`、`offset`、`length`、`current` | body | |
| `vk-bits` | `value`、`size`、`index`、`group`、`sign`、`label` | body | `value` 用 `|` 分段（符号|阶码|尾数），`field-labels="符号,阶码,尾数"` 给每段起名，段间自动留 64px |
| `vk-steps` | `size`、`direction`、`connector`、`current`、`done` | body | 连接件跟 callout 同一把尺子 |
| `vk-bars` | `size`、`max`、`unit`、`current` | body | 标签列按内容宽 |
| `vk-timeline` | `size`、`start`、`end`、`current`；条目 `at` | body | 每个 `<li>` 写 `at="1991"` 就按年份比例摆，否则等距 |
| `vk-compare` | `labels`、`size`、`direction`、`mark` | body | `mark="a:x1,y1,x2,y2"` 只标改前那格（百分比相对图） |
| `vk-img` | `ratio`、`surface`、`border` | paper | |
| `vk-canvas` | `w`、`h`、`surface` | 1680×888 | 子件用 `x/y` 或 `at` |
| `vk-callout` | `mode` arrow/ring/note/badge、`tone`、`shape`、`from/to/for`、`gap` | arrow | 线走墨色，语义色只给气泡 |
| `vk-pair` | `symbol`、`gap`、`split`、`direction` | vs | 有字不画轴 |

## 4. 当前（current）的画法

有左边缘的件（代码行、终端行、diff 行、内存格）统一是 **8px 焦点条 + 淡底**；只能填色的形状（步骤章、时间线点）用焦点填色。不要用边框、下划线、胶囊再各发明一种“当前”。

## 5. 不能改的（故意的）

字号、行高、字体、直接写 `color` 会被构建拦下；文本宽度用 `measure`，不要用 CSS 改。这不是限制，是保证 23 帧在同一套刻度上——一旦允许每帧自己写 47px，整集就会散。

## 5. 组合

排布件（`vk-stack` / `vk-grid` / `vk-layer` / `vk-canvas` / `vk-pair`）不画东西，只给位置；内容件自带窗口/表/树，可以用 `chrome="none"` 去掉窗口，放进任何盒子。图标、行内公式、行内代码都是行内件，可以进任何一句话。
