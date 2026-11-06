import fs from 'node:fs';
import { PNG } from 'pngjs';

// node probe.mjs <frame> row <y> [thresh] | col <x>
const [frame, mode, pos, th] = process.argv.slice(2);
const png = PNG.sync.read(fs.readFileSync(`.tmp9/render/${frame}.png`));
const T = Number(th || 18);
const px = (x, y) => {
  const i = (y * png.width + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
};
const runs = (vals) => {
  const out = [];
  let s = -1;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]) { if (s < 0) s = i; }
    else if (s >= 0) { out.push([s, i - 1, i - s]); s = -1; }
  }
  if (s >= 0) out.push([s, vals.length - 1, vals.length - s]);
  return out;
};
const P = Number(pos);
if (mode === 'row') {
  const vals = [];
  for (let x = 0; x < png.width; x++) {
    const [r, g, b] = px(x, P);
    vals.push(Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) > T);
  }
  console.log(`row y=${P}`, JSON.stringify(runs(vals)));
} else if (mode === 'col') {
  const vals = [];
  for (let y = 0; y < png.height; y++) {
    const [r, g, b] = px(P, y);
    vals.push(Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255) > T);
  }
  console.log(`col x=${P}`, JSON.stringify(runs(vals)));
} else if (mode === 'colors') {
  // 采样一条线上出现过的颜色（粗聚类）
  const m = new Map();
  for (let x = 0; x < png.width; x++) {
    const [r, g, b] = px(x, P);
    const k = `${r},${g},${b}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  console.log([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
}
