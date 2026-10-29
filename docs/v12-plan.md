# v12 实施清单

> 私有 AI 作者工具：不做 npm 发布、不留兼容包袱；AI 写帧，人审片。
> 本文只到「步骤 / 依赖 / 验收」，不含代码。

## 执行状态（2026-10-29）

- **已完成**：Phase 0（registry 契约 / `spec.json` / `vk brief` / `vk doc` 分组）、Phase 1（硬失败布局、内容裁切检测、锚点 build 校验、`shot --strict`、覆盖层不崩、覆盖层文字不进字号地板）、Phase 2（`<li>` / `state` 全站迁移）、Phase 3（callout 两栏与字阶、steps 角标、bytes ASCII、table matrix/state、list/bars/bits state）、Phase 4（纸 + 帧板 + 状态带 + 最小 HTML）、Phase 5（npm `files` / `exports` / `prepack` / `pack:check` 与编辑器件全部删除，版本 12.0.0，文档同源）。
- **验收**：`npm run build`、`verify`、`gate`、`npm test` 全绿（6 组；build 命中缓存时 6，冷跑含 build 7）；`vk brief`、`vk doc`、`shot --strict` 手测通过。
- **未做**：`vk-plot`（按约定等真实帧；当前曲线用 `canvas + edge` 组合）。

## 0. 完成定义

- [ ] `npm run build` 全绿，`_site/specimen` 37 张「帧板 + 状态带 + 最小 HTML」
- [ ] `npm run verify` 全绿（生成物与源码同源，无第二真源）
- [ ] `npm run gate` 全绿（40 地板 / 对比度 / 安全区 / 裁切 / 溢出 / 锚点）
- [ ] `npm test` 全绿（含新的 child schema / 锚点 / 状态 / 硬失败用例）
- [ ] 压力页按预期失败：溢出、锚点越界、旧 `<i>` 语法、`data-em`
- [ ] `vk shot` 对坏页仍出诊断图并 `exit 1`；`--strict` 拒图
- [ ] `vk brief` / `vk doc vk-code` 与 `spec.json`、`reference.md`、`ai.md` 一致

## 1. 已定决策

| # | 议题 | 定下来的 |
|---|---|---|
| 1 | 范围 | 只做组件；不提供帧、配方、模板 |
| 2 | 溢出 | 子项默认不可压扁；装不下 = 硬失败；`check` 查内容被裁；`shot` 出诊断图 + `exit 1` |
| 3 | 子节点 | 统一 `<li>`；tree 用 `src` 或嵌套 `<li>`；child schema 在 build 校验 |
| 4 | 锚点 | `for/from/to` 全部提前到 build；越界/缺失 error；禁止 0,0 回退与 TypeError；覆盖层文字不进 40 地板 |
| 5 | 状态 | `state="current\|mark\|ok\|warn\|err"`；`bad`→`err`；`data-em`/`data-mark` 迁移；生成行仍用 `current` |
| 6 | callout 结构 | 两栏；图标与标题首行对齐；标题/正文同左缘 |
| 7 | 状态可见 | 每页一条状态带（复用 PRESETS，数据件用短 fixture） |
| 8 | 属性面 | 6 个布局属性下沉为布局协议；`vk doc` 默认只列自有属性；补默认值/一句效果/上下文 |
| 9 | 规格页 | 显示最小 HTML（不做复制交互） |
| 10 | 组件集 | 不定数；评估结论：不删；矩阵用 table 单元格 state；`plot` 等真实帧 |
| 11 | table | `td`/`th` 接统一 `state` |
| 12 | 发布 | 不做（私有） |
| 13 | 契约 | registry 唯一真源 → 生成一份 spec + `vk brief`；`ai.md` 只留铁律/反例 |
| 14 | 标本页 | 纸 + 帧板：上方 1920×1080 帧板，下方状态带与片段；索引只裁帧板 |
| 15 | callout 字阶 | 标题 = 正文升一档：meta 40→52、body 52→64、heading 64→88、display 120→120 |

