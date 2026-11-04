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
 *   vk capture --step "gcc -E hello.c -o hello.i" --step "gcc hello.i -o hello" --out assets/hello/build/steps.txt
 *   vk capture --shot frames/screen.html --out assets/hello/run.png
 *   vk capture --shot https://example.com --out assets/example.png --width 1440 --height 900
 *
 * 产物：
 *   <out>          文本模式：`$ 命令` + stdout/stderr（就是终端里看到的样子）
 *   <out>.meta.json 元数据：命令、cwd、退出码、耗时、机器、时间、产物哈希；
 *                  --step 模式额外记录每一步的 steps（cmd/exit/ms/stdout/stderr）
 *
 * 文本模式的产物可以直接喂给 <vk-term src> / <vk-code src>：不需要任何运行期改动。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseCueSource } from '../src/shared/cues.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
// 可重复的开关：--step "..." --step "..."。顺序就是执行顺序。
const flagAll = (name) => {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== `--${name}`) continue;
    const v = args[i + 1];
    if (!v || v.startsWith('--')) {
      console.error(`capture: --${name} 后面缺命令`);
      process.exit(2);
    }
    found.push(v);
    i++;
  }
  return found;
};

const runCmd = flag('run');
const stepCmds = flagAll('step');
const shot = flag('shot');
const cuesPage = flag('cues');
const cueFile = flag('cue');
const out = flag('out');
const outDir = flag('out-dir', out);
const cwd = path.resolve(String(flag('cwd', process.cwd())));
const timeout = Number(flag('timeout', 30000));
const shell = String(flag('shell', process.platform === 'win32' ? 'powershell' : 'bash'));
const width = Number(flag('width', 1920));
const height = Number(flag('height', 1080));
const quiet = args.includes('--quiet');
// 有些组件只吃纯正文（vk-asm 不接受提示符行）：--no-prompt 去掉提示符行。
const noPrompt = args.includes('--no-prompt');
// 有些命令会先打印表头（objdump 的 file format 三行）：--skip-until 从这里之后开始记。
const skipUntil = flag('skip-until');
const verify = flag('verify');
// 提示符：--run 保持原来的平台默认（Windows 是 >），--step 默认 $。
const promptArg = flag('prompt');

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
  // 文本产物按 utf8 复算、截图产物按原始字节复算——采集时怎么算的，这里就怎么算。
  const now = meta.kind === 'shot' ? hash(buf) : hash(buf.toString('utf8'));
  if (now !== meta.outHash) {
    const rerun = meta.kind === 'shot'
      ? `--shot "${meta.target}" --width ${meta.width} --height ${meta.height}`
      : meta.steps?.length
        ? meta.steps.map((s) => `--step "${s.cmd}"`).join(' ')
        : `--run "${meta.cmd}"`;
    console.error(`capture: ${path.basename(file)} 与它记录的命令结果不一致（${meta.outHash} → ${now}）。重跑：vk capture ${rerun} --out ${file}`);
    process.exit(1);
  }
  const label = meta.kind === 'shot' ? `${meta.width}×${meta.height} 截图` : meta.steps?.length ? `${meta.steps.length} 步` : meta.cmd;
  if (!quiet) console.log(`capture: ${path.basename(file)} 与记录一致（${label}）`);
  process.exit(0);
}

if (runCmd && stepCmds.length) {
  console.error('capture: --run 与 --step 只能二选一（--step 可重复，按顺序执行）');
  process.exit(2);
}
const modes = [!!runCmd, stepCmds.length > 0, !!shot, !!cuesPage].filter(Boolean).length;
if (modes > 1) {
  console.error('capture: --run / --step / --shot / --cues 只能四选一');
  process.exit(2);
}
if (!cuesPage && !out) {
  console.error('capture: 这个模式需要 --out <文件>');
  process.exit(2);
}
if ((!runCmd && !shot && !stepCmds.length && !cuesPage) || (!out && !outDir)) {
  console.error(`用法：
  vk capture --run "<命令>" --out <文件.txt>   [--cwd .] [--timeout 30000] [--shell powershell|bash] [--prompt "$"] [--no-prompt] [--skip-until "<行首文字>"]
  vk capture --step "<命令>" [--step "<命令>" …] --out <文件.txt>
                                                依次执行每一步，写成 "$ 命令" + 该步输出（--step 与 --run 互斥）
  vk capture --shot <页面|URL> --out <文件.png> [--width 1920] [--height 1080]
  vk capture --cues <页面|URL> --out-dir <目录> [--cue <cue.json|字幕.srt>] [--width 1920] [--height 1080]
                                                按字幕时间点逐段 seek 并截图；--cue 可覆盖页面自带的轨道
  vk capture --verify <文件>                   校验产物与记录的命令结果是否一致`);
  process.exit(2);
}

