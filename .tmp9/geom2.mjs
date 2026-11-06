import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('.');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'], channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file:///' + path.join(ROOT, '.tmp9/frames.audit.html').split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());
await page.waitForTimeout(400);

const data = await page.evaluate(() => {
  const n1 = (v) => Math.round(Number.parseFloat(v) * 10) / 10;
  const union = (rs) => {
    if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const r2 = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom));
    return { l, t, r: r2, b };
  };
  const out = [];
  for (const p of document.querySelectorAll('vk-page')) {
    const pr = p.getBoundingClientRect();
    const stage = p.querySelector('.vk-stage');
    const scs = getComputedStyle(stage);
    const els = [];
    const walk = (el, depth, host) => {
      for (const c of el.children) {
        const b = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const rec = {
          tag: c.localName, id: c.id || '', cls: c.getAttribute('class') || '', depth, host,
          box: [n1(b.left - pr.left), n1(b.top - pr.top), n1(b.width), n1(b.height)],
          fs: cs.fontSize, lh: cs.lineHeight, gap: cs.rowGap, pad: cs.padding,
          bt: cs.borderTopWidth, bl: cs.borderLeftWidth, bb: cs.borderBottomWidth,
          color: cs.color, bg: cs.backgroundColor,
          text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
        };
        if (c.textContent.trim()) {
          const r = document.createRange();
          r.selectNodeContents(c);
          const rs = [...r.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5);
          // 按行合并（同一 top 的片段算一行）
          const lines = [];
          for (const q of rs) {
            const hit = lines.find((L) => Math.abs(L.t - q.top) < q.height * 0.5);
            if (hit) { hit.l = Math.min(hit.l, q.left); hit.r = Math.max(hit.r, q.right); hit.t = Math.min(hit.t, q.top); hit.b = Math.max(hit.b, q.bottom); }
            else lines.push({ l: q.left, r: q.right, t: q.top, b: q.bottom });
          }
          rec.ink = lines.map((L) => [n1(L.l - pr.left), n1(L.t - pr.top), n1(L.r - L.l), n1(L.b - L.t)]);
        }
        if (c.classList.contains('vk-callout-svg')) {
          rec.shapes = [...c.querySelectorAll('path,line,rect,circle')].map((s) => {
            const sb = s.getBoundingClientRect();
            const g = (a) => (s.getAttribute(a) == null ? null : Number(s.getAttribute(a)));
            return {
              k: s.tagName.toLowerCase(), cls: s.getAttribute('class'),
              box: [n1(sb.left - pr.left), n1(sb.top - pr.top), n1(sb.width), n1(sb.height)],
              stroke: getComputedStyle(s).stroke, sw: getComputedStyle(s).strokeWidth,
              a: s.tagName.toLowerCase() === 'line' ? [g('x1'), g('y1'), g('x2'), g('y2')]
                : s.tagName.toLowerCase() === 'circle' ? [g('cx'), g('cy'), g('r')]
                : s.tagName.toLowerCase() === 'rect' ? [g('x'), g('y'), g('width'), g('height'), g('rx')] : s.getAttribute('d'),
            };
          });
        }
        els.push(rec);
        walk(c, depth + 1, host || c.localName);
      }
    };
    walk(p, 0, 'vk-page');
    out.push({
      id: p.id, surface: p.getAttribute('surface') || 'paper', align: p.getAttribute('align') || 'center',
      pad: [n1(Number.parseFloat(scs.paddingLeft)), n1(Number.parseFloat(scs.paddingTop)), n1(Number.parseFloat(scs.paddingRight)), n1(Number.parseFloat(scs.paddingBottom))],
      els,
    });
  }
  return out;
});
fs.writeFileSync(path.join(ROOT, '.tmp9/geom2.json'), JSON.stringify(data, null, 1));
console.log('ok', data.length, data.reduce((a, f) => a + f.els.length, 0));
await browser.close();
