# vk-video-kit 架构与 API 深度审计

> 审计对象：`D:\test\test52`（vk-video-kit 14.0.0，定位「组件库」）
> 审计日期：2026-11-04
> 方式：**只审不改**——本文件是唯一产物；没有改任何 `src/` / `tests/` / `tools/` 代码，没有提交 git。
> 与既有文档的分工：[`specimen-audit.md`](specimen-audit.md) 审的是 31 页的**观感与可读性**（截图评分），
> [`prune-audit.md`](prune-audit.md) 审的是 36→20 的**数量与去留**；本文审的是**标签职责、属性契约、默认值、别名、能力覆盖、组合表达力、文档与实现的一致性**。

---

## 0 · 口径与基线数字

所有数字都从源码算出来，不是估计：

| 指标 | 数值 | 来源 |
|---|---:|---|
| 注册的 `vk-*` 标签 | **37** | `node -e "import('./src/registry.mjs')"` → `ALL_TAG_NAMES.length` |
| 公开标签（`TAG_NAMES`，不含别名） | **31** | `src/registry.mjs:1348` |
| 别名（`aliasOf`） | **6** | `src/registry.mjs:1351-1356`；`ALIASES` 键 |
| 「实际按别名工作、但没登记为别名」 | **1**（`vk-edge`） | `src/registry.mjs:575-598` 无 `aliasOf`；`src/runtime/layout.mjs:83-84` 却是 `extends VkAnnotate` + `static legacy='arrow'` |
| 属性声明总数（31 个公开标签） | **676** | 遍历 `TAGS[t].attrs` |
| 不同属性名 | **171** | 同上（去重） |
| 非协议属性声明（去掉 16 个 LAYOUT_ATTRS） | **300** | `src/registry.mjs:1171-1194`、`:1196` |
| 能力矩阵条目 | **53** | `docs/capabilities.json` |
| 能力里登记为标本页的标签 | **18 / 31** | `capabilities[].specimen` 去重 |
| 能力里出现过的契约标签 | **20 / 31** | `capabilities[].contracts` |
| 出现在能力契约里的非协议属性 | **76 / 300（25%）** | 见 §5 |
| 有 `EFFECTS`/`PROBES` 断言的属性 | **230 / 300** | `src/effects.mjs` + `tools/lib/contract-probes.mjs` |
| **完全没有机器断言的属性** | **13** | 见 §5.3 |

一个必须先说清的事实：**`DEFAULTS` 只是文档，不会落地到 DOM**。
`src/registry.mjs:190-251` 的 `DEFAULTS` 只在 `:1501-1508` 被写进 `spec.default` 供 `types/`、`reference.md`、组件页读；
运行期没有任何地方把默认值写成属性——每个组件自己写 `getAttribute(x) || '默认'`。
所以「文档默认值」与「运行时默认值」是两份，**没有任何测试比对它们**（`tests/` 里搜不到对 `DEFAULTS` 的断言）。
本文 §3 的多条问题都源于这一点。

### 0.1 快照与并行改动（重要）

本审计读取工作区的时间是 **18:05–18:13**，全文 `文件:行` 都以**那一刻的工作区**为准。

审计收尾时（18:13–18:15）工作区出现了**另一个人/另一个进程的并行改动**，不是本审计做的：

```
 M src/components/components.css   M src/components/diagrams.css   M src/effects.mjs
 M src/elements/elements.css       M src/elements/window.css       M src/registry.mjs
 M src/runtime/compositions.mjs    M src/tokens/tokens.css         M tests/*.test.mjs
?? src/tokens/themes.css
```

内容是在给 `vk-page` 加 `theme="paper|graphite|blueprint"` 调色板（`registry.mjs` 的 `vk-page.attrs.theme`、`compositions.mjs` 的 `THEMES`、`effects.mjs` 的 `vk-page.theme`、新增 `src/tokens/themes.css`）。
它**没有**推翻本文任何结论，反而让 §7 例 3（文档写「没有深色主题」）更站不住。

若你要在**当前**工作区复现行号，偏移规则是：

| 文件 | 偏移 |
|---|---|
| `src/registry.mjs` | 第 57 行之后 **+1**；第 968 行之后 **+5** |
| `src/tokens/tokens.css` | 整体约 **+7 ~ +8**（区块被重排，不严格线性） |
| `src/elements/elements.css`、`src/components/components.css`、`src/elements/window.css`、`tests/*` | ±1 ~ ±8 |

因此本文每条证据除了行号，都同时给出了**属性名 / 函数名 / 选择器名**——行号漂移时按名字回查即可。

---

## 1 · 标签数与职责

### 1.1 31 个公开标签的职责与「自有属性面」

自有属性 = 去掉 16 个布局协议属性（`w h span row-span z grow fill bleed overflow at dur enter ease stagger act strength`，`src/registry.mjs:1171-1194`）。

| 标签 | 层 | 自有属性 | 一句话职责 | 能力矩阵里的标本页 | 以它为标本页的能力条数 |
|---|---|---:|---|---|---:|
| `vk-box` | L1 | 10 | 一个面 | 是 | 1 |
| `vk-panel` | L1 | 8 | 带标题的分区 | 是 | 11 |
| `vk-text` | L1 | 13 | 一段文字 | 是 | 8 |
| `vk-label` | L1 | 10 | 一行小字/工序 | 是 | 5 |
| `vk-inline` | L1 | **2** | 行内字 | 否 | **0** |
| `vk-img` | L1 | 7 | 一张图 | 是 | 1 |
| `vk-stack` | L2 | 7 | 竖排 | 否 | **0** |
| `vk-grid` | L2 | 8 | 分份 | 是 | 1 |
| `vk-layer` | L2 | **3** | 叠层 | 是 | 1 |
| `vk-pair` | L2 | 9 | 两块并置 + 中轴 | 是 | 2 |
| `vk-flow` | L2 | 4 | N 步 + 箭头 | 是 | 1 |
| `vk-canvas` | L2 | **2** | 坐标画布 | 否 | **0** |
| `vk-edge` | L4 | **20** | 连线 | 否 | **0** |
| `vk-list` | L3 | 5 | 列表 | 否 | **0** |
| `vk-code` | L3 | 20 | 代码窗 | 是 | 3 |
| `vk-term` | L3 | 15 | 终端 | 是 | 4 |
| `vk-diff` | L3 | 11 | 差异 | 否 | **0** |
| `vk-table` | L3 | 6 | 表格 | 否 | **0** |
| `vk-math` | L3 | 3 | 公式 | 否 | **0** |
| `vk-compare` | L3 | 14 | 前后对照 | 是 | 2 |
| `vk-tree` | L3 | 11 | 文件树 | 否 | **0** |
| `vk-cells` | L3 | 7 | 内存格 | 否 | **0** |
| `vk-bytes` | L3 | 13 | 字节窗 | 是 | 1 |
| `vk-steps` | L3 | 6 | 步骤条 | 是 | 1 |
| `vk-bits` | L3 | 9 | 一行位 | 否 | **0** |
| `vk-bars` | L3 | 7 | 横向条 | 否 | **0** |
| `vk-asm` | L3 | **25** | 汇编清单 | 是 | 1 |
| `vk-timeline` | L3 | 8 | 时间线 | 否 | **0** |
| `vk-page` | L5 | 3 | 画布根 | 是 | 2 |
| `vk-annotate` | L4 | 22 | 关系与图示 | 是 | 5 |
| `vk-note` | L4 | 12 | 排进版面的注解 | 是 | 3 |

两张清单先记住：**`vk-asm` 25 个自有属性只有 1 条能力**；**`vk-edge` 20 个自有属性、0 条能力、0 个标本页**。

> 表注：审计快照之后，并行改动给 `vk-page` 加了 `theme`（`paper/graphite/blueprint`，见 §0.1），
> 因此它的自有属性会从 3 变成 4 —— 这不影响其他行，但说明「页面层」也在继续长属性。

### 1.2 `box` / `panel` / `layer` 的边界是否清楚？

结论：**职责说得清（面 / 带标题的分区 / 叠放容器），但属性边界完全没说清——三块「面」各有一套自己的表面词汇。**

| 维度 | `vk-box` | `vk-panel` | `vk-layer` |
|---|---|---|---|
| 表面词表 | `surface`：`none paper soft sf-1…sf-4 wash tint dark accent`（11）<br>`src/registry.mjs:268`、`:1206-1218` | `variant`：`plain raised inset dark`（4）**且** `surface`：`paper wash tint dark accent`（5）<br>`src/registry.mjs:293`、`:1227` | `surface`：`paper wash tint dark accent`（5）<br>`src/registry.mjs:501` |
| 实现处 | `src/elements/elements.css:101-106`（旧）**＋** `:743-763`（新 surface） | `:201-238`（variant）**＋** `:697-739`（surface） | `src/layout/layout.css:632-666` |
| 色调词表 | `tone`：`ok warn err`（3）<br>`src/registry.mjs:269` | `tone`：`neutral info focus ok err warn`（6）<br>`:291` | `tone`：`neutral info focus ok err warn`（6）<br>`:502` |
| 内距 | `pad / pad-x / pad-y`（枚举 8 档） | `pad` | **无** |
| 标题/窗头 | 无 | `title` + `chrome=dots` | 无 |
| 圆角/描边 | `radius / border / ring` | `radius / border` | **无** |
| 叠放/定位 | `x y`（hidden，`src/registry.mjs:280-281`） | 无 | 子元素 `inset:0` 全部铺满（`layout.css:601-608`） |

