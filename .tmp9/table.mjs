import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('.tmp9/geom2.json', 'utf8'));
const rows = [];
for (const f of d) {
  const label = f.els.find((e) => e.tag === 'vk-label' && e.depth <= 3);
  const texts = f.els.filter((e) => e.tag === 'vk-text' && e.depth <= 3 && e.ink && e.ink.length);
  const head = texts[0];
  const inkAll = f.els.filter((e) => e.ink && e.ink.length && !['vk-page', 'div'].includes(e.tag));
  const R = (v) => Math.round(v);
  const rightMost = Math.max(...inkAll.map((e) => Math.max(...e.ink.map((i) => i[0] + i[2]))));
  const bottomMost = Math.max(...inkAll.map((e) => Math.max(...e.ink.map((i) => i[1] + i[3]))));
  const topMost = Math.min(...inkAll.map((e) => Math.min(...e.ink.map((i) => i[1]))));
  // 内容件（窗口/表格/树的可见盒）
  const win = f.els.find((e) => e.cls.split(' ').includes('vk-win'));
  const table = f.els.find((e) => e.tag === 'table');
  rows.push({
    id: f.id,
    labelTop: label?.ink ? R(Math.min(...label.ink.map((i) => i[1]))) : null,
    labelBot: label?.ink ? R(Math.max(...label.ink.map((i) => i[1] + i[3]))) : null,
    headTop: head?.ink ? R(Math.min(...head.ink.map((i) => i[1]))) : null,
    headBot: head?.ink ? R(Math.max(...head.ink.map((i) => i[1] + i[3]))) : null,
    inkTop: R(topMost),
    inkBottom: R(bottomMost),
    inkRight: R(rightMost),
    winW: win ? R(win.box[2]) : null,
    winRight: win ? R(win.box[0] + win.box[2]) : null,
    tableW: table ? R(table.box[2]) : null,
    gapTitleContent: head && head.ink ? null : null,
  });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('frame', 12), pad('labelTop', 9), pad('labelBot', 9), pad('headTop', 8), pad('headBot', 8), pad('inkTop', 7), pad('inkBot', 7), pad('bot空', 7), pad('inkRight', 9), pad('winW', 6), pad('winRight', 9), 'tableW');
for (const r of rows) {
  console.log(pad(r.id, 12), pad(r.labelTop, 9), pad(r.labelBot, 9), pad(r.headTop, 8), pad(r.headBot, 8), pad(r.inkTop, 7), pad(r.inkBottom, 7), pad(1080 - r.inkBottom, 7), pad(r.inkRight, 9), pad(r.winW ?? '-', 6), pad(r.winRight ?? '-', 9), r.tableW ?? '');
}
const tops = rows.map((r) => r.labelTop).filter((x) => x != null);
console.log('\nlabelTop 范围', Math.min(...tops), '..', Math.max(...tops), ' 极差', Math.max(...tops) - Math.min(...tops));
const bots = rows.map((r) => 1080 - r.inkBottom);
console.log('底部留白 范围', Math.min(...bots), '..', Math.max(...bots));
