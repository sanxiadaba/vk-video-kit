/**
 * 全库共用语料：hello.c 的四步编译链。
 *
 * 为什么只有一份：标本册、参考文档、AI 契约、门禁截图都从这里取内容。
 * 语料一旦分散，同一条命令会在三处写成三种样子（14.x 的 29.8kb / 52,980 B / 52.9KB），
 * 观众对不上，测试也拦不住。
 *
 * 事实来源：
 * · 源码：code/hello.c（116 字节）
 * · 命令：assets/hello/build/steps.txt（gcc -E / -S / -c / -o）
 * · 地址：assets/hello/build/disasm.txt（0x404064 处的 "hello" 字面量）
 * · 产物尺寸：预处理后 52,980 字节、汇编 635 字节、目标 760 字节、可执行 43,956 字节
 *
 * 只放"能读到的真东西"：命令、尺寸、地址、输出、内存布局、C 标准年表。
 * 不放占位词 —— tests/specimen-display.test.mjs 会扫全部场景文件。
 */

const SIZE = {
  source: 116,
  preprocessed: 52980,
  assembly: 635,
  object: 760,
  executable: 43956,
};

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const CORPUS = {
  file: 'hello.c',
  output: 'Hello, World!',
  symbol: '_puts',
  address: '0x404064',
  addressBase: '0x404000',
  addressOffset: 0x64,
  symbolAddress: '4026cc',
  symbolLine: 'call 4026cc &lt;_puts&gt;',
  float: {
    bits: '1 01111111 10000000000000000000000',
    hex: '0x3f800000',
    value: '1.0',
  },
  size: SIZE,
  bytes: {
    source: `${SIZE.source} 字节`,
    preprocessed: `${fmt(SIZE.preprocessed)} 字节`,
    assembly: `${SIZE.assembly} 字节`,
    object: `${SIZE.object} 字节`,
    executable: `${fmt(SIZE.executable)} 字节`,
  },
  /** 四步命令链；steps.steps 是 vk-steps / vk-list / vk-flow 的共同顺序。 */
  stages: [
    {
      key: 'pre',
      step: 'gcc -E',
      title: '预处理',
      cmd: 'gcc -E hello.c -o hello.i',
      out: 'hello.i',
      size: `${fmt(SIZE.preprocessed)} 字节`,
      what: '把 stdio.h 抄进 hello.c，只做文本替换，不检查语法。',
    },
    {
      key: 'asm',
      step: 'gcc -S',
      title: '编译',
      cmd: 'gcc -S hello.i -o hello.s',
      out: 'hello.s',
      size: `${SIZE.assembly} 字节`,
      what: '把 C 语句翻成汇编，函数入口和字符串地址开始出现。',
    },
    {
      key: 'obj',
      step: 'gcc -c',
      title: '汇编',
      cmd: 'gcc -c hello.s -o hello.o',
      out: 'hello.o',
      size: `${SIZE.object} 字节`,
      what: '把助记符收成机器码，符号表里留下 _puts 待链接。',
    },
    {
      key: 'exe',
      step: 'gcc -o',
      title: '链接',
      cmd: 'gcc hello.o -o hello.exe',
      out: 'hello.exe',
      size: `${fmt(SIZE.executable)} 字节`,
      what: '链接器补上运行时，0x404064 处的字符串被翻译成 Hello, World!。',
    },
  ],
  /** 终端记录：与 assets/hello/build/steps.txt 同源。 */
  term: [
    '$ gcc -E hello.c -o hello.i',
    '$ gcc -S hello.i -o hello.s',
    '$ gcc -c hello.s -o hello.o',
    '$ gcc hello.o -o hello.exe',
    '$ ./hello.exe',
    'Hello, World!',
  ],
  /** C 标准年表：轴模式时间线的真实数据（不是编译步骤）。 */
  history: [
    { date: '1972', label: 'C 诞生', text: 'Dennis Ritchie 在 Bell Labs 写下第一版 C。' },
    { date: '1978', label: 'K&R C', text: '《The C Programming Language》定义了事实标准。' },
    { date: '1989', label: 'C89', text: 'ANSI X3.159-1989 把 C 标准化。' },
    { date: '1999', label: 'C99', text: '加入 // 注释、变长数组与 stdint.h。' },
    { date: '2011', label: 'C11', text: '加入 _Generic、原子操作与线程库。' },
  ],
  /** C 类型的宽度：vk-table 的 ledger 素材。 */
  types: [
    { name: 'char', bytes: '1', range: '-128 … 127' },
    { name: 'short', bytes: '2', range: '-32768 … 32767' },
    { name: 'int', bytes: '4', range: '-21 亿 … 21 亿' },
    { name: 'unsigned', bytes: '4', range: '0 … 42 亿' },
    { name: 'long', bytes: '8', range: '-9.2e18 … 9.2e18' },
  ],
  /** hello 的内存字节：vk-bytes / vk-cells 共用。 */
  memory: {
    addr: '0x404064',
    cells: [
      { value: "'h'", label: 's[0]' },
      { value: "'e'", label: 's[1]' },
      { value: "'l'", label: 's[2]', state: 'mark' },
      { value: "'l'", label: 's[3]' },
      { value: "'o'", label: 's[4]' },
      { value: '\\0', label: 's[5]', filled: true },
      { value: '0x2a', label: 'int x', span: 4 },
      { value: "'H'", label: 'char' },
      { value: '…', label: '填充 3 字节', span: 3, filled: true },
      { value: '0xff', label: 'y', state: 'err' },
    ],
  },
  /** 三条真实结论：vk-list 的 check 态直接引用。 */
  checks: [
    { state: 'ok', text: 'hello.i 是 52,980 字节：头文件被抄进来了。' },
    { state: 'warn', text: 'hello.s 只有 635 字节：指令比源码更短。' },
    { state: 'err', text: 's[5] 漏掉 \\0：printf 会读过字符串末尾。' },
  ],
};

/** 短别名：场景文件里写 C.file / C.size.preprocessed 比 CORPUS 更短。 */
export const C = CORPUS;

export const sizeLabel = (key) => CORPUS.bytes[key];
