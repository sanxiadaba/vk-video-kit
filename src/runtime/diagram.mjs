/* ============================================================================
   v17 · 图（L4）
   ----------------------------------------------------------------------------
   四件：步骤 / 条 / 时间线 / 对照。共同的前提只有一条：
   作者写 <li>，运行期把它排成图 —— 所以每件都只做「读子项 → 生成 DOM」。

   规矩：
     · 属性一律走 base 的 attr*（默认值从 schema 来）；子项属性从 schema 的
       children.attrs 取，不在这里另抄一份。
     · render 只写 DOM，不量；要量的放 place()。render 里读 offsetWidth 会强制
       同步布局，一帧里几十个组件就是几十次。
     · 每次 render 重建（innerHTML = …）：属性变了就重画，不重复 append。
     · 文本与属性一律 esc()。
     · 时间线是等距的，不按年份比例 —— 这里没有任何位置计算。

   CSS 缺口（components.css 还没有这些规则，运行期用 inline 补，值全取 token；
   补 CSS 时把这些 inline 摘掉即可）：
     · .vk-step-conn —— CSS 只有两条空的 ::after 占位规则，没有真的连接线
     · vk-steps 的 .vk-step 横排只在 [direction='vertical'] 下成立，
       [data-direction='vertical'] 这条路漏了这条（运行期补）
     · .vk-tl-start / .vk-tl-end
     · .vk-lane / .vk-lane-row / .vk-lane-name（泳道整块没有规则）
     · .vk-compare-pane img 没写 object-fit（这里补 contain：不裁、不拉伸）
     · .vk-compare-label 在 split 下没法逐 pane 放：两个 pane 叠着，
       角标共处一行（左「改前」右「改后」）。
   ========================================================================== */

import { VkElement, define, attrText, attrNum, attrIndex, attrEnum, attrRaw, esc, warn, takeSlot, VK } from './base.mjs';
import { TAGS } from '../schema.mjs';

/* ------------------------------------------------------------------ 共同 */

/** 作者写的 <li>。schema 说子项就是 li；别的一律不认，也不静默吞掉。 */
function items(host) {
  const out = [];
  let stray = null;
  for (const n of takeSlot(host)) {
    if (n.nodeType !== 1) continue;
    if (n.localName === 'li') out.push(n);
    else stray ||= n.localName;
  }
  if (stray) warn(host, `子项只认 <li>：<${stray}> 被忽略`);
  if (!out.length) warn(host, '没有 <li> 子项');
  return out;
}

/** 子项属性（tone / state / value / date / label / note / lane）：schema 是唯一来源。 */
function itemAttr(host, node, name) {
  const spec = TAGS[host.localName]?.children?.attrs?.[name];
  const v = attrRaw(node, name);
  // 没写就是没有：不搬默认值。CSS 的 var(--vk-tone, …) 兜底比一个假 neutral 准。
  if (v == null) return '';
  if (spec?.values && !spec.values.includes(v)) {
    warn(host, `<li> 的 ${name}="${v}" 不在词表里（${spec.values.join(' / ')}），按 ${spec.default} 处理`);
    return spec?.default ?? '';
  }
  return v;
}

/** <li> 的正文：空白收成一个空格。 */
const itemText = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();

/** 千分位。运行期不背构建期的 shared/format.mjs。 */
const thousands = (n) => n.toLocaleString('en-US');

/** 字号：schema 的 fontsize 是「档名或像素」。 */
const fontCss = (raw) => (/^\d+(?:\.\d+)?$/.test(raw) ? `${raw}px` : `var(--vk-fs-${raw})`);

/** 两位补零：01 02 … */
const pad2 = (n) => String(n).padStart(2, '0');

/** 百分数：留两位，别把 33.33333% 写进 style。 */
const pct = (n) => Math.round(n * 100) / 100;

/**
 * 父容器的可用宽度（去掉内距）。
 * 量父容器而不是自己：自己窄的时候正是「该竖排」的时候，量自己会自己骗自己。
 */
function availWidth(el) {
  const box = el.parentElement;
  if (!box) return el.clientWidth;
  const cs = getComputedStyle(box);
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  return Math.max(0, box.clientWidth - pad);
}

/* ================================================================== 步骤 */

