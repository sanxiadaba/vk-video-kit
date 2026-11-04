# 15.2 · 属性收敛第二步：列开关 / 间距 / 箭头 / 一次性属性

> 接 [`convergence-15.md`](convergence-15.md) §5 的候选清单。这一步只做「同一概念的第二层重复」：
> **标签数不变（31）**、**默认画面不变（31 张标本页逐像素相同）**、旧写法全部继续可用。
> 运行期折叠与构建期提示走同一张别名表：`src/shared/vocab.mjs` 的 `ATTR_ALIAS`。

## 0 · 一句话

**四个族、23 个旧名 → 3 个新名（`columns` / `fence` / `counter`），间距与箭头并进既有的 `gap`（`pad`）/ `arrow`。**
旧名不进 `TAGS[].attrs`：不进类型、不进参考、不进属性名计数；但**旧页照旧能跑**——
元素连上 DOM 的第一刻折成新名，构建期给一条迁移提示，不拦构建。

## 1 · 列开关：7 → 1（`columns`）

| 旧写法 | 新写法 | 适用 |
|---|---|---|
| `numbers="all\|none"` | `columns="numbers"` / `columns="none"` | vk-code, vk-diff |
| `summary="all\|none"` | `columns="summary"` / 去掉 summary | vk-diff, vk-tree |
| `ascii="all\|none"` | `columns="address"`（关 ASCII） | vk-bytes |
| `address="all\|none"` | `columns="none"`（关地址列） | vk-bytes, vk-asm |
| `offsets`（布尔） | `columns="offsets"` | vk-cells |
| `ruler`（布尔） | `columns="ruler"` | vk-cells |
| `labels="地址\|机器码\|指令\|操作数"` | `columns="…,titles:地址\|机器码\|指令\|操作数"` | vk-asm |

语法：

```html
<vk-diff columns="numbers,summary">      <!-- 打开列 -->
<vk-diff columns="numbers">              <!-- 只开行号（关摘要） -->
<vk-bytes columns="address">             <!-- 不要 ASCII 列 -->
<vk-cells columns="offsets,ruler">       <!-- 字节尺 + 对齐括号 -->
<vk-asm columns="address,titles:ADDR|BYTES|OP|ARGS">
<vk-asm columns="none">                  <!-- 关掉可选列；标题行仍在 -->
<vk-asm columns="none,titles:none">      <!-- 连标题行也关掉 -->
```

- `all` = 该组件的全部可选列；`none` = 一列都不开；`-name` 从当前集合里关掉一列。
- 每个组件有**自己的默认列**（`vocab.COLUMNS[tag].on`）：不写 `columns` 时就是旧版默认。
- asm 的 `labels` 并进 `titles:` 段；`labels` 这个名字仍属于 vk-compare 的角标（另一个概念）。
- 旧名 `numbers / ascii / address / offsets / ruler / summary / labels` 都是别名。

## 2 · 间距：6 → 2（`gap` / `pad`）

| 旧写法 | 新写法 |
|---|---|
| `gap-px="24"`（edge / note / annotate / label / pin） | `gap="24"` |
| `pad-px="48"`（canvas / ring） | `pad="48"` |
| `gap-x="sm" gap-y="lg"`（grid） | `gap="sm lg"` |
| `pad-x="md" pad-y="xs"`（box） | `pad="md xs"` |

- `gap` / `pad` 一个值 = 两轴同值；两个值 = **先左右（x）后上下（y）**。
- 档位（`2xs…3xl`，grid 另有 `group/section/plate`）与像素数都认；`0` 表示无边距。
- 组件内的落点：box / grid 由运行期把档位写成 inline 的 `padding-*` / `column-gap`·`row-gap`
  （值仍是 `var(--vk-sN)` 令牌）；其余组件按像素数读。这样两个轴的 8×8 组合不需要 64 条 CSS 规则。
- 旧名 `gap-px / gap-x / gap-y / pad-px / pad-x / pad-y` 都是别名。

## 3 · 箭头：6 → 1（`arrow`）

选的是**一个 `arrow` 词 + 逗号分段**（不是 `arrow-*` 前缀组）：

