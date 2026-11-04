# 主题 · 调色板

> 颜色只有一个来源；换主题只换颜色，字号、间距、圆角、包围盒一项都不动。
> 主题库在 `src/tokens/themes.css`，这份文档是它的说明书。

## 一句话

一套主题 = **98 个 `--vk-theme-*` 值**。页面写 `<vk-page theme="graphite">`（或任意祖先
`data-theme="graphite"`），整棵子树换纸、换墨、换强调色；库里的字号、间距、尺寸、
圆角、线宽一个都不变。

## 三层

| 层 | 谁 | 例子 | 规矩 |
|---|---|---|---|
| 1 · 主题 | `--vk-theme-*`（themes.css） | `--vk-theme-paper` `--vk-theme-accent` | 库里**唯一**出现 hex / rgba 的地方 |
| 2 · 语义 | `--vk-paper-*` / `--vk-ink-*` / `--vk-wash-*` / `--vk-focus-*` …（tokens.css） | `--vk-paper-ink-1: var(--vk-theme-ink-1)` | 页面与组件读这一层；只写 `var(--vk-…)` |
| 3 · 组件 | `src/elements` / `layout` / `components` | `color: var(--vk-ink-1)` | 不写颜色；换主题时不需要改一行 |

三层是同一条链：组件读语义名 → 语义名读主题 token → 主题 token 是字面值。
`tests/theme-tokens.test.mjs` 会逐条核对「组件层没有 hex」「语义层全是 var()」
「每个最终名在三套主题下都解得出颜色」。

### 第 1 层 → 第 2 层的完整对照（paper 的值）

**纸与表面**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-paper` | `#ffffff` | — |
| `--vk-theme-surface-0` | `#ffffff` | `--vk-paper-sf-0` |
| `--vk-theme-surface-1` | `#f7f9fc` | `--vk-paper-sf-1` |
| `--vk-theme-surface-2` | `#eef2f7` | `--vk-paper-sf-2` |
| `--vk-theme-surface-3` | `#e2e9f2` | `--vk-paper-sf-3` |
| `--vk-theme-surface-4` | `#cfd9e6` | `--vk-paper-sf-4` |

**墨**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-ink-1` | `#0b0f14` | `--vk-paper-ink-1` · `--vk-syn-keyword` · `--vk-syn-function` |
| `--vk-theme-ink-2` | `#333d4b` | `--vk-paper-ink-2` · `--vk-syn-number` |
| `--vk-theme-ink-3` | `#4b5563` | `--vk-paper-ink-3` |
| `--vk-theme-ink-4` | `#5c6674` | `--vk-paper-ink-4` |

**强调**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-accent` | `#1b3fd6` | `--vk-paper-focus` |
| `--vk-theme-accent-soft` | `rgba(27, 63, 214, 0.16)` | `--vk-paper-focus-soft` |
| `--vk-theme-accent-mark` | `rgba(27, 63, 214, 0.24)` | `--vk-paper-focus-mark` |
| `--vk-theme-accent-hl` | `rgba(27, 63, 214, 0.12)` | — |

**语义**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-info` | `#3a4454` | `--vk-paper-info` |
| `--vk-theme-info-soft` | `rgba(58, 68, 84, 0.1)` | `--vk-paper-info-soft` |
| `--vk-theme-info-mark` | `rgba(58, 68, 84, 0.22)` | `--vk-paper-info-mark` |
| `--vk-theme-ok` | `#0a6b57` | `--vk-ok-paper` |
| `--vk-theme-ok-weak` | `rgba(10, 107, 87, 0.08)` | `--vk-ok-paper-weak` |
| `--vk-theme-ok-mark` | `rgba(10, 107, 87, 0.22)` | `--vk-ok-paper-mark` |
| `--vk-theme-ok-ink` | `#07544a` | `--vk-ok-ink` |
| `--vk-theme-err` | `#b3261e` | `--vk-err-paper` |
| `--vk-theme-err-weak` | `rgba(179, 38, 30, 0.08)` | `--vk-err-paper-weak` |
| `--vk-theme-err-mark` | `rgba(179, 38, 30, 0.2)` | `--vk-err-paper-mark` |
| `--vk-theme-err-ink` | `#8f1d17` | `--vk-err-ink` |
| `--vk-theme-warn` | `#8a4b00` | `--vk-warn-paper` |
| `--vk-theme-warn-weak` | `rgba(138, 75, 0, 0.08)` | `--vk-warn-paper-weak` |
| `--vk-theme-warn-mark` | `rgba(138, 75, 0, 0.22)` | `--vk-warn-paper-mark` |
| `--vk-theme-warn-ink` | `#6e3c00` | `--vk-warn-ink` |

