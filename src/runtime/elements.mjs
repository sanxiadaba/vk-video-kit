import { VK, esc, numAttr, safePosition, VkElement, define, plain, takeSlot, fillSlot } from './base.mjs';
import { cumulativeScaleX } from './geometry.mjs';
import { formatNumber } from '../shared/format.mjs';
import { iconOf, hasIcon } from './icons.mjs';
import { isSemanticIcon } from '../shared/icons.mjs';

/**
 * vk-icon —— 一个语义符号，不是装饰。
 *
 * 名字必须在 ICON_SEMANTIC 白名单里（✓ / ! / ✗ / 方向）；构建期会拒掉白名单外的名字，
 * 运行期这里只做兜底：不认识时退到 info，并在 dataset 上留痕，审计能查。
 */
export class VkIcon extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-icon';

  onAttr(name) {
    if (name === 'name' || name === 'label') {
      this.querySelector(':scope > .vk-icon[data-vk-inline]')?.remove();
    }
  }

  render() {
    // src 的自定义 SVG 由构建期内联；运行时保留构建产物，不再覆盖。
    if (this.hasAttribute('src')) return;
    const inline = this.querySelector(':scope > .vk-icon[data-vk-inline]');
    if (inline && inline.dataset.vkName === (this.getAttribute('name') || 'info')) return;
    const raw = (this.getAttribute('name') || 'info').trim();
    const known = hasIcon(raw) && isSemanticIcon(raw);
    const body = known ? iconOf(raw) : iconOf('info');
    const label = this.getAttribute('label') || '';

    if (!known) this.dataset.vkUnknown = raw;
    else delete this.dataset.vkUnknown;

    this.innerHTML = `<span class="vk-icon"${label ? ' role="img"' : ' aria-hidden="true"'}${
      label ? ` aria-label="${esc(label)}"` : ''
    }><svg viewBox="0 0 24 24">${body}</svg></span>`;
  }
}

/**
 * vk-img —— 一张图。
 * 只有它有真实的加载失败态：占位不是装饰，是"这里本该有东西"。
 */
export class VkImg extends VkElement {
  static watchSource = true;
  static frame = false;
  static renderedRoot = '.vk-img';

  capture() {}

  render() {
    this.removeAttribute('data-error');
    const src = this.getAttribute('src') || '';
    const alt = this.getAttribute('alt') || '';
    const ratioRaw = this.getAttribute('ratio') || '';
    const ratio = /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(ratioRaw) ? ratioRaw : '';
    if (ratioRaw && !ratio) this._warnOnce('ratio', `的 ratio="${ratioRaw}" 不合法，按图片原比例显示`);
    const fit = this.getAttribute('fit') || 'cover';
    const focus = safePosition(this.getAttribute('position') || '50% 50%');
    const radius = this.getAttribute('radius') || '';

    this.innerHTML = `
      <span class="vk-img"${radius ? ` data-radius="${esc(radius)}"` : ''}${ratio ? ` style="aspect-ratio:${esc(ratio)}"` : ''}>
        ${src ? `<img src="${esc(src)}" alt="${esc(alt)}" style="object-fit:${esc(fit)};object-position:${esc(focus)}" loading="eager">` : ''}
        <span class="vk-img-ph"${alt ? ` role="img" aria-label="${esc(alt)}"` : ' aria-hidden="true"'}>${esc(alt || '图')}</span>
      </span>
    `;

    const img = this.querySelector('img');
    if (img) {
      img.addEventListener('error', () => {
        this.setAttribute('data-error', '');
        this.dispatchEvent(new CustomEvent('vk:img-error'));
      }, { once: true });
      img.addEventListener('load', () => {
        this.removeAttribute('data-error');
        this.dispatchEvent(new CustomEvent('vk:img-load'));
      }, { once: true });
      if (img.complete && img.naturalWidth === 0) {
        this.setAttribute('data-error', '');
        this.dispatchEvent(new CustomEvent('vk:img-error'));
      } else if (img.complete) {
        this.dispatchEvent(new CustomEvent('vk:img-load'));
      }
    } else this.setAttribute('data-error', '');

    // 只有显式 w/h 才写尺寸；移除属性时把之前写的尺寸清掉，不留幽灵几何。
    this._geo = this._geo || new Set();
    for (const [attr, prop] of [['w', 'width'], ['h', 'height']]) {
      if (attr === 'h' && ratio) {
        // ratio 与 h 同时给时，比例是作者更明确的意图，不能让固定 h 把它压死。
        this.style.height = '';
        this._geo.delete('height');
        continue;
      }
      if (this.hasAttribute(attr)) {
        this.style[prop] = numAttr(this, attr, { min: attr === 'h' ? 32 : 48, max: attr === 'h' ? 1080 : 1920, fallback: attr === 'h' ? 32 : 48 }) + 'px';
        this._geo.add(prop);
      } else if (this._geo.has(prop)) {
        this.style[prop] = '';
        this._geo.delete(prop);
      }
    }
    VK._invalidate();
  }
}

