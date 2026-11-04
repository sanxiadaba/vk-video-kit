import { VK, esc, numAttr, safePosition, resolveTarget, EDGES, VkElement, define, plain, takeSlot, fillSlot } from './base.mjs';
import { cumulativeScaleX } from './geometry.mjs';
import { formatNumber } from '../shared/format.mjs';
import { iconOf, hasIcon } from './icons.mjs';
import { isSemanticIcon } from '../shared/icons.mjs';

/**
 * vk-icon —— 旧名，转发到 vk-text。
 *
 * 图标本质是一个字形：<vk-text icon="check"> 里文字与图标共存。
 * 旧标签只画图标（读 name），DOM / CSS / 尺寸档保持原样，所以旧页逐像素不动。
 * 构建期会给一条"已合并到 vk-text，旧名保留"的迁移提示。
 */

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
    // fill=cover|contain 是新的显式铺满写法；不写时沿用旧的 fit（默认 cover）。
    const fill = this.getAttribute('fill');
    const fit = fill === 'cover' || fill === 'contain' ? fill : this.getAttribute('fit') || 'cover';
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
 * 其余（tone/pad/radius/border/ring）全部走 CSS。
 *
 * ring 是 14.x 减法第一波并进来的"圈选"：一圈不占布局的描边（box-shadow），
 * 环色跟 tone；它只强调这一块，不改尺寸、不改位置。
 */
export class VkBox extends VkElement {
  static watchSource = false;

  render() {
    // w/h/x/y 由 Frame 原语统一应用；这里只保留一个空渲染。
    this.dataset.vkBox = '';
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

  /** chrome：dots = 三点窗头（原 vk-window 的 min / browser）；none = 干净的分区。 */
  _chrome() {
    const raw = (this.getAttribute('chrome') || 'none').trim();
    return raw === 'dots' ? 'dots' : 'none';
  }

  _dots() {
    const dots = document.createElement('span');
    dots.className = 'vk-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i><i></i><i></i>';
    return dots;
  }

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

    const chrome = this._chrome();
    this.dataset.chrome = chrome;
    const title = (this.getAttribute('title') || '').trim();
    // 窗头不是标题的附属物：chrome="dots" 时，没有标题也有一条三点栏（窗的形状）。
    if (!title && chrome === 'none') {
      this._hd?.remove();
      this._hd = null;
      this._dotsEl = null;
      this._title = '';
      return;
    }
    if (!this._hd) {
      this._hd = document.createElement('header');
      this._hd.className = 'vk-panel-hd';
      this.insertBefore(this._hd, this._bd);
    }
    if (chrome === 'dots') {
      if (!this._dotsEl) {
        this._dotsEl = this._dots();
        this._hd.prepend(this._dotsEl);
      }
    } else if (this._dotsEl) {
      this._dotsEl.remove();
      this._dotsEl = null;
    }
    if (this._title !== title) {
      this._title = title;
      const label = document.createElement('vk-label');
      label.setAttribute('variant', 'kicker');
      label.textContent = title;
      const keep = this._dotsEl;
      this._hd.replaceChildren(...(keep ? [keep] : []), label);
      this._hd.setAttribute('role', 'heading');
      this._hd.setAttribute('aria-level', '2');
    }
  }
}

/* ------------------------------------------------ 归属说明的几何（原 caption） */

/** 说明与目标盒之间的净空。 */
const CAPTION_GAP = 16;
/** 净空地板：再近，标签的墨迹就贴到目标正文上了（12 是"还看得出是一条缝"的下限）。 */
const MIN_CAPTION_GAP = 12;

/** 覆盖层只认一个坐标系：最近的定位祖先（没有就退回 body）。 */
function captionHostOf(el) {
  let host = el.parentElement;
  while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
  if (!host) host = document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  return host;
}