## 2. 审核修正（相对上一版）

- **Q6 修正**：不是「标题回 52」，而是 Q15 的「标题升一档」；真正要修的是对齐。
- **Q2 细节修正**：`shot` 保留诊断图 + `exit 1`；`--strict` 才拒图。坏图是 AI 调试的唯一视觉反馈。
- **Q14 新增**：标本页改「纸 + 帧板」，状态带/片段在帧板外，不再挤 888。
- **已验证不用改**：`tools/thumbs.mjs` 顶部裁 1920×1080；`cli/shot.mjs` 同为顶部裁；`auditPage` 只取 `.vk-page` 子树；`src/scenes/presets.mjs` 的 `PRESETS` 可直接驱动状态带。
- **门禁裁切**：查所有 `vk-*` 宿主（不只 `overflow:hidden/clip`），豁免显式 `overflow="clip"`、`long="clip"`、覆盖层、bleed。
- **state/tone**：保留 `current`/`mark` 作状态词，spec 写死 `current→focus`、`mark→info`；item 级 `state` 与组件级 `tone` 的边界写进 spec。
- **锚点边界**：build 查存在与范围；运行时隐藏（fold / `display:none` / 折叠 tree）跳过、不报错。
- **ai.md**：只留铁律/反例；`src`/内联 code、锚点、选件的示例进 spec 的 `examples`。
- **状态带**：复用 `PRESETS`；code/asm/bytes/diff 用 4–6 行 / 2–4 行短 fixture；cells/table 补 `state` 例子。
- **片段**：从标本源码去掉 `.spec-*` 包装与默认属性；含 `</script>` 的内容用转义 `<pre>` 或外部 `.txt`。
- **README/USAGE**：`npm i`/`npx vk` 改 `node bin/vk.mjs`；删 npm 发布字段与编辑器件。

## 3. Phase 0 · 契约与生成链

> 目标：registry 成为唯一真源；AI 读一份 spec；build / doc / brief / specimens / reference 全部同源。

### 0.1 registry 扩字段

- [ ] `src/registry.mjs` 每个标签增加：
  - `children`：允许的子节点（`li` / `table` / `script` / `text` / 自由节点），每项带最小/最大与是否必需
  - `states`：该件支持哪些 `state`（`current` / `mark` / `ok` / `warn` / `err`）及作用位置（item / row / cell）
  - `examples`：最小 HTML（可从 `SCENES` 派生，但 spec 里要固化）
  - `layout: true`：6 个布局协议属性（`span` / `row-span` / `grow` / `fill` / `overflow` / `measure`）不再逐件写
  - `strip`：状态带的短 fixture（可选，缺省用 `SCENES` body）
- [ ] `ATTR_META` 每个属性补 `effect`（一句「改它会怎样」）与 `default` 展示；`context` 保留
- [ ] `validate()` 覆盖：子节点、state、layout 上下文、示例可解析

### 0.2 新校验模块

- [ ] 新增 `src/validate.mjs`（纯函数）：
  - `checkChildren(tag, tree)`：`<li>` 是否落在允许的父级；`table` 缺 `<table>` 直接报错；`code` 的 `src` 与内联块互斥
  - `parseTargets(tree)`：`#id@part:arg` 解析、id 表、part 范围表（line / cell / byte / bit / field / addr / event）
  - `checkAnchors(tree, targets)`：`for` / `from` / `to` 的存在与范围
  - `stateOf(el)`：统一读取 `state`，兼容旧 `bad` / `data-em` / `data-mark` 并给出迁移提示
- [ ] `cli/build.mjs`、`cli/serve.mjs`、`cli/check.mjs` 共用这一份；所有错误带 `file:line` + 修法

### 0.3 生成链