**修订**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-add` | `#0f7a3d` | `--vk-add-paper` |
| `--vk-theme-add-weak` | `rgba(15, 122, 61, 0.1)` | `--vk-add-paper-weak` |
| `--vk-theme-add-mark` | `rgba(15, 122, 61, 0.22)` | `--vk-add-paper-mark` |
| `--vk-theme-del` | `#b3261e` | `--vk-del-paper` |
| `--vk-theme-del-weak` | `rgba(179, 38, 30, 0.09)` | `--vk-del-paper-weak` |
| `--vk-theme-del-mark` | `rgba(179, 38, 30, 0.2)` | `--vk-del-paper-mark` |
| `--vk-theme-mod` | `#8a4b00` | `--vk-mod-paper` |
| `--vk-theme-mod-weak` | `rgba(138, 90, 0, 0.1)` | `--vk-mod-paper-weak` |
| `--vk-theme-mod-mark` | `rgba(138, 90, 0, 0.22)` | `--vk-mod-paper-mark` |

**语义淡底**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-wash-info` | `#edeef0` | `--vk-wash-info` |
| `--vk-theme-tint-info` | `#d4d6d9` | `--vk-tint-info` |
| `--vk-theme-dark-wash-info` | `#13171e` | `--vk-dark-wash-info` |
| `--vk-theme-dark-tint-info` | `#1c222b` | `--vk-dark-tint-info` |
| `--vk-theme-wash-focus` | `#eaeefb` | `--vk-wash-focus` |
| `--vk-theme-tint-focus` | `#cdd5f6` | `--vk-tint-focus` |
| `--vk-theme-dark-wash-focus` | `#0e1733` | `--vk-dark-wash-focus` |
| `--vk-theme-dark-tint-focus` | `#11205a` | `--vk-dark-tint-focus` |
| `--vk-theme-wash-ok` | `#e9f2f0` | `--vk-wash-ok` |
| `--vk-theme-tint-ok` | `#c9deda` | `--vk-tint-ok` |
| `--vk-theme-dark-wash-ok` | `#0b1e1f` | `--vk-dark-wash-ok` |
| `--vk-theme-dark-tint-ok` | `#0b302c` | `--vk-dark-tint-ok` |
| `--vk-theme-wash-err` | `#f8ebeb` | `--vk-wash-err` |
| `--vk-theme-tint-err` | `#eecfce` | `--vk-tint-err` |
| `--vk-theme-dark-wash-err` | `#261316` | `--vk-dark-wash-err` |
| `--vk-theme-dark-tint-err` | `#471718` | `--vk-dark-tint-err` |
| `--vk-theme-wash-warn` | `#f4efe8` | `--vk-wash-warn` |
| `--vk-theme-tint-warn` | `#e5d7c7` | `--vk-tint-warn` |
| `--vk-theme-dark-wash-warn` | `#1f1911` | `--vk-dark-wash-warn` |
| `--vk-theme-dark-tint-warn` | `#39250d` | `--vk-dark-tint-warn` |

**线**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-line-1` | `#d8e2ee` | `--vk-paper-line-1` |
| `--vk-theme-line-2` | `#edf2f8` | `--vk-paper-line-2` |
| `--vk-theme-line-3` | `#b9c7d7` | `--vk-paper-line-3` |
| `--vk-theme-line-strong` | `#8b97a8` | `--vk-paper-line-strong` |

**顺序阶**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-seq-1` | `#e9eefc` | `--vk-seq-1` |
| `--vk-theme-seq-2` | `#c6d4f8` | `--vk-seq-2` |
| `--vk-theme-seq-3` | `#93aeee` | `--vk-seq-3` |
| `--vk-theme-seq-4` | `#5b7ee3` | `--vk-seq-4` |
| `--vk-theme-seq-5` | `#1b3fd6` | `--vk-seq-5` |

**语法**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-syn-string` | `#0b6b4f` | `--vk-syn-string` |
| `--vk-theme-syn-builtin` | `#344054` | `--vk-syn-builtin` |
| `--vk-theme-syn-operator` | `#475467` | `--vk-syn-operator` |
| `--vk-theme-syn-punct` | `#475467` | `--vk-syn-punct` |
| `--vk-theme-syn-comment` | `#667085` | `--vk-syn-comment` |

