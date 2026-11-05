# 变更记录

## 15.2 · 属性收敛第二步：列开关 / 间距 / 箭头 / 一次性属性

标签数不变（32），**默认画面不变**；旧属性名继续由运行期折成新名，并在构建期给一条提示。

- **列开关 6 → 1**：`numbers / ascii / address / offsets / ruler / summary` 并成
  `columns="numbers,summary"`（`all` / `none` / `-name`；asm 的 `labels` 并成 `titles:` 段）。
- **间距 6 → 2**：`gap-px / gap-x / gap-y` → `gap`，`pad-px / pad-x / pad-y` → `pad`；
  一个值两轴同值，两个值先左右后上下（`gap="sm lg"`）。
- **箭头 6 → 1**：`arrow-style / arrow-size / cap / arrow-scale / arrow-label / head` 并成
  `arrow="end:open,size:40,scale:0.12,label:gcc,cap:start"`。
- **一次性属性**：`fence-after` + `fence-label` → `fence="after:4,label:…"`；
  compare 的 `a` / `b` → `labels="a,b|左|右"`；`index` + `total` → `counter="3/5"`。
- 结果：属性名 160 → 140。

## 15.0 · 属性收敛与手机横屏基准

### 一、属性层收敛

31 个标签曾暴露 172 个属性名：同一个概念长出多套声明。这一版只收四个概念，
词表收进 `src/shared/vocab.mjs` 一份；标签数不变，**默认画面不变**。

- **tone 六值一套**：`neutral | info | focus | ok | warn | err`，所有组件共用同一份枚举与校验；
  大小写不敏感；`vk-pair` 的 `tone-a` / `tone-b` 并成 `tone="左,右"`。
- **fill 三值一套**：`none | cover | contain`，只声明在能填充的组件上；
  布尔 `fill` 的正名是 `stretch`（`align-self: stretch`）；`fit` 只保留 `width`。
- **current 一个语义**：`current="N"` = 当前项，序号 1 起，`-1` = 没有当前。
- **size 只表字号**：密度一律 `mass`；不再把 `size` 改写成语义档。
- 结果：属性名 172 → 154。

### 二、观看条件与判断边界

观看条件改为「1920 的帧在手机上渲染到约 780×439（0.406×）」：

- 四档 `display 200 / headline 112 / body 56 / caption 48`；
  补充档 `hero 280` / `mega 400`。
- 窗头：三点直径 `compact 12 / normal 16 / hero 20`，窗头高 `56 / 72 / 88`，
  文件名 chip 高度 `48 / 64 / 76`、字号 `36 / 48 / 56`。
- 库只判客观错误：溢出、裁切、覆盖层压住正文、非法枚举、锚点失败、组件渲染失败、
  空组件、素材过期。强调色数量、深色块数量、页眉措辞、120 边距这类版面主张
  收进 `src/runtime/style-preset.mjs`，默认不跑，`vk check --style` 才启用。
- 图标白名单在构建期只提醒，不拦构建。
</content>
