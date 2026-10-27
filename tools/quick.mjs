/**
 * 单组件快速闭环：只 build + 只跑一个标签的门禁 + 只拍一张图。
 *
 *   node tools/quick.mjs vk-code
 *   node tools/quick.mjs vk-code --no-build
 *   node tools/quick.mjs vk-code --no-gate --no-shot
 *
 * 和 npm test 的区别：不跑 31 个标签、不跑全量契约、不重拍全部截图。
 * 视觉迭代时用它；里程碑再用 npm test。
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const tag = args.find((a) => !a.startsWith('-'));
const noBuild = args.includes('--no-build');
const noGate = args.includes('--no-gate');
const noShot = args.includes('--no-shot');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const started = Date.now();

if (!tag) {
  console.error('用法：node tools/quick.mjs <tag> [--no-build] [--no-gate] [--no-shot]');
  process.exit(1);
}

const step = (label, cmd, cmdArgs) => {
  const t = Date.now();
  const r = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && cmd.endsWith('.cmd'),
  });
  const ms = Date.now() - t;
  console.log(`· ${label.padEnd(7)} ${(ms / 1000).toFixed(1)}s`);
  return r.status ?? 1;
};

let code = 0;
if (!noBuild) code = step('build', npmCmd, ['run', 'build']);
if (!code && !noGate) code = step('gate', process.execPath, ['tools/gate.mjs', tag]);
if (!code && !noShot) code = step('shot', process.execPath, ['tools/shot.mjs', `_site/specimen/${tag}.html`]);

console.log(`\nquick ${tag} ${code ? '✗' : '✓'} ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exitCode = code;
