# 15.0 · 概念收敛：tone / fill / current / size

> 本文记录 15.0 的「属性层减法」。审计见 [`audit-architecture.md`](audit-architecture.md)：
> 31 个公开标签曾暴露 172 个属性名 / 677 条声明，其中同一概念长出多套声明。
> 这一次只收敛四个概念，**标签数不变（31）**、**默认画面不变**（31 张标本页逐像素相同）。

## 0 · 一句话

**词表只有一份：`src/shared/vocab.mjs`。** 注册表用它生成枚举与文档，运行期用它把旧页折成新值，
构建期用它给迁移提示。旧名不写进 `TAGS[].attrs` —— 所以它们不进类型、不进参考、不进属性名计数，
但**旧页照旧能跑**（运行期第一刻折叠 + 一条提示，不拦构建）。

## 1 · tone：六值一套

```js
TONES = ['neutral', 'info', 'focus', 'ok', 'warn', 'err']
```

所有组件的 `tone` 声明都来自同一份；大小写不敏感（`tone="OK"` 合法，运行期落成 `ok`）。

| 收敛前（各写各的） | 标签 | 收敛后 |
|---|---|---|
| `ok warn err` | vk-box | 六值 |
| `neutral info focus ok err warn` | vk-panel / vk-layer / vk-annotate | 六值 |
| `info focus ok err warn` | vk-text / vk-label / vk-note / vk-pin / vk-icon / vk-rule | 六值 |
| `neutral info focus` | vk-edge | 六值 |
| `neutral info` | vk-bits / vk-bars | 六值 |

- **旧值**：上面五个子集里的每个值合并后仍然合法（恒等映射），历史页面不需要改。
  唯一真正删过的旧值是 14.0 的 `accent`（当时的第五色）——它映射到 `focus`，并给迁移提示。
  其余拼写（`danger` / `success` / `warning` …）从没进过词表，仍然构建期报错。
- **补齐**：`neutral` 的定义是「不上色 / 用默认墨」。box / bits / bars / edge 以前不认的
  `neutral`、`info`、`focus`、`ok`、`warn`、`err` 现在都有样式（见 `elements.css` / `components.css` / `layout.css`）。
- **非法值**：构建期报错，文案固定列出六值：
  `tone 只有六值：neutral / info / focus / ok / warn / err`。
- `vk-pair` 的两侧分色从 `tone-a` / `tone-b` 两个名字并成 `tone="左,右"`：

| 旧写法 | 新写法 |
|---|---|
| `tone-a="info" tone-b="ok"` | `tone="info,ok"` |
| 只给一侧 | `tone="info"`（右 = none）/ `tone="none,ok"` |

## 2 · fill：`none | cover | contain`

| 旧写法 | 新写法 | 说明 |
|---|---|---|
| `<vk-stack fill>` | `<vk-stack stretch>` | 布尔铺满 = `align-self: stretch`；改名后逐像素不变 |
| `<vk-img fill>` / `fill="true"` | `fill="cover"` | 填充组件上的布尔写法 |
| `<vk-img fit="cover|contain">` | `fill="cover|contain"` | `fit` 只保留 `width`（内容字号铺满） |
| `<vk-panel fill="cover|contain|''">` | `fill="none|cover|contain"` | 空串退场 |
| `<vk-compare fit=…>` | `fill=…` | |

- **只在能填充的组件上声明**：`vk-img` / `vk-panel` / `vk-layer`（`vk-compare` 是两张 img 并起来，
  同一套取景，所以它也在名单里）。
- 其它组件上的旧布尔 `fill` 在运行期折成 `stretch`，并提示一句；构建期不拦。

## 3 · current：一个语义，一个基准

```html
<vk-steps current="3">        <!-- 第 3 步 -->
<vk-code current="4-6">       <!-- 第 4–6 行（源文件行号） -->
<vk-bytes current="1-6">      <!-- 第 1–6 个字节 -->
<vk-cells current="3">        <!-- 第 3 格 -->
<vk-timeline current="2">     <!-- 第 2 个事件 -->
<vk-steps current="-1">       <!-- 没有当前（纯地图） -->
```

- **基准统一为 1 起**（`docs/reference.md` 与 registry 的属性说明里都写死了这条）。
  理由：行号本来就是 1 起；步 / 格 / 事件以前是 0 起，15.0 统一 +1。