三个具体后果：

1. **`panel` 有两套表面系统并存**：`variant`（旧，`:201-238`）与 `surface`（新，`:697-739`）都能改底色，且 surface 规则写在后面所以**两者同时写时 surface 赢**。`reference.md:48` 与 `:70` 把两者并列，`ai.md:313-314` 只讲 `variant`——作者无法知道该用哪一个。
2. **`wash` 一词两义**：作为 `surface="wash"` 它是中性纸阶 `--vk-paper-sf-1`（`elements.css:744`、`layout.css:637`）；作为「语义淡底」它指 `--vk-wash-info` 等（`tokens.css:48-52`）。`vk-box surface="wash"` 与 `vk-panel tone="info" variant="plain"` 都叫 wash，颜色完全不同。
3. **`vk-layer` 少了「面」的必要属性却背了「面」的语义**：它有 `surface / tone`，却没有 `pad / radius / border / h`（`registry.mjs:499-508`，且它在 `CUSTOM` 集合里 `:1169` 所以拿不到 `COMMON` 的 `w/h`）。而它所有子元素都是 `position:absolute; inset:0`（`layout.css:601-608`），**容器没有内容高度**：`<vk-layer>` 不给外部容器高度时高度是 0。库自己的机制测试就是靠 `style="height:420px"` 才立起来的（`tests/mechanism.test.mjs:172`），而 `style` 在构建期是被拒绝的（`src/highlight.mjs:185-188` 的 `GLOBAL_ATTRS` 不含 `style`，`:895-906` 报「未知属性」）。

> 也就是说：**「叠层」是唯一一个「按文档写不出来、按测试要开后门」的构图原语。**

### 1.3 职责重叠清单（成对）

| 对 | 重叠什么 | 证据 | 判断 |
|---|---|---|---|
| `vk-box` / `vk-panel` | 底色、描边、圆角、内距；panel 现在也有 `surface` | `registry.mjs:268-281` vs `:293-300`、`:1227` | panel ≈ box + `title` + `chrome`（8 自有）；box（10 自有）仅多 `none/soft/sf-1..4` 六个表面值 + `ring` + canvas 内 `x/y` |
| `vk-panel` / `vk-layer` | 同一套 `surface` 五档 + 同一套 `tone` 六值 | `registry.mjs:1227`、`:501`；`elements.css:697-739`、`layout.css:632-666` | 词表重复，渲染分支重复（约 60 行 CSS 各写一遍） |
| `vk-pair` / `vk-grid` | 「分两栏」 | `registry.mjs:472-486` vs `:518-537` | pair 多了「轴 + 符号 + split」，grid 多了 n 栏；**两块并置有两种写法，间距单位还不一样**（pair `gap` 是 px，grid `gap` 是档位） |
| `vk-flow` / `vk-steps` | 「N 个条目横排 + 连接线 + 箭头」 | `registry.mjs:547-562` vs `:844-861`；`layout.css:717+` 与 `components.css` 各画一套箭头 | steps 是「工序到哪了」，flow 是「东西怎么变的」——**语义可分，画法重复**（都是「块 + 轨道 + 箭头」） |
| `vk-canvas` / `vk-layer` | 都是「子元素绝对定位」 | `registry.mjs:564-573`（canvas，含 `x/y` 语义）与 `:494-508`（layer，`inset:0`） | canvas = 坐标 + 栅格；layer = 铺满叠放。两者相加才是「定位容器」 |
| `vk-annotate` / `vk-edge` / `vk-note` / `vk-pin` / `vk-ring` | 「指向某处」 | `registry.mjs:575-598`、`:1032-1077`、`:1088-1125`、`:979-1007`、`:1009-1027` | **5 个标签、4 套属性词表、3 份绘制实现**（`annotate.mjs` / `layout.mjs:83-120` / `overlays.mjs:81-155`） |
| `vk-bits` / `vk-cells` / `vk-bytes` | 「一格一个值」的网格 | `registry.mjs:863-885`、`:800-824`、`:826-842` | 语义不同（位 / 格 / 字节），但 `group/cols/address/ascii` 这组旋钮三处各写一遍 |
| `vk-compare` / `vk-img` | 同一张图的取景 | `registry.mjs:751-770` vs `:413-424` | compare 的 `a/b/fit/position/ratio` 就是两个 img + 裁切；`vk-compare` 一个组件的自有属性（14）是 `vk-img`（7）的两倍 |

### 1.4 「只是属性」的标签（名不副实的一次性组件）

判断标准：**去掉它，用「一个已有标签 + 一个属性」能不能表达同一件事**。

| 标签 | 自有属性 | 为什么说「它只是一个属性/一条 CSS 规则」 | 证据 |
|---|---:|---|---|
| `vk-inline` | 2（`variant`、`href`） | `variant` 的 6 个值（code/math/sup/sub/link/keys）就是「行内字的 6 种长相」；没有任何布局、没有子节点契约 | `registry.mjs:367-379`；`registry.mjs:1158` 把它列进 `INLINE`，连 `w` 都不给 |
| `vk-canvas` | 2（`pad-px`、`grid`） | 剩下的 `w/h` 也常见于任何块级标签；定位靠的是子节点的 `x/y`，而 `x/y` 已经是 `vk-box` 的属性（`:280-281`）。它真正的增量只有「相对定位 + 蓝图纸栅格」 | `registry.mjs:564-573`；`layout.css:700-760` |
| `vk-layer` | 3（`surface`、`tone`、`readable`） | 叠放顺序 **100% 由 DOM 顺序 + CSS z-index 决定**（`layout.css:609-617`），JS 只写一个 `data-vk-layer`（`layout.mjs:211-216`）；3 个属性里 2 个（surface/tone）本来属于「面」 | `registry.mjs:494-508`、`layout.mjs:211-216` |
| `vk-rule` | 1（`orientation`） | 已经在 registry 里声明「是一条 1px 高的面」（`:430`），却仍保留独立 CSS 与独立 `tone`（info/focus） | `elements.css:663-689`、`:803` |

### 1.5 应合并 / 应删除清单（只建议）

**应合并**

1. **`vk-panel.variant` → `vk-panel.surface`**（保留一套表面词表：`none/paper/raised/inset/dark` 或 `paper/wash/tint/dark/accent` 二选一）。
   理由：两套都实现了、都进文档、同时写时后者静默赢（`elements.css:201-238` vs `:697-739`）。
2. **`vk-layer` 并入 `vk-panel`（作为 `mode="stack"`）或反过来：`vk-panel` 并入 `vk-box` + `header` 属性**。
   理由：三块面共享 `surface`/`tone`，只有「有没有标题带」「子元素是流内还是叠放」两个差异；现在三份 CSS 各写一遍五档底。
3. **`vk-edge` 并回 `vk-annotate`（真合并，不是子类）**。
   理由：`VkEdge` 只是 `VkAnnotate` 的子类，靠 `_arrowConfig()` 把旧词翻成新词（`layout.mjs:83-120`），但 `tension/bend/via/from-side/to-side/label-dx/label-dy/arrow-style/arrow-size/cap` 这 10 个属性在 `vk-annotate` 上**没有对应物**（对比 `registry.mjs:575-598` 与 `:1045-1075`），所以它既不是别名也不是独立组件。
4. **`vk-canvas` 与 `vk-layer` 合成一个「定位容器」**（`mode="coords" | "stack"`），共享 `h/grid/x/y`。
   理由：两者合计 10 个属性、2 条能力都没有，测试里只能靠 `style` 后门（`tests/mechanism.test.mjs:172`）。
5. **`vk-bits` 并入 `vk-cells` 的一个 `variant="bits"`**（`vk-bits` 25 个属性里 9 个自有，一页用一次；prune-audit 也建议并进 cells，`prune-audit.md` 第 2 节第 13 条）。

**应删除**

1. **`vk-canvas`**（若不做 #4 合并）：5 条声明（2 个自有）、0 条能力、0 个测试文件、`prune-audit.md` 已判「代价最大」。
2. **`vk-inline`**：2 个属性、0 条能力；行内件应由 `vk-text` 的行内标记或 `em/code` 承担。
3. **属性级删除**（不删标签，删重复属性）：
   - `vk-img` 的 `fill`（与 `fit` 同义，见 §2.3）；
   - `vk-panel` 的 `variant`（若采纳合并）；
   - `vk-box` 的 `soft`（与 `sf-2` 完全同值，`elements.css:102` vs `:104`）与 `sf-1`/`sf-2`（与 `surface="wash"`/`"tint"` 同值，`:744-748` vs `:103-104`）；
   - `vk-code.numbering`（`code.mjs:174-181` 只区分 slice/file，且 `vk-asm` 没有对应物）；
   - `vk-steps` 的 `done` 与 `mark` 两个开关（与 `current="-1"` 三个旋钮表达同一件事，见 §2.6）。