- [ ] `tools/gen.mjs`：输出 `spec.json`（37 件 × 属性/默认/枚举/子节点/状态/示例/上下文）；保留 `reference.md` / `types`；**删除** `vscode-html-data.json` / `web-types.json` / `custom-elements.json`（或只留 `spec.json` 一份）
- [ ] `tools/ai-doc.mjs`：`ai.md` 只留铁律/反例；标签块增加「子节点 / 状态 / 例」，例取自 `examples`
- [ ] `bin/vk.mjs`（`vk doc`）：分组（内容 / 外观 / 状态 / 布局），默认隐藏布局协议，`--all` 显示；`--json`
- [ ] `bin/vk.mjs`：新增 `vk brief`（37 行摘要，可一次读完）

### 0.4 验收

- [ ] `node bin/vk.mjs brief` 输出 37 行，含子节点与状态
- [ ] `node bin/vk.mjs doc vk-code` 只列自有属性，带默认值与一句效果
- [ ] `npm run verify` 证明 `spec.json` / `reference.md` / `ai.md` 与 registry 同源
- [ ] `grep` 确认仓库里没有第二份手写属性表

## 4. Phase 1 · 硬失败、锚点、门禁

> 目标：装不下就红；写错锚点就红；AI 一次 build 看到全部错。

### 4.1 布局硬失败

- [ ] `src/layout/layout.css`：帧内子项 `flex-shrink: 0`（`.vk-page-bd > *`、`vk-stack > *`、`vk-grid > *`）；`fill` / `grow` = grow，不 shrink
- [ ] `src/components/components.css`：去掉会导致静默压扁的 `flex: 0 1 auto`；`overflow` 显式化

### 4.2 门禁

- [ ] `src/runtime/audit.mjs`：新增内容裁切检测（`scrollHeight > clientHeight`）覆盖所有 `vk-*` 宿主与帧内块
- [ ] 豁免：显式 `overflow="clip"`、`long="clip"`、覆盖层、bleed、`data-allow-overflow`
- [ ] 覆盖层/隐藏文字不进 40 地板（或统一忽略 `hidden` / `aria-hidden`）
- [ ] `cli/shot.mjs`：先出图 + `exit 1`；`--strict` 时 error 拒图
- [ ] `cli/check.mjs`：先跑 `src/validate.mjs`，再跑浏览器 audit

### 4.3 锚点

- [ ] `src/highlight.mjs` 或 `src/validate.mjs`：一次 pass 产出 `targets`（code 行、cells、table cell、bits、asm addr、timeline event）
- [ ] `src/runtime/overlays.mjs` / `components.mjs`：删除 0,0 回退；目标缺失/越界不画、不崩；隐藏目标跳过
- [ ] `vk-pin` / `vk-ring` / `vk-edge` 统一同一套错误对象

### 4.4 压力用例

- [ ] `tests/fixtures/overflow.html`：标题 + 5 列表格 + callout（我这次跑出来的那页）
- [ ] `tests/fixtures/anchor-typo.html`：`for="#c@line:999"`、`for="#m@cell:99"`、`from="#nope"`
- [ ] `tests/fixtures/old-syntax.html`：`<i>`、`bad`、`data-em`
- [ ] `tests/validate.test.mjs`：三类错误全部一次报出
- [ ] `tests/dom.test.mjs`：坏锚点不崩、不画 0,0

### 4.5 验收

- [ ] 溢出页 build 报「内容 644 / 盒子 276，被裁 368」并指向元素
- [ ] 锚点页 build 报「#c 没有第 999 行（1–8）」「#m 没有 cell 99（0–1）」
- [ ] `vk shot` 坏页仍出图，`exit 1`
- [ ] 控制台无 TypeError

## 5. Phase 2 · 语法与状态迁移

> 目标：一种条目写法，一套状态词；旧写法 build 直接报迁移提示。

### 5.1 运行时

