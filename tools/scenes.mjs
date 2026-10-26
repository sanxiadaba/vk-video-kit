/**
 * 场景 → specimen。
 *
 * specimen 只是"元件独照"的宿主：1920×1080 白底，内容按安全区居中。
 * 没有页眉、标题、页脚、页码——那些属于编排层。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SCENES } from '../src/scenes/scenes.mjs';
import { hash32 } from '../src/shared/code.mjs';
import { writeIfChanged, checkMode } from './lib/io.mjs';
import { sitePath } from './lib/paths.mjs';

const check = checkMode();
const out = sitePath('specimens');
fs.mkdirSync(out, { recursive: true });

const page = (scene) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<title>${scene.tag}</title>
<link rel="stylesheet" href="../vk/fonts.css">
<link rel="stylesheet" href="../vk/vk.css">
<link rel="stylesheet" href="_stage.css">
</head>
<body>
<main class="vk-stage" data-vk-scene="${hash32(scene.body)}">
${scene.body.trim()}
</main>
<script src="../dist/vk.js"></script>
</body>
</html>
`;

for (const scene of SCENES) {
  const file = path.join(out, `${scene.tag}.html`);
  const stamp = `data-vk-scene="${hash32(scene.body)}"`;
  let existing = '';
  try {
    existing = fs.readFileSync(file, 'utf8');
  } catch {
    /* 第一次生成 */
  }
  if (check) {
    if (!existing) {
      console.error(`✗ ${file}  文件缺失`);
      process.exitCode = 1;
    } else if (!existing.includes(stamp)) {
      console.error(`✗ ${file}  scene 内容已变更`);
      process.exitCode = 1;
    }
  } else if (!existing.includes(stamp)) {
    // 已有构建好的 specimen（stamp 相同）就不再退回原始 HTML，避免和 precompile 互相覆盖。
    writeIfChanged(file, page(scene), false);
  }
}

const keep = new Set(SCENES.map((s) => `${s.tag}.html`));
keep.add('_stage.css');
for (const f of fs.readdirSync(out)) {
  if (keep.has(f)) continue;
  if (check) {
    console.error(`✗ ${path.join(out, f)}  应删除（旧 specimen）`);
    process.exitCode = 1;
  } else {
    fs.rmSync(path.join(out, f), { force: true, recursive: true });
  }
}

writeIfChanged(
  path.join(out, '_stage.css'),
  `html,
body {
  margin: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: #fff;
}
body {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: var(--vk-safe-y) var(--vk-safe-x);
  font-family: var(--vk-font-sans);
  color: var(--vk-ink-1);
}
.vk-stage {
  display: grid;
  place-items: center;
  gap: var(--vk-s3);
  width: 1680px;
  max-height: 888px;
}
`,
  check
);

console.log(`specimens: ${SCENES.length} 张`);
