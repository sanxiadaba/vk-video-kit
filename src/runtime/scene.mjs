/**
 * vk-scene —— 五个讲解动作的组合容器。
 *
 * 它不是新标签，也不替作者排页面：一个 kind = 一套默认版式 + 一组命名槽。
 * 作者只填内容，槽位如下：
 *
 *   compare  slot="a" | "b"（可选 "label-a" / "label-b"）
 *   steps    slot="step"（N 个；label 写在节点上，或由 labels="…" 兜底）
 *   locate   slot="where"（地址/坐标） + slot="map"（cells / bytes / img）
 *   measure  slot="value"（大数字） + slot="chart"（bars / table） + slot="ratio"（倍数牌）
 *   cause    slot="a"（现象） + slot="b"（结果） + slot="why"（箭头上的词）
 *
 * 三条硬规矩：
 *   1. 槽节点只搬一次（移动节点，不序列化 HTML），子组件状态不会丢；
 *   2. 默认版式由 CSS 决定，运行期只负责「哪个槽进哪个位置」；
 *   3. cue 分段不做第二套时间：槽上写 cue="1"，视频维度会把
 *      data-vk-cue-state="before|on|after" 落到同一个节点上。
 */

import { VK, VkElement, define } from './base.mjs';
import { parseArrow, toneValue, TONE_HINT } from '../shared/vocab.mjs';

const KINDS = ['compare', 'steps', 'locate', 'measure', 'cause'];
const KIND_SET = new Set(KINDS);
const TONE_KEYS = ['a', 'b', 'why'];

const splitLabels = (raw) =>
  String(raw ?? '')
    .split('|')
    .map((s) => s.trim());

const splitTones = (raw) =>
  String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase());

/** current 的语义与全库一致：1 起；-1 = 没有当前。 */
function readCurrent(el) {
  const raw = el.getAttribute('current');
  if (raw == null || String(raw).trim() === '') return -1;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    el._warnOnce?.('current', `的 current="${raw}" 不是数字，按 -1 处理`);
    return -1;
  }
  return Math.max(-1, Math.min(99, Math.trunc(n)));
}

/** tone 只认六值；不认识的按"不上色"处理，和 vk-pair 同一条规矩。 */
function readTones(el, raw) {
  return splitTones(raw).map((value, i) => {
    if (!value || value === 'none') return '';
    const r = toneValue(value);
    if (r.bad) {
      el._warnOnce?.(`tone:${i}`, `的 tone 里 "${value}" 不认识，按不上色处理（可用：${TONE_HINT}）`);
      return '';
    }
    return r.value;
  });
}

export class VkScene extends VkElement {
  static watchSource = true;
  static renderedRoot = '.vk-scene';