/** 一步的舒适宽度。少于「步数 × 它」就竖排，宁可长高，不把字挤成一列。 */
const STEP_MIN = 220;

export class VkSteps extends VkElement {
  render() {
    const lis = items(this);
    if (!lis.length) {
      this.innerHTML = '';
      return;
    }
    const current = attrIndex(this, 'current'); // 1 起；-1 = 不标
    const connector = attrEnum(this, 'connector', 'arrow');
    const size = attrEnum(this, 'size', 'body');
    const cur = current >= 1 && current <= lis.length ? current : -1;
    if (current !== -1 && cur === -1) warn(this, `current="${current}" 超出 1…${lis.length}，按不标处理`);

    this.dataset.connector = connector;

    const parts = [];
    lis.forEach((node, i) => {
      const tone = itemAttr(this, node, 'tone');
      const attr = [
        `data-vk-step="${i}"`,
        tone ? `tone="${esc(tone)}"` : '',
        cur === i + 1 ? 'state="current"' : '',
        cur > 0 && i + 1 < cur ? 'data-done' : '',
      ]
        .filter(Boolean)
        .join(' ');
      parts.push(
        `<div class="vk-step" ${attr}>` +
          `<span class="vk-step-n">${esc(pad2(i + 1))}</span>` +
          `<span class="vk-step-t"${size === 'body' ? '' : ` style="font-size:${fontCss(size)}"`}>${esc(itemText(node))}</span>` +
          `</div>`
      );
      // 连接线是兄弟节点，不进 .vk-step：压不到字。
      if (connector !== 'none' && i < lis.length - 1) {
        parts.push(`<span class="vk-step-conn" aria-hidden="true"><i></i>${connector === 'arrow' ? '<b></b>' : ''}</span>`);
      }
    });
    this.innerHTML = parts.join('');

    // 方向只有「写的」和「上次量出来的」两种来源；auto 等 place()。
    const written = attrEnum(this, 'direction', 'auto');
    this._applyDirection(written === 'auto' ? this._dir || 'horizontal' : written);
  }

  /** 方向一变，横排/竖排的几何全变。这里只改 style，不重建 DOM。 */
  _applyDirection(dir) {
    this._dir = dir;
    const vertical = dir === 'vertical';
    this.dataset.direction = dir;
    this.style.setProperty('--vk-step-gap', vertical ? 'var(--vk-gap-close)' : 'var(--vk-gap-wide)');

    // CSS 只在 [direction='vertical'] 下把 .vk-step 改成横排；data-direction 缺这条。
    for (const step of this.querySelectorAll('.vk-step')) {
      if (vertical) {
        step.style.flexDirection = 'row';
        step.style.alignItems = 'center';
        step.style.flex = '0 0 auto';
      } else {
        step.style.removeProperty('flex-direction');
        step.style.removeProperty('align-items');
        step.style.removeProperty('flex');
      }
    }

    for (const conn of this.querySelectorAll('.vk-step-conn')) {
      const line = conn.querySelector('i');
      const head = conn.querySelector('b');
      if (vertical) {
        // 一段 24px 竖线，落在编号章的轴线上。
        conn.style.cssText =
          'display:flex;flex:0 0 auto;align-self:flex-start;' +
          'margin-left:calc(var(--vk-step-badge-x, 0px) - var(--vk-line-rule) / 2);height:24px';
        if (line) {
          line.style.cssText =
            'display:block;width:var(--vk-line-rule);height:24px;border-radius:var(--vk-radius-pill);background:var(--vk-line-strong)';
        }
        if (head) head.style.cssText = 'display:none';
      } else {
        // 一条带右箭头的横线：flex: 1 撑开，上限是一步的间距。
        // height 定成线宽：箭头（12px 高）以线为中心溢出，不会把线顶偏。
        conn.style.cssText =
          'display:flex;align-items:center;flex:1 1 0;min-width:24px;max-width:var(--vk-step-gap);' +
          'align-self:flex-start;height:var(--vk-line-rule);' +
          'margin-top:calc(var(--vk-step-badge-y, 0px) - var(--vk-line-rule) / 2)';
        if (line) {
          line.style.cssText =
            'flex:1 1 auto;min-width:8px;height:var(--vk-line-rule);border-radius:var(--vk-radius-pill);background:var(--vk-line-strong)';
        }
        if (head) {
          head.style.cssText =
            'width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:8px solid var(--vk-line-strong)';
        }
      }
    }
  }