**代码 / 终端**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-code-bg` | `#0b0f14` | `--vk-dark-surface-0` |
| `--vk-theme-code-bg-1` | `#141a22` | `--vk-dark-surface-1` |
| `--vk-theme-code-bg-2` | `#1c242f` | `--vk-dark-surface-2` |
| `--vk-theme-code-fg` | `#ffffff` | `--vk-dark-fg` |
| `--vk-theme-code-fg-2` | `#dbe3ee` | `--vk-dark-fg-2` · `--vk-dark-syn-number` |
| `--vk-theme-code-meta` | `#b9c7d7` | `--vk-dark-meta` · `--vk-dark-syn-punct` |
| `--vk-theme-code-meta-2` | `#8b97a8` | `--vk-dark-meta-2` · `--vk-dark-syn-comment` |
| `--vk-theme-code-rule` | `#333d4b` | `--vk-dark-rule` |
| `--vk-theme-code-tab` | `#4b5563` | `--vk-dark-tab` |
| `--vk-theme-code-accent` | `#7aa2ff` | `--vk-dark-focus` |
| `--vk-theme-code-accent-soft` | `rgba(122, 162, 255, 0.22)` | `--vk-dark-focus-soft` |
| `--vk-theme-code-info` | `#c6d4f8` | `--vk-dark-info` · `--vk-dark-syn-function` · `--vk-dark-syn-builtin` |
| `--vk-theme-code-ok` | `#8fe3c0` | `--vk-dark-ok` · `--vk-dark-syn-string` |
| `--vk-theme-code-err` | `#ffb4ad` | `--vk-dark-err` |
| `--vk-theme-code-warn` | `#f5c97a` | `--vk-dark-warn` |
| `--vk-theme-code-syn-keyword` | `#f7f9fc` | `--vk-dark-syn-keyword` |
| `--vk-theme-code-syn-operator` | `#c9d2df` | `--vk-dark-syn-operator` |

**品牌 / 影**

| 主题 token | paper 的值 | 最终名（第 2 层） |
|---|---|---|
| `--vk-theme-dot-red` | `#ff5f57` | `--vk-dot-red` |
| `--vk-theme-dot-yellow` | `#febc2e` | `--vk-dot-yellow` |
| `--vk-theme-dot-green` | `#28c840` | `--vk-dot-green` |
| `--vk-theme-on-accent` | `#ffffff` | `--vk-on-accent` |
| `--vk-theme-shadow-hair` | `rgba(11, 15, 20, 0.04)` | — |
| `--vk-theme-shadow-soft` | `rgba(11, 15, 20, 0.06)` | — |
| `--vk-theme-shadow-mid` | `rgba(11, 15, 20, 0.12)` | — |
| `--vk-theme-shadow-deep` | `rgba(11, 15, 20, 0.24)` | — |
| `--vk-theme-scrim` | `#0b0f14` | `--vk-scrim` |


## 三套内置主题

| 主题 | 纸 | 墨 | 强调 | 场景 |
|---|---|---|---|---|
| `paper`（默认） | 纯白 `#ffffff` | 冷墨 `#0b0f14` | 钴蓝 `#1b3fd6` | 现在的样子，与 15.x 逐像素相同 |
| `graphite` | 近白 `#fbfaf7` | 暖墨 `#191512` | 琥珀 `#744c00` | 更「纸感」，适合长时间看 |
| `blueprint` | 极浅蓝 `#f2f7fc` | 深蓝墨 `#0a1b31` | 亮蓝 `#0b4bb5` | 工程图感，适合「讲结构」 |

### 关键色一览

