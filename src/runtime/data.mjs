/* 数据件：表格 / 列表 / 文件树 / 内存格 / 字节 / 位。
   ----------------------------------------------------------------------------
   构建期已经把能算的算完了：树的缩进与树线、字节的十六进制与 ASCII、格的个数。
   运行期只做两件事：标出「哪个是当前」，把几个布局变量写到宿主上。
   默认值一律来自 schema（attr* 系列自己读），这里不写第二份 fallback。 */

import { VkElement, define, attrBool, attrEnum, attrIndex, attrLines, attrNum, attrSpace, attrText, takeSlot, warn } from './base.mjs'

/** size 是档名或像素：档名走 tokens，像素原样。 */
const sizeCss = (size) => {
  const text = String(size ?? '').trim()
  return /^\d+(\.\d+)?$/.test(text) ? `${text}px` : `var(--vk-fs-${text})`
}

/** 节点路径：统一成 posix 相对路径，好和构建期写进 data-vk-node 的值比。 */
const normPath = (raw) =>
  String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

/* ------------------------------------------------------------------ 表格 */
/* 数字列：按列判断，只给那一列的格子加 .num（对齐交给 CSS）。 */
const NUM = /^-?(0|[1-9]\d{0,2}(,\d{3})*)(\.\d+)?%?$/

export class VkTable extends VkElement {
  render() {
    const table = this.querySelector('table')
    const caption = attrText(this, 'caption').trim()
    if (!table) {
      this._cap?.remove()
      this._cap = null
      return
    }
    this._align(table)
    const tbSize = attrEnum(this, 'size');
    if (tbSize) this.style.setProperty('--vk-cs', sizeCss(tbSize))
    if (!caption) {
      this._cap?.remove()
      this._cap = null
      return
    }
    if (!this._cap) {
      this._cap = document.createElement('div')
      this._cap.className = 'vk-cap'
    }
    this._cap.textContent = caption
    // 表题在表上方：它是标题，不是注脚。
    if (this._cap.nextElementSibling !== table) table.before(this._cap)
  }

  /**
   * 数字列右对齐：按列判断，只给那一列的格子加 class。
   * （整张表加 .num 会把后面的文字列也右对齐。）
   */
  _align(table) {
    for (const cell of table.querySelectorAll('td, th')) cell.classList.remove('num')
    const body = table.tBodies[0]
    if (!body) return
    const cols = new Map()
    for (const row of body.rows) {
      for (const [i, cell] of [...row.cells].entries()) {
        if (i === 0) continue
        const text = (cell.textContent || '').trim()
        if (!text) continue
        const stat = cols.get(i) || { num: 0, total: 0 }
        stat.total++
        if (NUM.test(text)) stat.num++
        cols.set(i, stat)
      }
    }
    for (const [i, stat] of cols) {
      if (!(stat.num >= 2 && stat.num * 3 >= stat.total * 2)) continue
      for (const row of body.rows) row.cells[i]?.classList.add('num')
      const head = table.tHead?.rows[0]
      head?.cells[i]?.classList.add('num')
    }
  }
}

/* ------------------------------------------------------------------ 列表 */
/* 条目全由 CSS 画：tone / state 是属性选择器的事，运行期只给间距和字号。 */
export class VkList extends VkElement {
  render() {
    const gap = attrSpace(this, 'gap')
    if (gap) this.style.setProperty('--vk-gap-list', gap)
    else this.style.removeProperty('--vk-gap-list')
    const size = sizeCss(attrEnum(this, 'size'))
    if (size) {
      this.style.setProperty('--vk-cs', size)
      this.style.fontSize = size
    }
  }
}

/* ------------------------------------------------------------------ 文件树 */
/* 行、缩进、树线都是构建期生成的；运行期只标当前节点。 */
export class VkTree extends VkElement {
  render() {
    const size = sizeCss(attrEnum(this, 'size'))
    if (size) this.style.setProperty('--vk-cs', size)
    const want = normPath(attrText(this, 'current'))
    let hit = 0
    // 树是嵌套节点（.vk-node），不是平铺的行：别按旧结构找。
    for (const row of this.querySelectorAll('.vk-tree .vk-node[data-vk-node]')) {
      const on = !!want && normPath(row.dataset.vkNode) === want
      if (on) hit++
      row.toggleAttribute('data-current', on)
    }
    if (want && !hit) warn(this, `current="${want}" 不在文件树里`)
  }
}