  capture() {
    // 第一次取槽；之后槽节点已经被搬进内部骨架，不能再从宿主直接子节点里读。
    if (this._slots && this.querySelector(':scope > .vk-scene')) return;
    const slots = new Map();
    for (const node of [...this.children]) {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'LINK') continue;
      const slot = (node.getAttribute('slot') || '').trim();
      if (!slot) continue;
      if (!slots.has(slot)) slots.set(slot, []);
      slots.get(slot).push(node);
    }
    this._slots = slots;
  }

  _nodes(slot) {
    return this._slots?.get(slot) || [];
  }

  _first(slot) {
    return this._nodes(slot)[0] || null;
  }

  /** 作者给了 label 槽就用它；否则按 labels="…" 生成一枚 tag 标签。 */
  _label(slot, text, tone) {
    const provided = this._first(slot);
    if (provided) {
      provided.classList?.add('vk-scene-label');
      if (tone && provided.hasAttribute?.('tone') === false) provided.setAttribute('tone', tone);
      return provided;
    }
    if (!text) return null;
    const el = document.createElement('vk-label');
    el.className = 'vk-scene-label';
    el.setAttribute('variant', 'tag');
    if (tone) el.setAttribute('tone', tone);
    el.textContent = text;
    return el;
  }

  _side(slot, labelSlot, text, tone) {
    const wrap = document.createElement('div');
    wrap.className = 'vk-scene-side';
    wrap.dataset.side = slot;
    const label = this._label(labelSlot, text, tone);
    if (label) wrap.append(label);
    const body = document.createElement('div');
    body.className = 'vk-scene-slot';
    for (const node of this._nodes(slot)) body.append(node);
    wrap.append(body);
    return wrap;
  }

  _pair(symbol, gap) {
    const pair = document.createElement('vk-pair');
    pair.className = 'vk-scene-pair';
    pair.setAttribute('split', '50');
    pair.setAttribute('gap', String(gap));
    pair.setAttribute('axis', symbol === 'none' ? 'line' : 'none');
    pair.setAttribute('symbol', symbol);
    return pair;
  }

  _why(text, tone) {
    const provided = this._first('why');
    if (provided) {
      provided.classList?.add('vk-scene-why-label');
      if (tone && provided.hasAttribute?.('tone') === false) provided.setAttribute('tone', tone);
      return provided;
    }
    if (!text) return null;
    const el = document.createElement('vk-label');
    el.className = 'vk-scene-why-label';
    el.setAttribute('variant', 'tag');
    el.setAttribute('tone', tone || 'info');
    el.textContent = text;
    return el;
  }

  _build(kind, { labels, tones, arrow }) {
    // 先把上一次骨架里的槽节点取出来；replaceChildren 会把它们一起删掉。
    for (const nodes of this._slots?.values() || []) for (const node of nodes) node.remove();

    const root = document.createElement('div');
    root.className = 'vk-scene';
    root.dataset.kind = kind;

    if (kind === 'compare') {
      const pair = this._pair('none', 24);
      pair.append(this._side('a', 'label-a', labels[0], tones[0]), this._side('b', 'label-b', labels[1], tones[1]));
      root.append(pair);
      this._pairEl = pair;
      this._whyEl = null;
      this._flowEl = null;
      this._trackEl = null;
    } else if (kind === 'cause') {
      const pair = this._pair('→', 160);
      pair.append(this._side('a', 'label-a', labels[0], tones[0]), this._side('b', 'label-b', labels[1], tones[1]));
      const why = document.createElement('div');
      why.className = 'vk-scene-why';
      const word = this._why(arrow.label, tones[2] || 'info');
      if (word) why.append(word);
      root.append(pair, why);
      this._pairEl = pair;
      this._whyEl = why;
      this._flowEl = null;
      this._trackEl = null;
    } else if (kind === 'steps') {
      const flow = document.createElement('vk-flow');
      flow.className = 'vk-scene-flow';
      flow.setAttribute('gap', '48');
      const stepNodes = this._nodes('step');
      if (!stepNodes.length) {
        this._warnOnce('steps', '的 kind="steps" 没有 slot="step" 子节点：底部进度轨会是空的');
      }
      const names = [];
      stepNodes.forEach((node, i) => {
        const li = document.createElement('li');
        const label = (node.getAttribute('label') || labels[i] || `第 ${i + 1} 步`).trim();
        li.setAttribute('label', label || `第 ${i + 1} 步`);
        const tone = (node.getAttribute('tone') || '').trim();
        if (tone) li.setAttribute('tone', tone);
        li.append(node);
        flow.append(li);
        names.push(label || `第 ${i + 1} 步`);
      });
      const track = document.createElement('vk-steps');
      track.className = 'vk-scene-track-steps';
      for (const name of names) {
        const li = document.createElement('li');
        li.textContent = name;
        track.append(li);
      }
      const trackWrap = document.createElement('div');
      trackWrap.className = 'vk-scene-track';
      trackWrap.append(track);
      root.append(flow, trackWrap);
      this._flowEl = flow;
      this._trackEl = track;
      this._pairEl = null;
      this._whyEl = null;
    } else if (kind === 'locate') {
      const where = document.createElement('div');
      where.className = 'vk-scene-where';
      for (const node of this._nodes('where')) where.append(node);
      const leader = document.createElement('div');
      leader.className = 'vk-scene-leader';
      leader.setAttribute('aria-hidden', 'true');
      const map = document.createElement('div');
      map.className = 'vk-scene-map';
      for (const node of this._nodes('map')) map.append(node);
      root.append(where, leader, map);
      if (!where.childNodes.length) this._warnOnce('where', '的 kind="locate" 没有 slot="where" 子节点：上方会空着');
      this._pairEl = null;
      this._whyEl = null;
      this._flowEl = null;
      this._trackEl = null;
    } else if (kind === 'measure') {
      const main = document.createElement('div');
      main.className = 'vk-scene-main';
      const value = document.createElement('div');
      value.className = 'vk-scene-value';
      for (const node of this._nodes('value')) value.append(node);
      const chart = document.createElement('div');
      chart.className = 'vk-scene-chart';
      for (const node of this._nodes('chart')) chart.append(node);
      main.append(value, chart);
      root.append(main);
      const ratio = this._first('ratio');
      if (ratio) {
        const box = document.createElement('div');
        box.className = 'vk-scene-ratio';
        box.append(ratio);
        root.append(box);
        root.dataset.ratio = '1';
      } else {
        root.dataset.ratio = '0';
      }
      this._pairEl = null;
      this._whyEl = null;
      this._flowEl = null;
      this._trackEl = null;
    }

    this.replaceChildren(root);
    this._root = root;
    this._builtKind = kind;
  }

  render() {
    const rawKind = (this.getAttribute('kind') || 'compare').trim().toLowerCase();
    const kind = KIND_SET.has(rawKind) ? rawKind : 'compare';
    if (!KIND_SET.has(rawKind)) {
      this._warnOnce('kind', `的 kind="${rawKind}" 不认识，按 compare 处理（可用：${KINDS.join(' / ')}）`);
    }

    const current = readCurrent(this);
    const labels = splitLabels(this.getAttribute('labels'));
    const tones = readTones(this, this.getAttribute('tone'));
    const rawArrow = (this.getAttribute('arrow') || '').trim();
    const arrow = parseArrow(rawArrow);

    // 契约与测试读这些镜像属性，不靠猜 DOM。
    this.dataset.kind = kind;
    this.dataset.current = String(current);
    if (labels.some(Boolean)) this.dataset.labels = labels.filter(Boolean).join('|');
    else delete this.dataset.labels;
    if (tones.some(Boolean)) this.dataset.tone = tones.filter(Boolean).join(',');
    else delete this.dataset.tone;
    if (rawArrow) this.dataset.arrow = rawArrow;
    else delete this.dataset.arrow;

    const sig = [kind, labels.join('|'), tones.join(','), rawArrow, arrow.label || ''].join('\u0000');
    if (!this._root || this._sig !== sig) {
      this._build(kind, { labels, tones, arrow });
      this._sig = sig;
    }

    this._apply(kind, current);
    this.dataset.vkPlace = '';
    VK._invalidate();
  }

  _apply(kind, current) {
    this.dataset.kind = kind;
    this.dataset.current = String(current);
    if (kind === 'steps') {
      if (this._trackEl) this._trackEl.setAttribute('current', String(current));
      this._markSteps(current);
    }
  }

  _markSteps(current) {
    const steps = this._flowEl ? [...this._flowEl.querySelectorAll('.vk-flow-step')] : [];
    steps.forEach((step, i) => {
      if (current > 0 && i === current - 1) step.dataset.current = '';
      else delete step.dataset.current;
    });
    if (current > 0 && steps.length && current > steps.length) {
      this._warnOnce('current', `的 current="${current}" 超过 ${steps.length} 步，没有当前步`);
    }
  }

  place() {
    if (this._builtKind === 'steps') this._markSteps(readCurrent(this));
  }
}

export function defineScene() {
  define('vk-scene', VkScene);
}