4. **注册表里的死配置**：`vk-mark`（`registry.mjs:1247`）、`vk-figure`（`:1294`、`:1494-1497`）、`vk-callout`（`:1302`）三个**已删除标签**的 `EXTRA`/`ATTR_META_BY_TAG` 条目仍在；
   `src/highlight.mjs:197` 的 `WINDOWED` 仍含 `vk-figure`，`:216` 的 `XY_OVERLAY` 仍含 `vk-spotlight`。
   它们不会生效（`EXTRA` 循环有 `if (!def) continue`，`:1332-1336`），但会让「删了什么」永远说不清，也让 `highlight.mjs` 的白名单读起来像还有这些标签。

---

## 2 · 属性一致性

### 2.1 `tone`：7 处声明，5 种取值集合

| 词表 | 标签 | 证据 |
|---|---|---|
| `ok warn err`（3） | `vk-box` | `registry.mjs:269` |
| `neutral info focus ok err warn`（6） | `vk-panel`、`vk-layer`、`vk-annotate`（后两者只是书写顺序不同） | `:291`、`:502`、`:1064` |
| `info focus ok err warn`（5） | `vk-text`、`vk-label`、`vk-note`、`vk-pin`（书写顺序略有差异） | `:1223`、`:349`、`:1117`、`:999` |
| `neutral info focus`（3） | `vk-edge` | `:587` |
| `neutral info`（2） | `vk-bits`、`vk-bars` | `:882`、`:903` |

按集合算是 5 种，按声明算是 7 处（`vk-annotate` 与 `vk-panel` 同集合不同顺序、`vk-note` 与 `vk-text` 同集合不同顺序）。**问题不在顺序，在「同一个词该不该在某个标签上存在」没有规则**：`vk-box` 没有 `focus`，`vk-bits` 连 `ok/err` 都没有，而这三者都叫 `tone`。

后果不只是「记不住」：**同名的 `tone` 在文字与图标上落到不同色值**——`vk-text[tone='ok']` 用文字档 `--vk-ok-ink`（`elements.css:394`），`vk-icon[tone='ok']` 用底色档 `--vk-ok`（`:606`）。实测对白底对比度：`ok` 6.45:1 vs 8.84:1、`err` 6.54 vs 8.91、`warn` 6.80 vs 9.09（`info`/`focus` 两档的 ink 就是 base 本身，`tokens.css:147-148`，所以没有差别）。这是**有意的**（图标只需 3:1），但：① 没有任何文档说明「同词不同墨」；② 规则不一致（5 个语义色里只有 3 个有独立 ink）；③ 没有测试守着。

### 2.2 `size`：一个名字，五种东西

| 含义 | 取值 | 标签 | 证据 |
|---|---|---|---|
| 字阶 | `display headline body caption label data subhead title hero mega` | `vk-text` | `registry.mjs:314`；`elements.css:359-368` |
| 像素或档名（自由文本） | 任意 text（`160` 或 `body`） | `vk-code` `vk-term` `vk-diff` `vk-table` `vk-tree` `vk-asm` | `registry.mjs:642`、`:684`、`:1233` |
| 三档子集 | `label body subhead` | `vk-math`、`vk-annotate`、`vk-note`、`vk-pin` | `:743`、`:1062`、`:1119`、`:1005` |
| 图标档 | `sm md lg xl inherit` | `vk-icon`（别名） | `:1237`；`elements.css:579-583` |
| **体量的别名** | `compact normal hero` | 14 个 MASS_TAGS 上的 `size` 会被运行期改写成 `mass` | `src/runtime/base.mjs:325-330`；`src/shared/tier-alias.mjs:28-43` |

最后一条是最危险的：`<vk-code size="compact">` 会被运行期**改成 `mass="compact"` 并保留 `size="compact"`**（`base.mjs:322-329`），而 `size` 在 `vk-code` 上是自由文本→ 会被当成字号解析。一个属性同时是「字号」「档位」「体量别名」，行为取决于标签与历史。

### 2.3 `fit` / `fill`：一个概念三种写法

| 标签 | 写法 | 语义 | 证据 |
|---|---|---|---|
| `vk-text` `vk-code` `vk-term` `vk-diff` `vk-table` `vk-tree` `vk-asm` | `fit="width"` | 单行**字号自动缩到填满宽度** | `registry.mjs:326`、`:644`；`elements.mjs:471-515` |
| `vk-img` | `fit="cover|contain"` | CSS `object-fit` | `:417` |
| `vk-compare` | `fit="cover|contain"` | 同上 | `:758` |
| `vk-img` | **`fill="cover|contain"`**（`fit` 的同义第二写法） | 同上，且 `fill` 优先 | `:1290-1293`；`elements.mjs:35` |
| `vk-panel` | **`fill="cover|contain|''`** | 铺满父容器（与 layout 的布尔 `fill` 撞名） | `:1228-1230`；`elements.css:786-800` |
| 21 个块级标签 | **`fill`（布尔）** | `align-self: stretch` | `:1179` |

于是在同一份代码里，`fill` 是：布尔（21 个标签）、`cover|contain` 枚举（img）、`cover|contain|空串` 枚举（panel）。
证据是生成物：`types/index.d.ts:55` 是 `fill?: boolean | ''`，`:104` 是 `fill?: 'cover' | 'contain' | ''`，`:242` 是 `fill?: 'cover' | 'contain'`；`reference.md:60` 直接把空串打印进了枚举列。

### 2.4 `gap` / `gap-px` / `pad` / `pad-px`：四种间距单位

| 名字 | 类型 | 标签 | 证据 |
|---|---|---|---|
| `gap` | 11 档枚举（`2xs…3xl` + `group/section/plate`） | `vk-stack` `vk-grid` `vk-list` | `registry.mjs:458`、`:481`、`:612`；`layout.css:34-44` |
| `gap` | **像素数字** | `vk-pair`、`vk-flow` | `:524`、`:554` |
| `gap-px` | 像素数字 | `vk-label`、`vk-edge`、`vk-note`、`vk-annotate` | `:364`、`:593`、`:1121`、`:1070` |
| `pad` | 8 档枚举 | `vk-box`、`vk-panel`、`vk-window` | `:270`、`:298`、`:448` |
| `pad-px` | 像素数字 | `vk-canvas`、`vk-ring` | `:571`、`:1021` |

三件事值得单独指出：

1. **档位枚举里有两对同值别名**：11 个名字只覆盖 9 个像素值（8/16/24/32/48/64/96/128/192）——`group`(64) 与 `xl`(64) 完全同值、`section`(128) 与 `3xl`(128) 完全同值（`tokens.css:287-302` 与 `layout.css:34-44` 对照），`plate`(192) 在 t-shirt 名字里没有对应。**同一像素有两个名字，规范就无法收敛。**
2. **默认档位比「系统沟槽」小**：`--vk-grid-gutter: 32px` 是 12 栏网格的沟槽（`tokens.css:29`），而 `vk-grid` 默认 `gap="sm"` = `--vk-s3` = 24px（`registry.mjs:203` + `layout.css:552`）。默认网格不是网格系统自己的沟槽。
3. **`vk-pair` 默认 `gap=24`**，比 `--vk-gap-block: 32px` 还紧（`registry.mjs:204`；`tokens.css:289`），而 pair 是「两块对照」，最需要呼吸的地方。

### 2.5 一词多义：`current` 与 `mark`

| 属性 | 在哪些标签上是 | 含义 | 证据 |
|---|---|---|---|
| `current` | `vk-code` / `vk-term` / `vk-asm` | 行段（`lines()`） | `registry.mjs:630`、`:675`、`:920` |
| `current` | `vk-bytes` | 字节段（text） | `:839` |
| `current` | `vk-steps` | 步序号（int，-1 合法） | `:855` |
| `current` | `vk-tree` | 节点路径（text） | `:789` |
| `mark` | `vk-code` | 要强调的**词**（text） | `:638` |
| `mark` | `vk-compare` | 差异**框**坐标（text） | `:765` |
| `mark` | `vk-steps` | 强调第 N 步（int） | `:859` |
| `mark` | 任意条目 | `state="mark"`（石墨底） | `:1410-1415` |

`current` 在 4 个标签上是 4 种类型，`mark` 在 3 个标签上再加 1 种条目状态。这是 171 个属性名撑起 676 条声明的主要代价来源。

### 2.6 同一件事的两种写法（并存且都生效）

