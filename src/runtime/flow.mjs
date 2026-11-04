/**
 * vk-flow —— 一条多步流程。
 *
 * N 个「标签 + 块」等宽排开，块之间用箭头连接。它不是 vk-pair 的推广：
 * pair 只有两块 + 一条中轴，表达"对照"；flow 有 N 块 + N-1 个连接，表达"经过"
 * ——源码 → gcc → 汇编，三步是它存在的理由。也不是 vk-steps：steps 是"工序到哪了"
 * 的进度地图，flow 是"东西怎么变的"。
 *
 * 几何（CSS 与测试共用这一条）：
 *   · 每块宽 = (容器宽 - (N-1) × gap) / N，全部相等（flex: 1 1 0）；
 *   · gap 既是块与块的间距，也是箭头占的轨道，箭头画在轨道正中；
 *   · 宿主窄于 1100px 时改竖排（箭头朝下），由 place() 量宿主宽度后切换。
 *
 * 子节点顺序就是流程顺序：<li label="…" tone="…">…</li>。
 * 每一步只搬一次节点（移动，不序列化），之后改属性只换壳。
 */
import { VK, numAttr, VkElement, define } from './base.mjs';

/** 每步的底：neutral 是纸灰，其余是语义 wash（与 vk-panel 同一组 token）。 */
const TONES = ['neutral', 'info', 'focus', 'ok', 'warn', 'err'];
/** 低于这个宽度改竖排。1100 是「三块 × 最小可读宽 + 两个 gap」的下限。 */
const NARROW = 1100;
/** arrow="false" 的写法都认：布尔属性按「写了就是开」的规矩来。 */
const OFF = new Set(['false', '0', 'off', 'none', 'no']);

/** 读一步：标签 / 色调 / 内容节点。tone 不认识时记下来，render 里只提醒一次。 */
function readStep(li) {
  const raw = (li.getAttribute('tone') || 'neutral').trim().toLowerCase();
  const known = TONES.includes(raw);
  return {
    label: (li.getAttribute('label') || '').trim(),
    tone: known ? raw : 'neutral',
    badTone: known ? '' : raw,
    nodes: [...li.childNodes],
  };
}

export class VkFlow extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-flow';

  capture() {
    // 渲染后 <li> 已经不在宿主下了（内容搬进了块里），所以只在
    // "还没有条目"或"作者把整棵 .vk-flow 换掉了"时重新取源。
    // 属性变化（gap / arrow）走 render()，不重新取源，节点身份因此保留。
    if (this._items && this.querySelector(':scope > .vk-flow')) return;
    this._items = [...this.querySelectorAll(':scope > li')].map(readStep);
  }

  render() {
    const items = this._items || [];
    if (!items.length) {
      this.replaceChildren();
      this.stale('流程还没有步骤：把每一步写成 <li label="…">…</li> 子节点（空流程不会画出空框）', { build: false });
      return;
    }
    delete this.dataset.vkStale;

    for (const it of items) {
      if (it.badTone) {
        this._warnOnce(
          `tone:${it.badTone}`,
          `的某一步 tone="${it.badTone}" 不认识，按 neutral 处理（可用：${TONES.join(' / ')}）`
        );
      }
    }

    // gap 是唯一的间距来源：块距、箭头轨道宽/高都读它。
    const gap = numAttr(this, 'gap', { min: 8, max: 200, fallback: 48 });
    const rawArrow = this.getAttribute('arrow');
    const arrowOn = rawArrow !== null && !OFF.has(rawArrow.trim().toLowerCase());

    const box = document.createElement('div');
    box.className = 'vk-flow';
    // 方向由 place() 按宿主实际宽度校正；先给横排，免得首帧没有样式可挂。
    box.dataset.orientation = 'horizontal';
    box.style.setProperty('--vk-flow-gap', gap + 'px');

    items.forEach((it, i) => {
      const step = document.createElement('div');
      step.className = 'vk-flow-step';
      step.dataset.step = String(i);
      step.dataset.tone = it.tone;

      if (it.label) {
        const label = document.createElement('span');
        label.className = 'vk-flow-label';
        label.textContent = it.label;
        step.append(label);
      } else {
        this._warnOnce(`label:${i}`, `的第 ${i + 1} 步没有 label：块上方会空着（补 label="…" 即可）`);
      }

      const body = document.createElement('div');
      body.className = 'vk-flow-box';
      for (const n of it.nodes || []) body.append(n);
      step.append(body);
      box.append(step);

      // 最后一步后面不画箭头：连接只存在于两步之间，端点因此可数、等距。
      // 箭头本身是空的 <span>，线和三角都由 CSS 伪元素画（方向跟着 orientation 走）。
      if (i < items.length - 1 && arrowOn) {
        const arrow = document.createElement('span');
        arrow.className = 'vk-flow-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        box.append(arrow);
      }
    });

    this.replaceChildren(box);
    this._box = box;

    // 竖排要按宿主实测宽度决定，登记进 layout 队列。
    this.dataset.vkPlace = '';
    this._watchWidth();
    this._syncOrientation();
    VK._invalidate();
  }

  /** 容器宽度是唯一的输入：宽 → 横排，窄 → 竖排、箭头朝下。 */
  _syncOrientation() {
    const box = this._box;
    if (!box || !box.isConnected) return;
    const w = this.clientWidth;
    if (!w) return;
    const orientation = w < NARROW ? 'vertical' : 'horizontal';
    if (box.dataset.orientation !== orientation) box.dataset.orientation = orientation;
  }

  /** 父级栅格变化 / 窗口缩放都不必等 window resize：量宿主自己。 */
  _watchWidth() {
    if (this._ro || typeof ResizeObserver !== 'function') return;
    this._ro = new ResizeObserver(() => this._syncOrientation());
    this._ro.observe(this);
  }

  place() {
    // 被搬到新父级后 ResizeObserver 已经断了，重连一次再量。
    this._watchWidth();
    this._syncOrientation();
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    this._ro = null;
    super.disconnectedCallback();
  }
}

export function defineFlow() {
  define('vk-flow', VkFlow);
}
