# vk · 单帧画面库

**这个库只回答一件事：把一个内容单元画成 1920×1080 画布上正确、清晰、可测量的那个东西，并把若干单元按份摆进画布。**

它不回答：这一页讲什么、分几块、先说哪句、什么时候出现、怎么动。
没有模板、没有讲解骨架、没有时间轴、没有播放器。

---

## 1. 画布

- 固定 **1920×1080**，不缩放；出片尺寸就是设计尺寸。
- 版心 **1680×888**：左右 120，上下 96。内容落在版心里。
- 正文基准 **56px**。手机横屏把 1920 收到约 780 宽（0.406×），56 → 22.7 设备像素。
- 一张 `<vk-page>` 就是一帧。`align="top|center|bottom"` 决定内容在版心里的纵向位置。

```html
<link rel="stylesheet" href="vk/fonts.css">
<link rel="stylesheet" href="vk/vk.css">
<script src="dist/vk.js"></script>

<vk-page align="center">
  <vk-stack gap="md">
    <vk-text size="headline">字符串不是值，是<em>一块内存</em></vk-text>
    <vk-code lang="c" file="hello.c" src="../code/hello.c" lines="4-6" current="5"></vk-code>
  </vk-stack>
</vk-page>
```

## 2. 字号

只有六档，名字就是语义：

| 档 | px | 手机 | 用在哪 |
|---|---|---|---|
| `caption` | 48 | 19.5 | 标签、单位、脚注；只给不读第二遍的字 |
| `body` | 56 | 22.7 | 正文与等宽数据 |
| `headline` | 112 | 45 | 标题 |
| `display` | 200 | 81 | 一页最多一次，给「本页唯一的答案」 |
| `hero` | 280 | 114 | 一个数字 / 一个词当家 |
| `mega` | 400 | 162 | 同上，极端场合 |

- `size` 只表字号；密度写 `mass="compact|normal|hero"`。
- 平台地板：任何可读文字 ≥ 48px。`vk check` 会拦。
- `vk-text` 默认按字号取行宽（body 25 字）；要铺满写 `measure="none"`。

## 3. 颜色

一份调色板，三层变量：`--vk-theme-*`（唯一出现 hex 的地方）→ `--vk-*` 语义名 → 组件。

- **材质只有一种：白纸。** 层次靠纸的明度：`surface="none|paper|soft|sf-1..4|wash|tint|dark|accent"`。
- **`tone` 六值**：`neutral / info / focus / ok / warn / err`。语义色只出现在底、条、图标上，不写正文。
- **`ink` 三档**：`primary / secondary / muted`。正文用 primary。
- 强调色只有一个含义：**正在讲这里**。作者加的标注用 `em`（一条细下划线）。

## 4. 排布

只有一种写法：**分份**。容器给份，子项占份。

```html
<vk-stack gap="lg">…</vk-stack>                 <!-- 竖排 / direction="row" 横排 -->
<vk-grid cols="3" gap="md">                     <!-- 12 栏；cols 1–12 -->
  <vk-code span="2" …></vk-code>
  <vk-stack span="1">…</vk-stack>
</vk-grid>
<vk-pair split="50" symbol="vs">…两块…</vk-pair> <!-- 并置对照 -->
<vk-flow arrow="true,label:gcc">…<li>…</li>…</vk-flow>
<vk-canvas w="1400" h="600">…x/y 绝对摆放…</vk-canvas>
<vk-layer>…叠放；第一个铺底…</vk-layer>
```

- 布局协议（所有块级）：`span` / `row-span`（grid 子项）、`grow` / `stretch` / `bleed` / `overflow`。
- `x / y / w / h / z` **只在 `vk-canvas` 的子项里合法**。
- `style` 不被接受：布局要能算、能验，不能手摆。

## 5. 内容入口

**真实文件是唯一真相。** 代码、终端、diff、树、字节、汇编、公式都写 `src=`；也可以内联：

```html
<vk-code lang="c" file="hello.c">
  <script type="text/plain" data-vk-source>
#include <stdio.h>
int main(void) { return 0; }
  </script>
</vk-code>
```

`src` 与内联块只能二选一。构建期把高亮 / hexdump / 树 / 公式 / 图标内联进 `out/`，运行期零依赖。

