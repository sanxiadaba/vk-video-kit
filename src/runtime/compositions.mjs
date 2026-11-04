import { VkElement, define, takeSlot, fillSlot } from './base.mjs';

/* ------------------------------------------------------------------- page */

/** 三套内置主题。名字与 src/tokens/themes.css 的 [data-theme] 一一对应。 */
const THEMES = new Set(['paper', 'graphite', 'blueprint']);

/**
 * 一页 1080p 的画布工具：固定 1920×1080，按容器宽度等比缩放。
 */
export class VkPage extends VkElement {
  static watchSource = true;
  static frame = false;
  static slot = true;
  static slotHost = '.vk-page-bd';
  static renderedRoot = '.vk-page';

  render() {
    const w = 1920;
    const h = 1080;
    const rawAlign = this.getAttribute('align');
    const align = rawAlign === 'center' || rawAlign === 'bottom' ? rawAlign : 'top';

    // 主题：只换颜色，不改尺寸。写在宿主上的 data-theme 让整棵子树读同一套
    // --vk-theme-*；不写 theme 就继承外层（body / html）的主题。
    // 无效值由构建期拦（registry 的枚举），运行期退回"不写"。
    const rawTheme = (this.getAttribute('theme') || '').trim();
    if (THEMES.has(rawTheme)) this.dataset.theme = rawTheme;
    else if (this.dataset.theme) delete this.dataset.theme;

    if (!this._shell) {
      const body = takeSlot(this);
      // 视频维度的数据脚本（data-vk-cues / data-vk-states）不是正文：
      // 先留住它们，等画布外壳搭好再挂回宿主，否则 innerHTML 会把它们一起清掉。
      this._videoScripts = [...this.children].filter((n) => n.tagName === 'SCRIPT');
      // 出血层：只收旧写法（写 bleed 不带值）——它表示"铺满整帧的背景层"。
      // 新写法 bleed="x|y|all|none" 是通用负 margin，留在正文流里由 CSS 处理。
      const oldBleed = (n) => n.nodeType === 1 && n.hasAttribute('bleed') && !String(n.getAttribute('bleed') || '').trim();
      const bleed = body.filter(oldBleed);
      const rest = body.filter((n) => !bleed.includes(n));
      // 坐标系根：只有 1920×1080 与安全区。全库只有白纸一种材质。
      this.innerHTML = `<div class="vk-page" data-align="top" style="--pw:${w}px;--ph:${h}px">
        <div class="vk-page-bleed" aria-hidden="true"></div>
        <div class="vk-page-inner"><div class="vk-page-bd" data-vk-part="bd"></div></div>
      </div>`;
      this._shell = this.querySelector('.vk-page');
      this._bd = this.querySelector('.vk-page-bd');
      this._bleed = this.querySelector('.vk-page-bleed');
      for (const script of this._videoScripts) this.appendChild(script);
      fillSlot(this._bleed, bleed);
      fillSlot(this._bd, rest);
      this.dataset.vkPlace = '';
    }

    this._shell.dataset.align = align;
    this._syncVideo();
    this._apply();
  }

  /**
   * 视频维度属性先镜像成 data-*：契约读到的是「改了就变」，
   * 作者样式也能用 [data-state] / [data-transition] 选中当前页。
   */
  _syncVideo() {
    const set = (attr, key, fallback) => {
      const raw = this.getAttribute(attr);
      const value = raw == null || raw === '' ? fallback : raw;
      if (value == null || value === '') delete this.dataset[key];
      else this.dataset[key] = value;
    };
    set('cues', 'cues');
    set('states', 'states');
    set('transition', 'transition', 'cut');
    set('focus-duration', 'focusDuration', '200');
    set('focus-transition', 'focusTransition', 'on');
    const duration = Number(this.getAttribute('focus-duration'));
    this.style.setProperty('--vk-focus-ms', `${Number.isFinite(duration) && duration >= 0 ? duration : 200}ms`);
  }

  onAttr(name, value) {
    if (['cues', 'states', 'transition', 'focus-duration', 'focus-transition'].includes(name)) {
      this._syncVideo();
      // 运行期的 cues / states 变化需要重新读轨道；告诉字幕控制器一次。
      if (this.isConnected) {
        this.dispatchEvent(new CustomEvent('vk:page-video', { bubbles: true, detail: { name, value } }));
      }
    }
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._watch();
  }

  _watch() {
    if (this._ro || typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => this._apply());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    this._ro?.disconnect();
    this._ro = null;
  }

  place() {
    this._apply();
  }

  _apply() {
    const inner = this._shell || this.querySelector('.vk-page');
    if (!inner) return;
    // 不缩放：出片尺寸就是设计尺寸，缩放属于预览器（vk shot）而不是组件。
    inner.style.width = '1920px';
    inner.style.height = '1080px';
    inner.style.transform = '';
    if (this.style.height !== '1080px') this.style.height = '1080px';
  }
}

export function defineCompositions() {
  define('vk-page', VkPage);
}
