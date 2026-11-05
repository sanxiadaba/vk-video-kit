# 视频维度 · 字幕驱动 / 焦点跟随 / 同页多态 / 页间转场

这一层让画面跟着**旁白 / 字幕**走，而不是只能静态摆着。它不替代 director：
director 管「元素怎么入场」，这里管「讲到哪一件、这一页是哪个状态、从哪一页来」。

## 1. 字幕轨

`<vk-page cues="…">` 读两种文件，也可以直接写 JSON：

```html
<vk-page dur="9" cues="cues.srt" states="a,b" transition="fade">
  <vk-text id="s1" cue="1">字符串不是值，是一块内存。</vk-text>
  <vk-text id="s2" cue="2">每个字节都有自己的地址。</vk-text>
  <vk-text id="s3" cue="3">相邻的字节，地址只差 1。</vk-text>
</vk-page>
```

- `cues="cues.srt"`：标准 SRT；
- `cues="cues.json"`：`{ start, end, text, focus?, state?, page? }` 数组，或 `{ "cues": [...] }`；
- 内联：`<script type="application/json" data-vk-cues>…</script>`（SRT 用 `type="text/plain"` + `data-format="srt"`）。

SRT 里 `focus=#id` / `state=b` / `page=2` 单独成行时是元数据，不显示：

```srt
1
00:00:00,000 --> 00:00:03,000
字符串不是值，是一块内存。
focus=#s1
state=a
```

任意元件写 `cue="3"`（第 3 条，1 起）或 `cue="0:06-0:09"`（绝对时间段），
就会得到 `data-vk-cue-state="before|on|after"`：没讲到时隐藏、讲到时全亮、讲完退到 55%。

## 2. 焦点跟随

cue 里的 `focus="#id"` 会把画面焦点移到那一件：

- 目标拿到 `data-focus="on"`；
- 目标所在层级上、不含目标的兄弟拿到 `data-focus="off"`，统一降墨
  （`filter: saturate(.45) opacity(.35)`）；
- 页眉 / 页脚 / 控制条等不想被降墨的块写 `data-focus-keep`。

默认 200ms 过渡；`focus-duration="0"` 立即，`focus-transition="off"` 连过渡都不挂。

## 3. 同页多态

`states="a,b,c"` 只声明名字；每一态的「一组属性」写在 JSON 里：

```html
<vk-page cues="cues.srt" states="a,b">
  <script type="application/json" data-vk-states>{
    "a": { "#board": { "attrs": { "hidden": false } } },
    "b": { "#board": { "attrs": { "hidden": true }, "style": { "opacity": "0.35" } },
           "#steps": { "attrs": { "current": "3" } } }
  }</script>
</vk-page>
```

cue 写 `state="b"` 就切到 b 态。切换时新态属性落到 DOM，离开时原样还回去；
整页有 200ms 淡入，带 `data-vk-state` 的内联样式也有 200ms 过渡。

## 4. 页间转场

`<vk-page transition="cut|fade|push">`，默认 `cut`（视频里最常用）。

多页文档用 `vk.goto(i, kind?)` 切页；不传 `kind` 时读目标页的 `transition`。
`cut` 立即，`fade` 220ms 交叉淡入，`push` 260ms 从右侧推入。

## 5. 播放 / 录屏

| 方法 | 作用 |
|---|---|
| `vk.seek(t)` | 求值到第 t 秒：出场 + cue + 焦点 + 状态 |
| `vk.play({ from?, rate? })` | 从当前时刻（或 from）按 rAF 播放 |
| `vk.pause()` | 暂停 |
| `vk.time()` / `vk.duration()` | 当前秒 / 总时长 |
| `vk.cues()` / `vk.cue()` | 整条轨道 / 当前字幕 |
| `vk.focus(sel)` / `vk.state(name?)` | 手动移动焦点 / 读或切状态 |
| `vk.goto(i, kind?)` | 页间转场 |
| `vk.reloadCues()` | 重读 `cues` / `states` |
| `vk.playing` | 是否正在播放 |

录屏按字幕逐段截图：

```bash
node bin/vk.mjs capture --cues _site/specimen/vk-cues.html --out-dir shots/cues
```

产物：`cue-01.png`、`cue-02.png`… + `cues.json`（每一段的时间、focus、state、文字）。

示例页：`_site/specimen/vk-cues.html`（3 条字幕，9 秒，可点「播放」或在控制台 `vk.play()`）。
