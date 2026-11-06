import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('.tmp9/geom.json', 'utf8'));
const R = (v) => Math.round(v);
for (const f of d) {
  const tops = f.els.filter((e) => e.depth === 0 && e.tag !== 'svg');
  console.log('='.repeat(96));
  console.log(`${f.id}  align=${f.align} surface=${f.surface}`);
  for (const e of tops) {
    console.log(`  ${e.tag}${e.id ? '#' + e.id : ''} x=${R(e.x)} y=${R(e.y)} w=${R(e.w)} h=${R(e.h)} gap=${e.gap} fs=${e.fs}${e.text ? ' «' + e.text.slice(0, 24) + '»' : ''}`);
  }
  // 二级：直接子块（窗口/件）
  for (const e of f.els.filter((e) => e.depth === 1 && !['vk-label', 'vk-text'].includes(e.tag))) {
    if (e.tag === 'svg') continue;
    console.log(`    · ${e.tag}${e.id ? '#' + e.id : ''} x=${R(e.x)} y=${R(e.y)} w=${R(e.w)} h=${R(e.h)}  right=${R(e.x + e.w)} bottom=${R(e.y + e.h)}`);
  }
  const shapes = f.els.filter((e) => e.tag === 'svg').flatMap((s) => s.shapes || []);
  for (const s of shapes) console.log(`    ~ ${s.k}.${s.cls || '-'} box=${s.box.map(R).join(',')} w=${s.sw} cap=${s.cap} ${JSON.stringify(s.a).slice(0, 90)}`);
  // 文本墨迹
  for (const e of f.els.filter((e) => e.lines && ['vk-label', 'vk-text'].includes(e.tag))) {
    const L = e.lines;
    console.log(`    T ${e.tag} ${e.fs} lines=${L.length} left=${R(Math.min(...L.map((l) => l.x)))} right=${R(Math.max(...L.map((l) => l.x + l.w)))} top=${R(Math.min(...L.map((l) => l.y)))} bot=${R(Math.max(...L.map((l) => l.y + l.h)))} «${(e.text || '').slice(0, 30)}»`);
  }
}
