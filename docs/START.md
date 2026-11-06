# 写一帧

一帧 = 一个 `<vk-page>`。1920×1080，版心 1680×888（左右 120、上下 96）。
观众在手机横屏上看，整帧缩到约 **780 宽（0.406×）**。一帧只说一件事。

```html
<vk-page>
  <vk-stack gap="normal">
    <vk-label counter="1 / 8">第 3 集 · 指针</vk-label>
    <vk-text size="subhead">下标是<em>偏移量</em>，不是编号。</vk-text>
    <vk-code id="c" lang="c" file="a.c" current="2">
      <script type="text/plain" data-vk-source>
int a[3] = {1, 2, 3};
a[1]         // 从 a 起走一个 int
      </script>
    </vk-code>
  </vk-stack>
  <vk-callout mode="ring" for="#c@line:2"></vk-callout>
</vk-page>
```

## 只有五个词

| 词 | 意思 | 取值 |
|---|---|---|
| `tone` | 语义 | `neutral / info / focus / ok / warn / err` |
| `size` | 字号 | `caption / body / subhead / headline / display / hero`（数据件只到 subhead） |
| `gap` `pad` | 间距 | `none / close / normal / wide / section`，或像素数 |
| `current` | 第几项 | **1 起**；`-1` = 没有当前 |
| `state` | 注意力 | 只写在项上：`current` / `mark` |

没有第二个词表达同一个意思。语义对错用 `tone`，注意力用 `state`，别混。

## 三条命令

```bash
vk render pages/01.html --phone   # 构建 + 自检 + 出图（--phone 出 780 宽，按手机看）
vk check  pages/                  # 只自检
vk doc    vk-code                 # 一个件的属性表；全部契约看 docs/CONTRACT.md
```

`vk render` 会报五类硬错（没画布 / 渲染失败 / 资源失败 / 文字被裁 / 锚点指空），其余只打数字。

## 六条铁律

1. **一帧一件事**。装不下就是这一帧讲多了：拆帧，不是缩字。
2. **标题一行 12 字**（`headline`）。超过就换 `subhead`，或者拆成两行。
3. **一帧 8 行预算**。代码 6 行、表 4 行、树 6 行、cells 2 行——见 `RULES.md`。
4. **一个焦点**。`current`、`em`、`tone="focus"` 加起来，一帧只该有一处「看这里」。
5. **不要手写 `style`**。字号/行高/颜色只走 `size` / `ink` / `weight`，构建期会拦。
6. **结论用 `body`，不要用 `caption`**。`caption` 是元信息（来源、单位、编号），手机 19.5px。

## 下一站

- 每个件的属性、默认值、一帧容量：`docs/CONTRACT.md`（生成物，别手改）
- 容量、选件、颜色语义、深色页：`docs/RULES.md`
- 12 个会静默出错的坑：`docs/PITFALLS.md`