- [ ] `src/runtime/components.mjs`：cells / bars / bits / timeline 读 `<li>`；tree 读 `src` 或嵌套 `<li>`
- [ ] table：`td` / `th` 读 `state`；保留 `colspan` / `rowspan`
- [ ] 状态：`state` 统一解析；`bad`→`err`；`data-em` / `data-mark` 移除
- [ ] `filled` 保留（cells 的结构位，不是状态）

### 5.2 样式

- [ ] `src/components/components.css` / `src/elements/window.css`：选择器改 `li` / `[state]`；删 `[data-em]` / `[data-mark]` / `bad`
- [ ] 状态视觉表只写一次：`current` = 16% 蓝底 + 4px 条；`mark` = 梅紫；`ok/warn/err` = 条/底/图标
- [ ] `vk-bytes`：current 同时标 hex 与 ASCII，去掉下划线方案
- [ ] `vk-steps`：✓ 不再浮在编号框角上

### 5.3 内容迁移

- [ ] `src/scenes/scenes.mjs`：37 个 body 改 `<li>` / `state`；补 `strip` 短 fixture
- [ ] `slice/frames/*.html`：codemod + 手查
- [ ] `tools/contract.mjs` / `src/scenes/presets.mjs`：状态与预设同步
- [ ] `tests/`：transform / dom / anchor / contract 全量更新；新增旧语法报错用例

### 5.4 验收

- [ ] `grep -R "<i " src/scenes slice` 零命中
- [ ] `grep -R "data-em\|data-mark" src/scenes slice` 零命中
- [ ] 全部标本页 build 通过；视觉差异只来自预期的状态统一
- [ ] 旧写法 build 报「把 <i> 改成 <li>」「bad 改成 state="err"」

## 6. Phase 3 · 视觉与组件打磨

> 目标：把审核里点名的细节修到「精美」的线，不动结构。

- [ ] callout：两栏；图标与标题首行对齐；标题 = 正文升一档；图标随标题档缩放；正文与标题同左缘
- [ ] callout：`size="heading"` 时 88/64；`display` 时 120/120；两栏宽度随档位
- [ ] bytes：current 同时标 hex 与 ASCII，16% 底 + 4px 条
- [ ] steps：✓ 改成标签行尾小图标或去掉；状态色按状态表
- [ ] window / tree：`200 OK` / `修改` / `新增` 彩色文字芯片 → 墨字 + 色点/条/淡底
- [ ] table：`variant="matrix"`，`table-layout: fixed`，等宽列，`td state`
- [ ] 窗头：语言角标大小写/边框统一（`C` / `ASM` / `Diff` / `hex`）
- [ ] `src/scenes/presets.mjs`：补 callout `size`、table `state`、cells `state` 的状态带条目
- [ ] `_site/shots` 出对照图，人审

## 7. Phase 4 · 标本页（纸 + 帧板）

> 目标：每页上方一块 1080 帧板，下方状态带 + 最小 HTML；索引仍 16:9。

- [ ] `tools/specimens.mjs`：
  - 帧板：现有 `vk-page`（元信息 + 标准形态），置顶，`y=0`
  - 状态带：`PRESETS` × `strip` fixture，每档带属性值标签；cells/table 补 `state` 例子
  - 最小 HTML：从场景源码去掉 `.spec-*` 包装与默认属性；用转义 `<pre>`（含 `</script>` 的件）或外部 `.txt`
  - 删掉页脚「预设：…」文字（由状态带取代）
- [ ] 新 sheet CSS：1920 宽、自动高；帧板外文档宽 1680；标签 40、片段 40 mono
- [ ] `tools/thumbs.mjs`：确认顶部裁 1920×1080 命中帧板（不改逻辑，只验）
- [ ] `tools/links.mjs`：新页面链接
- [ ] `README.md` / `docs/design.md`：措辞改「每页一块帧」
- [ ] `tests/sheet.test.mjs`：帧板 1920×1080、状态带条数 = `PRESETS` 数、片段存在、无溢出

### 验收

