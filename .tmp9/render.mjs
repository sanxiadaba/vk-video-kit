// 只读调查：用当前源码重建的库渲染 23 帧（1920 + 780），并导出几何。
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { transformHtml } from '../src/build.mjs';

const ROOT = path.resolve('.');
const SRC = path.join(ROOT, 'tests/frames.html');
const OUT = path.join(ROOT, '.tmp9/frames.audit.html');
const res = await transformHtml(fs.readFileSync(SRC, 'utf8'), { file: SRC });
fs.writeFileSync(OUT, res.html);

function downscale(src, targetW) {
  const targetH = Math.round((src.height * targetW) / src.width);
  const out = new PNG({ width: targetW, height: targetH });
  const sx = src.width / targetW;
  const sy = src.height / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.min(src.width, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * src.width + xx) << 2;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3]; n++;
      }
      const o = (y * targetW + x) << 2;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
  }
  return out;
}

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'], channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file:///' + OUT.split(path.sep).join('/'), { waitUntil: 'load' });
await page.evaluate(() => window.vk?.ready?.());
await page.waitForTimeout(400);

fs.mkdirSync(path.join(ROOT, '.tmp9/render'), { recursive: true });
fs.mkdirSync(path.join(ROOT, '.tmp9/render780'), { recursive: true });

const frames = await page.evaluate(() => [...document.querySelectorAll('vk-page')].map((p) => {
  const r = p.getBoundingClientRect();
  return { id: p.id, x: r.left, y: r.top, w: r.width, h: r.height };
}));
for (const f of frames) {
  const buf = await page.screenshot({ fullPage: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
  fs.writeFileSync(path.join(ROOT, `.tmp9/render/${f.id}.png`), buf);
  const png = PNG.sync.read(buf);
  fs.writeFileSync(path.join(ROOT, `.tmp9/render780/${f.id}.png`), PNG.sync.write(downscale(png, 780)));
}

// 几何：复用同一页面
const data = await page.evaluate(() => {
  const num = (v) => Math.round(Number.parseFloat(v) * 10) / 10;
  const out = [];
  for (const p of document.querySelectorAll('vk-page')) {
    const pr = p.getBoundingClientRect();
    const stage = p.querySelector('.vk-stage');
    const scs = getComputedStyle(stage);
    const els = [];
    const seen = new Set();
    const take = (c, depth) => {
      const b = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      const rec = {
        tag: c.localName, id: c.id || '', cls: c.getAttribute('class') || '', depth,
        x: num(b.left - pr.left), y: num(b.top - pr.top), w: num(b.width), h: num(b.height),
        fs: cs.fontSize, lh: cs.lineHeight, gap: cs.rowGap, pad: cs.padding, text: (c.textContent || '').trim().slice(0, 60),
      };
      const tn = [...c.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (tn.length) {
        const r = document.createRange();
        r.selectNodeContents(c);
        const rs = [...r.getClientRects()];
        if (rs.length) rec.lines = rs.map((q) => ({ x: num(q.left - pr.left), y: num(q.top - pr.top), w: num(q.width), h: num(q.height) }));
      }
      els.push(rec);
    };
    // 整棵树（含 .vk-callout 层）
    const walk = (el, depth) => {
      for (const c of el.children) {
        if (seen.has(c)) continue;
        seen.add(c);
        if (c.classList.contains('vk-callout-svg')) {
          const sb = c.getBoundingClientRect();
          const shapes = [...c.querySelectorAll('path,line,rect,circle')].map((s) => {
            const b = s.getBoundingClientRect();
            const g = (a) => (s.getAttribute(a) == null ? null : Number(s.getAttribute(a)));
            return {
              k: s.tagName.toLowerCase(), cls: s.getAttribute('class'),
              box: [num(b.left - pr.left), num(b.top - pr.top), num(b.width), num(b.height)],
              stroke: getComputedStyle(s).stroke, sw: getComputedStyle(s).strokeWidth, cap: getComputedStyle(s).strokeLinecap,
              a: s.tagName.toLowerCase() === 'line' ? [g('x1'), g('y1'), g('x2'), g('y2')]
                : s.tagName.toLowerCase() === 'circle' ? [g('cx'), g('cy'), g('r')]
                : s.tagName.toLowerCase() === 'rect' ? [g('x'), g('y'), g('width'), g('height'), g('rx')] : s.getAttribute('d'),
            };
          });
          els.push({ tag: 'svg', cls: 'vk-callout-svg', depth, box: [num(sb.left - pr.left), num(sb.top - pr.top), num(sb.width), num(sb.height)], shapes });
          continue;
        }
        take(c, depth);
        walk(c, depth + 1);
      }
    };
    walk(p, 0);
    out.push({
      id: p.id, surface: p.getAttribute('surface') || 'paper', align: p.getAttribute('align') || 'center',
      pad: { l: num(Number.parseFloat(scs.paddingLeft)), t: num(Number.parseFloat(scs.paddingTop)), r: num(Number.parseFloat(scs.paddingRight)), b: num(Number.parseFloat(scs.paddingBottom)) },
      els,
    });
  }
  return out;
});
fs.writeFileSync(path.join(ROOT, '.tmp9/geom.json'), JSON.stringify(data, null, 1));
console.log('rendered', frames.length);
await browser.close();
