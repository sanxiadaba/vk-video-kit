/**
 * 时间线：一条年份轴，或按步展开的多泳道。
 *
 *   <vk-timeline start="1972" end="2024">
 *     <i date="1972" label="C 诞生">Dennis Ritchie，Bell Labs</i>
 *     <i date="1989" label="C89">ANSI X3.159-1989</i>
 *   </vk-timeline>
 *
 *   <vk-timeline variant="lanes" steps="6" lanes="主线程,中断">
 *     <i lane="主线程" at="0" span="2" label="读 x">x = 1</i>
 *     <i lane="中断" at="2" label="写 x">x = 0</i>
 *   </vk-timeline>
 *
 * 轴模式按日期比例摆点；卡片分上下两层，避免挤在一起。
 * 泳道模式只做静态摆位：at 是 0 起的步号，span 是占几格。
 */
import { VkElement, define, esc } from './base.mjs';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export class VkTimeline extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-timeline';

  capture() {
    this._items = [...this.querySelectorAll(':scope > i')].map((el) => ({
      date: el.getAttribute('date') || '',
      label: el.getAttribute('label') || '',
      lane: el.getAttribute('lane') || '',
      at: el.getAttribute('at') || '',
      span: el.getAttribute('span') || '',
      tone: el.getAttribute('tone') || '',
      mark: el.hasAttribute('mark'),
      text: el.textContent.trim(),
    }));
  }

  render() {
    const items = this._items || [];
    if (!items.length) {
      this.innerHTML = '<div class="vk-timeline" data-empty>（没有事件）</div>';
      return;
    }
    const variant = this.getAttribute('variant') === 'lanes' ? 'lanes' : 'events';
    const title = this.getAttribute('title') || '';
    const density = this.getAttribute('density') || 'normal';
    const span = [this.getAttribute('start') || items[0]?.date, this.getAttribute('end') || items[items.length - 1]?.date]
      .filter(Boolean)
      .join('–');
    const head = title
      ? `<header class="vk-tl-hd"><span class="vk-tl-title">${esc(title)}</span><span class="vk-tl-meta" data-meta>${esc(span)}${span ? ' · ' : ''}${items.length} 个节点</span></header>`
      : '';
    const body = variant === 'lanes' ? this._lanes(items) : this._axis(items);
    this.innerHTML = `<div class="vk-timeline" data-variant="${variant}" data-density="${esc(density)}">${head}${body}</div>`;
  }

  _axis(items) {
    const sorted = items
      .map((it, i) => ({ it, i }))
      .sort((a, b) => (num(a.it.date) ?? 0) - (num(b.it.date) ?? 0));
    const rows = sorted
      .map(
        ({ it }, si) => `<li class="vk-tl-item" data-vk-part="event" data-event="${si}"${it.mark ? ' data-mark' : ''}${it.tone ? ` data-tone="${esc(it.tone)}"` : ''}>
          <span class="vk-tl-date" data-meta>${esc(it.date)}</span>
          <span class="vk-tl-dot" aria-hidden="true"></span>
          <span class="vk-tl-body">
            ${it.label ? `<span class="vk-tl-name">${esc(it.label)}</span>` : ''}
            ${it.text ? `<span class="vk-tl-desc">${esc(it.text)}</span>` : ''}
          </span>
        </li>`
      )
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
    const stepCount = Math.max(
      parseInt(this.getAttribute('steps') || '0', 10) || 0,
      ...items.map((it) => (parseInt(it.at || '0', 10) || 0) + (parseInt(it.span || '1', 10) || 1)),
      1
    );
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
            return `<li class="vk-tl-chip" data-vk-part="event" data-event="${i}" data-lane="${esc(lane)}" style="grid-column:${at + 1} / span ${span}"${it.mark ? ' data-mark' : ''}${it.tone ? ` data-tone="${esc(it.tone)}"` : ''}>
              ${it.label ? `<span class="vk-tl-name">${esc(it.label)}</span>` : ''}
              ${it.text ? `<span class="vk-tl-desc">${esc(it.text)}</span>` : ''}
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