  /** 量：够不够横排；编号章的中心在哪（连接线要对齐它）。 */
  place() {
    const steps = this.querySelectorAll('.vk-step');
    if (!steps.length) return;
    const want = steps.length * STEP_MIN;
    const avail = availWidth(this);
    const written = attrEnum(this, 'direction', 'auto');

    const dir = written === 'auto' ? (avail >= want ? 'horizontal' : 'vertical') : written;
    if (dir !== this._dir) this._applyDirection(dir);
    if (written === 'horizontal' && avail < want) {
      warn(this, `horizontal 要约 ${want}px，容器只有 ${Math.round(avail)}px；写 direction="auto" 让它自己竖排`);
    }
    this._measureBadge();
  }

  /** 编号章相对宿主的中心。用 offset*（布局像素）而不是 rect：舞台可能被缩放。 */
  _measureBadge() {
    const badge = this.querySelector('.vk-step-n');
    if (!badge) return;
    const parent = badge.offsetParent;
    if (parent !== this && parent !== this.offsetParent) return; // 不在同一坐标系，量不了就别量
    const inner = parent === this;
    const x = badge.offsetLeft - (inner ? 0 : this.offsetLeft) + badge.offsetWidth / 2;
    const y = badge.offsetTop - (inner ? 0 : this.offsetTop) + badge.offsetHeight / 2;
    this.style.setProperty('--vk-step-badge-x', `${Math.round(x)}px`);
    this.style.setProperty('--vk-step-badge-y', `${Math.round(y)}px`);
  }
}

/* ==================================================================== 条 */

/** 条的长度：linear 按比例，log 按 log10；可见的最小宽度 2%（0 不画）。 */
function barPct(value, max, scale) {
  if (value == null || !(max > 0) || value <= 0) return 0;
  const raw = scale === 'log' ? Math.log10(value + 1) / Math.log10(max + 1) : value / max;
  return pct(Math.min(100, Math.max(2, raw * 100)));
}

