import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('.tmp9/geom2.json', 'utf8'));
const R = Math.round;
for (const f of d) {
  console.log('='.repeat(100));
  console.log(`${f.id} pad=${f.pad.join(',')} align=${f.align}`);
  const stage = f.els[0];
  // 标题块
  for (const e of f.els.filter((x) => ['vk-label', 'vk-text'].includes(x.tag) && x.depth <= 3)) {
    const ink = e.ink || [];
    if (!ink.length) continue;
    const L = Math.min(...ink.map((i) => i[0])), Rr = Math.max(...ink.map((i) => i[0] + i[2]));
    const T = Math.min(...ink.map((i) => i[1])), B = Math.max(...ink.map((i) => i[1] + i[3]));
    console.log(`  T${e.depth} ${e.tag}[${e.fs}] box=${e.box.map(R).join(',')} ink=[${R(L)},${R(T)} → ${R(Rr)},${R(B)}] lines=${ink.length} «${e.text.slice(0, 26)}»`);
  }
  // 内容件（窗口类）
  for (const e of f.els.filter((x) => ['vk-code', 'vk-term', 'vk-diff', 'vk-asm', 'vk-table', 'vk-tree', 'vk-cells', 'vk-bytes', 'vk-bits', 'vk-steps', 'vk-bars', 'vk-timeline', 'vk-pair', 'vk-grid', 'vk-compare', 'vk-layer', 'vk-canvas', 'vk-box', 'vk-list', 'vk-math', 'vk-img'].includes(x.tag) && x.depth <= 3)) {
    console.log(`  C${e.depth} ${e.tag}${e.id ? '#' + e.id : ''} box=${e.box.map(R).join(',')} right=${R(e.box[0] + e.box[2])} bottom=${R(e.box[1] + e.box[3])}`);
  }
  // 关键内层：win / 行
  for (const e of f.els.filter((x) => /vk-win|vk-line|vk-steps|vk-tree-row|vk-tl|vk-bit|vk-cell/.test(x.cls) && x.depth <= 5).slice(0, 8)) {
    console.log(`  .${e.cls} box=${e.box.map(R).join(',')} fs=${e.fs}`);
  }
  for (const e of f.els.filter((x) => x.shapes)) for (const s of e.shapes) console.log(`  ~ ${s.k}.${s.cls || '-'} box=${s.box.map(R).join(',')} sw=${s.sw} stroke=${s.stroke} ${JSON.stringify(s.a).slice(0, 80)}`);
  // 最底部墨迹
  const all = f.els.flatMap((e) => (e.ink || []).map((i) => i[1] + i[3]));
  const boxes = f.els.map((e) => e.box[1] + e.box[3]);
  console.log(`  ⇒ ink bottom=${R(Math.max(...all, 0))}  box bottom=${R(Math.max(...boxes))}  bottom whitespace=${R(1080 - Math.max(...all, 0))}  top ink=${R(Math.min(...f.els.flatMap((e) => (e.ink || []).map((i) => i[1])), 9999))}`);
}
