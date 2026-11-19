/**
 * v27 · 错误码：唯一表。给 validate 用、给 doc / 体检单用；不读文件、不绑 Node。
 *
 * 每条码带两件元信息：
 *   family   错在哪：content（写法/内容）/ layout（排布）/ appearance（视觉）/
 *            state（当前项）/ source（源文件）/ render（渲染与运行期）
 *   severity error 参与 ok=false；hint 是「合法、但可能不是本意」，只提示不拦。
 *
 * 保持细码：AI 改错需要一个具体的码，不要合并成家族。
 */
export const CODES_INFO = {
  /* ---------------------------------------------------------------- 写法 */
  UNKNOWN_TAG: { family: 'content', severity: 'error', when: '标签不在 13 个里', fix: '用 vk brief 看可用标签，别发明新件' },
  UNKNOWN_ATTR: { family: 'content', severity: 'error', when: '属性名拼错，或这个件的这个变体没有这个属性', fix: '用 vk doc <tag> 看当前 as 的属性表' },
  UNKNOWN_VARIANT: { family: 'content', severity: 'error', when: 'as 的取值不在变体表里', fix: '看 vk doc <tag> 的 as 列表；as 是全库唯一的调度词' },
  VALUE_ENUM: { family: 'content', severity: 'error', when: '取值不在词表', fix: '按消息里的可取值改' },
  VALUE_BOOL: { family: 'content', severity: 'error', when: '开关只写属性名', fix: '删掉 ="false" / ="true"' },
  VALUE_NUMBER: { family: 'content', severity: 'error', when: '要数字或整数', fix: '写一个数，不带单位' },
  VALUE_RANGE: { family: 'content', severity: 'hint', when: '数值越过上下限（库会夹到边界，画出来可能不是本意）', fix: '按消息里的上下限改；要更多就拆件 / 拆帧' },
  VALUE_SPACE: { family: 'layout', severity: 'hint', when: '间距不是档名也不是像素（库会回落到 normal）', fix: '用 none / close / normal / wide / section，或 "48"' },
  VALUE_LINES: { family: 'content', severity: 'error', when: '行段写法不对', fix: '写 "3" / "3-7" / "3,7,9" / "4-"；行号 1 起' },
  VALUE_RANGE_ATTR: { family: 'content', severity: 'error', when: 'range 不是单段', fix: '写 "3" / "3-7" / "4-"；只接受一段' },
  VALUE_SELECTOR: { family: 'content', severity: 'error', when: '锚点写法不对', fix: '只用 #id，或 #id@line:3 / @item:2 / @bit:5 / @side:left / @text:词' },
  VALUE_RATIO: { family: 'appearance', severity: 'error', when: '比例写法不对', fix: '写 "16 / 9" 或 "16:9"（两种都认，DOM 里统一成 "16 / 9"）' },
  TEXT_ANCHOR: { family: 'content', severity: 'error', when: '@text: 冒号后面空着，或写法不合法', fix: '写 #c@text:main；按词精确匹配（跨 token 的写法先只标一个词）' },
  ATTR_REQUIRED: { family: 'content', severity: 'error', when: '缺必填属性', fix: '按消息补 target / from / to / src / value' },
  ATTR_IGNORED: { family: 'content', severity: 'hint', when: '这个属性在当前形状下不生效（画面合法，但不是本意）', fix: '删掉它，或换 as' },
  ATTR_PLACEMENT: { family: 'layout', severity: 'error', when: '属性或件放错了位置', fix: 'span 只给 flow 的直接子项；bleed 只给 vk-img；callout 只挂 page / flow；head 只挂 page' },
  SPAN_TOO_WIDE: { family: 'layout', severity: 'error', when: 'span 超过父级列数', fix: '改 span，或改 flow 的 cols / split' },
  ID_FORMAT: { family: 'content', severity: 'error', when: 'id 里有不能进文件名或锚点的字符', fix: '只用字母、数字、下划线、短横线、汉字' },
  ID_DUPLICATE: { family: 'content', severity: 'error', when: '同一帧里 id 重复', fix: '跨帧可重名；同帧只能一个，否则锚点分不清' },

  /* ---------------------------------------------------------------- 内容 */
  CHILD_KIND: { family: 'content', severity: 'error', when: '子节点类型不对', fix: '按消息换标签；块级内容用 vk- 件' },
  CHILD_MISSING: { family: 'content', severity: 'error', when: '缺内容', fix: '按消息写 li / table / script / src' },
  STRAY_TEXT: { family: 'content', severity: 'error', when: '块里有一段裸文字，或用错的变体里写了字', fix: '包进 <vk-text>；只画标记的 callout 里不要写字' },
  GRAPH_REF: { family: 'content', severity: 'error', when: '关系图的边指向不存在的节点', fix: '检查 after / from / to 的 id' },
  GRAPH_CYCLE: { family: 'content', severity: 'error', when: '关系图的 after 成环', fix: '树 / 链不能成环；环用 from/to 边（as="mesh"）' },
  ANCHOR_MISSING: { family: 'content', severity: 'error', when: '锚点指不到这一帧里的 id', fix: '给目标加 id，或改锚点' },
  SELF_REF: { family: 'content', severity: 'error', when: '边或消息的起点和终点是同一个', fix: '改终点；时序自消息暂不支持' },
  TARGET_SELF: { family: 'content', severity: 'error', when: 'arrow / measure 的 from 和 to 是同一个锚点', fix: '换一个终点，或改成 as="mark"' },
  EDGE_MULTI: { family: 'content', severity: 'error', when: '边标签 edge 配了多个 after', fix: '一个标签只属于一条边：拆成多个 <li>，或删掉 edge' },
  STRIDE_NEEDED: { family: 'content', severity: 'error', when: 'cells 写了 addr 却没写 stride，地址算不出来', fix: '补 stride="4"（int 4 / char 1），或删掉 addr 只显示值' },
  BAND_RANGE: { family: 'content', severity: 'error', when: 'band 的 <li> 缺 start / end，或越过容器的 start–end', fix: '每条写 start="3" end="9"；要更宽的域就改容器的 start / end' },
  MARK_MISSING: { family: 'content', severity: 'error', when: 'mark 的词在窗口里一个都没标出来', fix: '改成源码里真实出现、且在 range 内的词' },
  MARK_PARTIAL: { family: 'content', severity: 'hint', when: 'mark 里有词没标出来（其余标上了）', fix: '检查拼写与大小写；跨 token 的写法先只 mark 一个词' },
  FIELD_LABELS: { family: 'content', severity: 'error', when: 'fields 的个数与 | 的段数不一致', fix: '按段数补 / 删段名，逗号分隔' },
  LANG_MISSING: { family: 'content', severity: 'hint', when: '内联源码没写 lang，也没有 src 扩展名可推断（整段没有语法色）', fix: '写 lang="c"；或改用 src= 让扩展名推断' },

  /* ---------------------------------------------------------------- 排布 */
  BLEED_ALL: { family: 'layout', severity: 'error', when: 'bleed 只属于 vk-img', fix: '横向出血 bleed="x" 给 flow 里的图；整帧铺满 bleed="all" 给 page 第一层的图' },
  NOTE_MULTI: { family: 'layout', severity: 'error', when: '一帧里有多条 note', fix: '注栏只有一列，会叠字；拆帧，或把其中一条改成 as="mark"' },
  JUMP_LIMIT: { family: 'layout', severity: 'error', when: '一帧里的 jump 超过 3 条', fix: '跳转是强提示，最多 3 条；其余改成 as="mark"，或拆帧' },
  CLIPPED: { family: 'layout', severity: 'error', when: '文字横向被裁', fix: '缩短这一行、拆帧、或给更多宽度' },
  OUTSIDE: { family: 'layout', severity: 'error', when: '元素出了画布', fix: '往版心里收；整帧铺满只给 vk-img bleed="all"' },
  OVERLAP: { family: 'layout', severity: 'error', when: '块与块叠在一起', fix: '调节间距、换 flow 或拆帧' },
  EMPTY: { family: 'layout', severity: 'error', when: '这一帧没有内容', fix: '写内容，或删掉这一帧' },

  /* ---------------------------------------------------------------- 源文件 */
  SRC_MISSING: { family: 'source', severity: 'error', when: '源文件 / 目录找不到', fix: '路径相对页面文件解析' },
  SRC_CONFLICT: { family: 'source', severity: 'error', when: 'src 与内联内容只能二选一', fix: '删一个' },
  SRC_RANGE: { family: 'source', severity: 'error', when: 'offset / length / range 超出源文件', fix: '按源文件长度改小' },
  SRC_BINARY: { family: 'source', severity: 'error', when: '把二进制文件当源码读了', fix: '换 src，或改用 as="bytes"' },
  SRC_ENCODING: { family: 'source', severity: 'error', when: '源文件不是 UTF-8', fix: '另存为 UTF-8 再引用' },
  RANGE_OUT_OF_RANGE: { family: 'source', severity: 'error', when: 'range 超出源码行数', fix: '改成 1–总行数' },
  TREE_JSON: { family: 'source', severity: 'error', when: '目录 JSON 解析失败', fix: '检查逗号与引号' },
  TREE_NODE: { family: 'source', severity: 'error', when: '目录节点缺 name', fix: '写 "src" 或 {"name":"src"}' },
  MATH: { family: 'source', severity: 'error', when: '公式排版失败', fix: '检查 TeX 括号' },

  /* ---------------------------------------------------------------- 状态 */
  CURRENT_MISSING: { family: 'state', severity: 'error', when: 'current 没命中任何可见的源码行 / 项', fix: 'current 是源码行号（1 起）；被 fold 掉的行不会亮' },
  CURRENT_RANGE: { family: 'state', severity: 'error', when: 'current 越界（仅 bytes / bits 用：字节序号 / 位序号）', fix: 'bytes 写字节序号、bits 写位序号（1 起）；源窗越界报 CURRENT_MISSING' },

  /* ---------------------------------------------------------------- 渲染 */
  BUILD: { family: 'render', severity: 'error', when: '组件构建抛异常', fix: '看消息里的 src / 行段' },
  FRAME: { family: 'render', severity: 'error', when: '没有画布或画布尺寸不对', fix: '包进 vk-page；别覆盖宽高' },
  RUNTIME: { family: 'render', severity: 'error', when: '运行期没就绪或抛错', fix: '检查 dist/vk.js 与页面脚本' },
  RENDER: { family: 'render', severity: 'error', when: '组件渲染失败', fix: '看控制台 [vk] 错误' },
  ASSET: { family: 'render', severity: 'error', when: '图片 / 字体没加载', fix: '检查路径与 dist/fonts' },
  ANCHOR: { family: 'render', severity: 'error', when: '运行期锚点指空', fix: '给目标加 id；build 期也会报' },

  /* ---------------------------------------------------------------- 事实
     以下是体检单的 hint：合法、能出图，但多半不是作者想要的。不参与 ok。 */
  FOCUS_MULTI: { family: 'state', severity: 'hint', when: '一帧里有两处以上「正在看这里」', fix: '只留一个 current；要对照就拆帧，或用 tone 成对' },
  CAPTION_SENTENCE: { family: 'appearance', severity: 'hint', when: '整句用了 56 号（caption 只做标签 / 单位 / 行号）', fix: '整句改成 64；56 只留给元信息' },
  AIR_TOO_MUCH: { family: 'layout', severity: 'hint', when: '正文只占了可用高度的一小半', fix: '加内容、升一档字号（96）、或把这一帧改成封面 place="center"' },
  CODE_LONG_LINE: { family: 'layout', severity: 'hint', when: '代码行超过可读宽度（整幅 32 字符 / 半栏 20）', fix: '缩短这一行、拆帧、或让这一块独占整宽' },
  MARK_UNUSED: { family: 'state', severity: 'hint', when: '代码里标了词，但没有任何标指引它', fix: '加一条 callout target="#c@text:词"，或删掉 mark' },
  LIGHT_SURFACE_ON_DARK: { family: 'appearance', severity: 'hint', when: '深色页上有一块浅色面', fix: 'surface 用 auto / raised；一块浅面只用来做对照' },
  IMG_STRETCHED: { family: 'appearance', severity: 'hint', when: '图片被拉变形（画框比例与原图差 >2%）', fix: '写 aspect 等于原图比例，或改 fit="contain"' },
  IMG_UPSCALE: { family: 'appearance', severity: 'hint', when: '位图被放大 1.5 倍以上', fix: '换更大的图，或缩小画框' },
  IMG_ALT: { family: 'appearance', severity: 'hint', when: '图片没写 alt', fix: '补 alt：图坏了会显示它' },
  IMG_NO_ALT: { family: 'appearance', severity: 'hint', when: '图片没写 alt', fix: '补 alt：图坏了会显示它' },
  CALLOUT_TIGHT: { family: 'layout', severity: 'hint', when: '注记 / 箭头被挤到下方或退化成无箭头', fix: '缩短注记、给目标更多右侧空间，或改成 as="mark"' },
  AUDIT: { family: 'render', severity: 'hint', when: '自检脚本自身出错（这一帧照常出图）', fix: '看终端里的 audit 报错；这是工具问题，不是内容问题' },
};

/** 码表本身：validate 只认这些名字，避免手写字符串拼错。 */
export const CODES = Object.freeze(Object.fromEntries(Object.keys(CODES_INFO).map((k) => [k, k])));

/** 一个码属于哪一层；不认识的码按内容错处理。 */
export const familyOf = (code) => CODES_INFO[code]?.family || 'content';

/** error 参与 ok=false；hint 只进消息，不把帧判成坏帧。 */
export const severityOf = (code) => CODES_INFO[code]?.severity || 'error';
export const isError = (code) => severityOf(code) === 'error';
/** 跨文件契约：build 只给 error 画红框，render 只把 error 算进 ok。 */
export const isHint = (code) => severityOf(code) === 'hint';

/** 只提示不拦的码：文档里可以单独列一栏。 */
export const HINT_CODES = Object.keys(CODES_INFO).filter((k) => severityOf(k) === 'hint');
