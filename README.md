# vk

给 1920×1080 画面用的组件库。一个组件画一种内容：代码、终端、汇编、差异、表格、清单、文件树、内存格、字节、位串、步骤、横条、时间线、图对照、公式、图片、文字、标注。

- 27 个组件，固定 1920×1080，安全区 1680×888。
- 一套词汇：六档字号、六档间距、三档墨、五种表面、六个语调。
- 构建期预处理：语法高亮、公式、字节、文件树、汇编、图标。
- 只出图：`vk render` 把写好的页面渲染成 PNG。

不做文案、不做版面模板、不做时间轴和动画。这是画面层，不是内容层。

## 安装

```bash
npm install
npm run build     # 生成 vk/vk.css、vk/fonts.css、dist/vk.js
```

## 写一帧

一个页面就是一张 1920×1080 的图。作者只写 `<vk-page>`，其余由构建注入。

```html
<vk-page>
  <vk-stack gap="wide">
    <vk-text size="headline">标题</vk-text>
    <vk-code id="c" lang="c" file="hello.c" current="2">
      <script type="text/plain" data-vk-source>
char s[] = "hello";
s[0] = 'H';
      </script>
    </vk-code>
  </vk-stack>
  <vk-callout mode="note" for="#c@line:2">第一行</vk-callout>
</vk-page>
```

```bash
vk render pages/01.html    # 构建 + 自检 + 出图
vk render pages/ --phone   # 780 宽
vk check  pages/           # 只自检
vk doc vk-code             # 一个组件的属性表
vk brief --json            # 全部组件的契约（JSON）
vk icons arrow             # 搜图标
vk clean                   # 清掉 out/ 与缓存
```

完整规则见 [SPEC.md](SPEC.md)。

## 自检

`vk render` 会报客观错误：出画布、出安全区、内容被裁或截断、非覆盖层重叠、字号低于 36px、对比度不足、锚点指不到、渲染失败、素材过期、空帧、文字压图。

不判审美：留白、标题长短、焦点数量都不管。放不下时组件自己处理——代码窗先加宽再缩字号，步骤条窄了竖排，注释避开内容，表格数字右对齐。

## 测试

```bash
npm test        # 契约 + 文档 + 代码健康 + 全部测试页渲染，约 70 秒
```

测试页在 `tests/`，覆盖 27 个组件的各种状态，也包括深色页、对比度、行为（缩字号 / 竖排 / 对齐）。

## 结构

```
src/vocab.mjs      词表：字号 / 行高 / 间距 / 颜色 / 字体
src/schema.mjs     组件契约：27 个组件的属性、取值、默认值
src/build.mjs      构建：校验 + 高亮 / 公式 / 字节 / 树 / 汇编 / 图标
src/runtime/       运行时：基础 / 排布 / 组件 / 标注 / 自检
src/*.css          样式：tokens → base → layout → components → callout
bin/vk.mjs         命令行
tools/             字体 / 图标 / KaTeX / CSS 生成 / 打包 / 素材 / 测试
code/              测试用的示例源码与编译产物
assets/            字体与测试图片
```

## 许可

MIT。字体 OFL 1.1，Shiki MIT，KaTeX MIT，Lucide ISC。