| 标签 | 它画什么 | 关键属性 |
|---|---|---|
| `vk-text` | 一段文字 | `size` `weight` `mono` `ink` `tone` `icon` |
| `vk-label` | 一行小字 | `variant`（kicker/chip/badge/tag）`counter` `section` |
| `vk-inline` | 行内代码 / 公式 / 键位 | `variant`（code/math/sup/sub/link/keys） |
| `vk-box` | 一个面 | `surface` `tone` `pad` `radius` `border` `ring` |
| `vk-panel` | 有标题的分区 | `title` `variant` `chrome` `surface` `border` |
| `vk-img` | 一张图 | `src` `alt` `ratio` `fill` `position` |
| `vk-list` | 列表 | `variant`（bullet/check/define/ordered） |
| `vk-code` | 代码窗 | `src` `lines` `current` `focus` `fold` `long` `columns` `mass` |
| `vk-term` | 终端 transcript | `src` `prompt` `marks` `current` |
| `vk-diff` | 改动 | `src` `variant`（unified/split）`columns` |
| `vk-table` | 表格 | 原生 `<table>`；`variant` `mono` `stripe` |
| `vk-math` | 公式 | `src`（.tex）`display` |
| `vk-compare` | 两张图对照 | `labels` `split` `mark` `zoom` |
| `vk-tree` | 文件树 | `src` 目录 / 内联；`depth` `columns` `current` |
| `vk-cells` | 内存格 | `<li value label>`；`cols` `addr` `stride` |
| `vk-bytes` | 字节窗 | `src` 二进制；`addr` `offset` `length` `cols` |
| `vk-bits` | 一行位串 | `value` 或 `<li from to label>` |
| `vk-bars` | 横向条 | `<li value label>`；`max` `scale` `unit` |
| `vk-asm` | 汇编清单 | `src` objdump 文本；`lines` `current` `fence` `order` |
| `vk-timeline` | 时间线 | `<li date label>`；`start` `end` `lanes` |
| `vk-steps` | 步骤进度 | `<li>`；`current`（1 起，-1 = 不标） |
| `vk-flow` | 序列 | `<li label>`；`arrow` |
| `vk-pair` | 两块并置 | `split` `axis` `symbol` `tone="左,右"` |
| `vk-canvas` | 坐标画布 | `w` `h` `pad` `grid` |
| `vk-layer` | 叠放 | `surface` `fill` `readable` |
| `vk-annotate` | 箭头 / 圈选 / 批注 / 编号 | `mode` `for` / `from`+`to` |
| `vk-note` | 边注 / 气泡 / 编号图例 | `variant` `for` |
| `vk-page` | 画布 | `align` |

属性的取值、默认值用 `vk doc <tag>` 查，不要猜。

## 6. 状态：只有一个词

- `state="current|mark|ok|warn|err"` 写在元素上；`current` 属性写在数据组件上（第几行 / 第几项，**1 起，-1 = 没有当前**）。
- 一帧只有一处焦点。`vk check` 会把两处 `current` 判成 error。
- 没讲到的东西不存在：本层没有 `at` / `cue` / `enter` / `duration`。要“第 3 秒的样子”，就把那一帧写成一张页。

## 7. 锚点

`for` / `from` / `to` 接受 CSS 选择器，也接受 `#id@part:arg`。多个目标用 `;` 分隔。

| part | 用在 | arg |
|---|---|---|
| `point` | 任意 | `x%,y%` |
| `side` | 任意 | `top / right / bottom / left` |
| `region` | 任意 | `x%,y%,w%,h%` |
| `line` / `char` | code / diff / asm | 源文件行号；列从 0 起 |
| `cell` | cells / table | 下标或 `行,列` |
| `byte` | cells / bytes | 偏移 |
| `bit` / `field` | bits | 位 / 字段下标 |
| `addr` | asm | 指令地址 |
| `row` / `node` / `item` | table / tree / list | 见组件 |
| `step` | steps | 从 0 起 |
| `event` / `lane` | timeline | 事件下标 / 泳道 |

写错会在构建期报错。

## 8. 工作流

```
pages/*.html  --vk build-->  out/*.html  --vk shot-->  out/*.png
```

```bash
node bin/vk.mjs build              # 递归 pages/ → out/
node bin/vk.mjs check pages/       # 结构自检；有 error 退出码 1
node bin/vk.mjs shot pages/a.html  # 出图 + 同一份自检
node bin/vk.mjs shot pages/a.html --phone   # 780 宽，按手机尺度看
node bin/vk.mjs shot pages/a.html --width 640 --out out/a.png
node bin/vk.mjs doc vk-code        # 属性 / 取值 / 默认值
node bin/vk.mjs brief              # 30 个标签的属性清单
```

**构建只写 `out/`，不改源文件。** 源里永远只有你写的内容。

## 9. 自检判什么

`vk check` 只判「无论你画什么，它都错」的事：

- 字号低于 48；正文落在 48（低于 body 档）；
- 对比度不足（正文 7:1，标注 4.5:1）；
- 超出画布 / 超出安全区；
- 横向或纵向被裁、内容被盒子裁掉；
- 非覆盖层元素互相压住；
- 一处以上焦点；
- 锚点解析失败、组件渲染失败、素材过期、空锚点；
- 一张什么都没画出来的空帧。

审美不判。但上面每一条都是“画错了”，不是“不好看”。

## 10. 已经踩过的坑

- **`span` 只属于 `vk-grid` 的子项**；`w/h` 只属于 `vk-canvas` 的子项。
- **`current` 是 1 起**；写 0 或超出范围，构建期报。
- **`vk-bytes` 的地址是算出来的**：屏幕上 = `addr + offset + i`。
- **`vk-compare` 的 `mark` 是百分比**，相对取景框。
- **边注需要目标一侧有空间**：整行宽的组件不要把自身当边注目标。
- **带 `src` 的组件必须先 `vk build`**；没预编译会 stale，自检直接红。
- **一帧装不下就拆帧**：1080 高、正文 56、行高 1.5，版心里大约 11 行正文。超了不是“挤一挤”，是这一帧讲多了。
