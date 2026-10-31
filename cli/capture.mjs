#!/usr/bin/env node
/**
 * vk capture —— 把"真实材料"采集进仓库。
 *
 * 为什么要有它：demo 里出现过手写的终端输出、假的"截图"（其实是一段文字），
 * 于是画面看起来对、内容却是编的。技术讲解视频的第一原则是**素材是真的**：
 * 真的跑过那条命令、真的截过那个屏幕。
 *
 *   vk capture --run "gcc -E hello.c -o hello.i" --out assets/hello/preprocess.txt
 *   vk capture --run "bash" --cwd . --timeout 20000 ...
 *   vk capture --shot frames/screen.html --out assets/hello/run.png
 *   vk capture --shot https://example.com --out assets/example.png --width 1440 --height 900
 *
 * 产物：
 *   <out>          文本模式：`$ 命令` + stdout/stderr（就是终端里看到的样子）
 *   <out>.meta.json 元数据：命令、cwd、退出码、耗时、机器、时间、产物哈希
 *
 * 文本模式的产物可以直接喂给 <vk-term src> / <vk-code src>：不需要任何运行期改动。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

const runCmd = flag('run');
const shot = flag('shot');
const out = flag('out');
const cwd = path.resolve(String(flag('cwd', process.cwd())));
const timeout = Number(flag('timeout', 30000));
const shell = String(flag('shell', process.platform === 'win32' ? 'powershell' : 'bash'));
const width = Number(flag('width', 1920));
const height = Number(flag('height', 1080));
const quiet = args.includes('--quiet');
const verify = flag('verify');

if (verify) {
  // 校验模式：素材必须和它记录的命令/哈希一致。改了素材却没重跑命令，这里会红。
  const file = String(verify);
  const metaRaw = await fs.readFile(file + '.meta.json', 'utf8').catch(() => null);
  if (!metaRaw) {
    console.error(`capture: 缺少 ${path.basename(file)}.meta.json（这个文件不是 vk capture 生成的？）`);
    process.exit(1);
  }
  const meta = JSON.parse(metaRaw);
  const buf = await fs.readFile(file);
  const now = hash(buf.toString('utf8'));
  if (now !== meta.outHash) {
    console.error(`capture: ${path.basename(file)} 与它记录的命令结果不一致（${meta.outHash} → ${now}）。重跑：vk capture --run "${meta.cmd}" --out ${file}`);
    process.exit(1);
  }
  if (!quiet) console.log(`capture: ${path.basename(file)} 与记录一致（${meta.cmd}）`);
  process.exit(0);
}

if ((!runCmd && !shot) || !out) {
  console.error(`用法：
  vk capture --run "<命令>" --out <文件.txt>   [--cwd .] [--timeout 30000] [--shell powershell|bash]
  vk capture --shot <页面|URL> --out <文件.png> [--width 1920] [--height 1080]`);
  process.exit(2);
}

function hash(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
const machine = `${process.platform}-${process.arch}`;

async function writeMeta(file, meta) {
  await fs.writeFile(`${file}.meta.json`, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

async function captureRun() {
  const started = Date.now();
  const child =
    process.platform === 'win32' && shell === 'powershell'
      ? spawn('powershell', ['-NoProfile', '-Command', runCmd], { cwd, windowsHide: true })
      : spawn(shell, ['-lc', runCmd], { cwd });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString()));
  child.stderr.on('data', (d) => (stderr += d.toString()));
  const timer = setTimeout(() => child.kill(), timeout);
  const exit = await new Promise((resolve) => child.on('close', (code) => resolve(code ?? -1)));
  clearTimeout(timer);
  const ms = Date.now() - started;

  // 终端里看到的样子：先提示符 + 命令，再输出（stderr 也并进来，视频里本来就是混着看的）
  const prompt = process.platform === 'win32' ? '>' : '$';
  const body = [`${prompt} ${runCmd}`, stdout.replace(/\r\n/g, '\n').replace(/\n+$/, ''), stderr.trim() ? stderr.replace(/\r\n/g, '\n').trimEnd() : '']
    .filter((s) => s !== '')
    .join('\n');

  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const content = body + '\n';
  await fs.writeFile(out, content, 'utf8');
  await writeMeta(out, {
    kind: 'run',
    cmd: runCmd,
    shell,
    cwd,
    exit,
    ms,
    at: new Date().toISOString(),
    machine,
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
    outHash: hash(content),
  });
  if (!quiet) console.log(`capture: ${out}（${body.split('\n').length} 行，退出码 ${exit}，${ms}ms）`);
}

async function captureShot() {
  const { chromium } = await import('playwright-core');
  const isUrl = /^https?:\/\//i.test(String(shot));
  const target = isUrl ? String(shot) : 'file://' + path.resolve(String(shot));
  const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => window.vk?.ready?.());
  await page.waitForTimeout(200);
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  const buf = await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  await writeMeta(out, {
    kind: 'shot',
    target: String(shot),
    width,
    height,
    scale: 2,
    at: new Date().toISOString(),
    machine,
    outHash: hash(buf),
  });
  if (!quiet) console.log(`capture: ${out}（${width}×${height} @2x）`);
}

if (runCmd) await captureRun();
else await captureShot();