| 这件事 | 写法 A | 写法 B | 证据 |
|---|---|---|---|
| 这一格是「当前」 | `<li state="current">` | `<li act="focus">` | `CHILD_ATTRS` 同时允许两者（`registry.mjs:1368`），`STATES` 也仍列 `current`（`:1410`）；注释却写「`state="current"` 退役后…」（`:1367`） |
| 这个分区有底色 | `panel variant="inset" tone="info"` | `panel surface="tint" tone="info"` | `elements.css:227` 与 `:730` |
| 这张图铺满 | `img fill="cover"` | `img fit="cover"` | `elements.mjs:35` |
| 这一段是「正在讲」 | `act="focus"` | `tone="focus"` + `strength` | `ai.md:27-40` 推荐 act；`elements.css:392-404` 另有 tone+strength 分支 |
| 贴到目标上 | `<vk-label for="#x">` | `<vk-caption for="#x">` | `registry.mjs:361`、`:1147` |

### 2.7 统一建议（只建议，不改）

1. **`tone` 一套六值**：`neutral info focus ok warn err`，所有标签同一份；`vk-box` / `vk-edge` / `vk-bits` / `vk-bars` 收回自己的子集（子集可以由 CSS 只实现一部分，但**词表必须一致**，否则作者只能在文档里查哪个标签认哪个词）。
2. **`size` 只表字阶**（`display/headline/body/caption` + `hero/mega`），体量只留 `mass`，图标档改名 `icon-size`；`vk-code` 一类「像素字号」改 `font-size`（今天的 `size` 同时吃 `160` 与 `body`）。
3. **`fill` 只留布尔**；图片铺满统一 `fit`；`vk-panel` 的「铺满父容器」改 `stretch="cover|contain"`。
4. **`gap` 只留档位枚举**，像素需求统一 `gap-px`；并在档位里删掉与 `lg`/`3xl` 同值的 `group`/`section`。
5. **`current` 按语义改名**：行段 `line`、字节段 `offset`、步序号 `step`、树路径 `path`（今天是同一个词四种类型）。
6. **`mark` 只留「差异框」**；强调第 N 步改 `emphasis="N"`；代码里的词改 `mark-text`。

---

## 3 · 默认值

### 3.1 先分清「两种默认值」

- **声明默认值**（`DEFAULTS`，`registry.mjs:190-251`）：只进文档与类型，不落地（见 §0）。
- **运行时默认值**：每个组件里的 `|| 'x'` / `?? 'x'`。

两者已经在漂移，且没有测试能发现：

| 属性 | 声明默认 | 运行时默认 | 证据 |
|---|---|---|---|
| `vk-tree.limit` | **无**（`reference.md` 显示 `—`） | `14` | `src/runtime/components.mjs:311` |
| `vk-code.long` | **无**（`reference.md:368` 显示 `—`） | `clip` | `src/runtime/code.mjs:101`；README 却写「默认 clip」（`README.md:108`） |
| `vk-cells.cols` | `0`（且不在声明的 `1..8` 内） | 「不写就用总格数」 | `registry.mjs:246` + `:1278`；`components.mjs:580` |
| `vk-asm.long` | `fail` | `fail` | `registry.mjs:212`、`:930`；`asm.mjs:152` |

`vk-cells.cols` 是唯一一条**数值默认值落在声明范围之外**的属性——机器可验：遍历 `TAGS` 检查 `type in {num,int}` 的 `default` 是否在 `min..max`，只有它报错。`validate()` 只校验枚举默认值（`registry.mjs:1532-1534`），不校验数值范围，所以它一直没被发现。

### 3.2 「默认值让页面变丑 / 说谎」清单

| # | 组件.属性 | 默认 | 为什么是问题 | 证据 |
|---|---|---|---|---|
| D1 | `vk-steps.current` | `0` | **默认替作者宣称「现在停在第 1 步」**：第 1 步拿到 `state=current` + `aria-current="step"`，读屏器也会读出来。纯地图必须显式写 `current="-1"` | `registry.mjs:247`；`components.mjs:671-676`、`:705-707` |
| D2 | `vk-timeline.value-size` | `hero`（280px） | 一帧放三个数字就撑爆——这是库**自己在注释里承认的**（「一帧放三个数字时 hero 会把整页撑爆」，`registry.mjs:962-964`），却仍以 hero 为默认 | `registry.mjs:213` |
| D3 | `vk-grid.cols` / `gap` | `2` / `sm`(24px) | 默认既不是 12 栏坐标系，也不是 32px 沟槽；一页里 `vk-grid` 与 `vk-text body` 的版心节奏对不上 | `registry.mjs:203`；`tokens.css:28-29` |
| D4 | `vk-layer`（整体） | 无高度 | 子元素全部 `inset:0`，容器高度 = 0；不写外部高度就**看不见**，而它又没有 `h` 属性 | `registry.mjs:494-508`、`:1169`；`layout.css:588-608` |
| D5 | 六个内容组件 `chrome` | `min` | 默认每个代码块自带 72px 窗头；放进已有 `title` 的 `vk-panel` 就是**双层标题**——能力矩阵自己承认这件事（「`chrome="none"` 仍可用，但构建期提醒放到提供上下文的容器」） | `registry.mjs:211-212`、`:237`、`:241`、`:245`、`:704`、`:841` |
| D6 | `vk-label.ink` | `muted`（`--vk-paper-ink-4`，5.6:1） | 四档墨里最弱的一档成了所有 kicker/工序标签的默认；`limits.mjs` 的标注下限是 4.5:1，默认只比它高一档（5.6），小字在 0.406× 下最容易糊 | `registry.mjs:197`；`tokens.css:35`；`limits.mjs:52` |
| D7 | `vk-pair.gap` | `24` | 两块对照的默认留白比块间距（32）还小 | `registry.mjs:204`；`tokens.css:289` |
| D8 | `vk-term.title-show` | `false` | 默认窗头不显示作者写的 `title`，只作无障碍名；没有 `src` 文件名时窗头会显示占位词「终端」 | `registry.mjs:236`；`code.mjs:322-323`、`:403` |
| D9 | `vk-asm.long` | `fail` | 同一概念（长行）在 `vk-code` 是 `clip`（能出片），在 `vk-asm` 是 `fail`（**直接构建失败**） | `registry.mjs:212`、`:930`；`code.mjs:101` |
| D10 | `vk-math.size` | `body`（56px） | 公式只能取 `label/body/subhead`，没有 `display/headline`；在 1920 帧里公式默认与正文同大，且**无法调大** | `registry.mjs:743` |
| D11 | `vk-bits.index` | `7-0` | 默认按 8 位编号；写 32 位值而不写 `bit-width` 时，位号仍是 7…0，**默认在说错话** | `registry.mjs:243`、`:878`；`components.mjs:826-833` |
| D12 | `vk-cells.cols` | `0`（越界） | 默认值不在枚举/范围内，文档照抄了 `0` | `registry.mjs:246`、`:1278`；`reference.md:577` |

---

## 4 · 别名债

### 4.1 七条「转发」的实际结构

registry 声明 6 个别名（`registry.mjs:1351-1356`），运行期是 7 个**子类**（`grep 'extends Vk' src/runtime`）：

| 旧名 | 声明去向 | 运行期实现 | 是否真转发 |
|---|---|---|---|
| `vk-icon` | `vk-text`（`registry.mjs:385`） | `class VkIcon extends VkText`（`elements.mjs:525-563`），改写 `_iconName` 读 `name`、`_iconLabel` 读 `label` | **半转发**：属性名 `name`/`label`/`src` 在新标签上不存在 |
| `vk-rule` | `vk-box`（`:429`） | `class VkRule extends VkBox`（`elements.mjs:628-642`），`render()` 只写 `dataset` | **假转发**：样式仍由独立的 `vk-rule[...]` 规则给（`elements.css:663-689`、`:803`） |
| `vk-window` | `vk-panel`（`:439`） | `class VkWindow extends VkPanel`（`components.mjs:106-180`），`_chrome()` 折词表 | **半转发**：词表、默认值、DOM 类名全是独立一套 |
| `vk-pin` | `vk-note`（`:982`） | `class VkPin extends VkNote`（`overlays.mjs:22-60`），覆盖避让选择器 | **半转发**：`variant="dot"` 在 note 上没有对应 |
| `vk-ring` | `vk-box`（`:1012`） | `class VkRing extends VkBox`（`overlays.mjs:81-175`），`draw()` **约 50 行独立几何**（整个类 95 行） | **假转发**：`vk-box ring` 只是一圈 `box-shadow`（`elements.css:124`） |
| `vk-caption` | `vk-label`（`:1136`） | `class VkCaption extends VkLabel`（`caption.mjs:17-34`），`_anchored()=>true` | **基本成立**（唯一一条行为一致的） |
| `vk-edge` | **未登记** | `class VkEdge extends VkAnnotate`（`layout.mjs:83-120`）+ `static legacy='arrow'` | **隐身别名**：`ai.md:95` 说它是别名，`registry` 里它是公开标签 |

### 4.2 每条别名留下的「两套行为」