/** 目标块里第一个「真正要读的字」的位置；跳过行号、窗头、无障碍文本。 */
function firstCharRect(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const parent = n.parentElement;
    if (!parent) continue;
    if (parent.closest('[data-meta], .vk-ln, .vk-sr, .vk-hd, .vk-ft, [aria-hidden="true"]')) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (rects.length) return rects[0];
  }
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    left: r.left + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0),
    top: r.top + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0),
  };
}

/**
 * vk-label —— 一行小字：分类、进度、状态；写 for 就贴到目标块上。
 *
 * 它是「标签 / 角标」这一个东西：kicker（纯文字）、chip（浅底）、badge（实色）。
 * 字号与色板全部读 vk-text 使用的同一套 token；不写 tone 时走 ink 墨阶。
 * 图标是可选的：写 icon 才出现图标槽，没写就没有空槽（不留幽灵节点）。
 *
 * 减法第一波：原 vk-caption 并进来。写 for 时它不再占正文布局，
 * 而是像 caption 一样贴在目标块上方（anchor="above"，默认）或下方，
 * 左边界对齐目标块的首字符——位置由目标决定，不靠作者摆像素。
 */
export class VkLabel extends VkElement {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-label';

  /** 写了 for 才是覆盖层（原 vk-caption）。 */
  _anchored() {
    return !!String(this.getAttribute('for') || '').trim();
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this._anchored()) {
      this.dataset.vkOverlay = '';
      EDGES.add(this);
    }
  }

  render() {
    if (this._anchored()) {
      this._renderAnchored();
      return;
    }
    // 从"贴块"改回"块里"：把覆盖层的状态收干净。
    EDGES.delete(this);
    delete this.dataset.vkOverlay;
    // for / anchor 在块里的标签上只是作者的写法镜像（不生效，但契约要能读到"改了"）。
    this.dataset.for = this.getAttribute('for') || '';
    this.dataset.anchor = this.getAttribute('anchor') || '';
    this.dataset.gap = String(numAttr(this, 'gap-px', { min: MIN_CAPTION_GAP, max: 240, fallback: CAPTION_GAP }));
    this.style.zIndex = '';
    this._span = null;

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

    // kicker = 页眉：左边一条 4px 焦点色条。它不占焦点名额（audit 把 label 排除在外）。
    const rule = variant === 'kicker' ? '<span class="vk-label-rule" aria-hidden="true"></span>' : '';
    this.innerHTML = `<span class="vk-label" data-vk-part="label" data-meta>${rule}${this._iconMarkup()}<span class="vk-label-t">${esc(
      labelText
    )}</span></span>`;
  }

  /** 图标槽：只在写了 icon 时生成（图标槽的存在本身就是作者意图）。 */
  _iconMarkup() {
    const raw = (this.getAttribute('icon') || '').trim();
    const known = raw ? hasIcon(raw) : false;
    if (raw && !known) this.dataset.vkUnknown = raw;
    else delete this.dataset.vkUnknown;
    return raw
      ? `<span class="vk-label-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${iconOf(
          known ? raw : 'circle-help'
        )}</svg></span>`
      : '';
  }

  _renderAnchored() {
    const anchor = this.getAttribute('anchor') === 'below' ? 'below' : 'above';
    this.dataset.anchor = anchor;
    this.dataset.for = this.getAttribute('for') || '';
    this.dataset.vkOverlay = '';
    // 先把作者文字读出来，再换壳：先换壳会把文字一起扔进新 span 之前就读空了。
    const text = (this.textContent || '').replace(/\s+/g, ' ').trim();
    const span = this._span || document.createElement('span');
    span.className = 'vk-label vk-caption';
    span.setAttribute('data-vk-part', 'label');
    if (!this._span) {
      this.replaceChildren(span);
      this._span = span;
    }
    span.innerHTML = `${this._iconMarkup()}<span class="vk-label-t">${esc(text)}</span>`;
    this.style.zIndex = '50';
    EDGES.add(this);
    VK._invalidate();
  }

  /** 贴块：位置由目标块决定；目标找不到时只警告一次并藏起来。 */
  draw() {
    if (!this._anchored() || !this.isConnected) return;
    const span = this._span;
    if (!span) return;
    const expr = this.getAttribute('for') || '';
    const target = expr ? resolveTarget(document, expr, this) : null;
    if (!target) {
      span.style.visibility = 'hidden';
      if (expr) this._warnOnce(`for:${expr}`, `的 for="${expr}" 找不到目标块`);
      return;
    }
    const host = captionHostOf(this);
    const hr = host.getBoundingClientRect();
    if (hr.width < 1 || hr.height < 1) {
      span.style.visibility = 'hidden';
      return;
    }
    const tr = target.getBoundingClientRect();
    if (tr.width < 1 || tr.height < 1) {
      span.style.visibility = 'hidden';
      return;
    }
    const cr = firstCharRect(target);
    const box = span.getBoundingClientRect();
    const above = this.getAttribute('anchor') !== 'below';
    // 净空可配（gap-px），但不会小于 12：标签与目标正文必须留出一条缝。
    const gap = numAttr(this, 'gap-px', { min: MIN_CAPTION_GAP, max: 240, fallback: CAPTION_GAP });
    this.dataset.gap = String(gap);
    // 左边界对齐目标首字符；1px 内距在 span 内部（纸色底比字宽 2px，字仍对着首字符）。
    const left = cr.left - hr.left;
    const top = above ? tr.top - hr.top - box.height - gap : tr.bottom - hr.top + gap;
    span.style.left = left.toFixed(2) + 'px';
    span.style.top = top.toFixed(2) + 'px';
    span.style.visibility = 'visible';
  }
}

