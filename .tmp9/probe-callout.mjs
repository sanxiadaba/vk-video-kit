import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('.');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'], channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file:///' + path.join(ROOT, '.tmp9/frames.audit.html').split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());
await page.waitForTimeout(300);

const res = await page.evaluate(() => {
  const out = {};
  for (const p of document.querySelectorAll('vk-page')) {
    const pr = p.getBoundingClientRect();
    const co = p.querySelector('.vk-callout');
    const svg = p.querySelector('.vk-callout-svg');
    const rec = { pageRect: [pr.top, pr.left, pr.width, pr.height], hasCallout: !!co, svg: null, html: '' };
    if (svg) {
      const sb = svg.getBoundingClientRect();
      rec.svg = {
        rect: [sb.left - pr.left, sb.top - pr.top, sb.width, sb.height],
        viewBox: svg.getAttribute('viewBox'),
        shapes: [...svg.querySelectorAll('path,line,rect,circle')].map((s) => {
          const b = s.getBoundingClientRect();
          const g = (a) => (s.getAttribute(a) == null ? null : Number(s.getAttribute(a)));
          return {
            k: s.tagName.toLowerCase(), cls: s.getAttribute('class'),
            box: [Math.round(b.left - pr.left), Math.round(b.top - pr.top), Math.round(b.width), Math.round(b.height)],
            sw: getComputedStyle(s).strokeWidth, fill: getComputedStyle(s).fill,
            a: s.tagName.toLowerCase() === 'line' ? [g('x1'), g('y1'), g('x2'), g('y2')]
              : s.tagName.toLowerCase() === 'circle' ? [g('cx'), g('cy'), g('r')]
              : s.tagName.toLowerCase() === 'rect' ? [g('x'), g('y'), g('width'), g('height'), g('rx')] : s.getAttribute('d'),
          };
        }),
      };
    }
    if (co) {
      const b = co.getBoundingClientRect();
      rec.html = [...co.children].map((c) => {
        const cb = c.getBoundingClientRect();
        return `${c.tagName.toLowerCase()}.${c.className} [${Math.round(cb.left - pr.left)},${Math.round(cb.top - pr.top)} ${Math.round(cb.width)}x${Math.round(cb.height)}]`;
      }).join(' ');
      rec.calloutRect = [b.left - pr.left, b.top - pr.top, b.width, b.height];
    }
    out[p.id] = rec;
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