| 别名 | 两套行为 | 证据 |
|---|---|---|
| `vk-window` | ① `chrome` 词表：旧 `min/none/plain/browser` vs 新 `dots/none`；② 默认：旧 `chrome="min"`、`pad="lg"` vs 新 `chrome="none"`、`pad="md"`；③ DOM：旧 `.vk-win/.vk-hd` vs 新 `.vk-panel-*`；④ `data-chrome` 两个节点两套词（`:128` 写新词，`:153` 写旧词） | `registry.mjs:194`、`:242`、`:297`、`:446`；`components.mjs:118-131`、`:153` |
| `vk-icon` | ① `size` 词表：`sm/md/lg/xl`（64px 级）vs 字阶 10 档；② 可访问名：`label`（`elements.mjs:543-545`）vs **新标签恒返回空、恒 `aria-hidden`**（`:391-394`、`:446-449`）；③ 自定义 SVG：`src`（`registry.mjs:398`）在新标签无入口；④ `tone` 用底色 token（`elements.css:604-608`）vs `vk-text` 用文字 token（`:392-396`） | 同左 |
| `vk-rule` | `vk-rule tone="focus"` 有效（`elements.css:666`），`vk-box` 的 `tone` 只有 `ok/warn/err`（`registry.mjs:269`）→ **旧写法能表达的，新写法表达不了** | 同左 |
| `vk-ring` | `for/variant/dim/keep/pad-px/stroke/dash` 七个属性在 `vk-box` 上**全部不存在**；`vk-box.ring` 是「自己的描边环」，`vk-ring` 是「按 `for` 套住别人」——两件事 | `registry.mjs:1015-1026` vs `:263-282` |
| `vk-pin` | 默认 `leader="elbow"`（`registry.mjs:214`）vs `vk-note` 默认 `leader="line"`（`:233`）；默认 `z=60` vs note 无 z；避让选择器被硬编码回旧集合（`overlays.mjs:35-38`） | 同左 |
| `vk-edge` | `variant/tension/bend/via/from-side/to-side/arrow/arrow-style/arrow-size/cap/label-dx/label-dy` 在 `vk-annotate` 上无对应（`registry.mjs:575-598` vs `:1045-1075`） | 同左 |

### 4.3 `vk-legacy` 还在影响新页面吗？

**结论：不会自动影响（必须显式加 class），但它仍然是「半个开关」，而且已经在新页面上制造了等级倒挂。**

1. **它改的是全局 token，不是页面级作用域**：`.vk-legacy` 改掉 **53 个** `--vk-*` 变量（14 个字号 + 13 个行高 + 8 个行宽 + 18 个窗头/文件名，`elements.css:278-336`）。任何被包进 `.vk-legacy` 子树的新组件都会跟着回到旧尺寸——判据是 `closest('.vk-legacy, [data-vk-legacy]')`（`audit.mjs:37`），**元素级**，不是页级。
   后果：同一页里「旧帧 + 新帧」混排时，40px 的字在旧帧里合法、在新帧里报错，`vk check` 的结论取决于 DOM 位置（`audit.mjs:35-39`；`limits.mjs:42-47`）。
2. **半迁移已经发生**：legacy 表**没有**覆盖 `--vk-t-tag`。`caption` 回到 28px（`:282`），而 `--vk-t-tag` 仍是 36px（`tokens.css:228`，`elements.css:518` 直接读它）。于是 **legacy 页里 `vk-label variant="tag"`（36）比 `caption`（28）还大**，与「tag = caption × 0.75」的定义（`tokens.css:226-228`）正好相反。
   测试也没兜住：legacy 测试只查 body/dot/hd/chip（`tests/batch-ef.test.mjs:266-300`），没查 tag 档。
3. **开关的语义在文档里已经漂移**：`elements.css:337-339` 说 legacy「只切尺寸，形状与默认值不回退」；但 `ai.md:328` 把它写成「回到 14.x 的字号与窗头」，读者会以为连 panel 的框也会回来。

---

## 5 · 能力矩阵覆盖

### 5.1 矩阵的结构性事实

`docs/capabilities.json` 的定义是三件套（契约断言 / 标本页 / 测试），判定逻辑在 `tools/capabilities.mjs`。三个关键实现细节决定了它的上限：

- **测试是「按名字在文件里搜字符串」**（`tools/capabilities.mjs:97`），不执行、不看断言强度。
- **契约必须是「标签.属性」**（`:39-44`），且必须能在 `EFFECTS`/`PROBES` 找到断言（`:49-50`），**组件级行为（如「窄于 1100px 自动竖排」）无法进矩阵**。
- 契约只能描述**新标签**——所以「旧名转发」这件事只能落在新标签的属性上。

覆盖数字（可复算）：

| 指标 | 数值 |
|---|---:|
| 能力条数 | 53 |
| 被当作标本页的标签 | 18 / 31 |
| 出现在任何契约里的标签 | 20 / 31 |
| 契约覆盖的非协议属性 | 76 / 300（25%） |
| 有 `EFFECTS`/`PROBES` 断言的属性 | 230 / 300 |
| 设计上跳过的属性（motion/pose/context/build） | 21 |
| **完全无断言的属性** | **13** |

**零能力标签（11 个）**：`vk-inline`、`vk-stack`、`vk-canvas`、`vk-edge`、`vk-list`、`vk-table`、`vk-math`、`vk-cells`、`vk-bits`、`vk-bars`、`vk-timeline`。
其中 `vk-stack`（所有页面的骨架）与 `vk-edge`（20 个自有属性）最刺眼：**骨架和关系层不在记分板上**。

### 5.2 「契约存在、但测试不测行为」的例子

| 能力 | 它声称的 | 它的契约 | 它的测试实际测的 | 问题 |
|---|---|---|---|---|
| `alias-forward`「旧名 · 六个标签的转发」 | 6 个旧名转发到新标签 | `vk-text.icon`、`vk-box.ring`、`vk-label.for`、`vk-note.kind`、`vk-panel.chrome` ——**全是新标签的属性** | `tests/merged-six.test.mjs:238-292`：只断言旧标签「还画出了东西」（`iconSvg`、`ruleH>0`、`winBd`、`caption` 文本、`pinBd`、`ring` 宽度） | **测的是「没坏」，不是「等同」**。没有任何一条断言比较 `<vk-window>` 与 `<vk-panel chrome="dots">` 的像素/属性 |
| `surface-tones`「五档底 surface」 | 「落在 vk-panel / vk-layer / vk-box 上」 | 只有 `vk-panel.surface` | `tests/mechanism.test.mjs:203` 只查 panel | **声称三个标签，只验一个**；layer/box 的五档底（`layout.css:632-666`、`elements.css:743-763`）没有任何能力 |
| `bleed`「通用属性 bleed」 | `x|y|all|none` | `vk-panel.bleed` | `tests/mechanism.test.mjs:98-124` 只测 `bleed="x"` + panel | 页面级**布尔**写法（`compositions.mjs:23-26`，README 用的那种）完全不在矩阵里；`vk-layer.bleed` 也不在 |
| `layer-overlay`「叠层」 | 第一个铺底、其余叠上、文字有保护 | `vk-layer.readable` | `tests/mechanism.test.mjs:169-201`，且用 `style="height:420px"` 立容器 | **契约只有 `readable`**；「叠放顺序」这个能力本身没有契约（它不是属性） |
| `flow-arrow-scale`「流程箭头」 | 尺寸 = 容器高 × arrow-scale，夹 28–64 | `vk-flow.arrow-scale`、`arrow-label` | `tests/batch-native.test.mjs` 两条，只测箭头尺寸与中轴词 | **「窄于 1100px 自动竖排」无测试、无能力**（`flow.mjs:22`，`grep 1100 tests/` 无命中） |
| `type-scale`「四档字号」 | 200/112/56/48 + 旧名别名 | `vk-text.size` | 其中一条是「200px 只出现在 `--vk-t-display` 一处」的**文本 grep**（`tests/batch-ef.test.mjs`） | 这条测的是「CSS 里不重复写常量」，不是字号行为 |

反过来，做得好的对照物是 `annotate-arrow`：它有「旧标签是别名：vk-edge / vk-pin 与 vk-annotate 同几何」这种**真正的等同测试**（`tests/annotate.test.mjs`）——**恰好是唯一没被登记为别名的 `vk-edge` 享受了这条测试**，而 `vk-window`/`vk-icon`/`vk-rule`/`vk-ring` 都没有。

### 5.3 行为没进矩阵的清单

**13 个完全无断言的属性**（非内容、非 effect、非设计跳过）：

`vk-box.x`、`vk-box.y`（hidden，可接受）、**`vk-text.format`**（`52980 → 52,980`，`elements.mjs:399-408` 实现了，没有契约）、**`vk-inline.href`**、**`vk-code.numbering`**、**`vk-compare.fit`**、**`vk-tree.current`**、**`vk-tree.limit`**、**`vk-bytes.current`**、**`vk-bits.bit-width`**、**`vk-asm.current`**、**`vk-asm.long`**、**`vk-annotate.gap-px`**。