/**
 * vk-box —— 一个面。
 * 只有 w/h/x/y 需要 JS：它们是任意数值，CSS 里写不出来。
 * 其余（tone/pad/radius/border）全部走 CSS。
 */
export class VkBox extends VkElement {
  static watchSource = false;

  render() {
    // w/h/x/y 由 Frame 原语统一应用；这里只保留一个空渲染。
  }
}

/**
 * vk-panel —— 一块内容分区。
 *
 * 底色 / 内距 / 圆角 / 描边都由 CSS 从属性算出来；只有 title 需要 JS：
 * 标题带是「有 / 无」一层结构，CSS 长不出来。标题带里放一个 vk-label，
 * 于是它和页面上的其它小标题共用一个原语。
 *
 * 子节点第一次渲染时被搬进 .vk-panel-bd（移动节点，不序列化 HTML），
 * 之后属性变化只更新标题带，不重排内容。
 */
export class VkPanel extends VkElement {
  static watchSource = false;
  static renderedRoot = '.vk-panel-bd';

  render() {
    if (!this._bd) {
      const body = takeSlot(this);
      const bd = document.createElement('div');
      bd.className = 'vk-panel-bd';
      bd.setAttribute('data-vk-part', 'bd');
      this.replaceChildren(bd);
      fillSlot(bd, body);
      this._bd = bd;
    }

    const title = (this.getAttribute('title') || '').trim();
    if (!title) {
      this._hd?.remove();
      this._hd = null;
      this._title = '';
      return;
    }
    if (!this._hd) {
      this._hd = document.createElement('header');
      this._hd.className = 'vk-panel-hd';
      this.insertBefore(this._hd, this._bd);
    }
    if (this._title !== title) {
      this._title = title;
      const label = document.createElement('vk-label');
      label.setAttribute('variant', 'kicker');
      label.textContent = title;
      this._hd.replaceChildren(label);
      this._hd.setAttribute('role', 'heading');
      this._hd.setAttribute('aria-level', '2');
    }
  }
}

/**
 * vk-label —— 一行小字：分类、进度、状态。
 *
 * 它是「标签 / 角标」这一个东西：kicker（纯文字）、chip（浅底）、badge（实色）。
 * 字号与色板全部读 vk-text 使用的同一套 token；不写 tone 时走 ink 墨阶。
 * 图标是可选的：写 icon 才出现图标槽，没写就没有空槽（不留幽灵节点）。
 */