```html
<vk-edge arrow="end">                              <!-- 终点实心箭头（默认） -->
<vk-edge arrow="both:open">                        <!-- 两端开口箭头 -->
<vk-edge arrow="end:thin,size:40,cap:start">       <!-- 细头 + 40px + 起点圆点 -->
<vk-flow arrow="true,scale:0.2,label:gcc">         <!-- 画箭头；按容器高缩放；中轴词 -->
<vk-annotate arrow="end,scale:0.12,label:gcc">     <!-- 端点 / 缩放 / 中轴词 -->
<vk-annotate arrow="none,cap:end">                 <!-- 只留终点圆点 -->
```

| 旧写法 | 新写法 |
|---|---|
| `arrow-style="solid\|open\|thin"` | `arrow="end:triangle\|open\|thin"` |
| `arrow-size="40"` | `arrow="end,size:40"` |
| `cap="dot"` | `arrow="end,cap:start"` |
| `arrow-scale="0.12"`（flow / annotate） | `arrow="end,scale:0.12"` |
| `arrow-label="gcc"`（flow / annotate） | `arrow="end,label:gcc"` |
| `head="arrow\|dot\|none"`（annotate） | `arrow="end"` / `arrow="none,cap:end"` / `arrow="none"` |

- `end / start / both / none` 后可以接 `:triangle / :open / :thin`（样式）；
  `size:`（像素，8–64）、`scale:`（容器高比例，0.02–0.6）、`label:`（中轴词）、`cap:`（端点圆点）。
- vk-flow 的 `arrow` 仍是「画不画」：`true` / `false`，后面接 `scale:` / `label:`。
- 旧名 `arrow-style / arrow-size / arrow-scale / arrow-label / head / cap` 都是别名。

## 4 · 一次性属性：3 对

| 旧写法 | 新写法 |
|---|---|
| `fence-after="4" fence-label="编译器屏障"` | `fence="after:4,label:编译器屏障"` |
| `<vk-compare a="…" b="…">` + `labels="左\|右"` | `labels="a,b"` / `labels="a,b\|左\|右"` |
| `index="3" total="5"`（vk-label） | `counter="3/5"` |

- `fence="after:4"` 的 label 省略 = `内存屏障`；`fence="none"` 关掉。
- compare 的 `labels` 用竖线分段：**第一段带逗号 = 两张图的地址**，后面两段是角标；
  只有角标的旧写法（`labels="左|右"`）原样有效。
- `counter="3/5"` 渲染成「工序 3/5」；只写 `counter="3"` 也合法。
- 旧名 `fence-after / fence-label / a / b / index / total` 都是别名（`index` 在 vk-bits 上仍是位序号）。

## 5 · 度量（同一支脚本、同一口径）

脚本：`node .tmp/converge/metrics.mjs <输出.json>`，遍历 `TAG_NAMES` 的 `TAGS[t].attrs`。

| 指标 | 这一步之前（实测） | 之后 |
|---|---:|---:|
| 公开标签 | 31 | 31 |
| 属性声明总数 | 696 | 677 |
| 其中协议声明 | 401 | 401 |
| 非协议声明 | 295 | 276 |
| **不同属性名** | **160** | **140** |

> `docs/convergence-15.md` 记的 154 是 15.0 收尾时的口径；之后视频维度新增了
> `cue / cues / states / transition / focus-duration / focus-transition` 六个名字，
> 所以这一步的起点实测是 160。按同一口径看：**154 → 134**；按当前仓库实测：**160 → 140**。

**删掉 23 个名字**：`numbers` · `ascii` · `address` · `offsets` · `ruler` · `summary` ·
`gap-px` · `gap-x` · `gap-y` · `pad-px` · `pad-x` · `pad-y` ·
`arrow-style` · `arrow-size` · `arrow-scale` · `arrow-label` · `head` · `cap` ·
`fence-after` · `fence-label` · `a` · `b` · `total`。
**新增 3 个**：`columns` · `fence` · `counter`。
（`labels` 与 `index` 保留：前者仍是 compare 的角标名，后者仍是 vk-bits 的位序号。）

## 6 · 验证

- `tests/convergence-step2.test.mjs`：每个族都在真实标本页上做「旧写法 → 折叠后的规范值」断言，
  再把旧写法与新写法各渲染一次，**逐像素比较**（16 个组件 + ring/pin 一张最小页）。
- 31 张标本页（`vk-*`）与改动前逐像素比较：`64,281,600` 像素，0 差异。
- `build --force` / `gen` / `ai-doc` / `assemble` / `capabilities --check` / `npm test` 全绿。