最不该漏的三个：`vk-asm.current` 与 `vk-code.current` 是同一件事，后者有契约、前者没有；`vk-text.format` 是「原 vk-stat 的唯一机制」（`registry.mjs:322`）；`vk-asm.long` 决定构建失不失败。

**组件级行为没进矩阵**（不是属性，所以结构上进不去）：

1. `vk-flow` 的 1100px 自动竖排（`flow.mjs:22`、`:12`）；
2. `vk-stack` 的 `weights` 分配（`layout.mjs:168-190`，还需要 `grow/fill/h` 才生效，`:171`）；
3. `vk-window` / `vk-icon` / `vk-rule` / `vk-ring` 的**转发等同性**（§5.2）；
4. `vk-legacy` 整套兼容开关（没有一条能力，只有一条测试 `tests/batch-ef.test.mjs:266`）；
5. `vk-img` 的加载失败占位（`registry.mjs:404` 声称「加载失败有可见占位」）；
6. `vk-page` 的 `dur/beat/poster`（motion，被契约跳过）。

---

## 6 · 组合能力：常见讲解版式能不能表达

| 版式 | 现成写法 | 能否表达 | 缺口（可执行级） | 证据 |
|---|---|---|---|---|
| 左右对照（A/B 两块） | `vk-pair`、`vk-grid cols="2"` | ✅ | 两套写法语义不同、间距单位不同（pair px / grid 档位）；pair 没有「共享图注/底注」槽，统一说明只能另起一块 | `registry.mjs:518-537`、`:472-486` |
| 上中下（三段等分） | `vk-stack weights="1 1 1"` + `grow`，或 `vk-grid rows="3"` | ⚠️ | `weights` 必须配 `grow/fill/h`，否则**静默按内容高**（只 warn，`layout.mjs:171-187`）；`rows` 是 `context` 属性，同样要有确定高度（`registry.mjs:480`）。没有「等分三行」的一等写法 | 同左 |
| 叠层（字压图/色块压图） | `vk-layer` | ⚠️ | ① 无 `h` → 容器高 0；② 子元素全部 `inset:0`，**无法把标签放到右上角**（只有 `vk-text` 有硬编码的左下角预设，`layout.css:618-622`）；③ 层级靠 `nth-child` 硬编码到 8 层（`:609-617`），第 9 个孩子没有 z-index；④ 底色五档与 panel 重复 | `layout.css:588-617` |
| 出血（图/色带铺到 1920 边） | `bleed="x"`（负 margin）或页面级布尔 `bleed` | ⚠️ | 两套语法并存（§7 例 4）；负 margin 撑宽的是元素自身、不改轨道，所以放进 `vk-grid` 会压到相邻项（库里无测试）；`vk-img` 根本没声明 `bleed`（TS 报错、文档不列，但运行期又能用）；审计只豁免 `.vk-page-bleed`（旧布尔写法），新写法没有豁免路径（`audit.mjs:118`）| `compositions.mjs:23-26`；`layout.css:673-690`；`audit.mjs:118` |
| 满幅（整页一张图 + 压字） | `vk-page` 直接子节点 + 布尔 `bleed` + `vk-layer` | ⚠️ | 布尔 `bleed` 只收「页面直接子节点」（`compositions.mjs:25` 要求 parent 是 page 的 body 列表）；一旦包在 `vk-stack` 里就退回负 margin 语义，z 序不再由出血层保证 | 同左 |
| 三栏对照（A/B/C） | `vk-grid cols="3"` | ❌（语义） | 能等分三栏，但**没有「对照」语义**：没有轴线、没有 A/B 标签位、没有「同一条基线」；`vk-pair` 只支持两块 | `registry.mjs:518-537` |
| 图文左右（图 60 / 文 40） | `vk-pair split="60"` / `vk-grid` + `span` | ✅ | 无 | — |
| 步骤图 / 流水线 | `vk-flow`、`vk-steps` | ⚠️ | `vk-flow` 在窄容器（<1100px）**强制竖排且不可覆盖**（`flow.mjs:22`）——放进 `vk-pair`/半幅栏里就再也横不回来；`vk-steps` 的 `connector` 词表（arrow/line/none）与 flow 的 `arrow` 布尔不一致 | 同左 |
| 引用 + 出处 | 无 | ❌ | 已在 14.0 删除（`CONVERGENCE-14.md:23-37`：`vk-quote` → `.r-quote`）；库的立场是「归项目 CSS」，但 README 又把它列进「不提供的九种排版」（`README.md:34`） | 同左 |

**一句话**：布局层能表达「分份」（grid）、「两块对照」（pair）、「N 步」（flow）、「叠」（layer），但**都不能单独表达**：
① 任意两块以上的对照语义；② 叠层内的自由定位；③ 出血在容器内部的正确行为；④ 不受宽度限制的横排流程。
这四条是讲解版式里最常用的四条。

---

## 7 · 文档与真相

只举**可复现**的例子（照抄就会失败/读错）。

| # | 文档说 | 实际 | 证据 |
|---|---|---|---|
| 1 | README「最小 HTML」写 `<vk-title size="title" sub="…">` | **没有 `vk-title` 这个标签**（14.0 已删，`CONVERGENCE-14.md:26`）；构建期遇未知 `vk-` 标签直接报错 | `README.md:55`；`src/highlight.mjs:340-341`；`TAGS` 无此键 |
| 2 | README 写 `<vk-code … density="loose">` | `density` 已在 14.0 退役，改 `mass`；构建期按未知属性报错 | `README.md:103`；`src/shared/tier-alias.mjs:45-46`；`base.mjs:318-323`；`highlight.mjs:895-906` |
| 3 | README/ai.md 写「没有深色主题、深色代码窗」「没有时间轴、逐行淡入」 | `vk-code`/`vk-term` 有 `surface="dark|inset"`，`vk-panel` 有 `variant="dark"`，`reveal="line"` 逐行浮现 + `at/dur/stagger` 导演层都在；ai.md 自己下一页就在用 `reveal="line"`；审计期间还在并行加入 `vk-page.theme`（三套调色板，见 §0.1）——这句绝对化表述只会越来越错 | `ai.md:18-19` vs `registry.mjs:647`、`:687`、`:293`、`:649`；`src/runtime/director.mjs`；`ai.md:200` |
| 4 | README「出血」写 `<vk-img bleed …>`，并说「铺满整帧、排在内容层后面」 | 这是**布尔**写法，被 `compositions.mjs:25` 识别为旧风格；registry 里 `bleed` 是 `x|y|all|none` 枚举，且 **`vk-img` 没声明 `bleed`**（TS 里也没有） | `README.md:144-148`；`registry.mjs:1182`、`:401-425`；`types/index.d.ts:218-243`；`base.mjs:469-472` |
| 5 | README 四处数字：30 个标签 / 30 张规格页 / 32 张规格页 / 38 页全查 | 公开标签 **31**，场景 **31**，`reference.md` 也写 31；同一份 README 里四个数字互相对不上 | `README.md:8`、`:18`、`:228`、`:254`、`:264`；`docs/reference.md:4`；`SCENES.length=31` |
| 6 | README 说 `vk check` 查「**40px 地板**」 | 现行地板是 48（`caption`）；40 是 legacy 页的 `body` | `README.md:262`；`src/shared/limits.mjs:27`、`:43-46` |
| 7 | ai.md「速查表由 registry 生成」里 `vk-text` 属性列表**没有 `measure` / `wrap`** | 两个属性都真实存在且 README 与 ai.md 正文都在教人写 `measure="none"`；ai-doc 生成器把 `layout:true` 的属性全部过滤掉了 | `ai.md:6`；`ai.md:152`；`tools/ai-doc.mjs:48`；`registry.mjs:319-321`；`README.md:208` |
| 8 | ai.md 说「旧标签 `vk-edge` 是 `vk-annotate` 的别名」 | registry 里 `vk-edge` **没有** `aliasOf`，`ALIASES` 只有 6 项，`vk tags` 把它列为公开标签 | `ai.md:95`；`registry.mjs:575-598`、`:1351-1356` |
| 9 | README 的「数据形状」表把 `vk-figure` 列为组件；ai.md 两处提到 `vk-figure` 的裁切标签 | `vk-figure` 在 14.0 已删（`CONVERGENCE-14.md:30`），registry 里只剩一条死配置 | `README.md:129`；`ai.md:134`；`registry.mjs:1294` |
| 10 | `reference.md` 的 `vk-cells.cols` 默认值是 `0` | 声明范围是 `1..8`，默认值越界；运行期 `0` 无意义 | `reference.md:577`；`registry.mjs:246`、`:1278` |
| 11 | registry 的 `vk-rule` 迁移说明：「一条线就是一块 **1px 高**的面」 | `--vk-line-w` 是 **2px**，`vk-rule` 的高度直接读它 | `registry.mjs:430`；`tokens.css:409`；`elements.css:663` |
| 12 | `vk-panel` 的 `fill` 在 `reference.md` 里被印成 `cover · contain · （空）` | 空串是枚举值，会原样进类型（`fill?: 'cover' \| 'contain' \| ''`） | `reference.md:60`；`types/index.d.ts:104` |