/**
 * vk-icon 的旧实现搬进 vk-text 之后，这两个标签共用同一段图标内联：
 * 图标就是一个字形（1em，跟着字走），不是另一个标签。
 *
 * 旧 vk-icon 是它的子类：只画图标（读 name），新 vk-text 读 icon，文字与图标共存。
 */
export class VkText extends VkElement {
  static watchSource = false;

  /** 图标名：新标签读 icon；旧 vk-icon 在子类里改读 name。 */
  _iconName() {
    return (this.getAttribute('icon') || '').trim();
  }

  /** 能不能画：新标签只要有这个 Lucide 名；白名单由构建期把门（旧标签在子类里收紧）。 */
  _iconAllowed(name) {
    return hasIcon(name);
  }

  /** 无障碍名：新标签里图标是文字的补充，默认 aria-hidden；旧 vk-icon 用 label。 */
  _iconLabel() {
    return '';
  }

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
    this._renderIcon();
    // fit="width"：单行文本的"塞满一行"。控件字号仍是作者写的 size；
    // 只有显式 fit 时才由运行期改写 inline font-size。
    const fit = this.getAttribute('fit') === 'width';
    if (fit) {
      this.dataset.vkPlace = '';
      this._fitNow();
    } else {
      delete this.dataset.vkPlace;
      delete this.dataset.fitOverflow;
      delete this.dataset.fitMin;
      delete this.dataset.fitMax;
      if (this._fitted) {
        this.style.fontSize = '';
        this.style.lineHeight = '';
        this._fitted = false;
      }
    }
  }

  /** 图标槽：只在写了图标时存在；换名字只换这一个 span，不重建文字。 */
  _renderIcon() {
    const prev = this.querySelector(':scope > .vk-text-ic');
    const raw = this._iconName();
    if (!raw) {
      prev?.remove();
      delete this.dataset.icon;
      return;
    }
    const known = this._iconAllowed(raw);
    if (known) delete this.dataset.vkUnknownIcon;
    else this.dataset.vkUnknownIcon = raw;
    this.dataset.icon = raw;
    const label = this._iconLabel();
    const span = document.createElement('span');
    span.className = 'vk-icon vk-text-ic';
    if (label) {
      span.setAttribute('role', 'img');
      span.setAttribute('aria-label', label);
    } else span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24">${iconOf(known ? raw : 'info')}</svg>`;
    if (prev) prev.replaceWith(span);
    else this.insertBefore(span, this.firstChild);
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
    // fit-min 是硬地板：默认 40，容器再窄也不往下缩；放不下就报出来。
    const min = numAttr(this, 'fit-min', { min: 1, max: 400, fallback: 40 });
    const max = numAttr(this, 'fit-max', { min: 1, max: 400, fallback: 240 });
    // 契约读这两个边界（尺寸是运行期算的，不能只看声明）。
    this.dataset.fitMin = String(min);
    this.dataset.fitMax = String(max);
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
    // 顺序是 min → max：fit-min 是硬地板，两个边界写反时也不许把字压到地板以下。
    const clamp = (v) => Math.max(min, Math.min(max, v));
    const next = clamp(current * (target / line));
    this.style.fontSize = next.toFixed(2) + 'px';
    this.style.lineHeight = '1.1';
    this._fitted = true;

    const line2 = measure();
    if (line2) {
      const applied = parseFloat(getComputedStyle(this).fontSize) || next;
      const refined = clamp(applied * (target / line2));
      if (Math.abs(refined - applied) > 0.01) this.style.fontSize = refined.toFixed(2) + 'px';
    }

    // 到了地板仍然塞不下：不再缩字，给宿主一个可被检查/样式化的标记，
    // 并提醒改版面（减少并列块或换竖排），而不是让字默默糊成一团。
    const line3 = measure();
    if (line3 > target + 1.5) {
      this.dataset.fitOverflow = '';
      this._warnOnce('fit-overflow', 'fit="width" 放不下：容器太窄，建议减少并列块或换竖排');
    } else {
      delete this.dataset.fitOverflow;
    }
  }
}

