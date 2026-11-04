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
import { parseArrow } from '../shared/vocab.mjs';

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

    // gap 是块距；箭头实际占的轨道是 --vk-flow-track。
    // 写了 arrow-label 时轨道至少 200px：36px 的词 + 两截线 + 三角都要有位置，
    // 48px 的默认轨道会被词的纸色底完全吃掉，箭头就"消失"了。
    const gap = numAttr(this, 'gap', { min: 8, max: 200, fallback: 48 });
    // 箭头一个词：arrow="false" 关掉；scale:0.12 缩放；label:gcc 挂中轴词。
    const rawArrow = this.getAttribute('arrow');
    const arrowCfg = parseArrow(rawArrow);
    const arrowScale = Number.isFinite(arrowCfg.scale)
      ? Math.min(0.6, Math.max(0.02, arrowCfg.scale))
      : 0.12;
    const arrowLabel = (arrowCfg.label || '').trim();
    // 默认画箭头：只有显式写 arrow="false" / 0 / off / none / no 才关。
    // （旧页面写 arrow / arrow="true" 也照旧；不写 arrow 的现在默认有箭头。）
    const arrowOn = rawArrow === null || !OFF.has(rawArrow.trim().toLowerCase());
    // 契约与自检读这一个标记，不靠猜 CSS。
    this.dataset.arrow = arrowOn ? 'true' : 'false';
    this.dataset.arrowScale = String(arrowScale);

    const box = document.createElement('div');
    box.className = 'vk-flow';
    // 方向由 place() 按宿主实际宽度校正；先给横排，免得首帧没有样式可挂。
    box.dataset.orientation = 'horizontal';
    box.style.setProperty('--vk-flow-gap', gap + 'px');
    box.style.setProperty('--vk-flow-track', (arrowLabel && arrowOn ? Math.max(gap, 200) : gap) + 'px');

    // 「中轴」= 中间那根箭头。两步时是唯一一根；三步时不把同一个词写两遍。
    const arrowCount = Math.max(0, items.length - 1);
    const midArrow = Math.floor(arrowCount / 2);

    items.forEach((it, i) => {
      const step = document.createElement('div');
      step.className = 'vk-flow-step';
      step.dataset.step = String(i);
      step.dataset.tone = it.tone;

      if (it.label) {
        // 步骤标签就是 vk-label 的 tag 档：36px / .08em / 只上色。
        // 用同一个组件而不是复制一份样式，颜色与形态只有一处定义。
        const label = document.createElement('vk-label');
        label.className = 'vk-flow-label';
        label.setAttribute('variant', 'tag');
        if (it.tone === 'neutral') label.setAttribute('ink', 'secondary');
        else label.setAttribute('tone', it.tone);
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
        // 中轴词：纸色底由 vk-label 的 tag 档负责，它把轴线垫断。
        if (i === midArrow && arrowLabel) {
          const word = document.createElement('vk-label');
          word.className = 'vk-flow-arrow-label';
          word.setAttribute('variant', 'tag');
          word.setAttribute('ink', 'secondary');
          word.textContent = arrowLabel;
          arrow.append(word);
        }
        box.append(arrow);
      }
    });

    this.replaceChildren(box);
    this._box = box;

    // 竖排要按宿主实测宽度决定，登记进 layout 队列。
    this.dataset.vkPlace = '';
    this._watchWidth();
    this._syncOrientation();
    this._syncArrow();
    VK._invalidate();
  }

  /** 箭头尺寸 = 容器高 × arrow-scale，夹在 28–64；线宽 = 尺寸 × 0.1（最小 2）。 */
  _syncArrow() {
    const box = this._box;
    if (!box || !box.isConnected) return;
    const h = box.clientHeight || this.clientHeight || 0;
    const cfg = parseArrow(this.getAttribute('arrow'));
    const scale = Number.isFinite(cfg.scale) ? Math.min(0.6, Math.max(0.02, cfg.scale)) : 0.12;
    // 还没布局时先按 28 画：有尺寸就能看见，place() 随后按真实高度校正。
    const size = Math.max(28, Math.min(64, (h || 0) * scale || 28));
    const line = Math.max(2, size * 0.1);
    box.style.setProperty('--vk-flow-arrow-size', size.toFixed(2) + 'px');
    box.style.setProperty('--vk-flow-tip', (size * 0.55).toFixed(2) + 'px');
    box.style.setProperty('--vk-flow-tip-half', (size * 0.3).toFixed(2) + 'px');
    box.style.setProperty('--vk-flow-line-w', line.toFixed(2) + 'px');
    // 契约读它：尺寸是运行期算的，不能只体现在 CSS 变量里。
    this.dataset.arrowSize = String(Math.round(size * 10) / 10);
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
    this._ro = new ResizeObserver(() => {
      this._syncOrientation();
      this._syncArrow();
    });
    this._ro.observe(this);
  }

  place() {
    // 被搬到新父级后 ResizeObserver 已经断了，重连一次再量。
    this._watchWidth();
    this._syncOrientation();
    this._syncArrow();
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