**总结**：文档里「解释性文字」的质量很高（大量设计理由），但**可执行示例与计数类事实**（标签数、页数、默认值、属性名）在 14→15 的多轮改动后没有被任何门禁覆盖。`npm run verify` 只校验**生成物与源码一致**（`package.json:32`），不校验 README/ai.md 的正文。

---

## 8 · 问题表

优先级：**P0** = 会让作者照着写就错 / 生产出片错；**P1** = 系统性一致性与维护成本；**P2** = 清理与优化。

| # | 问题 | 证据 | 影响 | 建议 | 优先级 |
|---:|---|---|---|---|---|
| 1 | README「最小 HTML」用了不存在的 `<vk-title>` | `README.md:55`；`src/highlight.mjs:340-341` | 新用户第一条示例就构建失败 | 改文档（换成 `vk-text size="display"`） | P0 |
| 2 | README 代码窗示例用已退役的 `density="loose"` | `README.md:103`；`tier-alias.mjs:45-46`；`highlight.mjs:895-906` | 同上，且运行时还会静默改写属性 | 改文档为 `mass="hero"` | P0 |
| 3 | 文档宣称「没有深色代码窗 / 没有逐行淡入」，实现全都有 | `ai.md:18-19` vs `registry.mjs:647`、`:649` | 作者按文档设计版式会漏掉两个核心能力 | 改文档，删除这两句绝对化表述 | P0 |
| 4 | `vk-layer` 没有 `h`，容器高度恒为 0；测试用 `style` 后门 | `registry.mjs:494-508`、`:1169`；`layout.css:588-608`；`tests/mechanism.test.mjs:172`；`highlight.mjs:185-188` | 「叠层」按文档写不出来 | **加属性** `h` + `pad`（或把它移出 `CUSTOM`） | P0 |
| 5 | `vk-steps` 默认 `current="0"` 替作者宣称当前在第 1 步 | `registry.mjs:247`；`components.mjs:671-676`、`:705-707` | 纯地图页默认就「说谎」，读屏器也会播 | **改默认** 为 `-1`（或要求必填） | P0 |
| 6 | `vk-img` 没声明 `bleed`，但 README 用它、运行期支持它、校验器也放行 | `registry.mjs:401-425`；`base.mjs:469-472`；`highlight.mjs:187`；`README.md:148`；`types/index.d.ts:218-243` | TS 用户报错、文档不列、行为却生效 | **加属性**（并把 `bleed` 统一到 `COMMON` 或明确全局） | P0 |
| 7 | `bleed` 有两套语法：布尔（页面级层）与 `x/y/all/none`（负 margin） | `compositions.mjs:23-26`；`registry.mjs:1182`；`README.md:144-148` | 同一属性两种语义，审计豁免只认旧写法 | **合并**：布尔改 `bleed="page"`，或单独 `layer-bleed` | P1 |
| 8 | `vk-cells.cols` 默认 `0` 落在声明范围 `1..8` 外 | `registry.mjs:246`、`:1278`；`reference.md:577` | 文档默认值不可实现；`validate()` 不查数值范围 | **改默认** 为 `8` 或删默认 | P1 |
| 9 | `tone` 有 7 处声明、5 种取值集合 | `registry.mjs:269`/`:291`/`:587`/`:882`/`:1064`/`:1117`/`:1223` | 同一属性要按标签查表；`vk-box` 没有 `focus`，`vk-bits` 连 `ok/err` 都没有 | **合并**（统一六值） | P1 |
| 10 | `tone` 在 text 与 icon 上落到不同色值（ink 档 vs 底色档），且只在 3 个语义色上有 ink 档 | `elements.css:394-396` vs `:606-608`；`tokens.css:147-151` | 同词不同墨：`ok` 6.45:1（icon）vs 8.84:1（text）、`err` 6.54 vs 8.91、`warn` 6.80 vs 9.09；`info`/`focus` 无差别，规则不统一 | **合并** 成一套「文字档 / 图形档」并在文档里写明 | P1 |
| 11 | `size` 有 5 种含义（含「体量别名」的静默改写） | `registry.mjs:314`/`:642`/`:743`/`:1237`；`base.mjs:325-330` | 一个属性名五种含义，行为取决于标签与历史 | **加属性** `font-size` / `icon-size`，`size` 只表字阶 | P1 |
| 12 | `fill` 三种类型（bool / enum / enum 含空串） | `registry.mjs:1179`、`:1228-1230`、`:1290-1293`；`reference.md:60` | 同名属性类型冲突，TS 三个不同定义 | **合并**：`fill` 只布尔，其余改 `fit`/`stretch` | P1 |
| 13 | `vk-img` 同时有 `fit` 与 `fill` 表达 object-fit | `registry.mjs:417`、`:1290-1293`；`elements.mjs:35` | 两套写法、`fill` 优先，无测试覆盖 `fit` 路径 | **删** `fill`（保留 `fit`） | P1 |
| 14 | `vk-panel` 同时有 `variant` 与 `surface` 两套表面系统 | `elements.css:201-238` vs `:697-739`；`registry.mjs:293`、`:1227` | 两者同写时 surface 静默赢 | **合并** 为 `surface` | P1 |
| 15 | `wash` 一词两义（中性纸阶 vs 语义淡底） | `elements.css:744`、`layout.css:637` vs `tokens.css:48-52` | 作者以为 `surface="wash"` 是语义色 | **改名** 中性档为 `paper-2`/`soft` | P1 |
| 16 | `vk-window` 与 `vk-panel` 默认相反（chrome min/none，pad lg/md） | `registry.mjs:194`、`:242`；`components.mjs:119`、`:129` | 迁移后静默丢窗头、内距变小 | **改默认** 之一，并在别名说明里写清 | P1 |
| 17 | `vk-window` 的 `chrome` 旧词表（min/plain/browser）无新对应 | `registry.mjs:446`；`components.mjs:118-121`、`:127-128`、`:153` | `chrome="plain"` 被折成 dots，另两值无定义 | **合并** 词表（旧值映射后**构建期报错**） | P1 |
| 18 | `vk-icon` 迁移会丢 `label`（无障碍名）与自定义 `src` | `elements.mjs:543-545` vs `:391-394`、`:446-449`；`registry.mjs:398` | 换标签即失去 a11y 名与自绘图标 | **加属性** `vk-text` 支持 `icon-label`/`icon-src` | P1 |
| 19 | `vk-box.ring` 与 `vk-ring` 是两件事（描边环 vs 按 `for` 套住目标） | `elements.css:124`；`overlays.mjs:81-155`；`registry.mjs:1012-1026` | 迁移说明「已合并」不成立 | **合并** 或改说明为「语义不同，暂不合并」 | P1 |
| 20 | `vk-rule` 迁移说明称「1px 高」，实现是 2px | `registry.mjs:430`；`tokens.css:409`；`elements.css:663` | 迁移后线宽变粗 | **改文档**（或把 thin 改回 1px） | P1 |
| 21 | `vk-rule` / `vk-box` 的 `tone` 词表不兼容 | `elements.css:666`；`registry.mjs:269` | 旧写法能表达的，新写法表达不了 | **合并** tone 词表 | P1 |
| 22 | `vk-edge` 文档称别名、registry 未登记、20 个属性无新对应 | `ai.md:95`；`registry.mjs:575-598`；`layout.mjs:83-120` | 别名债不在 `ALIASES` 里，`vk tags --aliases` 看不到 | **登记** 或**删除**（二选一） | P1 |
| 23 | `vk-legacy` 不覆盖 `--vk-t-tag`，legacy 页里 tag(36) > caption(28) | `elements.css:278-336`、`:518`；`tokens.css:228` | 旧页等级倒挂，且无测试 | **加** legacy 的 tag 值 + 测试 | P1 |
| 24 | `DEFAULTS` 只是文档，不落地，也没有测试比对运行时默认值 | `registry.mjs:1501-1508`；`components.mjs:311`；`code.mjs:101` | 文档默认值与真实默认值可以永远不一致 | **加** 一条「渲染值 == DEFAULTS」的门禁 | P0 |
| 25 | `vk-tree.limit` 文档无默认，运行时是 14 | `components.mjs:311` | 作者不知道默认只显示 14 行 | 补 `DEFAULTS`（配合 #24） | P2 |
| 26 | `vk-code.long` 文档无默认，运行时 clip，README 说默认 clip | `reference.md:368`；`code.mjs:101`；`README.md:108` | 三处不一致 | 补 `DEFAULTS` | P2 |
| 27 | `vk-asm.long` 默认 `fail`，同概念在 `vk-code` 是 `clip` | `registry.mjs:212`、`:930`；`code.mjs:101` | 同一内容形态，一个构建失败一个出片 | **改默认** 为 `clip` + 显式警告 | P1 |
| 28 | `vk-timeline.value-size` 默认 `hero`（280） | `registry.mjs:213`、`:962-964` | 一帧多个数字就溢出 | **改默认** 为 `title` | P1 |
| 29 | `vk-grid` 默认 `cols=2 / gap=sm(24)`，与 12 栏/32 沟槽不符 | `registry.mjs:203`；`tokens.css:28-29`；`layout.css:552` | 默认网格不像网格系统 | **改默认** `cols=12?`（或 `gap="md"`） | P1 |
| 30 | `gap` 枚举里 `lg`/`group`、`3xl`/`section` 同值双名 | `tokens.css:287-302`；`layout.css:34-44` | 同一像素两个名字，规范无法收敛 | **删** 角色名或**删** `3xl` | P2 |
| 31 | `vk-pair.gap` 默认 24 < 块间距 32 | `registry.mjs:204`；`tokens.css:289` | 对照贴太近 | **改默认** 为 32 | P2 |
| 32 | 六个内容组件默认 `chrome="min"` → panel + code 双层标题 | `registry.mjs:211-212`、`:237`、`:241`、`:245`、`:704`、`:841`；能力 `chrome-default` | 最常见组合默认就重复表头 | **改默认** 或让 panel 内的 code 自动 `chrome="none"` | P1 |
| 33 | `vk-term.title-show` 只在 `chrome="none"` 时有效（属性无 `when` 声明） | `code.mjs:383`；`registry.mjs:681` | 默认配置下该属性是 no-op | **加** `when: { chrome: ['none'] }` | P2 |
| 34 | `vk-math.size` 只有 3 档，无 `display/headline` | `registry.mjs:743` | 公式无法做成页面主角 | **加** 档位 | P2 |
| 35 | `vk-bits.index` 默认 `7-0`，不随 `bit-width` 变 | `registry.mjs:243`、`:878`；`components.mjs:826-833` | 32 位值默认位号错 | **改默认** 为跟随位宽 | P2 |
| 36 | `current` 四义、`mark` 四义 | `registry.mjs:630`/`:839`/`:855`/`:789`；`:638`/`:765`/`:859`/`:1410` | 一词多义，AI 与人都要查表 | **改名**（§2.7） | P1 |
| 37 | `state="current"` 与 `act="focus"` 并存且都生效 | `registry.mjs:1367-1368`、`:1410` | 两套词表表达同一状态 | **删** `state="current"`（保留 act） | P1 |
| 38 | `measure`/`wrap` 被标 `layout:true`，因此从 ai.md 速查表消失 | `registry.mjs:319-321`；`tools/ai-doc.mjs:48`；`ai.md:152` | 文档教人写，速查表却没有 | **改生成器**（layout:true 不该等于「协议属性」） | P1 |
| 39 | ai.md 说 `vk-edge` 是别名；README 说 30 个标签 / 30 或 32 张页 | §7 例 5、例 8 | 计数类事实无门禁 | **加** docs 门禁（计数与示例可执行） | P0 |
| 40 | README「40px 地板」与新地板 48 不符 | `README.md:262`；`limits.mjs:27` | 作者按 40 排字会被判错 | 改文档 | P1 |
| 41 | 53 条能力只覆盖 18 个标本页、76/300 个属性；11 个标签零能力 | §5.1 | 记分板高估覆盖率 | **加** `vk-stack`/`vk-edge`/`vk-list` 等最小能力 | P1 |
| 42 | `alias-forward` 能力的契约全在新标签上，测试只验「旧标签没坏」 | `capabilities.json`；`tests/merged-six.test.mjs:238-292` | 转发等价性无人守 | **加** 对照测试（旧 vs 新逐像素/逐属性） | P1 |
| 43 | `surface-tones` 声称 panel/layer/box，只探 panel | `capabilities.json`；`tests/mechanism.test.mjs:203` | 三份实现只守一份 | **加** 契约 `vk-layer.surface`、`vk-box.surface` | P1 |
| 44 | `vk-flow` 的 1100px 竖排无测试无能力；阈值不可覆盖 | `flow.mjs:22`；`registry.mjs:551` | 半幅栏里的流程只能竖排 | **加属性** `orientation`（或 `narrow`）+ 测试 | P1 |
| 45 | 13 个属性完全无断言（含 `vk-text.format`、`vk-asm.current`、`vk-asm.long`） | §5.3 | 行为靠人肉守 | **加** 契约 | P1 |
| 46 | `vk-compare` 30 个属性（14 自有）+ `zoom` 子组件，属性面大于 img | `registry.mjs:746-771` | 单组件承载多种视觉 | **拆**（zoom 作独立能力或删） | P2 |
| 47 | `vk-asm` 25 个自有属性、1 条能力、1 页 | `registry.mjs:907-944` | 属性面最大、覆盖最小 | 收敛 label 类 8 个属性为 1 个 `labels` 映射 | P2 |
| 48 | `vk-inline`/`vk-canvas` 零能力，前者 2 属性 | `registry.mjs:367-379`、`:564-573` | 「只是属性」的标签占位 | **删** 或合并（§1.5） | P2 |
| 49 | 注册表残留已删标签配置（`vk-mark`/`vk-figure`/`vk-callout`） | `registry.mjs:1247`、`:1294`、`:1302`、`:1494-1497`；`highlight.mjs:197`、`:216` | 「删了什么」说不清 | **删** 死配置 | P2 |
| 50 | 文档 4 处提到不存在的标签（`vk-title`/`vk-figure`/`vk-mark`/`vk-spotlight`） | `README.md:55`、`:118`、`:129`、`:190`；`ai.md:134` | 照抄即错 | 改文档 + 加 lint | P1 |
| 51 | `vk-cells.cols` 声明三处（TAGS/EXTRA/DEFAULTS）且互相矛盾 | `registry.mjs:818`、`:1278`、`:246` | 同一个属性三个真源 | **合并** 到 TAGS 一处 | P1 |
| 52 | 组合缺口：三栏对照、pair 共享图注、layer 自由定位、grid 内出血 | §6 | 常见讲解版式要写一次性 CSS | 按 §6 排序补 | P1 |
| 53 | 能力判定用「测试名字符串包含」通过 | `tools/capabilities.mjs:97` | 改个测试名即可「保住」能力 | 改为执行/解析 AST | P2 |