/* ------------------------------------------------------------------ 内存格 */
/* 一格一个 div：标签、值、地址。地址从 addr 起算，每格 1 字节。 */
export class VkCells extends VkElement {
  render() {
    if (this._items == null) this._items = takeSlot(this).filter((n) => n.nodeType === 1 && n.localName === 'li')
    const items = this._items
    this.style.setProperty('--vk-cols', String(attrNum(this, 'cols')))
    const size = sizeCss(attrEnum(this, 'size'))
    if (size) this.style.setProperty('--vk-cs', size)

    const addr = attrText(this, 'addr').trim()
    const start = addr ? Number(addr) : null
    const hasAddr = start != null && Number.isFinite(start)
    if (addr && !hasAddr) warn(this, `addr="${addr}" 不是数字地址`)

    const current = attrIndex(this, 'current')
    const hit = current >= 1 && current <= items.length ? current - 1 : -1
    if (current !== -1 && hit < 0) warn(this, `current="${current}" 超出 1…${items.length}`)

    const cells = items.map((li, i) => {
      const cell = document.createElement('div')
      cell.className = 'vk-cell'
      cell.dataset.vkCell = String(i)

      const label = attrText(li, 'label')
      if (label) {
        const el = document.createElement('span')
        el.className = 'vk-cell-l'
        el.textContent = label
        cell.append(el)
      }

      const value = document.createElement('span')
      value.className = 'vk-cell-v'
      value.textContent = attrText(li, 'value') || (li.textContent || '').trim()
      cell.append(value)

      if (hasAddr) {
        const a = document.createElement('span')
        a.className = 'vk-cell-a'
        a.textContent = `0x${(start + i).toString(16).padStart(4, '0')}`
        cell.append(a)
      }

      const tone = attrEnum(li, 'tone')
      if (tone) cell.setAttribute('tone', tone)
      const state = attrEnum(li, 'state')
      if (state) cell.setAttribute('state', state)
      if (i === hit) {
        cell.classList.add('is-current')
        cell.setAttribute('state', 'current')
      }
      return cell
    })

    // 每次重建：属性改了也只是换掉这一批 div，不会把旧格子留在后面。
    this.replaceChildren(...cells)
  }
}

/* ------------------------------------------------------------------ 字节 */
/* 十六进制、ASCII、地址都是构建期的；运行期只把 current 那一段点亮。 */
export class VkBytes extends VkElement {
  render() {
    const want = attrLines(this, 'current')
    for (const byte of this.querySelectorAll('i[data-vk-byte]')) {
      byte.toggleAttribute('data-current', !!want?.has(Number(byte.dataset.vkByte)))
    }
    this.registerPlace()
  }

  /** 字节窗是固定列宽的字表格：放不下就整体缩字号，不裁掉 ASCII 列。 */
  place() {
    const win = this.querySelector('.vk-win')
    if (!win) return
    this.style.setProperty('--vk-cs', '56px')
    let need = 0
    for (const row of this.querySelectorAll('.vk-brow')) need = Math.max(need, row.scrollWidth)
    if (!need || !win.clientWidth) return
    const next = Math.max(36, Math.min(56, (56 * (win.clientWidth - 4)) / need))
    this.style.setProperty('--vk-cs', next.toFixed(2) + 'px')
  }
}

/* ------------------------------------------------------------------ 位 */
/* value 可有空格（1 01111111 1000…）：先拆成单个位，再按 index 决定序号。
   位数不校验：8 / 16 / 32 / 64 之外的位串原样画出来。 */
export class VkBits extends VkElement {
  render() {
    const fields = this._fields()
    const total = fields.reduce((n, f) => n + f.length, 0)
    if (!total) {
      warn(this, '缺 value（位串）')
      this.replaceChildren()
      return
    }
    const mode = attrEnum(this, 'index')
    const group = Number(attrEnum(this, 'group')) || 1
    const sign = attrBool(this, 'sign')

    const row = document.createElement('div')
    row.className = 'vk-bit-row'

    let seen = 0
    fields.forEach((field, fi) => {
      const box = document.createElement('div')
      box.className = 'vk-bit-field'
      field.forEach((bit, bi) => {
        const cell = document.createElement('div')
        cell.className = 'vk-bit'
        cell.dataset.vkBit = String(seen)

        // 序号：down 从 n-1 递减，up 从 0 递增，none 没有，sparse 只标 8 的倍数位。
        if (mode !== 'none') {
          const idx = document.createElement('span')
          idx.className = 'vk-bit-i'
          const n = mode === 'up' ? seen : total - 1 - seen
          idx.textContent = mode === 'sparse' && n % 8 !== 0 ? '\u00a0' : String(n)
          cell.append(idx)
        }

        const v = document.createElement('span')
        v.className = 'vk-bit-v'
        v.textContent = bit
        cell.append(v)

        // 组边界：字段内每 N 位多 8px（字段之间由 .vk-bit-field 的间距负责）。
        if (bi > 0 && bi % group === 0) cell.style.marginLeft = '8px'
        seen++
        box.append(cell)
      })
      if (fi > 0) box.classList.add('vk-bit-field-gap')
      row.append(box)
    })

    // 符号位永远是第一位。
    if (sign) row.querySelector('.vk-bit')?.setAttribute('data-sign', '')

    const label = attrText(this, 'label')
    if (label) {
      const lab = document.createElement('div')
      lab.className = 'vk-bits-label'
      lab.textContent = label
      this.replaceChildren(lab, row)
    } else this.replaceChildren(row)
  }

  /** 位串来自 value；`|` 分段（符号 | 指数 | 尾数），段内空格忽略。 */
  _fields() {
    if (this._text == null) this._text = this.textContent || ''
    const raw = String(attrText(this, 'value') || this._text || '')
    return raw
      .split('|')
      .map((f) => [...f.replace(/\s+/g, '')])
      .filter((f) => f.length)
  }
}

export function defineData() {
  define('vk-table', VkTable)
  define('vk-list', VkList)
  define('vk-tree', VkTree)
  define('vk-cells', VkCells)
  define('vk-bytes', VkBytes)
  define('vk-bits', VkBits)
}