export class VkLabel extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-label';

  render() {
    // 渲染后 textContent 仍是标签文字（图标是 svg，不带字），所以每次都能从 DOM 取回原文。
    const text = (this.textContent || '').replace(/\s+/g, ' ').trim();
    const variant = this.getAttribute('variant') || 'kicker';
    // 工序进度：index/total 是"在整条流程里的位置"，不是页号。
    // index="3" total="5" section="汇编" → 「工序 3/5 · 汇编」。
    const indexRaw = (this.getAttribute('index') || '').trim();
    const totalRaw = (this.getAttribute('total') || '').trim();
    const index = /^\d+$/.test(indexRaw) ? Number(indexRaw) : NaN;
    const total = /^\d+$/.test(totalRaw) ? Number(totalRaw) : NaN;
    const section = (this.getAttribute('section') || '').trim();
    const name = section || text;
    const parts = [];
    if (Number.isFinite(index) && index > 0) {
      // total 写了就带上；index > total 是作者写错（构建期可另加提醒），
      // 但不能静默吞掉 total——契约与读者都该看见"分母写的是什么"。
      parts.push(Number.isFinite(total) && total > 0 ? `工序 ${index}/${total}` : `工序 ${index}`);
    }
    if (name) parts.push(name);
    const labelText = parts.length ? parts.join(' · ') : text;

    // 构建期也会提醒一次；运行时兜住直接改 DOM 的页面。
    if (variant === 'kicker') {
      const probe = name || text;
      if (/\.(?:c|h|s|exe|o|obj|i|txt|md|json|html?|css|m?js|tsx?|py|asm|bin|diff|log|bat|ps1)\b/i.test(probe)) {
        this._warnOnce(
          'kicker-name',
          '的 kicker 文本里出现了文件名（.c / .s / .exe 等）：页眉讲"工序到哪了"，文件名属于内容块'
        );
      }
      if (/第\s*[0-9一二三四五六七八九十]+\s*[页帧]/.test(probe) || /\d+\s*\/\s*\d+\s*[页帧]/.test(probe)) {
        this._warnOnce('kicker-page', '的 kicker 是工序进度，不是页号：不要写"第 N 页 / N 帧"');
      }
    }

    const raw = (this.getAttribute('icon') || '').trim();
    const known = raw ? hasIcon(raw) : false;
    if (raw && !known) this.dataset.vkUnknown = raw;
    else delete this.dataset.vkUnknown;
    // 没写 icon 时不生成 .vk-label-ic：图标槽的存在本身就是作者意图。
    const icon = raw
      ? `<span class="vk-label-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${iconOf(
          known ? raw : 'circle-help'
        )}</svg></span>`
      : '';
    // kicker = 页眉：左边一条 4px 焦点色条。它不占焦点名额（audit 把 label 排除在外）。
    const rule = variant === 'kicker' ? '<span class="vk-label-rule" aria-hidden="true"></span>' : '';
    this.innerHTML = `<span class="vk-label" data-vk-part="label" data-meta>${rule}${icon}<span class="vk-label-t">${esc(
      labelText
    )}</span></span>`;
  }
}

/** 纯文本宿主：内容就是子节点，Frame 只负责 w/measure。 */
export class VkText extends VkElement {
  static watchSource = false;

  render() {
    // 14.0：vk-stat 的"数值写法"搬到这里。排版（标签/单位放哪）归配方，
    // 而"52980 写成 52,980"是文本机制，跟着文字走。
    const format = this.getAttribute('format');
    if (format && format !== 'none') {
      const raw = (this.textContent || '').trim();
      if (raw && !this._formatted) {
        const next = formatNumber(raw, format);
        if (next !== raw) {
          this._formatted = true;
          this.textContent = next;
        }
      }
    }
    // fit="width"：单行文本的"塞满一行"。控件字号仍是作者写的 size；
    // 只有显式 fit 时才由运行期改写 inline font-size。
    const fit = this.getAttribute('fit') === 'width';
    if (fit) {
      this.dataset.vkPlace = '';
      this._fitNow();
    } else {
      delete this.dataset.vkPlace;
      if (this._fitted) {
        this.style.fontSize = '';
        this.style.lineHeight = '';
        this._fitted = false;
      }
    }
  }

  /** 排版一遍后按真实行宽重算；容器变宽 / 字体晚到时也会再进这里。 */
  place() {
    if (this.getAttribute('fit') === 'width') this._fitNow();
  }