- [ ] 37 张页都有帧板 + 状态带 + 最小 HTML
- [ ] 索引缩略图仍是 16:9，且与帧板一致
- [ ] `vk shot _site/specimen/vk-code.html` 仍 1920×1080（只截帧板）
- [ ] 状态带不在帧板内，`vk check` 不误报

## 8. Phase 5 · 清理、文档、验收

- [ ] `package.json`：版本 12.0.0；删 `files` / `exports` / `prepack` / `prepublishOnly` / `keywords` / npm 专用字段
- [ ] 删 `tools/pack-check.mjs`、`tests/package.test.mjs`（或改写为本地脚本检查）；`tools/verify.mjs` 改查 `spec.json`
- [ ] `README.md` / `USAGE.md`：本地用法 `node bin/vk.mjs`；删 npm/徽章/英文摘要
- [ ] `docs/ai.md`：铁律/反例 + 生成块；`docs/design.md`：修 6%/2px → 16%/4px、角标 28/40、36/37、callout 字阶、状态词
- [ ] `docs/reference.md` / `types/index.d.ts` / `spec.json` 重新生成
- [ ] `CHANGELOG.md`：12.0.0（破坏性：`<li>`、`state`、布局硬失败、锚点 build 校验）
- [ ] `.github/workflows/ci.yml`：去掉 pack/publish，保留 build/verify/gate/test
- [ ] 删除 `_site` 下我这次建的临时压力页（`stress*` / `err*` / `anchor*`），用例收进 `tests/fixtures`

### 最终验收

- [ ] `npm run build && npm run verify && npm run gate && npm test`
- [ ] `npm run quick -- vk-code`
- [ ] `node bin/vk.mjs brief`
- [ ] `node bin/vk.mjs doc vk-code --all`
- [ ] `node tools/box-tree.mjs _site/specimen/vk-code.html`
- [ ] 人审 `_site` 索引 + 3 张长件页 + 3 张短件页

## 9. 依赖与并行

```
Phase 0 ─┬─> Phase 1 ─> Phase 2 ─> Phase 3 ─> Phase 4 ─> Phase 5
         └─> 0.3/0.4 文档与 spec 可与 1 并行
```

- 0.1 定字段 → 0.2/0.3/0.4 才能写
- 1.4（校验聚合）依赖 0.2
- 2.3（场景迁移）依赖 1.4（否则旧语法先红一片）
- 3 依赖 2（状态视觉要新选择器）
- 4 依赖 3（状态带要打磨后的件）
- 5 最后

## 10. 风险与回滚

| 风险 | 影响 | 处理 |
|---|---|---|
| 全站迁移面大（37 场景 + 6 slice + 测试） | 高 | codemod 先跑，逐页截图对比；每 Phase 单独 commit |
| 锚点两遍解析 | 中 | 优先让 transform 返回 targets；退化为只读树二次 parse |
| 硬失败让旧页先红 | 高（预期） | 先修门禁，再改布局；红页就是待修清单 |
| 状态带过长 | 中 | 数据件用短 fixture；文档区可滚动 |
| 片段含 `</script>` | 中 | 转义 `<pre>` 或外部 `.txt`，不塞回内联 script |
| callout 图标随档缩放 | 低 | 1em 相对标题，两栏宽度随档位 |
| 删 npm/编辑器件打断 verify/pack-check | 低 | 同 Phase 内改 `verify` / `package.test` |
| thumbs/shot/audit 受纸模型影响 | 低（已验证） | 帧板置顶，三件工具仍裁/查 1920×1080 |

**回滚**：v11 tag 保留；Phase 0–5 分别提交；codemod 可反向执行；`_site` 不入库。

## 11. 不做

- `vk-plot`（等真实帧）、graph、git 图、时序图
- 发布、复制按钮、主题、动效、帧模板/配方
- 深色/反色材质、第二套字阶
- 兼容旧 `<i>` / `bad` / `data-em` 的别名（只给迁移提示，不做运行时兼容）