function hash(buf) {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
const machine = `${process.platform}-${process.arch}`;

async function writeMeta(file, meta) {
  await fs.writeFile(`${file}.meta.json`, JSON.stringify(meta, null, 2) + '\n', 'utf8');
}

// 跑一条命令，收齐 stdout/stderr/退出码/耗时。每一步都用同一个 cwd、同一套超时与环境。
async function exec(command) {
  const started = Date.now();
  const child =
    process.platform === 'win32' && shell === 'powershell'
      ? spawn(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            // 统一成 UTF-8：不然中文路径在采集结果里会变成乱码（实测：D:\test\�½��ļ���）。
            '$ErrorActionPreference="Continue"; [Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + command,
          ],
          { cwd, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
        )
      : spawn(shell, ['-lc', command], { cwd });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString()));
  child.stderr.on('data', (d) => (stderr += d.toString()));
  const timer = setTimeout(() => child.kill(), timeout);
  const exit = await new Promise((resolve) => child.on('close', (code) => resolve(code ?? -1)));
  clearTimeout(timer);
  return { cmd: command, exit, ms: Date.now() - started, stdout, stderr };
}

// 终端里看到的样子：提示符 + 命令，再输出（stderr 也并进来，视频里本来就是混着看的）。
const piece = (s) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
const line = (prompt, r) => {
  const parts = [];
  if (!noPrompt) parts.push(`${prompt} ${r.cmd}`);
  const stdout = piece(r.stdout);
  const stderr = r.stderr.trim() ? piece(r.stderr) : '';
  if (stdout) parts.push(stdout);
  if (stderr) parts.push(stderr);
  return parts.join('\n');
};

function cutSkip(body) {
  if (!skipUntil) return body;
  const at = body.indexOf(String(skipUntil));
  if (at < 0) return body;
  return body.slice(body.indexOf('\n', at) + 1);
}

async function captureRun() {
  const prompt = typeof promptArg === 'string' ? promptArg : process.platform === 'win32' ? '>' : '$';
  const r = await exec(runCmd);
  const body = line(prompt, r);
  const content = cutSkip(body).replace(/\n{2,}/g, '\n\n').trimEnd() + '\n';
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, content, 'utf8');
  await writeMeta(out, {
    kind: 'run',
    cmd: runCmd,
    shell,
    cwd,
    exit: r.exit,
    ms: r.ms,
    at: new Date().toISOString(),
    machine,
    stdout: r.stdout.trimEnd(),
    stderr: r.stderr.trimEnd(),
    outHash: hash(content),
  });
  if (!quiet) console.log(`capture: ${out}（${body.split('\n').length} 行，退出码 ${r.exit}，${r.ms}ms）`);
}

async function captureSteps() {
  const prompt = typeof promptArg === 'string' ? promptArg : '$';
  const started = Date.now();
  const steps = [];
  const chunks = [];
  for (const cmd of stepCmds) {
    const r = await exec(cmd);
    steps.push({ cmd: r.cmd, exit: r.exit, ms: r.ms, stdout: r.stdout.trimEnd(), stderr: r.stderr.trimEnd() });
    chunks.push(line(prompt, r));
  }
  const body = chunks.filter(Boolean).join('\n');
  const content = cutSkip(body).trimEnd() + '\n';
  const exit = steps.find((s) => s.exit !== 0)?.exit ?? 0;
  const ms = Date.now() - started;
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, content, 'utf8');
  await writeMeta(out, {
    kind: 'run',
    cmd: stepCmds.join(' ; '),
    shell,
    cwd,
    exit,
    ms,
    at: new Date().toISOString(),
    machine,
    stdout: steps.map((s) => s.stdout).filter(Boolean).join('\n'),
    stderr: steps.map((s) => s.stderr).filter(Boolean).join('\n'),
    steps,
    outHash: hash(content),
  });
  if (!quiet) {
    console.log(`capture: ${out}（${steps.length} 步，${content.split('\n').length - 1} 行，退出码 ${exit}，${ms}ms）`);
  }
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

