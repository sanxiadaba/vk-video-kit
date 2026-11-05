import { VK, EDGES, numAttr, VkElement, define, plain, resolveAnchor } from './base.mjs';
import { VkAnnotate } from './annotate.mjs';
import { parseArrow } from '../shared/vocab.mjs';

/* ------------------------------------------------------------------ 摆位 */

export class VkCanvas extends VkElement {
  static watchSource = false;
  static frame = false;

  onAttr(name) {
    if (name === 'grid') this._grid();
  }

  _grid() {
    const g = numAttr(this, 'grid', { min: 0, max: 192, fallback: 0 });
    if (g > 0) {
      this.style.setProperty('--vk-grid', g + 'px');
      this.dataset.grid = '1';
    } else {
      this.removeAttribute('data-grid');
      this.style.removeProperty('--vk-grid');
    }
  }

  render() {
    this._grid();
    this.dataset.vkPlace = '';
    VK._invalidate();
  }

  place() {
    const kids = [...this.children].filter((el) => el.tagName.toLowerCase() !== 'svg');
    if (!kids.length) return;

    const nodes = kids.filter((el) => el.tagName !== 'VK-EDGE' && !el.hasAttribute('data-vk-overlay'));
    const sizes = new Map();
    // 先批量写位置，再批量读尺寸：循环里写读交替会让每个子元素各触发一次强制布局。
    for (const el of nodes) {
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
    }
    for (const el of nodes) sizes.set(el, { w: el.offsetWidth, h: el.offsetHeight });

    const box = { w: 0, h: 0 };
    // 只保留 free：子节点自己声明坐标。
    for (const el of nodes) {
      const s = sizes.get(el);
      const x = numAttr(el, 'x', { min: -1920, max: 1920, fallback: 0 });
      const y = numAttr(el, 'y', { min: -1080, max: 1080, fallback: 0 });
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      box.w = Math.max(box.w, x + s.w);
      box.h = Math.max(box.h, y + s.h);
    }

    // pad：子节点是绝对定位的，padding 不会自动内缩；手动平移，宽度再补回两侧。
    const pad = numAttr(this, 'pad', { min: 0, max: 200, fallback: 0 });
    if (pad) {
      for (const el of nodes) {
        el.style.left = (parseFloat(el.style.left) || 0) + pad + 'px';
        el.style.top = (parseFloat(el.style.top) || 0) + pad + 'px';
      }
    }
    this.style.padding = '0';

    const hasW = this.hasAttribute('w');
    const hasH = this.hasAttribute('h');
    const wAttr = hasW ? numAttr(this, 'w', { min: 48, max: 1920, fallback: 0 }) : 0;
    const hAttr = hasH ? numAttr(this, 'h', { min: 48, max: 1080, fallback: 0 }) : 0;
    const contentW = Math.max(48, Math.ceil(box.w) + pad * 2);
    const contentH = Math.max(48, Math.ceil(box.h) + pad * 2);
    this.style.width = (hasW ? wAttr : contentW) + 'px';
    this.style.height = (hasH ? hAttr : contentH) + 'px';
    this.style.minWidth = hasW ? wAttr + 'px' : '';

    // 连线由 base.layout 在全部画布摆完后统一画；这里不重复画。
  }
}

/* ---------------------------------------------------------------- 网格 */
export class VkGrid extends VkElement {
  static watchSource = false;

  render() {
    // 两条路：cols="1..6" 是等分份数（求解器可判定）；tracks 是真轨道（fr / auto，禁 px）。
    const tracks = (this.getAttribute('tracks') || '').trim();
    if (tracks) {
      this.style.gridTemplateColumns = tracks;
      return;
    }
    // 分份只认 1–6：离散份数是求解器可判定的前提，任意 track list 会在构建期被拦。
    if (this.style.gridTemplateColumns) this.style.gridTemplateColumns = '';
  }
}

/* ---------------------------------------------------------------- 竖排 */

/**
 * vk-stack：默认等距。写 weights（或它的别名 ratio）时按权重分「剩余高度」。
 *
 *   <vk-stack grow weights="1 2 1">
 *     <vk-stack>上</vk-stack>   ← 1 份
 *     <vk-stack>中</vk-stack>   ← 2 份
 *     <vk-stack>下</vk-stack>   ← 1 份
 *     <vk-box h="96"></vk-box>  ← 不在列表里：保持 96，剩余给上面三份
 *   </vk-stack>
 *
 * 权重列表按顺序对应直接子项；列表之外的孩子保持内容高。
 * weights 只给"分高度"，不给"分宽度"——横排里没有剩余高度的概念。
 * 容器必须有确定高度（grow / fill / h）；自动高的 stack 里 flex-basis: 0
 * 会把孩子压成 0，所以这里宁可不做，也不悄悄改坏一张页。
 */
export class VkStack extends VkElement {
  static watchSource = false;

  onAttr(name) {
    if (name === 'weights' || name === 'grow' || name === 'stretch' || name === 'h') {
      this._weights();
    }
  }

  render() {
    this._weights();
  }

  _weights() {
    const raw = (this.getAttribute('weights') || '').trim();
    const list = raw ? raw.split(/[\s,]+/).filter(Boolean).map(Number) : [];
    const bounded = this.hasAttribute('grow') || this.hasAttribute('stretch') || this.hasAttribute('h');
    const usable = bounded && list.length > 0 && list.every((n) => Number.isFinite(n) && n > 0);

    // 先撤掉上一次的分配：属性被删掉 / 改成非法值时页面要回到等距。
    for (const el of this.children) {
      if (!el.hasAttribute('data-vk-weight')) continue;
      el.removeAttribute('data-vk-weight');
      el.style.removeProperty('--vk-stack-weight');
    }
    // 权重写在横排上没有意义：这里是"分高度"，横排没有可分的剩余高度。
    if (raw && this.getAttribute('direction') === 'row') {
      this._warnOnce('weights-row', '写成横排（direction="row"）时 weights 不生效：它分的是高度');
      return;
    }
    if (!usable) {
      if (raw && !bounded) {
        this._warnOnce('weights-h', '写了 weights，但容器没有确定高度（grow / stretch / h）：按内容高排，不分配');
      }
      return;
    }
    const kids = [...this.children].filter((el) => !el.hasAttribute('data-vk-overlay'));
    kids.forEach((el, i) => {
      const weight = list[i];
      if (weight == null) return;
      el.setAttribute('data-vk-weight', '');
      el.style.setProperty('--vk-stack-weight', String(weight));
    });
  }
}

/* ---------------------------------------------------------------- 叠层 */

/**
 * vk-layer —— 叠放容器。
 *
 * 子元素全部绝对定位铺满这一层，DOM 顺序就是叠放顺序（第一个铺底）。
 * 它不排内容、不搬节点；文字的可读性保护由 CSS 按 readable 属性决定。
 */
export class VkLayer extends VkElement {
  static watchSource = false;

  render() {
    this.dataset.vkLayer = '';
    VK._invalidate();
  }
}

/* ---------------------------------------------------------------- 注册 */

export function defineLayout() {
  define('vk-canvas', VkCanvas);
  define('vk-layer', VkLayer);
  // L2 流：纯 CSS + Frame；每个标签一个独立构造器（customElements 不允许复用同一构造器）
  const flow = () => class extends VkElement {
    static watchSource = false;
    render() {}
  };
  define('vk-stack', VkStack);
  define('vk-grid', VkGrid);
}