/**
 * vk-icon —— 旧名，转发到 vk-text（同一个字形，只画图标）。
 *
 * 它只覆盖三件事：图标名读 name、白名单收在语义图标上、label 是无障碍名。
 * 其余（图标内联、尺寸档、颜色）与 <vk-text icon="…"> 共用一份实现。
 * 构建期会给一条"已合并到 vk-text，旧名保留"的迁移提示。
 */
export class VkIcon extends VkText {
  static watchSource = false;
  static frame = false;
  static renderedRoot = '.vk-icon';

  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkAlias = 'vk-text';
  }

  _iconName() {
    return (this.getAttribute('name') || 'info').trim();
  }

  _iconAllowed(name) {
    return hasIcon(name) && isSemanticIcon(name);
  }

  _iconLabel() {
    return this.getAttribute('label') || '';
  }

  onAttr(name) {
    if (name === 'name' || name === 'label') {
      this.querySelector(':scope > .vk-icon[data-vk-inline]')?.remove();
    }
  }

  render() {
    // src 的自定义 SVG 由构建期内联；运行时保留构建产物，不再覆盖。
    if (this.hasAttribute('src')) return;
    const inline = this.querySelector(':scope > .vk-icon[data-vk-inline]');
    if (inline && inline.dataset.vkName === this._iconName()) return;
    // 旧名不认识时退到 info，并在 dataset 上留痕（构建期已经提醒过一次）。
    this.dataset.vkUnknown = this._iconAllowed(this._iconName()) ? undefined : this._iconName();
    if (this.dataset.vkUnknown === undefined) delete this.dataset.vkUnknown;
    super.render();
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

/** 分隔线：旧名，转发到 vk-box。Frame 只负责 w；线是一块 1px 高的面。 */
export class VkRule extends VkBox {
  static watchSource = false;

  connectedCallback() {
    super.connectedCallback?.();
    this.dataset.vkAlias = 'vk-box';
  }

  render() {
    // 线的颜色 / 虚线 / 线宽仍由 vk-rule 的既有 CSS 给出；
    // 这里只声明它是"一块面"，以及它就是 vk-box 的旧名。
    this.dataset.vkBox = '';
    this.dataset.vkRule = this.getAttribute('variant') || 'thin';
  }
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
