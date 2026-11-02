# 能力矩阵

> 由 `tools/capabilities.mjs` 从 `docs/capabilities.json` 生成 —— 不要手改。
> 一条能力必须同时有「契约断言 / 标本页 / 测试」三件；缺一件，状态变红，
> `npm test` 里的 capabilities 组与 `tools/verify.mjs` 都会失败。

记账方式：**能力**是用户能看见的一件事（“有一档淡底”“深色块也能用”），
不是标签。标签会删会改；能力不能悄悄消失。

| 能力 | 契约断言 | 标本页 | 测试 | 状态 |
|---|---|---|---|---|
| 语义淡底 · wash | `vk-panel.tone` | `specimen/vk-panel.html` | `tests/surfaces.test.mjs`<br>`tests/panel.test.mjs` | ✅ 绿 |
| 语义淡底 · tint | `vk-panel.tone` | `specimen/vk-panel.html` | `tests/surfaces.test.mjs`<br>`tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · plain | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · raised | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · inset | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · dark | `vk-panel.variant` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |
| vk-panel · 标题带 | `vk-panel.title` | `specimen/vk-panel.html` | `tests/panel.test.mjs` | ✅ 绿 |

## 明细

### ✅ 语义淡底 · wash

- 能力：五色各一档极淡底（浅色 + 深色），做分区背景；落在 vk-panel 上时是 plain / raised 的底。
- 契约断言：`vk-panel.tone`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/surfaces.test.mjs` · 「语义淡底：五色 wash 齐全，浅色/深色两套各自成阶」；`tests/panel.test.mjs` · 「vk-panel variant=plain：六种 tone 的底色」

### ✅ 语义淡底 · tint

- 能力：五色各一档稍深的底（浅色 + 深色），做强调块；落在 vk-panel 上时是 inset 的底、也是标题带的高一档。
- 契约断言：`vk-panel.tone`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/surfaces.test.mjs` · 「语义淡底：五色 tint 齐全，比 wash 深、比实色浅」；`tests/panel.test.mjs` · 「vk-panel variant=inset：六种 tone 的底色」

### ✅ vk-panel · plain

- 能力：白纸上一块平的区：靠明度与描边分开，不用第二套材质。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=plain：六种 tone 的底色」

### ✅ vk-panel · raised

- 能力：抬起一档：近白底 + 投影，表示“浮在纸面上的一层”。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=raised：六种 tone 的底色」

### ✅ vk-panel · inset

- 能力：凹下一档：灰底；带 tone 时落到 tint，成为强调块。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=inset：六种 tone 的底色」

### ✅ vk-panel · dark

- 能力：深色块：墨底 + 白字 + 深色 wash/tint；同一套语义色在深色上也成立。
- 契约断言：`vk-panel.variant`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel variant=dark：六种 tone 的底色」

### ✅ vk-panel · 标题带

- 能力：title 生成一条标题带，里面是一个 vk-label；没 title 就不留空带。
- 契约断言：`vk-panel.title`
- 标本页：`_site/specimen/vk-panel.html` + 契约宿主 `_site/specimens/vk-panel.html`
- 测试：`tests/panel.test.mjs` · 「vk-panel：标题带用 vk-label，title 变了就跟着变」

## 怎么判红

1. **契约**：`标签.属性` 必须出现在 registry，并且在 `src/effects.mjs` 里有一条
   `on / prop / expect`（内容属性走契约的“改了就变”探针）。motion / pose /
   context / build 这类会被契约跳过的属性不算数。
2. **标本**：`src/scenes/scenes.mjs` 里要有这个标签的场景，构建后
   `_site/specimen/<tag>.html`（人看的标本页）与 `_site/specimens/<tag>.html`
   （契约宿主）都要存在。
3. **测试**：`tests/*.test.mjs` 里真的能按名字找到那条 test（不是只建了文件）。

缺任何一件，脚本逐条打印缺什么并以退出码 1 结束；不会“生成了就算过”。
