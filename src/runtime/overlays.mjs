/**
 * L4 旧标签别名：vk-ring / vk-pin。
 *
 * 13.x 及以前它们各是一套实现，现在统一由 vk-annotate 画（见 annotate.mjs）。
 * 这里只固定 mode（circle / note），并把旧属性词表折成新组件的配置：
 *
 *   <vk-ring for="#cells@byte:5" variant="ellipse" tone="err">
 *   <vk-ring variant="dim" for="#code@line:7" dim="0.72" keep="vk-title">
 *   <vk-pin for="#cells@cell:2" side="right" n="1">这里越界</vk-pin>
 *
 * 旧标签继续可用（像素与旧版本一致）；构建期会给一条迁移提示，不硬切。
 */
import { numAttr, define } from './base.mjs';
import { VkAnnotate } from './annotate.mjs';

/* ------------------------------------------------------------------ ring */

export class VkRing extends VkAnnotate {
  static legacy = 'circle';

  _mode() {
    return 'circle';
  }

  _ringConfig() {
    const variant = this.getAttribute('variant') || 'rect';
    // 压暗仍走旧行为：不画图形，只让兄弟退后。
    if (variant === 'dim') {
      return {
        figure: 'dim',
        pad: 8,
        width: 4,
        dash: false,
        z: numAttr(this, 'z', { min: 0, max: 99, fallback: 30 }),
        double: false,
        tone: this._tone('circle'),
      };
    }
    return {
      figure: variant,
      pad: numAttr(this, 'pad-px', { min: 0, max: 80, fallback: 8 }),
      width: numAttr(this, 'stroke', { min: 1, max: 12, fallback: 4 }),
      dash: this.hasAttribute('dash'),
      z: numAttr(this, 'z', { min: 0, max: 99, fallback: 40 }),
      double: false,
      tone: this._tone('circle'),
    };
  }
}

/* ------------------------------------------------------------------- pin */

export class VkPin extends VkAnnotate {
  static legacy = 'note';

  _mode() {
    return 'note';
  }

  /** 旧 vk-pin 的避让只认正文元素；保持原查询，避免像素漂移。 */
  _avoidTextSelector() {
    return 'vk-text, p, h1, h2, h3, li';
  }

  /** w 是气泡宽，不是宿主宽：宿主铺满整页，量它永远不等于 w。
   *  不写 w 时返回 null —— 和 vk-annotate 用同一个"按内容自适到 cap"的默认，
   *  两个标签（本体与别名）因此逐像素一致。 */
  _noteWidth() {
    const wRaw = String(this.getAttribute('w') ?? '').trim();
    if (!wRaw) return null;
    const wm = wRaw.match(/^(\d+(?:\.\d+)?)(?:px)?$/);
    let w = 360;
    if (!wm) {
      this._warnOnce('w', `的 w="${wRaw}" 不是像素宽（写 200 或 200px），按默认宽处理`);
      return 360;
    }
    const n = Number(wm[1]);
    w = Math.min(900, Math.max(160, n));
    if (w !== n) this._warnOnce('w', `的 w="${wRaw}" 超出 160…900，按 ${w} 处理`);
    return w;
  }

  _noteConfig(mode) {
    const cfg = super._noteConfig(mode);
    cfg.form = this.getAttribute('variant') === 'dot' ? 'dot' : 'bubble';
    cfg.tone = this.getAttribute('tone') || 'info';
    cfg.emphasis = this.getAttribute('emphasis') || 'soft';
    cfg.size = this.getAttribute('size') || 'body';
    cfg.n = parseInt(this.getAttribute('n') || '0', 10);
    cfg.x = numAttr(this, 'x', { min: -4000, max: 4000, fallback: NaN });
    cfg.y = numAttr(this, 'y', { min: -4000, max: 4000, fallback: NaN });
    cfg.side = this.getAttribute('side') || 'auto';
    cfg.leader = this.getAttribute('leader') || 'elbow';
    cfg.z = numAttr(this, 'z', { min: 0, max: 99, fallback: 60 });
    cfg.gap = numAttr(this, 'gap-px', { min: 0, max: 240, fallback: 24 });
    return cfg;
  }
}

export function defineOverlays() {
  define('vk-ring', VkRing);
  define('vk-pin', VkPin);
}