- `-1` 统一表示「没有当前」。`vk-steps` 的 `-1` 行为与以前完全一致。
- **别名**：`line`（code / term / asm）与 `active`（tree）保留为 deprecated 别名，
  运行期折成 `current` 并提示；registry 不再声明它们。
- `vk-tree` 的「项」是节点：`current` 接受 **1 起的序号** 或 **节点路径**（路径写法继续可用）。
- `vk-cells` / `vk-timeline` 新增容器级 `current`，与 `li` 上的 `act="focus"` / `state="current"`
  走同一条渲染路径（同一格只标一次，容器级优先）。

迁移提示（只警告、不拦构建）：0 起的旧值不会被自动 +1（那会让 `current="1"` 既可能指第一步
也可能指第二步），构建期会提醒「current 从 1 起」。

## 4 · size：只表字号

| 旧写法 | 新写法 | 说明 |
|---|---|---|
| `value-size="subhead"`（timeline） | `size="subhead"` | 主值字号也是字号 |
| `label-size="label|meta"`（edge） | `size="body|label"` | `meta` → `label` |
| `symbol-size="96"`（pair） | `size="96"` | 中轴符号字号 |
| `size="compact|normal|hero"`（体量） | `mass="compact|normal|hero"` | **运行期不再偷偷改写** |

- `size` 的取值是同一套十个语义档（`mega hero display headline title subhead body data label caption`）
  或像素数（内容组件）。以前只有三档的组件（math / annotate / note）也补齐到十档。
- 体量（密度）只认 `mass`；`density` 仍按 13.0 的别名折成 `mass`。
  旧页把体量写在 `size` 上的，15.0 **不再改写**：构建期提示、运行期忽略这个字号值，
  画面会变——受影响的页面在 demo 里已经同步改（`src/scenes/` 与示例）。
- 图标字号仍是 `vk-icon` 的私有词表（别名标签，不属公开 API）。

## 5 · 度量（同一支脚本、同一口径）

脚本：`node .tmp/converge/metrics.mjs <输出.json>`，遍历 `TAG_NAMES` 的 `TAGS[t].attrs`。

| 指标 | 收敛前 | 收敛后 |
|---|---:|---:|
| 公开标签 | 31 | 31 |
| 属性声明总数 | 677 | 668 |
| 其中协议声明 | 376 | 378 |
| 非协议声明 | 301 | 290 |
| **不同属性名** | **172** | **154** |

**删掉 20 个名字**：`line` · `numbering` · `value-size` · `label-size` · `symbol-size` · `tone-a` · `tone-b` ·
`kind` · `emphasis` · `label-a` · `label-b` · `address-label` · `bytes-label` · `mnemonic-label` ·
`operands-label` · `label-dx` · `label-dy` · `anchor` · `place` · `orientation`（pair / steps）。
**新增 2 个**：`stretch`（旧布尔 `fill` 的正名）、`label-offset`（`label-dx`/`label-dy` 的合并）。
`mode` 没有消失 —— 它只剩 vk-annotate 一个主人（compare 的那个并进了 `variant`）。
`mark-label` 保留：它标的是差异框，不是「当前项」。

**没有达到「129 以下」。** 剩下的重复不在四个概念里，而在另外几族（下一步的候选，按收益排序）：

| 族 | 现在 | 合并成 | 能减 | 耦合成本 |
|---|---|---|---:|---|
| 列开关：`numbers` / `ascii` / `address` / `offsets` / `ruler` / `summary` / `labels`(asm) | 7 个名字 | `columns="addr ascii"` | −6 | 6 个组件 + 测试 |
| 间距单位：`gap-px` / `gap-x` / `gap-y` / `pad-px` / `pad-x` / `pad-y` | 6 | `gap="x y"` / `pad="x y"`（档位或像素） | −6 | CSS 选择器体系 |
| 箭头词表：`cap` / `arrow-style` / `arrow-size` | 3 | `head` / `arrow-scale` | −3 | 连线几何 |
| 其它一次性：`fence-after`+`fence-label`、`a`+`b`(compare)、`index`+`total`(label) | 6 | 3 个名字 | −3 | 各 1 个组件 |

这些是**同一类的第二层重复**，但每一条都要动 CSS 选择器或组件几何，不适合和概念收敛放在同一批。