export class VkBars extends VkElement {
  render() {
    const lis = items(this);
    if (!lis.length) {
      this.innerHTML = '';
      return;
    }
    const scale = attrEnum(this, 'scale', 'linear');
    const unit = attrText(this, 'unit');
    const fixed = this.hasAttribute('max') ? attrNum(this, 'max') : 0;

    const rows = lis.map((node, i) => {
      const raw = attrRaw(node, 'value');
      const num = raw == null ? null : Number(raw.replace(/,/g, ''));
      if (raw == null) warn(this, `第 ${i + 1} 条没有 value`);
      else if (!Number.isFinite(num)) warn(this, `第 ${i + 1} 条的 value="${raw}" 不是数字`);
      const value = Number.isFinite(num) ? num : null;
      return {
        i,
        label: itemAttr(this, node, 'label') || itemText(node),
        tone: itemAttr(this, node, 'tone'),
        state: itemAttr(this, node, 'state'),
        value,
      };
    });

    const positive = rows.map((r) => r.value).filter((v) => v != null && v > 0);
    const max = fixed > 0 ? fixed : positive.length ? Math.max(...positive) : 1;

    this.innerHTML = rows
      .map((r) => {
        const attr = [
          `data-vk-bar="${r.i}"`,
          r.tone ? `tone="${esc(r.tone)}"` : '',
          r.state ? `state="${esc(r.state)}"` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const text = r.value == null ? '—' : `${thousands(r.value)}${unit ? ` ${esc(unit)}` : ''}`;
        return (
          `<div class="vk-bar" ${attr}>` +
          `<span class="vk-bar-l">${esc(r.label)}</span>` +
          `<span class="vk-bar-track"><i style="width:${barPct(r.value, max, scale)}%"></i></span>` +
          `<span class="vk-bar-v">${text}</span>` +
          `</div>`
        );
      })
      .join('');

    this._cols = '';
  }

  /**
   * 量：把标签列与值列钉成同一组宽度。
   * CSS 让每个 .vk-bar 各自成 grid（minmax(6em, auto) 1fr auto），
   * 标签与值的字数一差，每行的 1fr 就不一样长 —— 条与条之间比不了长度。
   */
  place() {
    const rows = this.querySelectorAll('.vk-bar');
    if (!rows.length) return;
    let lw = 0;
    let vw = 0;
    for (const row of rows) {
      lw = Math.max(lw, row.querySelector('.vk-bar-l')?.offsetWidth || 0);
      vw = Math.max(vw, row.querySelector('.vk-bar-v')?.offsetWidth || 0);
    }
    if (!lw || !vw) return;
    const sig = `${lw}|${vw}`;
    if (sig === this._cols) return;
    this._cols = sig;
    const cols = `${Math.ceil(lw)}px 1fr ${Math.ceil(vw)}px`;
    for (const row of rows) row.style.gridTemplateColumns = cols;
  }
}

/* ================================================================ 时间线 */

// 轴两端的小字：caption 档、ink-3。
const TL_EDGE =
  'flex:0 0 auto;align-self:flex-start;font-size:var(--vk-fs-caption);line-height:var(--vk-lh-caption);color:var(--vk-ink-3)';
const LANES = 'display:flex;flex-direction:column;gap:var(--vk-gap-normal)';
const LANE = 'display:flex;gap:var(--vk-gap-normal);align-items:flex-start';
const LANE_NAME =
  'flex:0 0 auto;min-width:6em;font-family:var(--vk-font-mono);' +
  'font-size:var(--vk-fs-caption);line-height:var(--vk-lh-caption);color:var(--vk-ink-3)';
// 一条泳道一条轴线；.vk-tl-item 的圆点正好挂在这条线下面（见 ::before 的 top）。
// 轴线画在行内（背景渐变），这样圆点正好骑在线上；用 border-top 会把它推到行的顶边。
const LANE_ROW =
  'flex:1 1 0;min-width:0;display:flex;gap:var(--vk-gap-normal);padding-top:var(--vk-gap-wide);' +
  'background:linear-gradient(var(--vk-line-strong),var(--vk-line-strong)) 0 calc(var(--vk-gap-wide) / 2) / 100% var(--vk-line-w-rule) no-repeat';

export class VkTimeline extends VkElement {
  render() {
    const lis = items(this);
    if (!lis.length) {
      this.innerHTML = '';
      return;
    }
    const variant = attrEnum(this, 'variant', 'events');
    const start = attrText(this, 'start');
    const end = attrText(this, 'end');
    const current = attrIndex(this, 'current');
    const cur = current >= 1 && current <= lis.length ? current : -1;
    if (current !== -1 && cur === -1) warn(this, `current="${current}" 超出 1…${lis.length}，按不标处理`);
    this.dataset.variant = variant;

    if (variant === 'lanes') {
      if (start || end) warn(this, 'lanes 形态没有一条共同的轴，start / end 不显示');
      this.innerHTML = this._lanes(lis, cur);
      return;
    }

    // 范围写在轴上方一行：它不属于那排事件，不能当 flex 子项抢宽度。
    const range = start || end ? `<div class="vk-tl-range">${esc(start)}${start && end ? ' → ' : ''}${esc(end)}</div>` : '';
    const events = lis.map((node, i) => this._event(node, i, cur)).join('');
    this.innerHTML = `${range}<div class="vk-tl">${events}</div>`;
  }