/** 从页面所在目录往上找"项目根"：有 vk/vk.css 或 dist/vk.js 的那一层。找不到就退回页面目录。 */
async function projectRoot(abs) {
  const has = (p) => fs.access(p).then(() => true, () => false);
  let dir = path.dirname(abs);
  for (let i = 0; i < 8; i++) {
    const [css, js] = await Promise.all([has(path.join(dir, 'vk/vk.css')), has(path.join(dir, 'dist/vk.js'))]);
    if (css || js) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.dirname(abs);
}

async function captureCues() {
  if (typeof cuesPage !== 'string') {
    console.error('capture: --cues 后面要跟页面路径或 URL');
    process.exit(2);
  }
  if (typeof outDir !== 'string') {
    console.error('capture: --cues 需要 --out-dir <目录>');
    process.exit(2);
  }

  const pageArg = String(cuesPage);
  const isUrl = /^https?:\/\//i.test(pageArg);
  let target = pageArg;
  let server = null;
  if (!isUrl) {
    const abs = path.resolve(pageArg);
    const parts = abs.split(path.sep);
    const siteAt = parts.lastIndexOf('_site');
    // 页面在 frames/ 这类子目录里时，共享资源（vk/vk.css、dist/vk.js、assets/）在项目根：
    // 服务根要取"有 vk.css 的那一层"，否则 ../vk/vk.css 会被压进子目录解析成 404。
    const root = siteAt >= 0 ? parts.slice(0, siteAt + 1).join(path.sep) : await projectRoot(abs);
    const rel = siteAt >= 0 ? parts.slice(siteAt + 1).join('/') : path.relative(root, abs).split(path.sep).join('/');
    const { startServer } = await import('./serve.mjs');
    const started = await startServer({ port: 0, root, transform: false });
    server = started;
    target = `${started.base}/${rel}`;
  }

  let track = null;
  if (typeof cueFile === 'string') {
    const text = await fs.readFile(path.resolve(cueFile), 'utf8');
    track = parseCueSource(text, cueFile.toLowerCase().endsWith('.json') ? 'json' : '');
  }

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  let exitCode = 0;
  try {
    const resp = await tab.goto(target, { waitUntil: 'load', timeout: 30000 });
    if (!resp || !resp.ok()) throw new Error(`打开 ${target} 失败：HTTP ${resp?.status()}`);
    await tab.evaluate(() => window.vk?.ready?.());

    if (!track) {
      track = await tab.evaluate(() => window.vk?.cues?.() || []);
    }
    if (!track.length) throw new Error('这页没有字幕轨：给 <vk-page cues="…"> 或 --cue 指定一份 cue.json / .srt');

    const dir = path.resolve(String(outDir));
    await fs.mkdir(dir, { recursive: true });
    const shots = [];
    for (const [i, cue] of track.entries()) {
      // 取每条字幕的中点；至少留 0.05s，避免把 0 秒边界当成"还没开始"。
      const t = cue.start + Math.min(0.4, Math.max(0.05, (cue.end - cue.start) / 2));
      await tab.evaluate((time) => window.vk.seek(time), t);
      // 焦点 / 切态都有 200ms 过渡；录屏截图等它落定。
      await tab.waitForTimeout(240);
      const file = `cue-${String(i + 1).padStart(2, '0')}.png`;
      const abs = path.join(dir, file);
      await tab.screenshot({ path: abs, type: 'png' });
      shots.push({
        index: i + 1,
        start: cue.start,
        end: cue.end,
        t: +t.toFixed(3),
        text: cue.text || '',
        ...(cue.focus ? { focus: cue.focus } : {}),
        ...(cue.state ? { state: cue.state } : {}),
        file,
      });
      if (!quiet) console.log(`capture: ${abs}（${cue.start.toFixed(2)}–${cue.end.toFixed(2)}s · t=${t.toFixed(2)}s）`);
    }
    const manifest = {
      kind: 'cues',
      page: pageArg,
      width,
      height,
      scale: 2,
      at: new Date().toISOString(),
      machine,
      cues: shots,
    };
    await fs.writeFile(path.join(dir, 'cues.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    if (!quiet) console.log(`capture: ${path.join(dir, 'cues.json')}（${shots.length} 段）`);
  } catch (e) {
    exitCode = 1;
    console.error(`capture: ${e.message}`);
  } finally {
    await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
  if (exitCode) process.exitCode = exitCode;
}

if (stepCmds.length) await captureSteps();
else if (runCmd) await captureRun();
else if (cuesPage) await captureCues();
else await captureShot();
