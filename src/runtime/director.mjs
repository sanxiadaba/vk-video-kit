/**
 * L6 · 求值器（director）
 *
 * 组件只描述「姿态」，这里只描述「何时到哪个姿态」。
 *
 *   作者写：  <vk-stat at="0.6" enter="rise" dur="0.36" …>
 *   这里做：  plan() 把声明折成绝对时刻的 cue 表；seek(t) 把表求值成内联样式。
 *
 * 三条硬规矩：
 *   1. seek 是纯函数：先 reset 再按绝对状态重算，结果只取决于 t，与到达路径无关。
 *   2. 只动 transform / opacity / clip-path，绝不改布局属性——所以几何审计对任意 t 都成立。
 *   3. t = dur（poster）必须逐像素等于不带动画的静态页。
 *
 * 不提供播放器、不提供转场、不提供时间轴 UI：那些是编排层的事。
 */

const EASE = {
  linear: (p) => p,
  'out-cubic': (p) => 1 - Math.pow(1 - p, 3),
  'out-quint': (p) => 1 - Math.pow(1 - p, 5),
  'out-expo': (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  'in-cubic': (p) => p * p * p,
  'in-out-sine': (p) => -(Math.cos(Math.PI * p) - 1) / 2,
};

const ENTERS = {
  rise: { y: 24 },
  fade: {},
  scale: { scale: 0.97 },
  wipe: { wipe: true },
  none: {},
};

const num = (v, fallback) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 稳定路径：有 id 用 id，否则从根往下一层层拼 nth-of-type。 */
function pathOf(el, root) {
  if (el.id) return `#${el.id}`;
  const parts = [];
  let n = el;
  while (n && n !== root && n.parentElement) {
    const tag = n.tagName.toLowerCase();
    const sibs = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
    parts.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(n) + 1})` : tag);
    n = n.parentElement;
  }
  return parts.join(' > ');
}

/** 时间轴里的 li[at] 是「第几步」，不是秒。求值器不碰 timeline。 */
const inTimeline = (el) => !!el.closest?.('vk-timeline');

export function plan(root = document) {
  // 场次属性写在自定义元素 <vk-page> 上（内层 .vk-page 只是坐标盒子）
  const scene = root.querySelector?.('vk-page') || root.querySelector?.('.vk-page') || root;
  const cues = [];
  const dur = num(scene?.getAttribute?.('dur'), 0);
  const beat = num(scene?.getAttribute?.('beat'), 0.6);
  const poster = num(scene?.getAttribute?.('poster'), dur);

  if (!dur) return { dur: 0, beat, poster: 0, cues: [] };

  const push = (el, t0, kwargs) => {
    const enter = kwargs.enter || el.getAttribute('enter') || 'none';
    if (enter === 'none' || !ENTERERS[enter]) return;
    cues.push({
      target: pathOf(el, scene),
      el,
      t0: Math.max(0, t0),
      dur: num(kwargs.dur ?? el.getAttribute('dur'), 0.36),
      ease: kwargs.ease || el.getAttribute('ease') || 'out-cubic',
      kind: enter,
    });
  };

  // 容器上的 stagger：直接子元素依次入场
  for (const host of scene.querySelectorAll('[stagger]')) {
    if (inTimeline(host) || host.parentElement?.closest('[data-vk-overlay]')) continue;
    const step = num(host.getAttribute('stagger'), 0.06);
    const base = num(host.getAttribute('at'), 0);
    const enter = host.getAttribute('enter') || 'rise';
    // 组件渲染后，源 <li> 已经被换成内部结构，所以要按 data-vk-part 找顶层项。
    // 这条规则对 code / cells / asm / table / tree 都成立：它们本来就标了 part。
    const items = [...host.querySelectorAll('[data-vk-part]')].filter((el) => {
      let p = el.parentElement;
      while (p && p !== host) {
        if (p.hasAttribute('data-vk-part')) return false;
        p = p.parentElement;
      }
      return true;
    });
    const list = items.length ? items : [...host.children];
    list.forEach((child, i) => push(child, base + i * step, { enter }));
    host.setAttribute('data-vk-stagger', '');
  }

  // 单个元素上的 at/enter
  for (const el of scene.querySelectorAll('[at], [enter]')) {
    if (inTimeline(el) || el.parentElement?.closest('[data-vk-overlay]')) continue;
    if (el.hasAttribute('stagger')) continue; // 容器自己已经展开
    push(el, num(el.getAttribute('at'), 0), {});
  }

  cues.sort((a, b) => a.t0 - b.t0);
  return { dur, beat, poster, cues };
}

const ENTERERS = {
  rise(p) {
    const y = 24 * (1 - p);
    return { transform: `translateY(${y.toFixed(2)}px)`, opacity: String(p) };
  },
  fade(p) {
    return { opacity: String(p) };
  },
  scale(p) {
    const s = 0.97 + 0.03 * p;
    return { transform: `scale(${s.toFixed(4)})`, opacity: String(p) };
  },
  wipe(p) {
    return { clipPath: `inset(0 ${(100 * (1 - p)).toFixed(2)}% 0 0)` };
  },
  none() {
    return {};
  },
};

const PROPS = ['transform', 'opacity', 'clipPath'];

export function installDirector(VK) {
  let current = null;
  /** 每个 cue 元素「出场之前」的内联值。求值器只借用这几个属性，用完必须还回去。 */
  let base = new Map();

  const capture = () => {
    base = new Map();
    for (const c of current.cues) {
      if (base.has(c.el)) continue;
      const snap = {};
      for (const k of PROPS) snap[k] = c.el.style[k] || '';
      base.set(c.el, snap);
    }
  };

  const restore = (el) => {
    const snap = base.get(el);
    if (!snap) return;
    for (const k of PROPS) {
      if (snap[k]) el.style[k] = snap[k];
      else el.style.removeProperty(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    }
  };

  /** 把 t 时刻的画面求出来。纯函数：同一 t 永远得到同一结果。 */
  VK.seek = (t) => {
    const tt = Math.max(0, Number(t) || 0);
    if (!current) {
      current = plan(document);
      capture();
    }
    if (!current.cues.length) {
      document.documentElement.dataset.vkAt = String(tt);
      return { t: tt, cues: 0 };
    }
    // 先全部还原到「出场之前」，再按绝对时刻重算——这样 seek 与到达路径无关。
    for (const el of base.keys()) restore(el);
    for (const c of current.cues) {
      const p = c.dur > 0 ? Math.min(1, Math.max(0, (tt - c.t0) / c.dur)) : tt >= c.t0 ? 1 : 0;
      if (p >= 1) continue;
      const pose = ENTERERS[c.kind]((EASE[c.ease] || EASE['out-cubic'])(p));
      // 借来的 opacity 要乘在原来的值上：被聚光退后的格子，动画结束后仍然是退后的。
      const baseOpacity = base.get(c.el)?.opacity;
      for (const [k, v] of Object.entries(pose)) {
        if (k === 'opacity' && baseOpacity) c.el.style.opacity = String(parseFloat(baseOpacity) * parseFloat(v));
        else c.el.style[k] = v;
      }
    }
    document.documentElement.dataset.vkAt = String(tt);
    return { t: tt, cues: current.cues.length };
  };

  /** 时间表：给下游（剪辑 / Remotion / ffmpeg）用的绝对时刻表。 */
  VK.scene = () => {
    const p = plan(document);
    return {
      dur: p.dur,
      beat: p.beat,
      poster: p.poster,
      cues: p.cues.map(({ target, t0, dur, ease, kind }) => ({ target, t0, dur, ease, kind, at: +(t0 / p.beat).toFixed(2) })),
    };
  };

  VK.replan = () => {
    current = plan(document);
    capture();
    return current;
  };
}