  /** 一条事项。等距：这里没有任何按年份的比例计算。 */
  _event(node, i, cur) {
    const date = itemAttr(this, node, 'date');
    const label = itemAttr(this, node, 'label');
    const note = itemAttr(this, node, 'note');
    const body = itemText(node);
    // label 是标题、正文是 li 的文字；只写了文字的，文字就是标题。
    const title = label || body;
    const sub = note || (label ? body : '');
    const tone = itemAttr(this, node, 'tone');
    const own = itemAttr(this, node, 'state');
    const state = cur === i + 1 ? 'current' : own;
    const attr = [
      `data-vk-event="${i}"`,
      tone ? `tone="${esc(tone)}"` : '',
      state ? `state="${esc(state)}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      `<div class="vk-tl-item" ${attr}>` +
      (date ? `<span class="vk-tl-date">${esc(date)}</span>` : '') +
      (title ? `<span class="vk-tl-t">${esc(title)}</span>` : '') +
      (sub ? `<span class="vk-tl-note">${esc(sub)}</span>` : '') +
      `</div>`
    );
  }

  /** 泳道：一条泳道一行，行首名字，行内按事件顺序排。 */
  _lanes(lis, cur) {
    const names = attrText(this, 'lanes')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) warn(this, 'variant="lanes" 需要 lanes="A,B"');

    const groups = new Map(names.map((n) => [n, []]));
    lis.forEach((node, i) => {
      let lane = itemAttr(this, node, 'lane');
      if (!lane) {
        lane = names[0] || '';
        warn(this, `第 ${i + 1} 条没有 lane，放进 ${lane || '无名泳道'}`);
      }
      if (!groups.has(lane)) {
        warn(this, `lane="${lane}" 不在 lanes 里，补一行`);
        groups.set(lane, []);
      }
      groups.get(lane).push({ node, i });
    });

    const rows = [...groups]
      .map(
        ([name, list]) =>
          `<div class="vk-lane" data-vk-lane="${esc(name)}" style="${LANE}">` +
          `<span class="vk-lane-name" style="${LANE_NAME}">${esc(name)}</span>` +
          `<div class="vk-lane-row" style="${LANE_ROW}">${list.map((e) => this._event(e.node, e.i, cur)).join('')}</div>` +
          `</div>`
      )
      .join('');
    return `<div class="vk-lanes" style="${LANES}">${rows}</div>`;
  }
}

/* ================================================================== 对照 */

/** 差异框："x1,y1,x2,y2;…"，百分比。 */
function parseMarks(raw, host) {
  const out = [];
  for (const piece of String(raw || '').split(';')) {
    const tok = piece.trim();
    if (!tok) continue;
    const nums = tok.split(',').map((s) => Number(s.trim()));
    if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
      warn(host, `mark="${tok}" 不是 x1,y1,x2,y2`);
      continue;
    }
    const [x1, y1, x2, y2] = nums.map((n) => Math.max(0, Math.min(100, n)));
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 0.5 || h < 0.5) {
      warn(host, `mark="${tok}" 面积是 0，跳过`);
      continue;
    }
    out.push({ left, top, w, h });
  }
  return out;
}

const markHtml = (m) =>
  `<span class="vk-compare-mark" style="left:${pct(m.left)}%;top:${pct(m.top)}%;width:${pct(m.w)}%;height:${pct(m.h)}%"></span>`;

// 图不裁、不拉伸：contain。CSS 的 .vk-compare-pane img 只给了 100% 宽高。
const imgHtml = (src, alt) =>
  `<img src="${esc(src)}" alt="${esc(alt)}" loading="eager" style="object-fit:contain">`;

export class VkCompare extends VkElement {
  render() {
    const raw = attrText(this, 'labels'); // "a.png,b.png|改前|改后"
    const [srcPart = '', ...capParts] = raw.split('|');
    const srcs = srcPart
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
    const caps = capParts.map((s) => s.trim());
    if (!srcs.length) {
      warn(this, '缺 labels：两张图与角标写在 labels="a.png,b.png|改前|改后"');
      this.innerHTML = '';
      return;
    }
    if (srcs.length < 2) warn(this, 'labels 只解析出一张图，对照需要两张');

    const variant = attrEnum(this, 'variant', 'split');
    const split = attrNum(this, 'split', 50);
    this.dataset.variant = variant;

    this._marks = parseMarks(attrText(this, 'mark'), this);

    // 只有结构会变的属性才重建（重建等于重新加载图片，split 这种不该动 DOM）。
    const sig = `${variant}|${srcs.join('\u0000')}|${caps.join('\u0000')}`;
    if (this._sig !== sig) {
      this._sig = sig;
      this.innerHTML = this._structure(variant, srcs, caps);
      this._wire();
    }

    this._paintSplit(variant, split);
    this._paintMarks();
    this._syncAspect();
  }

  _structure(variant, srcs, caps) {
    const pane = (i, style = '') =>
      `<div class="vk-compare-pane" data-pane="${i === 0 ? 'a' : 'b'}" data-marks${style ? ` style="${style}"` : ''}>` +
      imgHtml(srcs[i], caps[i] || '') +
      `</div>`;
    const capsSome = caps.some(Boolean);
    // split 的两个 pane 叠着，角标只能共用一行：左「改前」右「改后」。
    const hd = capsSome
      ? `<div class="vk-compare-hd" style="display:flex;justify-content:space-between;gap:var(--vk-gap-normal)">` +
        srcs.map((_, i) => `<span class="vk-compare-label">${esc(caps[i] || '')}</span>`).join('') +
        `</div>`
      : '';
    const item = (i) =>
      `<div class="vk-compare-item" style="display:flex;flex-direction:column;min-width:0;min-height:0">` +
      (caps[i] ? `<span class="vk-compare-label">${esc(caps[i])}</span>` : '') +
      pane(i, 'flex:1 1 auto;min-height:0') +
      `</div>`;

    let body;
    if (variant === 'split') {
      body =
        `<div class="vk-compare" style="grid-template-rows:auto auto">${hd}` +
        `<div class="vk-compare-split" style="display:grid;min-height:0">` +
        srcs.map((_, i) => pane(i, 'grid-area:1 / 1;min-height:0')).join('') +
        `</div></div>`;
    } else if (variant === 'side') {
      body = `<div class="vk-compare" style="grid-template-columns:1fr 1fr">${srcs
        .map((_, i) => item(i))
        .join('')}</div>`;
    } else {
      body = `<div class="vk-compare" style="grid-template-columns:1fr">${srcs
        .map((_, i) => item(i))
        .join('')}</div>`;
    }

    return body;
  }

  /** 图片事件只挂一次（innerHTML 重建后要重挂）。 */
  _wire() {
    for (const img of this.querySelectorAll('.vk-compare-pane[data-pane="a"] img, .vk-compare-pane[data-pane="b"] img')) {
      img.addEventListener('load', () => {
        this._syncAspect();
        VK.invalidate(); // 图到了，pane 高变了，放大块要重量
      });
      img.addEventListener('error', () => warn(this, `图片加载失败：${img.getAttribute('src')}`));
    }
  }

  /** 右 pane 按 split 裁：两张图叠在同一格里，露出来的比例就是 split。 */
  _paintSplit(variant, split) {
    const b = this.querySelector('.vk-compare-pane[data-pane="b"]');
    if (!b) return;
    if (variant === 'split') b.style.clipPath = `inset(0 0 0 ${split}%)`;
    else b.style.removeProperty('clip-path');
  }

  _paintMarks() {
    const list = this._marks || [];
    for (const box of this.querySelectorAll('[data-marks]')) {
      for (const old of box.querySelectorAll('.vk-compare-mark')) old.remove();
      if (list.length) box.insertAdjacentHTML('beforeend', list.map(markHtml).join(''));
    }
  }

  /**
   * 比例自检：两张图比例不同 —— pane 里必然留边，mark 的百分比也对不齐。
   * 图还没到就不知道，等 load 再来一次。
   */
  _syncAspect() {
    const imgs = [
      ...this.querySelectorAll('.vk-compare-pane[data-pane="a"] img, .vk-compare-pane[data-pane="b"] img'),
    ];
    const panes = [...this.querySelectorAll('.vk-compare-pane[data-pane="a"], .vk-compare-pane[data-pane="b"]')];
    const known = imgs.length >= 2 && imgs.every((i) => i.naturalWidth > 0 && i.naturalHeight > 0);
    if (!known) {
      for (const p of panes) p.removeAttribute('data-mismatch');
      return;
    }
    const ratio = (i) => i.naturalWidth / i.naturalHeight;
    const [a, b] = imgs.map(ratio);
    const off = Math.abs(a - b) / Math.max(a, b) > 0.01;
    for (const p of panes) p.toggleAttribute('data-mismatch', off);
    if (off) {
      warn(
        this,
        `两张图比例不同（${a.toFixed(3)} vs ${b.toFixed(3)}）：contain 会留边，差异框按 pane 的百分比也对不齐。裁成同一比例再对照。`
      );
    }
  }

}

/* ================================================================== 注册 */

export function defineDiagram() {
  define('vk-steps', VkSteps);
  define('vk-bars', VkBars);
  define('vk-timeline', VkTimeline);
  define('vk-compare', VkCompare);
}
