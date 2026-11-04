/**
 * 时间线：一条年份轴，或按步展开的多泳道。
 *
 *   <vk-timeline start="1972" end="2024">
 *     <li date="1972" label="C 诞生">Dennis Ritchie，Bell Labs</li>
 *     <li date="1989" label="C89">ANSI X3.159-1989</li>
 *   </vk-timeline>
 *
 *   <vk-timeline variant="lanes" steps="6" lanes="主线程,中断">
 *     <li lane="主线程" at="0" span="2" label="读 x">x = 1</li>
 *     <li lane="中断" at="2" label="写 x">x = 0</li>
 *   </vk-timeline>
 *
 * 轴模式按日期比例摆点；卡片分上下两层，避免挤在一起。
 * 泳道模式只做静态摆位：at 是 0 起的步号，span 是占几格。
 */
import { VkElement, define, esc } from './base.mjs';
import { SIZE_TIERS } from '../shared/vocab.mjs';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * value 的体量档：一帧放三个数字时，hero（280）会把整页撑到 864+，
 * 所以默认是 title（200）。词表是闭集，构建期也会拦（见 src/highlight.mjs）。
 */
const VALUE_SIZES = new Set(['hero', 'title', 'subhead']);

export class VkTimeline extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-timeline';

  capture() {
    this._items = [...this.querySelectorAll(':scope > li, :scope > i')].map((el) => {
      const state = el.getAttribute('state') || '';
      return {
        date: el.getAttribute('date') || '',
        label: el.getAttribute('label') || '',
        // value / note：数字当主值、说明降一档。和 label / date 共存，
        // 都写时按 value > label、note > 正文 的顺序取，旧写法一个字都不用改。
        value: el.getAttribute('value') || '',
        note: el.getAttribute('note') || '',
        lane: el.getAttribute('lane') || '',
        at: el.getAttribute('at') || '',
        span: el.getAttribute('span') || '',
        tone: el.getAttribute('tone') || '',
        state,
        mark: state === 'mark',
        text: el.textContent.trim(),
      };
    });
  }

  render() {
    const items = this._items || [];
    if (!items.length) {
      delete this.dataset.stepsOverflow;
      this.innerHTML = '<div class="vk-timeline" data-empty>（没有事件）</div>';
      return;
    }
    const variant = this.getAttribute('variant') === 'lanes' ? 'lanes' : 'events';
    const title = this.getAttribute('title') || '';
    const mass = this.getAttribute('mass') || 'normal';
    // 主值的字号：size 只表字号（旧名 value-size 已并进来）；不写 = title（200）。
    const valueSizeRaw = (this.getAttribute('size') || 'title').trim();
    const valueSize = VALUE_SIZES.has(valueSizeRaw) || SIZE_TIERS.includes(valueSizeRaw) ? valueSizeRaw : 'title';
    if (valueSizeRaw !== valueSize) {
      this._warnOnce('size', `的 size="${valueSizeRaw}" 不认识，按 title 画；可用：${SIZE_TIERS.join(' / ')}`);
    }
    // current = 第 N 个事件（1 起）；-1 = 不标。
    const curRaw = parseInt(this.getAttribute('current') ?? '-1', 10);
    const curIdx = Number.isFinite(curRaw) && curRaw >= 1 ? curRaw - 1 : -1;
    if (curIdx >= items.length) {
      this._warnOnce('current', `的 current="${curRaw}" 超过 ${items.length} 个事件，已忽略`);
    }
    // 容器级 current 落成那一条的 state：与 <li state="current"> 是同一条渲染路径。
    for (const [i, it] of items.entries()) if (i === curIdx) it.state = 'current';
    const span = [this.getAttribute('start') || items[0]?.date, this.getAttribute('end') || items[items.length - 1]?.date]
      .filter(Boolean)
      .join('–');
    const head = title
      ? `<header class="vk-tl-hd"><span class="vk-tl-title">${esc(title)}</span><span class="vk-tl-meta" data-meta>${esc(span)}${span ? ' · ' : ''}${items.length} 个节点</span></header>`
      : '';
    const body = variant === 'lanes' ? this._lanes(items) : this._axis(items);
    this.innerHTML = `<div class="vk-timeline" data-variant="${variant}" data-mass="${esc(mass)}" data-value-size="${esc(valueSize)}">${head}${body}</div>`;
  }

  /** 主值 / 说明：value 顶掉 label 的主位，note 顶掉正文的小字位；都没写就保持旧样子。 */
  _parts(it) {
    const main = it.value
      ? `<span class="vk-tl-value">${esc(it.value)}</span>`
      : it.label
        ? `<span class="vk-tl-name">${esc(it.label)}</span>`
        : '';
    const sub = it.note || it.text || (it.value ? it.label : '');
    return {
      main,
      sub: sub ? `<span class="vk-tl-desc${it.note ? ' vk-tl-note' : ''}">${esc(sub)}</span>` : '',
    };
  }

  _axis(items) {
    const sorted = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => (num(a.it.date) ?? 0) - (num(b.it.date) ?? 0));
    const rows = sorted
      .map(({ it }, si) => {
        const { main, sub } = this._parts(it);
        return `<li class="vk-tl-item" data-vk-part="event" data-event="${si}"${it.mark ? ' data-mark' : ''}${it.state ? ' data-state="' + esc(it.state) + '"' : ''}${it.tone ? ` data-tone="${esc(it.tone)}"` : ''}>
          <span class="vk-tl-date" data-meta>${esc(it.date)}</span>
          <span class="vk-tl-dot" aria-hidden="true"></span>
          <span class="vk-tl-body">
            ${main}
            ${sub}
          </span>
        </li>`;
      })
      .join('');

    return `<ol class="vk-tl-events" aria-label="事件">${rows}</ol>`;
  }

  _lanes(items) {
    const declared = (this.getAttribute('lanes') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const lanes = declared.length ? declared : [...new Set(items.map((it) => it.lane).filter(Boolean))];
    if (!lanes.length) lanes.push('lane');
    /**
     * steps 的语义：**声明轴宽**。at 是 0 起的步号，span 是占几格。
     * 条目 at+span 超出 steps 时，不能静默把轴撑大（作者会以为 steps 生效了），
     * 也不能把条目裁掉（少了一步看起来像数据错误）。这里以内容为准把轴放宽，
     * 同时在 DOM 上留 data-steps-overflow 并 warn 一次，让作者二选一改掉。
     */
    const declaredSteps = parseInt(this.getAttribute('steps') || '0', 10) || 0;
    const needOf = (it) =>
      Math.max(0, parseInt(it.at || '0', 10) || 0) + Math.max(1, parseInt(it.span || '1', 10) || 1);
    const requiredSteps = Math.max(0, ...items.map(needOf), 1);
    const stepCount = Math.max(declaredSteps, requiredSteps, 1);
    if (declaredSteps && requiredSteps > declaredSteps) {
      this.dataset.stepsOverflow = String(requiredSteps);
      this._warnOnce(
        'steps',
        `的 steps="${declaredSteps}" 小于条目实际占到的 ${requiredSteps} 步（at+span 越界）：按 ${requiredSteps} 步画。把 steps 改成 ${requiredSteps}，或把 at/span 收进 0–${declaredSteps - 1}`
      );
    } else {
      delete this.dataset.stepsOverflow;
    }
    const head = `<div class="vk-tl-lane-hd" aria-hidden="true"></div><div class="vk-tl-step-hd" aria-hidden="true">${Array.from(
      { length: stepCount },
      (_, i) => `<span data-meta>${i}</span>`
    ).join('')}</div>`;

    const rows = lanes
      .map((lane, li) => {
        const chips = items
          .map((it, i) => ({ it, i }))
          .filter(({ it }) => it.lane === lane)
          .map(({ it, i }) => {
            const at = Math.max(0, Math.min(stepCount - 1, parseInt(it.at || '0', 10) || 0));
            const span = Math.max(1, Math.min(stepCount - at, parseInt(it.span || '1', 10) || 1));
            const { main, sub } = this._parts(it);
            return `<li class="vk-tl-chip" data-vk-part="event" data-event="${i}" data-lane="${esc(lane)}" style="grid-column:${at + 1} / span ${span}"${it.mark ? ' data-mark' : ''}${it.state ? ' data-state="' + esc(it.state) + '"' : ''}${it.tone ? ` data-tone="${esc(it.tone)}"` : ''}>
              ${main}
              ${sub}
            </li>`;
          })
          .join('');
        return `<div class="vk-tl-lane-label" data-vk-part="lane" data-lane="${esc(lane)}">${esc(lane)}</div>
          <div class="vk-tl-track" style="--steps:${stepCount}"><ol class="vk-tl-chips">${chips}</ol></div>`;
      })
      .join('');

    return `<div class="vk-tl-lanes" style="--steps:${stepCount}">${head}${rows}</div>`;
  }
}

export function defineTimeline() {
  define('vk-timeline', VkTimeline);
}