**问题表条数：53 条。** 其中 P0 8 条、P1 33 条、P2 12 条。

---

## 9 · 最该先做的 5 件事

1. **让文档可执行**：把 README / ai.md 里的每个 HTML 代码块抽成 `tests/docs-examples.test.mjs`（跑 `transformHtml` + 断言无 error），先修 API 已经变过的三处：`vk-title`（`README.md:55`，未知标签，构建必失败）、`density="loose"`（`:103`，未知属性，构建必失败）、`<vk-img bleed>`（`:148`，构建不拦但类型与文档都不认——**最阴的一处**）。这类「用户照抄就错」的问题最便宜也最伤。
2. **让默认值只有一个真源**：在 `VkElement.paint()` 里把 `DEFAULTS` 落成「读取时回落」，并加一条「每个标签渲染后的有效值 == `DEFAULTS`」的测试；先修 `vk-steps.current`（改为 `-1`）、`vk-timeline.value-size`（改 `title`）、`vk-cells.cols`（删 `0` 或改 `8`）、`vk-asm.long`（改 `clip`）。
3. **给 `vk-layer` 补 `h`/`pad`，或把它降级**：叠层是唯一「按文档写不出来」的构图原语（`registry.mjs:494-508` + `layout.css:588-608` + `tests/mechanism.test.mjs:172` 的 `style` 后门），不修它，「叠层/满幅」两个版式永远要写一次性 CSS。
4. **收敛三张词表**：`tone` 统一成六值、`size` 只表字阶（新增 `font-size`/`icon-size`）、`fill` 只留布尔；用一个 codemod 一次性迁移 `src/` 与 `docs/`，并在契约里加一条「同名属性在所有标签上 `values` 必须相同」的注册表级测试。
5. **把「别名」变成可验证的契约**：给 `vk-window`/`vk-icon`/`vk-rule`/`vk-ring` 各写一条「旧写法渲染 == 新写法渲染」（逐像素或逐计算样式）的测试，对不上的就**明确写成两个东西**（删 `aliasOf`）——今天的 6 个别名里只有 `vk-caption` 真正成立。

---

## 10 · 一句话：最大结构性问题

**标签层完成了「一个东西一个标签」的减法，属性层却完全没有减法：同一个概念（表面、色调、字号、填充、当前、标记）在 31 个标签里长出了 7 处 `tone` 声明、5 种 `size`、3 种 `fill`、4 种 `current`，而 6 个别名又各自保留了一份实现（`vk-ring` 甚至另写了约 50 行几何），于是「31 个标签」实际暴露的是 171 个属性名 / 676 条声明——**收敛发生在标签的计数上，没有发生在概念的计数上**。
