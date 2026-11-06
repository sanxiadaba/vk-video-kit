// 只读调查：渲染 tests/frames.html，导出每帧每个元素的几何盒（1920 坐标系）。
import fs from 'node:fs';
import path from 'node:path';
import { transformHtml } from '../src/build.mjs';

const ROOT = path.resolve('.');
const SRC = path.join(ROOT, 'tests/frames.html');
const OUT = path.join(ROOT, '.tmp9/frames.audit.html');

const html = fs.readFileSync(SRC, 'utf8');
const res = await transformHtml(html, { file: SRC });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, res.html);

const { chromium } = await import('playwright');
let browser;
try {
  browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
} catch {
  browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'], channel: 'msedge' });
}
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file:///' + OUT.split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());
await page.waitForTimeout(300);

const data = await page.evaluate(() => {
  const out = [];
  const num = (v) => Math.round(Number.parseFloat(v) * 10) / 10;
  for (const p of document.querySelectorAll('vk-page')) {
    const pr = p.getBoundingClientRect();
    const stage = p.querySelector('.vk-stage');
    const sr = stage.getBoundingClientRect();
    const scs = getComputedStyle(stage);
    const els = [];
    const walk = (el, depth) => {
      for (const c of el.children) {
        if (c.classList.contains('vk-callout')) {
          // 注释层单独收
          const svg = c.querySelector('.vk-callout-svg');
          const shapes = svg ? [...svg.querySelectorAll('path,line,rect,circle,ellipse')].map((s) => {
            const b = s.getBoundingClientRect();
            const g = (a) => (s.getAttribute(a) == null ? null : Number(s.getAttribute(a)));
            const cs = getComputedStyle(s);
            return {
              kind: s.tagName.toLowerCase(),
              cls: s.getAttribute('class'),
              x: num(b.left - pr.left), y: num(b.top - pr.top), w: num(b.width), h: num(b.height),
              sw: cs.strokeWidth, cap: cs.strokeLinecap,
              attrs: s.tagName.toLowerCase() === 'line'
                ? { x1: g('x1'), y1: g('y1'), x2: g('x2'), y2: g('y2') }
                : s.tagName.toLowerCase() === 'circle' ? { cx: g('cx'), cy: g('cy'), r: g('r') }
                : s.tagName.toLowerCase() === 'rect' ? { x: g('x'), y: g('y'), w: g('width'), h: g('height'), rx: g('rx') } : {},
            };
          }) : [];
          const bds = [...c.querySelectorAll('.vk-callout-bd')].map((n) => {
            const b = n.getBoundingClientRect();
            const cs = getComputedStyle(n);
            return { cls: n.className, text: n.textContent, x: num(b.left - pr.left), y: num(b.top - pr.top), w: num(b.width), h: num(b.height), fs: cs.fontSize, lh: cs.lineHeight };
          });
          els.push({ tag: 'vk-callout', depth, shapes, bds });
          continue;
        }
        const b = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const rec = {
          tag: c.localName,
          id: c.id || '',
          cls: c.getAttribute('class') || '',
          depth,
          x: num(b.left - pr.left), y: num(b.top - pr.top), w: num(b.width), h: num(b.height),
          fs: cs.fontSize, lh: cs.lineHeight, gap: cs.rowGap, pad: cs.padding,
          border: cs.borderTopWidth + '/' + cs.borderLeftWidth,
          text: (c.textContent || '').trim().slice(0, 40),
        };
        // 文字墨迹框（Range）——标题/标签/说明的真实左右边界与基线
        const tn = [...c.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        if (tn.length) {
          const r = document.createRange();
          r.selectNodeContents(c);
          const rs = [...r.getClientRects()];
          if (rs.length) {
            rec.lines = rs.map((q) => ({ x: num(q.left - pr.left), y: num(q.top - pr.top), w: num(q.width), h: num(q.height) }));
          }
        }
        els.push(rec);
        walk(c, depth + 1);
      }
    };
    walk(stage, 0);
    out.push({
      id: p.id,
      surface: p.getAttribute('surface') || 'paper',
      align: p.getAttribute('align') || 'center',
      pad: { l: num(Number.parseFloat(scs.paddingLeft)), t: num(Number.parseFloat(scs.paddingTop)), r: num(Number.parseFloat(scs.paddingRight)), b: num(Number.parseFloat(scs.paddingBottom)) },
      els,
    });
  }
  return out;
});

fs.writeFileSync(path.join(ROOT, '.tmp9/geom.json'), JSON.stringify(data, null, 1));
console.log('frames:', data.length);
await browser.close();