| 关键色 | paper | graphite | blueprint |
|---|---|---|---|
| 纸 | `#ffffff` | `#fbfaf7` | `#f2f7fc` |
| 墨 1（正文） | `#0b0f14` | `#191512` | `#0a1b31` |
| 墨 2（次要） | `#333d4b` | `#3b352d` | `#1d3450` |
| 墨 3（元信息） | `#4b5563` | `#5a5248` | `#3a5370` |
| 强调（当前 / 焦点） | `#1b3fd6` | `#744c00` | `#0b4bb5` |
| info（标注） | `#3a4454` | `#4a4238` | `#2a4568` |
| ok | `#0a6b57` | `#0e6349` | `#0b6355` |
| warn | `#8a4b00` | `#a03c00` | `#8a4b00` |
| err | `#b3261e` | `#a3201a` | `#a8261e` |
| 表面 1 | `#f7f9fc` | `#f5f2ec` | `#e9f1f9` |
| 表面 2 | `#eef2f7` | `#ece7dd` | `#dde8f4` |
| 表面 3 | `#e2e9f2` | `#e1dacd` | `#ccdbec` |
| 线（结构） | `#8b97a8` | `#a99c87` | `#7d9bba` |
| 代码底 | `#0b0f14` | `#17130f` | `#07192c` |
| 代码字 | `#ffffff` | `#fbfaf7` | `#f2f7fc` |
| 代码强调 | `#7aa2ff` | `#e8b15c` | `#7fb3ff` |


### 对比度（WCAG，逐条算出来的）

| 量什么 | 门槛 | paper | graphite | blueprint |
|---|---|---|---|---|
| 正文墨 1 / 纸 | 7:1 | 19.22:1 | 17.38:1 | 16.05:1 |
| 墨 2 / 纸 | 7:1 | 11.00:1 | 11.61:1 | 11.74:1 |
| 墨 3 / 纸 | 7:1 | 7.56:1 | 7.36:1 | 7.35:1 |
| 墨 4 / 纸（muted） | 4.5:1 | 5.82:1 | 5.52:1 | 5.10:1 |
| 强调 / 纸 | 7:1 | 7.70:1 | 7.25:1 | 7.25:1 |
| info / 纸 | 7:1 | 9.84:1 | 9.46:1 | 9.06:1 |
| ok 文字档 / 纸 | 7:1 | 8.84:1 | 9.56:1 | 8.42:1 |
| err 文字档 / 纸 | 7:1 | 8.91:1 | 10.04:1 | 8.27:1 |
| warn 文字档 / 纸 | 7:1 | 9.09:1 | 9.13:1 | 8.44:1 |
| 墨 1 / 表面 3 | 7:1 | 15.72:1 | 13.06:1 | 12.28:1 |
| 代码字 / 代码底 | 7:1 | 19.22:1 | 17.70:1 | 16.45:1 |
| 代码元信息 / 代码底 | 4.5:1 | 11.18:1 | 10.16:1 | 10.10:1 |


正文（墨 1/2/3）在三套主题下都 ≥ 7:1；`ink="muted"` 用的墨 4 与代码里的元信息
按 4.5:1 走（与 `src/shared/limits.mjs` 同一条线）。数字由
`tests/theme-tokens.test.mjs` 守护，改配色时不用手抄。

## 怎么用

```html
<vk-page theme="graphite">…</vk-page>   <!-- 属性写法：运行期镜像到 data-theme -->
<body data-theme="blueprint">…</body>   <!-- 整页 -->
<div data-theme="paper">…</div>         <!-- 局部：只影响这一块（标本册的 theme 页就这么做的） -->
```

- 不写 = `paper`。`theme="paper"` 也合法，用来在深色/其它主题里显式「回到默认」。
- 属性值不在枚举里时构建期报错；运行期遇到非法值会退回「不写」，页面照常。
- 主题只影响颜色：`data-theme` 不参与布局，也不改任何 `font-size` / `gap` / `padding`。
  同一块内容在三套主题下的包围盒与字号逐项相等（`tests/theme-geometry.test.mjs` 量的）。

## 自定义主题

**不用改库。** 作者样式不在 `@layer` 里，永远压过库的层；覆盖 `--vk-theme-*` 就行。

### 整套换掉（推荐）

复制一段内置主题，改值。放在项目 CSS 里，挂在 `:root` 上就是全局主题：

```css
:root{
  --vk-theme-paper:      #f6efe2;
  --vk-theme-ink-1:      #201a12;
  --vk-theme-ink-2:      #453a2c;
  --vk-theme-ink-3:      #6b5c49;
  --vk-theme-ink-4:      #7d6d58;
  --vk-theme-accent:     #7a3b00;
  --vk-theme-surface-1:  #f1e9da;
  --vk-theme-surface-2:  #e8ddc9;
  --vk-theme-surface-3:  #ddd0b8;
  --vk-theme-surface-4:  #cbbb9d;
  --vk-theme-line-1:     #e3d8c4;
  --vk-theme-line-2:     #efe7d8;
  --vk-theme-line-3:     #cfc1a8;
  --vk-theme-line-strong:#a99a80;
  /* 淡底、语义、代码面、顺序阶：照 themes.css 的公式算，或直接抄一套再改 */
}
```

