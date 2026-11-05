/**
 * 惰性属性侦查：把每个件声明的每个"应该看得出来"的属性改一下，
 * 看这个件（以及它所在的那一帧）有没有任何视觉变化。
 *
 * 用法：node tools/inert.mjs [页面...]
 *
 * 它不改任何文件，也不进 npm test——这是给改动前后自查用的诊断工具。
 * 报出来的"改了没反应"，要么是属性没实现，要么是实现的取值对这个件没意义。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { TAG_NAMES, attrsOf } from '../src/schema.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');

/* 只查"改了一定看得出来"的属性：位置、排版、字体、颜色、形态。 */
const VISUAL = new Set([
  'tone', 'size', 'weight', 'ink', 'align', 'variant', 'surface', 'radius', 'border',
  'chrome', 'current', 'state', 'index', 'group', 'sign', 'mono', 'direction', 'connector',
  'scale', 'split', 'gap', 'pad', 'cols', 'measure', 'fill', 'position', 'long', 'mark', 'focus',
]);

const files = process.argv.slice(2);
if (!files.length) {
  for (const dir of ['tests', 'episodes']) {
    const d = path.join(ROOT, dir);
    for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) files.push(path.join(dir, f));
  }
}

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

let tested = 0;
const inert = new Map(); // key -> { count, sample }
const total = new Map(); // key -> 试过几次

for (const rel of files) {
  const built = path.join(OUT, rel);
  if (!fs.existsSync(built)) continue;
  await page.goto('file:///' + built.split(path.sep).join('/'));
  await page.evaluate(() => window.vk.ready());

  const plan = await page.evaluate(
    ({ VISUAL, tags, schema }) => {
      const sig = (stage) => {
        const parts = [];
        for (const el of stage.querySelectorAll('*')) {
          if (el.closest('svg')) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const cs = getComputedStyle(el);
          parts.push(
            [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRadius, cs.fontSize, cs.fontWeight, cs.opacity, getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content].join('|')
          );
        }
        return parts.join('\n');
      };

      const jobs = [];
      for (const stage of document.querySelectorAll('.vk-stage')) {
        const all = [...stage.querySelectorAll('*')].filter((el) => tags.includes(el.localName));
        const perTag = new Map();
        for (const el of all) {
          const t = el.localName;
          perTag.set(t, (perTag.get(t) || 0) + 1);
          if (perTag.get(t) > 2) continue; // 每个件最多试两个实例
          const spec = schema[t] || {};
          for (const [name, def] of Object.entries(spec)) {
            if (!VISUAL.includes(name)) continue;
            const cur = el.getAttribute(name);
            let next = null;
            if (def.values) next = def.values.find((v) => v !== cur && v !== def.default);
            else if (def.type === 'bool') next = cur ? null : '';
            else if (def.type === 'int' || def.type === 'index') next = cur ? null : String((def.default ?? 1) + 1);
            if (next == null) continue;
            jobs.push({ stage: [...document.querySelectorAll('.vk-stage')].indexOf(stage), path: null, tag: t, name, value: next, before: sig(stage), idx: [...stage.querySelectorAll('*')].indexOf(el) });
          }
        }
      }
      return jobs;
    },
    { VISUAL: [...VISUAL], tags: TAG_NAMES, schema: Object.fromEntries(TAG_NAMES.map((t) => [t, attrsOf(t)])) }
  );

  for (const job of plan) {
    const changed = await page.evaluate(
      ({ job }) => {
        const stage = document.querySelectorAll('.vk-stage')[job.stage];
        const el = stage.querySelectorAll('*')[job.idx];
        if (!el) return 'skip';
        const root = el.closest('vk-page') || document;
        const attr = job.name;
        const old = el.getAttribute(attr);
        el.setAttribute(attr, job.value ?? '');
        return new Promise((done) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const sig = (s) => {
                const parts = [];
                for (const e of s.querySelectorAll('*')) {
                  if (e.closest('svg')) continue;
                  const r = e.getBoundingClientRect();
                  if (r.width < 1 || r.height < 1) continue;
                  const cs = getComputedStyle(e);
                  parts.push(
                    [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderRadius, cs.fontSize, cs.fontWeight, cs.opacity, getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content].join('|')
                  );
                }
                return parts.join('\n');
              };
              const same = sig(stage) === job.before;
              if (old == null) el.removeAttribute(attr);
              else el.setAttribute(attr, old);
              done(same ? 'inert' : 'ok');
            })
          );
        });
      },
      { job }
    );
    if (changed === 'skip') continue;
    tested++;
    const key0 = `${job.tag}.${job.name}=${job.value ?? ''}`;
    total.set(key0, (total.get(key0) || 0) + 1);
    if (changed === 'inert') {
      const key = `${job.tag}.${job.name}=${job.value}`;
      const rec = inert.get(key) || { count: 0, sample: `${rel}#${job.stage + 1}` };
      rec.count++;
      inert.set(key, rec);
    }
  }
}

await browser.close();

const rows = [...total.entries()]
  .map(([k, n]) => ({ k, n, inertCount: inert.get(k)?.count || 0, sample: inert.get(k)?.sample || '' }))
  .filter((r) => r.inertCount > 0)
  .sort((a, b) => b.inertCount / b.n - a.inertCount / a.n || b.inertCount - a.inertCount);
console.log(`试了 ${tested} 次改动；下面按"改了没反应的比例"排序：`);
for (const r of rows.slice(0, 30)) {
  const pct = Math.round((r.inertCount / r.n) * 100);
  console.log(`  ${String(pct + '%').padStart(4)}  ${r.k.padEnd(32)} ${r.inertCount}/${r.n}   例如 ${r.sample}`);
}
if (!rows.length) console.log('  没有。每个属性都看得出来。');
