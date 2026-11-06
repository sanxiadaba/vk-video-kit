import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// 用法：node crop.mjs <frame> <x> <y> <w> <h> [scale]
const [frame, x0, y0, w, h, s] = process.argv.slice(2);
const sc = Number(s || 2);
const src = PNG.sync.read(fs.readFileSync(`.tmp9/render/${frame}.png`));
const X = Number(x0), Y = Number(y0), W = Number(w), H = Number(h);
const out = new PNG({ width: W * sc, height: H * sc });
for (let y = 0; y < H * sc; y++) {
  for (let x = 0; x < W * sc; x++) {
    const sx = Math.min(src.width - 1, X + Math.floor(x / sc));
    const sy = Math.min(src.height - 1, Y + Math.floor(y / sc));
    const i = (sy * src.width + sx) << 2;
    const o = (y * out.width + x) << 2;
    out.data[o] = src.data[i]; out.data[o + 1] = src.data[i + 1]; out.data[o + 2] = src.data[i + 2]; out.data[o + 3] = 255;
  }
}
fs.mkdirSync('.tmp9/crops', { recursive: true });
const name = `.tmp9/crops/${frame}-${X}-${Y}-${W}x${H}-${sc}x.png`;
fs.writeFileSync(name, PNG.sync.write(out));
console.log(name);