### 局部换掉

挂在带 `data-theme` 的元素上（自己的名字也行）。这一块从它往下换主题：

```css
[data-theme="sepia"]{
  --vk-theme-paper:  #f6efe2;
  --vk-theme-ink-1:  #201a12;
  --vk-theme-accent: #7a3b00;
}
```

```html
<section data-theme="sepia">…</section>
```

### 只改一支

`--vk-theme-paper` 一动，`--vk-theme-surface-0`（以及页面底色）跟着动；
`--vk-theme-ink-1` 一动，`--vk-theme-scrim` 跟着动。
但两档淡底、顺序阶、影、代码面在每套主题里是**预先算好的实色**（alpha 恒为 1，
出片不会因为底下垫了什么而变色），不会随一支色自动重算——要整支换，就连它们一起覆盖。

一个副作用要知道：带 `data-theme` 的元素会**重新声明第 2 层**（语义名），
所以项目层写在 `:root` 上的语义覆盖（例如 `:root{--vk-wash-info:…}`）进不了这棵子树。
要在主题子树里改颜色，就在同一层覆盖 `--vk-theme-*`（或直接覆盖语义名——同一元素上的声明优先）。

## 派生规则

改配色时照这条走；`tests/theme-tokens.test.mjs` 逐条核对：

| 量 | 公式 | 为什么要这样 |
|---|---|---|
| `wash-*` | 纸与语义色混 9% | 分区背景：离纸一档，够分开又不抢字 |
| `tint-*` | 纸与语义色混 22% | 强调块：比周围重，但仍读得清 |
| `dark-wash-*` | 墨 1 与语义色混 16% | 深色块上的分区 |
| `dark-tint-*` | 墨 1 与语义色混 36% | 深色块上的强调 |
| 弱色 / 标记色 | 同色相 + 固定 alpha（.08–.24） | 一套 alpha 表，不新增色相 |
| `shadow-*` | 墨 1 的 rgb + alpha .04 / .06 / .12 / .24 | 石墨主题的影子不会是冷蓝的 |

「混」是 sRGB 逐通道线性插值后取整（与作者工具用的公式一致）。这样换纸之后，
两档淡底仍然「离纸一档、离实色一档」，不会糊在一起。

## 为什么写成 `:root, [data-theme]`

`var()` 在**声明它的元素**上求值。如果把 `--vk-paper-ink-1: var(--vk-theme-ink-1)`
只写在 `:root` 上，子树里挂 `data-theme` 只改了 `--vk-theme-*`，而继承下来的
`--vk-paper-ink-1` 早就按默认主题算好了——**不会**重新求值。

所以 `src/tokens/tokens.css` 底部把「最终名 = 主题 token」这一组同时挂在
`:root, [data-theme]` 上：换主题的那一层就地重算，后代继承到的是新值；
`:root` 仍在选择器里，所以「只覆盖 `--vk-theme-*`」的全局自定义主题照旧生效。
尺寸、字号、间距不前挂：它们不随主题走。

## 加第四套内置主题

1. `src/tokens/themes.css`：复制一个 `[data-theme="…"]` 块，改 98 个值（先定纸、墨、
   强调，再用派生规则算淡底与影）；
2. `src/registry.mjs`：把名字加进 `vk-page` 的 `theme` 枚举（构建期校验用）；
3. `src/runtime/compositions.mjs` 的 `THEMES`：同一组名字（运行期镜像到 `data-theme`）；
4. `tests/lib/surface-tokens.mjs` 的 `THEME_NAMES`：测试用的名字表；
5. `tools/specimens.mjs` 的 `THEME_COLS`：标本册并排展示时多一列；
6. `npm test`：完整性 / 派生 / 对比度三条测试会逐项核对，缺一个 token 就红。

## 边界

- **一帧一套主题。** 局部 `data-theme` 是给「对照」这类明确的构图用的，不是装饰。
- **主题不含尺寸。** 想换字号用 `--vk-t-*`，想换体量用 `mass`；两者与主题互不干扰。
- **主题不改变出片的可读性。** 三套主题的正文都 ≥ 7:1；自定义主题请自己守住这条线
  （`tests/theme-tokens.test.mjs` 只测内置的三套）。
