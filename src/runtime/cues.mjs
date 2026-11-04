/**
 * L6 · 视频维度（video）：字幕驱动 / 焦点跟随 / 同页多态 / 页间转场。
 *
 * 它与 director 的分工：
 *   director  负责「元素怎么入场」：at / enter / dur / stagger → 内联 transform / opacity；
 *   cues      负责「讲到哪一件、这一页是哪一个状态、从哪一页来」：
 *               cue 轨道 → data-focus / data-state / data-vk-cue-state。
 *
 * 三条硬规矩：
 *   1. seek(t) 仍然只取决于 t：同一条轨道、同一个 t，得到同一组 DOM 属性。
 *   2. 所有"降墨 / 出现"都走统一属性（data-focus、data-vk-cue-state），
 *      不往组件内部写第二套状态。
 *   3. 没有 cue 的页面完全不受影响：不设 focus、不切 state、不加动画。
 */
import { VK, nextFrame } from './base.mjs';
import { cuePhase, formatClock, parseCueJson, parseCueRef, parseCueSource } from '../shared/cues.mjs';

const STATE_ANIM_MS = 200;
const FOCUS_DEFAULT_MS = 200;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'META']);

const num = (value, fallback) => {
  if (value == null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const warn = (key, message, el) => {
  const guard = (el._vkCueWarned ||= new Set());
  if (guard.has(key)) return;
  guard.add(key);
  console.warn(`[vk] ${message}`, el || '');
};

const shellOf = (host) => host.querySelector?.('.vk-page') || (host.matches?.('.vk-page') ? host : null);
const bodyOf = (host) => host.querySelector?.('.vk-page-bd') || shellOf(host) || host;

/** 焦点单元里的"杂物"：脚本、样式、出血层、页面骨架本身都不该被降墨。 */
function focusSkipped(el) {
  if (!el || el.nodeType !== 1) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  // 页眉 / 页脚 / 控制条 / 状态块：作者显式声明"不参加焦点降墨"。
  if (el.hasAttribute?.('data-focus-keep') || el.hasAttribute?.('data-vk-keep')) return true;
  if (el.classList?.contains('vk-page-bleed')) return true;
  if (el.classList?.contains('vk-page-inner') || el.classList?.contains('vk-page-bd')) return true;
  return false;
}

class CueController {
  constructor() {
    this.pages = [];
    this.active = 0;
    this.cursor = 0;
    this.playing = false;
    this.raf = 0;
    this.wallStart = 0;
    this.baseAt = 0;
    this.ready = false;
    this.initPromise = null;
    this.focusSel = '';
    this.focusNodes = new Set();
    this.focusAnims = [];
    this.stateName = '';
    this.stateRecords = [];
    this.activeCue = null;
    this.currentCue = null;
    this.page = null;
    this.lastPageCue = '';
    this.anims = [];
  }

  /** 发现页面并读入字幕轨 / 状态表。重复调用只做一次（VK.reloadCues 可以重来）。 */
  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  async _init() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    await nextFrame();

    const hosts = [...document.querySelectorAll('vk-page')];
    if (hosts.length) {
      this.pages = hosts.map((host) => this._pageInfo(host));
    } else {
      // 纯 CSS 页（没有 vk-page 自定义元素）：也让它能接字幕，但只把它当一页。
      const shell = document.querySelector('.vk-page');
      this.pages = shell ? [this._pageInfo(shell, { synthetic: true })] : [];
    }
    // 先把所有页的字幕读进来；页面之间互不等待（一页坏不拖垮另一页）。
    await Promise.all(this.pages.map((info) => this._loadPage(info)));
    this.page = this.pages[this.active] || null;
    this.ready = true;
    if (this.page && this.page.track.length) this.applyAt(this.cursor);
  }

  _pageInfo(host, { synthetic = false } = {}) {
    const shell = synthetic ? host : shellOf(host);
    return {
      host,
      shell: shell || host,
      body: bodyOf(host),
      synthetic,
      track: [],
      states: {},
      stateNames: (host.getAttribute?.('states') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      loaded: false,
      loading: null,
    };
  }

  async _loadPage(info) {
    if (info.loading) return info.loading;
    info.loading = (async () => {
      this._readStates(info);
      const source = await this._readCues(info);
      info.track = source || [];
      info.loaded = true;
      // 页面可能在轨道回来之前就被 seek 过了：用当前光标补一次。
      if (info === (this.pages[this.active] || null)) this.applyAt(this.cursor);
    })();
    return info.loading;
  }

  _readStates(info) {
    const script = info.host.querySelector?.('script[data-vk-states]');
    if (script) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data && typeof data === 'object' && !Array.isArray(data)) info.states = data;
        else warn('states-json', '<vk-page> 的 states 数据必须是对象：{ "a": { "#id": {...} } }', info.host);
      } catch (e) {
        warn('states-json', `<vk-page> 的 states JSON 解析失败：${e.message}`, info.host);
      }
    }
    // states="a,b,c" 只声明名字；真正的属性组在 <script data-vk-states> 里。
    for (const name of info.stateNames) {
      if (!info.states[name]) info.states[name] = {};
    }
  }

  async _readCues(info) {
    const attr = (info.host.getAttribute?.('cues') || '').trim();
    if (attr) {
      // 允许直接把 JSON 写进属性，省掉一次 fetch（小示例 / 测试更方便）。
      if (/^[[{]/.test(attr)) {
        try {
          return parseCueJson(attr);
        } catch (e) {
          warn('cues-inline', `cues 内联 JSON 解析失败：${e.message}`, info.host);
          return [];
        }
      }
      try {
        const url = new URL(attr, document.baseURI).href;
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => ctrl?.abort(), 8000);
        let resp;
        try {
          resp = await fetch(url, { signal: ctrl?.signal });
        } finally {
          clearTimeout(timer);
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const isJson = attr.split(/[?#]/)[0].toLowerCase().endsWith('.json');
        return parseCueSource(text, isJson ? 'json' : '');
      } catch (e) {
        warn('cues-fetch', `读取字幕 ${attr} 失败：${e.message}`, info.host);
        return [];
      }
    }

    const script = info.host.querySelector?.('script[data-vk-cues]');
    if (!script) return [];
    const format = script.getAttribute('data-format') || (script.type === 'application/json' ? 'json' : '');
    try {
      return parseCueSource(script.textContent || '', format);
    } catch (e) {
      warn('cues-script', `内联字幕解析失败：${e.message}`, info.host);
      return [];
    }
  }

  activeInfo() {
    return this.pages[this.active] || null;
  }

  activeTrack() {
    return this.activeInfo()?.track || [];
  }

  /** 轨道按当前时间求值：字幕、焦点、状态、cue 元素的 before/on/after。 */
  applyAt(t) {
    const time = Math.max(0, Number(t) || 0);
    this.cursor = time;
    if (!this.ready) {
      this.init().then(() => this.applyAt(this.cursor));
      return null;
    }
    const info = this.activeInfo();
    if (!info) return null;
    const track = info.track || [];

    // 字幕 = 正在播的那一条；焦点 / 状态 = 最近开始的那一条（间隙里保持，不闪回）。
    const active = track.find((cue) => time >= cue.start && time < cue.end) || null;
    let current = null;
    for (const cue of track) if (time >= cue.start) current = cue;
    this.activeCue = active;
    this.currentCue = current;

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.vkAt = String(time);
      if (active) root.dataset.vkCue = String(active.index);
      else delete root.dataset.vkCue;
      if (current?.state) root.dataset.vkState = current.state;
      else delete root.dataset.vkState;
    }

    // 页内 cue 元素：逐件出现 / 当前高亮。只认轨道，不另写一套时间。
    for (const el of info.body.querySelectorAll?.('[cue]') || []) {
      const ref = parseCueRef(el.getAttribute('cue'));
      const phase = ref ? cuePhase(ref, track, time) : null;
      if (!phase) {
        if (el.dataset.vkCueState) delete el.dataset.vkCueState;
        continue;
      }
      if (el.dataset.vkCueState !== phase) el.dataset.vkCueState = phase;
    }

    this.setFocus(current?.focus || '');
    this.setState(current?.state || '');

    // 字幕文本槽：作者写 <div data-vk-cue-text>，这里只换文字。
    const text = active?.text || '';
    for (const el of info.host.querySelectorAll?.('[data-vk-cue-text]') || []) {
      if (el.textContent !== text) el.textContent = text;
    }
    for (const el of info.host.querySelectorAll?.('[data-vk-cue-time]') || []) {
      const value = `${formatClock(time)} / ${formatClock(this.duration())}`;
      if (el.textContent !== value) el.textContent = value;
    }

    // cue 的 page 字段：讲到某条时翻到另一页。single-page 文档里是 no-op。
    if (current?.page != null && current.page !== this.lastPageCue) {
      this.lastPageCue = current.page;
      const index = Number(current.page);
      if (Number.isInteger(index) && index >= 1 && index <= this.pages.length) {
        this.goto(index - 1);
      }
    }
    if (!current?.page) this.lastPageCue = '';

    if (active) info.host.setAttribute('data-vk-active-cue', String(active.index));
    else info.host.removeAttribute('data-vk-active-cue');

    return {
      cue: active ? { ...active } : null,
      current: current ? { ...current } : null,
      focus: current?.focus || '',
      state: current?.state || '',
    };
  }

  /**
   * 焦点跟随：只把「目标所在层级上、不含目标的兄弟」降墨。
   * 这样既不会把目标的祖先一起压暗，也不会把整页当成一个块。
   *
   * 过渡用 Web Animations 显式跑 200ms（CSS 只负责最终值）：
   * 这样 seek 到任意时刻都能被 getAnimations() 读到，录屏端不用猜。
   */
  setFocus(selector) {
    const wanted = String(selector || '');
    const info = this.activeInfo();
    if (!info) return;
    if (wanted === this.focusSel) return;

    const host = info.host;
    const shell = info.shell || host;
    const duration = num(host.getAttribute?.('focus-duration'), FOCUS_DEFAULT_MS);
    const transitionOff = ['none', 'off'].includes((host.getAttribute?.('focus-transition') || 'on').toLowerCase());
    shell.style?.setProperty('--vk-focus-ms', `${Math.max(0, duration)}ms`);
    // 镜像值保持与作者写的一致（默认 on）：CSS 只认 on / off，none 是旧写法。
    host.setAttribute('data-focus-transition', transitionOff ? 'off' : 'on');

    const planned = new Map();
    let target = null;
    if (wanted) {
      try {
        target = info.body.querySelector(wanted) || (info.body.matches?.(wanted) ? info.body : null);
      } catch {
        warn('focus-selector', `focus="${wanted}" 不是有效选择器`, host);
      }
      if (!target) {
        warn(`focus:${wanted}`, `focus="${wanted}" 在本页找不到`, host);
      }
    }

    if (target) {
      host.setAttribute('data-focus-target', wanted);
      const stop = info.body;
      let node = target;
      while (node && node !== stop) {
        const parent = node.parentElement;
        if (!parent) break;
        for (const sibling of parent.children) {
          if (sibling === node || focusSkipped(sibling)) continue;
          planned.set(sibling, 'off');
        }
        node = parent;
      }
      planned.set(target, 'on');
    } else {
      host.removeAttribute('data-focus-target');
    }

    // 先记下"变之前"的 filter，再清旧标记；否则 off→off 的元素会从 none 闪一下。
    const before = new Map();
    const snapshot = (el) => {
      if (before.has(el)) return;
      before.set(el, getComputedStyle(el).filter || 'none');
    };
    for (const el of this.focusNodes) snapshot(el);
    for (const el of planned.keys()) snapshot(el);

    for (const anim of this.focusAnims || []) {
      try {
        anim.cancel();
      } catch {
        /* 已结束 */
      }
    }
    this.focusAnims = [];
    for (const el of this.focusNodes) el.removeAttribute('data-focus');
    this.focusNodes.clear();
    this.focusSel = wanted;

    for (const [el, state] of planned) {
      el.setAttribute('data-focus', state);
      this.focusNodes.add(el);
    }

    if (!duration || transitionOff) return;
    for (const [el, state] of planned) {
      const to = state === 'off' ? 'saturate(0.45) opacity(0.35)' : 'none';
      const from = before.get(el) || 'none';
      if (from.trim() === to) continue;
      const anim = el.animate([{ filter: from }, { filter: to }], {
        duration,
        easing: 'ease',
        fill: 'both',
      });
      this.focusAnims.push(anim);
      // 动画结束后把动画层撤掉：最终值由 data-focus 的 CSS 接着管，避免留下填充层。
      anim.finished.then(() => anim.cancel()).catch(() => {});
    }
  }

  /** 同页多态：一态一组 DOM 属性 / 内联样式；离开这一态时原样还回去。 */
  setState(name) {
    const info = this.activeInfo();
    if (!info) return;
    const wanted = String(name || '');
    if (wanted === this.stateName) return;

    // 还原上一态：属性与内联样式都回到作者写的样子。
    for (const record of this.stateRecords) {
      for (const [attr, value] of record.attrs) {
        if (value == null) record.el.removeAttribute(attr);
        else record.el.setAttribute(attr, value);
      }
      for (const [prop, value] of record.styles) {
        if (value == null) record.el.style.removeProperty(prop);
        else record.el.style.setProperty(prop, value, record.priorities.get(prop) || '');
      }
      record.el.removeAttribute('data-vk-state');
    }
    this.stateRecords = [];
    this.stateName = wanted;

    const host = info.host;
    if (!wanted) {
      host.removeAttribute('data-state');
      return;
    }
    if (info.stateNames.length && !info.stateNames.includes(wanted)) {
      warn(`state:${wanted}`, `states="${info.stateNames.join(',')}" 里没有 "${wanted}"，仍按数据切`, host);
    }
    host.setAttribute('data-state', wanted);
    shellOf(host)?.setAttribute('data-state', wanted);

    const state = info.states[wanted] || {};
    for (const [selector, rule] of Object.entries(state)) {
      let nodes = [];
      try {
        nodes = [...(info.body.querySelectorAll(selector) || [])];
        if (info.body.matches?.(selector)) nodes.push(info.body);
      } catch {
        warn(`state:${selector}`, `states 里的选择器 "${selector}" 不合法`, host);
        continue;
      }
      if (!nodes.length) {
        warn(`state:${selector}`, `states["${wanted}"] 的选择器 "${selector}" 找不到元素`, host);
        continue;
      }
      for (const el of nodes) {
        const record = { el, attrs: new Map(), styles: new Map(), priorities: new Map() };
        for (const [attr, value] of Object.entries(rule.attrs || {})) {
          record.attrs.set(attr, el.getAttribute(attr));
          if (value === false || value == null) el.removeAttribute(attr);
          else el.setAttribute(attr, value === true ? '' : String(value));
        }
        for (const [prop, value] of Object.entries(rule.style || {})) {
          record.styles.set(prop, el.style.getPropertyValue(prop) || null);
          record.priorities.set(prop, el.style.getPropertyPriority(prop));
          el.style.setProperty(prop, String(value));
        }
        // 只有真的有可动画属性时才好挂 transition，避免给所有元素留下无用的动画层。
        if (record.styles.size) el.setAttribute('data-vk-state', '');
        this.stateRecords.push(record);
      }
    }

    // 切态的整体过渡：整页 200ms 的轻微淡入；几何与属性变化本身仍是瞬时的。
    const shell = shellOf(host);
    if (shell && typeof shell.animate === 'function') {
      for (const anim of this.anims) {
        try {
          anim.cancel();
        } catch {
          /* 已经结束 */
        }
      }
      this.anims = [];
      const anim = shell.animate([{ opacity: 0.86 }, { opacity: 1 }], {
        duration: STATE_ANIM_MS,
        easing: 'ease-out',
      });
      this.anims.push(anim);
    }
  }

  /** 页间转场：cut（默认）/ fade / push。 */
  async goto(index, kind) {
    await this.init();
    if (!this.pages.length) return false;
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= this.pages.length) return false;
    const fromIndex = this.active;
    const from = this.pages[fromIndex];
    const to = this.pages[nextIndex];
    if (nextIndex === fromIndex && !to.host.hidden) return true;

    const transition = String(kind || to.host.getAttribute?.('transition') || 'cut').toLowerCase();
    this.active = nextIndex;
    this.focusSel = '';
    for (const anim of this.focusAnims || []) {
      try {
        anim.cancel();
      } catch {
        /* 已结束 */
      }
    }
    this.focusAnims = [];
    for (const el of this.focusNodes) el.removeAttribute('data-focus');
    this.focusNodes.clear();

    const clean = () => {
      for (const page of this.pages) {
        if (page !== to) page.host.hidden = true;
        page.host.removeAttribute('data-vk-transition');
      }
      to.host.hidden = false;
      for (const anim of this.anims) {
        try {
          anim.cancel();
        } catch {
          /* 已经结束 */
        }
      }
      this.anims = [];
    };

    if (transition === 'cut' || !from || nextIndex === fromIndex) {
      clean();
      this.applyAt(this.cursor);
      return true;
    }

    for (const page of this.pages) {
      if (page !== from && page !== to) page.host.hidden = true;
    }
    from.host.hidden = false;
    to.host.hidden = false;
    from.host.setAttribute('data-vk-transition', transition);
    to.host.setAttribute('data-vk-transition', transition);

    let outgoing;
    let incoming;
    if (transition === 'push') {
      outgoing = from.host.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], {
        duration: 260,
        easing: 'cubic-bezier(.4,0,.2,1)',
        fill: 'forwards',
      });
      incoming = to.host.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], {
        duration: 260,
        easing: 'cubic-bezier(.4,0,.2,1)',
        fill: 'forwards',
      });
    } else {
      outgoing = from.host.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 220,
        easing: 'ease',
        fill: 'forwards',
      });
      incoming = to.host.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 220,
        easing: 'ease',
        fill: 'forwards',
      });
    }
    this.anims = [outgoing, incoming];
    try {
      await Promise.all([outgoing.finished, incoming.finished]);
    } catch {
      /* 被新的转场打断 */
    }
    clean();
    this.applyAt(this.cursor);
    return true;
  }

  duration() {
    const track = this.activeTrack();
    let end = track.length ? Math.max(...track.map((cue) => cue.end)) : 0;
    if (!end) end = num(this.activeInfo()?.host.getAttribute?.('dur'), 0);
    return end;
  }

  async play(options = {}) {
    await this.init();
    if (this.playing) return VK;
    const total = this.duration();
    if (!(total > 0)) return VK;
    const from = options.from != null ? Math.max(0, Number(options.from) || 0) : this.cursor;
    const rate = Number(options.rate) > 0 ? Number(options.rate) : 1;
    this.baseAt = from >= total ? 0 : from;
    this.wallStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.playing = true;
    this.seekTo(this.baseAt);
    const tick = (now) => {
      if (!this.playing) return;
      const t = this.baseAt + ((now - this.wallStart) / 1000) * rate;
      if (t >= total) {
        this.seekTo(total);
        this.pause();
        return;
      }
      this.seekTo(t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    return VK;
  }

  pause() {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    return VK;
  }

  /** 公开 seek：播放中手动 seek 要把时钟基准一起挪过去。 */
  seekTo(t) {
    const time = Math.max(0, Number(t) || 0);
    this.cursor = time;
    const director = this.directorSeek || (() => ({}));
    const result = director(time) || {};
    const applied = this.applyAt(time);
    return { ...result, ...(applied || {}) };
  }

  seek(t) {
    const time = Math.max(0, Number(t) || 0);
    if (this.playing) {
      this.baseAt = time;
      this.wallStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    return this.seekTo(time);
  }

  /** 重新读页面（cues / states 属性被改过时用）。 */
  async reload() {
    this.initPromise = null;
    this.ready = false;
    this.pages = [];
    this.stateRecords = [];
    for (const anim of this.focusAnims || []) {
      try {
        anim.cancel();
      } catch {
        /* 已结束 */
      }
    }
    this.focusAnims = [];
    this.focusNodes = new Set();
    this.focusSel = '';
    this.stateName = '';
    await this.init();
    this.applyAt(this.cursor);
  }

  list() {
    return this.activeTrack().map((cue) => ({ ...cue }));
  }

  cueAt(t = this.cursor) {
    return this.activeTrack().find((cue) => t >= cue.start && t < cue.end) || null;
  }
}

export function installCues(VKApi = VK) {
  if (VKApi._cues) return VKApi._cues;
  const controller = new CueController();
  VKApi._cues = controller;

  // 把 director 的 seek 包起来：先求值出场，再求值字幕驱动。两者互不改对方的属性。
  controller.directorSeek = VKApi.seek;
  VKApi.seek = (t) => controller.seek(t);

  const baseReady = VKApi.ready;
  VKApi.ready = async () => {
    const ok = await baseReady();
    await controller.init();
    return ok;
  };

  VKApi.play = (options) => controller.play(options);
  VKApi.pause = () => controller.pause();
  VKApi.time = () => controller.cursor;
  VKApi.duration = () => controller.duration();
  VKApi.cues = () => controller.list();
  VKApi.cue = () => controller.cueAt();
  VKApi.activeCue = () => controller.activeCue;
  VKApi.focus = (selector) => {
    controller.setFocus(selector || '');
    return selector || '';
  };
  VKApi.state = (name) => {
    if (name !== undefined) controller.setState(name || '');
    return controller.stateName;
  };
  VKApi.goto = (index, kind) => controller.goto(index, kind);
  VKApi.reloadCues = () => controller.reload();
  Object.defineProperty(VKApi, 'playing', {
    get: () => controller.playing,
    configurable: true,
  });

  // 页面属性在运行期被改（cues / states）：组件会发这条事件，我们重读一次。
  if (typeof document !== 'undefined') {
    document.addEventListener('vk:page-video', () => {
      controller.reload();
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => controller.init(), { once: true });
    } else {
      controller.init();
    }
  }
  return controller;
}