  /**
   * 量当前这一行的真实宽度（Range 的 client rect），按比例缩放字号。
   *
   * 只适用于单行等宽文本：CSS 在 vk-text[fit='width'] 上锁了 nowrap，
   * 所以 Range 宽度就是整行宽度。缩放两次：第一次按比例，第二次吸收
   * 字体 hinting / 小数像素的误差；目标与结果差 ≤ 2px。
   *
   * Range / getBoundingClientRect 量到的是祖先 transform 之后的视觉宽，
   * 而 clientWidth 是布局宽。连排页把每帧缩到 0.5 时，直接拿视觉宽除
   * 布局宽会把字号算大一倍；这里把量到的行宽折回布局空间再比。
   */
  _fitNow() {
    if (!this.isConnected) return;
    const target = this.clientWidth;
    if (!target) return;
    const scale = cumulativeScaleX(this) || 1;
    const min = numAttr(this, 'fit-min', { min: 1, max: 400, fallback: 12 });
    const max = numAttr(this, 'fit-max', { min: 1, max: 400, fallback: 240 });
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(this);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      const visual = rects.length ? Math.max(...rects.map((r) => r.width)) : 0;
      return visual / scale;
    };
    const current = parseFloat(getComputedStyle(this).fontSize) || 0;
    const line = measure();
    if (!current || !line) return;
    // fit-max 优先于 fit-min：两个边界写反时以 max 为准，避免出现"最小字号把行撑破"。
    const clamp = (v) => Math.min(max, Math.max(min, v));
    const next = clamp(current * (target / line));
    if (Math.abs(next - current) < 0.01 && this._fitted) return;
    this.style.fontSize = next.toFixed(2) + 'px';
    this.style.lineHeight = '1.1';
    this._fitted = true;

    const line2 = measure();
    if (!line2) return;
    const applied = parseFloat(getComputedStyle(this).fontSize) || next;
    const refined = clamp(applied * (target / line2));
    if (Math.abs(refined - applied) > 0.01) this.style.fontSize = refined.toFixed(2) + 'px';
  }
}

/**
 * 行内文字：code / math / sup / sub / link。
 * 字号跟所在文本行（1em），不写死；math 由构建期把 KaTeX 产物放进 script。
 */
export class VkInline extends VkElement {
  static watchSource = false;
  static frame = false;

  render() {
    const variant = this.getAttribute('variant') || 'code';
    // 键位：`Ctrl + C` 写成两枚键帽。它和行内代码是同一件事（行内小件），
    // 只是长相不同——14.0 把 vk-keys 并进这里，少一个标签。
    if (variant === 'keys') {
      const raw = (this.textContent || '').replace(/\s+/g, ' ').trim();
      if (raw && !this._keysDone) {
        this._keysDone = true;
        const keys = raw
          .split(/\s+\+\s+/)
          .filter(Boolean)
          .map(
            (k, i) =>
              `${i ? '<span class="vk-keyplus" aria-hidden="true" data-meta>+</span>' : ''}<kbd class="vk-key">${esc(k)}</kbd>`
          )
          .join('');
        this.innerHTML = `<span class="vk-keys" role="group" aria-label="${esc(raw)}">${keys}</span>`;
      }
      return;
    }
    if (variant === 'math' && !this._mathDone) {
      const data = this.querySelector(':scope > script[data-vk-math]');
      if (data) {
        this._mathDone = true;
        const html = data.textContent;
        data.remove();
        this.innerHTML = `<span class="vk-inline-math">${html}</span>`;
      } else {
        this.stale('缺少预编译公式');
      }
    }
    if (variant === 'link' && !this._hrefBound) {
      this._hrefBound = true;
      const href = this.getAttribute('href');
      if (href) {
        this.setAttribute('role', 'link');
        this.setAttribute('tabindex', '0');
        this.style.cursor = 'pointer';
        const go = () => {
          const h = this.getAttribute('href');
          if (h) location.href = h;
        };
        this.addEventListener('click', go);
        this.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        });
      }
    }
  }
}

/** 分隔线：Frame 只负责 w；线宽/颜色走 CSS。 */
export class VkRule extends VkElement {
  static watchSource = false;
  render() {}
}

export function defineElements() {
  define('vk-icon', VkIcon);
  define('vk-img', VkImg);
  define('vk-box', VkBox);
  define('vk-text', VkText);
  define('vk-label', VkLabel);
  define('vk-panel', VkPanel);
  define('vk-inline', VkInline);
  define('vk-rule', VkRule);
}
